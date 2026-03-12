import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** GET /api/admin/requests?status=pending */
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const db = getSupabase();

    let query = db
      .from("access_requests")
      .select("id, email, name, company, use_case, status, email_verified, created_at, reviewed_at, reviewed_by")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[admin/requests] DB error:", error.message);
      return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
    }

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    console.error("[admin/requests] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

