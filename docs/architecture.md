# SN AI Dev Agent — Technical Architecture

> **Version:** 1.1 | **Date:** 2026-02-22 | **Branch:** `v1-as-webapp`

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph USER["👤 User (Browser)"]
        UI["Next.js Frontend<br/>(React Client Components)"]
    end

    subgraph NEXTJS["☁️ Next.js Server (Node.js Runtime)"]
        direction TB
        API_CHAT["POST /api/chat"]
        API_CONN["POST /api/test-connection"]
        API_CFG["GET /api/config"]
        ENGINE["sn-engine.ts<br/>Orchestration Layer<br/>(Prompt Caching + Retry w/ Backoff)"]
        PROMPT["system-prompt.ts<br/>XML-Structured SDLC Prompt"]
        RATE["rate-limiter.ts<br/>Sliding Window IP Limiter"]
    end

    subgraph MCP["📦 mcp-servicenow Package"]
        DEFS["tool-definitions.ts<br/>50+ Tool Schemas"]
        REG["tool-registry.ts<br/>Tool Dispatch Table"]
        CLIENT["ServiceNowClient<br/>(Axios HTTP Client)"]
        TOOLS["30+ Tool Modules<br/>connection, records, scripts,<br/>update-sets, catalog, ACLs,<br/>instance-analyzer, etc."]
    end

    ANTHROPIC["🤖 Anthropic API<br/>Claude Sonnet 4 / Opus 4"]
    SN["🔧 ServiceNow Instance<br/>REST API (Table, Scripted)"]

    UI -- "HTTPS POST (credentials + messages + images)" --> API_CHAT
    UI -- "HTTPS POST (SN credentials)" --> API_CONN
    UI -- "HTTPS GET" --> API_CFG

    API_CHAT --> RATE
    API_CHAT --> ENGINE
    API_CONN --> ENGINE
    API_CFG --> RATE

    ENGINE --> PROMPT
    ENGINE -- "tool schemas" --> DEFS
    ENGINE -- "messages + tools (cache_control: ephemeral)" --> ANTHROPIC
    ANTHROPIC -- "tool_use blocks / 429 rate limit" --> ENGINE
    ENGINE -- "executeToolCall()" --> REG
    REG --> TOOLS
    TOOLS --> CLIENT
    CLIENT -- "REST API calls" --> SN
    SN -- "JSON responses" --> CLIENT

    style USER fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
    style NEXTJS fill:#1e293b,stroke:#8b5cf6,color:#e2e8f0
    style MCP fill:#1e293b,stroke:#10b981,color:#e2e8f0
    style ANTHROPIC fill:#7c3aed,stroke:#a78bfa,color:#fff
    style SN fill:#0ea5e9,stroke:#38bdf8,color:#fff
