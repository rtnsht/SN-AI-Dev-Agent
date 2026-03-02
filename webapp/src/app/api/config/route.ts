import { NextRequest, NextResponse } from "next/server";
import { getUsage, MAX_REQUESTS, WINDOW_MS } from "@/lib/rate-limiter";

/**
 * GET /api/config — returns public app configuration.
 * Never exposes the actual API key value, only whether one is configured.
 * Includes rate limit info when server key is active.
 */
export async function GET(request: NextRequest) {
  const serverApiKeyConfigured = !!process.env.CLAUDE_API_KEY;

  // Check if server-side ServiceNow credentials are configured (all three required)
  const snUrl = process.env.SN_INSTANCE_URL || "";
  const snUser = process.env.SN_USERNAME || "";
  const snPass = process.env.SN_PASSWORD || "";
  const serverSnCredsConfigured = !!(snUrl && snUser && snPass);

  // Get caller IP for usage tracking
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const usage = serverApiKeyConfigured ? getUsage(ip) : null;

  return NextResponse.json({
    serverApiKeyConfigured,
    // Expose non-sensitive SN credential info (never send password)
    serverSnCredsConfigured,
    ...(serverSnCredsConfigured
      ? { serverSnCredentials: { instanceUrl: snUrl, username: snUser } }
      : {}),
    rateLimit: serverApiKeyConfigured
      ? { max: MAX_REQUESTS, windowHours: WINDOW_MS / 3600000 }
      : null,
    usage,
    // Tool execution detail visibility (default: true)
    showToolDetails: process.env.NEXT_PUBLIC_SHOW_TOOL_DETAILS !== "false",
    // Live status visibility - shows what agent is doing (default: true)
    showLiveStatus: process.env.NEXT_PUBLIC_SHOW_LIVE_STATUS !== "false",
    // Whether users are allowed to provide their own Claude API key (default: true)
    allowUserApiKeys: process.env.ALLOW_USER_API_KEYS !== "false",
  });
}

