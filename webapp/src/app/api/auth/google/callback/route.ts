/**
 * Google OAuth 2.0 Flow - Callback
 * GET /api/auth/google/callback
 *
 * Handles the OAuth callback from Google:
 * 1. Validates state token (CSRF protection)
 * 2. Exchanges authorization code for tokens
 * 3. Fetches user info from Google
 * 4. Creates/finds user in database
 * 5. Creates session and redirects to /app
 */

import { NextRequest, NextResponse } from "next/server";
import { createSession, buildSetCookieHeader } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getClientIp } from "@/lib/client-ip";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getAppUrl(request: NextRequest): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
}

function getRedirectUri(request: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${getAppUrl(request)}/api/auth/google/callback`;
}

// Google OAuth 2.0 endpoints
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);
  const redirectUri = getRedirectUri(request);

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors from Google
    if (error) {
      console.error("[auth/google/callback] OAuth error:", error);
      return NextResponse.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Google authentication was cancelled or failed")}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Invalid OAuth response")}`
      );
    }

    // Verify Google OAuth is configured
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("[auth/google/callback] Google OAuth credentials not configured");
      return NextResponse.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Google OAuth is not configured")}`
      );
    }

    const db = getSupabase();
    const nowIso = new Date().toISOString();

    // Step 1: Validate state token (CSRF protection) and extract redirect
    // Try oauth_states table first, then fall back to auth_tokens
    const { data: oauthState, error: stateError } = await db
      .from("oauth_states")
      .delete()
      .eq("state", state)
      .gt("expires_at", nowIso)
      .select("state")
      .maybeSingle();

    let stateValid = !!oauthState;
    let redirectPath = "/app"; // Default redirect

    // If oauth_states table doesn't exist, try auth_tokens fallback
    if (stateError && (stateError.message.includes("does not exist") || stateError.message.includes("could not find"))) {
      const { data: tokenData, error: tokenError } = await db
        .from("auth_tokens")
        .update({ used_at: nowIso })
        .eq("token", state)
        .eq("type", "oauth_state")
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .select("token")
        .maybeSingle();

      stateValid = !!tokenData;

      if (tokenError) {
        console.error("[auth/google/callback] State validation error:", tokenError.message);
      }
    } else if (stateError) {
      console.error("[auth/google/callback] State validation error:", stateError.message);
    }

    // Try to decode state to get redirect path
    if (stateValid) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        if (stateData.redirect) {
          redirectPath = stateData.redirect;
        }
      } catch (e) {
        // If state parsing fails, use default redirect
        console.warn("[auth/google/callback] Failed to parse state redirect:", e);
      }
    }

    if (!stateValid) {
      return NextResponse.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Invalid or expired OAuth state. Please try again.")}`
      );
    }

    // Step 2: Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[auth/google/callback] Token exchange failed:", errorText);
      return NextResponse.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Failed to exchange authorization code")}`
      );
    }

    const tokens: GoogleTokens = await tokenResponse.json();

    // Step 3: Fetch user info from Google
    const userinfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userinfoResponse.ok) {
      console.error("[auth/google/callback] Failed to fetch user info");
      return NextResponse.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Failed to fetch user information from Google")}`
      );
    }

    const googleUser: GoogleUserInfo = await userinfoResponse.json();

    // Validate we got required fields
    if (!googleUser.email) {
      return NextResponse.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Google account does not have an email address")}`
      );
    }

    const normalizedEmail = googleUser.email.toLowerCase().trim();
    const displayName = googleUser.name || googleUser.given_name || normalizedEmail.split("@")[0];

    // Step 4: Find or create user in database
    // First try to find by google_id, then by email
    let { data: existingUser } = await db
      .from("users")
      .select("id, email, name, role, status, auth_provider, google_id")
      .eq("google_id", googleUser.id)
      .maybeSingle();

    if (!existingUser) {
      // Check if user exists with this email
      const { data: emailUser } = await db
        .from("users")
        .select("id, email, name, role, status, auth_provider, google_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (emailUser) {
        // Link Google account to existing email user
        const { data: updatedUser, error: updateError } = await db
          .from("users")
          .update({
            google_id: googleUser.id,
            auth_provider: "google",
            last_login: nowIso,
          })
          .eq("id", emailUser.id)
          .select("id, email, name, role, status, auth_provider, google_id")
          .single();

        if (updateError) {
          console.error("[auth/google/callback] Failed to link Google account:", updateError.message);
          return NextResponse.redirect(
            `${appUrl}/login?error=${encodeURIComponent("Failed to link Google account")}`
          );
        }

        existingUser = updatedUser;
      } else {
        // Create new user with Google OAuth
        const { data: newUser, error: createError } = await db
          .from("users")
          .insert({
            email: normalizedEmail,
            name: displayName,
            google_id: googleUser.id,
            auth_provider: "google",
            password_hash: null, // No password for OAuth users
            must_set_password: false,
            role: "user",
            status: "active",
            last_login: nowIso,
          })
          .select("id, email, name, role, status, auth_provider, google_id")
          .single();

        if (createError) {
          console.error("[auth/google/callback] Failed to create user:", createError.message);
          return NextResponse.redirect(
            `${appUrl}/login?error=${encodeURIComponent("Failed to create account")}`
          );
        }

        existingUser = newUser;
      }
    } else {
      // Update last_login for existing Google user
      await db
        .from("users")
        .update({ last_login: nowIso })
        .eq("id", existingUser.id);
    }

    // Ensure we have a user (should always be true at this point)
    if (!existingUser) {
      return NextResponse.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Failed to authenticate user")}`
      );
    }

    // Check if user is suspended
    if (existingUser.status === "suspended") {
      return NextResponse.redirect(
        `${appUrl}/login?error=${encodeURIComponent("Account has been suspended")}`
      );
    }

    // Step 5: Create session
    const ip = getClientIp(request);
    const ua = request.headers.get("user-agent") || "";
    const { token: sessionToken, expiresAt } = await createSession(existingUser.id, {
      ip,
      userAgent: ua,
    });

    // Step 6: Redirect to stored redirect path with session cookie
    const response = NextResponse.redirect(`${appUrl}${redirectPath}`);
    response.headers.set("Set-Cookie", buildSetCookieHeader(sessionToken, expiresAt));

    return response;
  } catch (err) {
    console.error("[auth/google/callback] Error:", err);
    return NextResponse.redirect(
      `${appUrl}/login?error=${encodeURIComponent("An unexpected error occurred")}`
    );
  }
}