```

---

## 2. Frontend Component Architecture

```mermaid
graph TB
    subgraph PAGE["page.tsx — Main Page (State Owner)"]
        direction TB
        STATE["State:<br/>credentials, messages, connected,<br/>isLoading, usage, rateLimitHit,<br/>activeReqId, currentPhase, completedPhases,<br/>selectedModel, modelLocked, pendingRetry"]
        SEND["handleSend() — Chat loop + auto-retry"]
        APPROVE["handleApprove() — Phase gate approval"]
        CONNECT["handleConnect() — SN connection"]
        NEWCHAT["handleNewChat() — Reset state"]
        ABORT["abortRef — Cancel in-flight requests"]
    end

    subgraph SIDEBAR["SettingsPanel.tsx"]
        CREDS["Credential Inputs<br/>(Instance URL, Username, Password)"]
        APIKEY["Claude API Key<br/>(or 'Provided by server' badge)<br/>Highlights amber on rate limit"]
        USAGE["Usage Progress Bar<br/>(X/10 requests used)"]
        MODEL["Model Selector<br/>(Sonnet 4 / Opus 4, locks after 1st msg)"]
        CONN_BTN["Connect Button"]
        CONN_STATUS["Connection Status<br/>(User info, roles)"]
    end

    subgraph HEADER["Header Bar"]
        TOGGLE["⚙️ Settings Toggle"]
        TITLE["SN AI Dev Agent"]
        CONN_BADGE["🟢 Connected Badge"]
        TRACKER["PhaseTracker.tsx<br/>Spec → Design → Impl → Test → Deploy"]
        NEW_BTN["+ New Chat"]
    end

    subgraph CHAT["ChatWindow.tsx"]
        EXAMPLES["Example Prompt Cards<br/>(SDLC requirements + quick queries)"]
        MSGLIST["Message List (scrollable)"]
        INPUT["Chat Input (textarea)<br/>Shift+Enter to send · Enter for new line"]
        CANCEL["■ Stop Button (cancels in-flight request)"]
        IMAGES["Image Paste/Upload/Drag-Drop"]
    end

    subgraph MSG["MessageBubble.tsx"]
        USER_MSG["User Message (blue)"]
        AI_MSG["AI Message (markdown)"]
        SYS_MSG["System Message (colored banner)"]
        TOOL_CARD["Tool Execution Cards<br/>(collapsible, with timing)"]
        GATE_BTN["✅ Approve Phase Button"]
        APPROVED["✅ Phase Approved Badge"]
    end

    PAGE --> SIDEBAR
    PAGE --> HEADER
    PAGE --> CHAT
    CHAT --> MSG
    APPROVE -- "onApprove prop" --> CHAT
    CHAT -- "onApprove prop" --> MSG

    style PAGE fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
    style SIDEBAR fill:#1e293b,stroke:#f59e0b,color:#e2e8f0
    style HEADER fill:#1e293b,stroke:#8b5cf6,color:#e2e8f0
    style CHAT fill:#1e293b,stroke:#10b981,color:#e2e8f0
    style MSG fill:#1e293b,stroke:#ef4444,color:#e2e8f0
```

---

## 3. Tool-Use Conversation Loop

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant API as /api/chat
    participant RL as Rate Limiter
    participant ENG as sn-engine.ts
    participant CL as Anthropic API
    participant REG as Tool Registry
    participant SN as ServiceNow

    U->>API: POST {credentials, messages, model, images}
    API->>RL: consume(ip) — if using server key
    RL-->>API: {allowed, usage}

    alt App-level rate limit exceeded
        API-->>U: 429 {error: "rate_limit_exceeded", usage}
    end

    API->>ENG: chat(credentials, messages, model)
    ENG->>ENG: Create ServiceNowClient per request
    ENG->>ENG: Load tool definitions (50+ schemas)

    loop Tool-Use Loop (max 15 rounds)
        rect rgb(30, 41, 59)
        Note over ENG,CL: Retry loop (max 3 attempts, exponential backoff)
        ENG->>CL: messages.create({system, tools, messages, cache_control})
        alt 429 Rate Limit
            CL-->>ENG: 429 RateLimitError
            Note over ENG: Retry after 5s → 10s → 20s
            ENG->>CL: Retry same request
        end
        CL-->>ENG: Response (+ cache_read / cache_creation stats)
        end

        alt stop_reason = "tool_use"
            loop For each tool_use block
                ENG->>REG: executeToolCall(name, args, snClient)
                REG->>SN: REST API call (GET/POST/PUT/PATCH/DELETE)
                SN-->>REG: JSON response
                REG-->>ENG: Tool result
            end
            Note over ENG: Append tool results → next round
        else stop_reason = "end_turn"
            ENG-->>API: {reply, toolExecutions}
        end
    end

    alt Anthropic 429 after all retries exhausted
        ENG-->>API: throws "anthropic_rate_limit"
        API-->>U: 429 {error: "anthropic_rate_limit", needsApiKey: true}
        Note over U: Store failed msg in pendingRetry<br/>Show inline error + open Settings<br/>User enters API key → auto-retry
    end

    API-->>U: 200 {reply, toolExecutions, usage}
    Note over U: Parse phase gate markers<br/>Render markdown + tool cards<br/>Show Approve button if gate detected
```

---

## 4. SDLC Phase Gate Workflow

