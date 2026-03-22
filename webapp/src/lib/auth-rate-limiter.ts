/**
 * Auth-specific rate limiter for brute force protection.
 * Uses DB-backed counters when available, with in-memory fallback.
 */
import { getSupabase } from "@/lib/supabase";

interface RateBucket {
  timestamps: number[];
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
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

function checkInMemory(key: string, maxAttempts: number, windowMs: number): RateLimitResult {
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

async function checkWithSupabase(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  if (process.env.AUTH_RATE_LIMIT_USE_DB === "false") return null;

  try {
    const sb = getSupabase();
    const { data, error } = await sb.rpc("check_auth_rate_limit", {
      p_key: key,
      p_max_attempts: maxAttempts,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });

    if (error || !data || !Array.isArray(data) || data.length === 0) return null;
    const row = data[0] as {
      allowed?: boolean;
      remaining?: number;
      retry_after_seconds?: number;
    };

    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining ?? 0),
      retryAfterMs: Math.max(0, Number(row.retry_after_seconds ?? 0) * 1000),
    };
  } catch {
    return null;
  }
}

async function check(key: string, maxAttempts: number, windowMs: number): Promise<RateLimitResult> {
  const dbResult = await checkWithSupabase(key, maxAttempts, windowMs);
  if (dbResult) return dbResult;
  return checkInMemory(key, maxAttempts, windowMs);
}

// ── Pre-configured limiters ─────────────────────────────────────

const LOGIN_MAX = parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10) || 5;
const LOGIN_WINDOW = (parseInt(process.env.LOGIN_WINDOW_MINUTES || "15", 10) || 15) * 60 * 1000;
const SESSION_START_MAX = parseInt(process.env.SESSION_START_MAX_ATTEMPTS || "30", 10) || 30;
const SESSION_START_WINDOW = (parseInt(process.env.SESSION_START_WINDOW_MINUTES || "60", 10) || 60) * 60 * 1000;

/** Login: 5 attempts per email per 15 min */
export async function checkLogin(email: string): Promise<RateLimitResult> {
  return check(`login:${email.toLowerCase()}`, LOGIN_MAX, LOGIN_WINDOW);
}

/** Forgot password: 3 per email per hour */
export async function checkForgotPassword(email: string): Promise<RateLimitResult> {
  return check(`forgot:${email.toLowerCase()}`, 3, 60 * 60 * 1000);
}

/** Request access: 10 per IP per hour */
export async function checkRequestAccess(ip: string): Promise<RateLimitResult> {
  return check(`request:${ip}`, 10, 60 * 60 * 1000);
}

/** Invite registration: 10 per IP per hour */
export async function checkInviteRegister(ip: string): Promise<RateLimitResult> {
  return check(`invite:${ip}`, 10, 60 * 60 * 1000);
}

/** Email lookup (check-email): 20 per IP per 15 min */
export async function checkEmailLookup(ip: string): Promise<RateLimitResult> {
  return check(`emaillookup:${ip}`, 20, 15 * 60 * 1000);
}

/** OTP verification: 5 attempts per email per 10 min */
export async function checkOTPVerify(email: string): Promise<RateLimitResult> {
  return check(`otp:${email.toLowerCase()}`, 5, 10 * 60 * 1000);
}

/** Feedback submission: 5 per IP per hour */
export async function checkFeedbackSubmission(ip: string): Promise<RateLimitResult> {
  return check(`feedback:${ip}`, 5, 60 * 60 * 1000);
}

/** Session lifecycle start: 30 starts per IP per hour */
export async function checkSessionStart(ip: string): Promise<RateLimitResult> {
  return check(`sessionstart:${ip}`, SESSION_START_MAX, SESSION_START_WINDOW);
}

