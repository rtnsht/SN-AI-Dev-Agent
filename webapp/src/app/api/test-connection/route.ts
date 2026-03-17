import { NextRequest, NextResponse } from "next/server";
import { testConnection, validateInstanceUrl } from "@/lib/sn-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Fall back to server-side env vars if not provided in request
    const instanceUrl = body.instanceUrl || process.env.SN_INSTANCE_URL || "";
    const username = body.username || process.env.SN_USERNAME || "";
    const password = body.password || process.env.SN_PASSWORD || "";

    if (!instanceUrl || !username || !password) {
      return NextResponse.json(
        { error: "Missing required fields: instanceUrl, username, password" },
        { status: 400 }
      );
    }

    const urlError = validateInstanceUrl(instanceUrl);
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 });
    }

    const result = await testConnection({ instanceUrl, username, password });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Test connection error:", error);
    const message = error instanceof Error ? error.message : "Connection test failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

