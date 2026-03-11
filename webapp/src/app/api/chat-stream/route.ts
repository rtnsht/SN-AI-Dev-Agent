import { NextRequest } from "next/server";
import { chatStream, type UserCredentials, type ChatMessage } from "@/lib/sn-engine";
import { consume } from "@/lib/rate-limiter";
import { logger, generateSessionId } from "@/lib/logger";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  let sessionId: string = 'unknown'; // Declare outside try block for error handler access

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
    // Fall back to generating a new one if client didn't provide one
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

    if (!credentials.instanceUrl || !credentials.username || !credentials.password) {
      logger.error(sessionId, "validation", "Missing credentials", { ip });
      return new Response(
        JSON.stringify({ error: "Missing credentials" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Resolve API key based on provider
    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
    let userSuppliedKey = false;

    if (credentials.aiProvider === "openrouter") {
      const openRouterKey = (allowUserKeys ? credentials.openRouterApiKey : "") || process.env.OPENROUTER_API_KEY || "";
      if (!openRouterKey) {
        logger.error(sessionId, "validation", "No OpenRouter API key available");
        return new Response(
          JSON.stringify({ error: "No OpenRouter API key available" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      credentials.openRouterApiKey = openRouterKey;
      userSuppliedKey = allowUserKeys && !!credentials.openRouterApiKey;
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

    // Rate limiting
    if (!userSuppliedKey && process.env.CLAUDE_API_KEY) {
      const { allowed, usage } = consume(ip);
      if (!allowed) {
        logger.warn(sessionId, "rate_limit", "Server API key rate limit exceeded", {
          used: usage.used,
          max: usage.max,
          windowHours: usage.windowHours,
          ip,
        });
        return new Response(
          JSON.stringify({
            error: "rate_limit_exceeded",
            message: allowUserKeys
              ? `You've used all ${usage.max} free requests for this ${usage.windowHours}-hour window. Enter your own API key to continue chatting with no limits.`
              : `You've used all ${usage.max} requests for this ${usage.windowHours}-hour window. Please try again later.`,
            usage,
            allowUserApiKeys: allowUserKeys,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
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
    const imageCount = chatMessages.reduce((acc, m) => acc + (m.images?.length || 0), 0);

    // Log per-message timestamps for audit trail
    const messageTimestamps = chatMessages.map((m, i) => ({
      index: i,
      role: m.role,
      timestamp: m.timestamp || null,
      contentPreview: m.content?.slice(0, 80) || "",
    }));

    logger.info(sessionId, "chat_stream", "Starting streaming chat request", {
      messageCount: chatMessages.length,
      imageCount,
      keyType: userSuppliedKey ? "user" : "server",
      model: selectedModel,
      messageTimestamps,
    });

    const startTime = Date.now();

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let toolCount = 0;

        try {
          for await (const event of chatStream(credentials, chatMessages, selectedModel, 30, sessionId, phase)) {
            if (event.type === "tool_end") toolCount++;
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          const durationMs = Date.now() - startTime;
          logger.info(sessionId, "chat_stream", "Streaming chat completed", { toolCount, durationMs });
          // Don't end session on success - client may send more requests in this session
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.error(sessionId, "chat_stream", "Stream error", { error: errorMsg });

          const errorEvent = `data: ${JSON.stringify({
            type: "error",
            message: errorMsg,
          })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          // Don't end session on stream error - client may retry
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Internal server error";
    logger.error(sessionId, "chat_stream", "Chat stream API error", {
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
