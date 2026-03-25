/**
 * ServiceNow Engine — bridges Anthropic tool-use with the MCP tool registry.
 * Creates per-request ServiceNowClient instances from user-supplied credentials.
 *
 * Uses Anthropic prompt caching to avoid resending the system prompt + 80 tool
 * definitions as fresh input tokens on every round, reducing rate-limit pressure
 * by ~90 % on cache hits.
 *
 * Includes context management to prevent token limit exceeded errors:
 * - Tool results are truncated if too large
 * - Older conversation turns are compressed when approaching limits
 */

import Anthropic from "@anthropic-ai/sdk";
import { createRequire } from "node:module";
import { processFileAttachments } from "./file-parser";
import path from "node:path";
import { buildSystemPrompt, buildDynamicContext, type DynamicContextOptions } from "./system-prompt";
import { parsePhaseGate, type BrowserSessionCookie, type ServiceNowAuthMethod } from "./types";
import { isSensitiveLogKey, logger } from "./logger";
import { chatCompletion, OpenRouterRequest, OpenRouterMessage, OpenRouterContentBlock, OpenRouterTool } from "./openrouter";
import { getSessionCache, SessionCache } from "./session-cache";
import { APP_NAME } from "./branding";
import { shouldPlan, generatePlan, executePlan, formatGatheredData, type PlanStreamEvent, type ExecutionPlan } from "./task-planner";
import { normalizeServiceNowAuthMethod } from "./servicenow-auth";
import { getSupabase } from "./supabase";

/* ── Context management constants ─────────────────────────────── */

/** Maximum characters per tool result before truncation */
const MAX_TOOL_RESULT_CHARS = 8_000;
/** Estimated tokens per character (conservative) */
const CHARS_PER_TOKEN = 3.5;
/** Target max tokens for conversation history (leave room for response) */
const MAX_CONTEXT_TOKENS = 150_000;
/** Warning threshold - start trimming older messages */
const CONTEXT_WARNING_TOKENS = 120_000;

/* ── Engine config (Supabase-backed with in-memory cache) ───── */

export interface EngineConfig {
  phaseRoundLimits: Record<string, number>;
  defaultRoundLimit: number;
  plannerBudgetFactor: number;
  plannerBudgetMinimum: number;
}

let _cachedConfig: EngineConfig | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildFallbackConfig(): EngineConfig {
  try {
    const defs = getToolDefs();
    return {
      phaseRoundLimits: defs.PHASE_ROUND_LIMITS ?? {},
      defaultRoundLimit: defs.DEFAULT_ROUND_LIMIT ?? 30,
      plannerBudgetFactor: 0.75,
      plannerBudgetMinimum: 10,
    };
  } catch {
    return { phaseRoundLimits: {}, defaultRoundLimit: 30, plannerBudgetFactor: 0.75, plannerBudgetMinimum: 10 };
  }
}

export async function loadEngineConfig(): Promise<EngineConfig> {
  if (_cachedConfig && Date.now() - _cacheTimestamp < CACHE_TTL_MS) return _cachedConfig;
  const fallback = buildFallbackConfig();
  try {
    const db = getSupabase();
    const { data, error } = await db.from("engine_config").select("key, value");
    if (error || !data || data.length === 0) {
      _cachedConfig = fallback;
      _cacheTimestamp = Date.now();
      return fallback;
    }
    const map = new Map(data.map((r: { key: string; value: unknown }) => [r.key, r.value]));
    _cachedConfig = {
      phaseRoundLimits: (map.get("phase_round_limits") as Record<string, number>) ?? fallback.phaseRoundLimits,
      defaultRoundLimit: Number(map.get("default_round_limit")) || fallback.defaultRoundLimit,
      plannerBudgetFactor: Number(map.get("planner_budget_factor")) || fallback.plannerBudgetFactor,
      plannerBudgetMinimum: Number(map.get("planner_budget_minimum")) || fallback.plannerBudgetMinimum,
    };
    _cacheTimestamp = Date.now();
    return _cachedConfig;
  } catch {
    _cachedConfig = fallback;
    _cacheTimestamp = Date.now();
    return fallback;
  }
}

export function invalidateEngineConfigCache() { _cachedConfig = null; _cacheTimestamp = 0; }

/** Synchronous phase limit lookup — call loadEngineConfig() first to populate */
function getPhaseRoundLimit(phase: string | null | undefined, config?: EngineConfig): number {
  const cfg = config || _cachedConfig || buildFallbackConfig();
  if (phase && cfg.phaseRoundLimits && phase in cfg.phaseRoundLimits) {
    return cfg.phaseRoundLimits[phase];
  }
  return cfg.defaultRoundLimit;
}

/* ── Duplicate tool call detection ───────────────────────────── */

/**
 * Tracks tool calls within a single request to detect circular behavior.
 * Key: hash of (toolName + JSON(input)), Value: call count.
 */
class ToolCallDeduplicator {
  private seen = new Map<string, number>();

  /** Record a call and return the count (1 = first time, 2+ = duplicate) */
  record(toolName: string, input: unknown): number {
    const key = `${toolName}::${JSON.stringify(input)}`;
    const count = (this.seen.get(key) || 0) + 1;
    this.seen.set(key, count);
    return count;
  }

  /** Total number of duplicate calls detected */
  get totalDuplicates(): number {
    let dupes = 0;
    for (const count of this.seen.values()) {
      if (count > 1) dupes += count - 1;
    }
    return dupes;
  }
}

/* ── Phase-aware gate reminder messages ─────────────────────── */

const PHASE_GATE_REMINDERS: Partial<Record<string, { threshold: number; message: string }>> = {
  spec: {
    threshold: 10,
    message: `[SYSTEM: You are in spec phase. You have spent 10 rounds. Create the spec document and emit <!-- PHASE_GATE:spec --> in your text response to present it for user approval.]`,
  },
  design: {
    threshold: 18,
    message: `[SYSTEM: You are in design phase. You have spent 18 rounds. Finalize the design document and emit <!-- PHASE_GATE:design --> in your text response to present it for user approval.]`,
  },
  scope_selection: {
    threshold: 3,
    message: `[SYSTEM: You are in scope_selection phase. The user has already chosen their scope. You MUST emit <!-- PHASE_GATE:scope_selection --> in your text response NOW to proceed to implementation. Do NOT make more tool calls — you have all the information you need.]`,
  },
  implementation: {
    threshold: 32,
    message: `[SYSTEM: You are in implementation phase. You have spent 32 rounds. If all artifacts are created and verified, emit <!-- PHASE_GATE:implementation --> in your text response to present the implementation for user approval.]`,
  },
  testing: {
    threshold: 30,
    message: `[SYSTEM: You are in testing phase. You have spent 30 rounds. Complete testing and emit <!-- PHASE_GATE:testing --> in your text response to present test results for user approval.]`,
  },
};

/* ── Planner budget adjustment ────────────────────────────────── */

/** Shared helper for reducing the round budget after the task planner pre-fetches data.
 *  Used by both chatStream (Anthropic) and chatStreamOpenRouter.
 *  Note: when effectiveMax < minimum, the result is clamped to effectiveMax (by design —
 *  the phase limit is a hard cap that the minimum floor cannot override). */
function computeAdjustedRounds(effectiveMax: number, factor: number = 0.75, minimum: number = 10): number {
  const adjusted = Math.max(minimum, Math.ceil(effectiveMax * factor));
  return Math.min(effectiveMax, adjusted);
}

/* ── Rate-limit retry helpers ─────────────────────────────────── */

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 5_000; // 5 seconds

/**
 * Sleep helper that respects the Retry-After header when present.
 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ServiceNow metadata fields that waste tokens but carry no decision value.
 * Stripped from records before truncation to maximise information density.
 */
const SN_NOISE_FIELDS = new Set([
  "sys_mod_count", "sys_created_on", "sys_created_by", "sys_updated_on",
  "sys_updated_by", "sys_tags", "sys_domain", "sys_domain_path",
  "sys_policy", "sys_replace_on_upgrade", "sys_customer_update",
  "sys_update_name", "sys_package", "sys_scope", "sys_class_name",
  "sys_overrides",
]);

/**
 * Recursively strip noisy ServiceNow metadata from a value.
 * Handles single records, arrays of records, and nested result wrappers.
 */
function stripSnMetadata(val: unknown): unknown {
  if (val === null || val === undefined || typeof val !== "object") return val;

  if (Array.isArray(val)) {
    return val.map(stripSnMetadata);
  }

  const obj = val as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SN_NOISE_FIELDS.has(k)) continue;
    // Recurse into nested objects/arrays (e.g. result wrappers)
    cleaned[k] = (typeof v === "object" && v !== null) ? stripSnMetadata(v) : v;
  }
  return cleaned;
}

