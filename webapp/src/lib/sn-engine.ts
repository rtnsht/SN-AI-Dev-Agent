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
import { buildSystemPrompt, buildDynamicContext } from "./system-prompt";
import { logger } from "./logger";
import { chatCompletion, OpenRouterRequest, OpenRouterMessage, OpenRouterContentBlock, OpenRouterTool } from "./openrouter";
import { getSessionCache, SessionCache } from "./session-cache";
import { shouldPlan, generatePlan, executePlan, formatGatheredData, type PlanStreamEvent, type ExecutionPlan } from "./task-planner";

/* ── Context management constants ─────────────────────────────── */

/** Maximum characters per tool result before truncation */
const MAX_TOOL_RESULT_CHARS = 8_000;
/** Estimated tokens per character (conservative) */
const CHARS_PER_TOKEN = 3.5;
/** Target max tokens for conversation history (leave room for response) */
const MAX_CONTEXT_TOKENS = 150_000;
/** Warning threshold - start trimming older messages */
const CONTEXT_WARNING_TOKENS = 120_000;

/* ── Phase-aware round limits ────────────────────────────────── */

/** Phase round limits + default, imported from MCP tool definitions */
let _phaseRoundLimits: Record<string, number> | null = null;
let _defaultRoundLimit = 30;

function getPhaseRoundLimit(phase: string | null | undefined): number {
  if (!_phaseRoundLimits) {
    try {
      const defs = getToolDefs();
      _phaseRoundLimits = defs.PHASE_ROUND_LIMITS ?? {};
      _defaultRoundLimit = defs.DEFAULT_ROUND_LIMIT ?? 30;
    } catch {
      return 30;
    }
  }
  if (phase && _phaseRoundLimits && phase in _phaseRoundLimits) {
    return _phaseRoundLimits[phase];
  }
  return _defaultRoundLimit;
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
  scope_selection: {
    threshold: 3,  // After 3 rounds, remind AI to emit the gate
    message: `[SYSTEM: You are in scope_selection phase. The user has already chosen their scope. You MUST emit <!-- PHASE_GATE:scope_selection --> in your text response NOW to proceed to implementation. Do NOT make more tool calls — you have all the information you need.]`,
  },
};

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
function trimConversationHistory(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const estimatedTokens = estimateConversationTokens(messages);

  if (estimatedTokens < CONTEXT_WARNING_TOKENS) {
    return messages;
  }

  logger.info("system", "context_mgmt", "Context budget exceeded, applying progressive compression", {
    estimatedTokens,
    warningThreshold: CONTEXT_WARNING_TOKENS,
    messageCount: messages.length,
  });

  // Step 1: Compress old tool results (keeps all messages, just shrinks content)
  let compressed = compressOldToolResults(messages);
  let compressedTokens = estimateConversationTokens(compressed);
  logger.info("system", "context_mgmt", "After tool-result compression", { tokensAfter: compressedTokens, tokensBefore: estimatedTokens });

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
  result.push(...compressed.slice(-recentCount));

  const newTokens = estimateConversationTokens(result);
  logger.info("system", "context_mgmt", "Dropped middle messages with extractive summary", {
    tokensBefore: estimatedTokens,
    tokensAfter: newTokens,
    messagesBefore: messages.length,
    messagesAfter: result.length,
    droppedCount: droppedSlice.length,
  });

  return result;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSnClient(credentials: UserCredentials, registry: any) {
  return new registry.ServiceNowClient({
    instanceUrl: credentials.instanceUrl.replace(/\/$/, ""),
    username: credentials.username,
    password: credentials.password,
    defaultScope: "global",
  });
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
    if (typeof v === "string" && v.length > 200) {
      summary[k] = v.slice(0, 200) + `... [${v.length} chars]`;
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

  const maxToolRounds = 30;
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

    const trimmedMessages = trimConversationHistory(anthropicMessages);
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
          system: SYSTEM_PROMPT + "\n" + buildDynamicContext(),
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
      return { reply: textParts.join("\n"), toolExecutions };
    }
  }

  logger.warn(sessionId, "chat", "Max tool rounds reached", { rounds: maxToolRounds, toolCount: toolExecutions.length });
  return { reply: "I reached the maximum number of tool execution rounds. Please try a more specific request.", toolExecutions };
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
  const maxToolRounds = 30;
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
      { apiKey: credentials.openRouterApiKey!, siteName: "Yantra AI Dev Agent" },
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
      return { reply: message.content || "", toolExecutions };
    }
  }

  logger.warn(sessionId, "chat", "Max tool rounds reached (OpenRouter)", { rounds: maxToolRounds });
  return { reply: "I reached the maximum number of tool execution rounds. Please try a more specific request.", toolExecutions };
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
  const userRecords = await snClient.getRecords("sys_user", {
    sysparm_query: `user_name=${credentials.username}`,
    sysparm_fields: "sys_id,user_name,name,email",
    sysparm_limit: 1,
  });
  const user = userRecords?.[0];
  const userSysId = user?.sys_id;
  const userName = user?.name || credentials.username;

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

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(connResult as any),
    userInfo: { name: userName, username: credentials.username },
    roles,
    hasAdmin,
    hasSecurityAdmin,
  };
}

