import { NextRequest, NextResponse } from "next/server";
import { getAccessStatus, getTierLimits } from "@/lib/access-tier";

/** GET /api/trial-status — return current access tier status */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userId = request.headers.get("x-user-id") || null;

    const status = await getAccessStatus(ip, userId, false);
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