/**
 * Truncate a tool result if it exceeds the max character limit.
 * First strips noisy SN metadata, then preserves structure for
 * objects/arrays by keeping first/last items.
 */
function truncateToolResult(result: unknown): string {
  // Phase 4a: strip ServiceNow noise fields before serialising
  const cleaned = stripSnMetadata(result);
  const jsonStr = JSON.stringify(cleaned);

  if (jsonStr.length <= MAX_TOOL_RESULT_CHARS) {
    return jsonStr;
  }

  // For arrays, keep first and last few items
  if (Array.isArray(cleaned) && cleaned.length > 5) {
    const truncated = {
      _truncated: true,
      _originalCount: cleaned.length,
      _showing: "first 3 and last 2 items",
      items: [...cleaned.slice(0, 3), { _more: `... ${cleaned.length - 5} more items ...` }, ...cleaned.slice(-2)]
    };
    return JSON.stringify(truncated);
  }

  // For large strings/objects, truncate with indicator
  const halfMax = Math.floor(MAX_TOOL_RESULT_CHARS / 2) - 100;
  return jsonStr.slice(0, halfMax) +
    `\n\n... [TRUNCATED: ${jsonStr.length - MAX_TOOL_RESULT_CHARS} chars removed] ...\n\n` +
    jsonStr.slice(-halfMax);
}

/**
 * Estimate token count from a string (rough approximation).
 */
function estimateTokens(str: string): number {
  return Math.ceil(str.length / CHARS_PER_TOKEN);
}

/**
 * Estimate total tokens in the conversation.
 */
function estimateConversationTokens(messages: Anthropic.MessageParam[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if ("text" in block && typeof block.text === "string") {
          total += estimateTokens(block.text);
        } else if ("content" in block && typeof block.content === "string") {
          total += estimateTokens(block.content);
        }
      }
    }
  }
  return total;
}

/* ── Phase 4c: Progressive tool-result compression ────────────── */

/**
 * Compress tool_result blocks in older messages.
 * Keeps tool name + success/error + first 200 chars of output.
 * Only compresses messages older than `preserveRecent`.
 */
function compressOldToolResults(
  messages: Anthropic.MessageParam[],
  preserveRecent: number = 12
): Anthropic.MessageParam[] {
  const cutoff = Math.max(0, messages.length - preserveRecent);
  return messages.map((msg, idx) => {
    if (idx >= cutoff) return msg; // keep recent messages intact
    if (msg.role !== "user" || !Array.isArray(msg.content)) return msg;

    const compressed = (msg.content as Anthropic.ContentBlockParam[]).map((block) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = block as any;
      if (b.type !== "tool_result") return block;
      const text = typeof b.content === "string" ? b.content
        : Array.isArray(b.content)
          ? b.content.map((c: { text?: string }) => c.text ?? "").join("")
          : "";
      const preview = text.length > 200 ? text.slice(0, 200) + "..." : text;
      const status = b.is_error ? "[ERROR]" : "[OK]";
      return {
        type: "tool_result" as const,
        tool_use_id: b.tool_use_id,
        content: `${status} ${preview}`,
      };
    });
    return { role: msg.role, content: compressed } as Anthropic.MessageParam;
  });
}

/* ── Phase 4b: Extractive summary of dropped messages ────────── */

/**
 * Build a concise extractive summary from a slice of messages
 * that are about to be dropped. Captures:
 *   - User intents (first 120 chars of each user text)
 *   - Key assistant decisions (first 120 chars of each assistant text)
 *   - Tool calls made (tool name only)
 *   - Errors encountered
 */
function summarizeDroppedMessages(dropped: Anthropic.MessageParam[]): string {
  const bullets: string[] = [];
  for (const msg of dropped) {
    const blocks = typeof msg.content === "string"
      ? [{ type: "text" as const, text: msg.content }]
      : (msg.content as { type: string; text?: string; name?: string; content?: string; is_error?: boolean }[]);

    for (const b of blocks) {
      if (b.type === "text" && b.text) {
        const prefix = msg.role === "user" ? "User" : "Assistant";
        const snippet = b.text.length > 120 ? b.text.slice(0, 120) + "..." : b.text;
        bullets.push(`- ${prefix}: ${snippet}`);
      } else if (b.type === "tool_use" && b.name) {
        bullets.push(`- Called tool: ${b.name}`);
      } else if (b.type === "tool_result" && b.is_error) {
        const errSnippet = (b.content ?? "").toString().slice(0, 80);
        bullets.push(`- Tool error: ${errSnippet}`);
      }
    }
  }
  // Cap at ~30 bullets to keep summary tight
  const capped = bullets.length > 30
    ? [...bullets.slice(0, 15), `  ... ${bullets.length - 30} more actions ...`, ...bullets.slice(-15)]
    : bullets;
  return capped.join("\n");
}

/**
 * Smart conversation trimming with progressive compression and extractive summary.
 *
 * Strategy (applied in order until under budget):
 *   1. Compress old tool_result blocks (Phase 4c)
 *   2. Drop middle messages, replace with extractive summary (Phase 4b)
 *   3. Keep first 2 + summary + last N recent messages
 */
function trimConversationHistory(messages: Anthropic.MessageParam[], sessionId: string = "system"): Anthropic.MessageParam[] {
  const estimatedTokens = estimateConversationTokens(messages);

  if (estimatedTokens < CONTEXT_WARNING_TOKENS) {
    return messages;
  }

  logger.info(sessionId, "context_mgmt", "Context budget exceeded, applying progressive compression", {
    estimatedTokens,
    warningThreshold: CONTEXT_WARNING_TOKENS,
    messageCount: messages.length,
  });

  // Step 1: Compress old tool results (keeps all messages, just shrinks content)
  let compressed = compressOldToolResults(messages);
  let compressedTokens = estimateConversationTokens(compressed);
  logger.info(sessionId, "context_mgmt", "After tool-result compression", { tokensAfter: compressedTokens, tokensBefore: estimatedTokens });

  if (compressedTokens < CONTEXT_WARNING_TOKENS) {
    return compressed;
  }

  // Step 2: Still over budget — drop middle section with extractive summary
  const keepStart = Math.min(2, compressed.length);
  const recentCount = Math.min(14, compressed.length - keepStart);
  const dropStart = keepStart;
  const dropEnd = compressed.length - recentCount;

  if (dropEnd <= dropStart) {
    // Not enough messages to drop; return compressed as-is
    return compressed;
  }

  const droppedSlice = compressed.slice(dropStart, dropEnd);
  const summary = summarizeDroppedMessages(droppedSlice);

  const result: Anthropic.MessageParam[] = compressed.slice(0, keepStart);
  result.push({
    role: "user",
    content: `[Context summary of ${droppedSlice.length} earlier messages]\n${summary}\n[End summary — recent messages follow]`
  });
  result.push({
    role: "assistant",
    content: "Understood. I have the summary context above and will continue with the recent messages."
  });
  const recentMessages = compressed.slice(-recentCount);
  result.push(...recentMessages);

  // Safety guard: ensure the result never ends with an assistant message.
  // Claude 4.5+ and other models reject "assistant message prefill".
  if (result.length > 0 && result[result.length - 1].role === "assistant") {
    result.push({ role: "user", content: "Please continue." });
  }

  const newTokens = estimateConversationTokens(result);
  logger.info(sessionId, "context_mgmt", "Dropped middle messages with extractive summary", {
    tokensBefore: estimatedTokens,
    tokensAfter: newTokens,
    messagesBefore: messages.length,
    messagesAfter: result.length,
    droppedCount: droppedSlice.length,
  });

  return result;
}

/**
 * Sanitize raw API errors before surfacing to users.
 * Extracts actionable information from Anthropic/OpenRouter error bodies
 * and maps to user-friendly messages by error category.
 */
