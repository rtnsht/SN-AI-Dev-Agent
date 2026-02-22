# Project Tracker — SN AI Dev Agent Web App

> **Last Updated:** 2026-02-22
> **Branch:** `v1-as-webapp`
> **Status:** MVP Running (`localhost:3000`) — P0 Complete ✅

---

## ✅ Shipped Features

### Core Engine

| # | Feature | Details |
|---|---------|---------|
| 1 | **80 ServiceNow Tools** | Full tool parity with CLI — records, scripts, update sets, UI policies, ACLs, notifications, catalog, scheduled jobs, brownfield intelligence, guardrails, persona/4G, multi-instance, recommendations, dashboard, promotion workflow |
| 2 | **Anthropic Tool-Use Loop** | Multi-round Claude ↔ ServiceNow tool execution loop with up to 15 rounds per request (`sn-engine.ts`) |
| 3 | **Shared Tool Layer** | `tool-definitions.ts` (single source of truth for all 80 tool schemas) + `tool-registry.ts` (dispatch table) — shared between CLI and webapp |
| 4 | **Model Selection** | User chooses between Claude Sonnet 4.6 and Claude Opus 4.6; selection locks after first message; resets on New Chat |
| 5 | **defaultScope: global** | All ServiceNow clients created with `defaultScope: 'global'` matching CLI behavior |

### Spec-Driven SDLC Methodology

| # | Feature | Details |
|---|---------|---------|
| 6 | **SDLC System Prompt** | XML-structured prompt teaching Claude the Spec → Design → Implementation → Testing → Deployment workflow, templates, naming conventions, and phase gate rules (`system-prompt.ts`, 117 lines — optimized 50% from 234 lines using XML tags, concise bullets, removed redundancy) |
| 7 | **Phase Gate Detection** | `<!-- PHASE_GATE:xxx -->` markers in Claude's responses trigger approval UI |
| 8 | **Phase Gate Approval UI** | Green "Approve" button on phase gate messages; user must explicitly approve before Claude proceeds |
| 9 | **PhaseTracker Component** | Visual stepper in header bar showing current SDLC phase (Spec → Design → Impl → Test → Deploy) |
| 10 | **Sign-Off Workflow** | ☐/☑ checkboxes in spec/design documents; only user can approve |

| 10a | **Instance Discovery** | Mandatory step after Spec approval and before Design — agent queries live instance for existing business rules, script includes, flows, scheduled jobs on target table; makes REUSE/EXTEND/BUILD NEW decisions |

### User Interface

| # | Feature | Details |
|---|---------|---------|
| 11 | **Settings Panel** | Sidebar for ServiceNow instance URL, username, password, Claude API key, model selection; amber highlight on API key field when rate-limited |
| 12 | **Chat Window** | Scrollable message list with auto-scroll, streaming-style UX |
| 13 | **Markdown Rendering** | `react-markdown` + `remark-gfm` for rich message display (tables, code blocks, lists) |
| 14 | **System Messages** | Colored banners (info/warning/success/error) for connection status, role warnings, etc. |
| 15 | **Tool Execution Cards** | Expandable cards showing tool name, input, output, and duration for each tool call |
| 16 | **Example Prompt Cards** | Pre-built prompts in empty state for SDLC requirements and quick ServiceNow queries |
| 17 | **New Chat Button** | Resets conversation, unlocks model selection, clears phase tracking |
| 18 | **Header Info Bar** | Shows connected user, instance, active phase tracker, and New Chat action |
| 18a | **Cancel/Stop Button** | Red stop button replaces send button during in-flight requests; uses AbortController to abort fetch |
| 18b | **Shift+Enter to Send** | Plain Enter = new line, Shift+Enter = send message; better UX for multi-line code/requirements |
| 18c | **Keyboard Hint Bar** | Indigo-themed hint bar below textarea showing Shift+Enter/Enter/image shortcuts; bold text, aligned with textarea width |
| 18d | **Image Support** | Paste, drag-drop, or click to attach images (up to 5, max 5MB each); base64 data URIs sent as Anthropic multi-modal content blocks; thumbnail previews with remove buttons |

### Security & Access Control

| # | Feature | Details |
|---|---------|---------|
| 19 | **Connection Testing** | `/api/test-connection` validates ServiceNow credentials before chat begins; falls back to server env vars if not provided |
| 20 | **Role Verification** | Checks for `admin` and `security_admin` roles on connect; injects warning if missing |
| 21 | **Server-Side API Key** | Optional `CLAUDE_API_KEY` env var — when set, users don't need their own key |
| 22 | **Rate Limiting** | Sliding-window rate limiter (default: 10 requests / 4 hours) — only applies when using server key; users with own key bypass it |
| 23 | **Usage Counter & Progress Bar** | Shows remaining requests and resets time when rate-limited |
| 24 | **Configurable Limits** | `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_HOURS` env vars |
| 24a | **Server-Side SN Credentials** | Optional `SN_INSTANCE_URL`, `SN_USERNAME`, `SN_PASSWORD` env vars; pre-populates settings panel with "Provided by server" badges; API routes fall back to env vars |