```mermaid
stateDiagram-v2
    [*] --> UserRequest: User describes a requirement

    UserRequest --> SpecPhase: Claude generates spec

    state SpecPhase {
        [*] --> SpecGenerated
        SpecGenerated --> SpecGate: &lt;!-- PHASE_GATE:spec --&gt;
        SpecGate --> SpecApproved: User clicks "Approve Spec"
    }

    SpecPhase --> DesignPhase: "approved" sent to Claude

    state DesignPhase {
        [*] --> InstanceDiscovery: Claude uses SN tools to analyze
        InstanceDiscovery --> DesignGenerated
        DesignGenerated --> DesignGate: &lt;!-- PHASE_GATE:design --&gt;
        DesignGate --> DesignApproved: User clicks "Approve Design"
    }

    DesignPhase --> ImplPhase: "approved" sent to Claude

    state ImplPhase {
        [*] --> CreateUpdateSet
        CreateUpdateSet --> DeployArtifacts: Business rules, scripts, etc.
        DeployArtifacts --> ImplGate: &lt;!-- PHASE_GATE:implementation --&gt;
    }

    ImplPhase --> TestPhase: Auto-proceed

    state TestPhase {
        [*] --> CreateTestPlan
        CreateTestPlan --> ExecuteTests: Query/verify via SN tools
        ExecuteTests --> TestGate: &lt;!-- PHASE_GATE:testing --&gt;
    }

    TestPhase --> DeployPhase: Auto-proceed

    state DeployPhase {
        [*] --> DeployRecord
        DeployRecord --> DeployGate: &lt;!-- PHASE_GATE:deployment --&gt;
    }

    DeployPhase --> [*]: Requirement Complete ✅
```

---

## 5. Credential & API Key Flow

```mermaid
flowchart TD
    START["User opens app"] --> CHECK_CFG["GET /api/config"]
    CHECK_CFG --> HAS_KEY{Server has<br/>CLAUDE_API_KEY?}

    HAS_KEY -->|Yes| SHOW_BADGE["Show 'Provided by server' badge<br/>+ usage counter (X/10)"]
    HAS_KEY -->|No| SHOW_INPUT["Show Claude API Key input field"]

    SHOW_BADGE --> ENTER_SN["User enters SN credentials"]
    SHOW_INPUT --> ENTER_KEY["User enters Claude API Key"]
    ENTER_KEY --> ENTER_SN

    ENTER_SN --> CONNECT["POST /api/test-connection"]
    CONNECT --> ROLES{Check admin &<br/>security_admin roles}
    ROLES -->|Has roles| READY["✅ Connected — ready to chat"]
    ROLES -->|Missing roles| WARN["⚠️ Warning banner + continue"]
    WARN --> READY

    READY --> CHAT_MSG["User sends message"]
    CHAT_MSG --> KEY_SRC{Using server key?}
    KEY_SRC -->|Yes| RATE_CHECK["Rate limiter: consume(IP)"]
    KEY_SRC -->|No| BYPASS["Bypass rate limit"]

    RATE_CHECK --> UNDER{Under limit?}
    UNDER -->|Yes| PROCESS["Process chat request"]
    UNDER -->|No| APP_BLOCK["429 (app): Show upgrade prompt<br/>Open settings, highlight API key field"]
    BYPASS --> PROCESS

    PROCESS --> ANTHROPIC_CALL["sn-engine: call Claude API<br/>(with retry + backoff)"]
    ANTHROPIC_CALL --> API_OK{Anthropic<br/>succeeds?}
    API_OK -->|Yes| RESPONSE["✅ Show response"]
    API_OK -->|No (429 after retries)| API_BLOCK["429 (anthropic_rate_limit):<br/>Store msg in pendingRetry<br/>Show inline 🔑 error<br/>Open settings, highlight API key"]

    API_BLOCK --> USER_KEY["User enters own API key"]
    USER_KEY --> AUTO_RETRY["Auto-retry failed message<br/>with new key + full history"]
    AUTO_RETRY --> ANTHROPIC_CALL

    style START fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
    style READY fill:#065f46,stroke:#10b981,color:#e2e8f0
    style APP_BLOCK fill:#7f1d1d,stroke:#ef4444,color:#e2e8f0
    style API_BLOCK fill:#7f1d1d,stroke:#f59e0b,color:#e2e8f0
    style WARN fill:#78350f,stroke:#f59e0b,color:#e2e8f0
    style RESPONSE fill:#065f46,stroke:#10b981,color:#e2e8f0
    style AUTO_RETRY fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
```

