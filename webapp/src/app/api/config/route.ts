import { NextRequest, NextResponse } from "next/server";
import { getUsage, MAX_REQUESTS, WINDOW_MS } from "@/lib/rate-limiter";

/**
 * GET /api/config — returns public app configuration.
 * Never exposes the actual API key value, only whether one is configured.
 * Includes rate limit info when server key is active.
 */
export async function GET(request: NextRequest) {
  const serverApiKeyConfigured = !!process.env.CLAUDE_API_KEY;

  // Get caller IP for usage tracking
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const usage = serverApiKeyConfigured ? getUsage(ip) : null;

  return NextResponse.json({
    serverApiKeyConfigured,
    rateLimit: serverApiKeyConfigured
      ? { max: MAX_REQUESTS, windowHours: WINDOW_MS / 3600000 }
      : null,
    usage,
  });
}

