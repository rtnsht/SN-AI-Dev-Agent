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

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  let sessionId: string = 'unknown'; // Declare outside try block for error handler access

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

    // Resolve API key based on provider
    // ALLOW_USER_API_KEYS controls whether users can supply their own API keys.
    // Default: true (users can bring their own keys for unlimited access).
    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
    let userSuppliedKey = false;

    if (credentials.aiProvider === "openrouter") {
      const userProvidedOpenRouterKey = allowUserKeys && !!credentials.openRouterApiKey;
      const openRouterKey = (allowUserKeys ? credentials.openRouterApiKey : "") || process.env.OPENROUTER_API_KEY || "";
      if (!openRouterKey) {
        logger.error(sessionId, "validation", "No OpenRouter API key available");
        return new Response(
          JSON.stringify({ error: "No OpenRouter API key available" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      credentials.openRouterApiKey = openRouterKey;
      userSuppliedKey = userProvidedOpenRouterKey;
    } else {
      userSuppliedKey = allowUserKeys && !!credentials.claudeApiKey;
      const claudeApiKey = (allowUserKeys ? credentials.claudeApiKey : "") || process.env.CLAUDE_API_KEY || "";
      if (!claudeApiKey) {
        logger.error(sessionId, "validation", "No Claude API key available", { userSuppliedKey, allowUserKeys });
        return new Response(
          JSON.stringify({ error: "No Claude API key available" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      credentials.claudeApiKey = claudeApiKey;
    }

    // 3-tier access check: anonymous (IP) → authenticated (user) → BYOK (unlimited)
    const userId = request.headers.get("x-user-id");
    try {
      const access = await checkAccess(ip, userId, userSuppliedKey, credentials.instanceUrl);
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

    const selectedModel = model || "claude-sonnet-4-6";

    // Prevent Cost Exhaustion: Whitelist models when using the server's OpenRouter key
    if (credentials.aiProvider === "openrouter" && !userSuppliedKey) {
      const allowedServerModels = [
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3-haiku",
        "google/gemini-1.5-flash",
        "google/gemini-2.0-flash-001",
        "meta-llama/llama-3.1-8b-instruct",
        "meta-llama/llama-3.1-70b-instruct"
      ];
      if (!allowedServerModels.includes(selectedModel)) {
        logger.error(sessionId, "validation", "Unauthorized model requested with server key", { model: selectedModel });
        return new Response(
          JSON.stringify({ error: "The requested model is not allowed when using the server's API key. Please provide your own OpenRouter key for this model." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Update session_logs.model to reflect the actual model used in this chat
    // (may differ from what was set at connect time if user changed the dropdown)
    if (sessionId && sessionId !== "unknown") {
      try {
        const query = getSupabase().from("session_logs")
          .update({ model: selectedModel, updated_at: new Date().toISOString() })
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
      model: selectedModel,
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

        // SSE heartbeat keepalive — prevents idle connection timeout on proxies/platforms (e.g. Render)
        const HEARTBEAT_INTERVAL_MS = 15_000;
        const heartbeatPayload = encoder.encode(": heartbeat\n\n");
        const heartbeatInterval = setInterval(() => {
          safeEnqueue(heartbeatPayload);
        }, HEARTBEAT_INTERVAL_MS);

        try {
          for await (const event of chatStream(credentials, chatMessages, selectedModel, 30, sessionId, effectivePhase, abortController.signal, sddPolicy.sddActive)) {
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

          const errorEvent = `data: ${JSON.stringify({
            type: "error",
            message: "Stream request failed",
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

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
