# SN AI Agent — Comprehensive Testing & Audit Report

> **Generated:** 2026-03-17  
> **Scope:** Full codebase analysis — bugs, performance, load testing, security  
> **Methodology:** Four parallel analysis agents (Bug Finder, Performance, Load Testing, Security Audit) coordinated by an orchestrator agent

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Bug Finder Report](#2-bug-finder-report)
3. [Performance Analysis Report](#3-performance-analysis-report)
4. [Load Testing & Scalability Report](#4-load-testing--scalability-report)
5. [Security Audit Report](#5-security-audit-report)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Prioritized Action Plan](#7-prioritized-action-plan)

---

## 1. Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| **Bug Finder** | 3 | 4 | 5 | 4 | **16** |
| **Performance** | 3 | 7 | 8 | 10 | **28** |
| **Load Testing** | 5 | 6 | 6 | 4 | **21** |
| **Security Audit** | 2 | 4 | 5 | 4 | **15** |
| **TOTAL** | **13** | **21** | **24** | **22** | **80** |

### Key Themes

- **Unbounded in-memory state** — Session caches, telemetry maps, logger sessions, and cleanup maps grow without limit and are never pruned, leading to memory leaks under sustained use.
- **Synchronous file I/O** — Logger and telemetry use `fs.*Sync()` calls on every operation, blocking the Node.js event loop under load.
- **Missing input validation** — User-controlled `instanceUrl` enables SSRF; `sessionId` enables path traversal; banner HTML enables stored XSS.
- **Race conditions in rate limiting** — Check-then-consume patterns in access tier and trial limiter are not atomic, allowing over-limit usage under concurrency.
- **No horizontal scaling support** — Auth rate limiter, session cache, logger sessions, and telemetry are all in-memory with no shared state store.

---

## 2. Bug Finder Report

### Critical (3)

| # | Issue | File | Impact |
|---|-------|------|--------|
| B1 | Session telemetry cleanup never runs on session end — `sessionCleanups` stores cleanup functions but `/api/session-end` never calls them | `webapp/src/app/api/session-start/route.ts` | Memory leak, unbounded intervals, wasted CPU |
| B2 | Anonymous access tracking mismatch — `consumeAnon` uses `.eq("instance_url", "")` when value is `null`; SQL `NULL = ''` is always false, so lookups never match | `webapp/src/lib/access-tier.ts` | Anonymous rate limits not enforced; new row on every request |
| B3 | Unvalidated JSON in OpenRouter tool calls — `JSON.parse(toolCall.function.arguments)` without try/catch | `webapp/src/lib/sn-engine.ts` | Chat failures and unhandled rejections on malformed LLM output |

### High (4)

| # | Issue | File | Impact |
|---|-------|------|--------|
| B4 | `sn_register_instance_v2` bypasses Zod schema validation, uses `args as { ... }` | `mcp-servicenow/src/index.ts` | Runtime errors from missing/wrong fields |
| B5 | `getRecords` assumes `result` is always an array — if API returns null/non-array, callers crash | `mcp-servicenow/src/client/sn-client.ts` | Crashes on unexpected API responses |
| B6 | `moveToUpdateSet` error uses raw `e` object — can produce `[object Object]` in messages | `mcp-servicenow/src/tools/update-sets.ts` | Unhelpful error messages |
| B7 | `getAuthUsage` uses `.single()` without handling missing row — throws when no `request_log` row exists | `webapp/src/lib/access-tier.ts` | Unhandled rejection for new users |

### Medium (5)

| # | Issue | File | Impact |
|---|-------|------|--------|
| B8 | `ChatWindow` useEffect dependency on unmemoized `onPendingPromptConsumed` causes extra runs | `webapp/src/components/ChatWindow.tsx` | Double calls, focus flicker |
| B9 | Activity log `tool_end` matching by `toolName` only — wrong entry marked done with same-tool sequences | `webapp/src/app/app/page.tsx` | Incorrect activity display |
| B10 | Session restore `JSON.parse` can leave partial state on corrupted sessionStorage data | `webapp/src/app/app/page.tsx` | Inconsistent restore state |
| B11 | `summarizeDroppedMessages` slice indices inconsistent — `.slice(-15)` vs message about 30 | `webapp/src/lib/sn-engine.ts` | Wrong dropped-action count in summaries |
| B12 | `testConnection` assignment group mapping uses wrong field with `sysparm_display_value: "true"` | `webapp/src/lib/sn-engine.ts` | Incorrect or empty assignment groups |

### Low (4)

| # | Issue | File | Impact |
|---|-------|------|--------|
| B13 | `sn_list_promotion_packages` passes empty object without schema validation | `mcp-servicenow/src/index.ts` | Inconsistency, no functional bug |
| B14 | `createUpdateSet` with `autoTimestamp` doesn't re-check for duplicates with the new name | `mcp-servicenow/src/tools/update-sets.ts` | Effectively zero risk due to timestamps |
| B15 | `ui.table` may be a reference object `{value, display_value}` instead of string | `mcp-servicenow/src/tools/ui-policies.ts` | Wrong table name for UI policy actions |
| B16 | `fetchCategorizedPrompts` index assumptions break when `userContext` is absent | `webapp/src/lib/sn-engine.ts` | Wrong data from mismatched promise indices |

---

## 3. Performance Analysis Report

### Critical (3)

| # | Issue | File | Impact |
|---|-------|------|--------|
| P1 | **Synchronous file I/O in logging** — `fs.appendFileSync()` on every log call blocks the event loop | `webapp/src/lib/logger.ts` | 1–10ms block per log call; stalls server under load |
| P2 | **Synchronous file I/O in telemetry** — `fs.readFileSync()`, `fs.writeFileSync()` on main thread every 15s/session | `webapp/src/lib/telemetry-generator.ts` | Latency spikes proportional to session count |
| P3 | **Session cache unused in reactive tool loop** — cache exists but `executeAndLogTool` never checks it | `webapp/src/lib/sn-engine.ts` | Repeated identical ServiceNow API calls, unnecessary latency |

### High (7)

| # | Issue | File | Impact |
|---|-------|------|--------|
| P4 | N+1 in `verifyAllArtifactsCaptured` — sequential `moveArtifactToUpdateSet` per artifact | `mcp-servicenow/src/client/sn-client.ts` | 10 artifacts = 10+ sequential HTTP calls |
| P5 | N+1 in `moveArtifactToUpdateSet` — sequential `updateRecord` per found record | `mcp-servicenow/src/client/sn-client.ts` | Linear scaling with record count |
| P6 | N+1 in `moveToUpdateSet` tool — same sequential pattern | `mcp-servicenow/src/tools/update-sets.ts` | Same as above |
| P7 | Unbounded session cache growth — `SESSION_CACHES` never pruned | `webapp/src/lib/session-cache.ts` | Memory growth with session count |
| P8 | Unbounded `deltaStates` map in telemetry — never cleaned | `webapp/src/lib/telemetry-generator.ts` | Memory growth with session count |
| P9 | Sequential file attachment processing — `for...of` with `await` | `webapp/src/lib/file-parser.ts` | 5 files = 5× latency |
| P10 | `fetchCategorizedPrompts` not cached by instance — 9–13 queries on every connect/refresh | `webapp/src/lib/sn-engine.ts` | Heavy SN load on reconnect/multi-tab |

### Medium (8)

| # | Issue | File | Impact |
|---|-------|------|--------|
| P11 | Sequential artifact deployment | `mcp-servicenow/src/deployer/ServiceNowDeployer.js` | Deployment time scales linearly |
| P12 | Duplicate `invalidateForWrite` logic | `webapp/src/lib/session-cache.ts` | Minor redundancy |
| P13 | `trimConversationHistory` runs every round — O(n) per round | `webapp/src/lib/sn-engine.ts` | Cost grows with conversation length |
| P14 | `processActivityLog` runs on every render without memoization | `webapp/src/components/ChatWindow.tsx` | O(n) work during streaming |
| P15 | No `React.memo` on `MessageBubble` | `webapp/src/components/ChatWindow.tsx` | All bubbles re-render on any change |
| P16 | No virtualization for long message lists | `webapp/src/components/ChatWindow.tsx` | 100+ messages = layout/scroll issues |
| P17 | Double `JSON.stringify` in `truncateToolResult` | `webapp/src/lib/sn-engine.ts` | Wasted serialization |
| P18 | `testConnection` — 4 sequential API calls that could be parallelized | `webapp/src/lib/sn-engine.ts` | Connection test latency = sum of all calls |

### Low (10)

| # | Issue | File |
|---|-------|------|
| P19 | `ensureLogsDir` uses synchronous fs calls | `webapp/src/lib/logger.ts` |
| P20 | `helperApiPaths` map never cleaned | `mcp-servicenow/src/client/sn-client.ts` |
| P21 | `sessionCleanups` map not pruned | `webapp/src/app/api/session-start/route.ts` |
| P22 | No connection pooling for ServiceNow HTTP clients | `webapp/src/lib/sn-engine.ts` |
| P23 | Eager loading of MCP tool registry on first chat request | `webapp/src/lib/sn-engine.ts` |
| P24 | Large dependencies (mammoth, pdf-parse, xlsx) always bundled | `webapp/package.json` |
| P25 | Prompts refresh every 5 min regardless of user activity | `webapp/src/app/app/page.tsx` |
| P26 | `accessOrder` array uses O(n) filter in LRU cache | `webapp/src/lib/session-cache.ts` |
| P27 | `pruneSessionCaches` not time-based — only count-based | `webapp/src/lib/session-cache.ts` |
| P28 | `processActivityLog` creates new arrays on each call | `webapp/src/components/ChatWindow.tsx` |

---

## 4. Load Testing & Scalability Report

### Critical (5)

| # | Issue | File | 10 Users | 100 Users | 1000 Users |
|---|-------|------|----------|-----------|------------|
| L1 | **Race condition in access tier** — check-then-consume not atomic | `webapp/src/lib/access-tier.ts`, `trial-limiter.ts` | Low | Noticeable over-consumption | Limits ineffective |
| L2 | **Session cache unbounded** — `SESSION_CACHES` grows, `pruneSessionCaches` never called | `webapp/src/lib/session-cache.ts` | Negligible | ~100 caches | Memory pressure, GC spikes |
| L3 | **Session cleanups never run** — intervals and map entries accumulate | `webapp/src/app/api/session-start/route.ts` | Low | 100+ active intervals | CPU and memory pressure |
| L4 | **Logger sessions map unbounded** — `endSession()` rarely called | `webapp/src/lib/logger.ts` | Low | 100+ entries | Memory growth |
| L5 | **Telemetry delta states unbounded** — never pruned | `webapp/src/lib/telemetry-generator.ts` | Low | 100+ entries | Memory growth |

### High (6)

| # | Issue | File | Impact at Scale |
|---|-------|------|-----------------|
| L6 | No request timeout on OpenRouter fetch — hung responses block indefinitely | `webapp/src/lib/openrouter.ts` | Worker exhaustion, cascading failures |
| L7 | Auth rate limiter is in-memory only — per-instance, not global | `webapp/src/lib/auth-rate-limiter.ts` | Limits 5× weaker with 5 instances |
| L8 | Concurrent file writes without locking (logger + telemetry) | `webapp/src/lib/logger.ts`, `telemetry-generator.ts` | Corrupted or partial reads |
| L9 | MCP server uses single shared ServiceNow client | `mcp-servicenow/src/index.ts` | Contention in multi-session scenarios |
| L10 | Multi-instance manager uses shared mutable module-level state | `mcp-servicenow/src/tools/multi-instance-manager.ts` | Cross-instance contamination |
| L11 | Instance prompts/feedback endpoints — no rate limiting, accept credentials in body | `webapp/src/app/api/instance-prompts/route.ts` | Credential stuffing, SN overload |

### Medium (6)

| # | Issue | File | Impact |
|---|-------|------|--------|
| L12 | Supabase client has no explicit connection pool configuration | `webapp/src/lib/supabase.ts` | Connection exhaustion at 100+ users |
| L13 | ServiceNow HTTP client has no pool limits | `mcp-servicenow/src/client/sn-client.ts` | Connection exhaustion |
| L14 | Trial limiter has no retry/backoff for transient Supabase failures | `webapp/src/lib/trial-limiter.ts` | Failures under DB load |
| L15 | Log persistence has no per-session queue limit — one session can fill buffer | `webapp/src/lib/log-persistence.ts` | Noisy sessions starve others |
| L16 | Access tier cache — stampede on expiry (60s TTL) | `webapp/src/lib/access-tier.ts` | DB overload on cache expiry |
| L17 | Chat stream has no server-side timeout for long-running generators | `webapp/src/app/api/chat-stream/route.ts` | Worker exhaustion |

### Low (4)

| # | Issue | File |
|---|-------|------|
| L18 | `helperApiPaths` shared across instances in multi-tenant mode | `mcp-servicenow/src/client/sn-client.ts` |
| L19 | `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_HOURS` env vars defined but unused | `render.yaml` |
| L20 | Task planner `MAX_PARALLEL_CALLS = 4` hardcoded | `webapp/src/lib/task-planner.ts` |
| L21 | Session cache LRU operations are non-atomic | `webapp/src/lib/session-cache.ts` |

### Horizontal Scalability Matrix

| Component | Stateful? | Scales Horizontally? | Notes |
|-----------|-----------|---------------------|-------|
| Session Cache | Yes (in-memory) | No | Needs shared store (Redis) |
| Auth Rate Limiter | Yes (in-memory) | No | Needs shared store |
| Logger Sessions | Yes (in-memory) | No | Per-instance only |
| Telemetry Intervals | Yes (in-memory) | No | Per-instance only |
| Log Persistence Buffer | Yes (in-memory) | No | Per-instance buffer |
| Access Tier | No (Supabase) | Yes | Shared DB, but non-atomic ops |
| Trial Limiter | No (Supabase) | Yes | Shared DB |
| Session Cookies | No | Yes | Stateless |

---

## 5. Security Audit Report

### Critical (2)

| # | Issue | OWASP | File | Attack Vector |
|---|-------|-------|------|---------------|
| S1 | **SSRF via user-controlled `instanceUrl`** — used as base URL for server-side HTTP requests | A10:2021 | `webapp/src/app/api/test-connection/route.ts`, `sn-engine.ts`, `sn-client.ts` | POST with `instanceUrl: "http://169.254.169.254/latest/meta-data/"` to access cloud metadata |
| S2 | **Path traversal via `sessionId`** — used to build log filenames without sanitization | A01:2021 | `webapp/src/lib/logger.ts` | `sessionId: "sess_1_../../../etc/passwd"` writes outside logs directory |

### High (4)

| # | Issue | OWASP | File | Attack Vector |
|---|-------|-------|------|---------------|
| S3 | **Stored XSS via admin banner `content_html`** — rendered with `dangerouslySetInnerHTML` | A03:2021 | `webapp/src/components/BannerDisplay.tsx` | Compromised admin injects `<script>` in banner |
| S4 | **Weak default HMAC secret** — `AUTH_HINT_SECRET` defaults to `"default-hint-secret-change-me"` | A02:2021 | `webapp/src/app/api/auth/check-email/route.ts` | Forge auth hint cookies in production |
| S5 | **Auth hint cookie HMAC never verified** — only length and result checked | A07:2021 | `webapp/src/app/api/auth/check-email/step/route.ts` | Set arbitrary auth hint to control login flow |
| S6 | **Unauthenticated chat and test-connection APIs** — public endpoints accept arbitrary credentials | A01:2021 | `webapp/src/middleware.ts`, `chat/route.ts`, `test-connection/route.ts` | SSRF, credential probing, resource exhaustion |

### Medium (5)

| # | Issue | OWASP | File |
|---|-------|-------|------|
| S7 | ServiceNow query injection via user-influenced `sysparm_query` | A03:2021 | `mcp-servicenow/src/tools/records.ts`, `acls.ts`, `catalog.ts` |
| S8 | File upload path traversal in feedback — `file.name` used in storage path | A04:2021 | `webapp/src/app/api/feedback/route.ts` |
| S9 | `BYPASS_AUTH` dev flag can disable auth in production | A05:2021 | `webapp/src/middleware.ts` |
| S10 | Missing security headers (CSP, X-Frame-Options, X-Content-Type-Options) | A05:2021 | `webapp/next.config.ts`, middleware |
| S11 | Credentials exposed via `get credentials()` getter in plain text | A02:2021 | `mcp-servicenow/src/client/sn-client.ts` |

### Low (4)

| # | Issue | OWASP | File |
|---|-------|-------|------|
| S12 | Verbose error messages returned to clients | A04:2021 | Multiple API routes |
| S13 | IP spoofing via `X-Forwarded-For` header | A07:2021 | Multiple API routes |
| S14 | `JSON.parse` on LLM/user-influenced content without try/catch | A08:2021 | `webapp/src/lib/sn-engine.ts`, `types.ts` |
| S15 | No automated dependency vulnerability scanning | A06:2021 | `webapp/package.json`, `mcp-servicenow/package.json` |

### OWASP Top 10 Coverage

| Category | Findings |
|----------|----------|
| A01:2021 Broken Access Control | S2, S6 |
| A02:2021 Cryptographic Failures | S4, S11 |
| A03:2021 Injection | S3, S7 |
| A04:2021 Insecure Design | S8, S12 |
| A05:2021 Security Misconfiguration | S9, S10 |
| A06:2021 Vulnerable Components | S15 |
| A07:2021 Auth Failures | S5, S13 |
| A08:2021 Data Integrity | S14 |
| A10:2021 SSRF | S1 |

---

## 6. Cross-Cutting Concerns

Several issues were independently identified by multiple agents, confirming their severity:

| Issue | Agents | IDs |
|-------|--------|-----|
| **Session cleanup never runs** — `sessionCleanups` map grows forever | Bug, Perf, Load | B1, P21, L3 |
| **Session cache unbounded growth** — no pruning ever called | Perf, Load | P7, L2 |
| **Telemetry delta states unbounded** | Perf, Load | P8, L5 |
| **Synchronous file I/O in logger** | Perf, Load | P1, L8 |
| **User-controlled `instanceUrl` — SSRF** | Security, Load | S1, L11 |
| **Access tier race condition** | Bug, Load | B2, L1 |
| **`JSON.parse` without try/catch on LLM output** | Bug, Security | B3, S14 |
| **No connection pooling for ServiceNow** | Perf, Load | P22, L13 |

---

## 7. Prioritized Action Plan

### Tier 1 — Fix Immediately (Critical Security + Critical Bugs)

| Priority | ID(s) | Action | Effort |
|----------|-------|--------|--------|
| 1 | S1 | **Validate `instanceUrl`** — whitelist `*.service-now.com`, block private IPs | Low |
| 2 | S2 | **Sanitize `sessionId`** — strip path components, allow only `[a-zA-Z0-9_-]` | Low |
| 3 | B2 | **Fix anonymous access tracking** — use `.is("instance_url", null)` for null values | Low |
| 4 | B3, S14 | **Wrap `JSON.parse` in try/catch** for LLM tool call arguments | Low |
| 5 | S4, S5 | **Fix auth hint HMAC** — require secret in production, verify HMAC properly | Medium |

### Tier 2 — Fix Soon (High Security + Critical Performance)

| Priority | ID(s) | Action | Effort |
|----------|-------|--------|--------|
| 6 | S3 | **Sanitize banner HTML** — add DOMPurify before `dangerouslySetInnerHTML` | Low |
| 7 | P1, P2 | **Replace sync I/O** — use async `fs.promises` in logger and telemetry | Medium |
| 8 | B1, L3 | **Wire session cleanup** — call cleanup from `/api/session-end` | Low |
| 9 | L1 | **Atomic rate limit check** — use `INSERT...ON CONFLICT...DO UPDATE RETURNING` | Medium |
| 10 | P3 | **Use session cache in reactive tool loop** | Medium |
| 11 | S6 | **Add auth or stricter rate limits** to chat/test-connection APIs | Medium |

### Tier 3 — Plan and Implement (High + Medium Issues)

| Priority | ID(s) | Action | Effort |
|----------|-------|--------|--------|
| 12 | P7, L2, L4, L5 | **Add cleanup/TTL** for all in-memory maps (session cache, logger, telemetry) | Medium |
| 13 | P4-P6 | **Batch N+1 patterns** — use `Promise.all()` for parallel updates | Medium |
| 14 | L6 | **Add timeouts** to OpenRouter fetch calls | Low |
| 15 | S9 | **Disable `BYPASS_AUTH`** when `NODE_ENV=production` | Low |
| 16 | S10 | **Add security headers** (CSP, X-Frame-Options, etc.) | Low |
| 17 | P9, P10 | **Parallelize file processing, cache instance prompts** | Medium |
| 18 | L7 | **Move rate limiter to shared store** (Redis/Supabase) for horizontal scaling | High |

### Tier 4 — Ongoing Improvements

| ID(s) | Action | Effort |
|-------|--------|--------|
| P14-P16 | Memoize React components, virtualize message lists | Medium |
| P18 | Parallelize `testConnection` API calls | Low |
| L12-L13 | Configure connection pool limits for Supabase and ServiceNow | Medium |
| S15 | Set up automated `npm audit` in CI/CD | Low |
| S12 | Return generic error messages to clients | Low |

---

*End of Report*
