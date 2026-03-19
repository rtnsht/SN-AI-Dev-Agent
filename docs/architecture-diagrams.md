# SN AI Agent — Architecture, Sequence & Data Flow Diagrams

> Generated: 2026-03-19 | Covers: webapp, MCP engine, CLI, external services

---

## What Is SN AI Agent?

**SN AI Agent** is a web application that lets people build, deploy, and manage ServiceNow solutions using natural language. Instead of manually writing scripts, configuring business rules, or navigating the ServiceNow platform UI, a user simply describes what they need in plain English — and the AI handles the rest, with the user reviewing and approving every step.

The tagline: **"Say it. Ship it."**

---

## How It Works (End-to-End)

A typical session looks like this:

1. **User signs in** — via email + password, or a one-time code sent to their email.
2. **User connects to their ServiceNow instance** — enters the instance URL, username, and password. The system validates the credentials and fetches the user's roles, assignment groups, and instance metadata.
3. **The app generates personalized suggestions** — based on what's actually on the instance (open incidents, business rules, catalog items, update sets), it creates smart prompt suggestions across four tabs: "For You", "Build", "Explore", and "Quick Queries".
4. **User sends a message** — either types a request, picks a suggestion, uses voice input, or attaches a file (images, PDFs, Word docs, Excel sheets).
5. **The AI works through a structured process:**
   - **Spec phase** — writes a requirements specification. The user reviews and approves it.
   - **Design phase** — writes a technical design document. The user reviews and approves it.
   - **Scope selection** — picks or creates the right ServiceNow application scope.
   - **Implementation** — creates an update set, generates the actual ServiceNow artifacts (business rules, client scripts, script includes, UI policies, flows, scheduled jobs, notifications, ACLs, catalog items, etc.), and deploys them to the instance.
   - **Testing** — runs automated tests and captures evidence.
   - **Deployment** — records the deployment and updates the project manifest.
6. **User sees everything happening in real time** — a live activity timeline shows which tools the AI is calling, how long each takes, and what results come back. The final response is rendered as rich markdown with collapsible tool execution cards.

The key principle: **the AI never auto-approves anything**. At each critical gate (spec and design), it stops and waits for the user to say "approved" before proceeding.

---

## What Can Users Do?

### Chat with AI to Build ServiceNow Features
The core experience is a chat interface where users describe requirements in natural language. The AI understands ServiceNow deeply — it knows about tables, fields, business rules, client scripts, flows, ACLs, notifications, catalog items, and more. It can:

- Create and deploy business rules, client scripts, script includes, UI policies, UI actions, scheduled jobs, notifications, ACLs, catalog items, flows, and scoped applications
- Query and modify any ServiceNow table via REST API
- Create and manage update sets with reliable artifact capture
- Analyze an existing instance for health, anti-patterns, dead code, OOTB overrides, and upgrade readiness
- Compare instances, detect conflicts, and manage promotion workflows
- Generate dependency graphs and change impact assessments

### Smart Suggestions (4 Tabs)
When the user connects to an instance, the app runs 13 parallel queries against the instance and generates scored, categorized prompt suggestions:

- **For You** — personalized: the user's open incidents, pending changes, approvals waiting, unassigned tickets in their groups, and role-based recommendations
- **Build** — feature ideas based on gaps in the instance (tables without business rules, catalog items without workflows, etc.)
- **Explore** — audit and review prompts based on real artifacts (review business rules on a specific table, check scheduled jobs, analyze ACLs)
- **Quick Queries** — data lookups using actual table names, group names, and counts from the instance

### Voice Input
Users can dictate their requests using the browser's built-in speech-to-text (Web Speech API). Useful for hands-free prompting.

### File Attachments
Users can attach files to provide context to the AI:
- **Images** — screenshots, diagrams, mockups (sent as base64 to the AI)
- **PDFs** — text is extracted server-side and included in the prompt
- **Word documents (.docx)** — text is extracted and included
- **Excel spreadsheets (.xlsx)** — data is extracted and included

### Prompt Enhancement
A "magic wand" button lets users improve their prompt before sending. Two modes:
- **Enhance** — rewrites the prompt to be clearer, more specific, and better structured for the AI
- **Grammar** — fixes spelling, grammar, and punctuation

This uses a fast, cheap AI model (Claude Haiku) so it's near-instant.

### Live Agent Activity
While the AI is working, users see a real-time activity timeline inline in the chat:
- Each tool call appears with a friendly label (e.g., "Business rules on incident" instead of `sn_get_business_rules`)
- A pulsing dot shows the active step; completed steps get a checkmark
- Users can cancel the request at any time

### Phase Tracking (SDLC Pipeline)
A visual pipeline in the header shows progress through the development lifecycle:
- Spec → Design → Scope Selection → Implementation → Testing → Deployment
- Each phase has a status dot (pending, in progress, complete)
- Phases that require human approval are marked as gates

### Dark / Light Theme
The app supports both dark and light modes, toggled via a sun/moon button. The theme persists across sessions via localStorage. All colors, branding, app name, logo, and taglines are configurable via environment variables.

### Multi-Provider AI
Users can choose between two AI providers:
- **Anthropic** — Claude models (Sonnet, Opus, Haiku) with prompt caching for efficiency
- **OpenRouter** — access to dozens of models from different providers, filtered to only show models that support tool calling, reasoning, and have at least 64K context

### Usage Metering & Access Tiers
The app has a three-tier access system:
- **Anonymous** — limited daily requests per IP address and per ServiceNow instance (prevents abuse)
- **Authenticated** — higher daily limit for signed-in users
- **BYOK (Bring Your Own Key)** — unlimited usage when the user provides their own Anthropic or OpenRouter API key

A usage meter in the settings panel shows how many requests remain. When limits are hit, the app shows a modal suggesting the next step (sign up, or add an API key).

---

## What Can Admins Do?

The admin panel (accessible only to users with the "admin" role) provides:

- **Access Requests** — review, approve, or reject new user signups. Approved users receive an email with a one-time code to set their password.
- **User Management** — view all users, suspend or reactivate accounts. Suspended users are immediately logged out of all sessions.
- **Access Tier Configuration** — set the daily request limits for anonymous and authenticated tiers.
- **Invite Codes** — generate invite links with optional expiry dates and usage limits. Share links like `https://app.example.com/invite/ABC123` for controlled onboarding.
- **Banners** — create site-wide banners (e.g., maintenance notices, announcements) with custom colors, HTML content, and scheduling (start/end dates). Banners appear at the top of every page.
- **Session Logs** — view all user sessions with metadata (instance URL, model used, AI provider, IP, user agent). Supports retention cleanup.
- **Trial Management** — view trial configurations, per-user overrides, and usage statistics.

