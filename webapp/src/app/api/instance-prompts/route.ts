import { NextRequest, NextResponse } from "next/server";
import { fetchCategorizedPrompts } from "@/lib/sn-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const instanceUrl = body.instanceUrl || process.env.SN_INSTANCE_URL || "";
    const username = body.username || process.env.SN_USERNAME || "";
    const password = body.password || process.env.SN_PASSWORD || "";

    if (!instanceUrl || !username || !password) {
      return NextResponse.json({ prompts: null });
    }

    const userContext = body.userContext || undefined;

    const prompts = await fetchCategorizedPrompts(
      { instanceUrl, username, password },
      userContext
    );
    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("Instance prompts error:", error);
    return NextResponse.json({ prompts: null });
  }
}
