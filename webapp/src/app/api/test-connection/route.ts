import { NextRequest, NextResponse } from "next/server";
import { testConnection, type UserCredentials } from "@/lib/sn-engine";
import type { Credentials } from "@/lib/types";
import { normalizeServiceNowAuthMethod, validateServiceNowCredentials } from "@/lib/servicenow-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { parseTestConnectionBody } from "@/lib/request-validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseTestConnectionBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });
    }
    const parsedBody = parsed.data as Partial<Credentials>;
    const authType = normalizeServiceNowAuthMethod(parsedBody.snAuthType);

    const wantsServerBasicFallback =
      authType === "basic" &&
      (!parsedBody.instanceUrl || !parsedBody.username || !parsedBody.password);

    let canUseServerCreds = false;
    if (wantsServerBasicFallback) {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) return adminAuth.response;
      canUseServerCreds = true;
    }

    const serverPassword = canUseServerCreds ? process.env.SN_PASSWORD || "" : "";

    // Only admins may use server-side fallback creds; everyone else must supply explicit values.
    const credentials: Partial<Credentials> = {
      ...parsedBody,
      snAuthType: authType,
      instanceUrl: parsedBody.instanceUrl || (canUseServerCreds ? process.env.SN_INSTANCE_URL || "" : ""),
      username: parsedBody.username || (canUseServerCreds ? process.env.SN_USERNAME || "" : ""),
      password: parsedBody.password || serverPassword,
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
    return NextResponse.json({ success: false, message: "Connection test failed" }, { status: 500 });
  }
}

