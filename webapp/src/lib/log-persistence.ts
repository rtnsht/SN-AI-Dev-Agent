/**
 * Log Persistence Layer — Async dual-write to Supabase.
 *
 * Buffers log entries in memory and flushes to Supabase periodically.
 * Never blocks or throws into the logging pipeline.
 *
 * Scale safeguards (2000 concurrent users on Render Pro):
 *  - Per-session buffer cap: 200 entries (drops oldest on overflow)
 *  - Global buffer cap: ~50 MB (stops enqueueing when hit)
 *  - Staggered flush: batches of 20 sessions, 500ms gaps, max 10 concurrent
 *  - JSONB cap: 500 entries/row, then metadata-only updates
 *  - SIGTERM: best-effort flush with 7s timeout
 *  - Upsert-based self-healing if session row was not created
 *  - Per-session flush lock to prevent concurrent flushes
 *  - Cumulative counters across flushes (not per-batch)
 *  - Fetch+merge fallback to prevent log_entries overwrite
 */

import { getSupabase } from "./supabase";

const ENABLED = process.env.LOG_PERSISTENCE_ENABLED === "true";
const FLUSH_INTERVAL_MS = parseInt(process.env.LOG_FLUSH_INTERVAL_MS || "30000", 10);
const PER_SESSION_CAP = 200;
const GLOBAL_BUFFER_BYTES_CAP = 50 * 1024 * 1024; // 50 MB
const JSONB_ENTRIES_CAP = 500;
const FLUSH_BATCH_SIZE = 20;
const FLUSH_BATCH_DELAY_MS = 500;
const FLUSH_CONCURRENCY = 10;
const SIGTERM_TIMEOUT_MS = 7000;

interface LogEntry {
  timestamp: string;
  level: string;
  sessionId: string;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

interface SessionCounters {
  totalRounds: number;
  totalToolCalls: number;
  totalErrors: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  currentPhase: string;
  phases: string[];
}

class LogPersistence {
  private buffer = new Map<string, LogEntry[]>();
  private entriesFlushed = new Map<string, number>();
  private cumulativeCounters = new Map<string, SessionCounters>();
  private flushing = new Set<string>();
  private finalized = new Set<string>(); // Bug 6: prevent double-finalization
  private globalBufferBytes = 0;
  private flushInterval: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  constructor() {
    this.startFlushLoop();
    this.registerShutdownHook();
  }

  enqueue(sessionId: string, entry: LogEntry): void {
    if (this.shuttingDown) return;

    if (this.globalBufferBytes >= GLOBAL_BUFFER_BYTES_CAP) return;

    let entries = this.buffer.get(sessionId);
    if (!entries) {
      entries = [];
      this.buffer.set(sessionId, entries);
    }

    const entrySize = JSON.stringify(entry).length;

    if (entries.length >= PER_SESSION_CAP) {
      const dropped = entries.shift();
      if (dropped) {
        this.globalBufferBytes -= JSON.stringify(dropped).length;
      }
    }

    entries.push(entry);
    this.globalBufferBytes += entrySize;
  }

  async flush(sessionId: string): Promise<void> {
    // BUG-6 fix: Per-session flush lock to prevent concurrent flushes
    if (this.flushing.has(sessionId)) return;
    this.flushing.add(sessionId);

    try {
      await this._doFlush(sessionId);
    } finally {
      this.flushing.delete(sessionId);
    }
  }

