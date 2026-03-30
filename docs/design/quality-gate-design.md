# Quality Gate Design

> **Purpose:** Capture the design of quality gates in the SN AI Agent — how the SDLC enforces sequencing, human approval, and validation so that nothing ships without review.

---

## 1. Overview

**Quality gates** in this project are the combination of:

1. **Phase gates** — Checkpoints between SDLC phases (Spec → Design → Scope → Implementation → Testing → Deployment). The AI stops at each gate; some require explicit user approval before proceeding, others auto-proceed.
2. **Sign-off rules** — Which phases require an approved sign-off in the artifact (e.g. spec, design) before the phase is considered complete. Configured in `specs/config.properties`.
3. **Validation** — Pre-deploy and optional pre-commit checks (structure, manifest, deployment readiness). Also configured in `config.properties`.

The design principle: **the AI never auto-approves critical decisions**. At spec and design, the agent must stop and wait for the user to approve before continuing. Later phases may auto-proceed per configuration to reduce friction while still maintaining an audit trail.

---

## 2. Design Rationale

| Goal | How gates support it |
|------|----------------------|
| **Auditability** | Every requirement has a spec and design that were explicitly reviewed. |
| **Human-in-the-loop** | User approves *what* will be built (spec) and *how* (design) before any code is created or deployed. |
| **Sequencing** | Phases cannot be skipped; enforcement ensures Spec → Design → Implementation → Testing → Deployment order. |
| **Configurable rigor** | Teams can require sign-off on every phase or only on spec/design; validation can warn or block. |
| **Clear UX** | Phase gates are visible in the UI (PhaseTracker, Approve button / auto-approved badge) so the user always knows where they are in the flow. |

---

## 3. Configuration

### 3.1 Source of truth: `specs/config.properties`

```properties
# -----------------------------------------------------------------------------
# PHASE GATE CONTROLS
# -----------------------------------------------------------------------------
# When true, previous phase must be complete before next phase can start.
enforce.spec.before.design=true
enforce.design.before.implementation=true
enforce.implementation.before.testing=true
enforce.testing.before.deployment=true

# -----------------------------------------------------------------------------
# SIGN-OFF CONTROLS
# -----------------------------------------------------------------------------
# When true, the phase document must have an approved sign-off before complete.
require.signoff.spec=true
require.signoff.design=true
require.signoff.testing=false
require.signoff.deployment=false

# -----------------------------------------------------------------------------
# VALIDATION BEHAVIOR
# -----------------------------------------------------------------------------
# warn = show report, allow continue | block = stop operation
validation.on.failure=warn
validation.always.show.report=true
validation.on.deploy=true
validation.on.commit=false
```

### 3.2 Semantics

| Setting | Meaning |
|--------|--------|
| **enforce.\*** | Phase sequencing. When `true`, the next phase cannot start until the previous is complete. |
| **require.signoff.\*** | Whether the phase artifact (e.g. `1-spec.md`, `2-design.md`) must have an approved sign-off table before the phase is considered complete. Used by file-based workflow and validation scripts. |
| **validation.on.failure** | When validation fails (e.g. `node scripts/validate.cjs REQ-XXX`): `warn` = show report but allow deploy; `block` = stop. |
| **validation.on.deploy** | Run structure/manifest validation when running deployment scripts. |
| **validation.on.commit** | Run validation on git pre-commit (requires hooks). |

Sign-off applies to *documented* artifacts (spec, design). Implementation, testing, and deployment phases may not have a single “sign-off document” in the same way, so `require.signoff.testing` and `require.signoff.deployment` are typically `false` while the *phase gate* (and optional approval in the UI) is still enforced.

---

## 4. Phase-by-Phase Gate Behavior

### 4.1 Summary table

| Phase | Gate enforced | Sign-off required (config) | UI: requires approval (webapp) | Notes |
|-------|----------------|----------------------------|--------------------------------|-------|
| Spec | ✅ | ✅ | ✅ | User must approve spec before design. |
| Design | ✅ | ✅ | ✅ | User must approve design before scope/impl. |
| Scope selection | ✅ | N/A | ❌ (auto-proceed) | No separate approval; proceeds after scope choice. |
| Implementation | ✅ | ❌ | ✅* | Gate enforced; sign-off not required in config. *Webapp may show Approve or auto-proceed depending on alignment with config. |
| Testing | ✅ | ❌ | ✅* | Same as implementation. |
| Deployment | ✅ | ❌ | ✅* | Final phase; often requires explicit “mark done” in UI. |

\* The webapp’s `SDLC_PHASES` in `webapp/src/lib/types.ts` defines which phases show an Approve button vs auto-approved badge. Aligning `requiresApproval` with `require.signoff.*` in `config.properties` keeps behavior consistent across file-based and web flows.

### 4.2 Webapp: approval vs auto-proceed

- **Requires approval** (`requiresApproval: true`): Message shows green **Approve** button; user must click to proceed; after approval, shows “Phase approved” badge.
- **Auto-proceed** (`requiresApproval: false`): No button; message is marked `autoApproved: true` and shows blue “Auto-approved” badge; system injects a short “Proceeding…” message and continues.

Phase metadata is defined in `webapp/src/lib/types.ts` (`SDLC_PHASES`). Tooltips in the PhaseTracker explain “Requires approval” vs “Auto-proceeds” per phase.

---

## 5. Enforcement Mechanisms

### 5.1 Phase gate markers

The AI emits an invisible marker in its message so the frontend can detect a gate and show the right UI:

```html
<!-- PHASE_GATE:spec -->
<!-- PHASE_GATE:design -->
<!-- PHASE_GATE:scope_selection -->
<!-- PHASE_GATE:implementation -->
<!-- PHASE_GATE:testing -->
<!-- PHASE_GATE:deployment -->
```

