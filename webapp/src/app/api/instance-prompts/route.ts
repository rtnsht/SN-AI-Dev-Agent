import { NextRequest, NextResponse } from "next/server";
import { fetchCategorizedPrompts } from "@/lib/sn-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const instanceUrl = body.instanceUrl || process.env.SN_INSTANCE_URL || "";
    const username = body.username || process.env.SN_USERNAME || "";
    const password = body.password || process.env.SN_PASSWORD || "";

    if (!instanceUrl || !username || !password) {
      return NextResponse.json({ prompts: null }, { status: 400 });
    }

    const userContext = body.userContext || undefined;
    const seenHashes: string[] = Array.isArray(body.seenHashes) ? body.seenHashes : [];

    const { prompts, pools, promptHashes } = await fetchCategorizedPrompts(
      { instanceUrl, username, password },
      userContext,
      seenHashes.length > 0 ? seenHashes : undefined,
    );
    return NextResponse.json({ prompts, _pools: pools, promptHashes });
  } catch (error) {
    console.error("Instance prompts error:", error);
    return NextResponse.json({ prompts: null, error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
