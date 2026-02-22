# Project Tracker — SN AI Dev Agent Web App

> **Last Updated:** 2026-02-22
> **Branch:** `v1-as-webapp`
> **Status:** MVP Running (`localhost:3000`)

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
| 6 | **SDLC System Prompt** | Comprehensive prompt teaching Claude the Spec → Design → Implementation → Testing → Deployment workflow, templates, naming conventions, and phase gate rules (`system-prompt.ts`, 191 lines) |
| 7 | **Phase Gate Detection** | `<!-- PHASE_GATE:xxx -->` markers in Claude's responses trigger approval UI |
| 8 | **Phase Gate Approval UI** | Green "Approve" button on phase gate messages; user must explicitly approve before Claude proceeds |
| 9 | **PhaseTracker Component** | Visual stepper in header bar showing current SDLC phase (Spec → Design → Impl → Test → Deploy) |
| 10 | **Sign-Off Workflow** | ☐/☑ checkboxes in spec/design documents; only user can approve |

### User Interface

| # | Feature | Details |
|---|---------|---------|
| 11 | **Settings Panel** | Sidebar for ServiceNow instance URL, username, password, Claude API key, model selection |
| 12 | **Chat Window** | Scrollable message list with auto-scroll, streaming-style UX |
| 13 | **Markdown Rendering** | `react-markdown` + `remark-gfm` for rich message display (tables, code blocks, lists) |
| 14 | **System Messages** | Colored banners (info/warning/success/error) for connection status, role warnings, etc. |
| 15 | **Tool Execution Cards** | Expandable cards showing tool name, input, output, and duration for each tool call |
| 16 | **Example Prompt Cards** | Pre-built prompts in empty state for SDLC requirements and quick ServiceNow queries |
| 17 | **New Chat Button** | Resets conversation, unlocks model selection, clears phase tracking |
| 18 | **Header Info Bar** | Shows connected user, instance, active phase tracker, and New Chat action |

### Security & Access Control

| # | Feature | Details |
|---|---------|---------|
| 19 | **Connection Testing** | `/api/test-connection` validates ServiceNow credentials before chat begins |
| 20 | **Role Verification** | Checks for `admin` and `security_admin` roles on connect; injects warning if missing |
| 21 | **Server-Side API Key** | Optional `CLAUDE_API_KEY` env var — when set, users don't need their own key |
| 22 | **Rate Limiting** | Sliding-window rate limiter (default: 10 requests / 4 hours) — only applies when using server key; users with own key bypass it |
| 23 | **Usage Counter & Progress Bar** | Shows remaining requests and resets time when rate-limited |
| 24 | **Configurable Limits** | `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_HOURS` env vars |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Main chat endpoint — credentials, messages, model → Claude tool-use loop |
| `/api/test-connection` | POST | Validate ServiceNow credentials and fetch user roles |
| `/api/config` | GET | Returns whether server-side API key is configured |

---

## 🔜 Next Up

### P0 — Validate Core Functionality

- [ ] **Verify spec-driven SDLC actually works end-to-end** — Run a real requirement through all 5 phases (Spec → Design → Implementation → Testing → Deployment) in the webapp; fix any issues with phase gate detection, approval flow, system prompt, and tool execution
- [ ] **Verify update set deployment works for both scopes** — Test creating and completing update sets in both Global and Application scope; add scope selection option (ask user to pick scope per requirement or default to global)
- [ ] **Flow Designer tool/MCP** — Build tools to create Flow Designer artifacts (flows, triggers, action instances, stages) via REST API on the ServiceNow instance; current tools cover scripts/rules/policies but not flows

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
