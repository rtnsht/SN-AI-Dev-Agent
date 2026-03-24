import type { Credentials } from "@/lib/types";
import type { ChatMessage, UserCredentials } from "@/lib/sn-engine";

type ValidationOk<T> = { ok: true; data: T };
type ValidationErr = { ok: false; error: string };
type ValidationResult<T> = ValidationOk<T> | ValidationErr;
const SESSION_ID_PATTERN = /^sess_\d{13,20}_[A-Za-z0-9-]{6,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value)) return false;
  return value.every((msg) => {
    if (!isRecord(msg)) return false;
    if (typeof msg.role !== "string" || typeof msg.content !== "string") return false;
    if ("images" in msg && msg.images !== undefined && !isStringArray(msg.images)) return false;
    if ("timestamp" in msg && msg.timestamp !== undefined && typeof msg.timestamp !== "string") return false;
    return true;
  });
}

function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 128 && SESSION_ID_PATTERN.test(value);
}

export interface ParsedChatBody {
  credentials: UserCredentials;
  messages: ChatMessage[];
  model?: string;
  aiProvider?: "anthropic" | "openrouter";
  sessionId?: string;
  phase?: string;
  sddMode?: boolean;
}

export function parseChatBody(body: unknown): ValidationResult<ParsedChatBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (!isRecord(body.credentials)) return { ok: false, error: "credentials object is required" };
  if (!isChatMessageArray(body.messages)) return { ok: false, error: "messages array is required" };
  if ("model" in body && body.model !== undefined && typeof body.model !== "string") {
    return { ok: false, error: "model must be a string" };
  }
  if ("aiProvider" in body && body.aiProvider !== undefined && body.aiProvider !== "anthropic" && body.aiProvider !== "openrouter") {
    return { ok: false, error: "aiProvider must be 'anthropic' or 'openrouter'" };
  }
  if ("sessionId" in body && body.sessionId !== undefined && !isValidSessionId(body.sessionId)) {
    return { ok: false, error: "sessionId has invalid format" };
  }
  if ("phase" in body && body.phase !== undefined && body.phase !== null && typeof body.phase !== "string") {
    return { ok: false, error: "phase must be a string" };
  }
  if ("sddMode" in body && body.sddMode !== undefined && typeof body.sddMode !== "boolean") {
    return { ok: false, error: "sddMode must be a boolean" };
  }
  return {
    ok: true,
    data: {
      credentials: body.credentials as unknown as UserCredentials,
      messages: body.messages as ChatMessage[],
      model: body.model as string | undefined,
      aiProvider: body.aiProvider as "anthropic" | "openrouter" | undefined,
      sessionId: body.sessionId as string | undefined,
      phase: body.phase as string | undefined,
      sddMode: body.sddMode as boolean | undefined,
    },
  };
}

export type ParsedTestConnectionBody = Partial<Credentials>;

export function parseTestConnectionBody(body: unknown): ValidationResult<ParsedTestConnectionBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  return { ok: true, data: body as unknown as Partial<Credentials> };
}

export interface ParsedInstancePromptsBody extends Partial<Credentials> {
  userContext?: unknown;
  seenHashes?: string[];
}

export function parseInstancePromptsBody(body: unknown): ValidationResult<ParsedInstancePromptsBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if ("seenHashes" in body && body.seenHashes !== undefined && !isStringArray(body.seenHashes)) {
    return { ok: false, error: "seenHashes must be a string array" };
  }
  return { ok: true, data: body as unknown as ParsedInstancePromptsBody };
}

export interface ParsedSessionStartBody {
  sessionId: string;
  instanceUrl?: string;
  username?: string;
  userFullName?: string;
  model?: string;
  aiProvider?: string;
  hasAdmin?: boolean;
  hasSecurityAdmin?: boolean;
  nodeVersion?: string;
}

export function parseSessionStartBody(body: unknown): ValidationResult<ParsedSessionStartBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (!isValidSessionId(body.sessionId)) {
    return { ok: false, error: "sessionId has invalid format" };
  }
  const stringFields = ["instanceUrl", "username", "userFullName", "model", "aiProvider", "nodeVersion"] as const;
  for (const key of stringFields) {
    if (key in body && body[key] !== undefined && typeof body[key] !== "string") {
      return { ok: false, error: `${key} must be a string` };
    }
  }
  if ("hasAdmin" in body && body.hasAdmin !== undefined && typeof body.hasAdmin !== "boolean") {
    return { ok: false, error: "hasAdmin must be a boolean" };
  }
  if ("hasSecurityAdmin" in body && body.hasSecurityAdmin !== undefined && typeof body.hasSecurityAdmin !== "boolean") {
    return { ok: false, error: "hasSecurityAdmin must be a boolean" };
  }
  return { ok: true, data: body as unknown as ParsedSessionStartBody };
}

