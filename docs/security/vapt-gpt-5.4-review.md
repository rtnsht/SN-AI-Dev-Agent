# VAPT Review - GPT-5.4

## Summary

This report captures a current-state VAPT re-validation on branch `cursor/vapt_review` after prior remediation work from other agents, plus the additional hardening completed in this pass.

The review was intentionally performed against the local branch state rather than an older worktree snapshot. Earlier findings were re-checked before making changes so already-fixed issues were not reworked unnecessarily.

## Branch Context

- Branch: `cursor/vapt_review`
- Current HEAD at documentation time: `356d8df`
- Review mode: static code review, targeted validation, and focused remediation
- Source of truth: local branch under `/Users/ratneshtiwari/Documents/WS/cursorWS/SN AI Agent-v1`

## Assessment Scope

The re-validation focused on the highest-signal security and reliability areas that were still likely to matter after previous remediation batches:

- Authentication and access flows
- Session lifecycle and telemetry ownership
- Public API trust boundaries
- Redirect safety and request validation
- Residual rate-limit and abuse protections

## Current-State Findings

### Closed before this pass

These earlier VAPT findings were confirmed as already addressed on the local branch:

1. Public ServiceNow basic-credential fallback on chat routes is now gated behind `requireAdmin()`.
2. Shared ServiceNow hostname validation is now enforced through `validateServiceNowCredentials()` / `isAllowedInstanceUrl()`.
3. High-risk request-body validation has been introduced for several public routes.
4. `enhance-prompt` is no longer completely unmetered.
5. Access-tier consumption now attempts atomic RPC increments before fallback logic.

### Confirmed and addressed in this pass

1. **Open redirect after login**
   - File: `webapp/src/app/login/page.tsx`
   - Problem: the `redirect` query parameter was pushed directly into the router after successful login.
   - Risk: phishing redirect or `javascript:` / malformed target abuse.
   - Resolution: added `getSafeRedirectPath()` and restricted post-login navigation to validated internal paths.

2. **Weak session ID validation on request boundaries**
   - File: `webapp/src/lib/request-validation.ts`
   - Problem: session IDs were previously accepted as any non-empty string in chat/session lifecycle endpoints.
   - Risk: easier audit/log poisoning, malformed inputs, weaker control over session namespace.
   - Resolution: added shared `SESSION_ID_PATTERN` validation and applied it to chat, session-start, and session-end request parsing.

3. **Session lifecycle ownership hardening**
   - Files:
     - `webapp/src/app/api/session-start/route.ts`
     - `webapp/src/app/api/session-end/route.ts`
   - Problem: session lifecycle endpoints had partial protections, but anonymous callers could still create fresh sessions too easily and session finalization tolerated unknown IDs.
   - Risk: telemetry churn, session record abuse, ownership ambiguity.
   - Resolution:
     - Added `session-start` rate limiting via `checkSessionStart()`.
     - Added pre-log ownership checks in `session-start` before telemetry and persistence side effects.
     - Made `session-end` return `404` for unknown sessions and `403` for owner mismatch.

### Re-checked and intentionally left unchanged

1. **OTP self-serve onboarding behavior**
   - File: `webapp/src/app/api/auth/verify-otp/route.ts`
   - Current behavior: OTP verification updates the access request to `approved` and creates a temporary session.
   - Status: left unchanged intentionally.
   - Reason: product direction was clarified during this pass, and the current self-serve signup behavior is now treated as intentional rather than a defect.

## Files Changed In This Pass

- `webapp/src/app/login/page.tsx`
- `webapp/src/lib/request-validation.ts`
- `webapp/src/app/api/session-start/route.ts`
- `webapp/src/app/api/session-end/route.ts`
- `webapp/src/lib/auth-rate-limiter.ts`
- `webapp/src/lib/admin-auth.ts`
- `webapp/src/app/api/enhance-prompt/route.ts`
- `webapp/src/app/api/admin/requests/[id]/route.ts`

## Implementation Notes

### 1) Login redirect sanitization

Added an internal-origin redirect normalizer so only safe in-app paths are accepted after login.

### 2) Shared session ID validation

Introduced a shared session ID format guard:

- Prefix: `sess_`
- Numeric timestamp segment
- Bounded suffix format
- Hard maximum length

This is now enforced consistently at request-parse time rather than relying on downstream behavior.

### 3) Session-start tightening

`session-start` now:

- resolves the caller identity first
- rate-limits start attempts by IP
- checks existing session ownership before writing session metadata
- persists before telemetry startup to reduce poisoning side effects

### 4) Session-end tightening

`session-end` now:

- rejects unknown session IDs with `404`
- rejects cross-user finalization attempts with `403`
- only finalizes known sessions that belong to the caller

### 5) Build/type stability cleanup

To fully validate the branch, I also resolved two TypeScript-only blockers uncovered during the production build:

- aligned the `BYPASS_AUTH` admin mock in `webapp/src/lib/admin-auth.ts` with the current `SessionData` / `SessionUser` interfaces
- normalized validated request-body casts in `webapp/src/lib/request-validation.ts` so the stricter build pipeline accepts the parser return types

### 6) Enhance-prompt quota consumption order

`enhance-prompt` now validates the request body before calling `checkAccess()`, so malformed requests no longer burn authenticated or anonymous daily quota.

### 7) Admin audit identity source hardening

`/api/admin/requests/[id]` now uses `auth.session.user.email` from `requireAdmin()` for the `reviewed_by` audit field instead of a proxy-injected request header.

## Validation Performed

- Targeted ESLint run for modified files passed:
  - `src/app/login/page.tsx`
  - `src/lib/request-validation.ts`
  - `src/app/api/session-start/route.ts`
  - `src/app/api/session-end/route.ts`
  - `src/lib/auth-rate-limiter.ts`
  - `src/app/api/enhance-prompt/route.ts`
  - `src/app/api/admin/requests/[id]/route.ts`

- Full production build now passes:
  - command: `npm run build` in `webapp/`
  - result: successful Next.js production build and route generation

## Remaining Risks

These items still deserve follow-up attention on the current branch:

1. **Trusted client IP policy is still only partially hardened**
   - File: `webapp/src/lib/client-ip.ts`
   - Current risk: `x-forwarded-for` can still be trusted depending on environment configuration.

2. **BYOK still bypasses daily quota enforcement**
   - File: `webapp/src/lib/access-tier.ts`
   - Current risk: this may be intentional, but it remains a cost/abuse tradeoff rather than a fully closed issue.

3. **Anonymous `session-start` is still public by route design**
   - File: `webapp/src/proxy.ts`
   - Current risk: the new controls reduce abuse, but this endpoint is still intentionally reachable without a webapp login.

4. **Session and chat retention in browser storage remains broader than ideal**
   - Related state: `webapp/src/hooks/useSessionState.ts`
   - Current risk: convenience-oriented session restore still carries privacy tradeoffs.


## Recommended Next Batch

1. Harden `getClientIp()` around a stricter trusted-proxy contract.
2. Decide whether anonymous `session-start` should remain public or move to a server-issued handle model.
3. Revisit BYOK rate/cost policy and decide whether unlimited usage is still intentional.
4. Reduce browser-side retained session state if privacy posture needs further tightening.

## Status

- Local-branch re-validation completed.
- Targeted security fixes from this pass are in place.
- Report reflects the current `cursor/vapt_review` branch rather than outdated worktree state.
