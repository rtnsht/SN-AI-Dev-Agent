/**
 * POST /api/session-start
 * 
 * Called when user clicks "Connect" — logs connection metadata and
 * starts the live telemetry stream for this session.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { startTelemetryStream } from "@/lib/telemetry-generator";

// Track cleanup functions for active sessions
const sessionCleanups = new Map<string, () => void>();

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

    // Log the session connect event
    log(sessionId, "info", "session_connect", "Session started — user connected to instance", {
      instanceUrl: instanceUrl || "",
      username: username || "",
      userFullName: userFullName || "",
      model: model || "",
      aiProvider: aiProvider || "",
      hasAdmin: !!hasAdmin,
      hasSecurityAdmin: !!hasSecurityAdmin,
      nodeVersion: nodeVersion || "",
      connectTime: new Date().toISOString(),
    });

    // Stop any previous stream for this session
    if (sessionCleanups.has(sessionId)) {
      sessionCleanups.get(sessionId)!();
    }

    // Start live telemetry streaming (generates .md every 15s)
    const cleanup = startTelemetryStream(sessionId);
    sessionCleanups.set(sessionId, cleanup);

    return NextResponse.json({ success: true, sessionId });
  } catch (err) {
    console.error("[session-start] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

