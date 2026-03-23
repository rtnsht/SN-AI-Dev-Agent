/**
 * LLM API Key Resolver — pool + BYOK + env fallback.
 *
 * Reads comma-separated keys from CLAUDE_API_KEYS / OPENROUTER_API_KEYS env vars,
 * assigns a session-sticky random key per provider, and falls back to the legacy
 * single-key env vars (CLAUDE_API_KEY / OPENROUTER_API_KEY).
 *
 * Resolution priority:
 *   BYOK (user key) → Pool (comma-split env) → Single fallback env → Error
 */

export type AiProvider = "anthropic" | "openrouter";

export interface KeyResolution {
  apiKey: string;
  userSuppliedKey: boolean;
  source: "byok" | "pool" | "env_fallback";
}

/* ── Pool parsing (cached at module load) ─────────────────────── */

function parseKeyPool(envVar: string): string[] {
  return (process.env[envVar] || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

const anthropicPool = parseKeyPool("CLAUDE_API_KEYS");
const openrouterPool = parseKeyPool("OPENROUTER_API_KEYS");

function getPool(provider: AiProvider): string[] {
  return provider === "anthropic" ? anthropicPool : openrouterPool;
}

export function getPoolSize(provider: AiProvider): number {
  return getPool(provider).length;
}

/* ── Session-sticky binding (in-memory, per serverless instance) ─ */

const sessionBindings = new Map<string, number>();

function getPoolKey(sessionId: string, provider: AiProvider): string | null {
  const pool = getPool(provider);
  if (pool.length === 0) return null;

  const bindingKey = `${sessionId}:${provider}`;
  let idx = sessionBindings.get(bindingKey);
  if (idx === undefined || idx >= pool.length) {
    idx = Math.floor(Math.random() * pool.length);
    sessionBindings.set(bindingKey, idx);
  }
  return pool[idx];
}

/* ── Single-key fallback ──────────────────────────────────────── */

function getSingleKeyFallback(provider: AiProvider): string {
  if (provider === "anthropic") return process.env.CLAUDE_API_KEY || "";
  return process.env.OPENROUTER_API_KEY || "";
}

/* ── Main resolver ────────────────────────────────────────────── */

/**
 * Resolve the LLM API key for a request.
 *
 * @param sessionId  - Client session ID for sticky pool binding
 * @param provider   - "anthropic" or "openrouter"
 * @param userKey    - User-supplied BYOK key (empty string if none)
 * @param allowUserKeys - Whether BYOK is permitted (from ALLOW_USER_API_KEYS)
 */
export function resolveLlmApiKey(
  sessionId: string,
  provider: AiProvider,
  userKey: string,
  allowUserKeys: boolean,
): KeyResolution | null {
  // 1. BYOK — user-supplied key takes precedence
  if (allowUserKeys && userKey) {
    return { apiKey: userKey, userSuppliedKey: true, source: "byok" };
  }

  // 2. Pool — comma-separated env keys with session-sticky random pick
  const poolKey = getPoolKey(sessionId, provider);
  if (poolKey) {
    return { apiKey: poolKey, userSuppliedKey: false, source: "pool" };
  }

  // 3. Single-key fallback — legacy CLAUDE_API_KEY / OPENROUTER_API_KEY
  const fallback = getSingleKeyFallback(provider);
  if (fallback) {
    return { apiKey: fallback, userSuppliedKey: false, source: "env_fallback" };
  }

  // 4. No key available
  return null;
}

/**
 * Check if any server-side key is configured (pool or single) for a provider.
 * Used by /api/config to report availability without exposing secrets.
 */
export function hasServerKey(provider: AiProvider): boolean {
  return getPool(provider).length > 0 || !!getSingleKeyFallback(provider);
}
