import { NextRequest, NextResponse } from "next/server";
import { chat, type UserCredentials, type ChatMessage } from "@/lib/sn-engine";
import { consume, getUsage } from "@/lib/rate-limiter";
import { checkTrialLimit, consumeTrialRequest } from "@/lib/trial-limiter";
import { logger, generateSessionId } from "@/lib/logger";

export const maxDuration = 120; // Allow up to 2 minutes for tool-use loops

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  let sessionId = "unknown";

  try {
    const body = await request.json();
    const { credentials, messages, model, aiProvider, sessionId: clientSessionId, phase } = body as {
      credentials: UserCredentials;
      messages: ChatMessage[];
      model?: string;
      aiProvider?: "anthropic" | "openrouter";
      sessionId?: string;
      phase?: string;
    };

    // Use client-provided session ID to maintain same log file throughout chat session
    sessionId = clientSessionId || generateSessionId();

    // Fall back to server-side env vars for ServiceNow credentials
    if (!credentials.instanceUrl) credentials.instanceUrl = process.env.SN_INSTANCE_URL || "";
    if (!credentials.username) credentials.username = process.env.SN_USERNAME || "";
    if (!credentials.password) credentials.password = process.env.SN_PASSWORD || "";

    // Set AI provider
    credentials.aiProvider = aiProvider || "anthropic";

    // Note: We don't call createSession() because in serverless/edge environments,
    // in-memory state doesn't persist across requests. Instead, we log directly
    // using the client-provided sessionId, which ensures all logs for a browser
    // session go to the same file (filename is derived deterministically from sessionId).

    // Validate required fields
    if (!credentials.instanceUrl || !credentials.username || !credentials.password) {
      logger.error(sessionId, "validation", "Missing credentials", { ip });
      return NextResponse.json(
        { error: "Missing credentials. Provide instanceUrl, username, and password." },
        { status: 400 }
      );
    }

    // Resolve API key based on provider
    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
    let userSuppliedKey = false;

    if (credentials.aiProvider === "openrouter") {
      // OpenRouter: use user-supplied key or server env var
      const openRouterKey = (allowUserKeys ? credentials.openRouterApiKey : "") || process.env.OPENROUTER_API_KEY || "";
      if (!openRouterKey) {
        logger.error(sessionId, "validation", "No OpenRouter API key available");
        return NextResponse.json(
          { error: "No OpenRouter API key available. Provide one in settings or ask admin to configure it." },
          { status: 400 }
        );
      }
      credentials.openRouterApiKey = openRouterKey;
      userSuppliedKey = allowUserKeys && !!credentials.openRouterApiKey;
    } else {
      // Anthropic: use user-supplied key or server env var
      userSuppliedKey = allowUserKeys && !!credentials.claudeApiKey;
      const claudeApiKey = (allowUserKeys ? credentials.claudeApiKey : "") || process.env.CLAUDE_API_KEY || "";
      if (!claudeApiKey) {
        logger.error(sessionId, "validation", "No Claude API key available", { userSuppliedKey, allowUserKeys });
        return NextResponse.json(
          { error: allowUserKeys
              ? "No Claude API key available. Either provide one in settings or ask the admin to configure a server-side key."
              : "No Claude API key configured on the server. Please contact the admin." },
          { status: 400 }
        );
      }
      credentials.claudeApiKey = claudeApiKey;
    }

    // Rate limiting — only applies when using the server-provided key
    let usageInfo = null;

    if (!userSuppliedKey && process.env.CLAUDE_API_KEY) {
      const { allowed, usage } = consume(ip);
      usageInfo = usage;

      if (!allowed) {
        logger.warn(sessionId, "rate_limit", "Server API key rate limit exceeded", {
          used: usage.used,
          max: usage.max,
          windowHours: usage.windowHours,
          ip,
        });
        return NextResponse.json(
          {
            error: "rate_limit_exceeded",
            message: allowUserKeys
              ? `You've used all ${usage.max} free requests for this ${usage.windowHours}-hour window. Enter your own Claude API key to continue chatting with no limits.`
              : `You've used all ${usage.max} requests for this ${usage.windowHours}-hour window. Please try again later.`,
            usage,
            allowUserApiKeys: allowUserKeys,
          },
          { status: 429 }
        );
      }
    }

    // Trial limit check (per-user daily limits)
    if (!userSuppliedKey) {
      const userId = request.headers.get("x-user-id");
      if (userId) {
        try {
          const { allowed, status: trialStatus } = await checkTrialLimit(userId, credentials.instanceUrl);
          if (!allowed && trialStatus.isConfigured) {
            const reason = trialStatus.trialExpired
              ? `Your ${trialStatus.trialDays}-day free trial has ended.`
              : `You've used all ${trialStatus.dailyLimit} free requests for today.`;
            logger.warn(sessionId, "trial_limit", reason, {
              userId,
              dailyUsed: trialStatus.dailyUsed,
              dailyLimit: trialStatus.dailyLimit,
              daysLeft: trialStatus.daysLeft,
            });
            return NextResponse.json(
              {
                error: "trial_limit_exceeded",
                message: allowUserKeys
                  ? `${reason} Connect your own API key to continue with no limits.`
                  : `${reason} Please try again tomorrow.`,
                trialStatus,
                allowUserApiKeys: allowUserKeys,
              },
              { status: 429 }
            );
          }
          if (trialStatus.isConfigured) {
            await consumeTrialRequest(userId, credentials.instanceUrl);
          }
        } catch (trialErr) {
          logger.warn(sessionId, "trial_limit", "Trial check failed, allowing request", { error: String(trialErr) });
        }
      }
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
    const imageCount = chatMessages.reduce((acc, m) => acc + (m.images?.length || 0), 0);

    // Log per-message timestamps for audit trail
    const messageTimestamps = chatMessages.map((m, i) => ({
      index: i,
      role: m.role,
      timestamp: m.timestamp || null,
      contentPreview: m.content?.slice(0, 80) || "",
    }));

    logger.info(sessionId, "chat", "Starting chat request", {
      messageCount: chatMessages.length,
      imageCount,
      keyType: userSuppliedKey ? "user" : "server",
      model: selectedModel,
      messageTimestamps,
    });

    const startTime = Date.now();
    const result = await chat(credentials, chatMessages, selectedModel, sessionId, phase);
    const durationMs = Date.now() - startTime;

    const responseTimestamp = new Date().toISOString();
    logger.info(sessionId, "chat", "Chat request completed", {
      toolCount: result.toolExecutions?.length ?? 0,
      durationMs,
      responseTimestamp,
    });

    // Don't end session - client may send more requests in this session

    // Include usage info and response timestamp so frontend can capture it
    return NextResponse.json({ ...result, usage: usageInfo, responseTimestamp });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    logger.error(sessionId, "chat", "Chat API error", {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Detect Anthropic rate limit (after retries exhausted in sn-engine)
    if (message === "anthropic_rate_limit") {
      const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
      logger.error(sessionId, "claude_api", "Anthropic rate limit exceeded after retries");
      return NextResponse.json(
        {
          error: "anthropic_rate_limit",
          message: allowUserKeys
            ? "Claude API rate limit exceeded after retries. Provide your own API key to continue."
            : "Claude API rate limit exceeded after retries. Please try again later.",
          needsApiKey: allowUserKeys,
          retryable: true,
          allowUserApiKeys: allowUserKeys,
        },
        { status: 429 }
      );
    }

    // Detect specific error types
    if (message.includes("authentication") || message.includes("401") || message.includes("invalid x-api-key")) {
      logger.error(sessionId, "auth", "Authentication failed", { error: message });
      return NextResponse.json({ error: `Authentication failed: ${message}` }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

