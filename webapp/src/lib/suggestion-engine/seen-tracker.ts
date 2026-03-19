import { djb2 } from "./hash";

const STORAGE_KEY = "ai-seen-suggestions";
const MAX_ENTRIES = 200;

export class SeenPromptsTracker {
  private hashes: string[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) this.hashes = JSON.parse(raw);
    } catch {
      this.hashes = [];
    }
  }

  private save(): void {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.hashes));
    } catch { /* quota */ }
  }

  /** Mark prompt texts as seen. */
  markSeen(texts: string[]): void {
    for (const t of texts) {
      const h = djb2(t);
      const idx = this.hashes.indexOf(h);
      if (idx !== -1) this.hashes.splice(idx, 1);
      this.hashes.push(h);
    }
    while (this.hashes.length > MAX_ENTRIES) this.hashes.shift();
    this.save();
  }

  /** Get the set of seen hashes for use with selectPrompts(). */
  getSeenTexts(): Set<string> {
    return new Set(this.hashes);
  }

  /** Get raw hash array for sending to the API. */
  getHashes(): string[] {
    return [...this.hashes];
  }

  /** Merge hashes returned from the API. */
  mergeHashes(incoming: string[]): void {
    for (const h of incoming) {
      if (!this.hashes.includes(h)) this.hashes.push(h);
    }
    while (this.hashes.length > MAX_ENTRIES) this.hashes.shift();
    this.save();
  }

  clear(): void {
    this.hashes = [];
    if (typeof window !== "undefined") {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ok */ }
    }
  }

  get size(): number {
    return this.hashes.length;
  }
}

export const SEEN_STORAGE_KEY = STORAGE_KEY;

export function hashPromptText(text: string): string {
  return djb2(text);
}
