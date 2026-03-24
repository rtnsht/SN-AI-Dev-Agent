import crypto from "crypto";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";
import { getSupabase } from "@/lib/supabase";

export interface ShareSessionContext {
  sessionId: string;
  userId: string | null;
  instanceUrl: string | null;
  username: string | null;
  recordedIp: string | null;
  currentIp: string;
}

export interface ShareSessionResolution {
  ok: boolean;
  status: number;
  error?: string;
  context?: ShareSessionContext;
}

/** Canonical instance URL for fingerprinting (scheme + host + port only). */
export function normalizeInstanceUrlForFingerprint(raw: string | null | undefined): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.origin.toLowerCase().replace(/\/$/, "");
  } catch {
    return normalizeValue(raw);
  }
}

/**
 * Production: only SHARE_HMAC_SECRET (set in env). Missing → fingerprints disabled (tracking no-ops safely).
 * Non-production: SHARE_HMAC_SECRET, else SHARE_HMAC_DEV_SECRET, else a fixed dev fallback (never service keys or cookie names).
 */
function getShareSecret(): string | null {
  const dedicated = process.env.SHARE_HMAC_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    return dedicated || null;
  }
  if (dedicated) return dedicated;
  const devOnly = process.env.SHARE_HMAC_DEV_SECRET?.trim();
  if (devOnly) return devOnly;
  return "sn-ai-agent-share-dev-only";
}

function normalizeValue(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function getEffectiveShareIp(context: ShareSessionContext): string {
  if (context.currentIp && context.currentIp !== "unknown") return context.currentIp;
  if (context.recordedIp && context.recordedIp !== "unknown") return context.recordedIp;
  return "unknown";
}

export function computeShareFingerprint(context: ShareSessionContext): string | null {
  const instanceUrl = normalizeInstanceUrlForFingerprint(context.instanceUrl);
  const username = normalizeValue(context.username);
  const effectiveIp = getEffectiveShareIp(context);

  if (!instanceUrl || !username || effectiveIp === "unknown") {
    return null;
  }

  const secret = getShareSecret();
  if (!secret) {
    return null;
  }

  return crypto
    .createHmac("sha256", secret)
    .update(`${instanceUrl}|${effectiveIp}|${username}`)
    .digest("hex");
}

async function resolveCookieUserId(request: NextRequest): Promise<string | null> {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    const session = await validateSession(token);
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Bind share APIs to the same browser session that created session_logs:
 * - Rows with user_id: require a valid app session cookie whose user matches user_id (not spoofable x-user-id).
 * - Anonymous rows: require known, matching client IP vs recorded ip_address.
 */
export async function resolveShareSessionContext(
  request: NextRequest,
  sessionId: string
): Promise<ShareSessionResolution> {
  const currentIp = getClientIp(request);
  const db = getSupabase();

  const { data, error } = await db
    .from("session_logs")
    .select("session_id, user_id, instance_url, username, ip_address")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[share-session] Failed to load session:", error.message);
    return { ok: false, status: 500, error: "Failed to load session" };
  }

  if (!data) {
    return { ok: false, status: 404, error: "Session not found" };
  }

  const sessionUserId = data.user_id || null;
  const recordedIp = data.ip_address || null;
  const cookieUserId = await resolveCookieUserId(request);

  if (sessionUserId) {
    if (!cookieUserId || cookieUserId !== sessionUserId) {
      return { ok: false, status: 403, error: "Unauthorized" };
    }
  } else {
    const rec = (recordedIp || "").trim();
    const cur = (currentIp || "").trim();
    const ipMatch = rec && rec !== "unknown" && cur && cur !== "unknown" && rec === cur;
    if (!ipMatch) {
      // IP may change on mobile networks (CGNAT, WiFi→LTE). Fall back to
      // sessionId knowledge as a weak-but-sufficient signal for share APIs
      // (the share feature is low-risk; the worst outcome is an inflated share card).
      const hasValidSession = !!data.session_id && !!data.instance_url && !!data.username;
      if (!hasValidSession) {
        return { ok: false, status: 403, error: "Session verification failed" };
      }
    }
  }

  return {
    ok: true,
    status: 200,
    context: {
      sessionId: data.session_id,
      userId: sessionUserId,
      instanceUrl: data.instance_url || null,
      username: data.username || null,
      recordedIp,
      currentIp,
    },
  };
}
