import { NextRequest, NextResponse } from "next/server";
import { testConnection } from "@/lib/sn-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instanceUrl, username, password } = body as {
      instanceUrl: string;
      username: string;
      password: string;
    };

    if (!instanceUrl || !username || !password) {
      return NextResponse.json(
        { error: "Missing required fields: instanceUrl, username, password" },
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