export interface ParsedSessionEndBody {
  sessionId: string;
}

export function parseSessionEndBody(body: unknown): ValidationResult<ParsedSessionEndBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (!isValidSessionId(body.sessionId)) {
    return { ok: false, error: "sessionId has invalid format" };
  }
  return { ok: true, data: { sessionId: body.sessionId } };
}

export interface ParsedShareTrackingBody {
  sessionId: string;
  action: "shown" | "dismissed" | "shared";
  platform?: "linkedin" | "x";
}

export function parseShareTrackingBody(body: unknown): ValidationResult<ParsedShareTrackingBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (!isValidSessionId(body.sessionId)) {
    return { ok: false, error: "sessionId has invalid format" };
  }
  if (body.action !== "shown" && body.action !== "dismissed" && body.action !== "shared") {
    return { ok: false, error: "action must be 'shown', 'dismissed', or 'shared'" };
  }
  if ("platform" in body && body.platform !== undefined && body.platform !== "linkedin" && body.platform !== "x") {
    return { ok: false, error: "platform must be 'linkedin' or 'x'" };
  }
  if (body.action === "shared" && !body.platform) {
    return { ok: false, error: "platform is required when action is 'shared'" };
  }
  return {
    ok: true,
    data: {
      sessionId: body.sessionId,
      action: body.action,
      platform: body.platform as "linkedin" | "x" | undefined,
    },
  };
}

export interface ParsedShareTagBody {
  sessionId: string;
  durationMin: number;
  phaseCount: number;
  toolCount: number;
  assistantCount: number;
}

export function parseShareTagBody(body: unknown): ValidationResult<ParsedShareTagBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (!isValidSessionId(body.sessionId)) {
    return { ok: false, error: "sessionId has invalid format" };
  }

  const numericFields = ["durationMin", "phaseCount", "toolCount", "assistantCount"] as const;
  for (const field of numericFields) {
    if (typeof body[field] !== "number" || !Number.isFinite(body[field]) || !Number.isInteger(body[field])) {
      return { ok: false, error: `${field} must be an integer` };
    }
  }

  const durationMin = body.durationMin as number;
  const phaseCount = body.phaseCount as number;
  const toolCount = body.toolCount as number;
  const assistantCount = body.assistantCount as number;

  if (durationMin < 1 || durationMin > 1440) {
    return { ok: false, error: "durationMin must be between 1 and 1440" };
  }
  if (phaseCount < 1 || phaseCount > 6) {
    return { ok: false, error: "phaseCount must be between 1 and 6" };
  }
  if (toolCount < 1 || toolCount > 1000) {
    return { ok: false, error: "toolCount must be between 1 and 1000" };
  }
  if (assistantCount < 1 || assistantCount > 1000) {
    return { ok: false, error: "assistantCount must be between 1 and 1000" };
  }

  return {
    ok: true,
    data: {
      sessionId: body.sessionId as string,
      durationMin,
      phaseCount,
      toolCount,
      assistantCount,
    },
  };
}

export interface ParsedEmailBody {
  email: string;
}

export function parseEmailBody(body: unknown): ValidationResult<ParsedEmailBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.email !== "string" || body.email.trim() === "") {
    return { ok: false, error: "Email is required" };
  }
  return { ok: true, data: { email: body.email } };
}

export interface ParsedTokenBody {
  token: string;
}

export function parseTokenBody(body: unknown): ValidationResult<ParsedTokenBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.token !== "string" || body.token.trim() === "") {
    return { ok: false, error: "Token is required" };
  }
  return { ok: true, data: { token: body.token } };
}

export interface ParsedLoginBody {
  email: string;
  password: string;
}

export function parseLoginBody(body: unknown): ValidationResult<ParsedLoginBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.email !== "string" || body.email.trim() === "") {
    return { ok: false, error: "Email and password are required" };
  }
  if (typeof body.password !== "string" || body.password.trim() === "") {
    return { ok: false, error: "Email and password are required" };
  }
  return { ok: true, data: { email: body.email, password: body.password } };
}

export interface ParsedVerifyOtpBody {
  email: string;
  otp: string;
}

