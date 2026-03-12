/**
 * Auth-specific rate limiter for brute force protection.
 * In-memory sliding window, keyed by email or IP depending on endpoint.
 */

interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const maxWindow = 60 * 60 * 1000; // 1 hour (largest window we use)
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => t > now - maxWindow);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}, 10 * 60 * 1000);

function check(key: string, maxAttempts: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Prune expired
  bucket.timestamps = bucket.timestamps.filter((t) => t > now - windowMs);

  if (bucket.timestamps.length >= maxAttempts) {
    const oldest = bucket.timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  bucket.timestamps.push(now);
  return { allowed: true, remaining: maxAttempts - bucket.timestamps.length, retryAfterMs: 0 };
}

// ── Pre-configured limiters ─────────────────────────────────────

const LOGIN_MAX = parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10) || 5;
const LOGIN_WINDOW = (parseInt(process.env.LOGIN_WINDOW_MINUTES || "15", 10) || 15) * 60 * 1000;

/** Login: 5 attempts per email per 15 min */
export function checkLogin(email: string) {
  return check(`login:${email.toLowerCase()}`, LOGIN_MAX, LOGIN_WINDOW);
}

/** Forgot password: 3 per email per hour */
export function checkForgotPassword(email: string) {
  return check(`forgot:${email.toLowerCase()}`, 3, 60 * 60 * 1000);
}

/** Request access: 10 per IP per hour */
export function checkRequestAccess(ip: string) {
  return check(`request:${ip}`, 10, 60 * 60 * 1000);
}

/** Invite registration: 10 per IP per hour */
export function checkInviteRegister(ip: string) {
  return check(`invite:${ip}`, 10, 60 * 60 * 1000);
}

