/**
 * Live Telemetry Generator
 *
 * Parses session JSONL logs every 15 seconds and generates/updates
 * a telemetry-{sessionSuffix}.md file with a live summary.
 */

import fs from "fs";
import path from "path";

const LOGS_DIR = path.join(process.cwd(), "logs");
const THROTTLE_MS = 15_000; // 15 seconds

// Track last generation time per session to throttle
const lastGenTime = new Map<string, number>();
// Track active intervals for cleanup
const activeIntervals = new Map<string, NodeJS.Timeout>();

// ── Types ──────────────────────────────────────────────────────────────────

interface LogEntry {
  timestamp: string;
  level: string;
  sessionId: string;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

interface RoundInfo {
  roundNum: number;
  startTime: string;
  durationMs: number;
  tools: { name: string; durationMs: number; success: boolean }[];
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

interface SessionTelemetry {
  sessionId: string;
  sessionSuffix: string;
  logFile: string;
  // Connect metadata
  instanceUrl: string;
  username: string;
  userFullName: string;
  model: string;
  aiProvider: string;
  connectTime: string;
  // Running state
  currentPhase: string;
  totalRounds: number;
  maxRounds: number;
  totalToolCalls: number;
  toolErrors: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  sessionStartTime: string;
  lastUpdateTime: string;
  elapsedSeconds: number;
  isComplete: boolean;
  finalStopReason: string;
  // Per-round data
  rounds: RoundInfo[];
  // Phase transitions
  phases: { phase: string; enteredAt: string; toolsFiltered: number }[];
  // Tool usage stats
  toolStats: Map<string, { calls: number; successes: number; failures: number; totalMs: number }>;
  // Errors
  errors: { time: string; tool: string; message: string }[];
  // Deploy attempts
  deployAttempts: { round: number; codeSize: number; reinstall: boolean; durationMs: number; success: boolean }[];
}

// ── Parser ─────────────────────────────────────────────────────────────────

function parseSessionLog(logFile: string): SessionTelemetry {
  const fullPath = path.join(LOGS_DIR, logFile);
  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);

  // Extract session suffix from filename: session-YYYY-MM-DD-timestamp-SUFFIX.txt
  const suffixMatch = logFile.match(/-([a-z0-9]+)\.txt$/);
  const sessionSuffix = suffixMatch ? suffixMatch[1] : "unknown";

  const telemetry: SessionTelemetry = {
    sessionId: "", sessionSuffix, logFile,
    instanceUrl: "", username: "", userFullName: "", model: "", aiProvider: "",
    connectTime: "",
    currentPhase: "—", totalRounds: 0, maxRounds: 30,
    totalToolCalls: 0, toolErrors: 0,
    totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0,
    sessionStartTime: "", lastUpdateTime: "", elapsedSeconds: 0,
    isComplete: false, finalStopReason: "",
    rounds: [], phases: [],
    toolStats: new Map(),
    errors: [], deployAttempts: [],
  };

  let currentRound: Partial<RoundInfo> | null = null;

