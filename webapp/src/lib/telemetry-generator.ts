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
    errors: [],
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

  // Errors
  if (t.errors.length > 0) {
    md += `\n---\n\n## ⚠️ Errors\n\n`;
    md += `| Time | Tool | Message |\n`;
    md += `|------|------|---------|\n`;
    for (const e of t.errors) {
      md += `| ${timeOnly(e.time)} | \`${e.tool}\` | ${e.message.slice(0, 100)} |\n`;
    }
  }

  return md;
}

// ── Delta State & Session Updates (Conversational Narration) ───────────────

interface DeltaState {
  lastRoundCount: number;
  lastPhaseCount: number;
  lastToolCalls: number;
  lastErrorCount: number;
  lastPhase: string;
  lastChatIndex: number;       // tracks which chat request we're in
  consecutiveErrors: number;   // tracks error streaks for commentary
  wasComplete: boolean;
  updates: string[];           // accumulated narration paragraphs
}

const deltaStates = new Map<string, DeltaState>();

function getDelta(sessionId: string): DeltaState {
  if (!deltaStates.has(sessionId)) {
    deltaStates.set(sessionId, {
      lastRoundCount: 0, lastPhaseCount: 0, lastToolCalls: 0,
      lastErrorCount: 0, lastPhase: "",
      lastChatIndex: 0, consecutiveErrors: 0,
      wasComplete: false, updates: [],
    });
  }
  return deltaStates.get(sessionId)!;
}

/** Describe what a set of tools were doing in plain English */
function describeToolIntent(tools: { name: string; durationMs: number; success: boolean }[]): string {
  const names = tools.map(t => t.name);

  // Schema / table exploration
  if (names.some(n => n === "sn_get_table_schema")) {
    const tables = tools.filter(t => t.name === "sn_get_table_schema");
    return `studying the data model (${tables.length} table schema${tables.length > 1 ? "s" : ""})`;
  }

  // Querying for existing artifacts
  if (names.includes("sn_query_records") && names.includes("sn_list_flows")) {
    return "surveying the instance — checking existing business rules, flows, and related records to understand what's already in place";
  }
  if (names.includes("sn_list_flows")) return "checking what flows already exist on the instance";
  if (names.includes("sn_list_custom_actions")) return "looking up available custom actions for the flow";

  // Scope / app discovery
  if (names.includes("sn_get_scope_selection_options") || names.includes("sn_get_custom_apps")) {
    const both = names.includes("sn_get_scope_selection_options") && names.includes("sn_get_custom_apps");
    return both ? "evaluating available application scopes and custom apps to determine where to deploy" : "looking up available application scopes";
  }

  // Update set management
  if (names.includes("sn_create_update_set")) return "creating an update set to track all changes";
  if (names.includes("sn_set_current_update_set")) return "setting the active update set for artifact capture";
  if (names.includes("sn_list_update_sets")) return "checking existing update sets";
  if (names.includes("sn_get_update_set_contents")) return "verifying what artifacts landed in the update set";

  // Creating artifacts
  if (names.includes("sn_create_script_include")) return "deploying a Script Include to the instance";
  if (names.includes("sn_create_business_rule")) return "creating a Business Rule";
  if (names.includes("sn_create_client_script")) return "creating a Client Script";

  // Instance info
  if (names.includes("sn_get_instance_info")) return "gathering instance metadata (version, plugins, capabilities)";

  // Action type research
  if (names.some(n => n.includes("list_action_types") || n.includes("get_action_type"))) {
    return "researching available Flow Designer action types";
  }

  // Flow analysis
  if (names.some(n => n.includes("analyze"))) return "analyzing existing flows to learn implementation patterns";

  // Record queries (generic)
  if (names.every(n => n === "sn_query_records")) {
    return `querying the instance (${names.length} record lookup${names.length > 1 ? "s" : ""})`;
  }
  if (names.includes("sn_get_record")) {
    return `retrieving specific records for inspection`;
  }

  // Fallback
  return tools.map(t => `\`${t.name}\``).join(", ");
}

