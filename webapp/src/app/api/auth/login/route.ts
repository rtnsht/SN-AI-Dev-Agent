import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { comparePassword, createSession, buildSetCookieHeader } from "@/lib/auth";
import { checkLogin } from "@/lib/auth-rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit
    const rl = checkLogin(normalizedEmail);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Lookup user
    const db = getSupabase();
    const { data: user } = await db
      .from("users")
      .select("id, email, name, role, status, password_hash, must_set_password")
      .eq("email", normalizedEmail)
      .single();

    // Uniform error — no enumeration
    if (!user || !user.password_hash || user.status === "suspended") {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Update last_login
    await db.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);

    // Create session
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = request.headers.get("user-agent") || "";
    const { token, expiresAt } = await createSession(user.id, { ip, userAgent: ua });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    response.headers.set("Set-Cookie", buildSetCookieHeader(token, expiresAt));
    return response;
  } catch (err) {
    console.error("[auth/login] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

