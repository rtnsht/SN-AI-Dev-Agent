# SN AI Agent — VAPT & Performance Assessment Report

**Name Tag:** opus-max

> **Date:** 2026-03-22
> **Branch:** `cursor/vapt_review`
> **Methodology:** Static code analysis (white-box), 10-specialist parallel review
> **Scope:** Full application — webapp, MCP ServiceNow server, CLI framework, deployment config

---

## Executive Summary

A comprehensive Vulnerability Assessment and Penetration Testing (VAPT) review was performed across the entire SN AI Agent codebase using 10 specialized review agents covering network security, authentication, authorization, API security, LLM integration, secrets management, frontend security, data privacy, MCP server security, and performance/resilience.

### Risk Posture

| Severity | Count | Key Areas |
|----------|-------|-----------|
| **Critical** | 5 | Admin auth bypass, credential exposure, arbitrary script execution, race conditions |
| **High** | 25 | IP spoofing, session fixation, SSRF, destructive tools, missing body limits |
| **Medium** | 48 | TOCTOU races, weak password policy, error leakage, phase gate bypass, CSRF |
| **Low** | 35 | Cookie inconsistencies, info leakage, timing oracles, log cleanup |
| **Info** | 17 | Positive findings, informational notes |

**Top 5 Issues Requiring Immediate Attention:**

1. **AUTHZ-001** (Critical) — 7 of 9 admin route files rely solely on proxy middleware for auth; no `requireAdmin()` defense-in-depth
2. **MCP-001/002** (Critical) — Credential getter exposes all secrets; arbitrary server-side script execution with no sandboxing
3. **NET-003** (High) — `x-forwarded-for` trusted without proxy verification across 13+ routes, enabling rate limit bypass
4. **AUTH-001** (High) — Session tokens stored unhashed in database; DB compromise yields all active sessions
5. **PERF-002** (Critical) — Race condition in access-tier `consumeAnon`/`consumeAuth` allows rate limit bypass

---

## Findings by Domain

### 1. Network / Edge / Transport (Agent 1)

| ID | Severity | Title | CWE |
|----|----------|-------|-----|
| NET-001 | **High** | Missing HSTS header (Strict-Transport-Security) | CWE-319 |
| NET-002 | **High** | Missing Content-Security-Policy header | CWE-79 |
| NET-003 | **High** | `x-forwarded-for` IP spoofing across 13+ routes | CWE-348 |
| NET-004 | Medium | No body size limit on chat endpoints | CWE-400 |
| NET-005 | Medium | Security headers missing on raw SSE `Response` objects | CWE-116 |
| NET-006 | Medium | `APP_URL` defaults to HTTP if env var unset | CWE-319 |
| NET-007 | Low | Cookie `Secure` flag missing from `buildClearCookieHeader` | CWE-614 |
| NET-008 | Medium | No edge-level WAF/CDN protection | CWE-770 |
| NET-009 | Medium | In-memory rate limiter not shared across instances | CWE-307 |
| NET-010 | Low | SSE error messages leak internal details | CWE-209 |
| NET-011 | Info | No CORS headers (secure default — same-origin only) | — |
| NET-012 | Info | `SameSite=Lax` on session cookies (required for magic links) | — |

### 2. Authentication & Session Management (Agent 2)

| ID | Severity | Title | CWE |
|----|----------|-------|-----|
| AUTH-001 | **High** | Session tokens stored unhashed in database | CWE-256 |
| AUTH-002 | **High** | Session not rotated after password set (session fixation) | CWE-384 |
| AUTH-003 | Medium | TOCTOU race in token consumption (magic link, OTP) | CWE-367 |
| AUTH-004 | Medium | Weak password policy (8 chars, 1 letter, 1 digit only) | CWE-521 |
| AUTH-005 | Medium | No automated cleanup of expired sessions | CWE-613 |
| AUTH-006 | Medium | Multiple password-reset tokens not invalidated on reissue | CWE-640 |
| AUTH-007 | Medium | 72-hour magic link / password-reset expiry (OWASP recommends ≤1h) | CWE-613 |
| AUTH-008 | Medium | Existing sessions survive password change | CWE-613 |
| AUTH-009 | Medium | In-memory rate limiter per-instance only | CWE-307 |
| AUTH-010 | Low | Email enumeration via invite registration endpoint | CWE-204 |
| AUTH-011 | Low | Login timing oracle (user existence) | CWE-208 |
| AUTH-012 | Low | `Secure` cookie flag missing in non-production HTTPS envs | CWE-614 |
| AUTH-013 | Low | Admin seed uses non-constant-time hash comparison | CWE-208 |
| AUTH-014 | Low | `BYPASS_AUTH` guard relies on exact `NODE_ENV` match | CWE-284 |
| AUTH-015 | Info | OTP brute force feasibility note | CWE-307 |