  private async _doFlush(sessionId: string): Promise<void> {
    const entries = this.buffer.get(sessionId);
    if (!entries || entries.length === 0) return;

    // BUG-2 fix: Atomically drain the buffer using splice instead of
    // snapshot + clear. This prevents losing entries added during async DB writes.
    const batch = entries.splice(0, entries.length);
    const batchBytes = batch.reduce((s, e) => s + JSON.stringify(e).length, 0);
    this.globalBufferBytes -= batchBytes;

    const flushedSoFar = this.entriesFlushed.get(sessionId) || 0;

    console.log(`[log-persistence] Flush: sessionId=${sessionId}, entries=${batch.length}, flushedSoFar=${flushedSoFar}`);

    // BUG-3+4 fix: Accumulate counters across flushes, not per-batch
    const batchCounters = this.extractCounters(batch);
    const cumulative = this.accumulateCounters(sessionId, batchCounters);

    const telemetrySummary = {
      totalRounds: cumulative.totalRounds,
      totalToolCalls: cumulative.totalToolCalls,
      totalErrors: cumulative.totalErrors,
      totalInputTokens: cumulative.totalInputTokens,
      totalOutputTokens: cumulative.totalOutputTokens,
      currentPhase: cumulative.currentPhase,
      phases: cumulative.phases,
      lastFlushAt: new Date().toISOString(),
    };

    let writeSucceeded = false;

    try {
      const db = getSupabase();

      if (flushedSoFar < JSONB_ENTRIES_CAP) {
        const entriesToAppend = batch.slice(0, JSONB_ENTRIES_CAP - flushedSoFar);
        const overflow = flushedSoFar + entriesToAppend.length >= JSONB_ENTRIES_CAP;

        const { error } = await db.rpc("append_session_log_entries", {
          p_session_id: sessionId,
          p_entries: entriesToAppend,
          p_total_rounds: cumulative.totalRounds,
          p_total_tool_calls: cumulative.totalToolCalls,
          p_total_errors: cumulative.totalErrors,
          p_total_input_tokens: cumulative.totalInputTokens,
          p_total_output_tokens: cumulative.totalOutputTokens,
          p_current_phase: cumulative.currentPhase,
          p_phases: cumulative.phases,
          p_overflow: overflow,
        });

        if (error) {
          console.error(`[log-persistence] RPC failed for ${sessionId}:`, error.message, error.details || "");
          writeSucceeded = await this.upsertFallback(sessionId, entriesToAppend, cumulative, overflow);
        } else {
          console.log(`[log-persistence] RPC succeeded for ${sessionId}: ${entriesToAppend.length} entries appended`);
          writeSucceeded = true;
        }

        if (writeSucceeded) {
          this.entriesFlushed.set(sessionId, flushedSoFar + entriesToAppend.length);
        }
      } else {
        const { error } = await db
          .from("session_logs")
          .update({
            total_rounds: cumulative.totalRounds,
            total_tool_calls: cumulative.totalToolCalls,
            total_errors: cumulative.totalErrors,
            total_input_tokens: cumulative.totalInputTokens,
            total_output_tokens: cumulative.totalOutputTokens,
            current_phase: cumulative.currentPhase,
            phases: cumulative.phases,
            entries_overflow: true,
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId);

        writeSucceeded = !error;
        if (error) {
          console.error(`[log-persistence] overflow update failed for ${sessionId}:`, error);
        }
      }

      // Persist telemetry_summary on every successful flush
      if (writeSucceeded) {
        try {
          const db2 = getSupabase();
          await db2
            .from("session_logs")
            .update({ telemetry_summary: telemetrySummary })
            .eq("session_id", sessionId);
        } catch { /* telemetry write is best-effort */ }
      }
    } catch (err) {
      console.error(`[log-persistence] flush failed for ${sessionId}:`, err);
    }

    // BUG-5 fix: If write failed, push batch back into the buffer for retry
    if (!writeSucceeded) {
      const currentEntries = this.buffer.get(sessionId) || [];
      const restored = [...batch, ...currentEntries];
      // Re-cap to PER_SESSION_CAP (keep newest)
      if (restored.length > PER_SESSION_CAP) {
        const dropped = restored.splice(0, restored.length - PER_SESSION_CAP);
        const droppedBytes = dropped.reduce((s, e) => s + JSON.stringify(e).length, 0);
        // Don't adjust globalBufferBytes for dropped — they were already subtracted
        // but we need to add back what we're restoring
        void droppedBytes;
      }
      this.buffer.set(sessionId, restored);
      this.globalBufferBytes += restored.reduce((s, e) => s + JSON.stringify(e).length, 0);
    }
  }

  async finalizeSession(
    sessionId: string,
    telemetrySummary?: Record<string, unknown>
  ): Promise<void> {
    // Bug 6: prevent double-finalization (endSession + direct call from session-end route)
    if (this.finalized.has(sessionId)) return;
    this.finalized.add(sessionId);

    console.log(`[log-persistence] Finalizing session ${sessionId}`);

    // Bug 4: wait for any in-progress periodic flush to complete before flushing
    let waitAttempts = 0;
    while (this.flushing.has(sessionId) && waitAttempts < 20) {
      await sleep(50);
      waitAttempts++;
    }

    await this.flush(sessionId);

    try {
      const db = getSupabase();
      await db
        .from("session_logs")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          telemetry_summary: telemetrySummary || null,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);
    } catch (err) {
      console.error(`[log-persistence] finalizeSession failed for ${sessionId}:`, err);
    }

    // Bug 2: only delete buffer if flush succeeded (buffer is empty)
    const remaining = this.buffer.get(sessionId);
    if (!remaining || remaining.length === 0) {
      this.buffer.delete(sessionId);
      this.entriesFlushed.delete(sessionId);
      this.cumulativeCounters.delete(sessionId);
    } else {
      console.warn(`[log-persistence] ${remaining.length} entries still in buffer after finalize for ${sessionId}`);
    }
    this.finalized.delete(sessionId); // Allow re-finalization if session resumes after server restart
  }

