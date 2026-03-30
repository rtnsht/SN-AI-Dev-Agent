import { hasServerKey, resolveLlmApiKey, type KeyResolution } from "@/lib/key-resolver";
import { getSupabase } from "@/lib/supabase";
import type { AIProvider, AITransport, ModelAccessSource, ModelOption } from "@/lib/types";
import { getActiveUserApiKey, listActiveUserApiKeyProviders } from "@/lib/user-api-keys";

type DisplayProvider = Exclude<AIProvider, "free">;

interface ModelConfigRow {
  id: string;
  provider: string;
  display_provider: string | null;
  transport: string | null;
  model_key: string;
  label: string;
  model_id: string | null;
  api_model_id: string | null;
  context_window: number | null;
  max_output: number | null;
  input_cost_per_1m: number | null;
  output_cost_per_1m: number | null;
  is_free: boolean | null;
  is_default: boolean | null;
  is_server_free: boolean | null;
  capabilities: unknown;
  enabled: boolean | null;
  display_order: number | null;
  model_class: string | null;
  speed_tier: string | null;
  cost_tier: string | null;
  training_data: string | null;
  thinking_mode_supported: boolean | null;
}

interface FreeRuleRow {
  id: string;
  model_config_id: string;
  scope: "all_users" | "specific_users";
  daily_request_limit: number | null;
  is_active: boolean;
}

interface FreeRuleUserRow {
  rule_id: string;
  user_id: string;
}

interface UsageRow {
  rule_id: string;
  model_config_id: string;
  request_count: number;
}

interface RuleMatch {
  rule: FreeRuleRow;
  used: number;
  remaining: number | null;
}

export interface CatalogModel extends ModelOption {
  transport: AITransport;
  apiModelId: string;
  accessSource: ModelAccessSource;
  available: boolean;
  modelConfigId: string;
  matchedRuleId?: string | null;
}

export interface ModelCatalogPayload {
  models: ModelOption[];
  defaultModel: ModelOption | null;
  providers: AIProvider[];
  transportAvailability: Record<AITransport, { serverConfigured: boolean }>;
}

export interface ProviderKeyResolution {
  apiKey: string;
  source: "session_key" | "saved_key" | "server_key";
  userSuppliedKey: boolean;
  storedKeyId?: string;
}

export interface ModelExecutionResolution {
  allowed: boolean;
  status: number;
  model: CatalogModel | null;
  accessSource?: Exclude<ModelAccessSource, "unavailable">;
  apiKey?: string;
  userSuppliedKey: boolean;
  storedKeyId?: string;
  ruleId?: string;
  remainingQuota?: number | null;
  error?: string;
}

const PROVIDER_ORDER: AIProvider[] = [
  "anthropic",
  "openai",
  "google",
  "mimo",
  "minimax",
  "glm",
  "openrouter",
  "free",
];

