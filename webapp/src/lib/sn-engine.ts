/**
 * ServiceNow Engine — bridges Anthropic tool-use with the MCP tool registry.
 * Creates per-request ServiceNowClient instances from user-supplied credentials.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createRequire } from "node:module";
import path from "node:path";
import { buildSystemPrompt } from "./system-prompt";

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
  maxToolRounds: number = 15
): Promise<ChatResponse> {
  const registry = getToolRegistry();
  const defs = getToolDefs();

  // Create per-request ServiceNow client
  const snClient = new registry.ServiceNowClient({
    instanceUrl: credentials.instanceUrl.replace(/\/$/, ""),
    username: credentials.username,
    password: credentials.password,
  });

  // Build Anthropic tool definitions
  const tools = defs.getAnthropicToolDefinitions() as Anthropic.Tool[];

  // Build Anthropic client with user's API key
  const anthropic = new Anthropic({ apiKey: credentials.claudeApiKey });

  // Convert chat history to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolExecutions: ToolExecution[] = [];
  let rounds = 0;

  // Tool-use loop
  while (rounds < maxToolRounds) {
    rounds++;
    console.log(`[chat] round ${rounds} — calling Anthropic API...`);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools,
      messages: anthropicMessages,
    });

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

  // 3. Check roles via sys_user_has_role
  let roles: string[] = [];
  if (userSysId) {
    const roleRecords = await snClient.getRecords("sys_user_has_role", {
      sysparm_query: `user=${userSysId}^state=0`,
      sysparm_fields: "role.name",
      sysparm_limit: 200,
    });
    roles = roleRecords.map((r: Record<string, unknown>) => String(r["role.name"] || "")).filter(Boolean);
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

