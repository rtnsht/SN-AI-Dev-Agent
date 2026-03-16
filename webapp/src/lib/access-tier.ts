/**
 * 3-Tier Access System
 *
 * Tier 1 — Anonymous:  IP-based daily limit (default: 10/day, admin-configurable)
 * Tier 2 — Authenticated: User-based daily limit (default: 20/day, admin-configurable)
 * Tier 3 — BYOK:       Unlimited (user provides their own API key)
 *
 * Limits are stored in Supabase `access_tier_config` table and cached in-memory.
 * Anonymous tracking uses in-memory IP buckets (reset on server restart).
 * Authenticated tracking uses Supabase `request_log` table.
 */

import { getSupabase } from "@/lib/supabase";

/* ── Types ──────────────────────────────────────────────── */

export type AccessTier = "anonymous" | "authenticated" | "byok";

export interface TierLimits {
  anonDailyLimit: number;
  authDailyLimit: number;
}

export interface AccessCheckResult {
  allowed: boolean;
  tier: AccessTier;
  dailyUsed: number;
  dailyLimit: number;
  /** Which gate to show when blocked */
  gate: "none" | "signup" | "apikey";
  message?: string;
}

/* ── Default limits (overridden by admin config) ────────── */

const DEFAULT_ANON_LIMIT = 10;
const DEFAULT_AUTH_LIMIT = 20;

/* ── In-memory cache for admin config ───────────────────── */

let cachedLimits: TierLimits | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // refresh every 60s

/**
 * Fetch tier limits from Supabase `access_tier_config` table.
 * Falls back to defaults if table doesn't exist or is empty.
 */
export async function getTierLimits(): Promise<TierLimits> {
  const now = Date.now();
  if (cachedLimits && now - cacheTimestamp < CACHE_TTL_MS) return cachedLimits;

  try {
    const sb = getSupabase();
    const { data } = await sb
      .from("access_tier_config")
      .select("anon_daily_limit, auth_daily_limit")
      .single();

    if (data) {
      cachedLimits = {
        anonDailyLimit: data.anon_daily_limit ?? DEFAULT_ANON_LIMIT,
        authDailyLimit: data.auth_daily_limit ?? DEFAULT_AUTH_LIMIT,
      };
    } else {
      cachedLimits = { anonDailyLimit: DEFAULT_ANON_LIMIT, authDailyLimit: DEFAULT_AUTH_LIMIT };
    }
  } catch {
    cachedLimits = { anonDailyLimit: DEFAULT_ANON_LIMIT, authDailyLimit: DEFAULT_AUTH_LIMIT };
  }

  cacheTimestamp = now;
  return cachedLimits;
}

/** Force-refresh cached limits (called after admin updates) */
export function invalidateTierCache(): void {
  cachedLimits = null;
  cacheTimestamp = 0;
}

/* ── Anonymous (IP-based) tracking — in-memory ──────────── */

interface AnonBucket {
  date: string; // YYYY-MM-DD
  count: number;
}

const anonBuckets = new Map<string, AnonBucket>();

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getAnonUsage(ip: string): number {
  const today = todayStr();
  const bucket = anonBuckets.get(ip);
  if (!bucket || bucket.date !== today) return 0;
  return bucket.count;
}

function consumeAnon(ip: string): number {
  const today = todayStr();
  let bucket = anonBuckets.get(ip);
  if (!bucket || bucket.date !== today) {
    bucket = { date: today, count: 0 };
    anonBuckets.set(ip, bucket);
  }
  bucket.count++;
  return bucket.count;
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const today = todayStr();
  for (const [ip, bucket] of anonBuckets) {
    if (bucket.date !== today) anonBuckets.delete(ip);
  }
}, 30 * 60 * 1000);

/* ── Authenticated (user-based) tracking — Supabase ──────── */

async function getAuthUsage(userId: string): Promise<number> {
  const sb = getSupabase();
  const today = todayStr();
  const { data } = await sb
    .from("request_log")
    .select("request_count")
    .eq("user_id", userId)
    .eq("request_date", today)
    .single();
  return data?.request_count || 0;
}

async function consumeAuth(userId: string): Promise<void> {
  const sb = getSupabase();
  const today = todayStr();
  const { data: existing } = await sb
    .from("request_log")
    .select("id, request_count")
    .eq("user_id", userId)
    .eq("request_date", today)
    .single();

  if (existing) {
    await sb.from("request_log").update({ request_count: existing.request_count + 1 }).eq("id", existing.id);
  } else {
    await sb.from("request_log").insert({ user_id: userId, request_date: today, request_count: 1 });
  }
}

/* ── Main check function ─────────────────────────────────── */

/**
 * Check and consume access for a request.
 *
 * @param ip       - Client IP address
 * @param userId   - Authenticated user ID (null for anonymous)
 * @param isByok   - Whether the user supplied their own API key
 */
export async function checkAccess(
  ip: string,
  userId: string | null,
  isByok: boolean
): Promise<AccessCheckResult> {
  // Tier 3: BYOK — always allowed
  if (isByok) {
    return { allowed: true, tier: "byok", dailyUsed: 0, dailyLimit: 0, gate: "none" };
  }

  const limits = await getTierLimits();

  // Tier 2: Authenticated user
  if (userId) {
    const dailyUsed = await getAuthUsage(userId);
    if (dailyUsed >= limits.authDailyLimit) {
      return {
        allowed: false,
        tier: "authenticated",
        dailyUsed,
        dailyLimit: limits.authDailyLimit,
        gate: "apikey",
        message: `You've used all ${limits.authDailyLimit} daily requests. Add your own API key for unlimited access.`,
      };
    }
    await consumeAuth(userId);
    return {
      allowed: true,
      tier: "authenticated",
      dailyUsed: dailyUsed + 1,
      dailyLimit: limits.authDailyLimit,
      gate: "none",
    };
  }

  // Tier 1: Anonymous
  const anonUsed = getAnonUsage(ip);
  if (anonUsed >= limits.anonDailyLimit) {
    return {
      allowed: false,
      tier: "anonymous",
      dailyUsed: anonUsed,
      dailyLimit: limits.anonDailyLimit,
      gate: "signup",
      message: `You've used all ${limits.anonDailyLimit} free requests for today. Sign up to get ${limits.authDailyLimit} daily requests.`,
    };
  }
  const newCount = consumeAnon(ip);
  return {
    allowed: true,
    tier: "anonymous",
    dailyUsed: newCount,
    dailyLimit: limits.anonDailyLimit,
    gate: "none",
  };
}

/**
 * Get current access status without consuming a request.
 */
export async function getAccessStatus(
  ip: string,
  userId: string | null,
  isByok: boolean
): Promise<AccessCheckResult> {
  if (isByok) {
    return { allowed: true, tier: "byok", dailyUsed: 0, dailyLimit: 0, gate: "none" };
  }

  const limits = await getTierLimits();

  if (userId) {
    const dailyUsed = await getAuthUsage(userId);
    return {
      allowed: dailyUsed < limits.authDailyLimit,
      tier: "authenticated",
      dailyUsed,
      dailyLimit: limits.authDailyLimit,
      gate: dailyUsed >= limits.authDailyLimit ? "apikey" : "none",
    };
  }

  const anonUsed = getAnonUsage(ip);
  return {
    allowed: anonUsed < limits.anonDailyLimit,
    tier: "anonymous",
    dailyUsed: anonUsed,
    dailyLimit: limits.anonDailyLimit,
    gate: anonUsed >= limits.anonDailyLimit ? "signup" : "none",
  };
}