  async flushAll(timeoutMs: number = SIGTERM_TIMEOUT_MS): Promise<void> {
    const sessionIds = [...this.buffer.keys()].filter(
      (id) => (this.buffer.get(id)?.length || 0) > 0
    );
    if (sessionIds.length === 0) return;

    const deadline = Date.now() + timeoutMs;

    for (let i = 0; i < sessionIds.length; i += FLUSH_BATCH_SIZE) {
      if (Date.now() >= deadline) {
        console.warn(
          `[log-persistence] flushAll timeout — ${sessionIds.length - i} sessions skipped`
        );
        break;
      }

      const batch = sessionIds.slice(i, i + FLUSH_BATCH_SIZE);
      await this.flushConcurrent(batch);

      if (i + FLUSH_BATCH_SIZE < sessionIds.length && Date.now() < deadline) {
        await sleep(FLUSH_BATCH_DELAY_MS);
      }
    }
  }

  // --- Private helpers ---

  private async flushConcurrent(sessionIds: string[]): Promise<void> {
    const chunks: string[][] = [];
    for (let i = 0; i < sessionIds.length; i += FLUSH_CONCURRENCY) {
      chunks.push(sessionIds.slice(i, i + FLUSH_CONCURRENCY));
    }
    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map((id) => this.flush(id)));
    }
  }

  // BUG-1 fix: Fetch existing log_entries and merge instead of replacing
  private async upsertFallback(
    sessionId: string,
    entries: LogEntry[],
    counters: SessionCounters,
    overflow: boolean
  ): Promise<boolean> {
    try {
      const db = getSupabase();

      // Fetch existing log_entries to merge instead of overwrite
      let mergedEntries = entries;
      const { data: existing, error: fetchError } = await db
        .from("session_logs")
        .select("log_entries")
        .eq("session_id", sessionId)
        .maybeSingle(); // maybeSingle returns null (not error) for 0 rows

      if (fetchError) {
        // Genuine DB error — abort to avoid overwriting existing entries
        console.error(`[log-persistence] upsertFallback fetch failed for ${sessionId}, aborting to prevent overwrite:`, fetchError.message);
        return false;
      }

      if (existing?.log_entries && Array.isArray(existing.log_entries)) {
        const combined = [...existing.log_entries, ...entries];
        mergedEntries = combined.slice(-JSONB_ENTRIES_CAP);
      }

      const { error } = await db.from("session_logs").upsert(
        {
          session_id: sessionId,
          log_entries: mergedEntries,
          total_rounds: counters.totalRounds,
          total_tool_calls: counters.totalToolCalls,
          total_errors: counters.totalErrors,
          total_input_tokens: counters.totalInputTokens,
          total_output_tokens: counters.totalOutputTokens,
          current_phase: counters.currentPhase,
          phases: counters.phases,
          entries_overflow: overflow,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );
      if (error) {
        console.error(`[log-persistence] upsertFallback DB error for ${sessionId}:`, error.message, error.details);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[log-persistence] upsertFallback failed for ${sessionId}:`, err);
      return false;
    }
  }

  // BUG-3 fix: Accumulate counters across flushes
  private accumulateCounters(sessionId: string, batchCounters: SessionCounters): SessionCounters {
    const prev = this.cumulativeCounters.get(sessionId) || {
      totalRounds: 0,
      totalToolCalls: 0,
      totalErrors: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      currentPhase: "",
      phases: [],
    };

    const accumulated: SessionCounters = {
      totalRounds: Math.max(prev.totalRounds, batchCounters.totalRounds),
      totalToolCalls: prev.totalToolCalls + batchCounters.totalToolCalls,
      totalErrors: prev.totalErrors + batchCounters.totalErrors,
      totalInputTokens: prev.totalInputTokens + batchCounters.totalInputTokens,
      totalOutputTokens: prev.totalOutputTokens + batchCounters.totalOutputTokens,
      currentPhase: batchCounters.currentPhase || prev.currentPhase,
      phases: [...new Set([...prev.phases, ...batchCounters.phases])],
    };

    this.cumulativeCounters.set(sessionId, accumulated);
    return accumulated;
  }

  private extractCounters(batch: LogEntry[]): SessionCounters {
    let totalRounds = 0;
    let totalToolCalls = 0;
    let totalErrors = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let currentPhase = "";
    const phasesSet = new Set<string>();

    for (const entry of batch) {
      const d = entry.data || {};

      if (entry.message.match(/[Rr]ound \d+/)) {
        const m = entry.message.match(/[Rr]ound (\d+)/);
        if (m) totalRounds = Math.max(totalRounds, parseInt(m[1]));
      }

      if (entry.category === "mcp_tool") {
        totalToolCalls++;
        if (entry.level === "error" || d.success === false) totalErrors++;
      }

      if (
        entry.message.includes("response received") ||
        entry.message.includes("API response")
      ) {
        totalInputTokens += (d.inputTokens as number) || 0;
        totalOutputTokens += (d.outputTokens as number) || 0;
      }

      if (d.phase && typeof d.phase === "string") {
        currentPhase = d.phase;
        phasesSet.add(d.phase);
      }
    }

    return {
      totalRounds,
      totalToolCalls,
      totalErrors,
      totalInputTokens,
      totalOutputTokens,
      currentPhase,
      phases: [...phasesSet],
    };
  }

  private startFlushLoop(): void {
    this.flushInterval = setInterval(() => {
      this.flushAll(FLUSH_INTERVAL_MS - 1000).catch((err) => {
        console.error("[log-persistence] flush loop error:", err);
      });
    }, FLUSH_INTERVAL_MS);

    if (this.flushInterval.unref) {
      this.flushInterval.unref();
    }
  }

  private registerShutdownHook(): void {
    const handler = () => {
      this.shuttingDown = true;
      if (this.flushInterval) clearInterval(this.flushInterval);
      this.flushAll(SIGTERM_TIMEOUT_MS).catch(() => {});
    };
    process.on("SIGTERM", handler);
    process.on("SIGINT", handler);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Singleton — only instantiated when enabled
let _instance: LogPersistence | null = null;

export function getLogPersistence(): LogPersistence | null {
  if (!ENABLED) return null;
  if (!_instance) {
    _instance = new LogPersistence();
  }
  return _instance;
}