export function parseVerifyOtpBody(body: unknown): ValidationResult<ParsedVerifyOtpBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.email !== "string" || body.email.trim() === "") {
    return { ok: false, error: "Email and verification code are required" };
  }
  if (typeof body.otp !== "string" || body.otp.trim() === "") {
    return { ok: false, error: "Email and verification code are required" };
  }
  return { ok: true, data: { email: body.email, otp: body.otp } };
}

export interface ParsedRequestAccessBody {
  name: string;
  email: string;
  company?: string;
  use_case?: string;
}

export function parseRequestAccessBody(body: unknown): ValidationResult<ParsedRequestAccessBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return { ok: false, error: "Name and email are required" };
  }
  if (typeof body.email !== "string" || body.email.trim() === "") {
    return { ok: false, error: "Name and email are required" };
  }
  if ("company" in body && body.company !== undefined && body.company !== null && typeof body.company !== "string") {
    return { ok: false, error: "company must be a string" };
  }
  if ("use_case" in body && body.use_case !== undefined && body.use_case !== null && typeof body.use_case !== "string") {
    return { ok: false, error: "use_case must be a string" };
  }
  return {
    ok: true,
    data: {
      name: body.name,
      email: body.email,
      company: body.company as string | undefined,
      use_case: body.use_case as string | undefined,
    },
  };
}

export interface ParsedRegisterInviteBody {
  code: string;
  name: string;
  email: string;
  password: string;
}

export function parseRegisterInviteBody(body: unknown): ValidationResult<ParsedRegisterInviteBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  const fields: Array<keyof ParsedRegisterInviteBody> = ["code", "name", "email", "password"];
  for (const field of fields) {
    if (typeof body[field] !== "string" || (body[field] as string).trim() === "") {
      return { ok: false, error: "All fields are required" };
    }
  }
  return { ok: true, data: body as unknown as ParsedRegisterInviteBody };
}

export interface ParsedSetPasswordBody {
  password: string;
}

export function parseSetPasswordBody(body: unknown): ValidationResult<ParsedSetPasswordBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.password !== "string" || body.password.trim() === "") {
    return { ok: false, error: "Password is required" };
  }
  return { ok: true, data: { password: body.password } };
}

export interface ParsedEnhancePromptBody {
  text: string;
  mode: "grammar" | "enhance";
}

export function parseEnhancePromptBody(body: unknown): ValidationResult<ParsedEnhancePromptBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.text !== "string" || body.text.trim() === "") {
    return { ok: false, error: "Text is required" };
  }
  if (body.mode !== "grammar" && body.mode !== "enhance") {
    return { ok: false, error: "Mode must be 'grammar' or 'enhance'" };
  }
  return { ok: true, data: { text: body.text, mode: body.mode } };
}

export interface ParsedBrowserConnectBody {
  instanceUrl: string;
  username?: string;
  password?: string;
}

export function parseBrowserConnectBody(body: unknown): ValidationResult<ParsedBrowserConnectBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.instanceUrl !== "string" || body.instanceUrl.trim() === "") {
    return { ok: false, error: "Please provide the ServiceNow instance URL." };
  }
  if ("username" in body && body.username !== undefined && body.username !== null && typeof body.username !== "string") {
    return { ok: false, error: "username must be a string" };
  }
  if ("password" in body && body.password !== undefined && body.password !== null && typeof body.password !== "string") {
    return { ok: false, error: "password must be a string" };
  }
  return {
    ok: true,
    data: {
      instanceUrl: body.instanceUrl,
      username: body.username as string | undefined,
      password: body.password as string | undefined,
    },
  };
}

export interface ParsedSnOAuthExchangeBody {
  instanceUrl: string;
  clientId: string;
  clientSecret?: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export function parseSnOAuthExchangeBody(body: unknown): ValidationResult<ParsedSnOAuthExchangeBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  const requiredFields: Array<keyof ParsedSnOAuthExchangeBody> = [
    "instanceUrl",
    "clientId",
    "code",
    "codeVerifier",
    "redirectUri",
  ];
  for (const field of requiredFields) {
    if (typeof body[field] !== "string" || (body[field] as string).trim() === "") {
      return { ok: false, error: "Missing required fields for ServiceNow OAuth exchange." };
    }
  }
  if ("clientSecret" in body && body.clientSecret !== undefined && body.clientSecret !== null && typeof body.clientSecret !== "string") {
    return { ok: false, error: "clientSecret must be a string" };
  }
  return { ok: true, data: body as unknown as ParsedSnOAuthExchangeBody };
}