---

## What ServiceNow Artifacts Can It Create?

| Artifact Type | What It Is |
|---------------|------------|
| Business Rules | Server-side scripts that run when records are inserted, updated, deleted, or queried |
| Client Scripts | Browser-side scripts that run on forms (onLoad, onChange, onSubmit) |
| Script Includes | Reusable server-side JavaScript classes and functions |
| UI Policies | Form field behavior rules (show/hide, mandatory, read-only) without code |
| UI Actions | Buttons, links, and context menu items on forms and lists |
| Notifications | Email/SMS notifications triggered by events or conditions |
| ACLs | Access control rules that determine who can read, write, create, or delete records |
| Scheduled Jobs | Scripts that run on a schedule (daily, weekly, on-demand) |
| Catalog Items | Service catalog request items with variables and workflows |
| Flows | Flow Designer flows for process automation |
| Scoped Applications | Custom application scopes for modular development |
| Update Sets | Containers that track all changes for promotion between instances |
| Custom Fields | New fields on existing or custom tables |
| Custom Tables | Entirely new tables with configured fields |

---

## What Can It Analyze on an Existing Instance?

The system includes a full suite of "brownfield" analysis tools for instances that already have customizations:

| Capability | What It Does |
|------------|--------------|
| Instance Health Analysis | Scores the instance 0–100 across 40+ categories, identifies issues |
| OOTB Override Detection | Finds out-of-the-box artifacts that have been modified |
| OOTB Baseline Comparison | Compares the instance against a clean baseline to measure customization |
| Anti-Pattern Detection | Identifies bad practices (synchronous GlideRecord in client scripts, hardcoded sys_ids, etc.) |
| Dead Code Finder | Finds unused scripts, inactive business rules, orphaned script includes |
| Code Quality Analysis | Scores code quality across all scripts on the instance |
| Dependency Graph | Maps which artifacts depend on which others |
| Change Impact Analysis | Predicts what will break if a specific artifact is changed |
| Breaking Change Detection | Identifies changes that could break existing functionality |
| Conflict Detection | Finds conflicts between update sets |
| Conflict Prediction | Predicts likely conflicts before they happen |
| Upgrade Readiness | Assesses how ready the instance is for a platform upgrade |
| Instance Comparison | Compares two instances side-by-side (e.g., dev vs. prod) |
| Recommendation Engine | AI-powered recommendations for improvements |

---

## How Is It Deployed?

The application is packaged as a Docker container using a multi-stage build:
1. Stage 1 compiles the MCP tool engine (TypeScript → JavaScript)
2. Stage 2 installs the webapp dependencies
3. Stage 3 builds the Next.js application in standalone mode
4. Stage 4 creates a minimal Alpine Linux production image

It is deployed to **Render** with auto-scaling (1–5 instances) based on CPU and memory usage. The health check endpoint is `/api/config`.

---

## Key Numbers

| Metric | Count |
|--------|-------|
| React components | 16 |
| API routes | 39 |
| Server-side lib modules | 20 |
| MCP tool modules | 35 |
| Total MCP tools | 80+ |
| Supabase tables | 10 |
| External services | 5 |
| SDLC phases | 6 |
| Max agentic loop rounds | 30 |

**Stack:** Next.js 14 (App Router) · React · TypeScript · Tailwind CSS · Anthropic Claude / OpenRouter · Supabase (Postgres) · ServiceNow REST API · ZeptoMail · Docker · Render

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                        │
│                                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ LandingPage │  │ ConnectModal │  │  ChatWindow  │  │ SettingsPanel │   │
│  │  (public)   │  │ (auth flow)  │  │  (messages)  │  │ (credentials) │   │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘   │
│         │                │                  │                   │           │
│         └────────────────┴──────────────────┴───────────────────┘           │
│                                     │                                       │
│                              HTTPS / SSE                                    │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼───────────────────────────────────────┐
│                           NEXT.JS SERVER                                    │
│                                     │                                       │
│  ┌──────────────────────────────────▼──────────────────────────────────┐    │
│  │                      middleware.ts (Auth Gate)                       │    │
│  │         Session validation · Role checks · Header injection         │    │
│  └──────┬──────────────────┬───────────────────────┬───────────────────┘    │
│         │                  │                       │                        │
│  ┌──────▼──────┐   ┌──────▼──────────┐    ┌───────▼──────────┐            │
│  │ Auth Routes │   │  Chat Routes    │    │  Admin Routes    │            │
│  │ (10 routes) │   │  (5 routes)     │    │  (11 routes)     │            │
│  └──────┬──────┘   └──────┬──────────┘    └───────┬──────────┘            │
│         │                  │                       │                        │
│  ┌──────▼──────┐   ┌──────▼──────────┐    ┌───────▼──────────┐            │
│  │  auth.ts    │   │  sn-engine.ts   │    │   Supabase       │            │
│  │  email.ts   │   │  (Orchestrator) │    │   (direct)       │            │
│  │  supabase   │   │                 │    │                  │            │
│  └─────────────┘   └──────┬──────────┘    └──────────────────┘            │
│                            │                                               │
│         ┌──────────────────┼──────────────────┐                            │
│         │                  │                  │                             │
│  ┌──────▼──────┐   ┌──────▼──────┐   ┌───────▼──────────┐                 │
│  │  Anthropic  │   │ OpenRouter  │   │ MCP Tool Engine  │                 │
│  │  Claude API │   │ Multi-model │   │ (80+ tools)      │                 │
│  └─────────────┘   └─────────────┘   └───────┬──────────┘                 │
│                                               │                            │
└───────────────────────────────────────────────┼────────────────────────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          │                     │                     │
                   ┌──────▼──────┐    ┌─────────▼────────┐   ┌───────▼──────┐
                   │ ServiceNow  │    │    Supabase      │   │  ZeptoMail   │
                   │  REST API   │    │   (Postgres)     │   │  (Email)     │
                   │  (Instance) │    │  Auth, logs,     │   │  OTP, verify │
                   │             │    │  access control  │   │              │
                   └─────────────┘    └──────────────────┘   └──────────────┘