const FALLBACK_MODEL_ROWS: ModelConfigRow[] = [
  {
    id: "fallback-claude-sonnet-4-6",
    provider: "anthropic",
    display_provider: "anthropic",
    transport: "anthropic",
    model_key: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    model_id: "claude-sonnet-4-6",
    api_model_id: "claude-sonnet-4-6",
    context_window: 200000,
    max_output: 8192,
    input_cost_per_1m: 3,
    output_cost_per_1m: 15,
    is_free: false,
    is_default: true,
    is_server_free: true,
    capabilities: ["chat", "streaming", "tools"],
    enabled: true,
    display_order: 10,
    model_class: "balanced",
    speed_tier: "medium",
    cost_tier: "medium",
    training_data: "Provider managed",
    thinking_mode_supported: true,
  },
  {
    id: "fallback-claude-haiku-4-5",
    provider: "anthropic",
    display_provider: "anthropic",
    transport: "anthropic",
    model_key: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    model_id: "claude-haiku-4-5",
    api_model_id: "claude-haiku-4-5",
    context_window: 200000,
    max_output: 8192,
    input_cost_per_1m: 0.8,
    output_cost_per_1m: 4,
    is_free: false,
    is_default: false,
    is_server_free: true,
    capabilities: ["chat", "streaming", "tools"],
    enabled: true,
    display_order: 20,
    model_class: "fast",
    speed_tier: "fast",
    cost_tier: "low",
    training_data: "Provider managed",
    thinking_mode_supported: false,
  },
  {
    id: "fallback-openai-gpt-5-4",
    provider: "openai",
    display_provider: "openai",
    transport: "openrouter",
    model_key: "gpt-5.4",
    label: "GPT-5.4",
    model_id: "openai/gpt-5.4",
    api_model_id: "openai/gpt-5.4",
    context_window: 1050000,
    max_output: 131072,
    input_cost_per_1m: 2.5,
    output_cost_per_1m: 15,
    is_free: false,
    is_default: false,
    is_server_free: false,
    capabilities: ["chat", "streaming", "tools", "vision"],
    enabled: true,
    display_order: 30,
    model_class: "frontier",
    speed_tier: "medium",
    cost_tier: "high",
    training_data: "Dec 2024",
    thinking_mode_supported: true,
  },
  {
    id: "fallback-google-gemini-2-5-flash",
    provider: "google",
    display_provider: "google",
    transport: "openrouter",
    model_key: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    model_id: "google/gemini-2.5-flash",
    api_model_id: "google/gemini-2.5-flash",
    context_window: 1048576,
    max_output: 8192,
    input_cost_per_1m: 0.3,
    output_cost_per_1m: 2.5,
    is_free: false,
    is_default: false,
    is_server_free: false,
    capabilities: ["chat", "streaming", "tools", "vision"],
    enabled: true,
    display_order: 40,
    model_class: "fast",
    speed_tier: "fast",
    cost_tier: "medium",
    training_data: "Jan 2025",
    thinking_mode_supported: true,
  },
  {
    id: "fallback-mimo-v2-pro",
    provider: "mimo",
    display_provider: "mimo",
    transport: "openrouter",
    model_key: "mimo-v2-pro",
    label: "MiMo V2 Pro",
    model_id: "xiaomi/mimo-v2-pro",
    api_model_id: "xiaomi/mimo-v2-pro",
    context_window: 1048576,
    max_output: 8192,
    input_cost_per_1m: 1,
    output_cost_per_1m: 3,
    is_free: false,
    is_default: false,
    is_server_free: false,
    capabilities: ["chat", "streaming", "tools"],
    enabled: true,
    display_order: 50,
    model_class: "agentic",
    speed_tier: "medium",
    cost_tier: "medium",
    training_data: "Provider managed",
    thinking_mode_supported: true,
  },
  {
    id: "fallback-minimax-m2-7",
    provider: "minimax",
    display_provider: "minimax",
    transport: "openrouter",
    model_key: "minimax-m2.7",
    label: "MiniMax M2.7",
    model_id: "minimax/minimax-m2.7",
    api_model_id: "minimax/minimax-m2.7",
    context_window: 204800,
    max_output: 8192,
    input_cost_per_1m: 0.3,
    output_cost_per_1m: 1.2,
    is_free: false,
    is_default: false,
    is_server_free: true,
    capabilities: ["chat", "streaming", "tools"],
    enabled: true,
    display_order: 60,
    model_class: "automation",
    speed_tier: "medium",
    cost_tier: "low",
    training_data: "Provider managed",
    thinking_mode_supported: true,
  },
  {
    id: "fallback-glm-4-5",
    provider: "glm",
    display_provider: "glm",
    transport: "openrouter",
    model_key: "glm-4.5",
    label: "GLM 4.5",
    model_id: "z-ai/glm-4.5",
    api_model_id: "z-ai/glm-4.5",
    context_window: 131072,
    max_output: 98304,
    input_cost_per_1m: 0.6,
    output_cost_per_1m: 2.2,
    is_free: false,
    is_default: false,
    is_server_free: false,
    capabilities: ["chat", "streaming", "tools"],
    enabled: true,
    display_order: 70,
    model_class: "reasoning",
    speed_tier: "medium",
    cost_tier: "medium",
    training_data: "Dec 2024",
    thinking_mode_supported: true,
  },
  {
    id: "fallback-openrouter-free",
    provider: "openrouter",
    display_provider: "openrouter",
    transport: "openrouter",
    model_key: "openrouter-free",
    label: "OpenRouter Free",
    model_id: "openrouter/free",
    api_model_id: "openrouter/free",
    context_window: 128000,
    max_output: 8192,
    input_cost_per_1m: 0,
    output_cost_per_1m: 0,
    is_free: true,
    is_default: false,
    is_server_free: true,
    capabilities: ["chat", "streaming"],
    enabled: true,
    display_order: 80,
    model_class: "economy",
    speed_tier: "medium",
    cost_tier: "low",
    training_data: "Provider managed",
    thinking_mode_supported: false,
  },
];

