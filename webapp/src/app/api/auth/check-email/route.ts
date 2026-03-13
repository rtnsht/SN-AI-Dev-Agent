import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabase } from "@/lib/supabase";
import { checkEmailLookup } from "@/lib/auth-rate-limiter";

const AUTH_HINT_SECRET = process.env.AUTH_HINT_SECRET || "default-hint-secret-change-me";

/**
 * POST /api/auth/check-email
 *
 * Checks if an email exists in the users table and sets an HMAC-signed
 * HttpOnly cookie with the result. The response body is always identical
 * ({ continue: true }) to prevent email enumeration attacks.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkEmailLookup(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = getSupabase();

    // Check if user exists
    const { data: user } = await db
      .from("users")
      .select("id, status")
      .eq("email", normalizedEmail)
      .single();

    // Determine result: "known" if active user exists, "unknown" otherwise
    const result = user && user.status !== "suspended" ? "known" : "unknown";

    // Create HMAC-signed hint: HMAC(email|result) + "." + result
    const hmac = crypto
      .createHmac("sha256", AUTH_HINT_SECRET)
      .update(`${normalizedEmail}|${result}`)
      .digest("hex");
    const hintValue = `${hmac}.${result}`;

    // Always return the same response body
    const response = NextResponse.json({ continue: true });

    // Set HttpOnly cookie with the hint
    response.headers.set(
      "Set-Cookie",
      `auth_hint=${hintValue}; HttpOnly; Secure; SameSite=Lax; Max-Age=300; Path=/`
    );

    return response;
  } catch (err) {
    console.error("[auth/check-email] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

