import type { CategorizedPrompts, ExamplePrompt, UpdateSetSummary } from "../types";
import type {
  PromptProvider,
  ProviderContext,
  ScoredPrompt,
  SuggestionConfig,
  PromptPoolMap,
  TabKey,
  SnClientLike,
  UserContext,
} from "./types";
import { DEFAULT_CONFIG } from "./types";
import { PromptProviderRegistry } from "./registry";
import { applyJitter } from "./scorer";
import { selectPrompts } from "./selector";
import { djb2 } from "./hash";

import { userWorkProvider } from "./providers/user-work";
import { instanceArtifactProvider } from "./providers/instance-artifacts";
import { roleBasedProvider } from "./providers/role-based";
import { updateSetProvider } from "./providers/update-sets";
import { genericFallbackProvider } from "./providers/generic-fallback";

export interface ComposeResult {
  prompts: CategorizedPrompts;
  pools: PromptPoolMap;
  promptHashes: string[];
}

let _defaultRegistry: PromptProviderRegistry | null = null;

function getDefaultRegistry(): PromptProviderRegistry {
  if (!_defaultRegistry) {
    _defaultRegistry = new PromptProviderRegistry();
    _defaultRegistry.register(userWorkProvider);
    _defaultRegistry.register(instanceArtifactProvider);
    _defaultRegistry.register(roleBasedProvider);
    _defaultRegistry.register(updateSetProvider);
    _defaultRegistry.register(genericFallbackProvider);
  }
  return _defaultRegistry;
}

const TABS: TabKey[] = ["foryou", "build", "explore", "quick"];

export class PromptComposer {
  private registry: PromptProviderRegistry;
  private config: SuggestionConfig;

  constructor(
    registry?: PromptProviderRegistry,
    config?: Partial<SuggestionConfig>,
  ) {
    this.registry = registry || getDefaultRegistry();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async compose(
    snClient: SnClientLike,
    userContext?: UserContext,
    seenHashes?: string[],
  ): Promise<ComposeResult> {
    const ctx: ProviderContext = { snClient, userContext };
    const providers = this.registry.getAll();

    const results = await Promise.allSettled(
      providers.map((p) => p.fetch(ctx)),
    );

    const pools: PromptPoolMap = { foryou: [], build: [], explore: [], quick: [] };
    const updates: UpdateSetSummary[] = [];

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const pr = r.value;
      for (const tab of TABS) {
        pools[tab].push(...pr[tab]);
      }
      if (pr.updates && pr.updates.length > 0) {
        updates.push(...pr.updates);
      }
    }

    for (const tab of TABS) {
      pools[tab] = applyJitter(pools[tab], this.config);
    }

    const seenSet = seenHashes ? new Set(seenHashes) : undefined;
    const n = this.config.promptsPerCategory;

    const prompts: CategorizedPrompts = {
      foryou: selectPrompts(pools.foryou, n, seenSet),
      build: selectPrompts(pools.build, n, seenSet),
      explore: selectPrompts(pools.explore, n, seenSet),
      quick: selectPrompts(pools.quick, n, seenSet),
      updates,
    };

    const promptHashes: string[] = [];
    for (const tab of TABS) {
      for (const p of prompts[tab] as ExamplePrompt[]) {
        promptHashes.push(djb2(p.text));
      }
    }

    return { prompts, pools, promptHashes };
  }
}
