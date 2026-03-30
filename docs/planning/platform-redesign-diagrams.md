# Platform Redesign — Architecture Diagrams

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Browser (Client)"
        UI["🖥️ Next.js App (page-v2.tsx)"]
        NR["NavRail"]
        CT["ChatTabBar"]
        TW["ToolWorkbench"]
        CW["ChatWindow"]
        PP["ProfilePanel"]
        
        UI --> NR
        UI --> CT
        UI --> CW
        NR --> TW
        NR --> PP
    end

    subgraph "Next.js API Layer"
        CS["/api/chat-stream"]
        TE["/api/tools/execute"]
        CH["/api/chats/*"]
        UC["/api/user/connections/*"]
        AK["/api/user/api-keys/*"]
        AU["/api/auth/*"]
    end

    subgraph "Engine Layer"
        AO["Agent Orchestrator"]
        SE["SN Engine (sn-engine.ts)"]
        KR["Key Resolver"]
        CV["Crypto Vault"]
        FP["File Parser"]
        
        AO --> SE
        KR --> CV
    end

    subgraph "Agent Pool"
        ORC["🧠 Orchestrator Agent"]
        EXP["🔍 Explorer Agent"]
        BLD["🔨 Builder Agent"]
        SDD["🏗️ SDD Agent"]
        ANL["📊 Analyzer Agent"]
        OPR["🔄 Operator Agent"]
        FLW["🌊 Flow Architect"]
        EVL["🛡️ Evaluator (VAPT)"]
    end

    subgraph "System Connectors"
        SNC["ServiceNow Connector"]
        JC["JIRA Connector 🔜"]
        SFC["Salesforce Connector 🔜"]
        
        SNC --> SNI["ServiceNow Instance"]
        JC --> JI["JIRA Cloud 🔜"]
        SFC --> SFI["Salesforce Org 🔜"]
    end

    subgraph "Database (Supabase)"
        DB_U["users"]
        DB_S["sessions"]
        DB_C["chats"]
        DB_M["chat_messages"]
        DB_A["session_artifacts"]
        DB_SC["user_system_connections"]
        DB_AK["user_api_keys"]
        DB_SL["session_logs"]
    end

    CW -->|"Chat messages"| CS
    TW -->|"Direct tool exec"| TE
    CT -->|"Chat CRUD"| CH
    PP -->|"Credentials"| UC
    PP -->|"API Keys"| AK

    CS --> AO
    TE --> SNC
    AO --> ORC
    ORC -->|"routes"| EXP & BLD & SDD & ANL & OPR & FLW
    BLD -->|"every write"| EVL
    
    SE --> SNC
    CH --> DB_C & DB_M
    UC --> DB_SC
    AK --> DB_AK
    TE --> DB_A

    style EVL fill:#ff6b6b,color:#fff
    style ORC fill:#4ecdc4,color:#fff
    style SNC fill:#45b7d1,color:#fff
    style JC fill:#ddd,color:#999
    style SFC fill:#ddd,color:#999
```

---

## 2. Two Interaction Modes — User Flow

```mermaid
graph LR
    USER["👤 User"]
    
    subgraph "Mode A: Agent-Assisted (Chat)"
        A1["Type natural language\n'Create a notification\nfor high-priority incidents'"]
        A2["Orchestrator classifies"]
        A3["Routes to Builder Agent"]
        A4["Agent calls tools\nautomatically"]
        A5["VAPT auto-evaluates"]
        A6["Result in chat"]
    end
    
    subgraph "Mode B: Direct Tool Execution"
        B1["Open Tool Workbench 🔧"]
        B2["Browse categories\n📧 Notifications"]
        B3["Click ▶ Run on\n'Create Notification'"]
        B4["Fill structured form\nName, Table, Subject..."]
        B5["Click Execute"]
        B6["Tool runs directly\n(no AI, no LLM call)"]
        B7["VAPT auto-evaluates"]
        B8["Result card in chat"]
    end
    
    USER -->|"Chat input"| A1
    USER -->|"Tool panel"| B1
    
    A1 --> A2 --> A3 --> A4 --> A5 --> A6
    B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> B7 --> B8
    
    style A1 fill:#4ecdc4,color:#fff
    style B1 fill:#45b7d1,color:#fff
    style A5 fill:#ff6b6b,color:#fff
    style B7 fill:#ff6b6b,color:#fff
