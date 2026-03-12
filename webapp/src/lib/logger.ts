/**
 * Structured logging module for the ServiceNow AI Dev Agent webapp.
 * Creates session-specific log files with timestamps.
 */

import fs from "fs";
import path from "path";
import { updateTelemetry } from "./telemetry-generator";

// Log levels
export type LogLevel = "info" | "warn" | "error" | "debug";

// Session context for structured logging
export interface SessionContext {
  sessionId: string;
  username?: string;
  instanceUrl?: string;
  ip?: string;
  startTime: Date;
}

// Log entry structure
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  sessionId: string;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

// Active sessions map (for tracking within single request lifecycle)
const sessions = new Map<string, SessionContext>();

// Logs directory (at project root)
const LOGS_DIR = path.join(process.cwd(), "logs");

// Ensure logs directory exists
function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

// Generate unique session ID
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Get log filename for a session - DETERMINISTIC based on sessionId
// This ensures the same sessionId always maps to the same log file,
// even across different API requests (important for serverless/edge where
// in-memory state doesn't persist across requests)
function getLogFilename(sessionId: string): string {
  // Extract the timestamp and random suffix from the session ID
  // Format: sess_<timestamp>_<random>
  // We use this to create a stable, deterministic filename
  const parts = sessionId.split('_');
  if (parts.length >= 3) {
    const timestamp = parts[1];
    const suffix = parts[2];
    // Convert timestamp to date format for readability
    const date = new Date(parseInt(timestamp));
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `session-${dateStr}-${timestamp}-${suffix}.txt`;
  }
  // Fallback for non-standard session IDs
  return `session-${sessionId.replace(/[^a-zA-Z0-9]/g, '-')}.txt`;
}

// Redact sensitive data from objects
function redactSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("apikey") ||
      lowerKey.includes("api_key") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("credential")
    ) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Create a new session
export function createSession(context: Partial<SessionContext> & { sessionId?: string }): SessionContext {
  const sessionId = context.sessionId || generateSessionId();
  const session: SessionContext = {
    sessionId,
    username: context.username,
    instanceUrl: context.instanceUrl,
    ip: context.ip,
    startTime: new Date(),
  };
  sessions.set(sessionId, session);

  // Log session start
  log("info", sessionId, "session", "Session started", {
    username: session.username,
    instanceUrl: session.instanceUrl,
    ip: session.ip,
  });

  return session;
}

// Get session by ID
export function getSession(sessionId: string): SessionContext | undefined {
  return sessions.get(sessionId);
}

// End session
export function endSession(sessionId: string, outcome: "success" | "error" | "cancelled"): void {
  const session = sessions.get(sessionId);
  if (session) {
    const durationMs = Date.now() - session.startTime.getTime();
    log("info", sessionId, "session", "Session ended", { outcome, durationMs });
    sessions.delete(sessionId);
  }
}

// Core log function
export function log(
  level: LogLevel,
  sessionId: string,
  category: string,
  message: string,
  data?: Record<string, unknown>,
  durationMs?: number
): void {
  ensureLogsDir();

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    sessionId,
    category,
    message,
    ...(data && { data: redactSensitive(data) as Record<string, unknown> }),
    ...(durationMs !== undefined && { durationMs }),
  };

  // Format log line
  const logLine = JSON.stringify(entry) + "\n";

  // Write to session-specific file
  const filename = getLogFilename(sessionId);
  const filepath = path.join(LOGS_DIR, filename);
  fs.appendFileSync(filepath, logLine);

  // Trigger telemetry update (throttled to every 15s internally)
  if (sessionId.startsWith("sess_")) {
    try { updateTelemetry(sessionId); } catch { /* ignore telemetry errors */ }
  }

  // Also output to console for dev visibility
  const consoleMsg = `[${entry.level.toUpperCase()}] [${sessionId}] [${category}] ${message}`;
  if (level === "error") {
    console.error(consoleMsg, data ? redactSensitive(data) : "");
  } else if (level === "warn") {
    console.warn(consoleMsg, data ? redactSensitive(data) : "");
  } else {
    console.log(consoleMsg, data ? redactSensitive(data) : "");
  }
}

// Convenience methods
export const logger = {
  info: (sessionId: string, category: string, message: string, data?: Record<string, unknown>) =>
    log("info", sessionId, category, message, data),
  warn: (sessionId: string, category: string, message: string, data?: Record<string, unknown>) =>
    log("warn", sessionId, category, message, data),
  error: (sessionId: string, category: string, message: string, data?: Record<string, unknown>) =>
    log("error", sessionId, category, message, data),
  debug: (sessionId: string, category: string, message: string, data?: Record<string, unknown>) =>
    log("debug", sessionId, category, message, data),
};

export default logger;