export interface ParsedActionBody {
  action: string;
}

export function parseActionBody(body: unknown, allowed: string[]): ValidationResult<ParsedActionBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.action !== "string" || !allowed.includes(body.action)) {
    return { ok: false, error: `Action must be ${allowed.map((v) => `'${v}'`).join(" or ")}` };
  }
  return { ok: true, data: { action: body.action } };
}

export interface ParsedCleanupBody {
  retentionDays?: number;
}

export function parseCleanupBody(body: unknown): ValidationResult<ParsedCleanupBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if ("retentionDays" in body && body.retentionDays !== undefined) {
    if (typeof body.retentionDays !== "number" || body.retentionDays <= 0) {
      return { ok: false, error: "retentionDays must be a positive number" };
    }
  }
  return { ok: true, data: { retentionDays: body.retentionDays as number | undefined } };
}

export interface ParsedAccessTiersBody {
  anon_daily_limit: number;
  auth_daily_limit: number;
}

export function parseAccessTiersBody(body: unknown): ValidationResult<ParsedAccessTiersBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.anon_daily_limit !== "number" || body.anon_daily_limit < 1) {
    return { ok: false, error: "anon_daily_limit must be a positive number" };
  }
  if (typeof body.auth_daily_limit !== "number" || body.auth_daily_limit < 1) {
    return { ok: false, error: "auth_daily_limit must be a positive number" };
  }
  return {
    ok: true,
    data: {
      anon_daily_limit: body.anon_daily_limit,
      auth_daily_limit: body.auth_daily_limit,
    },
  };
}

export interface ParsedTrialBody {
  scope: "global" | "user" | "instance";
  scope_value?: string;
  daily_limit: number;
  trial_days: number;
  is_active?: boolean;
}

export function parseTrialBody(body: unknown): ValidationResult<ParsedTrialBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (body.scope !== "global" && body.scope !== "user" && body.scope !== "instance") {
    return { ok: false, error: "Invalid scope" };
  }
  if (body.scope !== "global" && (typeof body.scope_value !== "string" || body.scope_value.trim() === "")) {
    return { ok: false, error: "scope_value required for non-global scope" };
  }
  if (typeof body.daily_limit !== "number" || body.daily_limit < 1) {
    return { ok: false, error: "daily_limit must be a positive number" };
  }
  if (typeof body.trial_days !== "number" || body.trial_days < 1) {
    return { ok: false, error: "trial_days must be a positive number" };
  }
  if ("is_active" in body && body.is_active !== undefined && typeof body.is_active !== "boolean") {
    return { ok: false, error: "is_active must be a boolean" };
  }
  return {
    ok: true,
    data: {
      scope: body.scope,
      scope_value: body.scope_value as string | undefined,
      daily_limit: body.daily_limit,
      trial_days: body.trial_days,
      is_active: body.is_active as boolean | undefined,
    },
  };
}

export interface ParsedBannerCreateBody {
  title: string;
  content_html: string;
  pages?: string[];
  bg_color?: string;
  text_color?: string;
  variant?: string;
  dismissible?: boolean;
  start_at?: string | null;
  end_at?: string | null;
}

const VALID_BANNER_VARIANTS = ["info", "success", "warning", "critical"];

export function parseBannerCreateBody(body: unknown): ValidationResult<ParsedBannerCreateBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.title !== "string" || body.title.trim() === "") {
    return { ok: false, error: "Title is required" };
  }
  if (typeof body.content_html !== "string" || body.content_html.trim() === "") {
    return { ok: false, error: "Banner content is required" };
  }
  if ("pages" in body && body.pages !== undefined && !Array.isArray(body.pages)) {
    return { ok: false, error: "pages must be an array" };
  }
  if ("variant" in body && body.variant !== undefined && (typeof body.variant !== "string" || !VALID_BANNER_VARIANTS.includes(body.variant))) {
    return { ok: false, error: `variant must be one of: ${VALID_BANNER_VARIANTS.join(", ")}` };
  }
  if ("dismissible" in body && body.dismissible !== undefined && typeof body.dismissible !== "boolean") {
    return { ok: false, error: "dismissible must be a boolean" };
  }
  return { ok: true, data: body as unknown as ParsedBannerCreateBody };
}

export interface ParsedBannerPatchBody {
  action?: string;
  title?: string;
  content_html?: string;
  pages?: string[];
  bg_color?: string;
  text_color?: string;
  variant?: string;
  dismissible?: boolean;
  start_at?: string | null;
  end_at?: string | null;
  is_active?: boolean;
}

