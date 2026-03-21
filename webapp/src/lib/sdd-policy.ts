/**
 * SDD (Spec-Driven Development) Policy Engine
 *
 * Single source of truth for all SDD enforcement decisions.
 * Pure functions with no React dependencies — usable on both client and server.
 *
 * Policy resolution priority (highest wins):
 *   1. Session override  — user typed /build or /freeform this session
 *   2. User preference   — stored in Supabase user profile (future)
 *   3. Tenant policy     — stored in Supabase tenant/org record (future)
 *   4. Instance policy   — derived from instance URL or metadata (future)
 *   5. Global default    — env var NEXT_PUBLIC_DEFAULT_SDD_MODE
 */

import type { SDLCPhase } from "./types";

/* ── Types ──────────────────────────────────────────────────────── */

export type EnforcementLevel = "strict" | "guided" | "off";
export type UserSDDPreference = "always" | "never" | "default";
export type TenantSDDPolicy = "strict" | "flexible" | "default";
export type InstanceType = "dev" | "test" | "prod";

export interface SDDPolicyInput {
  /** /build or /freeform typed this session (true = SDD on, false = SDD off, null = no override) */
  sessionOverride: boolean | null;
  /** Per-user preference from Supabase profile (future) */
  userPreference?: UserSDDPreference | null;
  /** Per-tenant/customer policy (future) */
  tenantPolicy?: TenantSDDPolicy | null;
  /** Instance classification (future) */
  instanceType?: InstanceType | null;
  /** Global default from env var */
  globalDefault: boolean;
}

export interface SDDPolicyResult {
  /** Whether SDD mode is active */
  sddActive: boolean;
  /** How strictly to enforce — strict: no bypass, guided: user can skip, off: no enforcement */
  enforcementLevel: EnforcementLevel;
  /** Human-readable reason for audit logging */
  reason: string;
}

/* ── Valid phases for validation ─────────────────────────────────── */

const VALID_PHASES: readonly SDLCPhase[] = [
  "spec", "design", "scope_selection", "implementation", "testing", "deployment",
] as const;

/** Allowed phase transitions — maps from phase to valid next phases */
const PHASE_TRANSITIONS: Record<SDLCPhase, SDLCPhase[]> = {
  spec: ["design"],
  design: ["scope_selection"],
  scope_selection: ["implementation"],
  implementation: ["testing"],
  testing: ["deployment"],
  deployment: [],
};

/* ── Policy Resolution ──────────────────────────────────────────── */

/**
 * Resolve the effective SDD policy from all input layers.
 * Priority: session override > user pref > tenant > instance > global default.
 */
export function resolvePolicy(input: SDDPolicyInput): SDDPolicyResult {
  // Layer 1: Session override (highest priority)
  if (input.sessionOverride === true) {
    return { sddActive: true, enforcementLevel: "guided", reason: "session_override:build" };
  }
  if (input.sessionOverride === false) {
    return { sddActive: false, enforcementLevel: "off", reason: "session_override:freeform" };
  }

  // Layer 2: User preference (future — currently returns null/default)
  if (input.userPreference === "always") {
    return { sddActive: true, enforcementLevel: "guided", reason: "user_preference:always" };
  }
  if (input.userPreference === "never") {
    return { sddActive: false, enforcementLevel: "off", reason: "user_preference:never" };
  }

  // Layer 3: Tenant policy (future)
  if (input.tenantPolicy === "strict") {
    return { sddActive: true, enforcementLevel: "strict", reason: "tenant_policy:strict" };
  }
  if (input.tenantPolicy === "flexible") {
    return { sddActive: false, enforcementLevel: "off", reason: "tenant_policy:flexible" };
  }

  // Layer 4: Instance type (future — prod instances default to SDD)
  if (input.instanceType === "prod") {
    return { sddActive: true, enforcementLevel: "guided", reason: "instance_type:prod" };
  }

  // Layer 5: Global default
  return {
    sddActive: input.globalDefault,
    enforcementLevel: input.globalDefault ? "guided" : "off",
    reason: `global_default:${input.globalDefault}`,
  };
}

/**
 * Given a policy result and the client-sent phase, return the effective phase
 * for tool filtering. When SDD is active and no phase is set, forces "spec".
 */
export function resolvePhase(
  policy: SDDPolicyResult,
  clientPhase: string | null | undefined,
): SDLCPhase | null {
  if (!policy.sddActive) {
    return clientPhase && isValidPhase(clientPhase) ? (clientPhase as SDLCPhase) : null;
  }

  // SDD is active — if client sent a valid phase, use it; otherwise force "spec"
  if (clientPhase && isValidPhase(clientPhase)) {
    return clientPhase as SDLCPhase;
  }
  return "spec";
}

/**
 * Validate whether a phase string is a known SDLC phase.
 */
export function isValidPhase(phase: string): phase is SDLCPhase {
  return (VALID_PHASES as readonly string[]).includes(phase);
}

/**
 * Validate whether a phase transition is allowed.
 * Returns true if transitioning from `from` to `to` is a valid forward progression.
 * Also allows null -> any phase (initial entry).
 */
export function isValidTransition(from: SDLCPhase | null, to: SDLCPhase): boolean {
  if (from === null) return true;
  const allowed = PHASE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Get the next phase after the given phase, or null if at the end.
 */
export function getNextPhase(phase: SDLCPhase): SDLCPhase | null {
  const transitions = PHASE_TRANSITIONS[phase];
  return transitions && transitions.length > 0 ? transitions[0] : null;
}

/* ── Global Default ─────────────────────────────────────────────── */

/**
 * Read the global SDD default from environment.
 * Works on both client (NEXT_PUBLIC_*) and server.
 */
export const SDD_GLOBAL_DEFAULT =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_DEFAULT_SDD_MODE === "true"
    : false;
