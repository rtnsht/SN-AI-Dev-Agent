# VAPT Review - cursor/vapt_review

## Scope

- Branch baseline: `cursor/vapt_review`
- Latest analyzed commit baseline: `c6ee241`
- Coverage: security (auth/authz, API abuse, data leakage), performance, reliability, frontend UX edge cases, and MCP ServiceNow backend risks.
- Assessment method: multi-role parallel review pass plus targeted code verification and incremental remediation.

## Findings Summary

### Critical / High (addressed in this pass)

1. Server-side ServiceNow basic credential fallback was available from public API flows.
2. `/api/config` relied on role headers to decide admin-only connection hints.
3. Self-suspend guard in admin user update path depended on request headers.
4. Token consumption (`auth_tokens`) had race windows from read-then-update patterns.
5. Several API routes returned raw internal error strings.

### High / Medium (still open)

1. In-memory auth rate limiting does not scale safely across multiple app instances.
2. IP identity handling still depends on forwarded-header trust assumptions.
3. Chat tool execution payloads can expose sensitive tool input/output details depending on runtime flags and consumers.
4. Additional performance and reliability improvements remain (serial tool execution, access-tier query optimization, frontend rerender pressure).

## Fixes Applied

### 1) Restricted server credential fallback to admin-authenticated requests

- Updated:
  - `webapp/src/app/api/chat/route.ts`
  - `webapp/src/app/api/chat-stream/route.ts`
  - `webapp/src/app/api/instance-prompts/route.ts`
  - `webapp/src/app/api/test-connection/route.ts`
- Behavior now:
  - Server env fallback for basic ServiceNow credentials only occurs when requested fields are missing **and** caller passes `requireAdmin()` session validation.
  - Non-admin requests now return `403` for fallback attempts.

### 2) Removed header-trust for admin hints in `/api/config`

- Updated: `webapp/src/app/api/config/route.ts`
- Behavior now:
  - Admin determination uses cookie session validation (`validateSession`) instead of `x-user-role`.
  - `serverSnCredentials` hints are only returned for validated admin sessions.

### 3) Fixed self-suspend authorization check

- Updated: `webapp/src/app/api/admin/users/[id]/route.ts`
- Behavior now:
  - Current user is determined from `auth.session.user.id` from `requireAdmin()`, not request headers.

### 4) Reduced token replay race windows

- Updated: `webapp/src/lib/auth.ts`
- Behavior now:
  - `consumeAuthToken` and `consumeOTPToken` switched to conditional update-and-return flow (`used_at` set in same DB operation) to avoid read-then-update windows.

### 5) Cookie clear behavior aligned with production secure-cookie semantics

- Updated: `webapp/src/lib/auth.ts`
- Behavior now:
  - `buildClearCookieHeader()` includes `Secure` in production to match set-cookie attributes.

### 6) Reduced internal error disclosure

- Updated:
  - `webapp/src/app/api/openrouter-models/route.ts`
  - `webapp/src/app/api/chat/route.ts`
  - `webapp/src/app/api/chat-stream/route.ts`
  - `webapp/src/app/api/session-start/route.ts`
  - `webapp/src/app/api/session-end/route.ts`
- Behavior now:
  - Public API responses return generic failure messages instead of propagating raw internal exception text.
  - `session-end` now returns `503` when finalization flush fails instead of silently returning success.

## Validation Notes

- Targeted lint on modified files passes.
- Full repository lint currently reports existing unrelated issues; these are outside the current remediation scope and should be tracked separately.

## Remaining Risk Backlog (Recommended Next Batch)

1. Move auth/risk-critical rate limiting to shared persistent storage.
2. Introduce trusted-client-IP resolution policy (edge-provided header contract).
3. Minimize or redact tool execution payloads returned to clients.
4. Add systematic API schema validation for request bodies.
5. Address top performance hot spots:
   - Access-tier query roundtrip reduction.
   - Safe parallelism for independent tool reads.
   - Frontend streaming state update batching.

## Status

- Current state: partial remediation complete with critical credential/authz hardening and error-disclosure reductions.
- Next state: continue with backlog batch focused on distributed rate limiting, payload redaction, and performance/reliability optimization.