```

---

## 3. Agent Harness Architecture (Anthropic Pattern)

```mermaid
graph TD
    REQ["📩 User Request"]
    
    subgraph "ORCHESTRATOR (Haiku — fast/cheap)"
        CLS["Classify Request Type"]
        RTE["Route to Sub-Agent(s)"]
        SYN["Synthesize Results"]
    end
    
    REQ --> CLS
    CLS -->|"explore"| EXP["🔍 Explorer Agent\n—————————\nRead-only tools\n~25 tools\nSonnet model"]
    CLS -->|"build"| BLD["🔨 Builder Agent\n—————————\nWrite tools\n~40 tools\nSonnet model"]
    CLS -->|"sdd"| SDD["🏗️ SDD Agent\n—————————\nAll 147 tools\n+ Phase gates\nSonnet/Opus"]
    CLS -->|"analyze"| ANL["📊 Analyzer Agent\n—————————\nQuality tools\n~30 tools\nSonnet model"]
    CLS -->|"operate"| OPR["🔄 Operator Agent\n—————————\nDevOps tools\n~25 tools\nSonnet model"]
    CLS -->|"flow"| FLW["🌊 Flow Architect\n—————————\nFlow tools\n~15 tools\nSonnet model"]
    
    EXP -->|"results"| SYN
    BLD -->|"results + artifacts"| VAPT
    SDD -->|"results + artifacts"| VAPT
    ANL -->|"results"| SYN
    OPR -->|"results + artifacts"| VAPT
    FLW -->|"results + artifacts"| VAPT
    
    subgraph "EVALUATOR (VAPT)"
        VAPT["🛡️ Evaluator Agent\n—————————\nHaiku (fast)\nGuardrails\nSN Best Practices\nSecurity Scan"]
    end
    
    VAPT -->|"evaluation report"| SYN
    SYN -->|"formatted response\n+ agent attribution\n+ VAPT badges"| RESP["📤 Response to User"]
    
    style CLS fill:#4ecdc4,color:#fff
    style VAPT fill:#ff6b6b,color:#fff
    style SYN fill:#4ecdc4,color:#fff
```

---

## 4. Structured Handoff Between Agents

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant O as 🧠 Orchestrator
    participant B as 🔨 Builder
    participant V as 🛡️ Evaluator
    participant DB as 💾 Database
    
    U->>O: "Create a notification for high-priority incidents"
    
    Note over O: Classify: "build" task<br/>Select: Builder agent<br/>Prepare: focused context
    
    O->>B: Handoff {<br/>  task: "create notification",<br/>  tools: [sn_create_notification, ...],<br/>  context: { table: "incident" },<br/>  budget: 15 rounds<br/>}
    
    Note over B: Focused system prompt<br/>Only notification tools<br/>Budget-aware execution
    
    B->>B: sn_create_notification(...)
    B->>B: ✅ Created sys_id: abc123
    
    B->>O: Result {<br/>  summary: "Created notification",<br/>  artifacts: [{ table: "sysevent_email_action",<br/>    sysId: "abc123", name: "High Priority Alert" }],<br/>  roundsUsed: 3<br/>}
    
    O->>V: Evaluate {<br/>  artifact: "abc123",<br/>  type: "notification",<br/>  content: "..." <br/>}
    
    V->>O: Evaluation {<br/>  passed: true,<br/>  score: 95,<br/>  violations: [],<br/>  recommendations: ["Consider adding unsubscribe link"]<br/>}
    
    O->>DB: Save artifact + evaluation
    O->>U: ✅ Created "High Priority Alert"<br/>🛡️ VAPT: Passed (95/100)<br/>💡 Recommendation: Consider unsubscribe link
```

