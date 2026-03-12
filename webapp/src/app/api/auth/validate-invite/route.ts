import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** GET /api/auth/validate-invite?code=xxx — check if invite code is valid */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const db = getSupabase();

    const { data: invite } = await db
      .from("invite_codes")
      .select("id, max_uses, times_used, expires_at, is_active")
      .eq("code", code)
      .single();

    if (!invite || !invite.is_active) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite code expired" }, { status: 404 });
    }

    if (invite.max_uses !== null && invite.times_used >= invite.max_uses) {
      return NextResponse.json({ error: "Invite code fully used" }, { status: 404 });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error("[auth/validate-invite] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

