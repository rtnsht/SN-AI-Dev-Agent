import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  validateSession,
  hashPassword,
  validatePasswordStrength,
  upgradeSession,
  buildSetCookieHeader,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    // Validate password strength
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json({ error: strength.message }, { status: 400 });
    }

    // Must have a valid session (temporary or full)
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Hash and store password
    const hash = await hashPassword(password);
    const db = getSupabase();

    await db
      .from("users")
      .update({
        password_hash: hash,
        must_set_password: false,
        last_login: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    // Upgrade temporary session to full session
    if (session.is_temporary) {
      const expiresAt = await upgradeSession(sessionToken);
      const response = NextResponse.json({ success: true, redirect: "/app" });
      response.headers.set("Set-Cookie", buildSetCookieHeader(sessionToken, expiresAt));
      return response;
    }

    return NextResponse.json({ success: true, redirect: "/" });
  } catch (err) {
    console.error("[auth/set-password] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

