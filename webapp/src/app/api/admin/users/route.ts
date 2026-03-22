import { NextResponse, NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

/** GET /api/admin/users */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const db = getSupabase();

    const { data, error } = await db
      .from("users")
      .select("id, email, name, role, status, created_at, last_login")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/users] DB error:", error.message);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] });
  } catch (err) {
    console.error("[admin/users] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

