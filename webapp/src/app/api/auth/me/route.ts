import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/me
 * Returns the currently logged-in user's info from middleware headers.
 */
export async function GET(request: NextRequest) {
  const id = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const name = request.headers.get("x-user-name");
  const role = request.headers.get("x-user-role");

  if (!id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ id, email, name, role });
}
