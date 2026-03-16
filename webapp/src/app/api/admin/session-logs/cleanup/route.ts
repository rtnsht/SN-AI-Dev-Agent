import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || "90", 10);

/**
 * POST /api/admin/session-logs/cleanup
 *
 * Trigger retention cleanup — deletes session logs older than LOG_RETENTION_DAYS.
 * Pass { "retentionDays": N } in body to override the default.
 * Returns the count of deleted rows.
 */
export async function POST(request: Request) {
  try {
    let retentionDays = LOG_RETENTION_DAYS;

    try {
      const body = await request.json();
      if (typeof body.retentionDays === "number" && body.retentionDays > 0) {
        retentionDays = body.retentionDays;
      }
    } catch {
      // No body or invalid JSON — use default
    }

    if (retentionDays <= 0) {
      return NextResponse.json({
        message: "Retention is disabled (LOG_RETENTION_DAYS=0). No cleanup performed.",
        deleted: 0,
      });
    }

    const db = getSupabase();
    const { data, error } = await db.rpc("cleanup_old_session_logs", {
      retention_days: retentionDays,
    });

    if (error) {
      console.error("[admin/session-logs/cleanup] DB error:", error.message);
      return NextResponse.json({ error: "Cleanup failed: " + error.message }, { status: 500 });
    }

    const deleted = typeof data === "number" ? data : 0;
    return NextResponse.json({
      message: `Cleanup complete. Deleted ${deleted} session(s) older than ${retentionDays} days.`,
      deleted,
      retentionDays,
    });
  } catch (err) {
    console.error("[admin/session-logs/cleanup] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
