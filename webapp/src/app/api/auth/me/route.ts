import { NextRequest, NextResponse } from "next/server";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Returns the currently logged-in user's info from session cookie.
 */
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = await validateSession(sessionToken);
  if (!session || session.is_temporary) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, email, name, role } = session.user;
  return NextResponse.json({ id, email, name, role });
}
