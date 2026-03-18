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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    log("info", sessionId, "session_end", "Session ended — client signaled end");
    stopTelemetryStream(sessionId);

    // endSession checks the in-memory sessions map; if found, it logs and
    // calls finalizeSession internally. If not found (e.g. server restarted),
    // we fall back to finalizing directly.
    endSession(sessionId, "success");

    // Fallback: if the session wasn't in the in-memory map, finalizeSession
    // was never called above. Safe to call again — guarded by finalized Set.
    try {
      await getLogPersistence()?.finalizeSession(sessionId, { outcome: "completed" });
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
