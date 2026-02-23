/**
 * ServiceNow Engine — bridges Anthropic tool-use with the MCP tool registry.
 * Creates per-request ServiceNowClient instances from user-supplied credentials.
 *
 * Uses Anthropic prompt caching to avoid resending the system prompt + 80 tool
 * definitions as fresh input tokens on every round, reducing rate-limit pressure
 * by ~90 % on cache hits.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createRequire } from "node:module";
import path from "node:path";
import { buildSystemPrompt } from "./system-prompt";

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

const SYSTEM_PROMPT = buildSystemPrompt();

/**
 * Run one full Anthropic tool-use conversation loop.
 * Returns the assistant's final text reply plus all tool executions.
 */
export async function chat(
  credentials: UserCredentials,
  messages: ChatMessage[],
  model: string = "claude-sonnet-4-6",
  maxToolRounds: number = 30 // Increased from 15 to handle complex requirements (e.g., catalog items with flows)
): Promise<ChatResponse> {
  const registry = getToolRegistry();
  const defs = getToolDefs();

  // Create per-request ServiceNow client
  const snClient = new registry.ServiceNowClient({
    instanceUrl: credentials.instanceUrl.replace(/\/$/, ""),
    username: credentials.username,
    password: credentials.password,
    defaultScope: 'global',
  });

  // Build Anthropic tool definitions
  const tools = defs.getAnthropicToolDefinitions() as Anthropic.Tool[];

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
    console.log(`[chat] round ${rounds} — calling Anthropic API...`);

    // ── Call Anthropic with prompt caching + retry logic ──────
    let response: Anthropic.Message;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
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
          console.log(
            `  [cache] input=${plain} cache_read=${cached} cache_creation=${created}`
          );
        }

        break; // success — exit retry loop
      } catch (err) {
        const isRateLimit =
          err instanceof Anthropic.RateLimitError ||
          (err instanceof Error && err.message.includes("429"));

        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = getRetryDelay(err, attempt);
          console.warn(
            `  [rate-limit] 429 hit — retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${MAX_RETRIES})…`
          );
          await sleep(delay);
          continue;
        }

        // Tag Anthropic rate-limit errors so the route can distinguish them
        if (isRateLimit) {
          const wrapped = new Error("anthropic_rate_limit");
          (wrapped as unknown as Record<string, unknown>).cause = err;
          throw wrapped;
        }

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
          try {
            output = await registry.executeToolCall(block.name, block.input, snClient);
          } catch (err) {
            output = { error: err instanceof Error ? err.message : String(err) };
          }
          const durationMs = Date.now() - start;
          console.log(`  [tool] ${block.name} → ${durationMs}ms ${typeof output === "object" && output !== null && "error" in (output as Record<string, unknown>) ? "✗ ERROR" : "✓"}`);

          toolExecutions.push({
            toolName: block.name,
            input: block.input,
            output,
            durationMs,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(output, null, 2),
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
      return { reply: textParts.join("\n"), toolExecutions };
    }
  }

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