---

## 5. Database Schema (ER Diagram)

```mermaid
erDiagram
    users ||--o{ chats : "owns"
    users ||--o{ user_system_connections : "has"
    users ||--o{ user_api_keys : "stores"
    users ||--o{ sessions : "authenticates"
    users ||--o{ session_artifacts : "creates"
    
    chats ||--o{ chat_messages : "contains"
    chats ||--o{ session_artifacts : "generates"
    chats }o--|| user_system_connections : "connects via"
    
    users {
        uuid id PK
        text email UK
        text name
        text password_hash
        text role
        text status
        boolean must_set_password
        timestamptz created_at
    }
    
    chats {
        uuid id PK
        uuid user_id FK
        text title
        uuid instance_id FK
        text active_mode
        text active_agent
        text[] active_tools
        text sdd_req_id
        text sdd_phase
        text ai_provider
        text ai_model
        jsonb agent_config
        integer message_count
        boolean is_archived
        boolean is_pinned
        timestamptz last_message_at
    }
    
    chat_messages {
        uuid id PK
        uuid chat_id FK
        text role
        text content
        text agent_id
        text agent_model
        text phase_gate
        jsonb tool_calls
        boolean has_attachments
        boolean is_hidden
        integer tokens_in
        integer tokens_out
        timestamptz created_at
    }
    
    session_artifacts {
        uuid id PK
        uuid chat_id FK
        uuid user_id FK
        text artifact_type
        text artifact_name
        text sn_table
        text sn_sys_id
        text content
        text instance_url
        text update_set_name
        jsonb evaluation
        timestamptz created_at
    }
    
    user_system_connections {
        uuid id PK
        uuid user_id FK
        text system_type
        text label
        text instance_url
        text auth_type
        text sn_username
        text sn_password_enc
        text client_id
        text client_secret_enc
        text access_token_enc
        text refresh_token_enc
        boolean is_default
        text connection_status
        timestamptz last_connected
    }
    
    user_api_keys {
        uuid id PK
        uuid user_id FK
        text provider
        text label
        text api_key_enc
        boolean is_default
        timestamptz last_used_at
    }
    
    sessions {
        uuid id PK
        uuid user_id FK
        text token
        boolean is_temporary
        timestamptz expires_at
    }
```

---

## 6. UI Layout Structure

```mermaid
graph TB
    subgraph "Full Application Layout"
        subgraph "NavRail (64px fixed)"
            NR_CHAT["💬 Chats"]
            NR_TOOL["🔧 Tools"]
            NR_AGENT["🤖 Agents"]
            NR_SET["⚙ Settings"]
            NR_PROF["👤 Profile"]
            NR_THEME["🌙 Theme"]
            NR_LOGO["SN Logo"]
        end
        
        subgraph "Main Area (flex-1)"
            subgraph "Header"
                TITLE["SN AI Agent"]
                CONN["🟢 Connected: dev300943"]
                NEW["+ New Chat"]
            end
            
            subgraph "Tab Bar"
                T1["Chat 1 ×"]
                T2["Chat 2 ×"]
                T3["Chat 3 ×"]
                TNEW["+ "]
            end
            
            subgraph "Mode Ribbon"
                M1["🔍 Explore"]
                M2["🔨 Build"]
                M3["🏗️ SDD"]
                M4["📊 Analyze"]
                M5["🔄 Operate"]
                M6["🌊 Flow"]
                M7["💬 Freeform"]
            end
            
            subgraph "Chat Area"
                MSGS["Messages\n(full width, scrollable)"]
                ACTIVITY["Agent Activity\n(inline, collapsible)"]
            end
            
            subgraph "Input Area"
                CONTEXT["Context: Explorer Agent · Sonnet · 25 tools"]
                INPUT["📎 What should we work on next? →"]
                DISC["Agentic AI disclaimer"]
            end
        end
    end
    
    subgraph "Overlay Drawers (on top)"
        D_CHAT["Chat List\nDrawer"]
        D_TOOL["Tool Workbench\nDrawer"]
        D_AGENT["Agent Config\nDrawer"]
        D_PROF["Profile/Vault\nDrawer"]
    end
    
    NR_CHAT -.->|"click"| D_CHAT
    NR_TOOL -.->|"click"| D_TOOL
    NR_AGENT -.->|"click"| D_AGENT
    NR_PROF -.->|"click"| D_PROF
    
    style NR_CHAT fill:#45b7d1,color:#fff
    style NR_TOOL fill:#f9ca24,color:#333
    style NR_AGENT fill:#6c5ce7,color:#fff
    style NR_PROF fill:#00b894,color:#fff
```

