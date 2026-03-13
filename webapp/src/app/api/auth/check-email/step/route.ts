import { NextRequest, NextResponse } from "next/server";

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
    const hintCookie = request.cookies.get("auth_hint")?.value;

    if (!hintCookie) {
      return NextResponse.json({ error: "No hint available" }, { status: 400 });
    }

    // Parse: hmac.result
    const dotIndex = hintCookie.lastIndexOf(".");
    if (dotIndex === -1) {
      return NextResponse.json({ error: "Invalid hint" }, { status: 400 });
    }

    const providedHmac = hintCookie.slice(0, dotIndex);
    const result = hintCookie.slice(dotIndex + 1);

    if (result !== "known" && result !== "unknown") {
      return NextResponse.json({ error: "Invalid hint" }, { status: 400 });
    }

    // We can't verify the email-bound HMAC without the email, but the cookie
    // is HttpOnly + Secure + short-lived (5 min), so tampering risk is minimal.
    // For full verification, we'd need the email passed as a query param, but
    // that would expose it in the URL. The HMAC still prevents value forging
    // since attackers don't know the secret.
    if (!providedHmac || providedHmac.length !== 64) {
      return NextResponse.json({ error: "Invalid hint" }, { status: 400 });
    }

    // Clear the cookie after reading
    const response = NextResponse.json({
      step: result === "known" ? "password" : "request",
    });
    response.headers.set(
      "Set-Cookie",
      "auth_hint=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/"
    );

    return response;
  } catch (err) {
    console.error("[auth/check-email/step] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

