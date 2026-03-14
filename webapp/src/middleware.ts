/**
 * Auth gate middleware.
 * Intercepts all requests, validates session cookies, enforces role checks.
 * Uses Node.js runtime (not edge) for Supabase client compatibility.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateSession, seedAdmin, SESSION_COOKIE_NAME, buildClearCookieHeader } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, *.svg, *.png, *.jpg, *.ico (static assets)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)",
  ],
};

/** Routes that don't require authentication */
const PUBLIC_PATHS = [
  "/login",
  "/request-access",
  "/auth/verify",
  "/auth/verify-email",
  "/auth/set-password",
  "/api/auth/",           // includes /api/auth/check-email
  "/api/config",
  "/api/instance-prompts",
  "/api/openrouter-models",
  "/api/feedback",
  "/api/banners",
];

/** Check if a path is public (no auth needed) */
function isPublicPath(pathname: string): boolean {
  // Root landing page
  if (pathname === "/") return true;

  // Invite code pages
  if (pathname.startsWith("/invite/")) return true;

  // Public paths
  for (const p of PUBLIC_PATHS) {
    if (pathname === p || pathname.startsWith(p)) return true;
  }

  // Next.js internals
  if (pathname.startsWith("/_next/")) return true;

  return false;
}

/** Check if a path requires admin role */
function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Dev bypass: skip all auth when BYPASS_AUTH=true ──────────────────────
  // Safe because: (a) webapp/.env is never deployed to Render,
  // (b) render.yaml explicitly sets BYPASS_AUTH=false.
  if (process.env.BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  // Seed admin on first request (idempotent)
  try {
    await seedAdmin();
  } catch {
    // Non-fatal — don't block requests if seed fails
  }

  // Public routes — allow through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Extract session cookie
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return redirectToLogin(request);
  }

  // Validate session
  const session = await validateSession(sessionToken);

  if (!session) {
    // Invalid or expired session — clear cookie and redirect
    const response = redirectToLogin(request);
    response.headers.set("Set-Cookie", buildClearCookieHeader());
    return response;
  }

  // Temporary session (set-password flow) — only allow /auth/set-password and its API
  if (session.is_temporary) {
    if (pathname === "/auth/set-password" || pathname === "/api/auth/set-password") {
      return addUserHeaders(request, session.user);
    }
    // Redirect to set-password for any other route
    return NextResponse.redirect(new URL("/auth/set-password", request.url));
  }

  // Admin routes — check role
  if (isAdminPath(pathname)) {
    if (session.user.role !== "admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // Authenticated — pass through with user context in headers
  return addUserHeaders(request, session.user);
}

/** Redirect to login page (for pages) or return 401 (for API routes) */
function redirectToLogin(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

/** Attach user info to request headers for downstream route handlers */
function addUserHeaders(
  request: NextRequest,
  user: { id: string; email: string; name: string; role: string }
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", user.id);
  requestHeaders.set("x-user-email", user.email);
  requestHeaders.set("x-user-name", user.name);
  requestHeaders.set("x-user-role", user.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