---

## 6. MCP Tool Categories (50+ Tools)

```mermaid
graph LR
    subgraph CORE["Core Tools"]
        C1["connection<br/>(test, info, tables, schema)"]
        C2["records<br/>(query, get, create, update, delete)"]
        C3["scripts<br/>(business rules, script includes,<br/>client scripts)"]
    end

    subgraph CONFIG["Configuration Tools"]
        CF1["update-sets<br/>(create, list, set current)"]
        CF2["ui-policies<br/>(create, list, manage)"]
        CF3["notifications<br/>(create, list, manage)"]
        CF4["acls<br/>(create, list, manage)"]
        CF5["scheduled-jobs<br/>(create, list, manage)"]
    end

    subgraph CATALOG["Service Catalog"]
        CA1["catalog<br/>(items, categories,<br/>variables, requests)"]
    end

    subgraph ANALYSIS["Analysis & Quality"]
        A1["instance-analyzer"]
        A2["ootb-override-detector"]
        A3["dependency-graph"]
        A4["code-quality-analyzer"]
        A5["dead-code-finder"]
        A6["anti-pattern-detector"]
    end

    subgraph GOVERNANCE["Governance & Safety"]
        G1["change-impact-analyzer"]
        G2["conflict-detector"]
        G3["conflict-predictor"]
        G4["guardrail-validator"]
        G5["breaking-change-detector"]
        G6["approval-gate"]
        G7["audit-logger"]
    end

    subgraph ADVANCED["Advanced / Multi-Instance"]
        AD1["instance-registry"]
        AD2["instance-compare"]
        AD3["multi-instance-manager"]
        AD4["promotion-workflow"]
        AD5["upgrade-readiness"]
        AD6["ootb-baseline-comparator"]
        AD7["recommendation-engine"]
        AD8["dashboard-reporter"]
    end

    subgraph SPECIAL["Specialized"]
        S1["persona-engine"]
        S2["four-g-framework"]
    end

    style CORE fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
    style CONFIG fill:#1e293b,stroke:#8b5cf6,color:#e2e8f0
    style CATALOG fill:#1e293b,stroke:#f59e0b,color:#e2e8f0
    style ANALYSIS fill:#1e293b,stroke:#10b981,color:#e2e8f0
    style GOVERNANCE fill:#1e293b,stroke:#ef4444,color:#e2e8f0
    style ADVANCED fill:#1e293b,stroke:#06b6d4,color:#e2e8f0
    style SPECIAL fill:#1e293b,stroke:#ec4899,color:#e2e8f0
```

---

## 7. Project Directory Structure

