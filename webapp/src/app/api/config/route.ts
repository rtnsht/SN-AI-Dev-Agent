import { NextRequest, NextResponse } from "next/server";
import { getAccessStatus, getTierLimits } from "@/lib/access-tier";

/**
 * GET /api/config — returns public app configuration.
 * Never exposes the actual API key value, only whether one is configured.
 * Includes 3-tier access info.
 */
export async function GET(request: NextRequest) {
  const serverApiKeyConfigured = !!process.env.CLAUDE_API_KEY;
  const serverOpenRouterKeyConfigured = !!process.env.OPENROUTER_API_KEY;

  // Check if server-side ServiceNow credentials are configured (all three required)
  const snUrl = process.env.SN_INSTANCE_URL || "";
  const snUser = process.env.SN_USERNAME || "";
  const snPass = process.env.SN_PASSWORD || "";
  const serverSnCredsConfigured = !!(snUrl && snUser && snPass);

  // Get caller IP and user ID for access status
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userId = request.headers.get("x-user-id") || null;
  const userRole = request.headers.get("x-user-role");
  const isAuthenticated = !!userId;
  const isAdmin = userRole === "admin";

  // Get current access tier status and limits
  let accessStatus = null;
  let tierLimits = null;
  try {
    accessStatus = await getAccessStatus(ip, userId, false);
    tierLimits = await getTierLimits();
  } catch {
    // Non-fatal
  }

  return NextResponse.json({
    serverApiKeyConfigured,
    serverOpenRouterKeyConfigured,
    serverSnCredsConfigured,
    // Only authenticated admins can see server-side ServiceNow connection hints.
    ...(serverSnCredsConfigured && isAdmin
      ? { serverSnCredentials: { instanceUrl: snUrl, username: snUser } }
      : {}),
    // 3-tier access info
    accessStatus,
    tierLimits,
    isAuthenticated,
    // Tool execution detail visibility (default: true)
    showToolDetails: process.env.NEXT_PUBLIC_SHOW_TOOL_DETAILS !== "false",
    // Live status visibility - shows what agent is doing (default: true)
    showLiveStatus: process.env.NEXT_PUBLIC_SHOW_LIVE_STATUS !== "false",
    // Whether users are allowed to provide their own Claude API key (default: true)
    allowUserApiKeys: process.env.ALLOW_USER_API_KEYS !== "false",
  });
}

