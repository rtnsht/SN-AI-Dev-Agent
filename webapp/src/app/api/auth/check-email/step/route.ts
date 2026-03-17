import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const EFFECTIVE_HINT_SECRET = process.env.AUTH_HINT_SECRET || "default-hint-secret-change-me";

/**
 * GET /api/auth/check-email/step?email=...
 *
 * Reads the auth_hint HttpOnly cookie set by POST /api/auth/check-email,
 * verifies the HMAC signature using the provided email, and returns the
 * next step for the login flow.
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

    if (!providedHmac || providedHmac.length !== 64) {
      return NextResponse.json({ error: "Invalid hint" }, { status: 400 });
    }

    // Verify HMAC if email is provided as query param
    const email = request.nextUrl.searchParams.get("email")?.toLowerCase().trim();
    if (email) {
      const expectedHmac = crypto
        .createHmac("sha256", EFFECTIVE_HINT_SECRET)
        .update(`${email}|${result}`)
        .digest("hex");

      if (!crypto.timingSafeEqual(Buffer.from(providedHmac, "hex"), Buffer.from(expectedHmac, "hex"))) {
        return NextResponse.json({ error: "Invalid hint" }, { status: 400 });
      }
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

