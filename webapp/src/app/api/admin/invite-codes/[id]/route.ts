import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

/** PATCH /api/admin/invite-codes/[id] — revoke an invite code */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const { action } = await request.json();

    if (action !== "revoke") {
      return NextResponse.json({ error: "Action must be 'revoke'" }, { status: 400 });
    }

    const db = getSupabase();

    const { error } = await db
      .from("invite_codes")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("[admin/invite-codes] Revoke error:", error.message);
      return NextResponse.json({ error: "Failed to revoke invite code" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/invite-codes] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

