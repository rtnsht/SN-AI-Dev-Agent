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
  "/app",                 // open to everyone (3-tier rate limiting handles access)
  "/clearcache",          // clear browser storage + redirect (no auth)
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
  "/api/chat",            // open for anonymous access (rate-limited server-side)
  "/api/chat-stream",     // open for anonymous access (rate-limited server-side)
  "/api/trial-status",    // trial status check (works for anon too)
  "/api/test-connection",  // SN instance connect (used from public /app page)
  "/api/session-start",    // session telemetry init (used from public /app page)
  "/api/session-end",      // session finalization (used from public /app page + sendBeacon)
];
const USER_CONTEXT_HEADERS = ["x-user-id", "x-user-email", "x-user-name", "x-user-role"] as const;

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

/** Remove any client-supplied user context headers before routing. */
function sanitizeUserHeaders(headers: Headers): Headers {
  const sanitized = new Headers(headers);
  for (const headerName of USER_CONTEXT_HEADERS) {
    sanitized.delete(headerName);
  }
  return sanitized;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Landing page redirect ────────────────────────────────────────────────
  // When SKIP_LANDING_PAGE=true, always redirect "/" → "/app" (skips the
  // marketing page entirely). Works regardless of auth state.
  if (pathname === "/" && process.env.SKIP_LANDING_PAGE === "true") {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  // ── Dev bypass: skip all auth when BYPASS_AUTH=true (disabled in production) ──
  if (process.env.BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production") {
    // Even with auth bypass, redirect "/" → "/app" if user has a session
    if (pathname === "/") {
      const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (sessionToken) {
        try {
          const session = await validateSession(sessionToken);
          if (session && !session.is_temporary) {
            return NextResponse.redirect(new URL("/app", request.url));
          }
        } catch {
          // Non-fatal — proceed without redirect
        }
      }
    }
    return NextResponse.next({
      request: { headers: sanitizeUserHeaders(request.headers) },
    });
  }

  // Seed admin on first request (idempotent)
  try {
    await seedAdmin();
  } catch {
    // Non-fatal — don't block requests if seed fails
  }

  // Public routes — allow through (but enrich with user headers if authenticated)
  if (isPublicPath(pathname)) {
    // If user is on the landing page and has a valid session, redirect to /app
    if (pathname === "/") {
      const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (sessionToken) {
        const session = await validateSession(sessionToken);
        if (session && !session.is_temporary) {
          return NextResponse.redirect(new URL("/app", request.url));
        }
      }
    }

    // For public routes that benefit from user context (e.g., /app, /api/chat*),
    // attach user headers if authenticated — but don't block if not.
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionToken) {
      try {
        const session = await validateSession(sessionToken);
        if (session && !session.is_temporary) {
          return addUserHeaders(request, session.user);
        }
      } catch {
        // Non-fatal — proceed without user context
      }
    }
    return NextResponse.next({
      request: { headers: sanitizeUserHeaders(request.headers) },
    });
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
  const requestHeaders = sanitizeUserHeaders(request.headers);
  requestHeaders.set("x-user-id", user.id);
  requestHeaders.set("x-user-email", user.email);
  requestHeaders.set("x-user-name", user.name);
  requestHeaders.set("x-user-role", user.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

