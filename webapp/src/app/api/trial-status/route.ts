import { NextRequest, NextResponse } from "next/server";
import { getTrialStatus } from "@/lib/trial-limiter";

/** GET /api/trial-status — return current user's trial status */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instanceUrl = request.nextUrl.searchParams.get("instanceUrl") || undefined;
    const status = await getTrialStatus(userId, instanceUrl);

    return NextResponse.json(status);
  } catch (err) {
    console.error("[trial-status] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch trial status" }, { status: 500 });
  }
}
