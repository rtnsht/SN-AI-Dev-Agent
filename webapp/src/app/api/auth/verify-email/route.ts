import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { consumeAuthToken } from "@/lib/auth";
import { sendAdminNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Consume the email verification token
    const result = await consumeAuthToken(token, "email_verify");
    if (!result) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const db = getSupabase();

    // Update access request
    const { data: req, error } = await db
      .from("access_requests")
      .update({ status: "pending", email_verified: true })
      .eq("email", result.email)
      .eq("status", "pending_verification")
      .select("name, email, company, use_case, created_at")
      .single();

    if (error || !req) {
      return NextResponse.json({ error: "Request not found or already verified" }, { status: 400 });
    }

    // Notify admin
    await sendAdminNotification(
      req.name,
      req.email,
      req.company,
      req.use_case,
      req.created_at
    );

    return NextResponse.json({ success: true, message: "Email verified! We'll review your request." });
  } catch (err) {
    console.error("[auth/verify-email] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