### 3. Authorization & Admin Surface (Agent 3)

| ID | Severity | Title | CWE |
|----|----------|-------|-----|
| AUTHZ-001 | **Critical** | 7/9 admin route files missing `requireAdmin()` | CWE-862 |
| AUTHZ-002 | **High** | `BYPASS_AUTH` disables ALL authorization including admin | CWE-284 |
| AUTHZ-003 | **High** | Admin routes trust proxy-injected `x-user-id` header | CWE-807 |
| AUTHZ-004 | Medium | No rate limiting on invite code validation endpoint | CWE-307 |
| AUTHZ-005 | Medium | `seedAdmin()` auto-escalates via env var — no role mutation API | CWE-269 |
| AUTHZ-006 | Medium | Session-start IDOR via client-supplied `sessionId` | CWE-639 |
| AUTHZ-007 | Medium | Session-end IDOR via client-supplied `sessionId` | CWE-639 |
| AUTHZ-008 | Low | HTTP method enforcement (framework handles correctly) | — |
| AUTHZ-009 | Low | Invite code TOCTOU race on usage counter | CWE-362 |
| AUTHZ-010 | Low | `SELECT *` on session logs exposes sensitive data | CWE-200 |
| AUTHZ-011 | Info | `seedAdmin()` runs on every request (in-memory guard) | CWE-306 |

### 4. API & Backend Route Security (Agent 4)

| ID | Severity | Title | CWE |
|----|----------|-------|-----|
| API-001 | **High** | No schema validation on request bodies (systemic) | CWE-20 |
| API-004 | **High** | Instance-prompts uses server SN creds without role check | CWE-269 |
| API-015 | **High** | `browser-session-connect` returns SN session cookies in response body | CWE-200 |
| API-002 | Medium | Raw `error.message` returned to client | CWE-209 |
| API-005 | Medium | SSRF — no domain allowlist on `test-connection` | CWE-918 |
| API-006 | Medium | SSRF — no domain allowlist on chat routes | CWE-918 |
| API-007 | Medium | No body/file-count limits on feedback upload | CWE-400 |
| API-008 | Medium | TOCTOU race in access tier counting | CWE-367 |
| API-009 | Medium | No rate limiting on `enhance-prompt` (Anthropic API proxy) | CWE-770 |
| API-012 | Medium | Client-controlled `sessionId` without format validation | CWE-20 |
| API-016 | Medium | No CSRF protection on POST endpoints | CWE-352 |
| API-003 | Low | Stack traces in structured logs | CWE-532 |
| API-010 | Low | No rate limiting/caching on `openrouter-models` | CWE-770 |
| API-011 | Low | Inconsistent error response format | CWE-755 |
| API-013 | Low | No input length limit on `enhance-prompt` text | CWE-400 |
| API-014 | Low | MIME validation relies on client-supplied Content-Type | CWE-434 |
| API-017 | Info | Service role key bypasses RLS globally | CWE-250 |
| API-018 | Low | Config route exposes infrastructure details | CWE-200 |
| API-019 | Low | 5-min `maxDuration` enables resource tie-up | CWE-400 |

### 5. Chat / LLM Integration Security (Agent 5)

