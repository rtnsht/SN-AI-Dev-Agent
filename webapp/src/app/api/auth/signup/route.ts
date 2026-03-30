import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  hashPassword,
  validatePasswordStrength,
  createSession,
  buildSetCookieHeader,
} from "@/lib/auth";
import { checkSignup } from "@/lib/auth-rate-limiter";
import { getClientIp } from "@/lib/client-ip";
import { parseSignupBody } from "@/lib/request-validation";

export async function POST(request: NextRequest) {
  try {
    const parsed = parseSignupBody(await request.json());
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;

    // Rate limit by IP
    const ip = getClientIp(request);
    const rl = await checkSignup(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
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

    // Check if email already exists
    const { data: existingUser } = await db
      .from("users")
      .select("id, email, auth_provider, google_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      // If user exists with Google OAuth, suggest linking
      if (existingUser.auth_provider === "google") {
        return NextResponse.json(
          { error: "An account with this email already exists via Google Sign-In. Please sign in with Google." },
          { status: 400 }
        );
      }
      // Regular account exists
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
        auth_provider: "email",
        role: "user",
        status: "active",
        must_set_password: false,
      })
      .select("id, email, name, role")
      .single();

    if (userErr || !newUser) {
      console.error("[auth/signup] User create error:", userErr?.message);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

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
    console.error("[auth/signup] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
