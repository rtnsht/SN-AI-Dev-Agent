export type SDLCPhase = "spec" | "design" | "implementation" | "testing" | "deployment";

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
  { key: "design", label: "Design", requiresApproval: true, tooltip: "Requires user approval before proceeding to Implementation" },
  { key: "implementation", label: "Implementation", requiresApproval: false, tooltip: "Auto-proceeds to Testing after completion" },
  { key: "testing", label: "Testing", requiresApproval: false, tooltip: "Auto-proceeds to Deployment after completion" },
  { key: "deployment", label: "Deployment", requiresApproval: false, tooltip: "Final phase — no further gate" },
];

/** AI Provider choices */
export type AIProvider = "anthropic" | "openrouter";

/** Model choices available to the user (for Anthropic direct) */
export type ModelChoice = "sonnet-4" | "opus-4";

export interface ModelOption {
  key: string;
  label: string;
  modelId: string;
  description: string;
  provider: AIProvider;
}

/** Anthropic direct models */
export const ANTHROPIC_MODELS: ModelOption[] = [
  { key: "sonnet-4", label: "Claude Sonnet 4.6", modelId: "claude-sonnet-4-6", description: "Fast & intelligent", provider: "anthropic" },
  { key: "opus-4", label: "Claude Opus 4.6", modelId: "claude-opus-4-6", description: "Most capable", provider: "anthropic" },
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
  const promptCost = parseFloat(model.pricing.prompt) * 1000000; // Cost per 1M tokens
  const completionCost = parseFloat(model.pricing.completion) * 1000000;
  const priceStr = promptCost > 0 || completionCost > 0
    ? `$${promptCost.toFixed(2)}/$${completionCost.toFixed(2)} per 1M tokens`
    : "Free";

  return {
    key: model.id,
    label: model.name,
    modelId: model.id,
    description: `${priceStr} • ${Math.round(model.context_length / 1000)}K context`,
    provider: "openrouter",
  };
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** Base64 data-URI images attached to this message (e.g. "data:image/png;base64,...") */
  images?: string[];
  toolExecutions?: ToolExecution[];
  type?: "info" | "warning" | "success" | "error";
  /** If this message contains a phase gate, which phase is it for? */
  phaseGate?: SDLCPhase;
  /** Has this phase gate been approved by the user? */
  approved?: boolean;
  /** Was this phase gate auto-approved (no user sign-off required)? */
  autoApproved?: boolean;
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

export interface Credentials {
  instanceUrl: string;
  username: string;
  password: string;
  claudeApiKey: string;
  openRouterApiKey: string;
}

export interface HelperApiStatus {
  deployed: boolean;
  path?: string;
}

export interface HelperApisInfo {
  uiPolicyActionHelper?: HelperApiStatus;
  updateSetHelper?: HelperApiStatus;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
  userInfo?: { name: string; username: string };
  roles?: string[];
  hasAdmin?: boolean;
  hasSecurityAdmin?: boolean;
  helperApis?: HelperApisInfo;
}

export interface UsageInfo {
  used: number;
  max: number;
  remaining: number;
  resetsAt: string | null;
  windowHours: number;
}

/** Live status update during streaming chat */
export interface LiveStatus {
  message: string;
  phase: "thinking" | "tool" | "responding";
  toolName?: string;
}