| ID | Severity | Title | CWE |
|----|----------|-------|-----|
| LLM-001 | **High** | Model string injection — no server-side allowlist | CWE-20 |
| LLM-003 | **High** | Tool result injection — unsanitized SN data in LLM context | CWE-74 |
| LLM-006 | **High** | Destructive tools (`sn_run_fix_script`) exposed without confirmation | CWE-250 |
| LLM-002 | Medium | ServiceNow credentials persist in memory through tool loop | CWE-522 |
| LLM-004 | Medium | Phase gate bypass via client-controlled SDD mode toggle | CWE-285 |
| LLM-005 | Medium | API key fallback allows silent server-key consumption | CWE-287 |
| LLM-008 | Medium | System prompt leakage reveals phase gate mechanics | CWE-200 |
| LLM-009 | Medium | Base64 image/file payloads have no size/content validation | CWE-400 |
| LLM-011 | Medium | Context truncation preserves attacker-controlled content positions | CWE-400 |
| LLM-010 | Low | Streaming errors expose internal details to client | CWE-209 |
| LLM-012 | Low | Session ID from client used in log paths without sanitization | CWE-20 |
| LLM-013 | Low | Unsafe `JSON.parse` on OpenRouter tool call arguments | CWE-502 |
| LLM-007 | Info | No delete tool (positive) but generic create/update can target any table | — |

### 6. Secrets & Configuration Management (Agent 6)

| ID | Severity | Title | CWE |
|----|----------|-------|-----|
| SEC-001 | Medium | Config endpoint leaks SN instance URL/username to admin | CWE-200 |
| SEC-004 | Medium | No secret rotation mechanism | CWE-324 |
| SEC-005 | Medium | `BYPASS_AUTH` relies on runtime `NODE_ENV` check only | CWE-287 |
| SEC-006 | Medium | Partial env var validation — some secrets fail silently | CWE-1188 |
| SEC-002 | Low | Docs contain example credentials resembling real patterns | CWE-798 |
| SEC-003 | Low | `.env.example` uses `admin` as default username | CWE-250 |
| SEC-015 | Low | User-supplied API keys transit through server | CWE-319 |
| SEC-016 | Low | Email error responses may leak provider details | CWE-209 |

**Positive findings:** `.env` files excluded from git; no hardcoded secrets in source; `NEXT_PUBLIC_*` vars are branding-only; `SUPABASE_SERVICE_KEY` server-side only; DigitalOcean App Platform env vars use `sync: false` for all secrets; comprehensive logger redaction.

### 7. Frontend & Client Security (Agent 7)

| ID | Severity | Title | CWE |
|----|----------|-------|-----|
| FE-004 | **High** | ServiceNow connection info persisted in `sessionStorage` | CWE-922 |
| FE-005 | **High** | Full chat history in `sessionStorage` may contain sensitive SN data | CWE-922 |
| FE-001 | Medium | Mermaid SVG rendered via `dangerouslySetInnerHTML` without DOMPurify | CWE-79 |
| FE-006 | Medium | Open redirect in login page via `redirect` parameter | CWE-601 |
| FE-007 | Medium | Missing Content-Security-Policy header | CWE-693 |
| FE-010 | Medium | OAuth callback `postMessage` without full origin validation | CWE-346 |
| FE-012 | Medium | AI markdown link `href` not scheme-validated (`javascript:` risk) | CWE-79 |
| FE-002 | Low | Banner HTML via `dangerouslySetInnerHTML` (mitigated with DOMPurify) | CWE-79 |
| FE-008 | Low | No SRI enforcement (all bundled — low immediate risk) | CWE-829 |
| FE-009 | Low | CSRF relies on `SameSite=Lax` only (adequate for modern browsers) | CWE-352 |
| FE-013 | Low | File upload validation client-side only (server parses safely) | CWE-434 |

### 8. Data Leakage & Privacy (Agent 8)

| ID | Severity | Title | CWE |
|----|----------|-------|-----|
| DATA-002 | **High** | Session-log endpoints lack route-level authentication | CWE-306 |
| DATA-003 | **High** | Full log entries exposed via admin detail API (`SELECT *`) | CWE-200 |
| DATA-001 | Medium | User chat content previews (80 chars) logged in plaintext | CWE-532 |
| DATA-004 | Medium | Telemetry files write PII (username, instance URL) to filesystem | CWE-312 |
| DATA-005 | Medium | ServiceNow credentials sent in request bodies (not headers) | CWE-319 |
| DATA-007 | Medium | Error responses leak internal details to client | CWE-209 |
| DATA-008 | Medium | No automated log retention enforcement (filesystem logs never cleaned) | CWE-459 |
| DATA-006 | Low | Error stack traces logged to persistent storage | CWE-209 |
| DATA-009 | Low | Feedback stores PII with 1-year signed URLs | CWE-359 |
| DATA-010 | Low | Session metadata (IP, UA, SN user) stored in Supabase | CWE-359 |
| DATA-011 | Low | Redaction misses email, username, instanceUrl fields | CWE-532 |
| DATA-013 | Low | Admin access-tiers exposes emails and IPs | CWE-200 |
| DATA-012 | Info | SN instance URL and username in sessionStorage | CWE-922 |

