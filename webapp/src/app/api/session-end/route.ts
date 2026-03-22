/**
 * POST /api/session-end
 *
 * Called when user starts a new chat, or leaves the page (via sendBeacon).
 * Finalizes the session: flushes remaining log entries and marks it completed.
 */

import { NextRequest, NextResponse } from "next/server";
import { endSession, log } from "@/lib/logger";
import { getLogPersistence } from "@/lib/log-persistence";
import { stopTelemetryStream } from "@/lib/telemetry-generator";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    // Prevent IDOR: Check if session belongs to the current user
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    let userId: string | null = null;
    if (sessionToken) {
      try {
        const authSession = await validateSession(sessionToken);
        userId = authSession?.user?.id || null;
      } catch {
        userId = null;
      }
    }

    const db = getSupabase();
    const { data: existingSession } = await db
      .from("session_logs")
      .select("user_id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existingSession && existingSession.user_id !== userId) {
      console.error(`[session-end] IDOR attempt detected: User ${userId} tried to end session ${sessionId} belonging to ${existingSession.user_id}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    log("info", sessionId, "session_end", "Session ended — client signaled end");
    stopTelemetryStream(sessionId);

    // endSession checks the in-memory sessions map; if found, it returns the
    // finalizeSession promise so we can await the flush before responding.
    // If not found (e.g. server restarted), we fall back to finalizing directly.
    const endPromise = endSession(sessionId, "success");

    try {
      if (endPromise) {
        await endPromise;
      } else {
        await getLogPersistence()?.finalizeSession(sessionId, { outcome: "completed" });
      }
    } catch (flushErr) {
      console.error("[session-end] finalizeSession error:", flushErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[session-end] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
