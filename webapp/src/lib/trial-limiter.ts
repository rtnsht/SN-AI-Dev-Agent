/**
 * Trial limiter — enforces configurable daily request limits with trial periods.
 *
 * Uses Supabase tables: trial_config, request_log, trial_start.
 * Only applies when user is consuming the server-provided API key.
 * Users with their own API keys bypass trial limits entirely.
 */

import { getSupabase } from "@/lib/supabase";

export interface TrialStatus {
  trialActive: boolean;
  trialExpired: boolean;
  daysLeft: number;
  dailyUsed: number;
  dailyLimit: number;
  totalUsed: number;
  trialDays: number;
  isConfigured: boolean; // whether trial system is enabled globally
}

interface TrialConfig {
  daily_limit: number;
  trial_days: number;
  is_active: boolean;
}

/**
 * Resolve the effective trial config for a user.
 * Priority: user override → instance override → global default.
 */
async function getEffectiveConfig(userId: string, instanceUrl?: string): Promise<TrialConfig | null> {
  const sb = getSupabase();

  // Check user-specific override first
  const { data: userConfig } = await sb
    .from("trial_config")
    .select("daily_limit, trial_days, is_active")
    .eq("scope", "user")
    .eq("scope_value", userId)
    .single();

  if (userConfig) return userConfig;

  // Check instance-specific override
  if (instanceUrl) {
    const { data: instConfig } = await sb
      .from("trial_config")
      .select("daily_limit, trial_days, is_active")
      .eq("scope", "instance")
      .eq("scope_value", instanceUrl)
      .single();

    if (instConfig) return instConfig;
  }

  // Fall back to global config
  const { data: globalConfig } = await sb
    .from("trial_config")
    .select("daily_limit, trial_days, is_active")
    .eq("scope", "global")
    .single();

  return globalConfig || null;
}

/**
 * Get or create the trial start date for a user.
 */
async function getTrialStart(userId: string, instanceUrl?: string): Promise<Date> {
  const sb = getSupabase();

  const { data: existing } = await sb
    .from("trial_start")
    .select("started_at")
    .eq("user_id", userId)
    .single();

  if (existing) return new Date(existing.started_at);

  // First-time user — create trial start record
  const now = new Date();
  await sb.from("trial_start").insert({
    user_id: userId,
    instance_url: instanceUrl || null,
    started_at: now.toISOString(),
  });

  return now;
}

/**
 * Get today's request count for a user.
 */
async function getTodayUsage(userId: string): Promise<number> {
  const sb = getSupabase();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await sb
    .from("request_log")
    .select("request_count")
    .eq("user_id", userId)
    .eq("request_date", today)
    .single();

  return data?.request_count || 0;
}

/**
 * Get total request count for a user across all days.
 */
async function getTotalUsage(userId: string): Promise<number> {
  const sb = getSupabase();

  // Try RPC first
  const { data: rpcData, error: rpcError } = await sb.rpc("get_total_usage", {
    p_user_id: userId
  });

  if (!rpcError && rpcData !== null) {
    return Number(rpcData);
  }

  // Fallback to in-memory aggregation if RPC doesn't exist
  const { data } = await sb
    .from("request_log")
    .select("request_count")
    .eq("user_id", userId);

  if (!data) return 0;
  return data.reduce((sum, row) => sum + (row.request_count || 0), 0);
}

/**
 * Check if a user is allowed to make a request under their trial limits.
 */
export async function checkTrialLimit(
  userId: string,
  instanceUrl?: string
): Promise<{ allowed: boolean; status: TrialStatus }> {
  const config = await getEffectiveConfig(userId, instanceUrl);

  // No config or trial system disabled — allow through
  if (!config || !config.is_active) {
    return {
      allowed: true,
      status: {
        trialActive: false,
        trialExpired: false,
        daysLeft: 0,
        dailyUsed: 0,
        dailyLimit: 0,
        totalUsed: 0,
        trialDays: 0,
        isConfigured: false,
      },
    };
  }

  const trialStart = await getTrialStart(userId, instanceUrl);
  const now = new Date();
  const daysSinceStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
  const trialExpired = daysSinceStart >= config.trial_days;
  const daysLeft = Math.max(0, config.trial_days - daysSinceStart);
  const dailyUsed = await getTodayUsage(userId);
  const totalUsed = await getTotalUsage(userId);

  const status: TrialStatus = {
    trialActive: !trialExpired,
    trialExpired,
    daysLeft,
    dailyUsed,
    dailyLimit: config.daily_limit,
    totalUsed,
    trialDays: config.trial_days,
    isConfigured: true,
  };

  // Trial expired
  if (trialExpired) {
    return { allowed: false, status };
  }

  // Daily limit exceeded
  if (dailyUsed >= config.daily_limit) {
    return { allowed: false, status };
  }

  return { allowed: true, status };
}

/**
 * Consume one trial request for the user (increment today's count).
 */
export async function consumeTrialRequest(
  userId: string,
  instanceUrl?: string
): Promise<void> {
  const sb = getSupabase();
  const today = new Date().toISOString().split("T")[0];

  // Try atomic RPC first
  const { error: rpcError } = await sb.rpc("increment_auth_request_count", {
    p_user_id: userId,
    p_request_date: today
  });

  if (!rpcError) return;

  // Fallback to read-modify-write if RPC doesn't exist
  const { data: existing } = await sb
    .from("request_log")
    .select("id, request_count")
    .eq("user_id", userId)
    .eq("request_date", today)
    .maybeSingle();

  if (existing) {
    await sb
      .from("request_log")
      .update({ request_count: existing.request_count + 1 })
      .eq("id", existing.id);
  } else {
    await sb.from("request_log").insert({
      user_id: userId,
      instance_url: instanceUrl || null,
      request_date: today,
      request_count: 1,
    });
  }
}

/**
 * Get the full trial status for a user (for UI display).
 */
export async function getTrialStatus(userId: string, instanceUrl?: string): Promise<TrialStatus> {
  const { status } = await checkTrialLimit(userId, instanceUrl);
  return status;
}
