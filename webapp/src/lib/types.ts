export type SDLCPhase = "spec" | "design" | "implementation" | "testing" | "deployment";

export const SDLC_PHASES: { key: SDLCPhase; label: string }[] = [
  { key: "spec", label: "Spec" },
  { key: "design", label: "Design" },
  { key: "implementation", label: "Implementation" },
  { key: "testing", label: "Testing" },
  { key: "deployment", label: "Deployment" },
];

/** Model choices available to the user */
export type ModelChoice = "sonnet-4" | "opus-4";

export const MODEL_OPTIONS: { key: ModelChoice; label: string; modelId: string; description: string }[] = [
  { key: "sonnet-4", label: "Claude Sonnet 4.6", modelId: "claude-sonnet-4-6", description: "Fast & intelligent" },
  { key: "opus-4", label: "Claude Opus 4.6", modelId: "claude-opus-4-6", description: "Most capable" },
];

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolExecutions?: ToolExecution[];
  type?: "info" | "warning" | "success" | "error";
  /** If this message contains a phase gate, which phase is it for? */
  phaseGate?: SDLCPhase;
  /** Has this phase gate been approved by the user? */
  approved?: boolean;
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
}

export interface ConnectionResult {
  success: boolean;
  message: string;
  userInfo?: { name: string; username: string };
  roles?: string[];
  hasAdmin?: boolean;
  hasSecurityAdmin?: boolean;
}

export interface UsageInfo {
  used: number;
  max: number;
  remaining: number;
  resetsAt: string | null;
  windowHours: number;
}

