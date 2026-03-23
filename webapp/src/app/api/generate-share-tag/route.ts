import { NextRequest, NextResponse } from "next/server";

import { checkShareTagGeneration } from "@/lib/auth-rate-limiter";
import { getClientIp } from "@/lib/client-ip";
import { parseShareTagBody } from "@/lib/request-validation";
import { resolveShareSessionContext } from "@/lib/share-server";
import { SHARE_FALLBACK_TAG, sanitizeHashtag } from "@/lib/share-content";

const MODEL = "claude-haiku-4-5-20251001";

async function generateTagWithAnthropic(durationMin: number, phaseCount: number, toolCount: number, assistantCount: number): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY || "";
  if (!apiKey) return SHARE_FALLBACK_TAG;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 20,
      system:
        "You create one concise professional hashtag for a LinkedIn or X post about AI-assisted ServiceNow productivity. Return exactly one hashtag, lowercase, hyphenated, and no explanation.",
      messages: [
        {
          role: "user",
          content:
            `Generate one hashtag for a session with these stats:\n` +
            `- duration_minutes: ${durationMin}\n` +
            `- phases_completed: ${phaseCount}\n` +
            `- ai_guided_operations: ${toolCount}\n` +
            `- assistant_responses: ${assistantCount}\n` +
            `The hashtag should feel energetic, professional, and short.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[generate-share-tag] Anthropic error:", response.status, errText);
    return SHARE_FALLBACK_TAG;
  }

  const data = await response.json().catch(() => null);
  const text = data?.content?.[0]?.text;
  return sanitizeHashtag(typeof text === "string" ? text : SHARE_FALLBACK_TAG);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const rateLimit = await checkShareTagGeneration(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many share tag requests. Please try again later." }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parseShareTagBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { sessionId, durationMin, phaseCount, toolCount, assistantCount } = parsed.data;
    const resolved = await resolveShareSessionContext(request, sessionId);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error || "Unauthorized" }, { status: resolved.status });
    }

    const tag = await generateTagWithAnthropic(durationMin, phaseCount, toolCount, assistantCount);
    return NextResponse.json({ tag });
  } catch (error) {
    console.error("[generate-share-tag] Error:", error);
    return NextResponse.json({ tag: SHARE_FALLBACK_TAG });
  }
}
