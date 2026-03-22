import { NextRequest, NextResponse } from "next/server";
import { getAccessStatus, getTierLimits } from "@/lib/access-tier";
import { getClientIp } from "@/lib/client-ip";

/** GET /api/trial-status — return current access tier status with anon/auth breakdown */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const userId = request.headers.get("x-user-id") || null;
    const instanceUrl = request.nextUrl.searchParams.get("instanceUrl") || undefined;

    const status = await getAccessStatus(ip, userId, false, instanceUrl);
    const limits = await getTierLimits();

    return NextResponse.json({
      ...status,
      tierLimits: limits,
      isAuthenticated: !!userId,
    });
  } catch (err) {
    console.error("[trial-status] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch access status" }, { status: 500 });
  }
}
