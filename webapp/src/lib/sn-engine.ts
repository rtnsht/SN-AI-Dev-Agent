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
import path from "node:path";
import { buildSystemPrompt, buildDynamicContext } from "./system-prompt";
import { logger } from "./logger";
import { chatCompletion, OpenRouterRequest, OpenRouterMessage, OpenRouterContentBlock, OpenRouterTool } from "./openrouter";

/* ── Context management constants ─────────────────────────────── */

/** Maximum characters per tool result before truncation */
const MAX_TOOL_RESULT_CHARS = 8_000;
/** Estimated tokens per character (conservative) */
const CHARS_PER_TOKEN = 3.5;
/** Target max tokens for conversation history (leave room for response) */
const MAX_CONTEXT_TOKENS = 150_000;
/** Warning threshold - start trimming older messages */
const CONTEXT_WARNING_TOKENS = 120_000;

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
 * Truncate a tool result if it exceeds the max character limit.
 * Preserves structure for objects/arrays by keeping first/last items.
 */
function truncateToolResult(result: unknown): string {
  const jsonStr = JSON.stringify(result);

  if (jsonStr.length <= MAX_TOOL_RESULT_CHARS) {
    return jsonStr;
  }

  // For arrays, keep first and last few items
  if (Array.isArray(result) && result.length > 5) {
    const truncated = {
      _truncated: true,
      _originalCount: result.length,
      _showing: "first 3 and last 2 items",
      items: [...result.slice(0, 3), { _more: `... ${result.length - 5} more items ...` }, ...result.slice(-2)]
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

/**
 * Trim older messages to stay within token limits.
 * Keeps the first user message and recent conversation turns.
 */
function trimConversationHistory(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const estimatedTokens = estimateConversationTokens(messages);

  if (estimatedTokens < CONTEXT_WARNING_TOKENS) {
    return messages;
  }

  console.log(`  [context] Estimated ${estimatedTokens} tokens, trimming older messages...`);

  // Keep first 2 messages (usually initial user request + first response)
  // and recent messages (last 10-20 depending on size)
  const keepStart = Math.min(2, messages.length);
  const result: Anthropic.MessageParam[] = messages.slice(0, keepStart);

  // Add a summary marker
  if (messages.length > keepStart + 10) {
    result.push({
      role: "user",
      content: "[Earlier conversation history trimmed to manage context size. Recent messages follow.]"
    });
    result.push({
      role: "assistant",
      content: "Understood. I'll continue based on the recent context."
    });
  }

  // Keep the most recent messages
  const recentCount = Math.min(10, messages.length - keepStart);
  result.push(...messages.slice(-recentCount));

  const newTokens = estimateConversationTokens(result);
  console.log(`  [context] Trimmed from ${estimatedTokens} to ~${newTokens} tokens (${messages.length} → ${result.length} messages)`);

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

// Load mcp-servicenow modules at runtime using Node.js require
// (bypasses Turbopack's static import analysis which can't resolve subpath exports)
const appRequire = createRequire(path.join(process.cwd(), "package.json"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _toolRegistry: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _toolDefs: any = null;

function getToolRegistry() {
  if (!_toolRegistry) {
    _toolRegistry = appRequire("mcp-servicenow/tool-registry");
  }
  return _toolRegistry;
}

function getToolDefs() {
  if (!_toolDefs) {
    _toolDefs = appRequire("mcp-servicenow/tool-definitions");
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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Base64 data-URI images attached to this message */
  images?: string[];
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
  // Route to OpenRouter if selected
  if (credentials.aiProvider === "openrouter" && credentials.openRouterApiKey) {
    return chatOpenRouter(credentials, messages, model, sessionId, phase);
  }

  const maxToolRounds = 30; // Handle complex requirements (e.g., catalog items with flows)
  const registry = getToolRegistry();
  const defs = getToolDefs();

  // Create per-request ServiceNow client
  const snClient = new registry.ServiceNowClient({
    instanceUrl: credentials.instanceUrl.replace(/\/$/, ""),
    username: credentials.username,
    password: credentials.password,
    defaultScope: 'global',
  });

  // Build Anthropic tool definitions (filtered by SDLC phase when available)
  const tools = (phase
    ? defs.getAnthropicToolDefinitionsForPhase(phase)
    : defs.getAnthropicToolDefinitions()) as Anthropic.Tool[];

  // Build Anthropic client with user's API key
  const anthropic = new Anthropic({ apiKey: credentials.claudeApiKey });

  // Convert chat history to Anthropic format (with multi-modal image support)
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => {
    // If the message has images, build multi-part content
    if (m.images && m.images.length > 0 && m.role === "user") {
      const parts: Anthropic.ContentBlockParam[] = [];
      for (const dataUri of m.images) {
        // Parse data URI: "data:image/png;base64,iVBOR..."
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

  const toolExecutions: ToolExecution[] = [];
  let rounds = 0;

  // Tool-use loop
  while (rounds < maxToolRounds) {
    rounds++;

    // Trim conversation history if approaching token limits
    const trimmedMessages = trimConversationHistory(anthropicMessages);
    if (trimmedMessages.length !== anthropicMessages.length) {
      anthropicMessages.length = 0;
      anthropicMessages.push(...trimmedMessages);
    }

    logger.info(sessionId, "claude_api", `Round ${rounds}: Calling Anthropic API`, {
      messageCount: anthropicMessages.length,
      model,
    });

    // ── Call Anthropic with prompt caching + retry logic ──────
    let response: Anthropic.Message;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          // Stable prefix first (cacheable), then dynamic context.
          system: SYSTEM_PROMPT + "\n" + buildDynamicContext(),
          tools,
          messages: anthropicMessages,
          // Prompt caching: the SDK automatically places a cache breakpoint
          // on the last cacheable block (system prompt / tools).  Subsequent
          // rounds within 5 min reuse the cached prefix at 0.1× token cost.
          cache_control: { type: "ephemeral" },
        });

        // Log cache performance from usage stats
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usage = response.usage as any;
        if (usage) {
          const cached = usage.cache_read_input_tokens ?? 0;
          const created = usage.cache_creation_input_tokens ?? 0;
          const plain = usage.input_tokens ?? 0;
          logger.info(sessionId, "claude_api", "API response received", {
            inputTokens: plain,
            cacheReadTokens: cached,
            cacheCreationTokens: created,
            outputTokens: usage.output_tokens ?? 0,
          });
        }

        break; // success — exit retry loop
      } catch (err) {
        const isRateLimit =
          err instanceof Anthropic.RateLimitError ||
          (err instanceof Error && err.message.includes("429"));

        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = getRetryDelay(err, attempt);
          logger.warn(sessionId, "claude_api", "Rate limit hit, retrying", {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            delayMs: delay,
          });
          await sleep(delay);
          continue;
        }

        // Tag Anthropic rate-limit errors so the route can distinguish them
        if (isRateLimit) {
          logger.error(sessionId, "claude_api", "Rate limit exceeded after all retries");
          const wrapped = new Error("anthropic_rate_limit");
          (wrapped as unknown as Record<string, unknown>).cause = err;
          throw wrapped;
        }

        logger.error(sessionId, "claude_api", "Anthropic API error", {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err; // non-retryable error
      }
    }

    // Check if the model wants to use tools
    if (response.stop_reason === "tool_use") {
      // Add assistant message to history
      anthropicMessages.push({ role: "assistant", content: response.content });

      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const start = Date.now();
          let output: unknown;
          let hasError = false;
          try {
            output = await registry.executeToolCall(block.name, block.input, snClient);
          } catch (err) {
            output = { error: err instanceof Error ? err.message : String(err) };
            hasError = true;
          }
          const durationMs = Date.now() - start;
          hasError = hasError || (typeof output === "object" && output !== null && "error" in (output as Record<string, unknown>));

          if (hasError) {
            logger.error(sessionId, "mcp_tool", `Tool execution failed: ${block.name}`, {
              toolName: block.name,
              durationMs,
              error: typeof output === "object" && output !== null ? (output as Record<string, unknown>).error : output,
            });
          } else {
            logger.info(sessionId, "mcp_tool", `Tool executed: ${block.name}`, {
              toolName: block.name,
              durationMs,
              success: true,
            });
          }

          toolExecutions.push({
            toolName: block.name,
            input: block.input,
            output,
            durationMs,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: truncateToolResult(output),
          });
        }
      }

      // Feed tool results back
      anthropicMessages.push({ role: "user", content: toolResults });
    } else {
      // Final text response — extract text blocks
      const textParts = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text);
      logger.info(sessionId, "chat", "Chat completed", { toolCount: toolExecutions.length });
      return { reply: textParts.join("\n"), toolExecutions };
    }
  }

  logger.warn(sessionId, "chat", "Max tool rounds reached", { rounds: maxToolRounds });
  return {
    reply: "I reached the maximum number of tool execution rounds. Please try a more specific request.",
    toolExecutions,
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
  const maxToolRounds = 30;
  const registry = getToolRegistry();
  const defs = getToolDefs();

  // Create per-request ServiceNow client
  const snClient = new registry.ServiceNowClient({
    instanceUrl: credentials.instanceUrl.replace(/\/$/, ""),
    username: credentials.username,
    password: credentials.password,
    defaultScope: 'global',
  });

  // Convert Anthropic tool definitions to OpenRouter format (filtered by phase)
  const anthropicTools = (phase
    ? defs.getAnthropicToolDefinitionsForPhase(phase)
    : defs.getAnthropicToolDefinitions()) as Anthropic.Tool[];
  const tools: OpenRouterTool[] = anthropicTools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema,
    },
  }));

  // Build OpenRouter messages with system prompt + dynamic context (cache_control for Claude)
  const orMessages: OpenRouterMessage[] = [
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

  const toolExecutions: ToolExecution[] = [];
  let rounds = 0;

  while (rounds < maxToolRounds) {
    rounds++;
    logger.info(sessionId, "openrouter_api", `Round ${rounds}: Calling OpenRouter API`, {
      messageCount: orMessages.length,
      model,
    });

    const response = await chatCompletion(
      { apiKey: credentials.openRouterApiKey!, siteName: "Yantra AI Dev Agent" },
      { model, messages: orMessages, tools, tool_choice: "auto", max_tokens: 8192 }
    );

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No response from OpenRouter");
    }

    const message = choice.message;
    if (!message) {
      throw new Error("No message in OpenRouter response");
    }

    // Check for tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Add assistant message with tool calls
      orMessages.push({
        role: "assistant",
        content: message.content || "",
      });

      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const start = Date.now();
        let output: unknown;
        let hasError = false;
        try {
          const args = JSON.parse(toolCall.function.arguments);
          output = await registry.executeToolCall(toolCall.function.name, args, snClient);
        } catch (err) {
          output = { error: err instanceof Error ? err.message : String(err) };
          hasError = true;
        }
        const durationMs = Date.now() - start;

        if (hasError) {
          logger.error(sessionId, "mcp_tool", `Tool failed: ${toolCall.function.name}`, {
            toolName: toolCall.function.name,
            durationMs,
            error: typeof output === "object" && output !== null ? (output as Record<string, unknown>).error : output,
          });
        } else {
          logger.info(sessionId, "mcp_tool", `Tool executed: ${toolCall.function.name}`, {
            toolName: toolCall.function.name,
            durationMs,
            success: true,
          });
        }

        toolExecutions.push({
          toolName: toolCall.function.name,
          input: toolCall.function.arguments,
          output,
          durationMs,
        });

        // Add tool result message
        orMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: truncateToolResult(output),
        });
      }
    } else {
      // Final text response
      logger.info(sessionId, "chat", "OpenRouter chat completed", { toolCount: toolExecutions.length });
      return { reply: message.content || "", toolExecutions };
    }
  }

  logger.warn(sessionId, "chat", "Max tool rounds reached (OpenRouter)", { rounds: maxToolRounds });
  return {
    reply: "I reached the maximum number of tool execution rounds. Please try a more specific request.",
    toolExecutions,
  };
}

