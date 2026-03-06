import { NextRequest, NextResponse } from "next/server";
import { fetchInstancePrompts } from "@/lib/sn-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const instanceUrl = body.instanceUrl || process.env.SN_INSTANCE_URL || "";
    const username = body.username || process.env.SN_USERNAME || "";
    const password = body.password || process.env.SN_PASSWORD || "";

    if (!instanceUrl || !username || !password) {
      return NextResponse.json({ prompts: [] });
    }

    const prompts = await fetchInstancePrompts({ instanceUrl, username, password });
    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("Instance prompts error:", error);
    // Non-critical — return empty so the UI falls back to defaults
    return NextResponse.json({ prompts: [] });
  }
}

