/**
 * POST /api/session-start
 *
 * Called when user clicks "Connect" — logs connection metadata and
 * starts the live telemetry stream for this session.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { startTelemetryStream, stopTelemetryStream } from "@/lib/telemetry-generator";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      instanceUrl,
      username,
      userFullName,
      model,
      aiProvider,
      hasAdmin,
      hasSecurityAdmin,
      nodeVersion,
    } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Log the session connect event (level first, then sessionId)
    log("info", sessionId, "session_connect", "Session started — user connected to instance", {
      instanceUrl: instanceUrl || "",
      username: username || "",
      userFullName: userFullName || "",
      model: model || "",
      aiProvider: aiProvider || "",
      hasAdmin: !!hasAdmin,
      hasSecurityAdmin: !!hasSecurityAdmin,
      nodeVersion: nodeVersion || "",
      ip,
      userAgent,
      connectTime: new Date().toISOString(),
    });

    // Stop any previous stream for this session (if one still exists).
    stopTelemetryStream(sessionId);

    // Start live telemetry streaming (generates .md every 15s)
    startTelemetryStream(sessionId);

    // Auto-capture instance in user_instances table (non-blocking)
    const userId = await resolveUserId(request);
    if (instanceUrl) {
      captureInstance(request, instanceUrl, username).catch(() => { /* non-critical */ });
    }

    // Persist session metadata to Supabase (awaited to guarantee row creation)
    await createSessionLog(sessionId, userId, {
      instanceUrl, username, userFullName, aiProvider, model,
    }, ip, userAgent);

    return NextResponse.json({ success: true, sessionId });
  } catch (err) {
    console.error("[session-start] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/** Resolve the authenticated user's ID from session cookie (returns null if unauthenticated) */
async function resolveUserId(request: NextRequest): Promise<string | null> {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) return null;
    const session = await validateSession(sessionToken);
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

/** Write session metadata directly to session_logs table.
 *  Uses getSupabase() directly (not through LogPersistence) to guarantee
 *  the row is created. Checks and logs Supabase errors instead of swallowing them. */
async function createSessionLog(
  sessionId: string,
  userId: string | null,
  metadata: { instanceUrl?: string; username?: string; userFullName?: string; aiProvider?: string; model?: string },
  ip: string,
  userAgent: string
): Promise<void> {
  try {
    const db = getSupabase();

    // Prevent IDOR: Check if session exists and belongs to a different user
    const { data: existingSession } = await db
      .from("session_logs")
      .select("user_id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existingSession && existingSession.user_id !== (userId || null)) {
      console.error(`[session-start] IDOR attempt detected: User ${userId} tried to overwrite session ${sessionId} belonging to ${existingSession.user_id}`);
      return;
    }

    const { error } = await db.from("session_logs").upsert(
      {
        session_id: sessionId,
        user_id: userId || null,
        instance_url: metadata.instanceUrl || null,
        username: metadata.username || null,
        user_full_name: metadata.userFullName || null,
        ai_provider: metadata.aiProvider || null,
        model: metadata.model || null,
        ip_address: ip,
        user_agent: userAgent,
        status: "active",
      },
      { onConflict: "session_id" }
    );
    if (error) {
      console.error("[session-start] session_logs write FAILED:", error.message, error.details, error.hint);
    }
  } catch (err) {
    console.error("[session-start] session_logs write error:", err);
  }
}

/** Upsert the connected instance into user_instances for admin visibility */
async function captureInstance(request: NextRequest, instanceUrl: string, snUsername?: string) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) return;

    const session = await validateSession(sessionToken);
    if (!session) return;

    const userId = session.user.id;
    const normalizedUrl = instanceUrl.replace(/\/+$/, "").toLowerCase();

    // Derive short instance name from URL (e.g. "https://dev181312.service-now.com" → "dev181312")
    const instanceName = normalizedUrl
      .replace(/^https?:\/\//, "")
      .replace(/\.service-now\.com.*$/, "")
      .replace(/\..+$/, "");

    const db = getSupabase();

    // Try insert first, on conflict update last_connected_at and sn_username
    const { error: insertErr } = await db.from("user_instances").upsert(
      {
        user_id: userId,
        instance_url: normalizedUrl,
        instance_name: instanceName || normalizedUrl,
        sn_username: snUsername || null,
        last_connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,instance_url" }
    );

    if (insertErr) {
      console.error("[session-start] Failed to capture instance:", insertErr.message);
    }
  } catch (err) {
    console.error("[session-start] captureInstance error:", err);
  }
}
