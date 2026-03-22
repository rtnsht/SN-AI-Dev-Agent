import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { deleteAllUserSessions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";

/** PATCH /api/admin/users/[id] — suspend or activate */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const { action } = await request.json();

    if (!action || !["suspend", "activate"].includes(action)) {
      return NextResponse.json({ error: "Action must be 'suspend' or 'activate'" }, { status: 400 });
    }

    const db = getSupabase();

    // Don't allow suspending yourself
    const currentUserId = request.headers.get("x-user-id");
    if (id === currentUserId) {
      return NextResponse.json({ error: "Cannot suspend yourself" }, { status: 400 });
    }

    const newStatus = action === "suspend" ? "suspended" : "active";

    const { error } = await db
      .from("users")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      console.error("[admin/users] Update error:", error.message);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    // Kill all sessions on suspend
    if (action === "suspend") {
      await deleteAllUserSessions(id);
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    console.error("[admin/users] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

