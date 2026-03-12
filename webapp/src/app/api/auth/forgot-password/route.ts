import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createAuthToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkForgotPassword } from "@/lib/auth-rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit
    const rl = checkForgotPassword(normalizedEmail);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Always return success (no enumeration)
    const successMsg = "If this email is registered, you'll receive a password reset link.";

    const db = getSupabase();
    const { data: user } = await db
      .from("users")
      .select("id, name, email, status")
      .eq("email", normalizedEmail)
      .single();

    if (!user || user.status === "suspended") {
      return NextResponse.json({ success: true, message: successMsg });
    }

    // Generate password reset token and send email
    const { token } = await createAuthToken(normalizedEmail, "password_reset", user.id);
    await sendPasswordResetEmail(user.name, user.email, token);

    return NextResponse.json({ success: true, message: successMsg });
  } catch (err) {
    console.error("[auth/forgot-password] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