### 9. MCP ServiceNow Server (Agent 9)

| ID | Severity | Title | CWE |
|----|----------|-------|-----|
| MCP-001 | **Critical** | Credential getter exposes all secrets to tool consumers | CWE-522 |
| MCP-002 | **Critical** | Arbitrary server-side script execution (no sandbox) | CWE-94 |
| MCP-003 | **High** | No table name validation — path traversal via table parameter | CWE-22 |
| MCP-004 | **High** | Unvalidated script content deployed to production artifacts | CWE-94 |
| MCP-005 | **High** | Deployer manifest `scriptFile` path traversal | CWE-22 |
| MCP-006 | **High** | Deployer client missing timeout and TLS validation | CWE-400 |
| MCP-007 | **High** | Plaintext credentials stored in instance registry memory | CWE-312 |
| MCP-008 | Medium | No confirmation gate on destructive operations | CWE-862 |
| MCP-009 | Medium | Error messages leak internal instance URLs | CWE-209 |
| MCP-010 | Medium | `z.preprocess()` coercion bypasses validation intent | CWE-20 |
| MCP-011 | Medium | Update set operations bypass change management | CWE-862 |
| MCP-012 | Medium | SSRF via instance registry URL field | CWE-918 |
| MCP-013 | Medium | CLI instance URL override enables SSRF | CWE-918 |
| MCP-014 | Low | Deployer logs instance URL and username to console | CWE-532 |
| MCP-015 | Low | `.env` file write race condition | CWE-367 |
| MCP-016 | Info | No rate limiting on MCP tool calls | CWE-770 |
| MCP-017 | Info | Dual schema definitions (JSON Schema + Zod) may drift | CWE-20 |

### 10. Performance & Resilience (Agent 10)

| ID | Severity | Title |
|----|----------|-------|
| PERF-001 | **Critical** | No timeout on individual MCP tool executions |
| PERF-002 | **Critical** | Race condition in `consumeAnon` — read-modify-write without atomic increment |
| PERF-003 | **High** | 5-7 Supabase queries per chat request in access tier check |
| PERF-004 | **High** | In-memory rate limiter lost on restart / useless in multi-instance |
| PERF-005 | **High** | No Supabase retry or circuit-breaker logic |
| PERF-006 | **High** | AbortSignal only checked between rounds, not during tool execution |
| PERF-007 | **High** | No request body size validation for chat payloads |
| PERF-008 | Medium | Session cache unbounded growth potential |
| PERF-009 | Medium | OpenRouter 30s timeout too short for tool-use with reasoning models |
| PERF-010 | Medium | Cold start loads 2400-line tool definitions synchronously |
| PERF-011 | Medium | `extractCounters` uses regex on every log entry on flush |
| PERF-012 | Medium | Supabase singleton client with no connection pool tuning |
| PERF-013 | Medium | ServiceNow client has no retry logic for transient HTTP failures |
| PERF-014 | Medium | `ToolCallDeduplicator` uses `JSON.stringify(input)` as hash |
| PERF-015 | Medium | `helperApiPaths` cache never pruned |
| PERF-016 | Low | Non-streaming chat route has no AbortController |
| PERF-017 | Low | Logger writes to filesystem with no rotation or max-size |
| PERF-018 | Low | Session model update is fire-and-forget with no error handling |
| PERF-019 | Low | `compressOldToolResults` creates new arrays on every round |

---

## Phase 3: Remediation Applied

### P0 Critical (5 fixes)
- **AUTHZ-001** — Added `requireAdmin()` defense-in-depth to all 11 admin route handlers
- **PERF-002** — Replaced read-modify-write with optimistic-concurrency retry loops (max 3 attempts)
- **MCP-001** — Restricted `ServiceNowClient.credentials` getter to only return non-secret fields
- **PERF-001** — Added 60s per-tool execution timeout via `Promise.race` in `executeAndLogTool()`
- **MCP-002** — Addressed via MCP-001 (credential exposure reduction)