function isDisplayProvider(value: string): value is DisplayProvider {
  return (
    value === "anthropic" ||
    value === "openrouter" ||
    value === "openai" ||
    value === "google" ||
    value === "minimax" ||
    value === "mimo" ||
    value === "glm"
  );
}

function normalizeProvider(row: ModelConfigRow): DisplayProvider {
  if (row.display_provider && isDisplayProvider(row.display_provider)) {
    return row.display_provider;
  }

  if (isDisplayProvider(row.provider)) {
    return row.provider;
  }

  return "anthropic";
}

function normalizeTransport(row: ModelConfigRow): AITransport {
  if (row.transport === "anthropic" || row.transport === "openrouter") {
    return row.transport;
  }

  return normalizeProvider(row) === "anthropic" ? "anthropic" : "openrouter";
}

function normalizeApiModelId(row: ModelConfigRow): string {
  return row.api_model_id || row.model_id || row.model_key;
}

function normalizeCapabilities(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return ["chat", "streaming"];
}

function toNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildDisabledReason(
  transport: AITransport,
  serverConfigured: boolean,
  ruleMatch: RuleMatch | null
): string {
  if (ruleMatch && ruleMatch.remaining === 0) {
    return "Daily system quota for this model is exhausted. Save your own key or try again tomorrow.";
  }

  if (!serverConfigured) {
    return transport === "anthropic"
      ? "Add a Claude-compatible key to use this model."
      : "Add an OpenRouter key to use this model.";
  }

  return transport === "anthropic"
    ? "Shared Claude access is not enabled for this model. Save your own key or ask an admin to grant access."
    : "Shared OpenRouter access is not enabled for this model. Save your own key or ask an admin to grant access.";
}

function chooseRuleMatch(
  modelConfigId: string,
  rules: FreeRuleRow[],
  specificRuleIds: Set<string>,
  usageByRule: Map<string, number>
): RuleMatch | null {
  const matches = rules
    .filter((rule) => {
      if (rule.model_config_id !== modelConfigId || !rule.is_active) return false;
      if (rule.scope === "all_users") return true;
      return specificRuleIds.has(rule.id);
    })
    .map((rule) => {
      const used = usageByRule.get(rule.id) ?? 0;
      const remaining =
        rule.daily_request_limit === null
          ? null
          : Math.max(0, rule.daily_request_limit - used);
      return { rule, used, remaining };
    })
    .sort((left, right) => {
      if (left.remaining === null) return -1;
      if (right.remaining === null) return 1;
      return right.remaining - left.remaining;
    });

  return matches[0] ?? null;
}

