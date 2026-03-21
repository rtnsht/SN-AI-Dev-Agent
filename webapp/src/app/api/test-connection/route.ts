import { NextRequest, NextResponse } from "next/server";
import { testConnection, type UserCredentials } from "@/lib/sn-engine";
import type { Credentials } from "@/lib/types";
import { normalizeServiceNowAuthMethod, validateServiceNowCredentials } from "@/lib/servicenow-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Credentials>;
    const userRole = request.headers.get("x-user-role");
    const authType = normalizeServiceNowAuthMethod(body.snAuthType);
    const canUseServerCreds = userRole === "admin" && authType === "basic";
    const serverPassword = canUseServerCreds ? process.env.SN_PASSWORD || "" : "";

    // Only admins may use server-side fallback creds; everyone else must supply explicit values.
    const credentials: Partial<Credentials> = {
      ...body,
      snAuthType: authType,
      instanceUrl: body.instanceUrl || (canUseServerCreds ? process.env.SN_INSTANCE_URL || "" : ""),
      username: body.username || (canUseServerCreds ? process.env.SN_USERNAME || "" : ""),
      password: body.password || serverPassword,
    };

    const validationError = validateServiceNowCredentials(credentials, {
      serverBasicConfigured: Boolean(serverPassword),
      requireUsernameForBasic: true,
    });

    if (validationError) {
      return NextResponse.json(
        {
          success: false,
          message: validationError,
        },
        { status: 400 },
      );
    }

    const result = await testConnection(credentials as Omit<UserCredentials, "claudeApiKey">);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Test connection error:", error);
    const message = error instanceof Error ? error.message : "Connection test failed";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

