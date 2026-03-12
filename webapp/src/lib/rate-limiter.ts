/**
 * In-memory rate limiter for server-key usage.
 * Tracks requests per IP within a sliding window.
 *
 * Only applies when the user is consuming the server-provided Claude API key.
 * Users who supply their own key bypass the limiter entirely.
 */

const WINDOW_MS = (parseInt(process.env.RATE_LIMIT_WINDOW_HOURS || "4", 10) || 4) * 60 * 60 * 1000;
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || "10", 10) || 10;

interface BucketEntry {
  timestamps: number[];
}

// Global in-memory store (survives across requests but not server restarts)
const buckets = new Map<string, BucketEntry>();

function prune(entry: BucketEntry, now: number): void {
  const cutoff = now - WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
}

export interface UsageInfo {
  used: number;
  max: number;
  remaining: number;
  resetsAt: string | null; // ISO timestamp of when the oldest request expires
  windowHours: number;
}

/**
 * Check current usage for an IP without consuming a request.
 */
export function getUsage(ip: string): UsageInfo {
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry) {
    return { used: 0, max: MAX_REQUESTS, remaining: MAX_REQUESTS, resetsAt: null, windowHours: WINDOW_MS / 3600000 };
  }
  prune(entry, now);
  const used = entry.timestamps.length;
  const oldest = entry.timestamps[0];
  return {
    used,
    max: MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - used),
    resetsAt: oldest ? new Date(oldest + WINDOW_MS).toISOString() : null,
    windowHours: WINDOW_MS / 3600000,
  };
}

/**
 * Attempt to consume one request for this IP.
 * Returns { allowed, usage }.
 */
export function consume(ip: string): { allowed: boolean; usage: UsageInfo } {
  const now = Date.now();
  let entry = buckets.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(ip, entry);
  }
  prune(entry, now);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    return { allowed: false, usage: getUsage(ip) };
  }

  entry.timestamps.push(now);
  return { allowed: true, usage: getUsage(ip) };
}

export { MAX_REQUESTS, WINDOW_MS };

