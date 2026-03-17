/**
 * Session Cache — Per-session tool result cache with LRU eviction.
 *
 * Prevents redundant ServiceNow API calls across SDLC phases.
 * Read-only tool results are cached after first execution and reused
 * when the same tool+args combination is requested again.
 *
 * Cache is scoped per session (cleared on new chat) and supports
 * invalidation when write operations modify related data.
 */

/** Tools whose results are safe to cache (read-only, deterministic) */
const CACHEABLE_TOOL_PREFIXES = [
  "sn_get_",
  "sn_query_",
  "sn_list_",
  "sn_analyze_",
  "sn_detect_",
  "sn_compare_",
  "sn_find_",
  "sn_code_quality_",
  "sn_assess_",
  "sn_predict_",
];

/** Tools that are explicitly NOT cacheable despite matching a prefix */
const NON_CACHEABLE_TOOLS = new Set([
  "sn_get_scope_selection_options", // depends on context that may change
]);

/** Write tools that should invalidate related cache entries */
const WRITE_TOOL_PREFIXES = [
  "sn_create_",
  "sn_update_",
  "sn_delete_",
  "sn_move_",
  "sn_set_",
];

export interface CacheEntry {
  result: unknown;
  timestamp: number;
  toolName: string;
}

export class SessionCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = []; // LRU tracking
  private maxEntries: number;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
  }

  /** Generate a stable cache key from tool name + args */
  static cacheKey(toolName: string, args: unknown): string {
    if (args === null || typeof args !== "object") {
      return `${toolName}::${JSON.stringify(args)}`;
    }
    const keys = Object.keys(args as Record<string, unknown>).sort();
    return `${toolName}::${JSON.stringify(args, keys)}`;
  }

  /** Check if a tool's results are cacheable */
  static isCacheable(toolName: string): boolean {
    if (NON_CACHEABLE_TOOLS.has(toolName)) return false;
    return CACHEABLE_TOOL_PREFIXES.some((p) => toolName.startsWith(p));
  }

  /** Check if a tool is a write operation that should invalidate cache */
  static isWriteTool(toolName: string): boolean {
    return WRITE_TOOL_PREFIXES.some((p) => toolName.startsWith(p));
  }

  /** Get a cached result. Returns undefined on miss. */
  get(toolName: string, args: unknown): unknown | undefined {
    const key = SessionCache.cacheKey(toolName, args);
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Update LRU order
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);

    return entry.result;
  }

  /** Store a tool result in the cache */
  set(toolName: string, args: unknown, result: unknown): void {
    if (!SessionCache.isCacheable(toolName)) return;

    const key = SessionCache.cacheKey(toolName, args);

    // Evict LRU if at capacity
    while (this.cache.size >= this.maxEntries && this.accessOrder.length > 0) {
      const evictKey = this.accessOrder.shift()!;
      this.cache.delete(evictKey);
    }

    this.cache.set(key, { result, timestamp: Date.now(), toolName });
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
  }

  /** Invalidate cache entries related to a write operation */
  invalidateForWrite(toolName: string, args: unknown): number {
    if (!SessionCache.isWriteTool(toolName)) return 0;

    // Extract table from args if present — invalidate all cached reads for that table
    const table = (args as Record<string, unknown>)?.table as string | undefined;
    let invalidated = 0;

    for (const [key] of this.cache.entries()) {
      // Invalidate if the cached tool was reading from the same table (only when table is defined)
      const shouldInvalidate = table != null && key.includes(`"table":"${table}"`);
      if (shouldInvalidate) {
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter((k) => k !== key);
        invalidated++;
      }
    }
    return invalidated;
  }

  /** Get all cached keys (for planner awareness) */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /** Get a summary of cached data for planner context */
  getSummary(): { tool: string; argsPreview: string }[] {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      tool: entry.toolName,
      argsPreview: key.split("::")[1]?.slice(0, 80) || "",
    }));
  }

  /** Number of entries in cache */
  get size(): number {
    return this.cache.size;
  }

  /** Clear all cache entries */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
}

/** Global session cache store — maps sessionId to SessionCache instance */
const SESSION_CACHES = new Map<string, SessionCache>();

let pruneIntervalStarted = false;

function startPruneInterval(): void {
  if (pruneIntervalStarted) return;
  pruneIntervalStarted = true;
  const interval = setInterval(pruneSessionCaches, 5 * 60 * 1000); // every 5 min
  if (interval.unref) interval.unref();
}

/** Get or create a session cache for a given session ID */
export function getSessionCache(sessionId: string): SessionCache {
  startPruneInterval();
  let cache = SESSION_CACHES.get(sessionId);
  if (!cache) {
    cache = new SessionCache();
    SESSION_CACHES.set(sessionId, cache);
  }
  return cache;
}

/** Clear a session's cache (called on new chat) */
export function clearSessionCache(sessionId: string): void {
  SESSION_CACHES.delete(sessionId);
}

/** Clean up old session caches (call periodically) */
export function pruneSessionCaches(maxAge = 30 * 60 * 1000): number {
  // Not time-based on entries — just limit total sessions
  const MAX_SESSIONS = 100;
  let pruned = 0;
  if (SESSION_CACHES.size > MAX_SESSIONS) {
    const oldest = Array.from(SESSION_CACHES.keys()).slice(0, SESSION_CACHES.size - MAX_SESSIONS);
    for (const key of oldest) {
      SESSION_CACHES.delete(key);
      pruned++;
    }
  }
  return pruned;
}

