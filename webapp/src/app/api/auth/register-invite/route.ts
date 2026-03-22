import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  hashPassword,
  validatePasswordStrength,
  createSession,
  buildSetCookieHeader,
} from "@/lib/auth";
import { checkInviteRegister } from "@/lib/auth-rate-limiter";
import { getClientIp } from "@/lib/client-ip";
import { parseRegisterInviteBody } from "@/lib/request-validation";

export async function POST(request: NextRequest) {
  try {
    const parsed = parseRegisterInviteBody(await request.json());
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 }
      );
    }
    const { code, name, email, password } = parsed.data;

    // Rate limit by IP
    const ip = getClientIp(request);
    const rl = await checkInviteRegister(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Validate password
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json({ error: strength.message }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = getSupabase();

    // Validate invite code
    const { data: invite } = await db
      .from("invite_codes")
      .select("id, max_uses, times_used, expires_at, is_active")
      .eq("code", code)
      .single();

    if (!invite || !invite.is_active) {
      return NextResponse.json({ error: "This invite link is no longer valid." }, { status: 400 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "This invite link has expired." }, { status: 400 });
    }

    if (invite.max_uses !== null && invite.times_used >= invite.max_uses) {
      return NextResponse.json({ error: "This invite link is no longer valid." }, { status: 400 });
    }

    // Check if email already exists
    const { data: existingUser } = await db
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try logging in." },
        { status: 400 }
      );
    }

    // Create user
    const hash = await hashPassword(password);
    const { data: newUser, error: userErr } = await db
      .from("users")
      .insert({
        email: normalizedEmail,
        name: name.trim(),
        password_hash: hash,
        role: "user",
        status: "active",
        must_set_password: false,
      })
      .select("id, email, name, role")
      .single();

    if (userErr || !newUser) {
      console.error("[auth/register-invite] User create error:", userErr?.message);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

    // Increment invite usage
    await db
      .from("invite_codes")
      .update({ times_used: invite.times_used + 1 })
      .eq("id", invite.id);

    // Create session
    const ua = request.headers.get("user-agent") || "";
    const { token, expiresAt } = await createSession(newUser.id, { ip, userAgent: ua });

    const response = NextResponse.json({
      success: true,
      user: newUser,
    });
    response.headers.set("Set-Cookie", buildSetCookieHeader(token, expiresAt));
    return response;
  } catch (err) {
    console.error("[auth/register-invite] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