/** Build a narrative phrase for why Claude might be doing something based on context */
function narrativeContext(tools: { name: string; durationMs: number; success: boolean }[], phase: string, roundNum: number): string {
  const names = tools.map(t => t.name);

  // First round in spec phase — Claude is doing discovery
  if (phase === "spec" && roundNum <= 2 && names.includes("sn_query_records")) {
    return "Before writing the spec, Claude is doing its homework — ";
  }
  if (phase === "design" && names.includes("sn_get_scope_selection_options")) {
    return "With the design approved, Claude is now figuring out where to put things — ";
  }
  if (phase === "scope_selection" && names.includes("sn_query_records")) {
    return "Claude is validating the deployment target — ";
  }
  if (phase === "implementation" && names.includes("sn_create_script_include")) {
    return "Now building the actual artifacts — ";
  }
  return "";
}

function generateSessionUpdates(t: SessionTelemetry, sessionId: string): string {
  const delta = getDelta(sessionId);
  const newUpdates: string[] = [];

  // ── Opening narration ────────────────────────────────────────────
  if (delta.updates.length === 0) {
    if (t.connectTime && t.instanceUrl) {
      const instance = t.instanceUrl.replace("https://", "");
      const user = t.userFullName || t.username || "user";
      newUpdates.push(
        `🔌 **Session opened** at ${timeOnly(t.connectTime)} — ${user} connected to \`${instance}\` using **${t.model || "unknown model"}**. Let's see what Claude does with this one.`
      );
    } else if (t.phases.length > 0) {
      newUpdates.push(
        `📋 Session started at ${timeOnly(t.sessionStartTime)}. Model: **${t.model || "unknown"}**.`
      );
    }
  }

  // ── Phase transitions (the story arc) ────────────────────────────
  if (t.phases.length > delta.lastPhaseCount) {
    const newPhases = t.phases.slice(delta.lastPhaseCount);
    for (const p of newPhases) {
      if (delta.lastPhase && delta.lastPhase !== p.phase) {
        const phaseNarrative: Record<string, string> = {
          "spec": `📝 **Spec phase** begins (${timeOnly(p.enteredAt)}). Claude now has access to ${p.toolsFiltered} tools and will start investigating the instance to understand the landscape before writing the specification.`,
          "design": `📐 **Design phase** begins (${timeOnly(p.enteredAt)}). The spec was approved — Claude is now working out the technical design: which artifacts to create, what scope to use, and how the pieces fit together. ${p.toolsFiltered} tools available.`,
          "scope_selection": `🎯 **Scope selection** (${timeOnly(p.enteredAt)}). Claude needs to decide where to deploy — which application scope and update set. Only ${p.toolsFiltered} tools available in this focused phase.`,
          "implementation": `🔨 **Implementation phase** begins (${timeOnly(p.enteredAt)}). This is where the real work happens — Claude will create Script Includes, Business Rules, Flows, and deploy them to the instance. Full toolkit unlocked: ${p.toolsFiltered} tools.`,
        };
        newUpdates.push(
          phaseNarrative[p.phase] || `🔄 Moved to **${p.phase}** phase at ${timeOnly(p.enteredAt)} (${p.toolsFiltered} tools).`
        );
      }
      delta.lastPhase = p.phase;
    }
    delta.lastPhaseCount = t.phases.length;
  }

  // ── Narrate rounds as a story ────────────────────────────────────
  if (t.rounds.length > delta.lastRoundCount) {
    const newRounds = t.rounds.slice(delta.lastRoundCount);
    const narration = narrateRounds(newRounds, t, delta);
    newUpdates.push(...narration);
    delta.lastRoundCount = t.rounds.length;
  }

  // ── Errors (the complications) ───────────────────────────────────
  if (t.errors.length > delta.lastErrorCount) {
    const newErrors = t.errors.slice(delta.lastErrorCount);
    const errorsByTool = new Map<string, typeof newErrors>();
    for (const err of newErrors) {
      const list = errorsByTool.get(err.tool) || [];
      list.push(err);
      errorsByTool.set(err.tool, list);
    }

    for (const [tool, errs] of errorsByTool) {
      if (errs.length === 1) {
        const err = errs[0];
        const isTypeError = err.message.includes("Expected boolean") || err.message.includes("Expected object") || err.message.includes("Expected number");
        if (isTypeError) {
          newUpdates.push(
            `⚡ **Type mismatch** on \`${tool}\` at ${timeOnly(err.time)} — Claude sent a string where the schema expected a different type. This is a known AI agent quirk; the coercion layer should catch most of these, but this one slipped through.`
          );
        } else if (err.message.includes("Unknown tool")) {
          newUpdates.push(
            `🚫 Claude tried to call \`${tool}\` at ${timeOnly(err.time)}, but that tool doesn't exist (or isn't available in the current phase). This costs a round.`
          );
        } else {
          newUpdates.push(
            `❌ \`${tool}\` failed at ${timeOnly(err.time)} — ${err.message.slice(0, 150)}`
          );
        }
      } else {
        const isTypeError = errs.every(e => e.message.includes("Expected boolean") || e.message.includes("Expected object") || e.message.includes("Expected number") || e.message.includes("Expected string"));
        if (isTypeError) {
          newUpdates.push(
            `⚡ \`${tool}\` hit **${errs.length} consecutive type errors** (${timeOnly(errs[0].time)}–${timeOnly(errs[errs.length - 1].time)}). Claude keeps sending the wrong types — this is burning through rounds. The schema coercion fix should prevent this in future sessions.`
          );
        } else {
          newUpdates.push(
            `❌ \`${tool}\` failed **${errs.length} times** between ${timeOnly(errs[0].time)} and ${timeOnly(errs[errs.length - 1].time)}. Claude is struggling with this tool.`
          );
        }
      }
    }
    delta.lastErrorCount = t.errors.length;
  }

  // ── Round limit warning ──────────────────────────────────────────
  if (t.totalRounds >= t.maxRounds - 3 && t.totalRounds < t.maxRounds && !t.isComplete) {
    const remaining = t.maxRounds - t.totalRounds;
    if (!delta.updates.some(u => u.includes("running low on rounds"))) {
      newUpdates.push(
        `⏰ **${remaining} rounds left.** Claude is running low on rounds and needs to wrap up. If there's unfinished work, it should summarize what's done and what the user needs to complete manually.`
      );
    }
  }

  // ── Session complete (the resolution) ────────────────────────────
  if (t.isComplete && !delta.wasComplete) {
    delta.wasComplete = true;
    const elapsed = formatDuration(t.elapsedSeconds);
    const errorRate = t.totalToolCalls > 0 ? ((t.toolErrors / t.totalToolCalls) * 100).toFixed(0) : "0";

    let summary = `\n🏁 **Session complete** — ${elapsed} elapsed, ${t.totalRounds}/${t.maxRounds} rounds used, ${t.totalToolCalls} tool calls`;
    if (t.toolErrors > 0) summary += ` (${errorRate}% error rate)`;
    summary += `.`;

    if (t.finalStopReason === "max_rounds") {
      summary += `\n\n⚠️ **Hit the ${t.maxRounds}-round limit.** Claude ran out of rounds before finishing. Check if the work is complete.`;
    }

    // Add a brief assessment
    const efficiency = t.totalRounds <= 5 ? "excellent" : t.totalRounds <= 15 ? "good" : t.totalRounds <= 25 ? "moderate" : "poor";
    summary += `\n\n**Efficiency: ${efficiency}** — ${t.totalRounds} rounds for ${t.phases.length} phase${t.phases.length > 1 ? "s" : ""}.`;

    newUpdates.push(summary);
  }

  // ── Idle detection ───────────────────────────────────────────────
  if (newUpdates.length === 0 && delta.updates.length > 0 && !t.isComplete) {
    const lastRound = t.rounds[t.rounds.length - 1];
    if (lastRound && lastRound.stopReason === "end_turn" && lastRound.tools.length === 0) {
      newUpdates.push(
        `⏳ Claude has stopped and is waiting for user input. The ball is in the user's court.`
      );
    }
  }

  delta.updates.push(...newUpdates);

  // Render
  let md = `\n---\n\n## 🔴 Session Updates\n\n`;
  if (delta.updates.length === 0) {
    md += `*Waiting for session activity...*\n`;
  } else {
    md += delta.updates.join("\n\n") + "\n";
  }
  md += `\n---\n*Generated from \`${t.logFile}\`*\n`;
  return md;
}