```
SN-AI-Dev-Agent/
│
├── webapp/                          ← Next.js Web Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             ← Main page (state owner, orchestration)
│   │   │   ├── layout.tsx           ← Root layout (HTML, fonts, metadata)
│   │   │   ├── globals.css          ← Tailwind CSS + custom styles
│   │   │   └── api/
│   │   │       ├── chat/route.ts    ← POST /api/chat (main AI endpoint)
│   │   │       ├── test-connection/ ← POST /api/test-connection
│   │   │       └── config/route.ts  ← GET /api/config (public settings)
│   │   ├── components/
│   │   │   ├── SettingsPanel.tsx     ← Credentials, API key, usage meter
│   │   │   ├── ChatWindow.tsx       ← Message list, input, example prompts
│   │   │   ├── MessageBubble.tsx    ← Message rendering, tool cards, approve btn
│   │   │   └── PhaseTracker.tsx     ← SDLC phase stepper in header
│   │   └── lib/
│   │       ├── sn-engine.ts         ← Anthropic tool-use loop orchestrator
│   │       ├── system-prompt.ts     ← SDLC methodology system prompt
│   │       ├── rate-limiter.ts      ← IP-based sliding window rate limiter
│   │       └── types.ts             ← Shared types, phase gate parser
│   ├── package.json
│   └── .env.example                 ← CLAUDE_API_KEY, RATE_LIMIT_MAX, etc.
│
├── mcp-servicenow/                  ← ServiceNow Tool Engine (npm package)
│   ├── src/
│   │   ├── index.ts                 ← MCP server entry point (stdio transport)
│   │   ├── tool-definitions.ts      ← 50+ tool JSON schemas (single source of truth)
│   │   ├── tool-registry.ts         ← Tool dispatch table + executeToolCall()
│   │   ├── client/
│   │   │   └── sn-client.ts         ← ServiceNowClient (Axios HTTP wrapper)
│   │   ├── tools/                   ← 30+ tool implementation modules
│   │   │   ├── connection.ts        ├── records.ts
│   │   │   ├── scripts.ts           ├── update-sets.ts
│   │   │   ├── catalog.ts           ├── acls.ts
│   │   │   ├── notifications.ts     ├── ui-policies.ts
│   │   │   ├── scheduled-jobs.ts    ├── instance-analyzer.ts
│   │   │   ├── code-quality-analyzer.ts  ├── dead-code-finder.ts
│   │   │   ├── anti-pattern-detector.ts  ├── change-impact-analyzer.ts
│   │   │   ├── conflict-detector.ts      ├── guardrail-validator.ts
│   │   │   └── ... (16 more)
│   │   ├── deployer/                ← Deployment automation
│   │   └── types/                   ← TypeScript type definitions
│   └── package.json
│
├── specs/                           ← Requirement specifications (SDLC artifacts)
│   ├── config.properties            ← Phase gate settings
│   ├── manifest.json                ← Requirement registry
│   └── REQ-XXX/                     ← Per-requirement folders
│
├── templates/                       ← Document templates (spec, design, test, deploy)
├── scripts/                         ← Validation & utility scripts
├── CLAUDE.md                        ← AI agent instructions (local CLI usage)
└── PROJECT-TRACKER.md               ← Project status & session notes
```

---

## 8. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Stateless API** | Credentials sent per-request | No server-side sessions = simpler, no auth infrastructure needed |
| **Per-request SN client** | New `ServiceNowClient` per chat | Supports multiple users simultaneously, no credential mixing |
| **Tool-use loop** | Up to 15 rounds | Claude can chain multiple tool calls to complete complex tasks |
| **System prompt injection** | XML-tagged SDLC prompt (117 lines) | Web app can't read filesystem; XML tags = native Claude parsing, 50% token reduction |
| **Phase gate markers** | HTML comments `<!-- PHASE_GATE:xxx -->` | Invisible in rendered markdown, parseable by frontend |
| **Rate limiting** | In-memory sliding window | Simple, no Redis needed for MVP; resets on server restart |
| **createRequire** | Runtime module loading | Bypasses Turbopack static analysis for mcp-servicenow ESM modules |
| **Single tool registry** | Shared between MCP server & web app | Tool definitions and handlers defined once, consumed by both transports |
| **Prompt caching** | `cache_control: { type: "ephemeral" }` | 90% token cost reduction on cache hits (rounds 2-15, valid 5 min) |
| **Retry with backoff** | 3 retries: 5s → 10s → 20s | Handles transient Anthropic 429 errors; respects `retry-after` header |
| **Model selection** | Sonnet 4 (fast) / Opus 4 (capable) | User choice, locked after first message to avoid mid-conversation confusion |
| **Pending retry pattern** | `pendingRetry` state stores failed msg | On Anthropic 429 exhaustion: user provides API key → auto-retry with full history |
| **AbortController** | Cancel in-flight requests | User can stop long-running requests; send button toggles to stop button |
| **Shift+Enter to send** | Enter = new line, Shift+Enter = send | Better UX for multi-line prompts (ServiceNow code snippets) |

