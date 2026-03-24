import { NextRequest, NextResponse } from "next/server";
import { chat, type ChatMessage } from "@/lib/sn-engine";
import { checkAccess } from "@/lib/access-tier";
import { logger, generateSessionId } from "@/lib/logger";
import { getSupabase } from "@/lib/supabase";
import { resolvePolicy, resolvePhase, isValidPhase, SDD_GLOBAL_DEFAULT } from "@/lib/sdd-policy";
import { normalizeServiceNowAuthMethod, validateServiceNowCredentials } from "@/lib/servicenow-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/client-ip";
import { parseChatBody } from "@/lib/request-validation";
import { resolveLlmApiKey } from "@/lib/key-resolver";

export const maxDuration = 300; // Allow up to 5 minutes for tool-use loops

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  let sessionId = "unknown";
  let userSuppliedKey = false;

  try {
    const body = await request.json();
    const parsed = parseChatBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
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
      return NextResponse.json({ error: "Invalid SDLC phase" }, { status: 400 });
    }

    const sddPolicy = resolvePolicy({
      sessionOverride: clientSddMode ?? null,
      globalDefault: SDD_GLOBAL_DEFAULT,
    });
    const effectivePhase = resolvePhase(sddPolicy, phase);

    // Use client-provided session ID to maintain same log file throughout chat session
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
        return NextResponse.json(
          { error: "Admin authorization required for server credentials" },
          { status: 403 }
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

    // Validate required fields
    const snValidationError = validateServiceNowCredentials(credentials, {
      serverBasicConfigured: canUseServerCreds && Boolean(process.env.SN_PASSWORD),
      requireUsernameForBasic: true,
    });

    if (snValidationError) {
      logger.error(sessionId, "validation", "Missing credentials", { ip, authType });
      return NextResponse.json(
        { error: snValidationError },
        { status: 400 }
      );
    }

    // Resolve API key via pool + BYOK + env fallback
    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
    const provider = credentials.aiProvider === "openrouter" ? "openrouter" as const : "anthropic" as const;
    const userKey = provider === "openrouter"
      ? (allowUserKeys ? credentials.openRouterApiKey || "" : "")
      : (allowUserKeys ? credentials.claudeApiKey || "" : "");

    const resolved = resolveLlmApiKey(sessionId, provider, userKey, allowUserKeys);
    if (!resolved) {
      const label = provider === "openrouter" ? "OpenRouter" : "Claude";
      logger.error(sessionId, "validation", `No ${label} API key available`, { provider, allowUserKeys });
      return NextResponse.json(
        { error: allowUserKeys
            ? `No ${label} API key available. Either provide one in settings or ask the admin to configure a server-side key.`
            : `No ${label} API key configured on the server. Please contact the admin.` },
        { status: 400 }
      );
    }

    if (provider === "openrouter") {
      credentials.openRouterApiKey = resolved.apiKey;
    } else {
      credentials.claudeApiKey = resolved.apiKey;
    }
    userSuppliedKey = resolved.userSuppliedKey;

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
        return NextResponse.json(
          {
            error: access.gate === "signup" ? "signup_required" : "apikey_required",
            gate: access.gate,
            message: access.message,
            tier: access.tier,
            dailyUsed: access.dailyUsed,
            dailyLimit: access.dailyLimit,
            anonUsed: access.anonUsed,
            authUsed: access.authUsed,
            allowUserApiKeys: allowUserKeys,
          },
          { status: 429 }
        );
      }
    } catch (accessErr) {
      logger.error(sessionId, "access_tier", "Access check failed, denying request", { error: String(accessErr) });
      return NextResponse.json(
        {
          error: "access_check_unavailable",
          message: "Access verification is temporarily unavailable. Please retry shortly.",
        },
        { status: 503 }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error(sessionId, "validation", "Messages array is required and must not be empty");
      return NextResponse.json(
        { error: "Messages array is required and must not be empty." },
        { status: 400 }
      );
    }

    // Pass through images and timestamps from each message (base64 data URIs)
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
        return NextResponse.json(
          { error: "The requested model is not allowed when using the server's API key. Please provide your own OpenRouter key for this model." },
          { status: 403 }
        );
      }
    }

    // Update session_logs.model to reflect the actual model used in this chat
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

    const imageCount = chatMessages.reduce((acc, m) => acc + (m.images?.length || 0), 0);

    // Log per-message timestamps for audit trail
    const messageTimestamps = chatMessages.map((m, i) => ({
      index: i,
      role: m.role,
      timestamp: m.timestamp || null,
    }));

    logger.info(sessionId, "chat", "Starting chat request", {
      messageCount: chatMessages.length,
      imageCount,
      keyType: userSuppliedKey ? "user" : "server",
      model: selectedModel,
      messageTimestamps,
    });

    const startTime = Date.now();
    const result = await chat(credentials, chatMessages, selectedModel, sessionId, effectivePhase);
    const durationMs = Date.now() - startTime;

    const responseTimestamp = new Date().toISOString();
    logger.info(sessionId, "chat", "Chat request completed", {
      toolCount: result.toolExecutions?.length ?? 0,
      durationMs,
      responseTimestamp,
    });

    // Don't end session - client may send more requests in this session

    // Include usage info and response timestamp so frontend can capture it
    return NextResponse.json({ ...result, responseTimestamp });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    logger.error(sessionId, "chat", "Chat API error", {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";

    // Unified provider error taxonomy — same shape for chat and chat-stream
    if (message === "anthropic_rate_limit") {
      logger.error(sessionId, "claude_api", "Anthropic rate limit exceeded after retries");
      return NextResponse.json(
        {
          error: "provider_rate_limit",
          code: "provider_rate_limit",
          message: "Claude API rate limit exceeded after retries.",
          usedServerKey: !userSuppliedKey,
          allowUserApiKeys: allowUserKeys,
          retryable: true,
        },
        { status: 429 }
      );
    }

    if (message.includes("authentication") || message.includes("401") || message.includes("invalid x-api-key")) {
      logger.error(sessionId, "auth", "Authentication failed", { error: message });
      return NextResponse.json(
        {
          error: "provider_auth",
          code: "provider_auth",
          message: "API key authentication failed.",
          usedServerKey: !userSuppliedKey,
          allowUserApiKeys: allowUserKeys,
        },
        { status: 401 }
      );
    }

    if (message.includes("402") || message.includes("billing") || message.includes("insufficient_quota")) {
      logger.error(sessionId, "billing", "Provider billing error", { error: message });
      return NextResponse.json(
        {
          error: "provider_billing",
          code: "provider_billing",
          message: "API key billing limit reached.",
          usedServerKey: !userSuppliedKey,
          allowUserApiKeys: allowUserKeys,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

