import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, type SessionData, validateSession } from "@/lib/auth";

export type UserAuthResult =
  | { ok: true; session: SessionData }
  | { ok: false; response: NextResponse };

interface RequireUserSessionOptions {
  allowTemporary?: boolean;
}

/**
 * Require a valid app session for non-admin routes.
 * Respects local auth bypass in development to match proxy behavior.
 */
export async function requireUserSession(
  request: NextRequest,
  options: RequireUserSessionOptions = {}
): Promise<UserAuthResult> {
  if (process.env.NODE_ENV !== "production" && process.env.BYPASS_AUTH === "true") {
    return {
      ok: true,
      session: {
        session_id: "bypass-session",
        user: {
          id: "bypass-user",
          email: "bypass@example.com",
          name: "Bypass User",
          role: "user",
          status: "active",
          must_set_password: false,
        },
        is_temporary: false,
      },
    };
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const session = await validateSession(token);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!options.allowTemporary && session.is_temporary) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true, session };
}
