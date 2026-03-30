export type SDLCPhase = "spec" | "design" | "scope_selection" | "implementation" | "testing" | "deployment";

export interface SDLCPhaseInfo {
  key: SDLCPhase;
  label: string;
  /** Whether this phase gate requires explicit user approval to proceed */
  requiresApproval: boolean;
  /** Tooltip text shown on hover in the PhaseTracker */
  tooltip: string;
}

export const SDLC_PHASES: SDLCPhaseInfo[] = [
  { key: "spec", label: "Spec", requiresApproval: true, tooltip: "Requires user approval before proceeding to Design" },
  { key: "design", label: "Design", requiresApproval: true, tooltip: "Requires user approval before proceeding to Scope Selection" },
  { key: "scope_selection", label: "Scope", requiresApproval: false, tooltip: "Auto-proceeds after scope choice — no separate approval needed" },
  { key: "implementation", label: "Impl", requiresApproval: true, tooltip: "Requires user approval before proceeding to Testing" },
  { key: "testing", label: "Testing", requiresApproval: true, tooltip: "Requires user approval before proceeding to Deployment" },
  { key: "deployment", label: "Deployment", requiresApproval: true, tooltip: "Final phase — requires user approval to mark complete" },
];

/** AI Provider groups shown in the model catalog UI */
export type AIProvider =
  | "anthropic"
  | "openrouter"
  | "openai"
  | "google"
  | "minimax"
  | "mimo"
  | "glm"
  | "free";

/** Execution transports currently supported by the backend */
export type AITransport = "anthropic" | "openrouter";

export type ModelAccessSource =
  | "session_key"
  | "saved_key"
  | "free_rule"
  | "server_key"
  | "unavailable";

/** Model choices available to the user (for Anthropic direct) */
export type ModelChoice = "sonnet-4" | "opus-4" | "haiku-4";

/** Extended ModelOption for multi-provider routing */
export interface ModelOption {
  /** Unique identifier for the model (e.g., "minimax/M2.7") */
  id: string;
  /** Human-readable label for display */
  label: string;
  /** Provider this model belongs to */
  provider: AIProvider;
  /** Current executable transport for the model */
  transport?: AITransport;
  /** Actual model ID sent to the API */
  modelId: string;
  /** Stable catalog key stored in the database */
  key?: string;
  /** Actual model identifier sent to the transport */
  apiModelId?: string;
  /** Context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutput: number;
  /** Input cost per 1M tokens (USD) */
  inputCostPer1m: number;
  /** Output cost per 1M tokens (USD) */
  outputCostPer1m: number;
  /** Whether this model is free to use */
  isFree: boolean;
  /** Whether this is the default model */
  isDefault?: boolean;
  /** Whether this model is free via server-side routing */
  isServerFree?: boolean;
  /** Access source for the current user */
  accessSource?: ModelAccessSource;
  /** Whether the user can select and execute this model right now */
  available?: boolean;
  /** Remaining daily quota for free-rule access */
  remainingQuota?: number | null;
  /** Daily quota limit for free-rule access */
  dailyLimit?: number | null;
  /** Human-readable reason for disabled state */
  disabledReason?: string | null;
  /** Catalog metadata used by the FDE detail card */
  modelClass?: string;
  speedTier?: string;
  costTier?: string;
  trainingData?: string | null;
  thinkingModeSupported?: boolean;
  /** Capabilities: chat, streaming, tools, image-generation */
  capabilities: string[];
  /** Whether this model is enabled */
  enabled?: boolean;
  /** Legacy fields for backward compatibility */
  description?: string;
}

export type ProjectDocumentationType =
  | "guideline"
  | "guardrail"
  | "reference"
  | "eval_criteria"
  | "runbook";

