import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { checkEmailLookup } from "@/lib/auth-rate-limiter";
import { createAuthHintValue, getAuthHintSetCookie, isAuthHintConfigured } from "@/lib/auth-hint";

/**
 * POST /api/auth/check-email
 *
 * Checks if an email exists in the users table and sets an HMAC-signed
 * HttpOnly cookie with the result. The response body is always identical
 * ({ continue: true }) to prevent email enumeration attacks.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAuthHintConfigured()) {
      console.error("[auth/check-email] AUTH_HINT_SECRET is not configured");
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

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

    // Create signed hint cookie payload (result + issuedAt + nonce + HMAC signature).
    const hintValue = createAuthHintValue(result);

    // Always return the same response body
    const response = NextResponse.json({ continue: true });

    // Set HttpOnly cookie with the hint
    response.headers.set(
      "Set-Cookie",
      getAuthHintSetCookie(hintValue)
    );

    return response;
  } catch (err) {
    console.error("[auth/check-email] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

