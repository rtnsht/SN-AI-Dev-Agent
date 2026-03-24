# SN AI Agent — Architecture & Flow Diagrams

**Date:** March 24, 2026  
**Version:** 0.1.0-beta.2  

---

SN AI Agent lets teams build, deploy, and manage ServiceNow solutions through natural-language conversation with AI. From a single chat prompt, the platform walks through a full software development lifecycle — spec, design, implementation, testing, and deployment — with human approval gates at the critical steps. Over 115 tools connect the AI directly to any ServiceNow instance, so what used to take days ships in minutes.

*Say it. Ship it.*

---

## 1. High-Level System Architecture

The platform is a Next.js application that orchestrates between an AI provider, a rich tool engine, and a live ServiceNow instance. Supabase handles identity, usage tracking, and session persistence. Logs are durably stored in S3-compatible object storage.

```mermaid
flowchart TD
    User["👤 User Browser"]
    App["⚡ SN AI Agent\n(Next.js)"]
    AI["🧠 AI Engine\n(Claude · OpenRouter)"]
    MCP["🔧 MCP Tool Engine\n115+ ServiceNow Tools"]
    SN["☁️ ServiceNow\nInstance"]
    Supa["🗄️ Supabase\nAuth · Data · Admin"]
    S3["📦 Object Storage\nSession Logs"]

    User -->|"Chat · Voice · Files"| App
    App -->|"Streaming SSE"| AI
    AI -->|"Tool Calls"| MCP
    MCP -->|"REST API\n(Basic Auth / OAuth 2.0 PKCE)"| SN
    SN -->|"Results"| MCP
    MCP -->|"Execution Results"| AI
    AI -->|"Streamed Response"| App
    App -->|"Auth · Sessions · Usage"| Supa
    App -->|"Log Persistence"| S3

    style App fill:#2563eb,color:#fff,stroke:#1e40af
    style AI fill:#7c3aed,color:#fff,stroke:#5b21b6
    style MCP fill:#059669,color:#fff,stroke:#047857
    style SN fill:#0ea5e9,color:#fff,stroke:#0284c7
    style Supa fill:#f59e0b,color:#fff,stroke:#d97706
    style S3 fill:#64748b,color:#fff,stroke:#475569
```

---

## 2. User Journey — End to End

This sequence shows the complete lifecycle from sign-in through deployment. The platform fetches instance metadata to generate smart suggestions, then guides each request through a phased pipeline with human approval at key milestones.

```mermaid
sequenceDiagram
    actor User
    participant App as SN AI Agent
    participant Auth as Supabase Auth
    participant SN as ServiceNow Instance
    participant AI as AI Engine
    participant Store as Log Storage

    Note over User,Store: 1 — Authentication
    User->>App: Sign in (email + password / magic link)
    App->>Auth: Verify credentials
    Auth-->>App: Session token + access tier

    Note over User,Store: 2 — Instance Connection
    User->>App: Enter ServiceNow credentials
    App->>SN: Validate connection
    SN-->>App: Instance metadata + user roles

    Note over User,Store: 3 — Smart Suggestions
    App->>SN: 13 parallel instance queries
    SN-->>App: Tables, update sets, roles, recent work
    App-->>User: Personalized suggestion tabs (For You · Build · Explore · Quick)

    Note over User,Store: 4 — Conversation
    User->>App: Send message (text / voice / file)
    App->>AI: System prompt + message + phase-filtered tools
    AI->>SN: Execute tools (create, read, update, deploy)
    SN-->>AI: Execution results

    Note over User,Store: 5 — SDLC with Approval Gates
    AI-->>App: Spec document
    App-->>User: 🛑 Review & approve spec
    User->>App: Approved
    AI-->>App: Design document
    App-->>User: 🛑 Review & approve design
    User->>App: Approved
    AI->>SN: Deploy artifacts
    SN-->>AI: Deployment confirmation

    Note over User,Store: 6 — Session Wrap-up
    AI-->>App: Final streamed response
    App-->>User: Results with live tool execution log
    App->>Store: Persist session log + telemetry
```

