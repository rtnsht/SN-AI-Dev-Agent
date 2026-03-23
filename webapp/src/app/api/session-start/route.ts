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
import { getClientIp } from "@/lib/client-ip";
import { parseSessionStartBody } from "@/lib/request-validation";
import { checkSessionStart } from "@/lib/auth-rate-limiter";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = parseSessionStartBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const {
      sessionId,
      instanceUrl,
      username,
      userFullName,
      model,
      aiProvider,
      nodeVersion,
    } = parsed.data;

    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "unknown";
    const userId = await resolveUserId(request);

    const rateLimit = await checkSessionStart(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many session starts. Please try again later." }, { status: 429 });
    }

    const ownership = await getExistingSessionOwner(sessionId);
    if (ownership.exists && ownership.userId !== userId) {
      console.error(`[session-start] IDOR attempt detected: User ${userId} tried to overwrite session ${sessionId} belonging to ${ownership.userId}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Persist session metadata before logging/telemetry so unauthorized callers cannot poison an existing session.
    try {
      await createSessionLog(sessionId, userId, {
        instanceUrl, username, userFullName, aiProvider, model,
      }, ip, userAgent);
    } catch (logErr) {
      console.error("[session-start] session_logs write failed:", logErr);
      return NextResponse.json(
        { error: "Failed to persist session. Check database connectivity.", success: false },
        { status: 503 }
      );
    }

    log("info", sessionId, "session_connect", "Session started — user connected to instance", {
      instanceUrl: instanceUrl || "",
      username: username || "",
      userFullName: userFullName || "",
      model: model || "",
      aiProvider: aiProvider || "",
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
    if (instanceUrl && userId) {
      captureInstance(userId, instanceUrl, username).catch(() => { /* non-critical */ });
    }

    return NextResponse.json({ success: true, sessionId });
  } catch (err) {
    console.error("[session-start] Error:", err);
    return NextResponse.json(
      { error: "Failed to start session" },
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
async function getExistingSessionOwner(sessionId: string): Promise<{ exists: boolean; userId: string | null }> {
  const db = getSupabase();
  const { data } = await db
    .from("session_logs")
    .select("user_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!data) return { exists: false, userId: null };
  return { exists: true, userId: data.user_id || null };
}

async function createSessionLog(
  sessionId: string,
  userId: string | null,
  metadata: { instanceUrl?: string; username?: string; userFullName?: string; aiProvider?: string; model?: string },
  ip: string,
  userAgent: string
): Promise<void> {
  const db = getSupabase();

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
    throw new Error(error.message);
  }
}

/** Upsert the connected instance into user_instances for admin visibility */
async function captureInstance(userId: string, instanceUrl: string, snUsername?: string) {
  try {
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
