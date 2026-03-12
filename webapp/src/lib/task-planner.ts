/**
 * Task Planner — Plan-then-Execute orchestration for ServiceNow AI Dev Agent.
 *
 * Instead of a purely reactive tool-use loop, this module:
 * 1. Classifies whether a request needs planning (shouldPlan)
 * 2. Generates a structured execution plan via a single LLM call (generatePlan)
 * 3. Executes read-only tasks in parallel, write tasks sequentially (executePlan)
 *
 * The planner runs WITHIN each SDLC phase — it does not replace the phase pipeline.
 * Phase gates, user approvals, and the reactive loop for synthesis remain unchanged.
 */

import Anthropic from "@anthropic-ai/sdk";
import { chatCompletion, OpenRouterMessage, OpenRouterTool } from "./openrouter";
import { logger } from "./logger";
import { SessionCache } from "./session-cache";

// ─── Types ───────────────────────────────────────────────────────

export interface PlannedToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface PlanTask {
  id: number;
  name: string;
  type: "read" | "write" | "synthesize";
  tools: PlannedToolCall[];
  dependsOn: number[];
  parallel: boolean;
}

export interface ExecutionPlan {
  analysis: string;
  tasks: PlanTask[];
}

export interface PlanStreamEvent {
  type: "plan" | "task_start" | "task_complete" | "plan_tool_start" | "plan_tool_end";
  plan?: ExecutionPlan;
  taskId?: number;
  taskName?: string;
  toolName?: string;
  durationMs?: number;
  success?: boolean;
}

// ─── WP2: Request Classifier ─────────────────────────────────────

/** Phases where planning adds value */
const PLANNABLE_PHASES = new Set(["spec", "design", "implementation", "testing"]);

/** Phases too lightweight for planning overhead */
const SKIP_PLAN_PHASES = new Set(["scope_selection", "deployment"]);

/** Keywords that indicate a simple query (no planning needed) */
const SIMPLE_QUERY_PATTERNS = [
  /^(list|show|get|what|how many|count|display|tell me)\b/i,
  /^(check|test|verify) connection/i,
  /^approved?$/i,
  /^(yes|no|1|2|3)$/i,
];

/**
 * Determine if a user request needs task planning.
 * Returns false for simple queries that can be handled by a single tool call.
 */
export function shouldPlan(
  userMessage: string,
  phase: string | null | undefined,
  messageCount: number
): boolean {
  // No phase set — user is in free-form mode, likely a simple query
  if (!phase) return false;

  // Skip planning for lightweight phases
  if (phase && SKIP_PLAN_PHASES.has(phase)) return false;

  // Only plan for known phases
  if (phase && !PLANNABLE_PHASES.has(phase)) return false;

  // Short messages are usually simple commands or approvals
  const trimmed = userMessage.trim();
  if (trimmed.length < 25) return false;

  // Simple query patterns don't need planning
  if (SIMPLE_QUERY_PATTERNS.some((p) => p.test(trimmed))) return false;

  // First message in a phase is usually the requirement — plan it
  // Subsequent messages are follow-ups that the reactive loop handles well
  if (messageCount > 4) return false;

  return true;
}

// ─── WP3: Planner Prompt & LLM Call ──────────────────────────────

/** Max tools the planner can include in a single plan */
const MAX_PLAN_TOOLS = 15;