---

## 7. Tool Category Hierarchy

```mermaid
graph TD
    ROOT["🔧 Tool Workbench"]
    
    ROOT --> SYS["📡 SYSTEMS"]
    ROOT --> REC["📋 Records & Data"]
    ROOT --> SS["💻 Server Scripts"]
    ROOT --> CU["🖥️ Client & UI"]
    ROOT --> SEC["🔐 Security & Access"]
    ROOT --> NOT["📧 Notifications"]
    ROOT --> DEV["📦 DevOps"]
    ROOT --> AUT["🔄 Automation"]
    ROOT --> POR["🎨 Portal & UX"]
    ROOT --> CAT["🛒 Service Catalog"]
    ROOT --> ANA["📊 Analysis & Quality"]
    ROOT --> TST["🧪 Testing"]
    ROOT --> SDD_M["🏗️ SDD Mode"]
    ROOT --> EXT["📋 External Systems"]
    
    SYS --> SN["🟢 ServiceNow\n(connected)"]
    SYS --> JR["⚫ JIRA\n(not configured)"]
    SYS --> SF["⚫ Salesforce\n(coming soon)"]
    SYS --> WD["⚫ Workday\n(coming soon)"]
    
    REC --> RC1["Records CRUD\n4 tools"]
    REC --> RC2["🔜 Data Migration\n3 tools"]
    REC --> RC3["🔜 Import/Export"]
    
    SS --> SS1["Business Rules\n2 tools"]
    SS --> SS2["Script Includes\n2 tools"]
    SS --> SS3["Fix Scripts\n3 tools"]
    SS --> SS4["Scheduled Jobs\n2 tools"]
    
    CU --> CU1["Client Scripts\n2 tools"]
    CU --> CU2["UI Policies\n4 tools"]
    CU --> CU3["UI Actions\n2 tools"]
    CU --> CU4["🔜 UI Builder"]
    
    AUT --> AU1["Flow Designer\n8+ tools"]
    AUT --> AU2["Scheduled Jobs\n2 tools"]
    AUT --> AU3["🔜 IntegrationHub"]
    
    POR --> PO1["Service Portal\n14 tools"]
    POR --> PO2["🔜 Workspace"]
    POR --> PO3["🔜 Now Experience"]
    
    ANA --> AN1["Instance Analysis\n3 tools"]
    ANA --> AN2["Code Quality\n4 tools"]
    ANA --> AN3["OOTB Detection\n2 tools"]
    ANA --> AN4["Dependencies\n4 tools"]
    
    EXT --> EX1["🔜 JIRA Issues"]
    EXT --> EX2["🔜 SN Agile Stories"]
    EXT --> EX3["🔜 Linear Issues"]
    
    style SN fill:#45b7d1,color:#fff
    style JR fill:#ddd,color:#999
    style SF fill:#ddd,color:#999
    style WD fill:#ddd,color:#999
    style RC2 fill:#fff3cd,color:#856404
    style RC3 fill:#fff3cd,color:#856404
    style CU4 fill:#fff3cd,color:#856404
    style AU3 fill:#fff3cd,color:#856404
    style PO2 fill:#fff3cd,color:#856404
    style PO3 fill:#fff3cd,color:#856404
    style EX1 fill:#fff3cd,color:#856404
    style EX2 fill:#fff3cd,color:#856404
    style EX3 fill:#fff3cd,color:#856404
```