/* ── Instance-based Example Prompts ───────────────────────────── */

export interface ExamplePrompt {
  icon: string;
  text: string;
  desc: string;
}

/**
 * Fetch lightweight instance metadata and generate contextual example prompts.
 * Queries: custom tables, business rules, catalog items, update sets.
 * Returns 4 randomized prompts relevant to what exists on the instance.
 */
export async function fetchInstancePrompts(
  credentials: Omit<UserCredentials, "claudeApiKey">
): Promise<ExamplePrompt[]> {
  const registry = getToolRegistry();
  const snClient = createSnClient(credentials as UserCredentials, registry);

  // Run all queries in parallel for speed
  const [customTables, businessRules, catalogItems, updateSets] = await Promise.allSettled([
    // Custom tables (u_ prefix or scoped)
    snClient.getRecords("sys_db_object", {
      sysparm_query: "nameSTARTSWITHu_^ORnameSTARTSWITHx_^super_class!=NULL",
      sysparm_fields: "name,label",
      sysparm_limit: 20,
    }),
    // Recent business rules on common tables
    snClient.getRecords("sys_script", {
      sysparm_query: "active=true^collectionISNOTEMPTY^ORDERBYDESCsys_updated_on",
      sysparm_fields: "name,collection,when",
      sysparm_limit: 20,
    }),
    // Service catalog items
    snClient.getRecords("sc_cat_item", {
      sysparm_query: "active=true^ORDERBYDESCsys_updated_on",
      sysparm_fields: "name,short_description,category",
      sysparm_limit: 15,
    }),
    // In-progress update sets
    snClient.getRecords("sys_update_set", {
      sysparm_query: "state=in progress^nameNOT LIKEDefault",
      sysparm_fields: "name,description",
      sysparm_limit: 10,
    }),
  ]);

  const tables = customTables.status === "fulfilled" ? customTables.value : [];
  const rules = businessRules.status === "fulfilled" ? businessRules.value : [];
  const catItems = catalogItems.status === "fulfilled" ? catalogItems.value : [];
  const updSets = updateSets.status === "fulfilled" ? updateSets.value : [];

  // Build a pool of contextual prompts
  const pool: ExamplePrompt[] = [];

  // Prompts based on custom tables
  for (const t of tables.slice(0, 8)) {
    const label = (t.label as string) || (t.name as string);
    const name = t.name as string;
    pool.push({ icon: "🔍", text: `Analyze the custom table "${label}" (${name}) — show its fields, business rules, and ACLs`, desc: "Instance analysis" });
    pool.push({ icon: "📊", text: `List all records in ${name} and summarize the data patterns`, desc: "Quick query" });
  }

  // Prompts based on business rules — group by table
  const rulesByTable = new Map<string, string[]>();
  for (const r of rules) {
    const col = r.collection as string;
    if (!col) continue;
    if (!rulesByTable.has(col)) rulesByTable.set(col, []);
    rulesByTable.get(col)!.push(r.name as string);
  }
  for (const [table, names] of rulesByTable) {
    pool.push({ icon: "⚙️", text: `Review the ${names.length} active business rule(s) on "${table}" and check for conflicts or performance issues`, desc: "Code review" });
  }

  // Prompts based on catalog items
  for (const item of catItems.slice(0, 6)) {
    const name = (item.name as string) || (item.short_description as string);
    pool.push({ icon: "📦", text: `Analyze the catalog item "${name}" — review its variables, workflow, and suggest improvements`, desc: "Catalog review" });
  }

  // Prompts based on update sets
  for (const us of updSets.slice(0, 4)) {
    const name = us.name as string;
    pool.push({ icon: "🔄", text: `Show the contents of update set "${name}" and summarize what it changes`, desc: "Update set review" });
  }

  // Always include a few generic but useful prompts
  pool.push({ icon: "🏗️", text: "Build a new feature on my instance following the full SDLC process", desc: "Full SDLC requirement" });
  pool.push({ icon: "🔍", text: "Analyze my instance health — find anti-patterns, unused scripts, and performance issues", desc: "Instance analysis" });
  pool.push({ icon: "📋", text: "List all custom applications and scoped apps on this instance", desc: "Quick query" });
  pool.push({ icon: "🛡️", text: "Audit the ACL rules on my instance and identify security gaps", desc: "Security audit" });

  // Shuffle and pick 4
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
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
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  // Apply per-phase round limit (overrides the caller's default if phase is set)
  const effectiveMaxRounds = Math.min(maxToolRounds, getPhaseRoundLimit(phase));

  if (credentials.aiProvider === "openrouter" && credentials.openRouterApiKey) {
    yield* chatStreamOpenRouter(credentials, messages, model, effectiveMaxRounds, sessionId, phase, signal);
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
          yield { type: "tool_start", toolName: planEvent.toolName!, input: {}, taskId: planEvent.taskId } as StreamEvent;
        } else if (planEvent.type === "plan_tool_end") {
          yield { type: "tool_end", toolName: planEvent.toolName!, durationMs: planEvent.durationMs!, success: planEvent.success!, taskId: planEvent.taskId } as StreamEvent;
        }
        iterResult = await planGenerator.next();
      }
      // The return value of the generator is the gathered data
      gatheredData = iterResult.value || new Map();

      // Inject gathered data into AI context so it doesn't re-fetch
      if (gatheredData.size > 0) {
        const dataText = formatGatheredData(gatheredData);
        anthropicMessages.push({
          role: "user",
          content: [{ type: "text", text: dataText }],
        });
        // Add AI acknowledgment
        anthropicMessages.push({
          role: "assistant",
          content: "I have received the pre-fetched data and will use it directly without re-querying.",
        });
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

  // Reduce round budget if planner already gathered data
  let adjustedMaxRounds = effectiveMaxRounds;
  if (plannerRanSuccessfully) {
    adjustedMaxRounds = Math.max(5, Math.ceil(effectiveMaxRounds * 0.6));
    logger.info(sessionId, "planner", "Round budget adjusted after planning", {
      original: effectiveMaxRounds,
      adjusted: adjustedMaxRounds,
    });
  }

  const ROUNDS_WARNING_THRESHOLD = 3; // Warn Claude when this many rounds remain

  while (rounds < adjustedMaxRounds) {
    // Abort signal check — bail early if client disconnected (saves API calls)
    if (signal?.aborted) {
      logger.info(sessionId, "chat_stream", "Aborted by client signal", { rounds, phase: phase || "none" });
      yield { type: "error", message: "Request aborted by client" };
      return;
    }

    rounds++;

    const trimmedMessages = trimConversationHistory(anthropicMessages);
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
          text: `[SYSTEM NOTE: You have ${remainingRounds + 1} tool rounds remaining. Prioritize completing the most critical remaining work. Summarize what you have completed and what still needs to be done so work can be resumed if needed.]`,
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
        response = await anthropic.messages.create({
          model, max_tokens: 8192,
          system: SYSTEM_PROMPT + "\n" + buildDynamicContext(),
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
        logger.error(sessionId, "claude_api", "Stream Anthropic API error", { error: err instanceof Error ? err.message : String(err) });
        yield { type: "error", message: err instanceof Error ? err.message : String(err) };
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

          yield { type: "tool_start", toolName: block.name, input: block.input };
          yield { type: "status", message: `Executing: ${block.name}`, phase: "tool" };

          const { execution, resultJson, success } = await executeAndLogTool(registry, snClient, block.name, block.input, sessionId);
          yield { type: "tool_end", toolName: block.name, durationMs: execution.durationMs, success };
          toolExecutions.push(execution);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultJson });
        }
      }

      // Inject dedup warning if AI is going in circles
      if (dupesThisRound > 0) {
        const totalDupes = dedup.totalDuplicates;
        const severity = totalDupes >= 4 ? "CRITICAL" : "WARNING";
        const dupeMsg = totalDupes >= 4
          ? `[SYSTEM ${severity}: You have made ${totalDupes} duplicate tool calls with identical parameters. The results have not changed. STOP making tool calls and produce your text response NOW. If you are in a phase gate, emit the phase gate marker immediately.]`
          : `[SYSTEM ${severity}: You just called a tool with the same parameters as a previous call. The result is the same. Use the data you already have and proceed.]`;
        toolResults.push({
          type: "tool_result",
          tool_use_id: "dedup_warning",
          content: dupeMsg,
        } as Anthropic.ToolResultBlockParam);
        logger.warn(sessionId, "dedup", `Injected ${severity} dedup warning`, { totalDupes, round: rounds });
      }

      anthropicMessages.push({ role: "user", content: toolResults });
    } else {
      yield { type: "status", message: "Generating response...", phase: "responding" };
      const reply = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
      logger.info(sessionId, "chat_stream", "Stream completed", {
        toolCount: toolExecutions.length,
        totalRounds: rounds,
        stopReason: response.stop_reason,
      });
      yield { type: "done", reply, toolExecutions };
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
    toolExecutions,
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
  signal?: AbortSignal
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
          yield { type: "tool_start", toolName: planEvent.toolName!, input: {}, taskId: planEvent.taskId } as StreamEvent;
        } else if (planEvent.type === "plan_tool_end") {
          yield { type: "tool_end", toolName: planEvent.toolName!, durationMs: planEvent.durationMs!, success: planEvent.success!, taskId: planEvent.taskId } as StreamEvent;
        }
        iterResult = await planGenerator.next();
      }
      gatheredData = iterResult.value || new Map();

      if (gatheredData.size > 0) {
        const dataText = formatGatheredData(gatheredData);
        orMessages.push({ role: "user", content: dataText });
        orMessages.push({ role: "assistant", content: "I have received the pre-fetched data and will use it directly without re-querying." });
        adjustedMaxRounds = Math.max(5, Math.ceil(maxToolRounds * 0.6));
        logger.info(sessionId, "planner", "OpenRouter: Gathered data injected", { dataKeys: gatheredData.size });
      }
    }
  }

  while (rounds < adjustedMaxRounds) {
    if (signal?.aborted) {
      logger.info(sessionId, "chat_stream", "OpenRouter: Aborted by client signal", { rounds, phase: phase || "none" });
      yield { type: "error", message: "Request aborted by client" };
      return;
    }
    rounds++;
    yield { type: "status", message: `Round ${rounds}: Analyzing request...`, phase: "thinking" };

    // Retry loop for rate limits (mirrors Anthropic retry logic)
    let response: Awaited<ReturnType<typeof chatCompletion>>;
    let rateLimitExhausted = false;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await chatCompletion(
          { apiKey: credentials.openRouterApiKey!, siteName: "Yantra AI Dev Agent" },
          { model, messages: orMessages, tools, tool_choice: "auto", max_tokens: 8192 }
        );
        break;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit = errorMsg.includes("429");

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
        yield { type: "error", message: errorMsg };
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

        yield { type: "tool_start", toolName: toolCall.function.name, input: toolCall.function.arguments };
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
    } else {
      yield { type: "status", message: "Generating response...", phase: "responding" };
      yield { type: "done", reply: message.content || "", toolExecutions };
      return;
    }
  }

  const RESUME_DELAY_MS = 5000;
  logger.warn(sessionId, "chat_stream", "Stream max tool rounds reached (OpenRouter) -- signaling auto-resume", {
    rounds: maxToolRounds, toolCount: toolExecutions.length, duplicateToolCalls: dedup.totalDuplicates,
  });
  yield {
    type: "max_rounds_reached",
    reply: `[Reached ${maxToolRounds} tool rounds in ${phase || "unknown"} phase. Resuming automatically to continue work...]`,
    toolExecutions,
    resumeAfterMs: RESUME_DELAY_MS,
    phase: phase || undefined,
  };
}
