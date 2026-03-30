/**
 * Google OAuth 2.0 Flow - Initiate
 * GET /api/auth/google
 *
 * Redirects user to Google's consent screen with a CSRF-protected state token.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const OAUTH_STATE_EXPIRY_MINUTES = parseInt(process.env.OAUTH_STATE_EXPIRY_MINUTES || "10", 10);

function getRedirectUri(request: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const origin = process.env.APP_URL || request.nextUrl.origin;
  return `${origin}/api/auth/google/callback`;
}

// Google OAuth 2.0 authorization endpoint
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Scopes: openid for ID token, email for email address, profile for name
const SCOPES = ["openid", "email", "profile"];

export async function GET(request: NextRequest) {
  try {
    // Verify Google OAuth is configured
    if (!GOOGLE_CLIENT_ID) {
      console.error("[auth/google] GOOGLE_CLIENT_ID is not configured");
      return NextResponse.json(
        { error: "Google OAuth is not configured" },
        { status: 500 }
      );
    }

    // Get redirect parameter for post-login redirect
    const { searchParams } = new URL(request.url);
    const redirect = searchParams.get("redirect") || "/app";

    // Generate CSRF-protected state token (include redirect in state)
    const stateData = JSON.stringify({ 
      redirect,
      timestamp: Date.now() 
    });
    const state = Buffer.from(stateData).toString('base64');

    // Store state in database for later verification
    const db = getSupabase();
    const expiresAt = new Date(Date.now() + OAUTH_STATE_EXPIRY_MINUTES * 60 * 1000);

    const { error: stateError } = await db.from("oauth_states").insert({
      state,
      expires_at: expiresAt.toISOString(),
    });

    if (stateError) {
      // If oauth_states table doesn't exist, try auth_tokens as fallback
      if (stateError.message.includes("does not exist") || stateError.message.includes("could not find")) {
        const { error: tokenError } = await db.from("auth_tokens").insert({
          email: "", // Not used for OAuth state
          token: state,
          type: "oauth_state",
          expires_at: expiresAt.toISOString(),
        });

        if (tokenError) {
          console.error("[auth/google] Failed to store OAuth state:", tokenError.message);
          return NextResponse.json(
            { error: "Failed to initiate OAuth flow" },
            { status: 500 }
          );
        }
      } else {
        console.error("[auth/google] Failed to store OAuth state:", stateError.message);
        return NextResponse.json(
          { error: "Failed to initiate OAuth flow" },
          { status: 500 }
        );
      }
    }

    // Build Google authorization URL
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: getRedirectUri(request),
      response_type: "code",
      scope: SCOPES.join(" "),
      state,
      access_type: "offline", // Request refresh token
      prompt: "consent", // Force consent screen to get refresh token
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    // Redirect to Google consent screen
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[auth/google] Error initiating OAuth:", err);
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
