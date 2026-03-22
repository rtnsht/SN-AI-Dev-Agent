/**
 * Server-side admin checks for /api/admin/* routes.
 * Uses the session cookie — never trust client-supplied x-user-id for authorization.
 */
import { NextRequest, NextResponse } from "next/server";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

export type AdminAuthResult =
  | { ok: true; session: SessionData }
  | { ok: false; response: NextResponse };

/**
 * Require a valid non-temporary session whose user has role `admin`.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminAuthResult> {
  // Respect BYPASS_AUTH for local development
  if (process.env.NODE_ENV !== "production" && process.env.BYPASS_AUTH === "true") {
    return { 
      ok: true, 
      session: { 
        id: "bypass-session", 
        user: { id: "bypass-user", email: "bypass@example.com", name: "Bypass Admin", role: "admin", status: "active", created_at: new Date().toISOString() }, 
        is_temporary: false, 
        expires_at: new Date(Date.now() + 86400000).toISOString() 
      } 
    };
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const session = await validateSession(token);
  if (!session || session.is_temporary) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (session.user.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, session };
}
