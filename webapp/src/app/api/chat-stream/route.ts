import { NextRequest } from "next/server";
import { chatStream, type UserCredentials, type ChatMessage } from "@/lib/sn-engine";
import { consume } from "@/lib/rate-limiter";
import { createSession, endSession, logger, generateSessionId } from "@/lib/logger";

export const maxDuration = 120;

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

    if (!credentials.instanceUrl || !credentials.username || !credentials.password) {
      logger.error(sessionId, "validation", "Missing credentials", { ip });
      endSession(sessionId, "error");
      return new Response(
        JSON.stringify({ error: "Missing credentials" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Resolve Claude API key
    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
    const userSuppliedKey = allowUserKeys && !!credentials.claudeApiKey;
    const claudeApiKey = (allowUserKeys ? credentials.claudeApiKey : "") || process.env.CLAUDE_API_KEY || "";
    if (!claudeApiKey) {
      logger.error(sessionId, "validation", "No Claude API key available", { userSuppliedKey, allowUserKeys });
      endSession(sessionId, "error");
      return new Response(
        JSON.stringify({ error: "No Claude API key available" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    credentials.claudeApiKey = claudeApiKey;

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
        endSession(sessionId, "error");
        return new Response(
          JSON.stringify({
            error: "rate_limit_exceeded",
            message: `Rate limit exceeded. ${usage.used}/${usage.max} requests used.`,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.error(sessionId, "validation", "Messages array is required");
      endSession(sessionId, "error");
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const chatMessages: ChatMessage[] = messages.map((m: { role: string; content: string; images?: string[] }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      ...(m.images?.length ? { images: m.images } : {}),
    }));

    const selectedModel = model || "claude-sonnet-4-6";
    const imageCount = chatMessages.reduce((acc, m) => acc + (m.images?.length || 0), 0);

    logger.info(sessionId, "chat_stream", "Starting streaming chat request", {
      messageCount: chatMessages.length,
      imageCount,
      keyType: userSuppliedKey ? "user" : "server",
      model: selectedModel,
    });

    const startTime = Date.now();

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let toolCount = 0;

        try {
          for await (const event of chatStream(credentials, chatMessages, selectedModel, 30, sessionId)) {
            if (event.type === "tool_end") toolCount++;
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          const durationMs = Date.now() - startTime;
          logger.info(sessionId, "chat_stream", "Streaming chat completed", { toolCount, durationMs });
          endSession(sessionId, "success");
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.error(sessionId, "chat_stream", "Stream error", { error: errorMsg });

          const errorEvent = `data: ${JSON.stringify({
            type: "error",
            message: errorMsg,
          })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          endSession(sessionId, "error");
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
    endSession(sessionId, "error");

    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
