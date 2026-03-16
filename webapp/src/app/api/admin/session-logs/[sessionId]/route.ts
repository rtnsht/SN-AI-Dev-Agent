import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/admin/session-logs/[sessionId]
 *
 * Get full session log detail including log_entries and telemetry_summary.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const db = getSupabase();
    const { data, error } = await db
      .from("session_logs")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: data });
  } catch (err) {
    console.error("[admin/session-logs/detail] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
