import { NextRequest, NextResponse } from "next/server";
import { fetchCategorizedPrompts, type UserCredentials } from "@/lib/sn-engine";
import type { Credentials } from "@/lib/types";
import { normalizeServiceNowAuthMethod, validateServiceNowCredentials } from "@/lib/servicenow-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Credentials> & {
      userContext?: unknown;
      seenHashes?: string[];
    };

    const authType = normalizeServiceNowAuthMethod(body.snAuthType);
    const credentials: Partial<Credentials> = {
      ...body,
      snAuthType: authType,
      instanceUrl: body.instanceUrl || process.env.SN_INSTANCE_URL || "",
      username: authType === "basic" ? (body.username || process.env.SN_USERNAME || "") : (body.username || ""),
      password: authType === "basic" ? (body.password || process.env.SN_PASSWORD || "") : (body.password || ""),
    };

    const validationError = validateServiceNowCredentials(credentials, {
      serverBasicConfigured: authType === "basic" && Boolean(process.env.SN_PASSWORD),
      requireUsernameForBasic: true,
    });

    if (validationError) {
      return NextResponse.json({ prompts: null }, { status: 400 });
    }

    const userContext = body.userContext as {
      sysId: string;
      roles: string[];
      assignmentGroups: { sysId: string; name: string }[];
    } | undefined;
    const seenHashes: string[] = Array.isArray(body.seenHashes) ? body.seenHashes : [];

    const { prompts, pools, promptHashes } = await fetchCategorizedPrompts(
      credentials as Omit<UserCredentials, "claudeApiKey">,
      userContext,
      seenHashes.length > 0 ? seenHashes : undefined,
    );
    return NextResponse.json({ prompts, _pools: pools, promptHashes });
  } catch (error) {
    console.error("Instance prompts error:", error);
    return NextResponse.json({ prompts: null, error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
