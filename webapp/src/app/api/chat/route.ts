import { NextRequest, NextResponse } from "next/server";
import { chat, type UserCredentials, type ChatMessage } from "@/lib/sn-engine";
import { consume, getUsage } from "@/lib/rate-limiter";

export const maxDuration = 120; // Allow up to 2 minutes for tool-use loops

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credentials, messages, model } = body as {
      credentials: UserCredentials;
      messages: ChatMessage[];
      model?: string;
    };

    // Validate required fields
    if (!credentials?.instanceUrl || !credentials?.username || !credentials?.password) {
      return NextResponse.json(
        { error: "Missing credentials. Provide instanceUrl, username, and password." },
        { status: 400 }
      );
    }

    // Resolve Claude API key: user-supplied takes priority, then server env var
    const userSuppliedKey = !!credentials.claudeApiKey;
    const claudeApiKey = credentials.claudeApiKey || process.env.CLAUDE_API_KEY || "";
    if (!claudeApiKey) {
      return NextResponse.json(
        { error: "No Claude API key available. Either provide one in settings or ask the admin to configure a server-side key." },
        { status: 400 }
      );
    }
    credentials.claudeApiKey = claudeApiKey;

    // Rate limiting — only applies when using the server-provided key
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    let usageInfo = null;

    if (!userSuppliedKey && process.env.CLAUDE_API_KEY) {
      const { allowed, usage } = consume(ip);
      usageInfo = usage;

      if (!allowed) {
        return NextResponse.json(
          {
            error: "rate_limit_exceeded",
            message: `You've used all ${usage.max} free requests for this ${usage.windowHours}-hour window. Enter your own Claude API key to continue chatting with no limits.`,
            usage,
          },
          { status: 429 }
        );
      }
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required and must not be empty." },
        { status: 400 }
      );
    }

    const selectedModel = model || "claude-sonnet-4-6";
    console.log(`[chat] user=${credentials.username} instance=${credentials.instanceUrl} msgs=${messages.length} key=${userSuppliedKey ? "user" : "server"} ip=${ip} model=${selectedModel}`);
    const result = await chat(credentials, messages, selectedModel);
    console.log(`[chat] done — ${result.toolExecutions?.length ?? 0} tool(s) executed`);

    // Include usage info in response so frontend can display counter
    return NextResponse.json({ ...result, usage: usageInfo });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";

    // Detect specific error types
    if (message.includes("authentication") || message.includes("401") || message.includes("invalid x-api-key")) {
      return NextResponse.json({ error: `Authentication failed: ${message}` }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

