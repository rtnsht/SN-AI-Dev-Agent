import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { generateInviteCode } from "@/lib/auth";

/** GET /api/admin/invite-codes */
export async function GET() {
  try {
    const db = getSupabase();

    const { data, error } = await db
      .from("invite_codes")
      .select("id, code, label, max_uses, times_used, expires_at, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/invite-codes] DB error:", error.message);
      return NextResponse.json({ error: "Failed to fetch invite codes" }, { status: 500 });
    }

    return NextResponse.json({ inviteCodes: data || [] });
  } catch (err) {
    console.error("[admin/invite-codes] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/** POST /api/admin/invite-codes — create a new invite code */
export async function POST(request: NextRequest) {
  try {
    const { label, max_uses, expires_in_days } = await request.json();
    const adminUserId = request.headers.get("x-user-id");

    if (!adminUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const code = generateInviteCode();
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const db = getSupabase();

    const { data, error } = await db
      .from("invite_codes")
      .insert({
        code,
        created_by: adminUserId,
        label: label?.trim() || null,
        max_uses: max_uses || null,
        expires_at: expiresAt,
      })
      .select("id, code, label, max_uses, times_used, expires_at, is_active, created_at")
      .single();

    if (error) {
      console.error("[admin/invite-codes] Create error:", error.message);
      return NextResponse.json({ error: "Failed to create invite code" }, { status: 500 });
    }

    const appUrl = process.env.APP_URL || "http://localhost:3000";

    return NextResponse.json({
      success: true,
      inviteCode: data,
      inviteUrl: `${appUrl}/invite/${code}`,
    });
  } catch (err) {
    console.error("[admin/invite-codes] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