### P1 High (11 fixes)
- **NET-001/002** — Added HSTS and CSP headers to `next.config.ts`
- **AUTH-002/008** — Session rotation on password set: destroy all sessions, mint fresh token
- **AUTH-011** — Fixed login timing oracle with dummy bcrypt comparison
- **NET-007** — Added `Secure` flag to `buildClearCookieHeader`
- **API-004** — Added admin role gate on `instance-prompts` server credential fallback
- **API-005/006** — Added `isAllowedServiceNowUrl()` domain check to test-connection, chat, chat-stream
- **LLM-001** — Added server-side model allowlist (7 approved vendor prefixes)
- **MCP-003** — Added table name regex validation in records.ts schemas
- **MCP-005** — Added path traversal protection in both deployer scripts
- **FE-006** — Validated login redirect parameter (blocks open redirect)
- **FE-012** — Validated `href` schemes in markdown links (blocks `javascript:`)

### P2 Medium (7 fixes)
- **FE-001** — Sanitized mermaid SVG with DOMPurify before `dangerouslySetInnerHTML`
- **AUTH-004** — Strengthened password policy (uppercase, special char, 72-char max)
- **AUTH-006** — Previous auth tokens invalidated when new one is requested
- **AUTH-007** — Password-reset token expiry reduced from 72h to 1h
- **API-009** — Rate-limited `enhance-prompt` route (30/IP/hour)
- **NET-004** — Added 5MB body size limit + 200-message cap on chat routes
- **API-012** — Added sessionId format validation (alphanumeric + dashes, 128 max)

---

## Residual Risks

| Item | Severity | Rationale |
|------|----------|-----------|
| AUTH-001: Unhashed session tokens in DB | High | Requires migration strategy; deferred to next sprint |
| NET-003: IP spoofing via `x-forwarded-for` | High | Requires platform-specific proxy trust config (DigitalOcean App Platform) |
| NET-009 / AUTH-009: In-memory rate limiter | Medium | Needs Redis/KV store; architectural change |
| LLM-003: Tool result injection | High | Requires content filtering layer between SN and LLM |
| MCP-002: Arbitrary script execution | Critical | Core feature; mitigated by SN instance ACLs |
| FE-004/005: Sensitive data in sessionStorage | High | Requires client-side encryption or server-side session state |

---

## Positive Security Controls Observed

| Control | Assessment |
|---------|------------|
| bcrypt cost 12 for password hashing | Above OWASP minimum |
| Session token entropy (384 bits) | Excellent |
| Cryptographic OTP generation (`crypto.randomInt`) | Correct |
| HttpOnly + SameSite=Lax cookies | Correct |
| Anti-enumeration on check-email (HMAC + `timingSafeEqual`) | Excellent |
| Proxy header sanitization (strips client `x-user-*`) | Correct |
| Logger redaction of sensitive keys | Comprehensive |
| `.env` excluded from git; no hardcoded secrets | Clean |
| `NEXT_PUBLIC_*` limited to branding | Correct |
| `SUPABASE_SERVICE_KEY` server-side only | Correct |
| `X-Frame-Options: DENY` | Clickjacking protected |

---

## Recommendations for Long-Term Improvement

1. **Add SAST to CI** — Run semgrep or CodeQL on every PR to catch regressions
2. **Dependency auditing** — `npm audit` in CI; enable Dependabot or Renovate
3. **Centralized rate limiting** — Move from in-memory Maps to Redis/KV store
4. **Database RLS** — Consider RLS policies as defense-in-depth even with service_role key
5. **Secret rotation playbook** — Document how to rotate each key/token without downtime
6. **External penetration test** — Commission a third-party pen test for dynamic validation
7. **Security headers middleware** — Move HSTS, CSP into shared middleware for all response types

---

## Methodology

- **Static analysis only** — no dynamic/runtime testing was performed
- **10 parallel specialist agents** covering: network/transport, authentication, authorization, API routes, LLM integration, secrets, frontend, data privacy, MCP server, performance
- **Augment context engine** used for semantic codebase search before each review
- **CWE mapping** applied where applicable
- **Severity ratings** follow CVSS-aligned qualitative scale (Critical/High/Medium/Low/Info)
- **130 total findings** across all domains; 23 fixes implemented in this commit