function sanitizeApiError(raw: string): string {
  const lower = raw.toLowerCase();

  // Try to extract the "message" field from a JSON error body
  const msgMatch = raw.match(/"message"\s*:\s*"([^"]+)"/);
  const errorMsg = msgMatch?.[1]?.toLowerCase() || "";

  // ── Category: Assistant prefill / message ordering ──────────────
  if (errorMsg.includes("prefill") || errorMsg.includes("must end with a user message") || errorMsg.includes("last message must be")) {
    return "The AI model rejected the message format (assistant prefill not supported). Please start a new conversation.";
  }

  // ── Category: Context length exceeded ──────────────────────────
  if (errorMsg.includes("context length") || errorMsg.includes("too many tokens") || /maximum\s+\S*\s*tokens/i.test(errorMsg) || errorMsg.includes("prompt is too long")) {
    return "The conversation has grown too long for the model's context window. Please start a new conversation.";
  }

  // ── Category: Overloaded ───────────────────────────────────────
  if (raw.includes('"overloaded_error"') || errorMsg.includes("overloaded") || errorMsg.includes("capacity")) {
    return "The AI model is temporarily overloaded. Please try again in a moment.";
  }

  // ── Category: Authentication / billing ─────────────────────────
  if (raw.includes('"authentication_error"') || /invalid\s+\S*\s*api.key/i.test(errorMsg) || errorMsg.includes("unauthorized")) {
    return "API authentication failed. Please check your API key in Settings.";
  }
  // OpenRouter-specific: 402 / insufficient credits (require "openrouter" in error to avoid false matches on generic 402s)
  if (lower.includes("openrouter") && (lower.includes("402") || lower.includes("insufficient credits") || lower.includes("payment required"))) {
    return "Your OpenRouter API key has insufficient credits. Add credits at openrouter.ai/credits or switch to a different key.";
  }
  if (errorMsg.includes("billing") || errorMsg.includes("quota") || errorMsg.includes("insufficient_quota")) {
    return "Insufficient API credits. Check your balance and add funds, or switch to a different API key.";
  }

  // ── Category: Invalid model ────────────────────────────────────
  if (errorMsg.includes("model") && (errorMsg.includes("not found") || errorMsg.includes("does not exist") || errorMsg.includes("not available"))) {
    return "The selected AI model is not available. Please try switching to a different model.";
  }

  // ── Category: Rate limit (safety net — usually handled upstream) ─
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many requests")) {
    return "Rate limit reached. Please wait a moment and try again.";
  }

  // ── Category: Generic Anthropic/OpenRouter JSON error body ─────
  if (raw.includes('"type":"error"') || raw.includes('"invalid_request_error"')) {
    const detail = msgMatch?.[1] || "";
    if (detail && detail.length < 150) {
      return `The AI model could not process this request: ${detail}`;
    }
    return "The AI model could not process this request. Please try rephrasing or start a new conversation.";
  }

  // ── Category: HTTP status code prefix ──────────────────────────
  if (/^\d{3}\s/.test(raw)) {
    return "A temporary issue occurred. Please try again in a moment.";
  }

  // ── Fallback: unrecognized errors ───────────────────────────────
  return "An unexpected error occurred. Please try again. If the issue persists, try starting a new conversation.";
}

/**
 * Parse the `retry-after` value from an Anthropic 429 error.
 * Falls back to exponential backoff when the header isn't available.
 */
function getRetryDelay(error: unknown, attempt: number): number {
  // Anthropic SDK surfaces headers on the error object
  if (error && typeof error === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers = (error as any).headers ?? (error as any).response?.headers;
    if (headers) {
      const retryAfter =
        typeof headers.get === "function"
          ? headers.get("retry-after")
          : headers["retry-after"];
      if (retryAfter) {
        const seconds = Number(retryAfter);
        if (!isNaN(seconds) && seconds > 0) {
          return seconds * 1000 + 500; // add 500 ms buffer
        }
      }
    }
  }
  // Exponential backoff: 5s → 10s → 20s
  return BASE_BACKOFF_MS * Math.pow(2, attempt);
}

// Load repo-local mcp-servicenow compiled modules at runtime using Node.js require.
// This avoids stale copies under webapp/node_modules when the file: dependency is not refreshed.
const appRequire = createRequire(path.join(process.cwd(), "package.json"));
const localMcpDistDir = path.resolve(process.cwd(), "..", "mcp-servicenow", "dist");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _toolRegistry: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _toolDefs: any = null;

function getToolRegistry() {
  if (!_toolRegistry) {
    _toolRegistry = appRequire(path.join(localMcpDistDir, "tool-registry.js"));
  }
  return _toolRegistry;
}

function getToolDefs() {
  if (!_toolDefs) {
    _toolDefs = appRequire(path.join(localMcpDistDir, "tool-definitions.js"));
  }
  return _toolDefs;
}

export interface UserCredentials {
  instanceUrl: string;
  username: string;
  password: string;
  snAuthType?: ServiceNowAuthMethod;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  sessionCookies?: BrowserSessionCookie[];
  sessionToken?: string;
  claudeApiKey: string;
  /** OpenRouter API key (when using OpenRouter provider) */
  openRouterApiKey?: string;
  /** Which AI provider to use */
  aiProvider?: "anthropic" | "openrouter";
}

/** A non-image file attachment (PDF, Word, Excel) */
export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // base64-encoded
  size: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** ISO 8601 timestamp when this message was created */
  timestamp?: string;
  /** Base64 data-URI images attached to this message */
  images?: string[];
  /** Non-image file attachments (PDF, Word, Excel) */
  files?: FileAttachment[];
}

export interface ToolExecution {
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

export interface ChatResponse {
  reply: string;
  toolExecutions: ToolExecution[];
}

/**
 * Stable system prompt — byte-identical across requests for cache hits.
 * Dynamic context (date, session) is appended separately at call time.
 */
const SYSTEM_PROMPT = buildSystemPrompt();

/* ── Shared helpers (extracted from 4 chat functions) ────────── */

function isBrowserScopeSwitchEnabled(): boolean {
  const mode = process.env.BROWSER_SCOPE_SWITCH_MODE;
  return (
    mode === "headless" ||
    mode === "headed" ||
    mode === "cdp" ||
    process.env.ENABLE_BROWSER_SCOPE_SWITCH === "true"
  );
}

function buildServiceNowConfig(credentials: UserCredentials): Record<string, unknown> {
  const authType = normalizeServiceNowAuthMethod(credentials.snAuthType);
  const config: Record<string, unknown> = {
    instanceUrl: credentials.instanceUrl.replace(/\/$/, ""),
    authType,
  };

  if (credentials.username) config.username = credentials.username;
  if (credentials.password) config.password = credentials.password;

  switch (authType) {
    case "oauth_client_credentials":
      config.clientId = credentials.clientId;
      config.clientSecret = credentials.clientSecret;
      break;
    case "oauth_authorization_code":
      config.clientId = credentials.clientId;
      config.clientSecret = credentials.clientSecret;
      config.accessToken = credentials.accessToken;
      config.refreshToken = credentials.refreshToken;
      break;
    case "session":
      config.sessionCookies = credentials.sessionCookies;
      if (credentials.sessionToken) config.sessionToken = credentials.sessionToken;
      break;
    default:
      break;
  }

  return config;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSnClient(credentials: UserCredentials, registry: any) {
  const client = new registry.ServiceNowClient(buildServiceNowConfig(credentials));

  // Inject optional browser fallback for scope switching (Tier 4)
  if (isBrowserScopeSwitchEnabled()) {
    try {
      // Dynamic import to keep playwright-core optional
      const { switchScopeViaBrowser } = require("./browser-scope-switcher");
      client.setEnsureScopeOptions({
        browserFallback: async (scopeId: string, scopeName: string) => {
          const result = await switchScopeViaBrowser(
            {
              instanceUrl: credentials.instanceUrl,
              username: credentials.username,
              password: credentials.password,
              sessionCookies: credentials.sessionCookies,
            },
            scopeId,
            scopeName
          );

          if (result.success && result.cookies?.length) {
            client.importCookies(result.cookies);
          }

          return result;
        },
      });
    } catch {
      // playwright-core not installed — Tier 4 will be skipped
    }
  }

  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFilteredTools(phase: string | null | undefined, defs: any) {
  return (phase
    ? defs.getAnthropicToolDefinitionsForPhase(phase)
    : defs.getAnthropicToolDefinitions()) as Anthropic.Tool[];
}

/**
 * Preprocess messages: extract text from file attachments and prepend to user message content.
 * This runs once before messages are converted to API format, so both Anthropic and OpenRouter
 * paths benefit from file content extraction.
 */
async function preprocessFileAttachments(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const result: ChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "user" && msg.files && msg.files.length > 0) {
      const fileText = await processFileAttachments(msg.files);
      const augmentedContent = fileText
        ? `[Attached documents]\n\n${fileText}\n\n---\n\n${msg.content}`
        : msg.content;
      result.push({ ...msg, content: augmentedContent, files: undefined });
    } else {
      result.push(msg);
    }
  }
  return result;
}

function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (m.images && m.images.length > 0 && m.role === "user") {
      const parts: Anthropic.ContentBlockParam[] = [];
      for (const dataUri of m.images) {
        const match = dataUri.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
        if (match) {
          parts.push({
            type: "image",
            source: {
              type: "base64",
              media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: match[2],
            },
          });
        }
      }
      if (m.content.trim()) {
        parts.push({ type: "text", text: m.content });
      }
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: m.content };
  });
}

function toOpenRouterMessages(messages: ChatMessage[], model: string): OpenRouterMessage[] {
  return [
    buildOpenRouterSystemMessage(model),
    ...messages.map((m) => {
      if (m.images && m.images.length > 0 && m.role === "user") {
        const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
        for (const dataUri of m.images) {
          content.push({ type: "image_url", image_url: { url: dataUri } });
        }
        if (m.content.trim()) {
          content.push({ type: "text", text: m.content });
        }
        return { role: m.role as "user", content };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    }),
  ];
}

function toOpenRouterTools(anthropicTools: Anthropic.Tool[]): OpenRouterTool[] {
  return anthropicTools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema,
    },
  }));
}