---

## 8. Direct Tool Execution Flow

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant TW as 🔧 Tool Workbench
    participant TP as 📝 Tool Form
    participant API as /api/tools/execute
    participant CV as 🔒 Crypto Vault
    participant TR as Tool Registry
    participant SN as ServiceNow
    participant EV as 🛡️ Evaluator
    participant DB as 💾 Database
    
    U->>TW: Browse categories
    U->>TW: Expand "Notifications"
    U->>TW: Click [▶ Run] on "Create Notification"
    
    TW->>TP: Open form (auto-generated from inputSchema)
    U->>TP: Fill: name, table, subject, message, recipients
    U->>TP: Click "Execute"
    
    TP->>API: POST { chatId, toolName, args }
    
    API->>API: Validate session (mandatory login)
    API->>CV: Resolve credentials (instanceId → decrypt)
    CV-->>API: Decrypted SN credentials
    
    API->>TR: executeToolCall("sn_create_notification", args)
    TR->>SN: REST API call
    SN-->>TR: { success: true, sys_id: "abc123" }
    TR-->>API: Tool result
    
    Note over API: Write operation detected → auto-evaluate
    
    API->>EV: Evaluate artifact
    EV-->>API: { passed: true, score: 95 }
    
    API->>DB: Save to session_artifacts
    API->>DB: Save result as chat_message
    
    API-->>TP: { success, result, evaluation, artifact }
    TP-->>U: ✅ Result card with VAPT badge
```

---

## 9. Multi-Chat / Multi-Tab Architecture

```mermaid
graph TB
    subgraph "Browser Tab 1"
        T1_TAB["Tab Bar: [Chat A*] [Chat B] [+]"]
        T1_CHAT["Chat A (active)\nInstance: dev300943\nMode: Build\nAgent: Builder"]
    end
    
    subgraph "Browser Tab 2"
        T2_TAB["Tab Bar: [Chat C*] [Chat A] [+]"]
        T2_CHAT["Chat C (active)\nInstance: prod-instance\nMode: Analyze\nAgent: Analyzer"]
    end
    
    subgraph "Browser Tab 3"
        T3_TAB["Tab Bar: [Chat D*] [+]"]
        T3_CHAT["Chat D (active)\nInstance: dev300943\nMode: SDD\nAgent: SDD Agent"]
    end
    
    subgraph "Server"
        API["Next.js API"]
        
        subgraph "Per-Chat Isolation"
            SC_A["Chat A\nSN Client → dev300943\nSessionCache A\nBuilder Agent"]
            SC_C["Chat C\nSN Client → prod\nSessionCache C\nAnalyzer Agent"]
            SC_D["Chat D\nSN Client → dev300943\nSessionCache D\nSDD Agent"]
        end
    end
    
    subgraph "Database (Source of Truth)"
        DB_CHATS["chats table\n—————\nChat A, B, C, D"]
        DB_MSGS["chat_messages\n—————\nAll messages"]
        DB_CREDS["user_system_connections\n—————\ndev300943 creds\nprod creds"]
    end
    
    T1_CHAT -->|"stream"| SC_A
    T2_CHAT -->|"stream"| SC_C
    T3_CHAT -->|"stream"| SC_D
    
    SC_A --> DB_MSGS
    SC_C --> DB_MSGS
    SC_D --> DB_MSGS
    
    API --> DB_CREDS
    
    T1_TAB -.->|"BroadcastChannel\n(new chat created)"| T2_TAB
    T2_TAB -.->|"BroadcastChannel"| T3_TAB
    
    style SC_A fill:#45b7d1,color:#fff
    style SC_C fill:#e17055,color:#fff
    style SC_D fill:#6c5ce7,color:#fff