/** Narrate rounds as a coherent story, not a log dump */
function narrateRounds(rounds: RoundInfo[], t: SessionTelemetry, delta: DeltaState): string[] {
  const blocks: string[] = [];

  // Group consecutive text-only rounds (user interaction rounds)
  let i = 0;
  while (i < rounds.length) {
    const r = rounds[i];

    // ── Text-only rounds: group consecutive ones ───────────────────
    if (r.tools.length === 0) {
      let textCount = 0;
      while (i < rounds.length && rounds[i].tools.length === 0) {
        textCount++;
        i++;
      }
      if (textCount === 1 && r.stopReason === "end_turn") {
        blocks.push(
          `💬 Claude responded to the user at ${timeOnly(r.startTime)} — presented its analysis and is waiting for direction.`
        );
      } else if (textCount > 1) {
        blocks.push(
          `💬 ${textCount} text exchanges between ${timeOnly(r.startTime)} and ${timeOnly(rounds[i - 1].startTime)} — Claude and the user are going back and forth on the approach.`
        );
      }
      continue;
    }

    // ── Tool rounds: narrate with intent ───────────────────────────
    // Collect consecutive tool rounds into a "work block"
    const workBlock: RoundInfo[] = [];
    while (i < rounds.length && rounds[i].tools.length > 0) {
      workBlock.push(rounds[i]);
      i++;
    }

    if (workBlock.length === 0) continue;

    const allTools = workBlock.flatMap(r => r.tools);
    const totalDur = allTools.reduce((s, t) => s + t.durationMs, 0);
    const failures = allTools.filter(t => !t.success);
    const startTime = timeOnly(workBlock[0].startTime);
    const endTime = workBlock.length > 1 ? timeOnly(workBlock[workBlock.length - 1].startTime) : "";
    const timeRange = endTime && endTime !== startTime ? `${startTime}–${endTime}` : startTime;

    const intent = describeToolIntent(allTools);
    const context = narrativeContext(allTools, delta.lastPhase, workBlock[0].roundNum);
    const durStr = totalDur > 0 ? ` (${(totalDur / 1000).toFixed(1)}s across ${workBlock.length} round${workBlock.length > 1 ? "s" : ""})` : "";

    let msg = `🔍 **${timeRange}** — ${context}${intent}${durStr}.`;

    if (failures.length > 0 && failures.length < allTools.length) {
      msg += ` ${failures.length} of ${allTools.length} calls hit errors — Claude will need to adapt.`;
    } else if (failures.length > 0 && failures.length === allTools.length) {
      msg += ` All ${failures.length} calls failed — Claude is hitting a wall here.`;
    }

    blocks.push(msg);
  }

  return blocks;
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
    const summaryMd = generateMarkdown(telemetry);
    const updatesMd = generateSessionUpdates(telemetry, sessionId);

    // Write telemetry file (summary + session updates)
    const telemetryFile = `telemetry-session-${telemetry.sessionSuffix}.md`;
    fs.writeFileSync(path.join(LOGS_DIR, telemetryFile), summaryMd + updatesMd);
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