/**
 * Truncate tool input for logging (avoids dumping huge scripts into logs).
 * Keeps full keys but truncates long string values.
 */
function summarizeToolInput(input: unknown): Record<string, unknown> {
  if (input === null || input === undefined || typeof input !== "object") {
    return { _raw: typeof input === "string" && input.length > 200 ? input.slice(0, 200) + "..." : input };
  }
  const obj = input as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isSensitiveLogKey(k)) {
      summary[k] = Array.isArray(v) ? `[REDACTED:${v.length}]` : "[REDACTED]";
    } else if (typeof v === "string" && v.length > 200) {
      summary[k] = v.slice(0, 200) + `... [${v.length} chars]`;
    } else if (v && typeof v === "object") {
      summary[k] = summarizeToolInput(v);
    } else {
      summary[k] = v;
    }
  }
  return summary;
}

/** Execute a single tool call, log it, and return the ToolExecution record. */
async function executeAndLogTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registry: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snClient: any,
  toolName: string,
  input: unknown,
  sessionId: string,
): Promise<{ execution: ToolExecution; resultJson: string; success: boolean }> {
  const start = Date.now();
  let output: unknown;
  let success = true;
  try {
    output = await registry.executeToolCall(toolName, input, snClient);
    // Many tools return { success: false, error: "..." } instead of throwing
    if (typeof output === "object" && output !== null && (output as Record<string, unknown>).success === false) {
      success = false;
    }
  } catch (err) {
    output = { error: err instanceof Error ? err.message : String(err) };
    success = false;
  }
  const durationMs = Date.now() - start;

  const inputSummary = summarizeToolInput(input);

  if (success) {
    logger.info(sessionId, "mcp_tool", `Tool executed: ${toolName}`, { toolName, durationMs, success: true, input: inputSummary });
  } else {
    logger.error(sessionId, "mcp_tool", `Tool failed: ${toolName}`, {
      toolName,
      durationMs,
      input: inputSummary,
      error: typeof output === "object" && output !== null ? (output as Record<string, unknown>).error : output,
    });
  }

  return {
    execution: { toolName, input, output, durationMs },
    resultJson: truncateToolResult(output),
    success,
  };
}

function toPublicToolExecution(execution: ToolExecution): ToolExecution {
  const outputObject = execution.output as Record<string, unknown> | null;
  const hasError = typeof outputObject === "object" && outputObject !== null && "error" in outputObject;
  return {
    toolName: execution.toolName,
    input: summarizeToolInput(execution.input),
    output: hasError
      ? { error: outputObject?.error ?? "Tool execution failed" }
      : { summary: truncateToolResult(execution.output) },
    durationMs: execution.durationMs,
  };
}

function toPublicToolExecutions(toolExecutions: ToolExecution[]): ToolExecution[] {
  if (process.env.EXPOSE_FULL_TOOL_EXECUTIONS === "true") return toolExecutions;
  return toolExecutions.map(toPublicToolExecution);
}

/**
 * Run one full AI tool-use conversation loop (supports Anthropic and OpenRouter).
 * Returns the assistant's final text reply plus all tool executions.
 */
export async function chat(
  credentials: UserCredentials,
  messages: ChatMessage[],
  model: string = "claude-sonnet-4-6",
  sessionId: string = "unknown",
  phase?: string | null
): Promise<ChatResponse> {
  if (credentials.aiProvider === "openrouter" && credentials.openRouterApiKey) {
    return chatOpenRouter(credentials, messages, model, sessionId, phase);
  }

  const engineConfig = await loadEngineConfig();
  const maxToolRounds = getPhaseRoundLimit(phase, engineConfig);
  const registry = getToolRegistry();
  const snClient = createSnClient(credentials, registry);
  const tools = getFilteredTools(phase, getToolDefs());
  const allToolCount = getToolDefs().getAnthropicToolDefinitions().length;
  const anthropic = new Anthropic({ apiKey: credentials.claudeApiKey });
  const processedMessages = await preprocessFileAttachments(messages);
  const anthropicMessages = toAnthropicMessages(processedMessages);
  const toolExecutions: ToolExecution[] = [];
  let rounds = 0;

  // Log initial request context
  const userIntent = messages.filter(m => m.role === "user").slice(-1)[0]?.content?.slice(0, 200) || "";
  logger.info(sessionId, "chat_init", "Chat session initialized", {
    phase: phase || "none",
    toolsFiltered: tools.length,
    toolsTotal: allToolCount,
    model,
    userIntent,
  });

  while (rounds < maxToolRounds) {
    rounds++;

    const trimmedMessages = trimConversationHistory(anthropicMessages, sessionId);
    if (trimmedMessages.length !== anthropicMessages.length) {
      const beforeCount = anthropicMessages.length;
      anthropicMessages.length = 0;
      anthropicMessages.push(...trimmedMessages);
      logger.info(sessionId, "context_mgmt", "Conversation history trimmed", {
        beforeMessages: beforeCount,
        afterMessages: trimmedMessages.length,
        reason: "token budget exceeded",
      });
    }

    logger.info(sessionId, "claude_api", `Round ${rounds}/${maxToolRounds}: Calling Anthropic API`, {
      messageCount: anthropicMessages.length, model, remainingRounds: maxToolRounds - rounds,
    });

    // Call Anthropic with prompt caching + retry logic
    let response: Anthropic.Message;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          system: SYSTEM_PROMPT + "\n" + buildDynamicContext({ phase: phase || undefined }),
          tools,
          messages: anthropicMessages,
          cache_control: { type: "ephemeral" },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usage = response.usage as any;
        logger.info(sessionId, "claude_api", "API response received", {
          stopReason: response.stop_reason,
          inputTokens: usage?.input_tokens ?? 0,
          cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
          cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
          outputTokens: usage?.output_tokens ?? 0,
        });
        break;
      } catch (err) {
        const isRateLimit =
          err instanceof Anthropic.RateLimitError ||
          (err instanceof Error && err.message.includes("429"));

        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = getRetryDelay(err, attempt);
          logger.warn(sessionId, "claude_api", "Rate limit hit, retrying", { attempt: attempt + 1, delayMs: delay });
          await sleep(delay);
          continue;
        }
        if (isRateLimit) {
          logger.error(sessionId, "claude_api", "Rate limit exceeded after all retries");
          const wrapped = new Error("anthropic_rate_limit");
          (wrapped as unknown as Record<string, unknown>).cause = err;
          throw wrapped;
        }
        logger.error(sessionId, "claude_api", "Anthropic API error", { error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      logger.info(sessionId, "claude_api", `Claude requesting ${toolUseBlocks.length} tool call(s)`, {
        tools: toolUseBlocks.map((b) => b.type === "tool_use" ? b.name : "").filter(Boolean),
        round: rounds,
      });

      anthropicMessages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          const { execution, resultJson } = await executeAndLogTool(registry, snClient, block.name, block.input, sessionId);
          toolExecutions.push(execution);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultJson });
        }
      }
      anthropicMessages.push({ role: "user", content: toolResults });
    } else {
      const textParts = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text);
      logger.info(sessionId, "chat", "Chat completed", {
        toolCount: toolExecutions.length,
        totalRounds: rounds,
        stopReason: response.stop_reason,
      });
      return { reply: textParts.join("\n"), toolExecutions: toPublicToolExecutions(toolExecutions) };
    }
  }

  logger.warn(sessionId, "chat", "Max tool rounds reached", { rounds: maxToolRounds, toolCount: toolExecutions.length });
  return {
    reply: "I reached the maximum number of tool execution rounds. Please try a more specific request.",
    toolExecutions: toPublicToolExecutions(toolExecutions),
  };
}

/**
 * Build the system message for OpenRouter.
 * For Claude models, uses structured content blocks with cache_control
 * so the stable prefix is cached across requests.
 */
function buildOpenRouterSystemMessage(model: string): OpenRouterMessage {
  const isClaude = model.toLowerCase().includes("claude") || model.toLowerCase().includes("anthropic");
  if (isClaude) {
    return {
      role: "system",
      content: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: buildDynamicContext() },
      ],
    };
  }
  return { role: "system", content: SYSTEM_PROMPT + "\n" + buildDynamicContext() };
}

/**
 * OpenRouter chat implementation with tool-use loop.
 */
