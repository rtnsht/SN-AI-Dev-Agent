import type { ScoredPrompt, SuggestionConfig } from "./types";
import { DEFAULT_CONFIG } from "./types";

/**
 * Apply jitter noise to scored prompts so that items within the same
 * priority tier get slightly different effective scores on each call.
 * This breaks the deterministic ordering while keeping tier boundaries intact.
 */
export function applyJitter(
  pool: ScoredPrompt[],
  config: SuggestionConfig = DEFAULT_CONFIG,
): ScoredPrompt[] {
  const range = config.jitterRange;
  return pool.map((p) => ({
    ...p,
    priority: p.priority + (Math.random() * range * 2 - range),
  }));
}