```

---

## 10. System Connector Architecture (Extensible)

```mermaid
graph TB
    subgraph "SystemConnector Interface"
        IF["interface SystemConnector\n————————————————\nid: string\nname: string\ngetToolCategories()\ngetTools()\nexecuteToolCall()\ntestConnection()"]
    end
    
    IF --> SNC["ServiceNowConnector\n————————————————\n147 tools\n13 categories\nBasic / OAuth / Browser auth\nExisting MCP tools"]
    
    IF --> JC["JIRAConnector 🔜\n————————————————\n~46 tools (Atlassian MCP)\nIssues, Boards, Sprints\nOAuth 2.1 / API Token"]
    
    IF --> SFC["SalesforceConnector 🔜\n————————————————\nObjects, Records, Flows\nAgentforce MCP\nOAuth 2.0"]
    
    IF --> LC["LinearConnector 🔜\n————————————————\nIssues, Projects, Cycles\nGraphQL API\nAPI Key"]
    
    IF --> WC["WorkdayConnector 🔜\n————————————————\nWorkers, Positions\nREST/SOAP\nOAuth / Token"]
    
    subgraph "Tool Workbench UI"
        TW["Renders ALL active\nconnectors uniformly\n————————————————\nAdding a new system =\nimplement interface +\nadd tool definitions\nZERO UI changes"]
    end
    
    subgraph "Credential Vault"
        CV["user_system_connections\n————————————————\nsystem_type: 'servicenow'\nsystem_type: 'jira'\nsystem_type: 'salesforce'\n————————————————\nAll encrypted AES-256-GCM"]
    end
    
    SNC --> TW
    JC --> TW
    SFC --> TW
    LC --> TW
    WC --> TW
    
    SNC --> CV
    JC --> CV
    SFC --> CV
    
    style SNC fill:#45b7d1,color:#fff
    style JC fill:#ddd,color:#999
    style SFC fill:#ddd,color:#999
    style LC fill:#ddd,color:#999
    style WC fill:#ddd,color:#999
    style TW fill:#f9ca24,color:#333
```

---

## 11. VAPT (Evaluator) Auto-Enforcement Flow

```mermaid
graph TD
    WRITE["Any Write Operation\n(sn_create_* or sn_update_*)"]
    
    WRITE --> CHECK{"Contains\nscript content?"}
    
    CHECK -->|"Yes"| FULL["Full VAPT Evaluation"]
    CHECK -->|"No"| LIGHT["Light Evaluation"]
    
    subgraph "Full VAPT Checks"
        FULL --> G1["🔍 Guardrail Validator\nno eval(), no hardcoded creds\nno GlideRecord in client scripts"]
        FULL --> G2["📏 Naming Conventions\nPascalCase, no REQ-IDs\nSN standard patterns"]
        FULL --> G3["🛡️ Security Scan\nXSS prevention\nInjection checks\nACL verification"]
        FULL --> G4["✅ Best Practices\nError handling\nPerformance patterns\nAsync where appropriate"]
    end
    
    subgraph "Light Evaluation"
        LIGHT --> L1["📏 Naming check"]
        LIGHT --> L2["🔗 Update set verify"]
    end
    
    G1 & G2 & G3 & G4 --> SCORE["Score: 0-100"]
    L1 & L2 --> SCORE
    
    SCORE --> SEV{"Severity?"}
    
    SEV -->|"🟢 Pass (80+)"| PASS["✅ Passed\nBadge: 🛡️ 95/100"]
    SEV -->|"🟡 Warn (50-79)"| WARN["⚠️ Warnings\nShow recommendations\nAllow proceed"]
    SEV -->|"🔴 Block (<50)"| BLOCK["❌ Blocked\nShow violations\nRequire fix"]
    
    PASS --> SAVE["💾 Save artifact\n+ evaluation to DB"]
    WARN --> SAVE
    BLOCK --> NOTIFY["🔔 Notify user\nwith fix suggestions"]
    
    style WRITE fill:#45b7d1,color:#fff
    style BLOCK fill:#ff6b6b,color:#fff
    style WARN fill:#f9ca24,color:#333
    style PASS fill:#00b894,color:#fff
