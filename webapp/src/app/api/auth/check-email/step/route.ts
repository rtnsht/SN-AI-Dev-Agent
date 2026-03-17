import { NextRequest, NextResponse } from "next/server";
import { getAuthHintClearCookie, isAuthHintConfigured, verifyAuthHintValue } from "@/lib/auth-hint";

/**
 * GET /api/auth/check-email/step
 *
 * Reads the auth_hint HttpOnly cookie set by POST /api/auth/check-email,
 * verifies the HMAC signature, and returns the next step for the login flow.
 *
 * Returns: { step: "password" } for known users, { step: "request" } for unknown.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isAuthHintConfigured()) {
      console.error("[auth/check-email/step] AUTH_HINT_SECRET is not configured");
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    const hintCookie = request.cookies.get("auth_hint")?.value;

    if (!hintCookie) {
      return NextResponse.json({ error: "No hint available" }, { status: 400 });
    }

    const verified = verifyAuthHintValue(hintCookie);
    if (!verified) {
      return NextResponse.json({ error: "Invalid hint" }, { status: 400 });
    }

    // Clear the cookie after reading
    const response = NextResponse.json({
      step: verified.result === "known" ? "password" : "request",
    });
    response.headers.set(
      "Set-Cookie",
      getAuthHintClearCookie()
    );

    return response;
  } catch (err) {
    console.error("[auth/check-email/step] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

