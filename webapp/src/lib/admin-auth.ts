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
