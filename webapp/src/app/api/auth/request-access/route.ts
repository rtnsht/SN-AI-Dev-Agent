import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createAuthToken } from "@/lib/auth";
import { sendVerifyEmail } from "@/lib/email";
import { checkRequestAccess } from "@/lib/auth-rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const { name, email, company, use_case } = await request.json();

    if (!name || !email || !use_case) {
      return NextResponse.json({ error: "Name, email, and use case are required" }, { status: 400 });
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

    // Check for duplicate — silent dedup (no enumeration)
    const { data: existing } = await db
      .from("access_requests")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existing) {
      // Already exists — return success silently
      return NextResponse.json({ success: true, message: "We've received your request." });
    }

    // Also check if user already exists
    const { data: existingUser } = await db
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingUser) {
      return NextResponse.json({ success: true, message: "We've received your request." });
    }

    // Create access request
    const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION !== "false";

    const { error } = await db.from("access_requests").insert({
      email: normalizedEmail,
      name: name.trim(),
      company: company?.trim() || null,
      use_case: use_case.trim(),
      status: requireVerification ? "pending_verification" : "pending",
      email_verified: !requireVerification,
    });

    if (error) {
      console.error("[auth/request-access] DB error:", error.message);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

    // Send verification email if required
    if (requireVerification) {
      const { token } = await createAuthToken(normalizedEmail, "email_verify");
      await sendVerifyEmail(name.trim(), normalizedEmail, token);
    }

    return NextResponse.json({ success: true, message: "We've received your request." });
  } catch (err) {
    console.error("[auth/request-access] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

