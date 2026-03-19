import type { ExamplePrompt, UpdateSetSummary } from "../types";

export type TabKey = "foryou" | "build" | "explore" | "quick";

export interface ScoredPrompt extends ExamplePrompt {
  priority: number;
}

export interface PromptTemplate {
  icon: string;
  text: string;
  desc: string;
  priority: number;
}

export interface UserContext {
  sysId: string;
  roles: string[];
  assignmentGroups: { sysId: string; name: string }[];
}

export interface SnClientLike {
  getRecords(
    table: string,
    params: Record<string, string | number>,
  ): Promise<Record<string, unknown>[]>;
}

export interface ProviderContext {
  snClient: SnClientLike;
  userContext?: UserContext;
}

export interface ProviderResult {
  foryou: ScoredPrompt[];
  build: ScoredPrompt[];
  explore: ScoredPrompt[];
  quick: ScoredPrompt[];
  updates?: UpdateSetSummary[];
}

export interface PromptProvider {
  id: string;
  name: string;
  fetch(ctx: ProviderContext): Promise<ProviderResult>;
}

export interface SuggestionConfig {
  promptsPerCategory: number;
  jitterRange: number;
  maxSeenEntries: number;
}

export const DEFAULT_CONFIG: SuggestionConfig = {
  promptsPerCategory: 6,
  jitterRange: 0.4,
  maxSeenEntries: 200,
};

export interface PromptPoolMap {
  foryou: ScoredPrompt[];
  build: ScoredPrompt[];
  explore: ScoredPrompt[];
  quick: ScoredPrompt[];
}

export function emptyResult(): ProviderResult {
  return { foryou: [], build: [], explore: [], quick: [] };
}
