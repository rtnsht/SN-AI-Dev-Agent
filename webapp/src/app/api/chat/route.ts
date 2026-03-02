import { NextRequest, NextResponse } from "next/server";
import { chat, type UserCredentials, type ChatMessage } from "@/lib/sn-engine";
import { consume, getUsage } from "@/lib/rate-limiter";
import { createSession, endSession, logger, generateSessionId } from "@/lib/logger";

export const maxDuration = 120; // Allow up to 2 minutes for tool-use loops

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const sessionId = generateSessionId();

  try {
    const body = await request.json();
    const { credentials, messages, model } = body as {
      credentials: UserCredentials;
      messages: ChatMessage[];
      model?: string;
    };

    // Fall back to server-side env vars for ServiceNow credentials
    if (!credentials.instanceUrl) credentials.instanceUrl = process.env.SN_INSTANCE_URL || "";
    if (!credentials.username) credentials.username = process.env.SN_USERNAME || "";
    if (!credentials.password) credentials.password = process.env.SN_PASSWORD || "";

    // Create session for logging
    createSession({
      sessionId,
      username: credentials.username,
      instanceUrl: credentials.instanceUrl,
      ip,
    });

    // Validate required fields
    if (!credentials.instanceUrl || !credentials.username || !credentials.password) {
      logger.error(sessionId, "validation", "Missing credentials", { ip });
      endSession(sessionId, "error");
      return NextResponse.json(
        { error: "Missing credentials. Provide instanceUrl, username, and password." },
        { status: 400 }
      );
    }

    // Resolve Claude API key: user-supplied takes priority (if allowed), then server env var
    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
    const userSuppliedKey = allowUserKeys && !!credentials.claudeApiKey;
    const claudeApiKey = (allowUserKeys ? credentials.claudeApiKey : "") || process.env.CLAUDE_API_KEY || "";
    if (!claudeApiKey) {
      logger.error(sessionId, "validation", "No Claude API key available", { userSuppliedKey, allowUserKeys });
      endSession(sessionId, "error");
      return NextResponse.json(
        { error: allowUserKeys
            ? "No Claude API key available. Either provide one in settings or ask the admin to configure a server-side key."
            : "No Claude API key configured on the server. Please contact the admin." },
        { status: 400 }
      );
    }
    credentials.claudeApiKey = claudeApiKey;

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
        endSession(sessionId, "error");
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

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error(sessionId, "validation", "Messages array is required and must not be empty");
      endSession(sessionId, "error");
      return NextResponse.json(
        { error: "Messages array is required and must not be empty." },
        { status: 400 }
      );
    }

    // Pass through images from each message (base64 data URIs)
    const chatMessages: ChatMessage[] = messages.map((m: { role: string; content: string; images?: string[] }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      ...(m.images?.length ? { images: m.images } : {}),
    }));

    const selectedModel = model || "claude-sonnet-4-6";
    const imageCount = chatMessages.reduce((acc, m) => acc + (m.images?.length || 0), 0);

    logger.info(sessionId, "chat", "Starting chat request", {
      messageCount: chatMessages.length,
      imageCount,
      keyType: userSuppliedKey ? "user" : "server",
      model: selectedModel,
    });

    const startTime = Date.now();
    const result = await chat(credentials, chatMessages, selectedModel, sessionId);
    const durationMs = Date.now() - startTime;

    logger.info(sessionId, "chat", "Chat request completed", {
      toolCount: result.toolExecutions?.length ?? 0,
      durationMs,
    });

    endSession(sessionId, "success");

    // Include usage info in response so frontend can display counter
    return NextResponse.json({ ...result, usage: usageInfo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";

    logger.error(sessionId, "chat", "Chat API error", {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    endSession(sessionId, "error");

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