async function chatOpenRouter(
  credentials: UserCredentials,
  messages: ChatMessage[],
  model: string,
  sessionId: string,
  phase?: string | null
): Promise<ChatResponse> {
  const engineConfig = await loadEngineConfig();
  const maxToolRounds = getPhaseRoundLimit(phase, engineConfig);
  const registry = getToolRegistry();
  const snClient = createSnClient(credentials, registry);
  const tools = toOpenRouterTools(getFilteredTools(phase, getToolDefs()));
  const processedMessages = await preprocessFileAttachments(messages);
  const orMessages = toOpenRouterMessages(processedMessages, model);
  const toolExecutions: ToolExecution[] = [];
  let rounds = 0;

  while (rounds < maxToolRounds) {
    rounds++;
    logger.info(sessionId, "openrouter_api", `Round ${rounds}: Calling OpenRouter API`, { messageCount: orMessages.length, model });

    const response = await chatCompletion(
      { apiKey: credentials.openRouterApiKey!, siteName: APP_NAME || "AI Dev Agent" },
      { model, messages: orMessages, tools, tool_choice: "auto", max_tokens: 8192 }
    );

    const choice = response.choices[0];
    if (!choice?.message) throw new Error("No response from OpenRouter");
    const message = choice.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      orMessages.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: message.tool_calls,
      } as OpenRouterMessage & { tool_calls: typeof message.tool_calls });

      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const { execution, resultJson } = await executeAndLogTool(registry, snClient, toolCall.function.name, args, sessionId);
        toolExecutions.push(execution);
        orMessages.push({ role: "tool", tool_call_id: toolCall.id, content: resultJson });
      }
    } else {
      logger.info(sessionId, "chat", "OpenRouter chat completed", { toolCount: toolExecutions.length });
      return { reply: message.content || "", toolExecutions: toPublicToolExecutions(toolExecutions) };
    }
  }

  logger.warn(sessionId, "chat", "Max tool rounds reached (OpenRouter)", { rounds: maxToolRounds });
  return {
    reply: "I reached the maximum number of tool execution rounds. Please try a more specific request.",
    toolExecutions: toPublicToolExecutions(toolExecutions),
  };
}

/**
 * Quick connection test — validates SN credentials and checks roles.
 */
export async function testConnection(credentials: Omit<UserCredentials, "claudeApiKey">) {
  const registry = getToolRegistry();
  const snClient = createSnClient(credentials as UserCredentials, registry);

  // 1. Test basic connection
  const connResult = await registry.executeToolCall("sn_test_connection", {}, snClient);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(connResult as any)?.success) return connResult;

  // 2. Get current user sys_id
  let user: Record<string, unknown> | undefined;
  let userSysId: unknown;
  let userName: string = credentials.username || "Authenticated user";
  let userUsername: string = credentials.username || "";
  try {
    const currentUser = await snClient.getCurrentUser();
    if (currentUser) {
      user = currentUser as Record<string, unknown>;
      userSysId = currentUser.sys_id;
      userName = String(currentUser.name || currentUser.user_name || userName);
      userUsername = String(currentUser.user_name || credentials.username || "");
    }
  } catch (err) {
    console.warn("[testConnection] User lookup failed:", err);
  }

  // If the user was not found and the caller supplied a username, treat it as a mismatch.
  if ((!user || !userSysId) && credentials.username) {
    return {
      success: false,
      message: `User "${credentials.username}" was not found on this instance. Please check the username and try again.`,
    };
  }

  // 3. Check roles via sys_user_has_role with display values
  //    ServiceNow returns reference fields as objects { link, value } by default.
  //    Using sysparm_display_value=true gives us the role name directly.
  let roles: string[] = [];
  if (userSysId) {
    try {
      const roleRecords = await snClient.getRecords("sys_user_has_role", {
        sysparm_query: `user=${userSysId}`,
        sysparm_fields: "role",
        sysparm_display_value: "true",
        sysparm_limit: 300,
      });
      roles = roleRecords
        .map((r: Record<string, unknown>) => {
          const role = r.role;
          // With display_value=true, reference fields come as { display_value, link }
          if (role && typeof role === "object" && "display_value" in (role as Record<string, unknown>)) {
            return String((role as Record<string, unknown>).display_value || "");
          }
          // Fallback: plain string
          return String(role || "");
        })
        .filter(Boolean);
    } catch (err) {
      console.warn("[testConnection] Role lookup failed:", err);
    }
  }

  const hasAdmin = roles.includes("admin");
  const hasSecurityAdmin = roles.includes("security_admin");
  const noRoles = !!user && roles.length === 0;

  // 4. Fetch assignment groups for the user (non-blocking — fallback to empty)
  let assignmentGroups: { sysId: string; name: string }[] = [];
  if (userSysId) {
    try {
      const grpMembers = await snClient.getRecords("sys_user_grmember", {
        sysparm_query: `user=${userSysId}`,
        sysparm_fields: "group",
        sysparm_display_value: "true",
        sysparm_limit: 50,
      });
      assignmentGroups = grpMembers
        .map((gm: Record<string, unknown>) => {
          const grp = gm.group;
          if (grp && typeof grp === "object" && "display_value" in (grp as Record<string, unknown>)) {
            const obj = grp as Record<string, unknown>;
            return { sysId: String(obj.value || ""), name: String(obj.display_value || "") };
          }
          return null;
        })
        .filter((g: { sysId: string; name: string } | null): g is { sysId: string; name: string } => g !== null && g.sysId !== "");
    } catch (err) {
      console.warn("[testConnection] Assignment group lookup failed:", err);
    }
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(connResult as any),
    authType: credentials.snAuthType || "basic",
    userInfo: {
      name: userName,
      username: userUsername,
      sysId: userSysId ? String(userSysId) : undefined,
      email: user?.email ? String(user.email) : undefined,
      assignmentGroups,
    },
    roles,
    hasAdmin,
    hasSecurityAdmin,
    noRoles,
  };
}

/* ── Instance-based Example Prompts ───────────────────────────── */

import type { ExamplePrompt, CategorizedPrompts } from "./types";
import { PromptComposer } from "./suggestion-engine";
import type { ComposeResult, PromptPoolMap, UserContext as SuggestionUserContext } from "./suggestion-engine";

export type { ComposeResult, PromptPoolMap };

export interface FetchCategorizedResult {
  prompts: CategorizedPrompts;
  pools: PromptPoolMap;
  promptHashes: string[];
}

/**
 * Fetch instance metadata and generate categorized, scored example prompts
 * for all 5 suggestion tabs via the modular PromptComposer.
 * Each provider runs its own SN queries in parallel.
 */
export async function fetchCategorizedPrompts(
  credentials: Omit<UserCredentials, "claudeApiKey">,
  userContext?: SuggestionUserContext,
  seenHashes?: string[],
): Promise<FetchCategorizedResult> {
  const registry = getToolRegistry();
  const snClient = createSnClient(credentials as UserCredentials, registry);
  const composer = new PromptComposer();
  const result = await composer.compose(snClient, userContext, seenHashes);
  return { prompts: result.prompts, pools: result.pools, promptHashes: result.promptHashes };
}

/** Backward-compatible wrapper — returns flat "foryou" prompts */
export async function fetchInstancePrompts(
  credentials: Omit<UserCredentials, "claudeApiKey">
): Promise<ExamplePrompt[]> {
  const { prompts } = await fetchCategorizedPrompts(credentials);
  return prompts.foryou;
}

/** Extract only display-relevant fields from tool input to keep SSE payloads small.
 *  This avoids sending full script bodies (which can be 10-50KB) to the browser. */
function pickDisplayFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (src.name) out.name = src.name;
  if (src.table) out.table = src.table;
  if (src.query) out.query = src.query;
  if (src.encoded_query) out.encoded_query = src.encoded_query;
  // For generic sn_create_record / sn_update_record — artifact name is inside data
  if (src.data && typeof src.data === "object" && (src.data as Record<string, unknown>).name) {
    out.data = { name: (src.data as Record<string, unknown>).name };
  }
  return out;
}

/* ── Streaming Chat Types ─────────────────────────────────────── */

export type StreamEvent =
  | { type: "status"; message: string; phase?: "thinking" | "tool" | "responding" }
  | { type: "tool_start"; toolName: string; input: unknown; taskId?: number }
  | { type: "tool_end"; toolName: string; durationMs: number; success: boolean; taskId?: number }
  | { type: "text_delta"; text: string }
  | { type: "done"; reply: string; toolExecutions: ToolExecution[] }
  | { type: "max_rounds_reached"; reply: string; toolExecutions: ToolExecution[]; resumeAfterMs: number; phase?: string }
  | { type: "error"; message: string }
  // Task planner events
  | { type: "plan"; plan: ExecutionPlan }
  | { type: "task_start"; taskId: number; taskName: string }
  | { type: "task_complete"; taskId: number; taskName: string };

/**
 * Streaming version of chat that yields events for real-time UI updates.
 * Useful for showing which tool is being executed, progress, etc.
 */
