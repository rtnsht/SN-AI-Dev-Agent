# SN AI Agent — Coordination Plan for Codebase Analysis

> **Purpose:** Structured plan for analyzing the SN AI Agent codebase across four areas: bug finding, performance testing, load testing, and security audit.  
> **Date:** 2026-03-17  
> **Branch:** cursor/agent-testing-framework-6787

---

## Executive Summary

The SN AI Agent is a multi-component system comprising:

- **webapp/** — Next.js 16 frontend + API routes (auth, chat, admin, session management)
- **mcp-servicenow/** — MCP server with 115+ tools for ServiceNow REST API interaction
- **src/** — CLI framework (orchestrator, deployer, spec-writer)
- **scripts/** — Validation, ATF runner, deployment helpers
- **specs/** — Requirement specs, manifest, phase gates

External dependencies: Anthropic/OpenRouter APIs, Supabase (auth + DB), ServiceNow REST API.

---

## 1. Bug Finding

### 1.1 Key Files, Directories, and Components

| Component | Path | Focus |
|-----------|------|-------|
| Chat orchestration | `webapp/src/lib/sn-engine.ts` | Tool-use loop, context truncation, retry logic, phase gates |
| Tool registry & dispatch | `mcp-servicenow/src/tool-registry.ts`, `tool-definitions.ts` | Tool routing, schema validation, error handling |
| MCP tools (30+ modules) | `mcp-servicenow/src/tools/*.ts` | Input validation, ServiceNow client usage, edge cases |
| API routes | `webapp/src/app/api/**/*.ts` | Request validation, error propagation, auth bypass paths |
| Access tier & rate limiting | `webapp/src/lib/access-tier.ts`, `auth-rate-limiter.ts` | Race conditions, cache invalidation, dual-budget logic |
| Session & auth | `webapp/src/lib/auth.ts`, `session-cache.ts` | Session expiry, token handling, temporary session flow |
| Log persistence | `webapp/src/lib/log-persistence.ts` | Buffer overflow, upsert merge, flush race conditions |
| Middleware | `webapp/src/middleware.ts` | Path matching, admin role check, BYPASS_AUTH edge cases |
| ServiceNow client | `mcp-servicenow/src/client/sn-client.ts` | Update set capture, retry logic, cookie jar |
| Deployer | `mcp-servicenow/src/deployer/*.js` | Artifact creation, update set move, helper API init |

### 1.2 Patterns and Issues to Look For

- **Logic bugs:** Off-by-one in limits, inverted conditions (e.g., `checkAccess` failure allowing request when `catch` logs and continues)
- **Race conditions:** In-memory caches (`access-tier` TTL, `auth-rate-limiter` buckets) vs. multi-instance deployment
- **Error swallowing:** `catch` blocks that log but allow execution to continue (e.g., `checkAccess` failure → allow request)
- **Type coercion:** `z.preprocess()` in MCP tools — ensure string→object/boolean/number coercion doesn’t hide invalid inputs
- **Null/undefined handling:** Optional chaining and defaults that mask missing data
- **Async/await misuse:** Unhandled rejections, missing `await` on async calls
- **State consistency:** `access-tier` `consumeAuth`/`consumeAnon` vs. `getAccessStatus` (no consume) — ensure no double-count
- **Tool deduplication:** `ToolCallDeduplicator` in sn-engine — circular tool calls, infinite loop detection
- **Context truncation:** `stripSnMetadata`, `truncateToolResult` — ensure structure is preserved and no data loss in critical paths

### 1.3 Potential Risks and Priorities

| Priority | Risk | Location |
|----------|------|----------|
| P0 | Access check failure allows request | `access-tier.ts` catch block |
| P0 | Session validation bypass | `middleware.ts` BYPASS_AUTH, public paths |
| P1 | Double consumption of access tier | `checkAccess` vs. `getAccessStatus` usage |
| P1 | Log persistence upsert overwrite | `log-persistence.ts` BUG-1/BUG-3 fixes |
| P1 | Tool result truncation losing critical data | `sn-engine.ts` truncateToolResult |
| P2 | Auth rate limiter memory growth | `auth-rate-limiter.ts` bucket cleanup |
| P2 | MCP tool schema coercion accepting invalid input | `records.ts`, `scripts.ts`, etc. |

### 1.4 Recommended Report Structure

```
## Bug Finding Report

### 1. Critical (P0)
- [ ] ID, Location, Description, Reproduction, Impact

### 2. High (P1)
- [ ] Same structure

### 3. Medium (P2)
- [ ] Same structure

### 4. Low / Informational
- [ ] Same structure

### 5. Summary
- Total by severity
- Areas with highest density
- Recommended fix order
```

---

## 2. Performance Testing

### 2.1 Key Files, Directories, and Components

| Component | Path | Focus |
|-----------|------|-------|
| Chat API | `webapp/src/app/api/chat/route.ts`, `chat-stream/route.ts` | Request handling, streaming, maxDuration |
| SN Engine | `webapp/src/lib/sn-engine.ts` | Token estimation, context compression, tool loop |
| Tool execution | `mcp-servicenow/src/tool-registry.ts` | Sequential tool dispatch, per-call latency |
| ServiceNow client | `mcp-servicenow/src/client/sn-client.ts` | HTTP timeout (30s), retries, connection reuse |
| Access tier | `webapp/src/lib/access-tier.ts` | Supabase queries per request, cache TTL |
| Log persistence | `webapp/src/lib/log-persistence.ts` | Flush interval, batch size, JSONB size |
| File parser | `webapp/src/lib/file-parser.ts` | PDF/Word/Excel extraction, buffer size |
| System prompt | `webapp/src/lib/system-prompt.ts` | Prompt size, cache_control usage |
| Supabase usage | `webapp/src/lib/supabase.ts` | Connection pooling, query patterns |

### 2.2 Patterns and Issues to Look For

- **Cold start:** Next.js serverless cold start, MCP tool loading, Supabase client init
- **Token usage:** System prompt + 80 tools — prompt caching effectiveness, cache hit rate
- **Tool round latency:** Sequential tool execution, ServiceNow REST latency, retry backoff
- **Context growth:** `estimateConversationTokens`, `MAX_CONTEXT_TOKENS`, progressive compression
- **Database hotspots:** `anon_request_log`, `request_log` upserts; `session_logs` JSONB updates
- **Memory pressure:** Large tool results, `MAX_TOOL_RESULT_CHARS` (8K), truncation overhead
- **Streaming bottlenecks:** `chat-stream` ReadableStream backpressure, abort handling
- **File parsing:** pdf-parse, mammoth, xlsx — sync vs async, memory for large files

### 2.3 Potential Risks and Priorities

| Priority | Risk | Location |
|----------|------|----------|
| P0 | Chat request timeout (maxDuration 120s) | `chat/route.ts`, `chat-stream/route.ts` |
| P0 | ServiceNow client 30s timeout too low for bulk ops | `sn-client.ts` |
| P1 | Access tier 2–3 Supabase calls per request | `access-tier.ts` |
| P1 | Log persistence flush blocking | `log-persistence.ts` |
| P1 | Tool result truncation losing context | `sn-engine.ts` |
| P2 | Large PDF/Excel memory spike | `file-parser.ts` |
| P2 | Prompt cache miss on model switch | `sn-engine.ts` |

### 2.4 Recommended Report Structure

```
## Performance Testing Report

### 1. Baseline Metrics
- Chat request (non-streaming): P50, P95, P99 latency
- Chat stream: TTFB, tokens/sec
- Tool execution: avg per-tool latency
- Access tier check: latency
- Log persistence flush: duration

### 2. Bottlenecks Identified
- Component, metric, threshold, recommendation

### 3. Resource Utilization
- Memory, CPU, connections (Supabase, ServiceNow)

### 4. Recommendations
- Prioritized list with expected impact
```

---

## 3. Load Testing

### 3.1 Key Files, Directories, and Components

| Component | Path | Focus |
|-----------|------|-------|
| Chat endpoints | `webapp/src/app/api/chat/route.ts`, `chat-stream/route.ts` | Concurrent requests, maxDuration |
| Access tier | `webapp/src/lib/access-tier.ts` | Supabase concurrency, cache contention |
| Auth rate limiter | `webapp/src/lib/auth-rate-limiter.ts` | In-memory, single-instance only |
| Session cache | `webapp/src/lib/session-cache.ts` | In-memory session state |
| Log persistence | `webapp/src/lib/log-persistence.ts` | Concurrent flush, batch size |
| Supabase | `webapp/src/lib/supabase.ts` | Connection limits, connection pool |
| Middleware | `webapp/src/middleware.ts` | Per-request auth validation |
| MCP tools | `mcp-servicenow/src/tools/*.ts` | ServiceNow instance rate limits |

### 3.2 Patterns and Issues to Look For

- **Horizontal scaling:** In-memory state (`auth-rate-limiter`, `access-tier` cache, `session-cache`) does not share across instances
- **Supabase limits:** Connection pool, RLS, rate limits on `anon_request_log`, `request_log` upserts
- **ServiceNow limits:** REST API rate limits per instance; tool calls amplify load
- **Chat concurrency:** Long-running requests (120s) holding connections; streaming vs non-streaming
- **Access tier race:** `getAnonUsage` + `consumeAnon` non-atomic; possible over-allocation under load
- **Log persistence:** `flushConcurrent` batching; DB write throughput under high session count

### 3.3 Potential Risks and Priorities

| Priority | Risk | Location |
|----------|------|----------|
| P0 | Auth rate limiter ineffective with multiple instances | `auth-rate-limiter.ts` |
| P0 | Access tier over-allocation under concurrent load | `access-tier.ts` |
| P1 | Supabase connection exhaustion | `supabase.ts`, all API routes |
| P1 | ServiceNow instance rate limit from tool burst | MCP tools, sn-client |
| P1 | Log persistence backlog under load | `log-persistence.ts` |
| P2 | Middleware auth validation on every request | `middleware.ts` |

### 3.4 Recommended Report Structure

```
## Load Testing Report

### 1. Test Scenarios
- Concurrent chat requests (N users, M req/user)
- Burst: N requests in T seconds
- Sustained: X req/min for Y minutes
- Mixed: chat + auth + admin endpoints

### 2. Thresholds & Results
- Target RPS, error rate, latency SLOs
- Actual results per scenario

### 3. Failure Modes
- Where and how the system fails (timeout, 5xx, rate limit)

### 4. Scaling Recommendations
- Per-component: in-memory → Redis, connection pooling, etc.
```

---

## 4. Security Audit

### 4.1 Key Files, Directories, and Components

| Component | Path | Focus |
|-----------|------|-------|
| Auth & session | `webapp/src/lib/auth.ts` | Password hashing (bcrypt 12), token generation, session storage |
| Middleware | `webapp/src/middleware.ts` | Path allowlist, admin check, BYPASS_AUTH |
| Auth routes | `webapp/src/app/api/auth/**/*.ts` | Login, OTP, magic link, invite, set-password |
| Auth rate limiter | `webapp/src/lib/auth-rate-limiter.ts` | Brute force protection |
| Check-email | `webapp/src/app/api/auth/check-email/route.ts` | AUTH_HINT_SECRET, HMAC, email enumeration |
| Chat API | `webapp/src/app/api/chat/route.ts`, `chat-stream/route.ts` | Credential handling, API key resolution |
| Admin API | `webapp/src/app/api/admin/**/*.ts` | Role enforcement, invite codes, user management |
| Supabase | `webapp/src/lib/supabase.ts` | Service key usage, RLS |
| Credential flow | Chat body, test-connection | SN credentials in request body |
| XSS surfaces | `BannerDisplay.tsx`, admin banner editor | `dangerouslySetInnerHTML`, `content_html` |
| Env & secrets | All `process.env` usage | Defaults, exposure, .env handling |
| MCP tools | `mcp-servicenow/src/tools/*.ts` | Input validation, injection, scope |

### 4.2 Patterns and Issues to Look For

- **Hardcoded secrets:** `AUTH_HINT_SECRET` default `"default-hint-secret-change-me"`; `ADMIN_PASSWORD_HASH` in env
- **Credential exposure:** SN credentials, API keys in logs, error messages, client-side
- **XSS:** `dangerouslySetInnerHTML` with `banner.content_html` (admin-controlled, stored in DB)
- **CSRF:** State-changing API routes; cookie-based auth
- **Injection:** MCP tool inputs (table names, query strings) passed to ServiceNow REST
- **Auth bypass:** `BYPASS_AUTH=true`, `isPublicPath` over-broad, admin check missing
- **Email enumeration:** Login/check-email uniform error messages (verify no leaks)
- **Session fixation:** Token generation, cookie flags (httpOnly, secure, sameSite)
- **Privilege escalation:** Admin routes, `x-user-role` header trust
- **Dependency vulnerabilities:** npm audit, known CVEs

### 4.3 Potential Risks and Priorities

| Priority | Risk | Location |
|----------|------|----------|
| P0 | AUTH_HINT_SECRET default in production | `check-email/route.ts` |
| P0 | XSS via admin banner HTML | `BannerDisplay.tsx`, admin banner editor |
| P0 | BYPASS_AUTH in production | `middleware.ts`, env config |
| P1 | SN credentials in request body (no encryption in transit) | Chat, test-connection |
| P1 | API keys in logs | `logger.ts`, error objects |
| P1 | Admin routes without role check | `api/admin/*` |
| P2 | MCP tool input injection | `records.ts` query, `scripts.ts` |
| P2 | Session cookie flags | `auth.ts` buildSetCookieHeader |

### 4.4 Recommended Report Structure

```
## Security Audit Report

### 1. Critical (P0)
- Finding, location, evidence, remediation

### 2. High (P1)
- Same structure

### 3. Medium (P2)
- Same structure

### 4. Low / Informational
- Same structure

### 5. Compliance Notes
- OWASP Top 10 mapping
- Data handling (credentials, PII)

### 6. Remediation Roadmap
- Prioritized fix list with effort estimate
```

---

## 5. Cross-Cutting Considerations

### 5.1 Shared Dependencies

- **Supabase:** Auth, access tier, session logs, request logs — single point of failure for auth and rate limiting
- **ServiceNow REST:** All MCP tools — instance availability and rate limits
- **Anthropic/OpenRouter:** Chat — API keys, rate limits, cost

### 5.2 Environment & Configuration

| Env Var | Used In | Security/Perf Relevance |
|---------|---------|--------------------------|
| `AUTH_HINT_SECRET` | check-email | Must be strong, no default in prod |
| `BYPASS_AUTH` | middleware | Must be false in prod |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | supabase.ts | Service key = full access |
| `CLAUDE_API_KEY`, `OPENROUTER_API_KEY` | chat routes | Server-side key fallback |
| `SN_INSTANCE_URL`, `SN_USERNAME`, `SN_PASSWORD` | Many | Fallback credentials |
| `LOG_PERSISTENCE_ENABLED` | log-persistence | Affects DB load |
| `LOG_RETENTION_DAYS` | session-logs cleanup | Data retention |

### 5.3 Test Infrastructure

- **Unit tests:** `mcp-servicenow` has Vitest; `webapp` has ESLint
- **Integration:** `scripts/validate.cjs`, `atf-runner.cjs` for ServiceNow
- **E2E:** No dedicated E2E framework identified — consider Playwright/Cypress for webapp
- **Load:** No k6/Artillery/load script in repo — to be added

---

## 6. Execution Order Recommendation

1. **Security audit** — Address P0 before load/perf testing exposes sensitive paths
2. **Bug finding** — Fix access-tier and auth bypass issues first
3. **Performance testing** — Establish baseline, identify bottlenecks
4. **Load testing** — Validate under concurrency after fixes

---

## 7. Artifacts to Produce

| Area | Artifact |
|------|----------|
| Bug Finding | `reports/bug-finding-YYYY-MM-DD.md` |
| Performance | `reports/performance-baseline-YYYY-MM-DD.md` |
| Load | `reports/load-test-results-YYYY-MM-DD.md` |
| Security | `reports/security-audit-YYYY-MM-DD.md` |

Store in `docs/reports/` or a dedicated `reports/` directory at project root.