```

---

## 2. Chat Request — Sequence Flow

This is the primary user interaction: sending a message and receiving an AI response with tool executions.

```
 Browser              Middleware         /api/chat-stream       sn-engine.ts         AI (Claude/OR)       ServiceNow
 (ChatWindow)         (Auth Gate)        (Route Handler)        (Orchestrator)       (LLM API)            (REST API)
    │                     │                    │                      │                    │                    │
    │  POST /api/chat-stream                   │                      │                    │                    │
    │  {credentials, messages, model, phase}   │                      │                    │                    │
    ├────────────────────►│                    │                      │                    │                    │
    │                     │                    │                      │                    │                    │
    │              Validate session cookie      │                      │                    │                    │
    │              Attach x-user-id headers     │                      │                    │                    │
    │                     │                    │                      │                    │                    │
    │                     ├───────────────────►│                      │                    │                    │
    │                     │                    │                      │                    │                    │
    │                     │             Resolve API key               │                    │                    │
    │                     │             (server or BYOK)              │                    │                    │
    │                     │                    │                      │                    │                    │
    │                     │             checkAccess()                 │                    │                    │
    │                     │             3-tier gate                   │                    │                    │
    │                     │                    │                      │                    │                    │
    │                     │          ┌─────────┤                      │                    │                    │
    │                     │          │ DENIED? │                      │                    │                    │
    │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ┤ 429     │                      │                    │                    │
    │  {gate:"signup"|    │          └─────────┘                      │                    │                    │
    │   "apikey"}         │                    │                      │                    │                    │
    │                     │                    │                      │                    │                    │
    │                     │                    │  chatStream()        │                    │                    │
    │                     │                    ├─────────────────────►│                    │                    │
    │                     │                    │                      │                    │                    │
    │                     │                    │               Create ServiceNowClient     │                    │
    │                     │                    │               (per-request, from creds)   │                    │
    │                     │                    │                      │                    │                    │
    │                     │                    │               Get phase-filtered tools    │                    │
    │                     │                    │               Build system prompt          │                    │
    │                     │                    │                      │                    │                    │
    │                     │                    │               ┌──────┤                    │                    │
    │                     │                    │               │ Task │                    │                    │
    │                     │                    │               │Planner                    │                    │
    │                     │                    │               │Check │                    │                    │
    │                     │                    │               └──────┤                    │                    │
    │                     │                    │                      │                    │                    │
    │  ◄──── SSE: {type:"plan", tasks:[...]} ──┤                      │                    │                    │
    │                     │                    │                      │                    │                    │
    │                     │                    │                      │                    │                    │
    │                     │                    │  ╔═══════════════════════════════════════╗ │                    │
    │                     │                    │  ║  AGENTIC LOOP  (max 30 rounds)       ║ │                    │
    │                     │                    │  ╚═══════════════════════════════════════╝ │                    │
    │                     │                    │                      │                    │                    │
    │                     │                    │                      │  messages + tools  │                    │
    │                     │                    │                      ├───────────────────►│                    │
    │                     │                    │                      │                    │                    │
    │                     │                    │                      │  Response:         │                    │
    │                     │                    │                      │  text + tool_use   │                    │
    │                     │                    │                      │◄───────────────────┤                    │
    │                     │                    │                      │                    │                    │
    │  ◄──── SSE: {type:"text_delta"} ─────────┤                      │                    │                    │
    │                     │                    │                      │                    │                    │
    │                     │                    │                      │  ┌─────────────────────────────────┐    │
    │                     │                    │                      │  │ For each tool_use block:        │    │
    │                     │                    │                      │  │                                 │    │
    │  ◄──── SSE: {type:"tool_start"} ─────────┤                      │  │                                 │    │
    │                     │                    │                      │  │  executeToolCall(name, args)    │    │
    │                     │                    │                      │  │         │                       │    │
    │                     │                    │                      │  │         ├──────────────────────►│    │
    │                     │                    │                      │  │         │  GET/POST /api/now/   │    │
    │                     │                    │                      │  │         │◄──────────────────────┤    │
    │                     │                    │                      │  │         │                       │    │
    │  ◄──── SSE: {type:"tool_result"} ────────┤                      │  │  Cache result (if read-only)   │    │
    │                     │                    │                      │  │  Log to session JSONL           │    │
    │                     │                    │                      │  │  Append to messages             │    │
    │                     │                    │                      │  └─────────────────────────────────┘    │
    │                     │                    │                      │                    │                    │
    │                     │                    │                      │  ← Loop until AI returns end_turn →    │
    │                     │                    │                      │                    │                    │
    │  ◄──── SSE: {type:"done", reply, toolExecutions} ───────────────┤                    │                    │
    │                     │                    │                      │                    │                    │
    │  Render MessageBubble                    │                      │                    │                    │
    │  Update PhaseTracker                     │                      │                    │                    │
    │                     │                    │                      │                    │                    │