```

---

## 12. Implementation Phase Dependencies

```mermaid
gantt
    title Implementation Phases
    dateFormat X
    axisFormat %s
    
    section Foundation
    Copy page-v2.tsx           :p1a, 0, 1
    DB Migrations (021-024)    :p1b, 0, 2
    Crypto Vault               :p1c, 1, 2
    System Connectors interface :p1d, 1, 3
    Tool Categories mapping    :p1e, 1, 3
    API Routes (chats, vault)  :p1f, 2, 4
    
    section Agent Harness
    Agent Definitions          :p2a, 3, 4
    Agent Orchestrator         :p2b, 4, 6
    VAPT Auto-enforcement      :p2c, 5, 7
    Modify sn-engine.ts        :p2d, 5, 7
    
    section Tool Workbench
    ToolWorkbench.tsx           :p3a, 4, 6
    ToolExecutionPanel.tsx      :p3b, 5, 7
    Tool Form Generator        :p3c, 4, 6
    Direct Execution API       :p3d, 4, 6
    
    section UI Shell
    NavRail + DrawerOverlay    :p4a, 3, 5
    ChatTabBar + ChatList      :p4b, 5, 7
    Refactor page-v2.tsx       :p4c, 5, 8
    
    section Chat Persistence
    useChatManager hook        :p5a, 6, 8
    DB message persistence     :p5b, 7, 9
    Cross-tab sync             :p5c, 8, 9
    
    section Profile & Vault
    ProfilePanel.tsx           :p6a, 7, 9
    Connection management UI   :p6b, 7, 9
    
    section Polish
    Unified Attachments        :p7a, 8, 10
    Artifact persistence       :p7b, 8, 10
    Mobile + Theme             :p7c, 9, 10
```

---

## 13. Notification Creation — Complete User Journey (Both Modes)

```mermaid
graph TD
    START["User wants to\ncreate a notification"]
    
    START --> CHOICE{"How?"}
    
    CHOICE -->|"Type in chat"| CHAT_PATH
    CHOICE -->|"Use Tool Workbench"| TOOL_PATH
    
    subgraph "Path A: Agent-Assisted"
        CHAT_PATH["💬 Types: 'Create a notification\nthat emails the assignment group\nwhen a P1 incident is created'"]
        CHAT_PATH --> ORC["🧠 Orchestrator classifies\nas 'build' task"]
        ORC --> BLD["🔨 Builder Agent receives:\n• Focused system prompt\n• Only notification tools\n• User's request"]
        BLD --> TOOLS["Agent calls:\n1. sn_get_table_schema('incident')\n2. sn_create_notification({...})"]
        TOOLS --> VAPT_A["🛡️ VAPT evaluates"]
        VAPT_A --> RESULT_A["Chat response:\n✅ Created 'P1 Incident Alert'\n🛡️ VAPT: 92/100\n💡 Consider adding cc: managers"]
    end
    
    subgraph "Path B: Direct Tool Execution"
        TOOL_PATH["🔧 Opens Tool Workbench"]
        TOOL_PATH --> BROWSE["Browses:\n📧 Notifications & Events"]
        BROWSE --> SELECT["Clicks ▶ Run on\n'Create Notification'"]
        SELECT --> FORM["Fills form:\n• Name: P1 Incident Alert\n• Table: incident\n• Subject: P1: {number}\n• Message: {...}\n• Recipients: assignment_group\n• ☑ On Insert"]
        FORM --> EXEC["Clicks Execute"]
        EXEC --> DIRECT["Tool executes directly\n(no AI, no LLM, no tokens)"]
        DIRECT --> VAPT_B["🛡️ VAPT evaluates"]
        VAPT_B --> RESULT_B["Result card:\n✅ Created 'P1 Incident Alert'\nsys_id: abc123\n🛡️ VAPT: 92/100"]
    end
    
    RESULT_A --> SAVED["💾 Artifact saved to DB\nwith VAPT score"]
    RESULT_B --> SAVED
    
    style CHAT_PATH fill:#4ecdc4,color:#fff
    style TOOL_PATH fill:#45b7d1,color:#fff
    style VAPT_A fill:#ff6b6b,color:#fff
    style VAPT_B fill:#ff6b6b,color:#fff
    style SAVED fill:#a29bfe,color:#fff