async function fetchModelRows(): Promise<ModelConfigRow[]> {
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("model_config")
      .select(
        "id, provider, display_provider, transport, model_key, label, model_id, api_model_id, context_window, max_output, input_cost_per_1m, output_cost_per_1m, is_free, is_default, is_server_free, capabilities, enabled, display_order, model_class, speed_tier, cost_tier, training_data, thinking_mode_supported"
      )
      .eq("enabled", true)
      .order("display_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return data as ModelConfigRow[];
    }
  } catch {
    // Fall back to bundled rows if migrations are not yet applied.
  }

  return FALLBACK_MODEL_ROWS;
}

async function fetchRuleContext(userId?: string) {
  if (!userId) {
    return {
      rules: [] as FreeRuleRow[],
      specificRuleIds: new Set<string>(),
      usageByRule: new Map<string, number>(),
    };
  }

  try {
    const db = getSupabase();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: rulesData }, { data: ruleUsersData }, { data: usageData }] = await Promise.all([
      db
        .from("admin_free_model_rules")
        .select("id, model_config_id, scope, daily_request_limit, is_active")
        .eq("is_active", true),
      db
        .from("admin_free_model_rule_users")
        .select("rule_id, user_id")
        .eq("user_id", userId),
      db
        .from("model_access_usage_daily")
        .select("rule_id, model_config_id, request_count")
        .eq("user_id", userId)
        .eq("usage_date", today),
    ]);

    return {
      rules: (rulesData as FreeRuleRow[] | null) ?? [],
      specificRuleIds: new Set(
        ((ruleUsersData as FreeRuleUserRow[] | null) ?? []).map((row) => row.rule_id)
      ),
      usageByRule: new Map(
        ((usageData as UsageRow[] | null) ?? []).map((row) => [row.rule_id, row.request_count])
      ),
    };
  } catch {
    return {
      rules: [] as FreeRuleRow[],
      specificRuleIds: new Set<string>(),
      usageByRule: new Map<string, number>(),
    };
  }
}

async function buildCatalogModels(userId?: string, allowUserKeys = true): Promise<CatalogModel[]> {
  const [rows, ruleContext, savedProviders] = await Promise.all([
    fetchModelRows(),
    fetchRuleContext(userId),
    allowUserKeys && userId ? listActiveUserApiKeyProviders(userId) : Promise.resolve(new Set<AITransport>()),
  ]);

  const transportAvailability = {
    anthropic: hasServerKey("anthropic"),
    openrouter: hasServerKey("openrouter"),
  } satisfies Record<AITransport, boolean>;

  return rows
    .filter((row) => row.enabled !== false)
    .map((row) => {
      const provider = normalizeProvider(row);
      const transport = normalizeTransport(row);
      const apiModelId = normalizeApiModelId(row);
      const ruleMatch = chooseRuleMatch(
        row.id,
        ruleContext.rules,
        ruleContext.specificRuleIds,
        ruleContext.usageByRule
      );
      const hasSavedKey = allowUserKeys && savedProviders.has(transport);
      const hasFreeRule =
        !!ruleMatch &&
        transportAvailability[transport] &&
        (ruleMatch.remaining === null || ruleMatch.remaining > 0);
      const hasSharedAccess = Boolean(row.is_server_free) && transportAvailability[transport];

      let accessSource: ModelAccessSource = "unavailable";
      let available = false;

      if (hasSavedKey) {
        accessSource = "saved_key";
        available = true;
      } else if (hasFreeRule) {
        accessSource = "free_rule";
        available = true;
      } else if (hasSharedAccess) {
        accessSource = "server_key";
        available = true;
      }

      return {
        id: apiModelId,
        key: row.model_key,
        label: row.label,
        provider,
        transport,
        modelId: apiModelId,
        apiModelId,
        contextWindow: toNumber(row.context_window, 128000),
        maxOutput: toNumber(row.max_output, 8192),
        inputCostPer1m: toNumber(row.input_cost_per_1m, 0),
        outputCostPer1m: toNumber(row.output_cost_per_1m, 0),
        isFree: Boolean(row.is_free),
        isDefault: Boolean(row.is_default),
        isServerFree: Boolean(row.is_server_free),
        accessSource,
        available,
        remainingQuota: ruleMatch?.remaining ?? null,
        dailyLimit: ruleMatch?.rule.daily_request_limit ?? null,
        disabledReason: available
          ? null
          : buildDisabledReason(transport, transportAvailability[transport], ruleMatch),
        modelClass: row.model_class || "standard",
        speedTier: row.speed_tier || "medium",
        costTier: row.cost_tier || "medium",
        trainingData: row.training_data,
        thinkingModeSupported: Boolean(row.thinking_mode_supported),
        capabilities: normalizeCapabilities(row.capabilities),
        enabled: row.enabled !== false,
        description: `${Math.round(toNumber(row.context_window, 128000) / 1000)}K context`,
        modelConfigId: row.id,
        matchedRuleId: hasFreeRule ? ruleMatch?.rule.id ?? null : null,
      } satisfies CatalogModel;
    })
    .sort((left, right) => {
      const providerDelta = PROVIDER_ORDER.indexOf(left.provider) - PROVIDER_ORDER.indexOf(right.provider);
      if (providerDelta !== 0) return providerDelta;
      if (left.isDefault && !right.isDefault) return -1;
      if (!left.isDefault && right.isDefault) return 1;
      return left.label.localeCompare(right.label);
    });
}

