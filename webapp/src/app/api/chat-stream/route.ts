import { NextRequest } from "next/server";
import { chatStream, type ChatMessage } from "@/lib/sn-engine";
import { checkAccess } from "@/lib/access-tier";
import { logger, generateSessionId } from "@/lib/logger";
import { getSupabase } from "@/lib/supabase";
import { resolvePolicy, resolvePhase, isValidPhase, SDD_GLOBAL_DEFAULT } from "@/lib/sdd-policy";
import { normalizeServiceNowAuthMethod, validateServiceNowCredentials } from "@/lib/servicenow-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/client-ip";
import { parseChatBody } from "@/lib/request-validation";
import { incrementModelAccessUsage, resolveModelExecution } from "@/lib/model-platform";
import { touchUserApiKey } from "@/lib/user-api-keys";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  let sessionId: string = 'unknown';
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
    const {
      credentials,
      messages,
      model,
      aiProvider,
      sessionId: clientSessionId,
      phase,
      sddMode: clientSddMode,
      toolSelection,
    } = parsed.data;

    // Reject invalid phase before policy resolution
    if (phase && !isValidPhase(phase)) {
      logger.warn(sessionId, "phase_violation", `Invalid phase value: ${phase}`, { sddMode: clientSddMode });
      return new Response(
        JSON.stringify({ error: "Invalid SDLC phase" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const sddPolicy = resolvePolicy({
      sessionOverride: clientSddMode ?? null,
      globalDefault: SDD_GLOBAL_DEFAULT,
    });
    const effectivePhase = resolvePhase(sddPolicy, phase);

    // Use client-provided session ID to maintain same log file throughout chat session
    // Fall back to generating a new one if client didn't provide one
    sessionId = clientSessionId || generateSessionId();

    const authType = normalizeServiceNowAuthMethod(credentials.snAuthType);
    credentials.snAuthType = authType;

    const wantsServerBasicFallback =
      authType === "basic" &&
      (!credentials.instanceUrl || !credentials.username || !credentials.password);

    let canUseServerCreds = false;
    if (wantsServerBasicFallback) {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) {
        return new Response(
          JSON.stringify({ error: "Admin authorization required for server credentials" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      canUseServerCreds = true;
    }

    // Fall back to server-side env vars only for admin-approved legacy basic auth.
    if (!credentials.instanceUrl && canUseServerCreds) credentials.instanceUrl = process.env.SN_INSTANCE_URL || "";
    if (authType === "basic" && canUseServerCreds) {
      if (!credentials.username) credentials.username = process.env.SN_USERNAME || "";
      if (!credentials.password) credentials.password = process.env.SN_PASSWORD || "";
    }

    // Set AI provider
    credentials.aiProvider = aiProvider || "anthropic";

    // Note: We don't call createSession() because in serverless/edge environments,
    // in-memory state doesn't persist across requests. Instead, we log directly
    // using the client-provided sessionId, which ensures all logs for a browser
    // session go to the same file (filename is derived deterministically from sessionId).

    const snValidationError = validateServiceNowCredentials(credentials, {
      serverBasicConfigured: canUseServerCreds && Boolean(process.env.SN_PASSWORD),
      requireUsernameForBasic: true,
    });

    if (snValidationError) {
      logger.error(sessionId, "validation", "Missing credentials", { ip, authType });
      return new Response(
        JSON.stringify({ error: snValidationError }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = request.headers.get("x-user-id") || undefined;
    const selectedModel = model || "claude-sonnet-4-6";

    // Resolve the selected model against the transport-aware catalog.
    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
    const inlineUserKey = credentials.aiProvider === "openrouter"
      ? (allowUserKeys ? credentials.openRouterApiKey || "" : "")
      : (allowUserKeys ? credentials.claudeApiKey || "" : "");

    const modelResolution = await resolveModelExecution({
      userId,
      sessionId,
      modelIdentifier: selectedModel,
      inlineUserKey,
      allowUserKeys,
    });

    if (!modelResolution.allowed || !modelResolution.model || !modelResolution.apiKey) {
      logger.error(sessionId, "validation", "Model execution access denied", {
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

    credentials.aiProvider = modelResolution.model.transport;

    if (modelResolution.model.transport === "openrouter") {
      credentials.openRouterApiKey = modelResolution.apiKey;
    } else {
      credentials.claudeApiKey = modelResolution.apiKey;
    }
    userSuppliedKey = modelResolution.userSuppliedKey;

    // 3-tier access check: anonymous (IP) → authenticated (user) → BYOK (unlimited)
    try {
      const access = await checkAccess(ip, userId ?? null, userSuppliedKey, credentials.instanceUrl);
      if (!access.allowed) {
        logger.warn(sessionId, "access_tier", `Access denied: ${access.gate}`, {
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
            anonUsed: access.anonUsed,
            authUsed: access.authUsed,
            allowUserApiKeys: allowUserKeys,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (accessErr) {
      logger.error(sessionId, "access_tier", "Access check failed, denying request", { error: String(accessErr) });
      return new Response(
        JSON.stringify({
          error: "access_check_unavailable",
          message: "Access verification is temporarily unavailable. Please retry shortly.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error(sessionId, "validation", "Messages array is required");
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

    // Update session_logs.model to reflect the actual model used in this chat
    // (may differ from what was set at connect time if user changed the dropdown)
    if (sessionId && sessionId !== "unknown") {
      try {
        const query = getSupabase().from("session_logs")
          .update({ model: executableModel, updated_at: new Date().toISOString() })
          .eq("session_id", sessionId);
        
        // Prevent IDOR: ensure we only update if the session belongs to the caller
        if (userId) {
          query.eq("user_id", userId);
        } else {
          query.is("user_id", null);
        }
        
        void query.then(() => {});
      } catch { /* non-blocking */ }
    }

    // Log SDD enforcement decision
    if (sddPolicy.sddActive) {
      logger.info(sessionId, "sdd_mode", "SDD enforcement active", {
        clientPhase: phase || null,
        effectivePhase,
        enforcementLevel: sddPolicy.enforcementLevel,
        reason: sddPolicy.reason,
      });
    }

    const imageCount = chatMessages.reduce((acc, m) => acc + (m.images?.length || 0), 0);

    // Log per-message timestamps for audit trail
    const messageTimestamps = chatMessages.map((m, i) => ({
      index: i,
      role: m.role,
      timestamp: m.timestamp || null,
    }));

    logger.info(sessionId, "chat_stream", "Starting streaming chat request", {
      messageCount: chatMessages.length,
      imageCount,
      keyType: userSuppliedKey ? "user" : "server",
      model: executableModel,
      messageTimestamps,
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

        // SSE heartbeat keepalive — prevents idle connection timeout on proxies/platforms (e.g. DigitalOcean App Platform)
        const HEARTBEAT_INTERVAL_MS = 15_000;
        const heartbeatPayload = encoder.encode(": heartbeat\n\n");
        const heartbeatInterval = setInterval(() => {
          safeEnqueue(heartbeatPayload);
        }, HEARTBEAT_INTERVAL_MS);

        try {
          for await (const event of chatStream(
            credentials,
            chatMessages,
            executableModel,
            30,
            sessionId,
            effectivePhase,
            abortController.signal,
            sddPolicy.sddActive,
            toolSelection
          )) {
            if (event.type === "tool_end") toolCount++;
            const data = `data: ${JSON.stringify(event)}\n\n`;
            safeEnqueue(encoder.encode(data));
          }

          const durationMs = Date.now() - startTime;
          logger.info(sessionId, "chat_stream", "Streaming chat completed", { toolCount, durationMs });
          // Don't end session on success - client may send more requests in this session
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.error(sessionId, "chat_stream", "Stream error", { error: errorMsg });

          const lowerErr = errorMsg.toLowerCase();
          const isAuthError = lowerErr.includes("authentication") || (lowerErr.includes("invalid") && lowerErr.includes("api key")) || lowerErr.includes("unauthorized") || lowerErr.includes("401");
          const isBillingError = lowerErr.includes("billing") || lowerErr.includes("insufficient") || lowerErr.includes("402") || lowerErr.includes("payment required");
          const isRateLimit = lowerErr.includes("rate limit") || lowerErr.includes("429") || lowerErr.includes("too many requests");

          let userMessage = "Stream request failed";
          if (isAuthError) {
            userMessage = "API authentication failed. Please check your API key in Settings.";
          } else if (isBillingError) {
            userMessage = "Insufficient API credits. Check your balance and add funds, or switch to a different API key.";
          } else if (isRateLimit) {
            userMessage = "Rate limit exceeded after retries. Please wait a moment and try again.";
          }

          const errorEvent = `data: ${JSON.stringify({
            type: "error",
            message: userMessage,
          })}\n\n`;
          safeEnqueue(encoder.encode(errorEvent));
          // Don't end session on stream error - client may retry
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
    logger.error(sessionId, "chat_stream", "Chat stream API error", {
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

    if (errorMsg.includes("402") || errorMsg.includes("billing") || errorMsg.includes("insufficient_quota")) {
      return new Response(
        JSON.stringify({
          error: "provider_billing",
          code: "provider_billing",
          message: "Your API key has insufficient credits. Check your balance and add funds to continue.",
          usedServerKey: !userSuppliedKey,
          allowUserApiKeys: allowUserKeys,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
