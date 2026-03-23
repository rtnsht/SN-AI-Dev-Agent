import { NextRequest, NextResponse } from "next/server";
import { getAccessStatus, getTierLimits } from "@/lib/access-tier";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";
import { hasServerKey, getPoolSize } from "@/lib/key-resolver";

/**
 * GET /api/config — returns public app configuration.
 * Never exposes the actual API key value, only whether one is configured.
 * Includes 3-tier access info.
 */
export async function GET(request: NextRequest) {
  const serverApiKeyConfigured = hasServerKey("anthropic");
  const serverOpenRouterKeyConfigured = hasServerKey("openrouter");

  // Check if server-side ServiceNow credentials are configured (all three required)
  const snUrl = process.env.SN_INSTANCE_URL || "";
  const snUser = process.env.SN_USERNAME || "";
  const snPass = process.env.SN_PASSWORD || "";
  const serverSnCredsConfigured = !!(snUrl && snUser && snPass);

  // Get caller IP and user ID for access status
  const ip = getClientIp(request);
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await validateSession(sessionToken) : null;
  const userId = session?.user.id || null;
  const userRole = session?.user.role;
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
    keyPoolSize: { anthropic: getPoolSize("anthropic"), openrouter: getPoolSize("openrouter") },
    // Browser-assisted ServiceNow sign-in availability
    browserScopeSwitchEnabled:
      process.env.ENABLE_BROWSER_SCOPE_SWITCH === "true" ||
      process.env.BROWSER_SCOPE_SWITCH_MODE === "headless" ||
      process.env.BROWSER_SCOPE_SWITCH_MODE === "headed" ||
      process.env.BROWSER_SCOPE_SWITCH_MODE === "cdp",
    browserScopeSwitchMode: process.env.BROWSER_SCOPE_SWITCH_MODE || null,
  });
}