/** Build the planner system prompt — small and focused */
function buildPlannerPrompt(
  phase: string,
  availableToolNames: string[],
  cachedDataSummary: { tool: string; argsPreview: string }[]
): string {
  const cachedInfo = cachedDataSummary.length > 0
    ? `\nAlready cached (do NOT re-fetch):\n${cachedDataSummary.map((c) => `- ${c.tool}(${c.argsPreview})`).join("\n")}`
    : "\nNo cached data yet.";

  return `You are a task planner for a ServiceNow development assistant.
Given a user request and the current SDLC phase, produce a JSON execution plan.

Current phase: ${phase}
Available tools: ${availableToolNames.join(", ")}
${cachedInfo}

Rules:
- Only use tools from the available list above
- Classify each task as "read" (data gathering), "write" (create/update artifacts), or "synthesize" (AI reasoning, no tools)
- Read tasks with no dependencies can have parallel: true — they will execute simultaneously
- Write tasks must list dependsOn IDs for data they need
- If data is already cached, do NOT include a task to re-fetch it
- Keep total tool calls under ${MAX_PLAN_TOOLS}
- Each tool call needs: name (exact tool name) and args (object with required parameters)
- For the ${phase} phase: ${getPhaseGuidance(phase)}

Output ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "analysis": "Brief 1-sentence summary of what needs to happen",
  "tasks": [
    {
      "id": 1,
      "name": "Human-readable task name",
      "type": "read",
      "tools": [{"name": "tool_name", "args": {"key": "value"}}],
      "dependsOn": [],
      "parallel": true
    }
  ]
}`;
}

/** Phase-specific guidance for the planner */
function getPhaseGuidance(phase: string): string {
  switch (phase) {
    case "spec":
      return "Focus on READING existing artifacts (business rules, client scripts, UI policies, table schema) to understand the current state. Do NOT include any write/create tools.";
    case "design":
      return "Focus on READING for discovery — OOTB overrides, conflicts, dependency graphs. Do NOT include any write/create tools. Schema and basic artifact data may already be cached from spec phase.";
    case "implementation":
      return "Include BOTH reads (for verification) and writes (artifact creation). Update set creation must come first. Artifact creation tasks depend on update set. Final verification task depends on all writes.";
    case "testing":
      return "Focus on READING to verify created artifacts work correctly — query records, check field values, validate behavior.";
    default:
      return "Use appropriate read/write tools for the current phase.";
  }
}

// ─── Plan Generation ─────────────────────────────────────────────

/**
 * Generate an execution plan via a single LLM call.
 * Returns null if planning fails (caller should fall back to reactive loop).
 */
