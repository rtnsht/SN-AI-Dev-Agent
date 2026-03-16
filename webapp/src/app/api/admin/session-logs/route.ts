import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/admin/session-logs
 *
 * List session logs with optional filters.
 * Query params: username, status, from, to, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const db = getSupabase();

    let query = db
      .from("session_logs")
      .select(
        "id, session_id, user_id, instance_url, username, user_full_name, ai_provider, model, " +
        "current_phase, started_at, ended_at, total_rounds, total_tool_calls, total_errors, " +
        "total_input_tokens, total_output_tokens, phases, status, entries_overflow, created_at",
        { count: "exact" }
      )
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (username) {
      query = query.ilike("username", `%${username}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (from) {
      query = query.gte("started_at", from);
    }
    if (to) {
      query = query.lte("started_at", to);
    }

    const { data: sessions, error, count } = await query;

    if (error) {
      console.error("[admin/session-logs] DB error:", error.message);
      return NextResponse.json({ error: "Failed to fetch session logs" }, { status: 500 });
    }

    return NextResponse.json({
      sessions: sessions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[admin/session-logs] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