/**
 * Quick connection test — validates SN credentials and checks roles.
 */
export async function testConnection(credentials: Omit<UserCredentials, "claudeApiKey">) {
  const registry = getToolRegistry();
  const snClient = new registry.ServiceNowClient({
    instanceUrl: credentials.instanceUrl.replace(/\/$/, ""),
    username: credentials.username,
    password: credentials.password,
    defaultScope: 'global',
  });

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

/* ── Streaming Chat Types ─────────────────────────────────────── */

export type StreamEvent =
  | { type: "status"; message: string; phase?: "thinking" | "tool" | "responding" }
  | { type: "tool_start"; toolName: string; input: unknown }
  | { type: "tool_end"; toolName: string; durationMs: number; success: boolean }
  | { type: "text_delta"; text: string }
  | { type: "done"; reply: string; toolExecutions: ToolExecution[] }
  | { type: "error"; message: string };

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
  phase?: string | null
): AsyncGenerator<StreamEvent> {
  // Route to OpenRouter if selected
  if (credentials.aiProvider === "openrouter" && credentials.openRouterApiKey) {
    yield* chatStreamOpenRouter(credentials, messages, model, maxToolRounds, sessionId, phase);
    return;
  }

  const registry = getToolRegistry();
  const defs = getToolDefs();

  // Create per-request ServiceNow client
  const snClient = new registry.ServiceNowClient({
    instanceUrl: credentials.instanceUrl.replace(/\/$/, ""),
    username: credentials.username,
    password: credentials.password,
    defaultScope: 'global',
  });

  // Build Anthropic tool definitions (filtered by SDLC phase)
  const tools = (phase
    ? defs.getAnthropicToolDefinitionsForPhase(phase)
    : defs.getAnthropicToolDefinitions()) as Anthropic.Tool[];

  // Build Anthropic client with user's API key
  const anthropic = new Anthropic({ apiKey: credentials.claudeApiKey });

  // Convert chat history to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => {
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

  const toolExecutions: ToolExecution[] = [];
  let rounds = 0;

  // Tool-use loop with streaming events
  while (rounds < maxToolRounds) {
    rounds++;

    // Trim conversation history if approaching token limits
    const trimmedMessages = trimConversationHistory(anthropicMessages);
    if (trimmedMessages.length !== anthropicMessages.length) {
      anthropicMessages.length = 0;
      anthropicMessages.push(...trimmedMessages);
      yield { type: "status", message: "Trimmed conversation history to manage context size", phase: "thinking" };
    }

    logger.info(sessionId, "claude_api", `Stream round ${rounds}: Calling Anthropic API`, {
      messageCount: anthropicMessages.length,
      model,
    });
    yield { type: "status", message: `Round ${rounds}: Analyzing request...`, phase: "thinking" };

    // Call Anthropic with retry logic
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
        break;
      } catch (err) {
        const isRateLimit =
          err instanceof Anthropic.RateLimitError ||
          (err instanceof Error && err.message.includes("429"));

        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = getRetryDelay(err, attempt);
          logger.warn(sessionId, "claude_api", "Stream rate limit hit, retrying", {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            delayMs: delay,
          });
          yield { type: "status", message: `Rate limited, retrying in ${(delay / 1000).toFixed(0)}s...`, phase: "thinking" };
          await sleep(delay);
          continue;
        }

        if (isRateLimit) {
          logger.error(sessionId, "claude_api", "Stream rate limit exceeded after all retries");
          yield { type: "error", message: "Rate limit exceeded after retries" };
          return;
        }

        logger.error(sessionId, "claude_api", "Stream Anthropic API error", {
          error: err instanceof Error ? err.message : String(err),
        });
        yield { type: "error", message: err instanceof Error ? err.message : String(err) };
        return;
      }
    }

    // Check if the model wants to use tools
    if (response.stop_reason === "tool_use") {
      anthropicMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          yield { type: "tool_start", toolName: block.name, input: block.input };
          yield { type: "status", message: `Executing: ${block.name}`, phase: "tool" };

          const start = Date.now();
          let output: unknown;
          let success = true;
          try {
            output = await registry.executeToolCall(block.name, block.input, snClient);
          } catch (err) {
            output = { error: err instanceof Error ? err.message : String(err) };
            success = false;
          }
          const durationMs = Date.now() - start;

          // Log tool execution
          if (success) {
            logger.info(sessionId, "mcp_tool", `Stream tool executed: ${block.name}`, {
              toolName: block.name,
              durationMs,
              success: true,
            });
          } else {
            logger.error(sessionId, "mcp_tool", `Stream tool failed: ${block.name}`, {
              toolName: block.name,
              durationMs,
              error: typeof output === "object" && output !== null ? (output as Record<string, unknown>).error : output,
            });
          }

          yield { type: "tool_end", toolName: block.name, durationMs, success };

          toolExecutions.push({
            toolName: block.name,
            input: block.input,
            output,
            durationMs,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: truncateToolResult(output),
          });
        }
      }

      anthropicMessages.push({ role: "user", content: toolResults });
    } else {
      yield { type: "status", message: "Generating response...", phase: "responding" };

      const textParts = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text);
      const reply = textParts.join("\n");

      logger.info(sessionId, "chat_stream", "Stream completed", { toolCount: toolExecutions.length });
      yield { type: "done", reply, toolExecutions };
      return;
    }
  }

  logger.warn(sessionId, "chat_stream", "Stream max tool rounds reached", { rounds: maxToolRounds });
  yield {
    type: "done",
    reply: "I reached the maximum number of tool execution rounds. Please try a more specific request.",
    toolExecutions,
  };
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
  phase?: string | null
): AsyncGenerator<StreamEvent> {
  const registry = getToolRegistry();
  const defs = getToolDefs();

  const snClient = new registry.ServiceNowClient({
    instanceUrl: credentials.instanceUrl.replace(/\/$/, ""),
    username: credentials.username,
    password: credentials.password,
    defaultScope: 'global',
  });

  // Filter tools by SDLC phase when available
  const anthropicTools = (phase
    ? defs.getAnthropicToolDefinitionsForPhase(phase)
    : defs.getAnthropicToolDefinitions()) as Anthropic.Tool[];
  const tools: OpenRouterTool[] = anthropicTools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema,
    },
  }));

  const orMessages: OpenRouterMessage[] = [
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

  const toolExecutions: ToolExecution[] = [];
  let rounds = 0;

  while (rounds < maxToolRounds) {
    rounds++;
    yield { type: "status", message: `Round ${rounds}: Analyzing request...`, phase: "thinking" };

    try {
      const response = await chatCompletion(
        { apiKey: credentials.openRouterApiKey!, siteName: "Yantra AI Dev Agent" },
        { model, messages: orMessages, tools, tool_choice: "auto", max_tokens: 8192 }
      );

      const choice = response.choices[0];
      if (!choice?.message) {
        yield { type: "error", message: "No response from OpenRouter" };
        return;
      }

      const message = choice.message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        orMessages.push({ role: "assistant", content: message.content || "" });

        for (const toolCall of message.tool_calls) {
          yield { type: "tool_start", toolName: toolCall.function.name, input: toolCall.function.arguments };
          yield { type: "status", message: `Executing: ${toolCall.function.name}`, phase: "tool" };

          const start = Date.now();
          let output: unknown;
          let success = true;
          try {
            const args = JSON.parse(toolCall.function.arguments);
            output = await registry.executeToolCall(toolCall.function.name, args, snClient);
          } catch (err) {
            output = { error: err instanceof Error ? err.message : String(err) };
            success = false;
          }
          const durationMs = Date.now() - start;

          yield { type: "tool_end", toolName: toolCall.function.name, durationMs, success };

          toolExecutions.push({
            toolName: toolCall.function.name,
            input: toolCall.function.arguments,
            output,
            durationMs,
          });

          orMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: truncateToolResult(output),
          });
        }
      } else {
        yield { type: "status", message: "Generating response...", phase: "responding" };
        yield { type: "done", reply: message.content || "", toolExecutions };
        return;
      }
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
      return;
    }
  }

  yield {
    type: "done",
    reply: "I reached the maximum number of tool execution rounds. Please try a more specific request.",
    toolExecutions,
  };
}
