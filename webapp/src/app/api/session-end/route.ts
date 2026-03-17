/**
 * POST /api/session-end
 *
 * Called when user starts a new chat, or leaves the page (via sendBeacon).
 * Finalizes the session: flushes remaining log entries and marks it completed.
 */

import { NextRequest, NextResponse } from "next/server";
import { endSession, log } from "@/lib/logger";
import { getLogPersistence } from "@/lib/log-persistence";
import { sessionCleanups } from "@/app/api/session-start/route";
import { clearSessionCache } from "@/lib/session-cache";
import { cleanupDeltaState, stopTelemetryStream } from "@/lib/telemetry-generator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    log("info", sessionId, "session_end", "Session ended — client signaled end");
    stopTelemetryStream(sessionId);

    // Clean up telemetry stream (stops interval, clears lastGenTime)
    const cleanup = sessionCleanups.get(sessionId);
    if (cleanup) {
      cleanup();
      sessionCleanups.delete(sessionId);
    }

    // Clean up delta state in telemetry generator
    cleanupDeltaState(sessionId);

    // Clean up session cache
    clearSessionCache(sessionId);

    // endSession checks the in-memory sessions map; if found, it logs and
    // calls finalizeSession internally. If not found (e.g. server restarted),
    // we fall back to finalizing directly.
    endSession(sessionId, "success");

    // Fallback: if the session wasn't in the in-memory map, finalizeSession
    // was never called above. Safe to call again — it's idempotent (flush +
    // UPDATE status = completed).
    getLogPersistence()
      ?.finalizeSession(sessionId, { outcome: "completed" })
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[session-end] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
