/**
 * 3-Tier Access System
 *
 * Tier 1 — Anonymous:  IP + instance-aware daily limit (default: 10/day, admin-configurable)
 * Tier 2 — Authenticated: User-based daily limit (default: 20/day, admin-configurable)
 * Tier 3 — BYOK:       Unlimited (user provides their own API key)
 *
 * Limits are stored in Supabase `access_tier_config` table and cached in-memory.
 * Anonymous tracking uses DB-backed `anon_request_log` table (survives server restarts).
 * Authenticated tracking uses Supabase `request_log` table.
 *
 * Anonymous dual-budget: a request is blocked if EITHER the IP or the instance
 * has exceeded the daily limit. This prevents VPN/IP-hopping abuse.
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

/* ── Anonymous tracking — DB-backed with dual budget ──────── */

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get anonymous usage — returns the higher of IP-total or instance-total.
 * This ensures that switching IPs on the same instance doesn't bypass limits.
 */
async function getAnonUsage(ip: string, instanceUrl?: string): Promise<number> {
  const sb = getSupabase();
  const today = todayStr();

  // IP-level usage (sum across all instances for this IP today)
  const { data: ipRows } = await sb
    .from("anon_request_log")
    .select("request_count")
    .eq("ip_address", ip)
    .eq("request_date", today);

  const ipTotal = (ipRows || []).reduce((sum, r) => sum + (r.request_count || 0), 0);

  // Instance-level usage (sum across all IPs for this instance today)
  let instanceTotal = 0;
  if (instanceUrl) {
    const { data: instRows } = await sb
      .from("anon_request_log")
      .select("request_count")
      .eq("instance_url", instanceUrl)
      .eq("request_date", today);

    instanceTotal = (instRows || []).reduce((sum, r) => sum + (r.request_count || 0), 0);
  }

  // Return the higher count — either budget being exceeded blocks the request
  return Math.max(ipTotal, instanceTotal);
}

/**
 * Record an anonymous request in the DB.
 * Upserts: one row per (ip, instance_url, date).
 */
async function consumeAnon(ip: string, instanceUrl?: string): Promise<void> {
  const sb = getSupabase();
  const today = todayStr();
  const instVal = instanceUrl || null;

  // Try upsert — increment request_count for existing row
  const { data: existing } = await sb
    .from("anon_request_log")
    .select("id, request_count")
    .eq("ip_address", ip)
    .eq("request_date", today)
    .eq("instance_url", instVal ?? "")
    .maybeSingle();

  if (existing) {
    await sb
      .from("anon_request_log")
      .update({ request_count: existing.request_count + 1 })
      .eq("id", existing.id);
  } else {
    await sb.from("anon_request_log").insert({
      ip_address: ip,
      instance_url: instVal,
      request_date: today,
      request_count: 1,
    });
  }
}

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
 * @param ip          - Client IP address
 * @param userId      - Authenticated user ID (null for anonymous)
 * @param isByok      - Whether the user supplied their own API key
 * @param instanceUrl - ServiceNow instance URL (for instance-aware anon limiting)
 */
export async function checkAccess(
  ip: string,
  userId: string | null,
  isByok: boolean,
  instanceUrl?: string
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

  // Tier 1: Anonymous — dual budget (IP + instance)
  const anonUsed = await getAnonUsage(ip, instanceUrl);
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
  await consumeAnon(ip, instanceUrl);
  return {
    allowed: true,
    tier: "anonymous",
    dailyUsed: anonUsed + 1,
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
  isByok: boolean,
  instanceUrl?: string
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

  const anonUsed = await getAnonUsage(ip, instanceUrl);
  return {
    allowed: anonUsed < limits.anonDailyLimit,
    tier: "anonymous",
    dailyUsed: anonUsed,
    dailyLimit: limits.anonDailyLimit,
    gate: anonUsed >= limits.anonDailyLimit ? "signup" : "none",
  };
}
