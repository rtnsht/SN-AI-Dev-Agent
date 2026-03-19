import type { ExamplePrompt } from "../types";
import type { ScoredPrompt } from "./types";
import { djb2 } from "./hash";

/**
 * Fisher-Yates (Knuth) in-place shuffle.
 * Isomorphic -- no Node.js dependencies.
 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Group prompts into tiers by integer priority (floor).
 * Using floor instead of round so jitter (+/- 0.4) can push items
 * across tier boundaries (e.g., priority 5.0 with -0.4 jitter -> tier 4).
 * Returns a Map sorted by descending priority key.
 */
function groupByPriority(pool: ScoredPrompt[]): Map<number, ScoredPrompt[]> {
  const tiers = new Map<number, ScoredPrompt[]>();
  for (const p of pool) {
    const key = Math.floor(p.priority);
    if (!tiers.has(key)) tiers.set(key, []);
    tiers.get(key)!.push(p);
  }
  return new Map(
    Array.from(tiers.entries()).sort(([a], [b]) => b - a),
  );
}

/**
 * Move seen prompts to the end of their tier so unseen ones surface first.
 * The `seen` set contains djb2 hashes of prompt text.
 */
function deprioritizeSeen(
  tiers: Map<number, ScoredPrompt[]>,
  seen: Set<string>,
): void {
  for (const [key, items] of tiers) {
    const unseen: ScoredPrompt[] = [];
    const seenItems: ScoredPrompt[] = [];
    for (const item of items) {
      if (seen.has(djb2(item.text))) {
        seenItems.push(item);
      } else {
        unseen.push(item);
      }
    }
    tiers.set(key, [...unseen, ...seenItems]);
  }
}

function stripPriority(p: ScoredPrompt): ExamplePrompt {
  return { icon: p.icon, text: p.text, desc: p.desc };
}

/**
 * Select N prompts from a scored pool:
 * 1. Group by priority tier
 * 2. Shuffle within each tier (Fisher-Yates)
 * 3. Deprioritize seen prompts (move to end of tier)
 * 4. Flatten tiers (highest first) and take top N
 *
 * This function is isomorphic and can run on both server and client.
 */
export function selectPrompts(
  pool: ScoredPrompt[],
  n: number,
  seen?: Set<string>,
): ExamplePrompt[] {
  if (pool.length === 0) return [];
  const tiers = groupByPriority(pool);
  for (const tier of tiers.values()) fisherYatesShuffle(tier);
  if (seen?.size) deprioritizeSeen(tiers, seen);
  const flat: ScoredPrompt[] = [];
  for (const tier of tiers.values()) flat.push(...tier);
  return flat.slice(0, n).map(stripPriority);
}