```

---

## 3. Connection & Session Start — Sequence Flow

```
 Browser              /api/test-connection    sn-engine.ts         ServiceNow           Supabase
 (SettingsPanel)      + /api/session-start    (testConnection)     (REST API)           (Postgres)
    │                        │                      │                    │                    │
    │  POST /api/test-connection                    │                    │                    │
    │  {instanceUrl, username, password}            │                    │                    │
    ├───────────────────────►│                      │                    │                    │
    │                        │  testConnection()    │                    │                    │
    │                        ├─────────────────────►│                    │                    │
    │                        │                      │                    │                    │
    │                        │                      │  GET sys_user      │                    │
    │                        │                      │  (validate auth)   │                    │
    │                        │                      ├───────────────────►│                    │
    │                        │                      │◄───────────────────┤                    │
    │                        │                      │                    │                    │
    │                        │                      │  GET sys_user      │                    │
    │                        │                      │  (lookup by name)  │                    │
    │                        │                      ├───────────────────►│                    │
    │                        │                      │  {sys_id, name}    │                    │
    │                        │                      │◄───────────────────┤                    │
    │                        │                      │                    │                    │
    │                        │                      │  GET user_has_role │                    │
    │                        │                      ├───────────────────►│                    │
    │                        │                      │  [admin, ...]      │                    │
    │                        │                      │◄───────────────────┤                    │
    │                        │                      │                    │                    │
    │                        │                      │  GET grmember      │                    │
    │                        │                      │  (groups)          │                    │
    │                        │                      ├───────────────────►│                    │
    │                        │                      │◄───────────────────┤                    │
    │                        │                      │                    │                    │
    │  {success, userInfo, roles, groups}           │                    │                    │
    │◄───────────────────────┤◄─────────────────────┤                    │                    │
    │                        │                      │                    │                    │
    │  POST /api/session-start                      │                    │                    │
    │  {sessionId, instanceUrl, model}              │                    │                    │
    ├───────────────────────►│                      │                    │                    │
    │                        │  Start telemetry (15s interval)           │                    │
    │                        │──────────────────────────────────────────────────────────────►│
    │                        │                      │                    │  INSERT session_logs
    │                        │──────────────────────────────────────────────────────────────►│
    │                        │                      │                    │  UPSERT user_instances
    │◄───────────────────────┤  200 OK              │                    │                    │
    │                        │                      │                    │                    │
    │  POST /api/instance-prompts                   │                    │                    │
    │  {instanceUrl, username, password}            │                    │                    │
    ├───────────────────────►│                      │                    │                    │
    │                        │  fetchCategorizedPrompts()                │                    │
    │                        ├─────────────────────►│                    │                    │
    │                        │                      │                    │                    │
    │                        │                      │  ┌──────────────────────────────────┐  │
    │                        │                      │  │  13 PARALLEL QUERIES:            │  │
    │                        │                      │  │  Custom tables, business rules,  │  │
    │                        │                      │  │  catalog items, update sets,     │  │
    │                        │                      │  │  scheduled jobs, KB articles,    │  │
    │                        │                      │  │  workflows, notifications, ACLs, │  │
    │                        │                      │  │  my incidents, my changes,       │  │
    │                        │                      │  │  my approvals, group unassigned  │  │
    │                        │                      │  └──────────────────────────────────┘  │
    │                        │                      │                    │                    │
    │                        │                      │  Score & categorize│                    │
    │                        │                      │  into 4 tabs:      │                    │
    │                        │                      │  foryou, build,    │                    │
    │                        │                      │  explore, quick    │                    │
    │                        │                      │                    │                    │
    │  {prompts: {foryou, build, explore, quick}}   │                    │                    │
    │◄───────────────────────┤◄─────────────────────┤                    │                    │
    │                        │                      │                    │                    │
    │  Render SuggestionPanel (4 tabs)              │                    │                    │
    │                        │                      │                    │                    │
