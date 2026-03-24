import type { SDLCPhase } from "@/lib/types";

export const SHARE_APP_URL = "https://snaiagent.rapps.ai/";
export const SHARE_BASE_TAGS = ["#servicenow", "#ai"] as const;
export const SHARE_FALLBACK_TAG = "#more-time-to-think";

export interface ShareMetrics {
  durationMin: number;
  phaseCount: number;
  toolCount: number;
  assistantCount: number;
  completedPhases?: SDLCPhase[];
  aiTag?: string | null;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function pluralize(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function sanitizeHashtag(value: string | null | undefined): string {
  if (!value) return SHARE_FALLBACK_TAG;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleaned || cleaned.length > 50) return SHARE_FALLBACK_TAG;
  return `#${cleaned}`;
}

export function normalizeShareMetrics(input: ShareMetrics): ShareMetrics {
  return {
    durationMin: clampInt(input.durationMin, 1, 24 * 60),
    phaseCount: clampInt(input.phaseCount, 1, 6),
    toolCount: clampInt(input.toolCount, 1, 500),
    assistantCount: clampInt(input.assistantCount, 1, 500),
    completedPhases: input.completedPhases ?? [],
    aiTag: sanitizeHashtag(input.aiTag),
  };
}

export function buildShareAchievement(metrics: ShareMetrics): string {
  const normalized = normalizeShareMetrics(metrics);
  const phases = new Set(normalized.completedPhases ?? []);

  if (phases.has("deployment") || phases.has("testing")) {
    return "a full ServiceNow workflow";
  }
  if (phases.has("implementation")) {
    return "a ServiceNow build";
  }
  if (phases.has("design")) {
    return "a ServiceNow design";
  }
  if (normalized.phaseCount >= 3) {
    return "a multi-step ServiceNow workflow";
  }
  return "a ServiceNow task";
}

export function buildShareHeadline(metrics: ShareMetrics): string {
  const normalized = normalizeShareMetrics(metrics);
  const achievement = buildShareAchievement(normalized);

  if (achievement === "a full ServiceNow workflow") {
    return `Completed a full ServiceNow workflow in ${normalized.durationMin} minutes`;
  }
  if (achievement === "a ServiceNow build") {
    return `Moved a ServiceNow build forward in ${normalized.durationMin} minutes`;
  }
  if (achievement === "a ServiceNow design") {
    return `Took a ServiceNow idea into design in ${normalized.durationMin} minutes`;
  }
  return `Accelerated a ServiceNow task in ${normalized.durationMin} minutes`;
}

export function buildShareSubline(metrics: ShareMetrics): string {
  const normalized = normalizeShareMetrics(metrics);
  return `${pluralize(normalized.toolCount, "AI-guided operation", "AI-guided operations")} across ${pluralize(normalized.phaseCount, "SDLC stage", "SDLC stages")}`;
}

export function buildShareMessage(metrics: ShareMetrics): string {
  const normalized = normalizeShareMetrics(metrics);
  const aiTag = sanitizeHashtag(normalized.aiTag);
  const headline = buildShareHeadline(normalized);
  const operationLine = buildShareSubline(normalized);

  return [
    `${headline} today. SN AI Agent handled ${operationLine.toLowerCase()}, which gave me more time to focus on the thinking work.`,
    "",
    `${SHARE_BASE_TAGS.join(" ")} ${aiTag}`,
    "",
    SHARE_APP_URL,
  ].join("\n");
}

export function buildShareCardUrl(sessionId: string, metrics: ShareMetrics): string {
  const normalized = normalizeShareMetrics(metrics);
  const params = new URLSearchParams({
    sessionId,
    durationMin: String(normalized.durationMin),
    phaseCount: String(normalized.phaseCount),
    toolCount: String(normalized.toolCount),
    assistantCount: String(normalized.assistantCount),
    tag: sanitizeHashtag(normalized.aiTag),
  });
  return `/api/share-card?${params.toString()}`;
}