---

## 3. SDLC Phase Pipeline

Every request flows through a six-phase pipeline. Spec and Design require explicit human approval before the AI proceeds. The remaining phases advance automatically, ensuring speed without sacrificing governance.

```mermaid
flowchart LR
    Spec["📋 Spec"]
    Gate1{"👤 User\nApproval"}
    Design["📐 Design"]
    Gate2{"👤 User\nApproval"}
    Scope["🔍 Scope\nSelection"]
    Impl["⚙️ Implementation"]
    Test["🧪 Testing"]
    Deploy["🚀 Deployment"]

    Spec --> Gate1
    Gate1 -->|Approved| Design
    Gate1 -.->|Rejected| Spec
    Design --> Gate2
    Gate2 -->|Approved| Scope
    Gate2 -.->|Rejected| Design
    Scope --> Impl
    Impl --> Test
    Test --> Deploy

    style Spec fill:#3b82f6,color:#fff,stroke:#2563eb
    style Design fill:#8b5cf6,color:#fff,stroke:#7c3aed
    style Scope fill:#06b6d4,color:#fff,stroke:#0891b2
    style Impl fill:#10b981,color:#fff,stroke:#059669
    style Test fill:#f59e0b,color:#fff,stroke:#d97706
    style Deploy fill:#ef4444,color:#fff,stroke:#dc2626
    style Gate1 fill:#fbbf24,color:#1e293b,stroke:#f59e0b
    style Gate2 fill:#fbbf24,color:#1e293b,stroke:#f59e0b
```

---

## 4. Chat & Tool Execution — Single Message Flow

This diagram details what happens when a user sends a single message. The AI engine resolves the user's access tier, assembles a phase-aware system prompt, streams its response token by token, and executes tools against ServiceNow in a loop until the task is complete.

```mermaid
sequenceDiagram
    actor User
    participant App as SN AI Agent
    participant Auth as Access Tier Resolver
    participant AI as AI Engine
    participant Tools as MCP Tool Engine
    participant SN as ServiceNow

    User->>App: Send chat message
    App->>Auth: Validate session & resolve tier
    Auth-->>App: Tier (Anonymous / Authenticated / BYOK)

    App->>AI: System prompt + conversation history + phase-filtered tools
    activate AI

    loop Until complete or max rounds
        AI-->>App: Stream partial response (SSE)
        App-->>User: Render tokens in real time

        opt AI decides to call a tool
            AI->>Tools: Tool call (e.g., create business rule)
            Tools->>SN: REST API request
            SN-->>Tools: Response payload
            Tools-->>AI: Structured result
            AI-->>App: Stream tool status + continue reasoning
            App-->>User: Show tool execution inline
        end
    end

    deactivate AI
    AI-->>App: Final response + stop reason
    App-->>User: Complete message with tool activity log
    App->>App: Log session round + telemetry
```

---

## Access Tier Summary

| Tier | Authentication | Rate Limit | AI Provider |
|------|---------------|------------|-------------|
| **Anonymous** | None (IP-tracked) | Limited daily messages | Platform key |
| **Authenticated** | Email + password or magic link | Higher daily quota | Platform key |
| **BYOK** | Authenticated + own API key | Unlimited | User's own key |

---

## Tool Coverage at a Glance

The MCP Tool Engine provides **115+ tools** across **30+ modules**, giving the AI deep operational access to any ServiceNow instance:

| Category | Examples |
|----------|---------|
| **Records & Tables** | CRUD on any table, bulk operations, encoded queries |
| **Scripts & Logic** | Business rules, client scripts, script includes, fix scripts |
| **UI & UX** | UI policies, UI actions, form layouts, catalog items |
| **Automation** | Flows, scheduled jobs, notifications, events |
| **Security** | ACLs, roles, scope management |
| **DevOps** | Update sets, scoped apps, instance analysis, promotion |
| **Multi-Instance** | Cross-instance comparison, artifact promotion workflows |

---

*Built with ❤️ by the SN AI Agent team.*
