import { NextRequest, NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE_NAME, buildClearCookieHeader } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", buildClearCookieHeader());
    return response;
  } catch (err) {
    console.error("[auth/logout] Error:", err);
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", buildClearCookieHeader());
    return response;
  }
}