function publicModel(model: CatalogModel): ModelOption {
  return {
    id: model.id,
    key: model.key,
    label: model.label,
    provider: model.provider,
    transport: model.transport,
    modelId: model.modelId,
    apiModelId: model.apiModelId,
    contextWindow: model.contextWindow,
    maxOutput: model.maxOutput,
    inputCostPer1m: model.inputCostPer1m,
    outputCostPer1m: model.outputCostPer1m,
    isFree: model.isFree,
    isDefault: model.isDefault,
    isServerFree: model.isServerFree,
    accessSource: model.accessSource,
    available: model.available,
    remainingQuota: model.remainingQuota,
    dailyLimit: model.dailyLimit,
    disabledReason: model.disabledReason,
    modelClass: model.modelClass,
    speedTier: model.speedTier,
    costTier: model.costTier,
    trainingData: model.trainingData,
    thinkingModeSupported: model.thinkingModeSupported,
    capabilities: model.capabilities,
    enabled: model.enabled,
    description: model.description,
  };
}

function findCatalogModel(models: CatalogModel[], identifier: string): CatalogModel | null {
  return (
    models.find((model) =>
      model.id === identifier ||
      model.key === identifier ||
      model.modelId === identifier ||
      model.apiModelId === identifier
    ) ?? null
  );
}

function resolveServerTransportKey(
  sessionId: string,
  transport: AITransport
): KeyResolution | null {
  return resolveLlmApiKey(sessionId, transport, "", false);
}

export async function loadModelCatalog(
  userId?: string,
  allowUserKeys = true
): Promise<ModelCatalogPayload> {
  const models = await buildCatalogModels(userId, allowUserKeys);
  const defaultModel =
    models.find((model) => model.isDefault && model.available) ??
    models.find((model) => model.isDefault) ??
    models[0] ??
    null;

  return {
    models: models.map(publicModel),
    defaultModel: defaultModel ? publicModel(defaultModel) : null,
    providers: PROVIDER_ORDER,
    transportAvailability: {
      anthropic: { serverConfigured: hasServerKey("anthropic") },
      openrouter: { serverConfigured: hasServerKey("openrouter") },
    },
  };
}