export function parseBannerPatchBody(body: unknown): ValidationResult<ParsedBannerPatchBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if ("action" in body && body.action !== undefined && typeof body.action !== "string") {
    return { ok: false, error: "action must be a string" };
  }
  if ("is_active" in body && body.is_active !== undefined && typeof body.is_active !== "boolean") {
    return { ok: false, error: "is_active must be a boolean" };
  }
  if ("pages" in body && body.pages !== undefined && !Array.isArray(body.pages)) {
    return { ok: false, error: "pages must be an array" };
  }
  if ("variant" in body && body.variant !== undefined && (typeof body.variant !== "string" || !VALID_BANNER_VARIANTS.includes(body.variant))) {
    return { ok: false, error: `variant must be one of: ${VALID_BANNER_VARIANTS.join(", ")}` };
  }
  if ("dismissible" in body && body.dismissible !== undefined && typeof body.dismissible !== "boolean") {
    return { ok: false, error: "dismissible must be a boolean" };
  }
  return { ok: true, data: body as unknown as ParsedBannerPatchBody };
}

export interface ParsedInviteCreateBody {
  label?: string;
  max_uses?: number;
  expires_in_days?: number;
}

export function parseInviteCreateBody(body: unknown): ValidationResult<ParsedInviteCreateBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if ("label" in body && body.label !== undefined && body.label !== null && typeof body.label !== "string") {
    return { ok: false, error: "label must be a string" };
  }
  if ("max_uses" in body && body.max_uses !== undefined && body.max_uses !== null) {
    if (typeof body.max_uses !== "number" || body.max_uses < 1) {
      return { ok: false, error: "max_uses must be a positive number" };
    }
  }
  if ("expires_in_days" in body && body.expires_in_days !== undefined && body.expires_in_days !== null) {
    if (typeof body.expires_in_days !== "number" || body.expires_in_days < 1) {
      return { ok: false, error: "expires_in_days must be a positive number" };
    }
  }
  return { ok: true, data: body as unknown as ParsedInviteCreateBody };
}

/* ── Engine Config validation ──────────────────────────────────── */

const ALLOWED_ENGINE_KEYS = new Set(["phase_round_limits", "default_round_limit", "planner_budget_factor", "planner_budget_minimum"]);
const REQUIRED_PHASES = ["spec", "design", "scope_selection", "implementation", "testing", "deployment"];

export interface ParsedEngineConfigBody {
  key: string;
  value: unknown;
}

export function parseEngineConfigBody(body: unknown): ValidationResult<ParsedEngineConfigBody> {
  if (!isRecord(body)) return { ok: false, error: "Invalid request body" };
  if (typeof body.key !== "string" || !ALLOWED_ENGINE_KEYS.has(body.key)) {
    return { ok: false, error: `key must be one of: ${[...ALLOWED_ENGINE_KEYS].join(", ")}` };
  }
  if (body.value === undefined || body.value === null) {
    return { ok: false, error: "value is required" };
  }

  const key = body.key;
  const value = body.value;

  if (key === "phase_round_limits") {
    if (!isRecord(value)) return { ok: false, error: "phase_round_limits must be an object" };
    const valueKeys = Object.keys(value as Record<string, unknown>);
    const extraKeys = valueKeys.filter(k => !REQUIRED_PHASES.includes(k));
    if (extraKeys.length > 0) {
      return { ok: false, error: `Unknown phase keys: ${extraKeys.join(", ")}. Allowed: ${REQUIRED_PHASES.join(", ")}` };
    }
    for (const phase of REQUIRED_PHASES) {
      const raw = (value as Record<string, unknown>)[phase];
      if (typeof raw !== "number" || !Number.isFinite(raw) || !Number.isInteger(raw)) return { ok: false, error: `Missing or invalid value for phase: ${phase}` };
      if (raw < 1 || raw > 100) return { ok: false, error: `${phase} must be between 1 and 100` };
    }
  } else if (key === "default_round_limit") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 100) return { ok: false, error: "default_round_limit must be an integer between 1 and 100" };
  } else if (key === "planner_budget_factor") {
    const n = Number(value);
    if (isNaN(n) || n < 0.01 || n > 1.0) return { ok: false, error: "planner_budget_factor must be between 0.01 and 1.0" };
  } else if (key === "planner_budget_minimum") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 50) return { ok: false, error: "planner_budget_minimum must be an integer between 1 and 50" };
  }

  return { ok: true, data: { key, value } };
}