- **Defined in:** `webapp/src/lib/system-prompt.ts` (per-phase instructions to “End with: <!-- PHASE_GATE:xxx -->”).
- **Parsed in:** `webapp/src/lib/types.ts` (`parsePhaseGate(content)`), used when processing assistant messages.
- **Rendered in:** `webapp/src/components/MessageBubble.tsx` (Approve button when `phaseGate && !approved && !autoApproved`; approved/auto-approved badges when applicable).

The marker is stripped from the visible markdown so the user does not see raw HTML comments.

### 5.2 Approval flow

1. User sends a message; AI responds and may end with `<!-- PHASE_GATE:xxx -->`.
2. Frontend parses the response, sets `message.phaseGate = "spec"` (etc.) and, for auto-proceed phases, sets `message.autoApproved = true`.
3. For phases that require approval: “Approve” is shown; on click, `handleApprove` in `webapp/src/app/app/page.tsx` marks the message as approved and sends a follow-up system message “Phase approved. Proceeding…” so the next LLM turn continues in the next phase.
4. For auto-proceed phases: no click; the same flow injects the “Auto-approved. Proceeding…” message and continues.

### 5.3 Phase-based tool filtering

The orchestrator filters tools by current phase (`getAnthropicToolDefinitionsForPhase(phase)` in `webapp/src/lib/sn-engine.ts`). So even if the model tried to “jump ahead,” it would not receive tools for later phases until the gate is passed and `currentPhase` advances. This reinforces sequencing.

### 5.4 Validation scripts

- **Requirement validation:** `node scripts/validate.cjs REQ-XXX` checks structure, manifest, and (when applicable) sign-off and phase ordering. Used before deploy and optionally on commit.
- **Deployment validation:** Deployment scripts can run validation when `validation.on.deploy=true`.

These scripts read `specs/config.properties` and apply the same sign-off and enforcement rules for the file-based workflow.

---

## 6. Implementation Reference

| Concern | Location |
|--------|----------|
| Phase gate config (enforce, sign-off, validation) | `specs/config.properties` |
| Phase definitions (key, label, requiresApproval, tooltip) | `webapp/src/lib/types.ts` — `SDLC_PHASES`, `SDLCPhase`, `SDLCPhaseInfo` |
| Phase gate parsing | `webapp/src/lib/types.ts` — `parsePhaseGate()`, `stripPhaseGateMarkers()` |
| Prompt instructions to emit gate markers | `webapp/src/lib/system-prompt.ts` |
| Approval handler & auto-proceed logic | `webapp/src/app/app/page.tsx` — `handleApprove`, stream/response handling that sets `phaseGate` / `autoApproved` |
| Approve button & badges | `webapp/src/components/MessageBubble.tsx` |
| Phase stepper & tooltips | `webapp/src/components/PhaseTracker.tsx` |
| Tool filtering by phase | `webapp/src/lib/sn-engine.ts` |
| Requirement validation script | `scripts/validate.cjs` |
| AI agent rules (no auto-approve, no skip phases) | `CLAUDE.md` |

---

## 7. Summary

- **Quality gates** = phase gates (sequencing + optional approval) + sign-off rules (document approval) + validation (pre-deploy/optional pre-commit).
- **Config:** `specs/config.properties` defines enforcement, sign-off, and validation behavior.
- **Webapp:** Phase gates are driven by `<!-- PHASE_GATE:xxx -->` markers, `SDLC_PHASES`, and `handleApprove`; the UI distinguishes manual approval (green) from auto-proceed (blue).
- **Principle:** Spec and design always require human approval; later phases can auto-proceed per configuration while keeping the full flow auditable and ordered.

This design is the single reference for how quality gates are intended to work across the file-based workflow, the webapp, and validation scripts.

---

## 8. Scope Verification (Custom Scope Update Set Capture)

When working in a custom application scope (non-Global), the system enforces scope correctness as part of the quality gate process:

- **Before update set creation:** `sn_create_update_set` includes a scope guard that auto-calls `ensureScopeActive()` if the target scope is not already active.
- **Before implementation:** The system prompt instructs the AI to call `sn_set_scope` at the start of each implementation turn (scope resets per request).
- **Verification:** `sn_verify_scope` uses `GET /api/now/ui/concoursepicker/application` and `sys_user_preference` to confirm the active scope.
- **Fallback:** If automated scope switching fails, the user is prompted to switch manually with a checklist and verification button.

### Five-tier scope switching fallback

| Tier | Method | Deployment | Speed |
|------|--------|------------|-------|
| 1 | `PUT /api/now/ui/concoursepicker/application` (built-in SN API) | None | ~200ms |
| 2 | ScopeHelper Scripted REST API (`gs.setCurrentApplicationId`) | Auto-deploy | ~500ms |
| 3 | `sys_user_preference` write + session refresh | None | ~1s |
| 4 | Playwright browser automation (optional) | Optional dep | ~30s |
| 5 | Manual user prompt with verification | None | User-paced |

### Implementation reference

| Concern | Location |
|---------|----------|
| Five-tier fallback (`ensureScopeActive()`) | `mcp-servicenow/src/client/sn-client.ts` |
| `sn_set_scope` and `sn_verify_scope` tools | `mcp-servicenow/src/tools/update-sets.ts` |
| ScopeHelper API auto-deploy | `mcp-servicenow/src/deployer/HelperApisSetup.ts` |
| Browser fallback (optional) | `webapp/src/lib/browser-scope-switcher.ts` |
| Scope instructions in system prompt | `webapp/src/lib/system-prompt.ts` |
| Phase 0 validation script | `mcp-servicenow/tests/test-scope-switching.js` |