export async function resolveProviderApiKey({
  userId,
  sessionId,
  transport,
  inlineUserKey,
  allowUserKeys,
}: {
  userId?: string;
  sessionId: string;
  transport: AITransport;
  inlineUserKey?: string;
  allowUserKeys: boolean;
}): Promise<ProviderKeyResolution | null> {
  if (allowUserKeys && inlineUserKey) {
    return {
      apiKey: inlineUserKey,
      source: "session_key",
      userSuppliedKey: true,
    };
  }

  if (allowUserKeys && userId) {
    const savedKey = await getActiveUserApiKey(userId, transport);
    if (savedKey) {
      return {
        apiKey: savedKey.apiKey,
        source: "saved_key",
        userSuppliedKey: true,
        storedKeyId: savedKey.id,
      };
    }
  }

  const resolved = resolveServerTransportKey(sessionId, transport);
  if (!resolved) return null;

  return {
    apiKey: resolved.apiKey,
    source: "server_key",
    userSuppliedKey: false,
  };
}

export async function resolveModelExecution({
  userId,
  sessionId,
  modelIdentifier,
  inlineUserKey,
  allowUserKeys,
}: {
  userId?: string;
  sessionId: string;
  modelIdentifier: string;
  inlineUserKey?: string;
  allowUserKeys: boolean;
}): Promise<ModelExecutionResolution> {
  const models = await buildCatalogModels(userId, allowUserKeys);
  const model = findCatalogModel(models, modelIdentifier);

  if (!model) {
    return {
      allowed: false,
      status: 400,
      model: null,
      userSuppliedKey: Boolean(inlineUserKey),
      error: "The selected model is not available in the catalog.",
    };
  }

  if (allowUserKeys && inlineUserKey) {
    return {
      allowed: true,
      status: 200,
      model,
      accessSource: "session_key",
      apiKey: inlineUserKey,
      userSuppliedKey: true,
    };
  }

  if (allowUserKeys && userId) {
    const savedKey = await getActiveUserApiKey(userId, model.transport);
    if (savedKey) {
      return {
        allowed: true,
        status: 200,
        model,
        accessSource: "saved_key",
        apiKey: savedKey.apiKey,
        userSuppliedKey: true,
        storedKeyId: savedKey.id,
      };
    }
  }

  const serverKey = resolveServerTransportKey(sessionId, model.transport);
  if (!serverKey) {
    return {
      allowed: false,
      status: 400,
      model,
      userSuppliedKey: false,
      error: model.disabledReason || "No executable key is configured for this transport.",
    };
  }

  if (model.accessSource === "free_rule") {
    return {
      allowed: true,
      status: 200,
      model,
      accessSource: "free_rule",
      apiKey: serverKey.apiKey,
      userSuppliedKey: false,
      ruleId: model.matchedRuleId ?? undefined,
      remainingQuota: model.remainingQuota,
    };
  }

  if (model.accessSource === "server_key") {
    return {
      allowed: true,
      status: 200,
      model,
      accessSource: "server_key",
      apiKey: serverKey.apiKey,
      userSuppliedKey: false,
    };
  }

  return {
    allowed: false,
    status: model.remainingQuota === 0 ? 429 : 403,
    model,
    userSuppliedKey: false,
    error: model.disabledReason || "This model requires your own API key or an admin-granted free rule.",
  };
}

export async function incrementModelAccessUsage({
  ruleId,
  userId,
  modelConfigId,
}: {
  ruleId: string;
  userId: string;
  modelConfigId: string;
}): Promise<void> {
  const db = getSupabase();
  const usageDate = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("model_access_usage_daily")
    .select("id, request_count")
    .eq("rule_id", ruleId)
    .eq("user_id", userId)
    .eq("model_config_id", modelConfigId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (data?.id) {
    await db
      .from("model_access_usage_daily")
      .update({ request_count: (data.request_count ?? 0) + 1 })
      .eq("id", data.id);
    return;
  }

  await db.from("model_access_usage_daily").insert({
    rule_id: ruleId,
    user_id: userId,
    model_config_id: modelConfigId,
    usage_date: usageDate,
    request_count: 1,
  });
}