export async function generatePlan(
  userMessage: string,
  phase: string,
  availableToolNames: string[],
  sessionCache: SessionCache,
  llmConfig: {
    provider: "anthropic" | "openrouter";
    anthropicApiKey?: string;
    openRouterApiKey?: string;
    model: string;
  },
  sessionId: string
): Promise<ExecutionPlan | null> {
  const startTime = Date.now();
  const plannerPrompt = buildPlannerPrompt(phase, availableToolNames, sessionCache.getSummary());

  try {
    let responseText: string;

    if (llmConfig.provider === "anthropic" && llmConfig.anthropicApiKey) {
      const anthropic = new Anthropic({ apiKey: llmConfig.anthropicApiKey });
      const response = await anthropic.messages.create({
        model: llmConfig.model,
        max_tokens: 2048,
        system: plannerPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      responseText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    } else if (llmConfig.provider === "openrouter" && llmConfig.openRouterApiKey) {
      const orMessages: OpenRouterMessage[] = [
        { role: "system", content: plannerPrompt },
        { role: "user", content: userMessage },
      ];
      const response = await chatCompletion(
        { apiKey: llmConfig.openRouterApiKey, siteName: "Yantra AI Dev Agent" },
        { model: llmConfig.model, messages: orMessages, max_tokens: 2048 }
      );
      responseText = response.choices[0]?.message?.content || "";
    } else {
      logger.warn(sessionId, "planner", "No valid LLM config for planner");
      return null;
    }

    // Parse JSON from response (handle markdown code fences)
    const jsonStr = responseText
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const plan = JSON.parse(jsonStr) as ExecutionPlan;

    // Validate the plan
    const validatedPlan = validatePlan(plan, availableToolNames, phase);
    if (!validatedPlan) {
      logger.warn(sessionId, "planner", "Plan validation failed", { rawResponse: responseText.slice(0, 500) });
      return null;
    }

    const durationMs = Date.now() - startTime;
    logger.info(sessionId, "planner", "Plan generated", {
      taskCount: validatedPlan.tasks.length,
      toolCount: validatedPlan.tasks.reduce((sum, t) => sum + t.tools.length, 0),
      phase,
      durationMs,
      analysis: validatedPlan.analysis,
    });

    return validatedPlan;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logger.warn(sessionId, "planner", "Plan generation failed — falling back to reactive loop", {
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    });
    return null;
  }
}

/** Validate and sanitize a plan against available tools and phase constraints */
function validatePlan(
  plan: ExecutionPlan,
  availableToolNames: string[],
  phase: string
): ExecutionPlan | null {
  if (!plan || !Array.isArray(plan.tasks) || plan.tasks.length === 0) return null;
  if (!plan.analysis || typeof plan.analysis !== "string") {
    plan.analysis = "Executing planned tasks";
  }

  const toolSet = new Set(availableToolNames);
  const isReadOnlyPhase = ["spec", "design", "testing"].includes(phase);

  const validTasks: PlanTask[] = [];
  let totalTools = 0;

  for (const task of plan.tasks) {
    // Ensure required fields
    if (!task.id || !task.name || !task.type) continue;
    if (!Array.isArray(task.tools)) task.tools = [];
    if (!Array.isArray(task.dependsOn)) task.dependsOn = [];
    if (typeof task.parallel !== "boolean") task.parallel = task.type === "read";

    // Filter to only available tools
    const validTools = task.tools.filter((tc) => {
      if (!toolSet.has(tc.name)) return false;
      // Block write tools in read-only phases
      if (isReadOnlyPhase && (tc.name.startsWith("sn_create_") || tc.name.startsWith("sn_update_"))) return false;
      return true;
    });

    // Skip tasks with no valid tools (unless synthesize type)
    if (validTools.length === 0 && task.type !== "synthesize") continue;

    totalTools += validTools.length;
    if (totalTools > MAX_PLAN_TOOLS) break; // Cap total tools

    validTasks.push({ ...task, tools: validTools });
  }

  if (validTasks.length === 0) return null;

  return { analysis: plan.analysis, tasks: validTasks };
}

// ─── WP4: Parallel Execution Engine ──────────────────────────────

/** Max concurrent ServiceNow API calls to avoid rate limiting */
const MAX_PARALLEL_CALLS = 4;

/** Tool execution function signature (matches sn-engine's executeAndLogTool) */
export type ToolExecutor = (
  toolName: string,
  args: unknown,
) => Promise<{ result: unknown; durationMs: number; success: boolean }>;

/**
 * Execute a plan's read-only tasks, yielding SSE events for UI progress.
 * Write and synthesize tasks are skipped — they'll be handled by the reactive loop.
 *
 * Returns gathered data that should be injected into the AI's context.
 */
export async function* executePlan(
  plan: ExecutionPlan,
  executor: ToolExecutor,
  sessionCache: SessionCache,
  sessionId: string
): AsyncGenerator<PlanStreamEvent, Map<string, unknown>> {
  // Emit the plan to the UI
  yield { type: "plan", plan };

  const results = new Map<string, unknown>();
  const completedTaskIds = new Set<number>();

  // Resolve dependency levels — group tasks by execution order
  const levels = resolveDependencyLevels(plan.tasks);

  for (const level of levels) {
    // Separate read tasks (auto-execute) from others (skip for reactive loop)
    const readTasks = level.filter((t) => t.type === "read");
    const otherTasks = level.filter((t) => t.type !== "read");

    // Mark non-read tasks as completed (they'll be handled by reactive loop)
    for (const task of otherTasks) {
      completedTaskIds.add(task.id);
    }

    if (readTasks.length === 0) continue;

    // Check if all dependencies are met
    const executableTasks = readTasks.filter((t) =>
      t.dependsOn.every((dep) => completedTaskIds.has(dep))
    );

    // Execute in parallel batches
    for (let i = 0; i < executableTasks.length; i += MAX_PARALLEL_CALLS) {
      const batch = executableTasks.slice(i, i + MAX_PARALLEL_CALLS);

      // Start all tasks in this batch
      for (const task of batch) {
        yield { type: "task_start", taskId: task.id, taskName: task.name };
      }

      // Execute all tool calls in the batch in parallel
      const batchPromises = batch.flatMap((task) =>
        task.tools.map(async (toolCall) => {
          // Check cache first
          const cached = sessionCache.get(toolCall.name, toolCall.args);
          if (cached !== undefined) {
            logger.info(sessionId, "cache", "Cache hit — skipping tool call", { tool: toolCall.name });
            return { task, toolCall, result: cached, durationMs: 0, success: true, fromCache: true };
          }

          const startTime = Date.now();
          try {
            const { result, durationMs, success } = await executor(toolCall.name, toolCall.args);
            // Cache the result
            sessionCache.set(toolCall.name, toolCall.args, result);
            return { task, toolCall, result, durationMs, success, fromCache: false };
          } catch (err) {
            const durationMs = Date.now() - startTime;
            logger.warn(sessionId, "planner", `Read task tool failed: ${toolCall.name}`, {
              error: err instanceof Error ? err.message : String(err),
              durationMs,
            });
            return { task, toolCall, result: null, durationMs, success: false, fromCache: false };
          }
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Yield tool-level events and collect results
      for (const settledResult of batchResults) {
        if (settledResult.status === "fulfilled") {
          const { task, toolCall, result, durationMs, success, fromCache } = settledResult.value;
          if (!fromCache) {
            yield { type: "plan_tool_start", taskId: task.id, toolName: toolCall.name };
            yield { type: "plan_tool_end", taskId: task.id, toolName: toolCall.name, durationMs, success };
          }
          // Store result keyed by tool call for injection
          const resultKey = `${toolCall.name}::${JSON.stringify(toolCall.args)}`;
          results.set(resultKey, result);
        }
      }

      // Mark tasks in this batch as complete
      for (const task of batch) {
        completedTaskIds.add(task.id);
        yield { type: "task_complete", taskId: task.id, taskName: task.name };
      }
    }
  }

  logger.info(sessionId, "planner", "Plan execution complete", {
    totalResults: results.size,
    cachedHits: plan.tasks
      .filter((t) => t.type === "read")
      .flatMap((t) => t.tools)
      .filter((tc) => sessionCache.get(tc.name, tc.args) !== undefined).length,
  });

  return results;
}

/**
 * Resolve tasks into dependency levels for ordered execution.
 * Level 0 = no dependencies, Level 1 = depends on Level 0, etc.
 */
function resolveDependencyLevels(tasks: PlanTask[]): PlanTask[][] {
  const levels: PlanTask[][] = [];
  const assigned = new Set<number>();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  let remaining = [...tasks];
  let maxIterations = tasks.length + 1; // Prevent infinite loops

  while (remaining.length > 0 && maxIterations-- > 0) {
    const currentLevel: PlanTask[] = [];

    for (const task of remaining) {
      const depsResolved = task.dependsOn.every((dep) => assigned.has(dep));
      if (depsResolved) {
        currentLevel.push(task);
      }
    }

    if (currentLevel.length === 0) {
      // Circular dependency or unresolvable — push all remaining to final level
      levels.push(remaining);
      break;
    }

    levels.push(currentLevel);
    for (const task of currentLevel) {
      assigned.add(task.id);
    }
    remaining = remaining.filter((t) => !assigned.has(t.id));
  }

  return levels;
}

/**
 * Format gathered data for injection into the AI's context.
 * Produces a structured text block that tells the AI what data is already available.
 */
export function formatGatheredData(results: Map<string, unknown>): string {
  if (results.size === 0) return "";

  const sections: string[] = [
    "[SYSTEM: The following data was pre-fetched by the task planner. Do NOT re-query this information — use it directly.]",
    "",
  ];

  for (const [key, value] of results) {
    const [toolName, argsJson] = key.split("::");
    sections.push(`--- ${toolName} (${argsJson?.slice(0, 80) || "no args"}) ---`);
    sections.push(typeof value === "string" ? value : JSON.stringify(value, null, 1));
    sections.push("");
  }

  // Cap total length to avoid context overflow
  const full = sections.join("\n");
  if (full.length > 50_000) {
    return full.slice(0, 50_000) + "\n[... truncated to 50k chars]";
  }
  return full;
}