  for (const line of lines) {
    let entry: LogEntry;
    try { entry = JSON.parse(line); } catch { continue; }

    if (!telemetry.sessionId) telemetry.sessionId = entry.sessionId;
    if (!telemetry.sessionStartTime) telemetry.sessionStartTime = entry.timestamp;
    telemetry.lastUpdateTime = entry.timestamp;

    const d = entry.data || {};

    // ── Connect metadata ─────────────────────────────────────────────
    if (entry.category === "session_connect") {
      telemetry.instanceUrl = (d.instanceUrl as string) || "";
      telemetry.username = (d.username as string) || "";
      telemetry.userFullName = (d.userFullName as string) || "";
      telemetry.model = (d.model as string) || "";
      telemetry.aiProvider = (d.aiProvider as string) || "";
      telemetry.connectTime = entry.timestamp;
    }

    // ── Phase transitions ────────────────────────────────────────────
    if (entry.category === "chat_init" || entry.category === "chat_stream") {
      if (d.phase) {
        const lastPhase = telemetry.phases[telemetry.phases.length - 1];
        if (!lastPhase || lastPhase.phase !== d.phase) {
          telemetry.phases.push({
            phase: d.phase as string,
            enteredAt: entry.timestamp,
            toolsFiltered: (d.toolsFiltered as number) || 0,
          });
        }
        telemetry.currentPhase = d.phase as string;
      }
      if (d.model && !telemetry.model) telemetry.model = d.model as string;
      if (d.maxToolRounds) telemetry.maxRounds = d.maxToolRounds as number;
    }

    // ── Round tracking ───────────────────────────────────────────────
    if (entry.message.match(/^(Stream )?[Rr]ound \d+/)) {
      const roundMatch = entry.message.match(/[Rr]ound (\d+)/);
      if (roundMatch) {
        // Save previous round
        if (currentRound && currentRound.roundNum) {
          telemetry.rounds.push(currentRound as RoundInfo);
        }
        currentRound = {
          roundNum: parseInt(roundMatch[1]),
          startTime: entry.timestamp,
          durationMs: 0, tools: [], stopReason: "",
          inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
        };
        telemetry.totalRounds = Math.max(telemetry.totalRounds, parseInt(roundMatch[1]));
      }
    }

    // ── API response (tokens) ────────────────────────────────────────
    if (entry.message.includes("response received") || entry.message.includes("API response")) {
      if (currentRound) {
        currentRound.stopReason = (d.stopReason as string) || "";
        currentRound.inputTokens = (d.inputTokens as number) || 0;
        currentRound.outputTokens = (d.outputTokens as number) || 0;
        currentRound.cacheReadTokens = (d.cacheReadTokens as number) || 0;
      }
      telemetry.totalInputTokens += (d.inputTokens as number) || 0;
      telemetry.totalOutputTokens += (d.outputTokens as number) || 0;
      telemetry.totalCacheReadTokens += (d.cacheReadTokens as number) || 0;
    }
    // ── Tool execution ─────────────────────────────────────────────
    if (entry.category === "mcp_tool") {
      const toolName = (d.toolName as string) || "";
      const dur = (d.durationMs as number) || 0;
      const success = d.success !== false && entry.level !== "error";

      telemetry.totalToolCalls++;
      if (!success) telemetry.toolErrors++;

      // Update tool stats
      const stats = telemetry.toolStats.get(toolName) || { calls: 0, successes: 0, failures: 0, totalMs: 0 };
      stats.calls++;
      if (success) stats.successes++; else stats.failures++;
      stats.totalMs += dur;
      telemetry.toolStats.set(toolName, stats);

      // Add to current round
      if (currentRound) {
        currentRound.tools = currentRound.tools || [];
        currentRound.tools.push({ name: toolName, durationMs: dur, success });
      }

      // Track errors
      if (!success) {
        telemetry.errors.push({
          time: entry.timestamp,
          tool: toolName,
          message: (d.error as string) || entry.message,
        });
      }

      // Track deploy attempts
      if (toolName === "sn_deploy_sdk_flow") {
        const inp = (d.input as Record<string, unknown>) || {};
        // Extract code size from truncated input: "code... [5929 chars]"
        let codeSize = 0;
        const codeStr = String(inp.code || "");
        const charsMatch = codeStr.match(/\[(\d+) chars\]/);
        if (charsMatch) codeSize = parseInt(charsMatch[1]);
        else codeSize = codeStr.length;

        telemetry.deployAttempts.push({
          round: telemetry.totalRounds,
          codeSize,
          reinstall: inp.reinstall === true || inp.reinstall === "true",
          durationMs: dur,
          success,
        });
      }
    }

    // ── Completion ───────────────────────────────────────────────────
    if (entry.message.includes("completed") || entry.message.includes("Stream completed")) {
      telemetry.finalStopReason = (d.stopReason as string) || "end_turn";
      if (currentRound) {
        currentRound.stopReason = telemetry.finalStopReason;
        telemetry.rounds.push(currentRound as RoundInfo);
        currentRound = null;
      }
      telemetry.isComplete = true;
    }

    if (entry.message.includes("max tool rounds")) {
      telemetry.finalStopReason = "max_rounds";
      telemetry.isComplete = true;
    }
  }

