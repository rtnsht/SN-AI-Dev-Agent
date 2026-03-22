import { NextRequest, NextResponse } from "next/server";
import { fetchCategorizedPrompts, type UserCredentials } from "@/lib/sn-engine";
import type { Credentials } from "@/lib/types";
import { normalizeServiceNowAuthMethod, validateServiceNowCredentials } from "@/lib/servicenow-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { parseInstancePromptsBody } from "@/lib/request-validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseInstancePromptsBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ prompts: null, error: parsed.error }, { status: 400 });
    }
    const parsedBody = parsed.data as Partial<Credentials> & {
      userContext?: unknown;
      seenHashes?: string[];
    };

    const authType = normalizeServiceNowAuthMethod(parsedBody.snAuthType);
    const wantsServerBasicFallback =
      authType === "basic" &&
      (!parsedBody.instanceUrl || !parsedBody.username || !parsedBody.password);

    let canUseServerCreds = false;
    if (wantsServerBasicFallback) {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) {
        return NextResponse.json(
          { prompts: null, error: "Admin authorization required for server credentials" },
          { status: 403 },
        );
      }
      canUseServerCreds = true;
    }

    const credentials: Partial<Credentials> = {
      ...parsedBody,
      snAuthType: authType,
      instanceUrl: parsedBody.instanceUrl || (canUseServerCreds ? process.env.SN_INSTANCE_URL || "" : ""),
      username: authType === "basic"
        ? (parsedBody.username || (canUseServerCreds ? process.env.SN_USERNAME || "" : ""))
        : (parsedBody.username || ""),
      password: authType === "basic"
        ? (parsedBody.password || (canUseServerCreds ? process.env.SN_PASSWORD || "" : ""))
        : (parsedBody.password || ""),
    };

    const validationError = validateServiceNowCredentials(credentials, {
      serverBasicConfigured: canUseServerCreds && Boolean(process.env.SN_PASSWORD),
      requireUsernameForBasic: true,
    });

    if (validationError) {
      return NextResponse.json({ prompts: null }, { status: 400 });
    }

    const userContext = parsedBody.userContext as {
      sysId: string;
      roles: string[];
      assignmentGroups: { sysId: string; name: string }[];
    } | undefined;
    const seenHashes: string[] = Array.isArray(parsedBody.seenHashes) ? parsedBody.seenHashes : [];

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
