import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { consumeAuthToken, createSession, buildSetCookieHeader } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Accept both magic_link and password_reset tokens
    const result = await consumeAuthToken(token);
    if (!result || (result.type !== "magic_link" && result.type !== "password_reset")) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const db = getSupabase();

    // Find user
    const { data: user } = await db
      .from("users")
      .select("id, email, name, role, status, must_set_password")
      .eq("email", result.email)
      .single();

    if (!user || user.status === "suspended") {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = request.headers.get("user-agent") || "";

    // If user needs to set password, create temporary session
    if (user.must_set_password || result.type === "password_reset") {
      const { token: sessionToken, expiresAt } = await createSession(user.id, {
        ip,
        userAgent: ua,
        temporary: true,
      });

      const response = NextResponse.json({
        success: true,
        mustSetPassword: true,
        redirect: "/auth/set-password",
      });
      response.headers.set("Set-Cookie", buildSetCookieHeader(sessionToken, expiresAt));
      return response;
    }

    // Full session
    const { token: sessionToken, expiresAt } = await createSession(user.id, { ip, userAgent: ua });

    // Update last_login
    await db.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);

    const response = NextResponse.json({
      success: true,
      mustSetPassword: false,
      redirect: "/app",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    response.headers.set("Set-Cookie", buildSetCookieHeader(sessionToken, expiresAt));
    return response;
  } catch (err) {
    console.error("[auth/verify-magic-link] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