```

---

## 4. Authentication — Sequence Flow

```
 Browser                Auth API Routes         Supabase              ZeptoMail
 (ConnectModal)         (/api/auth/*)           (Postgres)            (Email)
    │                        │                      │                    │
    │  ═══ STEP 1: Email Check ═══                  │                    │
    │                        │                      │                    │
    │  POST /api/auth/check-email                   │                    │
    │  {email}               │                      │                    │
    ├───────────────────────►│                      │                    │
    │                        │  SELECT users        │                    │
    │                        ├─────────────────────►│                    │
    │                        │◄─────────────────────┤                    │
    │                        │  SELECT access_requests                   │
    │                        ├─────────────────────►│                    │
    │                        │◄─────────────────────┤                    │
    │                        │                      │                    │
    │  ═══ PATH A: Existing user with password ═══  │                    │
    │                        │                      │                    │
    │  {step: "password"}    │                      │                    │
    │◄───────────────────────┤                      │                    │
    │                        │                      │                    │
    │  POST /api/auth/login  │                      │                    │
    │  {email, password}     │                      │                    │
    ├───────────────────────►│                      │                    │
    │                        │  Verify bcrypt hash  │                    │
    │                        ├─────────────────────►│                    │
    │                        │  INSERT sessions     │                    │
    │                        ├─────────────────────►│                    │
    │  Set-Cookie: sn-ai-session                    │                    │
    │◄───────────────────────┤                      │                    │
    │  Redirect → /app       │                      │                    │
    │                        │                      │                    │
    │  ═══ PATH B: Approved user, no password ═══   │                    │
    │                        │                      │                    │
    │  {step: "otp_verify"}  │                      │                    │
    │◄───────────────────────┤                      │                    │
    │                        │  Create OTP (6-digit, 10min)              │
    │                        ├─────────────────────►│                    │
    │                        │  Send OTP email      │                    │
    │                        ├──────────────────────────────────────────►│
    │                        │                      │                    │
    │  POST /api/auth/verify-otp                    │                    │
    │  {email, otp}          │                      │                    │
    ├───────────────────────►│                      │                    │
    │                        │  Validate OTP token  │                    │
    │                        ├─────────────────────►│                    │
    │                        │  INSERT sessions     │                    │
    │                        │  (temporary)         │                    │
    │                        ├─────────────────────►│                    │
    │  Set-Cookie + redirect /auth/set-password     │                    │
    │◄───────────────────────┤                      │                    │
    │                        │                      │                    │
    │  POST /api/auth/set-password                  │                    │
    │  {password}            │                      │                    │
    ├───────────────────────►│                      │                    │
    │                        │  UPDATE users        │                    │
    │                        │  SET password_hash   │                    │
    │                        ├─────────────────────►│                    │
    │                        │  Upgrade session     │                    │
    │                        │  (temp → permanent)  │                    │
    │                        ├─────────────────────►│                    │
    │  Redirect → /app       │                      │                    │
    │◄───────────────────────┤                      │                    │
    │                        │                      │                    │
    │  ═══ PATH C: New user ═══                     │                    │
    │                        │                      │                    │
    │  {step: "request_access"}                     │                    │
    │◄───────────────────────┤                      │                    │
    │                        │                      │                    │
    │  POST /api/auth/request-access                │                    │
    │  {name, email, company, use_case}             │                    │
    ├───────────────────────►│                      │                    │
    │                        │  INSERT access_requests                   │
    │                        ├─────────────────────►│                    │
    │                        │  Create OTP          │                    │
    │                        ├─────────────────────►│                    │
    │                        │  Send verification   │                    │
    │                        ├──────────────────────────────────────────►│
    │  {requiresOTP: true}   │                      │                    │
    │◄───────────────────────┤                      │                    │
    │                        │                      │                    │
    │  POST /api/auth/verify-otp                    │                    │
    │  {email, otp}          │                      │                    │
    ├───────────────────────►│                      │                    │
    │                        │  UPDATE access_requests (verified)        │
    │                        ├─────────────────────►│                    │
    │                        │  INSERT users        │                    │
    │                        ├─────────────────────►│                    │
    │                        │  INSERT sessions     │                    │
    │                        ├─────────────────────►│                    │
    │  Set-Cookie + redirect │                      │                    │
    │◄───────────────────────┤                      │                    │
    │                        │                      │                    │
```

---

## 5. 3-Tier Access Control — Flow

```
                    ┌─────────────────────────┐
                    │   Incoming Chat Request  │
                    │   (ip, userId, isByok,   │
                    │    instanceUrl)          │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  User supplied own       │──── YES ──►┌──────────────────┐
                    │  API key? (BYOK)         │            │ TIER 3: BYOK     │
                    └────────────┬────────────┘            │ ALLOW (unlimited) │
                                 │ NO                       └──────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │  userId present?         │──── NO ───►┌──────────────────────────┐
                    │  (authenticated user)    │            │ TIER 1: ANONYMOUS        │
                    └────────────┬────────────┘            │                          │
                                 │ YES                      │  Query anon_request_log  │
                                 ▼                          │  by IP + by instance_url │
                    ┌─────────────────────────┐            │                          │
                    │  TIER 2: AUTHENTICATED   │            │  usage = max(ipTotal,    │
                    │                          │            │          instanceTotal)   │
                    │  authUsed = request_log  │            │                          │
                    │  anonUsed = anon_log     │            │  usage < anonDailyLimit? │
                    │  combined = auth + anon  │            │    YES → ALLOW           │
                    │                          │            │    NO  → DENY            │
                    │  combined < authLimit?   │            │    gate: "signup"         │
                    │    YES → ALLOW           │            │    Show SignupGateModal   │
                    │    NO  → DENY            │            └──────────────────────────┘
                    │    gate: "apikey"         │
                    │    Show APIKeyGateModal   │
                    └──────────────────────────┘
```

---

## 6. Data Flow — Full System

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BROWSER (React)                                        │
│                                                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Landing    │  │ Connect      │  │ Settings     │  │ Chat        │  │ Phase        │ │
│  │ Page       │  │ Modal        │  │ Panel        │  │ Window      │  │ Tracker      │ │
│  │            │  │ (auth)       │  │ (creds,      │  │ (messages,  │  │ (SDLC        │ │
│  │ Hero,CTA   │  │ email→OTP   │  │  model,      │  │  input,     │  │  pipeline)   │ │
│  │ features   │  │  →password   │  │  usage)      │  │  prompts)   │  │              │ │
│  └─────┬──────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘ │
│        │                │                  │                  │                │         │
└────────┼────────────────┼──────────────────┼──────────────────┼────────────────┼─────────┘
         │                │                  │                  │                │
         ▼                ▼                  ▼                  ▼                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                NEXT.JS API ROUTES                                        │
│                                                                                          │
│  Auth (10)              Chat (5)                    Admin (11)           Other (13)       │
│  ┌────────────────┐     ┌──────────────────┐        ┌───────────────┐   ┌─────────────┐ │
│  │ check-email    │     │ chat-stream (SSE)│        │ users         │   │ config      │ │
│  │ login          │     │ chat             │        │ requests      │   │ banners     │ │
│  │ request-access │     │ test-connection  │        │ access-tiers  │   │ feedback    │ │
│  │ verify-otp     │     │ instance-prompts │        │ banners       │   │ trial-status│ │
│  │ set-password   │     │ enhance-prompt   │        │ session-logs  │   │ openrouter- │ │
│  │ forgot-password│     │                  │        │ invite-codes  │   │   models    │ │
│  │ logout         │     │                  │        │ trials        │   │ session-    │ │
│  │ me             │     │                  │        │ instances     │   │   start/end │ │
│  │ verify-email   │     │                  │        │               │   │             │ │
│  │ register-invite│     │                  │        │               │   │             │ │
│  └───────┬────────┘     └────────┬─────────┘        └───────┬───────┘   └──────┬──────┘ │
│          │                       │                          │                  │         │
└──────────┼───────────────────────┼──────────────────────────┼──────────────────┼─────────┘
           │                       │                          │                  │
           ▼                       ▼                          ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             SERVER-SIDE LIBRARIES (20)                                    │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         sn-engine.ts  (ORCHESTRATOR)                                │ │
│  │                                                                                     │ │
│  │  chat() ──► Anthropic API ──► agentic loop ──► tool calls ──► response              │ │
│  │  chatStream() ──► same but yields SSE events                                        │ │
│  │  testConnection() ──► validates SN creds + fetches user info                        │ │
│  │  fetchCategorizedPrompts() ──► 13 parallel SN queries ──► scored prompts            │ │
│  │                                                                                     │ │
│  │  Uses: system-prompt.ts · task-planner.ts · session-cache.ts · openrouter.ts        │ │
│  │        file-parser.ts · logger.ts                                                   │ │
│  └──────────────────────────────────────┬──────────────────────────────────────────────┘ │
│                                          │                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───▼──────────┐  ┌──────────────┐  ┌────────────┐│
│  │ auth.ts      │  │ access-      │  │ session-     │  │ logger.ts    │  │ branding.ts││
│  │ Sessions,    │  │ tier.ts      │  │ cache.ts     │  │ JSONL logs   │  │ Colors,    ││
│  │ bcrypt,      │  │ 3-tier gate  │  │ LRU cache    │  │ Telemetry    │  │ env vars   ││
│  │ OTP tokens   │  │ IP+instance  │  │ 50 entries   │  │ generator    │  │ presets    ││
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  └──────┬───────┘  └────────────┘│
│         │                  │                                    │                        │
│  ┌──────▼───────┐  ┌──────▼───────┐                    ┌───────▼───────┐                │
│  │ email.ts     │  │ supabase.ts  │                    │ log-          │                │
│  │ ZeptoMail    │  │ Service-role │                    │ persistence.ts│                │
│  │ OTP sender   │  │ client       │                    │ Supabase flush│                │
│  └──────────────┘  └──────────────┘                    └───────────────┘                │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                          MCP TOOL ENGINE  (mcp-servicenow/)                               │
│                                                                                          │
│  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐                 │
│  │ tool-registry.ts  │    │ tool-definitions  │    │ sn-client.ts      │                 │
│  │ Dispatch table:   │    │ ALL_TOOLS array   │    │ Axios + cookie jar│                 │
│  │ name → handler    │    │ 80+ Zod schemas   │    │ Session persist   │                 │
│  └────────┬──────────┘    └───────────────────┘    └────────┬──────────┘                 │
│           │                                                  │                            │
│           ▼                                                  │                            │
│  ┌──────────────────────────────────────────────────────┐    │                            │
│  │              35 TOOL MODULES                         │    │                            │
│  │                                                      │    │                            │
│  │  Core:        connection · records · scripts ·       │    │                            │
│  │               update-sets · ui-policies              │    │                            │
│  │  Platform:    notifications · acls · catalog ·       │    │                            │
│  │               scheduled-jobs · flow-designer ·       │    │                            │
│  │               scoped-apps · service-portal           │    │                            │
│  │  Analysis:    instance-analyzer · ootb-override ·    │    │                            │
│  │               ootb-baseline · dependency-graph ·     │    │                            │
│  │               dead-code-finder · code-quality ·      │    │                            │
│  │               anti-pattern · change-impact ·         │    │                            │
│  │               breaking-change · conflict-detector ·  │    │                            │
│  │               conflict-predictor                     │    │                            │
│  │  Governance:  guardrail-validator · audit-logger ·   │    │                            │
│  │               approval-gate · persona-engine ·       │    │                            │
│  │               four-g-framework                       │    │                            │
│  │  Multi-inst:  instance-registry · instance-compare · │    │                            │
│  │               multi-instance-manager ·               │    │                            │
│  │               promotion-workflow · upgrade-readiness  │    │                            │
│  │  Reporting:   recommendation-engine ·                │    │                            │
│  │               dashboard-reporter                     │    │                            │
│  └──────────────────────────────┬───────────────────────┘    │                            │
│                                 │                            │                            │
│                                 └────────────────────────────┘                            │
│                                              │                                            │
│  ┌───────────────────────────────────────────┘                                            │
│  │  deployer/                                                                             │
│  │  HelperApisSetup.ts · UpdateSetManager.js · setup-updateset-api.js · cli.js            │
│  └────────────────────────────────────────────────────────────────────────────────────────┘
│                                              │
└──────────────────────────────────────────────┼────────────────────────────────────────────┘
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │   ServiceNow     │
                                    │   REST API       │
                                    │                  │
                                    │  Table API       │
                                    │  Scripted REST   │
                                    │  (Helper APIs)   │
                                    └──────────────────┘
```

---

## 7. MCP Tool Execution — Sequence Flow

```
 sn-engine.ts        SessionCache         tool-registry.ts     Tool Module          sn-client.ts         ServiceNow
 (Orchestrator)      (LRU, 50 max)        (dispatch table)     (e.g. scripts.ts)    (axios+cookies)      (REST API)
    │                     │                      │                    │                    │                    │
    │  Check cache        │                      │                    │                    │                    │
    │  (toolName, args)   │                      │                    │                    │                    │
    ├────────────────────►│                      │                    │                    │                    │
    │                     │                      │                    │                    │                    │
    │  ┌──── CACHE HIT ──►│                      │                    │                    │                    │
    │  │  Return cached   │                      │                    │                    │                    │
    │◄─┤  result          │                      │                    │                    │                    │
    │  │  (skip API call) │                      │                    │                    │                    │
    │  └──────────────────┘                      │                    │                    │                    │
    │                     │                      │                    │                    │                    │
    │  ┌──── CACHE MISS ──┘                      │                    │                    │                    │
    │  │                                         │                    │                    │                    │
    │  │  executeToolCall(name, args, snClient)  │                    │                    │                    │
    │  ├────────────────────────────────────────►│                    │                    │                    │
    │  │                                         │                    │                    │                    │
    │  │                    Lookup TOOL_HANDLERS  │                    │                    │                    │
    │  │                    Zod schema parse      │                    │                    │                    │
    │  │                    (with type coercion)  │                    │                    │                    │
    │  │                                         │                    │                    │                    │
    │  │                                         │  handler(client,   │                    │                    │
    │  │                                         │   parsedArgs)      │                    │                    │
    │  │                                         ├───────────────────►│                    │                    │
    │  │                                         │                    │                    │                    │
    │  │                                         │                    │  getRecords() /    │                    │
    │  │                                         │                    │  createRecord()    │                    │
    │  │                                         │                    ├───────────────────►│                    │
    │  │                                         │                    │                    │  GET/POST          │
    │  │                                         │                    │                    │  /api/now/table/   │
    │  │                                         │                    │                    ├───────────────────►│
    │  │                                         │                    │                    │◄───────────────────┤
    │  │                                         │                    │                    │                    │
    │  │                                         │                    │  ┌── WRITE OP? ────┤                    │
    │  │                                         │                    │  │                 │                    │
    │  │                                         │                    │  │ Layer 1: Session-based capture       │
    │  │                                         │                    │  │ (cookie jar persists GlideUpdateSet) │
    │  │                                         │                    │  │                 │                    │
    │  │                                         │                    │  │ Layer 2: Move sys_update_xml         │
    │  │                                         │                    │  │ (retry with backoff, 3 attempts)     │
    │  │                                         │                    │  │                 ├───────────────────►│
    │  │                                         │                    │  │                 │◄───────────────────┤
    │  │                                         │                    │  │                 │                    │
    │  │                                         │                    │  │ Layer 3: GlideUpdateManager2         │
    │  │                                         │                    │  │ (AddToUpdateSetHelper API)           │
    │  │                                         │                    │  │                 ├───────────────────►│
    │  │                                         │                    │  │                 │◄───────────────────┤
    │  │                                         │                    │  └─────────────────┤                    │
    │  │                                         │                    │                    │                    │
    │  │                                         │◄───────────────────┤                    │                    │
    │  │◄────────────────────────────────────────┤  Result JSON       │                    │                    │
    │  │                                         │                    │                    │                    │
    │  │  Store in cache (if read-only tool)     │                    │                    │                    │
    │  ├────────────────────►│                    │                    │                    │                    │
    │  │                     │                    │                    │                    │                    │
    │  │  Log: toolName, durationMs, success     │                    │                    │                    │
    │  │  Truncate result (if > token limit)     │                    │                    │                    │
    │  └─────────────────────┘                    │                    │                    │                    │
    │                                             │                    │                    │                    │
```

---

## 8. SDLC Phase Gate Flow

```
  ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
  │          │      │          │      │          │      │          │      │          │      │          │
  │   SPEC   │─────►│  DESIGN  │─────►│  SCOPE   │─────►│  IMPL    │─────►│  TEST    │─────►│  DEPLOY  │
  │          │      │          │      │          │      │          │      │          │      │          │
  │ 1-spec.md│      │2-design  │      │ Select   │      │ Update   │      │ ATF      │      │5-deploy  │
  │          │      │  .md     │      │ app scope│      │ set +    │      │ tests    │      │  .md     │
  │          │      │          │      │          │      │ artifacts│      │          │      │ manifest │
  └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘      └──────────┘
       │                  │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼                  ▼
  ┌─────────┐       ┌─────────┐       ┌─────────┐       ┌─────────┐       ┌─────────┐
  │  STOP   │       │  STOP   │       │  AUTO   │       │  AUTO   │       │  AUTO   │
  │ User    │       │ User    │       │ proceed │       │ proceed │       │ proceed │
  │ approves│       │ approves│       │         │       │         │       │         │
  └─────────┘       └─────────┘       └─────────┘       └─────────┘       └─────────┘

  Legend:
    STOP  = Human approval required (sign-off gate)
    AUTO  = Proceeds automatically (no sign-off needed)
```

---

## 9. Update Set Capture — Three-Layer Defense

```
  ┌──────────────────────────────────┐
  │  Artifact created via REST API   │
  └───────────────┬──────────────────┘
                  │
                  ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  LAYER 1: Session-Based Capture                              │
  │                                                              │
  │  Cookie-jar session persistence (axios-cookiejar-support)    │
  │  → callSetCurrentUpdateSetApi()                              │
  │  → Server runs GlideUpdateSet().set()                        │
  │  → Binds session to target update set                        │
  └───────────────┬──────────────────────────────────────────────┘
                  │
                  │  Artifact may still land in "Default" set
                  │  (REST API doesn't honor session context)
                  ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  LAYER 2: Post-Creation Move (Fallback)                      │
  │                                                              │
  │  Query sys_update_xml after every create/update              │
  │  Multi-strategy search:                                      │
  │    1. Exact name match                                       │
  │    2. LIKE search                                            │
  │    3. Metadata table broad search + payload filtering        │
  │  Retry logic: up to 3 attempts with increasing delays        │
  │  Move record to target update set if wrong                   │
  └───────────────┬──────────────────────────────────────────────┘
                  │
                  │  Some tables don't generate sys_update_xml
                  │  reliably (sys_dictionary, sysauto_script, etc.)
                  ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  LAYER 3: GlideUpdateManager2 (Final Fallback)               │
  │                                                              │
  │  callAddToUpdateSetApi()                                     │
  │  → Server runs GlideUpdateManager2().saveRecord(gr)          │
  │  → Explicitly creates sys_update_xml entry                   │
  │  → Works for ANY table type                                  │
  └───────────────┬──────────────────────────────────────────────┘
                  │
                  ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  VERIFY: sn_verify_update_set_capture                        │
  │  Confirms ALL artifacts are in the correct update set        │
  │  Auto-moves any missing ones                                 │
  └──────────────────────────────────────────────────────────────┘
```

---

## 10. React Component Hierarchy

```
  RootLayout (layout.tsx)
  ├── ThemeProvider ─── dark/light context, CSS vars, localStorage
  ├── BannerDisplay ── admin-configured banners from /api/banners
  ├── FeedbackFAB ──── floating feedback button
  │
  ├── / ─── LandingPage
  │         ├── Hero Section (tagline, video, CTA)
  │         ├── Features Grid
  │         ├── How It Works (steps)
  │         ├── CTA Section
  │         ├── Footer
  │         ├── ThemeToggle
  │         └── ConnectModal (auth state machine)
  │
  ├── /app ─── Main App (STATE OWNER)
  │            │
  │            ├── Header Bar
  │            │   ├── Menu Toggle (mobile)
  │            │   ├── App Logo + Name
  │            │   ├── PhaseTracker (SDLC stepper: Spec→Design→Scope→Impl→Test→Deploy)
  │            │   ├── Connection Badge
  │            │   ├── ThemeToggle
  │            │   └── New Chat Button
  │            │
  │            ├── SettingsPanel (Left Sidebar)
  │            │   ├── SN Credentials (URL, username, password)
  │            │   ├── AI Provider Toggle (Anthropic / OpenRouter)
  │            │   ├── Model Selector (dropdown)
  │            │   ├── API Key Input (BYOK)
  │            │   ├── Usage Meter (used/limit progress bar)
  │            │   └── Connection Info (user, roles, instance)
  │            │
  │            ├── ChatWindow (Center)
  │            │   ├── Welcome State (when no messages)
  │            │   │   ├── Hero + tagline
  │            │   │   └── SuggestionPanel (4 tabs: For You / Build / Explore / Quick)
  │            │   ├── Message List
  │            │   │   └── MessageBubble (per message)
  │            │   │       ├── Markdown rendering
  │            │   │       ├── Tool execution cards (collapsible)
  │            │   │       ├── Phase gate approve buttons
  │            │   │       └── Update set summaries
  │            │   ├── InlineAgentActivity (during streaming)
  │            │   │   └── Tool execution timeline with pulsing dots
  │            │   └── Input Area
  │            │       ├── Textarea (auto-resize)
  │            │       ├── Voice input (Web Speech API)
  │            │       ├── File attach (images, PDF, Word, Excel)
  │            │       └── Enhance/Grammar buttons
  │            │
  │            └── Modals
  │                ├── WelcomeModal (first-time user)
  │                ├── InfoModal (app info)
  │                ├── SignupGateModal (anon limit hit → prompts signup)
  │                └── APIKeyGateModal (auth limit hit → prompts BYOK)
  │
  ├── /admin ─── Admin Dashboard
  │              ├── Users tab (list, suspend/activate)
  │              ├── Access Requests tab (approve/reject)
  │              ├── Access Tiers tab (configure limits)
  │              ├── Session Logs tab (query logs)
  │              ├── Invite Codes tab (create/manage)
  │              └── Banners tab (create/manage)
  │
  └── /login ─── Login Page
```

---

## 11. Database Schema (Supabase)

```
  ┌─────────────────────┐       ┌─────────────────────┐
  │       users          │       │      sessions        │
  ├─────────────────────┤       ├─────────────────────┤
  │ id          (PK)    │──┐    │ id          (PK)    │
  │ email       (UK)    │  │    │ user_id     (FK)  ◄─┤──┐
  │ name                │  │    │ token       (UK)    │  │
  │ password_hash       │  │    │ is_temporary        │  │
  │ role                │  │    │ expires_at          │  │
  │ status              │  │    │ ip_address          │  │
  │ must_set_password   │  │    │ user_agent          │  │
  │ created_at          │  │    └─────────────────────┘  │
  │ last_login          │  │                             │
  └─────────────────────┘  │    ┌─────────────────────┐  │
                           │    │    request_log       │  │
                           │    ├─────────────────────┤  │
                           ├───►│ user_id     (FK)    │  │
                           │    │ request_date        │  │
                           │    │ request_count       │  │
                           │    └─────────────────────┘  │
                           │                             │
                           │    ┌─────────────────────┐  │
                           │    │    session_logs      │  │
                           │    ├─────────────────────┤  │
                           ├───►│ session_id  (UK)    │  │
                           │    │ user_id     (FK)    │  │
                           │    │ instance_url        │  │
                           │    │ model               │  │
                           │    │ ai_provider         │  │
                           │    │ metadata    (JSONB) │  │
                           │    │ created_at          │  │
                           │    └─────────────────────┘  │
                           │                             │
                           │    ┌─────────────────────┐  │
                           │    │   user_instances     │  │
                           │    ├─────────────────────┤  │
                           ├───►│ user_id     (FK)    │  │
                           │    │ instance_url        │  │
                           │    │ instance_name       │  │
                           │    │ sn_username         │  │
                           │    │ last_connected_at   │  │
                           │    └─────────────────────┘  │
                           │                             │
                           │    ┌─────────────────────┐  │
                           │    │     banners          │  │
                           │    ├─────────────────────┤  │
                           ├───►│ created_by  (FK)    │  │
                           │    │ title               │  │
                           │    │ content_html        │  │
                           │    │ bg_color            │  │
                           │    │ pages       (JSONB) │  │
                           │    │ start_at / end_at   │  │
                           │    └─────────────────────┘  │
                           │                             │
                           │    ┌─────────────────────┐  │
                           │    │    invite_codes      │  │
                           │    ├─────────────────────┤  │
                           └───►│ created_by  (FK)    │  │
                                │ code        (UK)    │  │
                                │ label               │  │
                                │ max_uses            │  │
                                │ times_used          │  │
                                │ expires_at          │  │
                                │ is_active           │  │
                                └─────────────────────┘  │
                                                         │
  ┌─────────────────────┐       ┌─────────────────────┐  │
  │  access_requests     │       │  anon_request_log   │  │
  ├─────────────────────┤       ├─────────────────────┤  │
  │ id          (PK)    │       │ id          (PK)    │  │
  │ email               │       │ ip_address          │  │
  │ name                │       │ instance_url        │  │
  │ company             │       │ request_date        │  │
  │ use_case            │       │ request_count       │  │
  │ status              │       └─────────────────────┘  │
  │ email_verified      │                                │
  │ reviewed_by         │       ┌─────────────────────┐  │
  └─────────────────────┘       │ access_tier_config   │  │
                                ├─────────────────────┤  │
                                │ scope               │  │
                                │ anon_daily_limit    │  │
                                │ auth_daily_limit    │  │
                                └─────────────────────┘  │
                                                         │
                                (All FK arrows point     │
                                 back to users.id) ──────┘
```

---

## 12. CLI Framework (`src/`)

```
  sn-ai (CLI)
    │
    ├── build <requirement>     ── Full pipeline execution
    │   └── Orchestrator.execute()
    │       ├── Step 1:  Analyze requirement
    │       ├── Step 2:  Gather context (SN instance)
    │       ├── Step 3:  Write spec
    │       ├── Step 4:  Design solution
    │       ├── Step 5:  Validate design
    │       ├── Step 6:  Select application scope
    │       ├── Step 7:  Plan tasks
    │       ├── Step 8:  Generate code (artifacts)
    │       ├── Step 9:  Create update set + deploy
    │       └── Step 10: Generate summary
    │
    ├── connect                 ── Test SN connection
    ├── context                 ── Gather instance context
    ├── init                    ── Interactive setup (.env)
    └── interactive             ── REPL mode
```

---

## 13. Deployment Architecture

```
  ┌──────────────────────────────────────────────────────────────┐
  │                    DOCKER (Multi-Stage Build)                 │
  │                                                              │
  │  Stage 1: mcp-build    ── Compile mcp-servicenow TypeScript  │
  │  Stage 2: deps         ── Install webapp node_modules        │
  │  Stage 3: builder      ── Build Next.js (standalone output)  │
  │  Stage 4: runner       ── Alpine production image            │
  │                                                              │
  │  Runtime (/app/):                                            │
  │  ├── mcp-servicenow/                                         │
  │  │   ├── dist/          ── Compiled tool handlers            │
  │  │   ├── node_modules/  ── axios, zod, tough-cookie          │
  │  │   ├── lib/           ── Helper scripts                    │
  │  │   └── package.json                                        │
  │  │                                                           │
  │  └── webapp/                                                 │
  │      ├── server.js      ── Entry (CMD ["node","server.js"])  │
  │      ├── .next/static/  ── CSS, JS chunks                   │
  │      ├── public/        ── Logo, favicon, SVGs               │
  │      └── node_modules/  ── Minimal (standalone-pruned)       │
  └──────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │                    RENDER (render.yaml)                       │
  │                                                              │
  │  Service:  sn-ai-dev-agent (web, Docker)                     │
  │  Plan:     Pro ($25/mo per instance)                         │
  │  Scaling:  1–5 instances                                     │
  │  Triggers: CPU > 70% or Memory > 80%                         │
  │  Health:   /api/config                                       │
  └──────────────────────────────────────────────────────────────┘
```
