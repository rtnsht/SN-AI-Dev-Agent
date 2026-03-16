import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { consumeOTPToken, createSession, buildSetCookieHeader } from "@/lib/auth";
import { checkOTPVerify } from "@/lib/auth-rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and verification code are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.trim();

    // Rate limit OTP attempts per email
    const rl = checkOTPVerify(normalizedEmail);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please request a new code." },
        { status: 429 }
      );
    }

    // Validate OTP
    const result = await consumeOTPToken(normalizedEmail, normalizedOTP);
    if (!result) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const db = getSupabase();

    // Update access request to approved + verified
    await db
      .from("access_requests")
      .update({ status: "approved", email_verified: true })
      .eq("email", normalizedEmail)
      .in("status", ["pending_verification", "pending"]);

    // Create user or find existing
    const { data: existingUser } = await db
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Get name from access request
      const { data: accessReq } = await db
        .from("access_requests")
        .select("name")
        .eq("email", normalizedEmail)
        .single();

      const { data: newUser, error: userErr } = await db
        .from("users")
        .insert({
          email: normalizedEmail,
          name: accessReq?.name || normalizedEmail.split("@")[0],
          role: "user",
          status: "active",
          must_set_password: true,
        })
        .select("id")
        .single();

      if (userErr || !newUser) {
        console.error("[auth/verify-otp] User create error:", userErr?.message);
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
      }
      userId = newUser.id;
    }

    // Create temporary session for password setup
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;
    const { token, expiresAt } = await createSession(userId, {
      ip,
      userAgent,
      temporary: true,
    });

    const res = NextResponse.json({
      success: true,
      redirect: "/auth/set-password",
    });

    res.headers.set("Set-Cookie", buildSetCookieHeader(token, expiresAt));
    return res;
  } catch (err) {
    console.error("[auth/verify-otp] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
