import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPTS: Record<string, string> = {
  grammar: `You are a grammar and spelling corrector. Fix any grammar, spelling, and punctuation errors in the user's text. Preserve the original meaning and tone. Return ONLY the corrected text with no explanation, preamble, or surrounding quotes.`,
  enhance: `You are a prompt optimizer for an AI-powered ServiceNow development assistant. The user will give you a rough prompt or requirement description. Rewrite it to be clearer, more specific, and better structured for an AI to act on. Keep the original intent but make it more detailed and actionable. Return ONLY the improved prompt with no explanation, preamble, or surrounding quotes.`,
};

export async function POST(request: NextRequest) {
  try {
    const { text, mode } = await request.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const systemPrompt = SYSTEM_PROMPTS[mode];
    if (!systemPrompt) {
      return NextResponse.json({ error: "Mode must be 'grammar' or 'enhance'" }, { status: 400 });
    }

    const apiKey = process.env.CLAUDE_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: text.trim() }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[enhance-prompt] Anthropic API error:", res.status, errText);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await res.json();
    const result = data.content?.[0]?.text || text;

    return NextResponse.json({ text: result });
  } catch (err) {
    console.error("[enhance-prompt] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
