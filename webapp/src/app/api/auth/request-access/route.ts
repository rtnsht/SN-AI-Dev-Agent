import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createOTPToken } from "@/lib/auth";
import { sendOTPEmail } from "@/lib/email";
import { checkRequestAccess } from "@/lib/auth-rate-limiter";

/** Helper: send OTP and check result */
async function sendOTPAndCheck(name: string, email: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const result = await sendOTPEmail(name, email, otp);
  if (!result.success) {
    console.error("[auth/request-access] Email send failed:", result.error);
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, company, use_case } = await request.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRequestAccess(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const db = getSupabase();

    // If user already exists, still send OTP (don't reveal whether account exists)
    const { data: existingUser } = await db
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingUser) {
      const { otp } = await createOTPToken(normalizedEmail);
      const emailResult = await sendOTPAndCheck(name.trim(), normalizedEmail, otp);
      if (!emailResult.success) {
        return NextResponse.json({ error: "Failed to send verification email. Please try again later." }, { status: 502 });
      }
      return NextResponse.json({ success: true, requiresOTP: true });
    }

    // Upsert access request (allow re-requesting to resend OTP)
    const { data: existing } = await db
      .from("access_requests")
      .select("id, status")
      .eq("email", normalizedEmail)
      .single();

    if (existing) {
      if (existing.status === "approved") {
        const { otp } = await createOTPToken(normalizedEmail);
        const emailResult = await sendOTPAndCheck(name.trim(), normalizedEmail, otp);
        if (!emailResult.success) {
          return NextResponse.json({ error: "Failed to send verification email. Please try again later." }, { status: 502 });
        }
        return NextResponse.json({ success: true, requiresOTP: true });
      }
      // Update existing request with latest info
      const { error: updateError } = await db.from("access_requests").update({
        name: name.trim(),
        company: company?.trim() || null,
        use_case: use_case?.trim() || "Self-service signup",
        status: "pending_verification",
      }).eq("id", existing.id);

      if (updateError) {
        console.error("[auth/request-access] Update error:", updateError.message);
        return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
      }
    } else {
      const { error } = await db.from("access_requests").insert({
        email: normalizedEmail,
        name: name.trim(),
        company: company?.trim() || null,
        use_case: use_case?.trim() || "Self-service signup",
        status: "pending_verification",
        email_verified: false,
      });

      if (error) {
        console.error("[auth/request-access] DB error:", error.message);
        return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
      }
    }

    // Send OTP email
    const { otp } = await createOTPToken(normalizedEmail);
    const emailResult = await sendOTPAndCheck(name.trim(), normalizedEmail, otp);
    if (!emailResult.success) {
      return NextResponse.json({ error: "Failed to send verification email. Please try again later." }, { status: 502 });
    }

    return NextResponse.json({ success: true, requiresOTP: true });
  } catch (err) {
    console.error("[auth/request-access] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