export async function* chatStream(
  credentials: UserCredentials,
  messages: ChatMessage[],
  model: string = "claude-sonnet-4-6",
  maxToolRounds: number = 30,
  sessionId: string = "unknown",
  phase?: string | null,
  signal?: AbortSignal,
  sddMode?: boolean,
): AsyncGenerator<StreamEvent> {
  const engineConfig = await loadEngineConfig();
  const effectiveMaxRounds = Math.min(maxToolRounds, getPhaseRoundLimit(phase, engineConfig));

  if (credentials.aiProvider === "openrouter" && credentials.openRouterApiKey) {
    yield* chatStreamOpenRouter(credentials, messages, model, effectiveMaxRounds, sessionId, phase, signal, sddMode, engineConfig);
    return;
  }

  const registry = getToolRegistry();
  const snClient = createSnClient(credentials, registry);
  const tools = getFilteredTools(phase, getToolDefs());
  const allToolCount = getToolDefs().getAnthropicToolDefinitions().length;
  const anthropic = new Anthropic({ apiKey: credentials.claudeApiKey });
  const processedMessages = await preprocessFileAttachments(messages);
  const anthropicMessages = toAnthropicMessages(processedMessages);
  const toolExecutions: ToolExecution[] = [];
  const dedup = new ToolCallDeduplicator();
  let rounds = 0;

  // Session cache for cross-phase data reuse
  const sessionCache = getSessionCache(sessionId);

  // Log initial request context
  const userIntent = processedMessages.filter(m => m.role === "user").slice(-1)[0]?.content?.slice(0, 200) || "";
  logger.info(sessionId, "chat_init", "Stream session initialized", {
    phase: phase || "none",
    toolsFiltered: tools.length,
    toolsTotal: allToolCount,
    model,
    maxToolRounds: effectiveMaxRounds,
    userIntent,
    cacheSize: sessionCache.size,
  });

  // ── Task Planner: Plan → Gather → Execute ──────────────────────
  let plannerRanSuccessfully = false;

  if (shouldPlan(userIntent, phase, processedMessages.length)) {
    yield { type: "status", message: "Planning execution...", phase: "thinking" };

    const availableToolNames = tools.map((t: Anthropic.Tool) => t.name);
    const plan = await generatePlan(
      userIntent,
      phase || "unknown",
      availableToolNames,
      sessionCache,
      {
        provider: "anthropic",
        anthropicApiKey: credentials.claudeApiKey,
        model,
      },
      sessionId
    );

    if (plan && plan.tasks.length > 0) {
      // Create a tool executor that wraps executeAndLogTool
      const toolExecutor = async (toolName: string, args: unknown) => {
        const { execution, resultJson, success } = await executeAndLogTool(registry, snClient, toolName, args, sessionId);
        toolExecutions.push(execution);
        return { result: execution.output, durationMs: execution.durationMs, success };
      };

      // Execute the plan — yields events for UI
      const planGenerator = executePlan(plan, toolExecutor, sessionCache, sessionId);
      let gatheredData = new Map<string, unknown>();

      // Consume the generator, forwarding planner events as StreamEvents
      let iterResult = await planGenerator.next();
      while (!iterResult.done) {
        const planEvent = iterResult.value as PlanStreamEvent;
        // Forward planner events to the SSE stream
        if (planEvent.type === "plan") {
          yield { type: "plan", plan: planEvent.plan! } as StreamEvent;
        } else if (planEvent.type === "task_start") {
          yield { type: "task_start", taskId: planEvent.taskId!, taskName: planEvent.taskName! } as StreamEvent;
        } else if (planEvent.type === "task_complete") {
          yield { type: "task_complete", taskId: planEvent.taskId!, taskName: planEvent.taskName! } as StreamEvent;
        } else if (planEvent.type === "plan_tool_start") {
          yield { type: "tool_start", toolName: planEvent.toolName!, input: pickDisplayFields(planEvent.input), taskId: planEvent.taskId } as StreamEvent;
        } else if (planEvent.type === "plan_tool_end") {
          yield { type: "tool_end", toolName: planEvent.toolName!, durationMs: planEvent.durationMs!, success: planEvent.success!, taskId: planEvent.taskId } as StreamEvent;
        }
        iterResult = await planGenerator.next();
      }
      // The return value of the generator is the gathered data
      gatheredData = iterResult.value || new Map();

      // Inject gathered data into AI context so it doesn't re-fetch.
      // IMPORTANT: Splice BEFORE the user's last message to maintain proper
      // user/assistant alternation. Claude 4.5+ and other models reject
      // "assistant message prefill" (trailing assistant message).
      if (gatheredData.size > 0) {
        const dataText = formatGatheredData(gatheredData);
        const dataMsg: Anthropic.MessageParam = {
          role: "user",
          content: [{ type: "text", text: dataText }],
        };
        const ackMsg: Anthropic.MessageParam = {
          role: "assistant",
          content: "I have received the pre-fetched data and will use it directly without re-querying.",
        };
        if (anthropicMessages.length === 0) {
          anthropicMessages.push(dataMsg, ackMsg);
        } else {
          const insertIdx = anthropicMessages.length - 1;
          anthropicMessages.splice(insertIdx, 0, dataMsg, ackMsg);
        }
        plannerRanSuccessfully = true;
        logger.info(sessionId, "planner", "Gathered data injected into context", {
          dataKeys: gatheredData.size,
          dataLengthChars: dataText.length,
        });
      }
    } else {
      logger.info(sessionId, "planner", "Plan generation returned no tasks — falling back to reactive loop");
    }
  }

  let adjustedMaxRounds = effectiveMaxRounds;
  if (plannerRanSuccessfully) {
    adjustedMaxRounds = computeAdjustedRounds(effectiveMaxRounds, engineConfig.plannerBudgetFactor, engineConfig.plannerBudgetMinimum);
    logger.info(sessionId, "planner", "Round budget adjusted after planning", {
      original: effectiveMaxRounds,
      adjusted: adjustedMaxRounds,
    });
  }

  const ROUNDS_WARNING_THRESHOLD = 3; // Warn Claude when this many rounds remain
  const startTime = Date.now();
  const MAX_EXECUTION_TIME_MS = 280_000; // 280s (leaves 20s buffer before 300s platform kill)

  while (rounds < adjustedMaxRounds) {
    // Abort signal check — bail early if client disconnected (saves API calls)
    if (signal?.aborted) {
      logger.info(sessionId, "chat_stream", "Aborted by client signal", { rounds, phase: phase || "none" });
      yield { type: "error", message: "Request aborted by client" };
      return;
    }

    // Time limit check — bail early if approaching platform timeout
    if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
      logger.warn(sessionId, "chat_stream", "Approaching platform time limit, aborting loop", { rounds, executionTime: Date.now() - startTime });
      yield { type: "error", message: "Request took too long and was aborted to prevent platform timeout. Please try breaking your request into smaller steps." };
      return;
    }

    rounds++;

    const trimmedMessages = trimConversationHistory(anthropicMessages, sessionId);
    if (trimmedMessages.length !== anthropicMessages.length) {
      const beforeCount = anthropicMessages.length;
      anthropicMessages.length = 0;
      anthropicMessages.push(...trimmedMessages);
      logger.info(sessionId, "context_mgmt", "Stream: conversation history trimmed", {
        beforeMessages: beforeCount,
        afterMessages: trimmedMessages.length,
      });
      yield { type: "status", message: "Trimmed conversation history to manage context size", phase: "thinking" };
    }

    // Inject a warning when approaching the round limit so Claude can wrap up gracefully
    const remainingRounds = adjustedMaxRounds - rounds;
    if (remainingRounds === ROUNDS_WARNING_THRESHOLD - 1 && rounds > 1) {
      anthropicMessages.push({
        role: "user",
        content: [{
          type: "text",
          text: `[SYSTEM NOTE: You have ${remainingRounds + 1} tool rounds remaining. Complete the highest-priority remaining work and emit the phase gate. Do NOT tell the user about round limits, tool capacity, or remaining rounds. Do NOT provide a "resume plan" or summary of what's left. Just finish the work and emit the phase gate marker.]`,
        }],
      });
      logger.info(sessionId, "round_limit", `Injected round-limit warning at round ${rounds}`, { remainingRounds: remainingRounds + 1 });
    }

    // Phase-aware gate reminder — fire early for lightweight phases
    const phaseReminder = phase ? PHASE_GATE_REMINDERS[phase] : undefined;
    if (phaseReminder && rounds === phaseReminder.threshold && rounds > 1) {
      anthropicMessages.push({
        role: "user",
        content: [{ type: "text", text: phaseReminder.message }],
      });
      logger.info(sessionId, "phase_reminder", `Injected phase gate reminder for ${phase}`, { round: rounds });
    }

    logger.info(sessionId, "claude_api", `Stream round ${rounds}/${adjustedMaxRounds}: Calling Anthropic API`, {
      messageCount: anthropicMessages.length, model, remainingRounds,
    });
    yield { type: "status", message: `Round ${rounds}: Analyzing request...`, phase: "thinking" };

    let response: Anthropic.Message;
    for (let attempt = 0; ; attempt++) {
      try {
        const dynamicCtxOpts: DynamicContextOptions = { sddMode, phase: phase || undefined };
        response = await anthropic.messages.create({
          model, max_tokens: 8192,
          system: SYSTEM_PROMPT + "\n" + buildDynamicContext(dynamicCtxOpts),
          tools, messages: anthropicMessages,
          cache_control: { type: "ephemeral" },
        });
        break;
      } catch (err) {
        const isRateLimit = err instanceof Anthropic.RateLimitError || (err instanceof Error && err.message.includes("429"));
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = getRetryDelay(err, attempt);
          logger.warn(sessionId, "claude_api", "Stream rate limit hit, retrying", { attempt: attempt + 1, delayMs: delay });
          yield { type: "status", message: `Rate limited, retrying in ${(delay / 1000).toFixed(0)}s...`, phase: "thinking" };
          await sleep(delay);
          continue;
        }
        if (isRateLimit) {
          logger.error(sessionId, "claude_api", "Stream rate limit exceeded after all retries");
          yield { type: "error", message: "Rate limit exceeded after retries" };
          return;
        }
        const rawError = err instanceof Error ? err.message : String(err);
        logger.error(sessionId, "claude_api", "Stream Anthropic API error", { error: rawError });
        yield { type: "error", message: sanitizeApiError(rawError) };
        return;
      }
    }

    // Log stop reason
    logger.info(sessionId, "claude_api", `Stream response received`, {
      stopReason: response.stop_reason,
      round: rounds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputTokens: (response.usage as any)?.input_tokens ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outputTokens: (response.usage as any)?.output_tokens ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cacheReadTokens: (response.usage as any)?.cache_read_input_tokens ?? 0,
    });

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      logger.info(sessionId, "claude_api", `Claude requesting ${toolUseBlocks.length} tool call(s)`, {
        tools: toolUseBlocks.map((b) => b.type === "tool_use" ? b.name : "").filter(Boolean),
        round: rounds,
      });

      anthropicMessages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      let dupesThisRound = 0;

      for (const block of response.content) {
        if (block.type === "tool_use") {
          // Duplicate tool call detection
          const callCount = dedup.record(block.name, block.input);
          if (callCount >= 2) {
            dupesThisRound++;
            logger.warn(sessionId, "dedup", `Duplicate tool call detected: ${block.name} (call #${callCount})`, { round: rounds });
          }

          yield { type: "tool_start", toolName: block.name, input: pickDisplayFields(block.input) };
          yield { type: "status", message: `Executing: ${block.name}`, phase: "tool" };

          const { execution, resultJson, success } = await executeAndLogTool(registry, snClient, block.name, block.input, sessionId);
          yield { type: "tool_end", toolName: block.name, durationMs: execution.durationMs, success };
          toolExecutions.push(execution);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultJson });
        }
      }

      // Inject dedup warning as a text block AFTER tool_results (Anthropic requires
      // tool_result blocks first, then text blocks in the same user message).
      // Previously this used a fake tool_use_id "dedup_warning" which caused Anthropic
      // 400 errors: "unexpected tool_use_id found in tool_result blocks: dedup_warning"
      if (dupesThisRound > 0) {
        const totalDupes = dedup.totalDuplicates;
        const severity = totalDupes >= 4 ? "CRITICAL" : "WARNING";
        const dupeMsg = totalDupes >= 4
          ? `[SYSTEM ${severity}: You have made ${totalDupes} duplicate tool calls with identical parameters. The results have not changed. STOP making tool calls and produce your text response NOW. If you are in a phase gate, emit the phase gate marker immediately.]`
          : `[SYSTEM ${severity}: You just called a tool with the same parameters as a previous call. The result is the same. Use the data you already have and proceed.]`;
        (toolResults as Array<Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam>).push({
          type: "text",
          text: dupeMsg,
        });
        logger.warn(sessionId, "dedup", `Injected ${severity} dedup warning`, { totalDupes, round: rounds });
      }

      anthropicMessages.push({ role: "user", content: toolResults });

      // Phase gate detection BETWEEN rounds — after all tools executed, before next API call.
      // If Claude emitted a PHASE_GATE marker alongside tool calls, we honor the tools
      // (no orphaned artifacts) but stop the loop so the user can approve.
      const textInToolResponse = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("\n");
      const gateInToolRound = parsePhaseGate(textInToolResponse);
      if (gateInToolRound) {
        logger.info(sessionId, "phase_gate", `Phase gate detected between rounds: ${gateInToolRound}`, {
          phase: gateInToolRound, round: rounds, toolCount: toolExecutions.length,
        });
        yield { type: "done", reply: textInToolResponse, toolExecutions: toPublicToolExecutions(toolExecutions) };
        return;
      }
    } else {
      yield { type: "status", message: "Generating response...", phase: "responding" };
      const reply = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");

      // Phase gate detection on final text response
      const gateInFinal = parsePhaseGate(reply);
      if (gateInFinal) {
        logger.info(sessionId, "phase_gate", `Phase gate detected in final response: ${gateInFinal}`, {
          phase: gateInFinal, round: rounds, toolCount: toolExecutions.length,
        });
      }

      logger.info(sessionId, "chat_stream", "Stream completed", {
        toolCount: toolExecutions.length,
        totalRounds: rounds,
        stopReason: response.stop_reason,
      });
      yield { type: "done", reply, toolExecutions: toPublicToolExecutions(toolExecutions) };
      return;
    }
  }

  // Extract any partial text from the last response to include context for resume
  const RESUME_DELAY_MS = 5000;
  logger.warn(sessionId, "chat_stream", "Stream max tool rounds reached -- signaling auto-resume", {
    rounds: adjustedMaxRounds,
    phase: phase || "none",
    toolCount: toolExecutions.length,
    duplicateToolCalls: dedup.totalDuplicates,
    resumeAfterMs: RESUME_DELAY_MS,
  });
  yield {
    type: "max_rounds_reached",
    reply: `[Reached ${adjustedMaxRounds} tool rounds in ${phase || "unknown"} phase. Resuming automatically to continue work...]`,
    toolExecutions: toPublicToolExecutions(toolExecutions),
    resumeAfterMs: RESUME_DELAY_MS,
    phase: phase || undefined,
  } as StreamEvent;
}

