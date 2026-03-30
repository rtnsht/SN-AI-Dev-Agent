import { NextRequest } from "next/server";
import { chatStreamQuickAgent, type ChatMessage } from "@/lib/sn-engine";
import { checkAccess } from "@/lib/access-tier";
import { logger, generateSessionId } from "@/lib/logger";
import { normalizeServiceNowAuthMethod, validateServiceNowCredentials } from "@/lib/servicenow-auth";
import { getClientIp } from "@/lib/client-ip";
import { parseChatBody } from "@/lib/request-validation";
import { incrementModelAccessUsage, resolveModelExecution } from "@/lib/model-platform";
import { touchUserApiKey } from "@/lib/user-api-keys";

export const maxDuration = 120; // 2 minutes max for quick queries

/**
 * Quick Agent Stream API
 *
 * Lightweight read-only agent for quick queries.
 * Uses only quick_query tools, 5-round max, no SDD phases.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  let sessionId: string = "unknown";
  let userSuppliedKey = false;

  try {
    const body = await request.json();
    const parsed = parseChatBody(body);
    if (!parsed.ok) {
      return new Response(
        JSON.stringify({ error: parsed.error }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { credentials, messages, model, aiProvider, sessionId: clientSessionId } = parsed.data;

    // Use client-provided session ID or generate a new one
    sessionId = clientSessionId || generateSessionId();

    const authType = normalizeServiceNowAuthMethod(credentials.snAuthType);
    credentials.snAuthType = authType;

    // Set AI provider
    credentials.aiProvider = aiProvider || "anthropic";

    // Validate ServiceNow credentials
    const snValidationError = validateServiceNowCredentials(credentials, {
      serverBasicConfigured: false,
      requireUsernameForBasic: true,
    });

    if (snValidationError) {
      logger.error(sessionId, "quick_agent_validation", "Missing credentials", { ip, authType });
      return new Response(
        JSON.stringify({ error: snValidationError }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = request.headers.get("x-user-id") || undefined;
    const selectedModel = model || "claude-sonnet-4-6";

    // Quick agent remains Anthropic-only, but model access still resolves through the catalog.
    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
    const modelResolution = await resolveModelExecution({
      userId,
      sessionId,
      modelIdentifier: selectedModel,
      inlineUserKey: allowUserKeys ? credentials.claudeApiKey || "" : "",
      allowUserKeys,
    });

    if (modelResolution.model?.transport === "openrouter") {
      return new Response(
        JSON.stringify({ error: "Quick agent only supports Anthropic-transport models. Please switch to a Claude model in settings." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!modelResolution.allowed || !modelResolution.model || !modelResolution.apiKey) {
      logger.error(sessionId, "quick_agent_validation", "Model execution access denied", {
        model: selectedModel,
        allowUserKeys,
        reason: modelResolution.error,
      });
      return new Response(
        JSON.stringify({
          error: modelResolution.error || "The selected model is unavailable.",
          code: "model_access",
          allowUserApiKeys: allowUserKeys,
          remainingQuota: modelResolution.remainingQuota ?? null,
        }),
        { status: modelResolution.status, headers: { "Content-Type": "application/json" } }
      );
    }

    credentials.aiProvider = "anthropic";
    credentials.claudeApiKey = modelResolution.apiKey;
    userSuppliedKey = modelResolution.userSuppliedKey;

    // 3-tier access check: anonymous (IP) -> authenticated (user) -> BYOK (unlimited)
    try {
      const access = await checkAccess(ip, userId ?? null, userSuppliedKey, credentials.instanceUrl);
      if (!access.allowed) {
        logger.warn(sessionId, "quick_agent_access", `Access denied: ${access.gate}`, {
          tier: access.tier,
          dailyUsed: access.dailyUsed,
          dailyLimit: access.dailyLimit,
          ip,
          userId,
        });
        return new Response(
          JSON.stringify({
            error: access.gate === "signup" ? "signup_required" : "apikey_required",
            gate: access.gate,
            message: access.message,
            tier: access.tier,
            dailyUsed: access.dailyUsed,
            dailyLimit: access.dailyLimit,
            allowUserApiKeys: allowUserKeys,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (accessErr) {
      logger.error(sessionId, "quick_agent_access", "Access check failed, denying request", { error: String(accessErr) });
      return new Response(
        JSON.stringify({
          error: "access_check_unavailable",
          message: "Access verification is temporarily unavailable. Please retry shortly.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error(sessionId, "quick_agent_validation", "Messages array is required");
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const chatMessages: ChatMessage[] = messages.map((m: { role: string; content: string; images?: string[]; timestamp?: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      ...(m.images?.length ? { images: m.images } : {}),
      ...(m.timestamp ? { timestamp: m.timestamp } : {}),
    }));

    const executableModel = modelResolution.model.apiModelId || modelResolution.model.modelId;

    if (modelResolution.accessSource === "free_rule" && userId && modelResolution.ruleId) {
      await incrementModelAccessUsage({
        ruleId: modelResolution.ruleId,
        userId,
        modelConfigId: modelResolution.model.modelConfigId,
      });
    }

    if (modelResolution.storedKeyId) {
      await touchUserApiKey(modelResolution.storedKeyId);
    }

    logger.info(sessionId, "quick_agent_stream", "Starting quick agent stream request", {
      messageCount: chatMessages.length,
      keyType: userSuppliedKey ? "user" : "server",
      model: executableModel,
    });

    const startTime = Date.now();

    // AbortController to propagate client disconnect into the generator
    const abortController = new AbortController();
    request.signal.addEventListener("abort", () => abortController.abort(), { once: true });

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let toolCount = 0;
        let controllerClosed = false;

        const safeEnqueue = (chunk: Uint8Array) => {
          if (controllerClosed) return;
          try {
            controller.enqueue(chunk);
          } catch {
            controllerClosed = true;
          }
        };

        const safeClose = () => {
          if (controllerClosed) return;
          try {
            controller.close();
            controllerClosed = true;
          } catch {
            controllerClosed = true;
          }
        };

        // SSE heartbeat keepalive
        const HEARTBEAT_INTERVAL_MS = 15_000;
        const heartbeatPayload = encoder.encode(": heartbeat\n\n");
        const heartbeatInterval = setInterval(() => {
          safeEnqueue(heartbeatPayload);
        }, HEARTBEAT_INTERVAL_MS);

        try {
          for await (const event of chatStreamQuickAgent(credentials, chatMessages, executableModel, sessionId, abortController.signal)) {
            if (event.type === "tool_end") toolCount++;
            const data = `data: ${JSON.stringify(event)}\n\n`;
            safeEnqueue(encoder.encode(data));
          }

          const durationMs = Date.now() - startTime;
          logger.info(sessionId, "quick_agent_stream", "Quick agent stream completed", { toolCount, durationMs });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.error(sessionId, "quick_agent_stream", "Stream error", { error: errorMsg });

          const errorEvent = `data: ${JSON.stringify({
            type: "error",
            message: "Stream request failed",
          })}\n\n`;
          safeEnqueue(encoder.encode(errorEvent));
        } finally {
          clearInterval(heartbeatInterval);
          safeClose();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Internal server error";
    logger.error(sessionId, "quick_agent_stream", "Quick agent stream API error", {
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    });

    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";

    if (errorMsg === "anthropic_rate_limit") {
      return new Response(
        JSON.stringify({
          error: "provider_rate_limit",
          code: "provider_rate_limit",
          message: "Claude API rate limit exceeded after retries.",
          usedServerKey: !userSuppliedKey,
          allowUserApiKeys: allowUserKeys,
          retryable: true,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMsg.includes("authentication") || errorMsg.includes("401") || errorMsg.includes("invalid x-api-key")) {
      return new Response(
        JSON.stringify({
          error: "provider_auth",
          code: "provider_auth",
          message: "API key authentication failed.",
          usedServerKey: !userSuppliedKey,
          allowUserApiKeys: allowUserKeys,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
