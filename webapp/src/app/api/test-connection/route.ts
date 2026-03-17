import { NextRequest, NextResponse } from "next/server";
import { testConnection } from "@/lib/sn-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userRole = request.headers.get("x-user-role");
    const canUseServerCreds = userRole === "admin";

    // Only admins may use server-side fallback creds; everyone else must supply explicit values.
    const instanceUrl = body.instanceUrl || (canUseServerCreds ? process.env.SN_INSTANCE_URL || "" : "");
    const username = body.username || (canUseServerCreds ? process.env.SN_USERNAME || "" : "");
    const password = body.password || (canUseServerCreds ? process.env.SN_PASSWORD || "" : "");

    if (!instanceUrl || !username || !password) {
      return NextResponse.json(
        {
          error: canUseServerCreds
            ? "Missing required fields: instanceUrl, username, password"
            : "Anonymous/non-admin requests must provide instanceUrl, username, and password.",
        },
        { status: 400 }
      );
    }

    const result = await testConnection({ instanceUrl, username, password });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Test connection error:", error);
    const message = error instanceof Error ? error.message : "Connection test failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