/**
 * OpenRouter streaming chat implementation.
 */
async function* chatStreamOpenRouter(
  credentials: UserCredentials,
  messages: ChatMessage[],
  model: string,
  maxToolRounds: number,
  sessionId: string,
  phase?: string | null,
  signal?: AbortSignal,
  sddMode?: boolean,
  engineConfig?: EngineConfig,
): AsyncGenerator<StreamEvent> {
  const registry = getToolRegistry();
  const snClient = createSnClient(credentials, registry);
  const rawTools = getFilteredTools(phase, getToolDefs());
  const tools = toOpenRouterTools(rawTools);
  const processedMessages = await preprocessFileAttachments(messages);
  const orMessages = toOpenRouterMessages(processedMessages, model);
  const toolExecutions: ToolExecution[] = [];
  const dedup = new ToolCallDeduplicator();
  let rounds = 0;

  // Session cache for cross-phase data reuse
  const sessionCache = getSessionCache(sessionId);
  let adjustedMaxRounds = maxToolRounds;

  // ── Task Planner for OpenRouter path ──────────────────────────
  const userIntent = processedMessages.filter(m => m.role === "user").slice(-1)[0]?.content?.slice(0, 200) || "";

  if (shouldPlan(userIntent, phase, processedMessages.length)) {
    yield { type: "status", message: "Planning execution...", phase: "thinking" };

    const availableToolNames = rawTools.map((t: Anthropic.Tool) => t.name);
    const plan = await generatePlan(
      userIntent,
      phase || "unknown",
      availableToolNames,
      sessionCache,
      {
        provider: "openrouter",
        openRouterApiKey: credentials.openRouterApiKey,
        model,
      },
      sessionId
    );

    if (plan && plan.tasks.length > 0) {
      const toolExecutor = async (toolName: string, args: unknown) => {
        const { execution, resultJson, success } = await executeAndLogTool(registry, snClient, toolName, args, sessionId);
        toolExecutions.push(execution);
        return { result: execution.output, durationMs: execution.durationMs, success };
      };

      const planGenerator = executePlan(plan, toolExecutor, sessionCache, sessionId);
      let gatheredData = new Map<string, unknown>();

      let iterResult = await planGenerator.next();
      while (!iterResult.done) {
        const planEvent = iterResult.value as PlanStreamEvent;
        if (planEvent.type === "plan") {
          yield { type: "plan", plan: planEvent.plan! } as StreamEvent;
        } else if (planEvent.type === "task_start") {
          yield { type: "task_start", taskId: planEvent.taskId!, taskName: planEvent.taskName! } as StreamEvent;
        } else if (planEvent.type === "task_complete") {
          yield { type: "task_complete", taskId: planEvent.taskId!, taskName: planEvent.taskName! } as StreamEvent;
        } else if (planEvent.type === "plan_tool_start") {
          yield { type: "tool_start", toolName: planEvent.toolName!, input: pickDisplayFields(planEvent.input), taskId: planEvent.taskId } as StreamEvent;
        } else if (planEvent.type === "plan_tool_end") {
          yield { type: "tool_end", toolName: planEvent.toolName!, durationMs: planEvent.durationMs!, success: planEvent.success!, taskId: planEvent.taskId } as StreamEvent;
        }
        iterResult = await planGenerator.next();
      }
      gatheredData = iterResult.value || new Map();

      // Splice BEFORE the user's last message -- same fix as Anthropic path.
      // Claude 4.5+ and other models reject trailing assistant messages.
      if (gatheredData.size > 0) {
        const dataText = formatGatheredData(gatheredData);
        if (orMessages.length <= 1) {
          orMessages.push(
            { role: "user", content: dataText },
            { role: "assistant", content: "I have received the pre-fetched data and will use it directly without re-querying." },
          );
        } else {
          const insertIdx = orMessages.length - 1;
          orMessages.splice(
            insertIdx, 0,
            { role: "user", content: dataText },
            { role: "assistant", content: "I have received the pre-fetched data and will use it directly without re-querying." },
          );
        }
        const cfg = engineConfig || buildFallbackConfig();
        adjustedMaxRounds = computeAdjustedRounds(maxToolRounds, cfg.plannerBudgetFactor, cfg.plannerBudgetMinimum);
        logger.info(sessionId, "planner", "OpenRouter: Gathered data injected", { dataKeys: gatheredData.size, adjusted: adjustedMaxRounds });
      }
    }
  }

  const startTime = Date.now();
  const MAX_EXECUTION_TIME_MS = 280_000; // 280s (leaves 20s buffer before 300s platform kill)

  while (rounds < adjustedMaxRounds) {
    if (signal?.aborted) {
      logger.info(sessionId, "chat_stream", "OpenRouter: Aborted by client signal", { rounds, phase: phase || "none" });
      yield { type: "error", message: "Request aborted by client" };
      return;
    }

    if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
      logger.warn(sessionId, "chat_stream", "OpenRouter: Approaching platform time limit, aborting loop", { rounds, executionTime: Date.now() - startTime });
      yield { type: "error", message: "Request took too long and was aborted to prevent platform timeout. Please try breaking your request into smaller steps." };
      return;
    }

    rounds++;

    // Context trimming (mirrors Anthropic streaming path)
    const trimmedOrMessages = trimConversationHistory(orMessages as unknown as Anthropic.MessageParam[], sessionId);
    if (trimmedOrMessages.length !== orMessages.length) {
      orMessages.length = 0;
      orMessages.push(...(trimmedOrMessages as unknown as typeof orMessages));
      logger.info(sessionId, "context_mgmt", "OpenRouter stream: conversation history trimmed", {
        afterMessages: trimmedOrMessages.length,
      });
    }

    yield { type: "status", message: `Round ${rounds}: Analyzing request...`, phase: "thinking" };

    // Retry loop for rate limits (mirrors Anthropic retry logic)
    let response: Awaited<ReturnType<typeof chatCompletion>>;
    let rateLimitExhausted = false;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await chatCompletion(
          { apiKey: credentials.openRouterApiKey!, siteName: APP_NAME || "AI Dev Agent" },
          { model, messages: orMessages, tools, tool_choice: "auto", max_tokens: 8192 }
        );
        break;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit = errorMsg.includes("429");
        const isBillingError = errorMsg.includes("402") || errorMsg.toLowerCase().includes("insufficient credits");

        // Billing / insufficient credits — distinct handling
        if (isBillingError) {
          logger.error(sessionId, "openrouter_api", "OpenRouter billing error — insufficient credits", { model, error: errorMsg });
          yield { type: "error", message: `openrouter_billing|${model}|Your OpenRouter API key has insufficient credits. Add credits at https://openrouter.ai/credits or switch to a different key.` };
          return;
        }

        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
          logger.warn(sessionId, "openrouter_api", "OpenRouter rate limit hit, retrying", { attempt: attempt + 1, delayMs: delay, model });
          yield { type: "status", message: `Rate limited by provider, retrying in ${(delay / 1000).toFixed(0)}s...`, phase: "thinking" };
          await sleep(delay);
          continue;
        }
        if (isRateLimit) {
          rateLimitExhausted = true;
          logger.error(sessionId, "openrouter_api", "OpenRouter rate limit exceeded after all retries", { model, attempts: attempt + 1 });
          yield { type: "error", message: `openrouter_rate_limit|${model}|${errorMsg}` };
          return;
        }
        logger.error(sessionId, "openrouter_api", "OpenRouter streaming error", { error: errorMsg, model, round: rounds });
        yield { type: "error", message: sanitizeApiError(errorMsg) };
        return;
      }
    }
    if (rateLimitExhausted) return;

    const choice = response!.choices[0];
    if (!choice?.message) {
      yield { type: "error", message: "No response from OpenRouter" };
      return;
    }
    const message = choice.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      // Push assistant message WITH tool_calls -- many models require this for valid conversation
      orMessages.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: message.tool_calls,
      } as OpenRouterMessage & { tool_calls: typeof message.tool_calls });

      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const callCount = dedup.record(toolCall.function.name, args);
        if (callCount >= 2) {
          logger.warn(sessionId, "dedup", `OpenRouter: Duplicate tool call: ${toolCall.function.name} (call #${callCount})`, { round: rounds });
        }

        yield { type: "tool_start", toolName: toolCall.function.name, input: pickDisplayFields(typeof toolCall.function.arguments === "string" ? (() => { try { return JSON.parse(toolCall.function.arguments); } catch { return {}; } })() : toolCall.function.arguments) };
        yield { type: "status", message: `Executing: ${toolCall.function.name}`, phase: "tool" };

        const { execution, resultJson, success } = await executeAndLogTool(registry, snClient, toolCall.function.name, args, sessionId);
        yield { type: "tool_end", toolName: toolCall.function.name, durationMs: execution.durationMs, success };
        toolExecutions.push(execution);
        orMessages.push({ role: "tool", tool_call_id: toolCall.id, content: resultJson });
      }

      // Inject dedup warning for OpenRouter path
      if (dedup.totalDuplicates > 0) {
        const totalDupes = dedup.totalDuplicates;
        const dupeMsg = totalDupes >= 4
          ? `[SYSTEM: You have made ${totalDupes} duplicate tool calls. STOP making tool calls and produce your response NOW.]`
          : `[SYSTEM: Duplicate tool call detected. Use the data you already have.]`;
        orMessages.push({ role: "system", content: dupeMsg } as OpenRouterMessage);
      }

      // Phase gate detection between rounds (OpenRouter path)
      if (message.content) {
        const gateInToolRound = parsePhaseGate(message.content);
        if (gateInToolRound) {
          logger.info(sessionId, "phase_gate", `OpenRouter: Phase gate detected between rounds: ${gateInToolRound}`, {
            phase: gateInToolRound, round: rounds, toolCount: toolExecutions.length,
          });
          yield { type: "done", reply: message.content, toolExecutions: toPublicToolExecutions(toolExecutions) };
          return;
        }
      }
    } else {
      yield { type: "status", message: "Generating response...", phase: "responding" };
      const reply = message.content || "";
      const gateInFinal = parsePhaseGate(reply);
      if (gateInFinal) {
        logger.info(sessionId, "phase_gate", `OpenRouter: Phase gate detected in final response: ${gateInFinal}`, {
          phase: gateInFinal, round: rounds, toolCount: toolExecutions.length,
        });
      }
      yield { type: "done", reply, toolExecutions: toPublicToolExecutions(toolExecutions) };
      return;
    }
  }

  const RESUME_DELAY_MS = 5000;
  logger.warn(sessionId, "chat_stream", "Stream max tool rounds reached (OpenRouter) -- signaling auto-resume", {
    rounds: adjustedMaxRounds, toolCount: toolExecutions.length, duplicateToolCalls: dedup.totalDuplicates,
  });
  yield {
    type: "max_rounds_reached",
    reply: `[Reached ${adjustedMaxRounds} tool rounds in ${phase || "unknown"} phase. Resuming automatically to continue work...]`,
    toolExecutions: toPublicToolExecutions(toolExecutions),
    resumeAfterMs: RESUME_DELAY_MS,
    phase: phase || undefined,
  };
}