  // Push last round if still open
  if (currentRound && currentRound.roundNum) {
    telemetry.rounds.push(currentRound as RoundInfo);
  }

  // Calculate elapsed
  if (telemetry.sessionStartTime && telemetry.lastUpdateTime) {
    telemetry.elapsedSeconds = Math.round(
      (new Date(telemetry.lastUpdateTime).getTime() - new Date(telemetry.sessionStartTime).getTime()) / 1000
    );
  }

  return telemetry;
}

// ── Markdown Generator ─────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function timeOnly(iso: string): string {
  if (!iso) return "—";
  return iso.split("T")[1]?.split(".")[0] || iso;
}

function generateMarkdown(t: SessionTelemetry): string {
  const status = t.isComplete ? "✅ Complete" : "🔄 In Progress";
  const statusEmoji = t.isComplete ? "✅" : "⏳";

  let md = `# 📊 Live Session Telemetry — \`${t.sessionSuffix}\`
> **Status:** ${status} | **Last Updated:** ${timeOnly(t.lastUpdateTime)} | Auto-refreshes every 15s

---

## ${statusEmoji} Summary

| Metric | Value |
|--------|-------|
| **Session ID** | \`${t.sessionId}\` |
| **Instance** | ${t.instanceUrl || "—"} |
| **User** | ${t.userFullName || t.username || "—"} |
| **Model** | ${t.model || "—"} |
| **Provider** | ${t.aiProvider || "—"} |
| **Connected At** | ${timeOnly(t.connectTime)} |
| **Elapsed** | ${formatDuration(t.elapsedSeconds)} |
| **Current Phase** | \`${t.currentPhase}\` |
| **Rounds** | ${t.totalRounds}/${t.maxRounds} |
| **Tool Calls** | ${t.totalToolCalls} (${t.toolErrors} errors) |
| **Tokens** | 🔽 ${t.totalInputTokens.toLocaleString()} in · 🔼 ${t.totalOutputTokens.toLocaleString()} out · 📦 ${t.totalCacheReadTokens.toLocaleString()} cached |
| **Deploy Attempts** | ${t.deployAttempts.length} |
| **Stop Reason** | ${t.finalStopReason || "—"} |

---

## 🔄 Phase Timeline

| # | Phase | Entered At | Tools Available |
|---|-------|-----------|-----------------|
`;

  t.phases.forEach((p, i) => {
    md += `| ${i + 1} | \`${p.phase}\` | ${timeOnly(p.enteredAt)} | ${p.toolsFiltered} |\n`;
  });

  md += `\n---\n\n## 🔧 Round-by-Round Activity\n\n`;
  md += `| Round | Time | Tools | Duration | Tokens (in/out) | Stop Reason |\n`;
  md += `|-------|------|-------|----------|----------------|-------------|\n`;

  for (const r of t.rounds) {
    const toolNames = r.tools.map(t => {
      const icon = t.success ? "✅" : "❌";
      return `${icon} ${t.name}`;
    }).join(", ") || "*(text only)*";
    const dur = r.tools.reduce((sum, t) => sum + t.durationMs, 0);
    md += `| ${r.roundNum} | ${timeOnly(r.startTime)} | ${toolNames} | ${dur > 0 ? `${(dur / 1000).toFixed(1)}s` : "—"} | ${r.inputTokens.toLocaleString()}/${r.outputTokens.toLocaleString()} | ${r.stopReason || "—"} |\n`;
  }

  // Tool usage distribution
  md += `\n---\n\n## 📈 Tool Usage Distribution\n\n`;
  md += `| Tool | Calls | ✅ | ❌ | Avg Duration |\n`;
  md += `|------|-------|---|---|-------------|\n`;

  const sortedTools = [...t.toolStats.entries()].sort((a, b) => b[1].calls - a[1].calls);
  for (const [name, stats] of sortedTools) {
    const avg = stats.calls > 0 ? (stats.totalMs / stats.calls / 1000).toFixed(1) : "0";
    md += `| \`${name}\` | ${stats.calls} | ${stats.successes} | ${stats.failures} | ${avg}s |\n`;
  }

  // Deploy attempts
  if (t.deployAttempts.length > 0) {
    md += `\n---\n\n## 🚀 SDK Deploy Attempts\n\n`;
    md += `| # | Round | Code Size | Reinstall | Duration | Status |\n`;
    md += `|---|-------|-----------|-----------|----------|--------|\n`;
    t.deployAttempts.forEach((d, i) => {
      md += `| ${i + 1} | ${d.round} | ${d.codeSize} chars | ${d.reinstall ? "yes" : "no"} | ${(d.durationMs / 1000).toFixed(1)}s | ${d.success ? "✅" : "❌"} |\n`;
    });
  }

  // Errors
  if (t.errors.length > 0) {
    md += `\n---\n\n## ⚠️ Errors\n\n`;
    md += `| Time | Tool | Message |\n`;
    md += `|------|------|---------|\n`;
    for (const e of t.errors) {
      md += `| ${timeOnly(e.time)} | \`${e.tool}\` | ${e.message.slice(0, 100)} |\n`;
    }
  }

  md += `\n---\n*Generated from \`${t.logFile}\`*\n`;
  return md;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Generate/update telemetry file for a session. Called from logger on each log write. */
export function updateTelemetry(sessionId: string): void {
  const now = Date.now();
  const lastTime = lastGenTime.get(sessionId) || 0;

  // Throttle: only regenerate every 15 seconds
  if (now - lastTime < THROTTLE_MS) return;
  lastGenTime.set(sessionId, now);

  try {
    // Find the log file for this session
    const logFilename = getLogFilenameForSession(sessionId);
    const logPath = path.join(LOGS_DIR, logFilename);
    if (!fs.existsSync(logPath)) return;

    // Parse and generate
    const telemetry = parseSessionLog(logFilename);
    const markdown = generateMarkdown(telemetry);

    // Write telemetry file
    const telemetryFile = `telemetry-session-${telemetry.sessionSuffix}.md`;
    fs.writeFileSync(path.join(LOGS_DIR, telemetryFile), markdown);
  } catch (err) {
    console.error(`[telemetry] Error generating telemetry for ${sessionId}:`, err);
  }
}

/** Start a background interval that updates telemetry every 15 seconds.
 *  Returns a cleanup function. */
export function startTelemetryStream(sessionId: string): () => void {
  // Do an immediate first generation
  lastGenTime.delete(sessionId); // force immediate
  updateTelemetry(sessionId);

  // Set up interval
  const interval = setInterval(() => {
    updateTelemetry(sessionId);
  }, THROTTLE_MS);

  activeIntervals.set(sessionId, interval);

  return () => {
    clearInterval(interval);
    activeIntervals.delete(sessionId);
    // Do one final generation
    lastGenTime.delete(sessionId);
    updateTelemetry(sessionId);
  };
}

/** Stop all active telemetry streams */
export function stopAllTelemetryStreams(): void {
  for (const [id, interval] of activeIntervals) {
    clearInterval(interval);
    lastGenTime.delete(id);
    updateTelemetry(id); // final update
  }
  activeIntervals.clear();
}

/** Helper: derive log filename from session ID (mirrors logger.ts logic) */
function getLogFilenameForSession(sessionId: string): string {
  const parts = sessionId.split("_");
  if (parts.length >= 3) {
    const timestamp = parts[1];
    const suffix = parts[2];
    const date = new Date(parseInt(timestamp));
    const dateStr = date.toISOString().split("T")[0];
    return `session-${dateStr}-${timestamp}-${suffix}.txt`;
  }
  return `session-${sessionId.replace(/[^a-zA-Z0-9]/g, "-")}.txt`;
}