```

---

## 14. Data Flow — Message Persistence & Multi-Tab

```mermaid
sequenceDiagram
    participant T1 as 🖥️ Tab 1
    participant T2 as 🖥️ Tab 2
    participant BC as 📡 BroadcastChannel
    participant API as 🔌 API Server
    participant DB as 💾 Supabase
    
    Note over T1,T2: Same user, two browser tabs
    
    T1->>API: POST /api/chats (create "Chat A")
    API->>DB: INSERT INTO chats
    DB-->>API: { id: "chat-a" }
    API-->>T1: Chat A created
    
    T1->>BC: broadcast("chat_created", { id: "chat-a" })
    BC-->>T2: event: chat_created
    T2->>T2: Update chat list (add "Chat A")
    
    T1->>API: POST /api/chat-stream { chatId: "chat-a", message: "..." }
    
    loop Streaming response
        API->>DB: INSERT INTO chat_messages (user msg)
        API->>API: Agent processes...
        API-->>T1: SSE: text chunk
        API-->>T1: SSE: tool_start
        API-->>T1: SSE: tool_end
        API-->>T1: SSE: text chunk
    end
    
    API->>DB: INSERT INTO chat_messages (assistant msg)
    API->>DB: UPDATE chats SET message_count++
    API-->>T1: SSE: done
    
    T1->>BC: broadcast("chat_updated", { id: "chat-a" })
    BC-->>T2: event: chat_updated
    T2->>T2: Update chat list (new message indicator)
    
    Note over T2: User switches to Chat A in Tab 2
    T2->>API: GET /api/chats/chat-a/messages
    API->>DB: SELECT FROM chat_messages WHERE chat_id = 'chat-a'
    DB-->>API: Messages array
    API-->>T2: Full message history
```

---

## 15. Auto-Generated Tool Form — Schema to UI Mapping

```mermaid
graph LR
    subgraph "Tool Input Schema (JSON)"
        S1["name: { type: 'string' }\n→ required: true"]
        S2["table: { type: 'string' }\n→ required: true"]
        S3["subject: { type: 'string' }\n→ required: true"]
        S4["messageHtml: { type: 'string' }\n→ description: 'HTML body'"]
        S5["recipients: { type: 'string' }"]
        S6["insertAction: { type: 'boolean' }"]
        S7["active: { type: 'boolean',\n  default: true }"]
    end
    
    subgraph "Generated Form UI"
        F1["🔤 Text Input\n'Name' *"]
        F2["📋 Select Dropdown\n'Table' *\n(populated from SN tables)"]
        F3["🔤 Text Input\n'Subject' *"]
        F4["📝 Textarea (rich)\n'Message HTML'"]
        F5["🔤 Text Input\n'Recipients'"]
        F6["☑️ Checkbox\n'On Insert'"]
        F7["☑️ Checkbox ✓\n'Active' (default: on)"]
    end
    
    S1 --> F1
    S2 --> F2
    S3 --> F3
    S4 --> F4
    S5 --> F5
    S6 --> F6
    S7 --> F7
    
    subgraph "Type Mapping Rules"
        R1["string → text input"]
        R2["string + enum → select"]
        R3["string (long desc) → textarea"]
        R4["boolean → checkbox"]
        R5["number → number input"]
        R6["object → nested group"]
        R7["array → repeatable fields"]
    end
```

---

*All diagrams use Mermaid syntax. View in any Mermaid-compatible renderer (GitHub, VS Code with Mermaid extension, Notion, etc.)*