export interface WorkspaceInfo {
  id: string;
  user_id: string;
  name: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SpaceInfo {
  id: string;
  workspace_id: string;
  name: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectInfo {
  id: string;
  space_id: string;
  name: string;
  description: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocumentationEntry {
  id: string;
  project_id: string;
  doc_type: ProjectDocumentationType;
  title: string;
  content: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceContextPayload {
  workspace: WorkspaceInfo;
  space: SpaceInfo;
  project: ProjectInfo;
  effectiveSettings: Record<string, unknown>;
}

export interface PersistedChatSummary {
  id: string;
  title: string;
  mode: "agent" | "quick";
  active_tab_id: string | null;
  project_id: string | null;
  connection_id: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PersistedChatMessageRecord {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  model_used: string | null;
  provider: string | null;
  token_count: number | null;
  context_items: unknown[];
  artifacts: unknown[];
  metadata: Record<string, unknown>;
  sort_key: number;
  created_at: string;
}

export interface SavedSystemConnectionSummary {
  id: string;
  system_type: string;
  label: string;
  instance_url: string;
  project_id: string | null;
  is_default: boolean;
  is_active: boolean;
  last_verified_at: string | null;
  last_used_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Anthropic direct models */
export const ANTHROPIC_MODELS: ModelOption[] = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic", modelId: "claude-opus-4-6", contextWindow: 200000, maxOutput: 8192, inputCostPer1m: 15, outputCostPer1m: 75, isFree: false, capabilities: ["chat", "streaming", "tools"], description: "Most intelligent — agents & coding" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", modelId: "claude-sonnet-4-6", contextWindow: 200000, maxOutput: 8192, inputCostPer1m: 3, outputCostPer1m: 15, isFree: false, capabilities: ["chat", "streaming", "tools"], description: "Best speed + intelligence balance", isDefault: true },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", modelId: "claude-haiku-4-5", contextWindow: 200000, maxOutput: 8192, inputCostPer1m: 0.8, outputCostPer1m: 4, isFree: false, capabilities: ["chat", "streaming", "tools"], description: "Fastest — near-frontier intelligence" },
];

/** Legacy MODEL_OPTIONS for backward compatibility */
export const MODEL_OPTIONS = ANTHROPIC_MODELS;

/** OpenRouter model from API */
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    modality: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
}

/** Convert OpenRouter model to ModelOption */
export function openRouterModelToOption(model: OpenRouterModel): ModelOption {
  const promptCost = parseFloat(model.pricing?.prompt ?? "0") * 1000000; // Cost per 1M tokens
  const completionCost = parseFloat(model.pricing?.completion ?? "0") * 1000000;
  const isFree = promptCost === 0 && completionCost === 0;
  const priceStr = !isFree
    ? `$${promptCost.toFixed(2)}/$${completionCost.toFixed(2)} per 1M tokens`
    : "Free";

  return {
    id: model.id,
    label: model.name,
    provider: "openrouter",
    modelId: model.id,
    contextWindow: model.context_length,
    maxOutput: 8192,
    inputCostPer1m: promptCost,
    outputCostPer1m: completionCost,
    isFree,
    capabilities: ["chat", "streaming", "tools"],
    description: `${priceStr} • ${Math.round(model.context_length / 1000)}K context`,
  };
}

/** A non-image file attachment (PDF, Word, Excel) */
export interface FileAttachment {
  /** Original file name */
  name: string;
  /** MIME type (application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, etc.) */
  mimeType: string;
  /** Base64-encoded file data (no data-URI prefix) */
  data: string;
  /** File size in bytes */
  size: number;
}

export interface ChatMessage {
  /** Stable unique identifier for this message */
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** ISO 8601 timestamp when this message was created */
  timestamp?: string;
  /** Base64 data-URI images attached to this message (e.g. "data:image/png;base64,...") */
  images?: string[];
  /** Non-image file attachments (PDF, Word, Excel) */
  files?: FileAttachment[];
  toolExecutions?: ToolExecution[];
  type?: "info" | "warning" | "success" | "error";
  /** If this message contains a phase gate, which phase is it for? */
  phaseGate?: SDLCPhase;
  /** Has this phase gate been approved by the user? */
  approved?: boolean;
  /** Was this phase gate auto-approved (no user sign-off required)? */
  autoApproved?: boolean;
  /** Has the user already answered interactive choices in this message? */
  choicesAnswered?: boolean;
  /** If true, message is sent to API but hidden from the chat UI (e.g., auto-resume messages) */
  hidden?: boolean;
  /** If true, message is queued and waiting to be sent (user typed while AI was processing) */
  queued?: boolean;
}

/** A message waiting in the queue to be sent after the current AI response completes */
export interface QueuedMessage {
  id: string;
  text: string;
  images?: string[];
  files?: FileAttachment[];
  timestamp: string;
}

/** Interactive choice option presented to user */
export interface UserChoice {
  key: string;
  label: string;
  description?: string;
}

/** Parsed interactive choices block from assistant message */
export interface UserChoicesBlock {
  choices: UserChoice[];
}

/** Parse USER_CHOICES markers from assistant message content.
 *  Supports both HTML comment format <!-- USER_CHOICES:{...} -->
 *  and tag format <USER_CHOICES:{...}> that some models emit. */
export function parseUserChoices(content: string): UserChoicesBlock | null {
  // Try HTML comment format first: <!-- USER_CHOICES:{...} -->
  const commentMatch = content.match(/<!--\s*USER_CHOICES:([\s\S]*?)\s*-->/);
  if (commentMatch) {
    try {
      return JSON.parse(commentMatch[1]) as UserChoicesBlock;
    } catch {
      // fall through
    }
  }
  // Try tag format: <USER_CHOICES:{...}>  (some models emit this instead)
  const tagMatch = content.match(/<USER_CHOICES:([\s\S]*?)>/);
  if (tagMatch) {
    try {
      return JSON.parse(tagMatch[1]) as UserChoicesBlock;
    } catch {
      return null;
    }
  }
  return null;
}

/** Strip USER_CHOICES markers from content for display */
export function stripUserChoicesMarker(content: string): string {
  return content
    .replace(/<!--\s*USER_CHOICES:[\s\S]*?\s*-->/g, "")
    .replace(/<USER_CHOICES:[\s\S]*?>/g, "")
    .trim();
}

/** Parse phase gate markers from assistant message content */
export function parsePhaseGate(content: string): SDLCPhase | null {
  const match = content.match(/<!--\s*PHASE_GATE:(\w+)\s*-->/);
  if (match) {
    const phase = match[1] as SDLCPhase;
    if (SDLC_PHASES.some((p) => p.key === phase)) return phase;
  }
  return null;
}

/** Strip phase gate markers from content for display */
export function stripPhaseGateMarker(content: string): string {
  return content.replace(/<!--\s*PHASE_GATE:\w+\s*-->/g, "").trim();
}

export interface ToolExecution {
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

export type ServiceNowAuthMethod =
  | "basic"
  | "oauth_client_credentials"
  | "oauth_authorization_code"
  | "session";

export interface BrowserSessionCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface Credentials {
  instanceUrl: string;
  username: string;
  password: string;
  claudeApiKey: string;
  openRouterApiKey: string;
  snAuthType?: ServiceNowAuthMethod;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  sessionCookies?: BrowserSessionCookie[];
  sessionToken?: string;
}

export interface HelperApiStatus {
  deployed: boolean;
  path?: string;
}

export interface HelperApisInfo {
  uiPolicyActionHelper?: HelperApiStatus;
  updateSetHelper?: HelperApiStatus;
  addToUpdateSetHelper?: HelperApiStatus;
}

export interface AssignmentGroup {
  sysId: string;
  name: string;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
  authType?: ServiceNowAuthMethod;
  failureCategory?: "sso_redirect" | "mfa_required" | "generic";
  suggestedAuthMethods?: ServiceNowAuthMethod[];
  userInfo?: {
    name: string;
    username: string;
    sysId?: string;
    email?: string;
    assignmentGroups?: AssignmentGroup[];
  };
  roles?: string[];
  hasAdmin?: boolean;
  hasSecurityAdmin?: boolean;
  noRoles?: boolean;
  helperApis?: HelperApisInfo;
}

export interface ExamplePrompt {
  icon: string;
  text: string;
  desc: string;
}

export interface UpdateSetSummary {
  name: string;
  state: string;
  description: string;
  updatedOn: string;
  application: string;
  sysId: string;
}

export interface CategorizedPrompts {
  foryou: ExamplePrompt[];
  build: ExamplePrompt[];
  explore: ExamplePrompt[];
  quick: ExamplePrompt[];
  updates: UpdateSetSummary[];
}

export type { PromptPoolMap } from "./suggestion-engine/types";

export interface UsageInfo {
  used: number;
  max: number;
  remaining: number;
  resetsAt: string | null;
  windowHours: number;
  /** Anonymous requests from this IP today */
  anonUsed?: number;
  /** Authenticated requests from this user today */
  authUsed?: number;
  /** Whether this user is authenticated */
  isAuthenticated?: boolean;
}

/** Trial status for per-user daily request limits */
export interface TrialStatus {
  trialActive: boolean;
  trialExpired: boolean;
  daysLeft: number;
  dailyUsed: number;
  dailyLimit: number;
  totalUsed: number;
  trialDays: number;
  isConfigured: boolean;
}

/** Live status update during streaming chat */
export interface LiveStatus {
  message: string;
  phase: "thinking" | "tool" | "responding";
  toolName?: string;
}