### Performance & Resilience

| # | Feature | Details |
|---|---------|---------|
| 25 | **Prompt Caching** | `cache_control: { type: "ephemeral" }` on Anthropic API calls — 90% token cost reduction on rounds 2-15 of tool-use loops (cache valid 5 min); cache performance logged |
| 26 | **Retry with Exponential Backoff** | 3 retries on Anthropic 429 errors (5s → 10s → 20s); respects `retry-after` header; tagged error thrown when exhausted |
| 27 | **Token Error → API Key Recovery** | When Anthropic 429 exhausts retries: stores failed message in `pendingRetry` state, shows inline 🔑 error, opens settings sidebar, auto-retries on API key entry — full conversation preserved |
| 28 | **Two-Type 429 Handling** | Distinguishes app-level `rate_limit_exceeded` (N requests/window) from Anthropic `anthropic_rate_limit` (30K tokens/min); different error messages and recovery flows |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Main chat endpoint — credentials, messages, model → Claude tool-use loop; falls back to server env SN creds |
| `/api/test-connection` | POST | Validate ServiceNow credentials and fetch user roles; falls back to server env SN creds |
| `/api/config` | GET | Returns whether server-side API key and SN credentials are configured; exposes non-sensitive values (instanceUrl, username) |

---

## ✅ Completed Milestones

### P0 — Validate Core Functionality ✅

- [x] **SDLC end-to-end flow** — Fixed phase gate detection, approval flow, system prompt, wired up missing `sn_set_current_update_set` tool
- [x] **Update set scope support** — Added application/scope parameter to `sn_create_update_set` for both Global and Application scopes
- [x] **Flow Designer tools** — Built tools for flows, triggers, action instances, stages via REST API on `sys_hub_flow` tables
- [x] **Instance discovery repositioned** — Moved from before-Spec to after-Spec/before-Design (agent knows scope, queries are targeted)
- [x] **System prompt optimized** — 234 → 117 lines (50% reduction) using XML tags, concise bullets, removed redundancy
- [x] **Prompt caching + retry** — `cache_control: ephemeral` (90% savings) + 3-retry exponential backoff for 429s
- [x] **Token error → API key recovery** — `pendingRetry` pattern with auto-retry on key entry
- [x] **Cancel/stop button** — AbortController on fetch, send button morphs to red stop button
- [x] **Shift+Enter to send** — Enter = new line, Shift+Enter = send; keyboard hint bar with indigo theme
- [x] **Image support** — Paste/drag-drop/upload, base64 multi-modal content blocks, thumbnail previews
- [x] **Server-side SN credentials** — Env vars with fallback, "Provided by server" badges in UI
- [x] **Architecture docs updated** — `docs/architecture.md` v1.1 with 8 mermaid diagrams reflecting all features
- [x] **Blog post** — `blog/building-ai-dev-agent-key-learnings.md` — 8 key patterns and design decisions

---

## 🔜 Next Up

### P1 — Security & Session Management

- [ ] **Email + OTP verification** — Require email and OTP verification before starting a chat session; prevents unauthorized load on server and Anthropic API costs
- [ ] **Session-based credential security** — Exchange credentials for HTTP-only session token on connect; encrypt at rest in server memory; stop sending credentials in every request body
- [ ] **Credential redaction** — Strip passwords/API keys from all log output; sanitize error stack traces; document credential lifecycle

### P2 — Logging & Monitoring

- [ ] **Structured logging per user session** — Replace `console.log` with structured JSON logging (Winston/Pino); assign unique session IDs; log username, instance, tools called, duration, timestamp, outcome per session
- [ ] **Admin log viewer** — Build admin view (`/admin/logs`) to search/filter session history by user, instance, date; persist logs to file or external service

### P3 — Feature Enhancements

- [ ] **Conversation persistence** — Save/load chat history (database or local storage)
- [ ] **Multi-conversation support** — Sidebar with conversation list, switch between sessions
- [ ] **Streaming responses** — Stream Claude's text as it generates instead of waiting for full response
- [ ] **File/artifact viewer** — Display deployed ServiceNow artifacts inline with syntax highlighting
- [ ] **Deployment dashboard** — Visual summary of all artifacts deployed in current session
- [ ] **Dark/light theme toggle** — Currently dark only

### P4 — Infrastructure

- [ ] **Database layer** — Persistent storage for sessions, conversations, deployment history
- [ ] **Authentication** — User accounts, OAuth, or SSO for multi-tenant deployment
- [ ] **Containerization** — Dockerfile + docker-compose for easy deployment
- [ ] **CI/CD pipeline** — Automated build, test, and deploy
- [ ] **Cloud deployment** — Vercel / AWS / GCP deployment configuration
