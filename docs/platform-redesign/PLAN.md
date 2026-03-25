# Plan: Platform Redesign v4 — Multi-Agent, Multi-Chat, Extensible Tool Platform

> **CRITICAL RULE:** Work on a copy `page-v2.tsx` — NO modifications to existing `page.tsx`

---

## Executive Summary

Transform SN AI Agent into a **multi-agent, multi-system, tool-centric platform** with:

1. **Agent Harness** — Orchestrator → Specialized Sub-Agents → Evaluator (VAPT) with structured handoffs
2. **Direct Tool Interaction Model** — Users can select and independently use any tool/category without needing the agent to decide
3. **Extensible System Connectors** — ServiceNow first, then JIRA, Salesforce, Workday via standardized connector interface
4. **Multi-Chat with DB Persistence** — Tabbed Notion-style chats per logged-in user
5. **Credential Vault** — Saved system connections + API keys, encrypted at rest
6. **Per-Session Artifacts** — Every created artifact saved to DB with VAPT evaluation
7. **Unified Attachments** — Any file type except executables
8. **Mandatory Login** — No anonymous access

---

## PART 1: Tool Interaction Model — How Users Select & Use Tools

### 1.1 The Two Interaction Modes

Users have **two ways** to work with tools:

#### Mode A: Agent-Assisted (Chat + AI)
User types in natural language → Agent classifies → routes to sub-agent → executes tools → returns results.
*"Create a notification that fires when a high-priority incident is assigned"*

#### Mode B: Direct Tool Invocation (Tool Panel)
User browses the Tool Workbench → selects a specific tool → fills in a structured form → executes directly.
*User clicks Notifications > Create Notification → fills form → clicks Execute*

Both modes coexist. The Tool Workbench panel serves dual purposes:
- **Configuration** (selecting which tools/agents are active for chat)
- **Direct execution** (running a tool independently, without AI)

### 1.2 Direct Tool Workflow — Notification Example

**User wants to create only a notification:**

```
Step 1: User opens Tool Workbench (🔧 in NavRail)
        ┌─ Tool Workbench ──────────────────────────┐
        │                                            │
        │ 🔍 Search tools...                         │
        │                                            │
        │ ▶ 📡 Systems                               │
        │ ▶ 📋 Records & Data                        │
        │ ▶ 💻 Server Scripts                        │
        │ ▶ 🖥️ Client Scripts & UI                   │
        │ ▶ 🔐 Security & Access                     │
        │ ▼ 📧 Notifications & Events  ←── expanded  │
        │   ├── 📋 List Notifications    [▶ Run]     │
        │   ├── ✨ Create Notification   [▶ Run]  ←  │
        │   ├── 📋 List Events           [▶ Run]     │
        │   └── ✨ Create Event          [▶ Run]     │
        │ ▶ 📦 Update Sets & Deployment              │
        │ ▶ 🔄 Flow Designer                         │
        │ ...                                        │
        └────────────────────────────────────────────┘

Step 2: User clicks [▶ Run] on "Create Notification"
        → A structured form opens (inline or drawer):

        ┌─ Create Notification ──────────────────────┐
        │                                            │
        │  Name:        [High Priority Alert       ] │
        │  Table:       [incident              ▾   ] │
        │  Subject:     [High Priority: ${number}  ] │
        │  Message:     [multiline editor...       ] │
        │  Recipients:  [itil                      ] │
        │  On Insert:   [✓]   On Update: [✓]        │
        │  Active:      [✓]                          │
        │                                            │
        │  ┌──────────┐  ┌────────────────────────┐  │
        │  │ Cancel    │  │ ▶ Execute             │  │
        │  └──────────┘  └────────────────────────┘  │
        └────────────────────────────────────────────┘

Step 3: User clicks Execute
        → Tool runs directly via API (no AI involved)
        → Result appears in chat or inline:
        
        ✅ Created notification "High Priority Alert" on incident table
        sys_id: abc123def456
        [View in ServiceNow ↗]  [Edit ✏️]  [Delete 🗑️]

Step 4: If VAPT is enabled:
        → Evaluator auto-checks the artifact
        → Result badge: 🛡️ VAPT: Passed (score: 95/100)
        → Artifact saved to session_artifacts DB
```

### 1.3 Tool Panel Anatomy

Each tool in the workbench has:

```typescript
interface ToolPanelConfig {
  // Identity
  id: string;           // 'sn_create_notification'
  name: string;         // 'Create Notification'
  description: string;  // 'Create an email notification for a table'
  
  // Categorization
  system: string;       // 'servicenow' | 'jira' | 'salesforce' | etc.
  category: string;     // 'notifications' | 'scripts' | 'flow_designer' etc.
  subcategory?: string; // 'email' | 'sms' | 'push'
  
  // Behavior
  type: 'read' | 'write';  // determines VAPT and approval requirements
  requiresApproval: boolean;  // user must confirm before execution
  
  // Form schema (generated from inputSchema)
  formFields: FormField[];
  
  // Display
  icon: string;
  tags: string[];       // ['notification', 'email', 'incident']
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'reference';
  required: boolean;
  default?: unknown;
  options?: { value: string; label: string }[];  // for select/enum
  placeholder?: string;
  description?: string;
  // For reference fields — enable table picker
  referenceTable?: string;
}
```

The form is **auto-generated from the tool's `inputSchema`**:
- `string` → text input
- `string` with `enum` → select dropdown
- `boolean` → checkbox
- `number` → number input
- `string` (long description) → textarea
- `object` → nested form group
- `array` → repeatable field group

### 1.4 Tool Results Display

Tool results render differently based on execution mode:

**Agent-Assisted:** Results embedded in chat message with agent attribution
**Direct Execution:** Results appear as a standalone card in the chat timeline

```
┌─ Tool Result ──────────────────────────────────────────┐
│ ✨ Create Notification                     ✅ Success   │
│ ──────────────────────────────────────────────────────  │
│ Name:    High Priority Alert                           │
│ Table:   incident                                      │
│ sys_id:  abc123def456                                  │
│                                                        │
│ 🛡️ VAPT: Passed (95/100)                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │
│ │View in SN│ │ Edit ✏️   │ │ Save to Artifacts 💾    │ │
│ └──────────┘ └──────────┘ └──────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## PART 2: Tool Category Hierarchy — Extensible Multi-System Design

### 2.1 Three-Level Hierarchy

```
Level 1: SYSTEM          Level 2: CATEGORY           Level 3: TOOLS
─────────────────────    ──────────────────────      ─────────────────
📡 Systems               ├─ ServiceNow               ├─ Test Connection
                         ├─ JIRA (future)             ├─ Instance Info
                         ├─ Salesforce (future)       └─ Initialize
                         └─ Workday (future)
                         
📋 Records & Data        ├─ Records CRUD              ├─ Query Records
                         ├─ Data Migration            ├─ Create Record
                         └─ Import/Export             └─ Update Record

💻 Server Scripts        ├─ Business Rules            ├─ Get Business Rules
                         ├─ Script Includes           ├─ Create Business Rule
                         └─ Fix Scripts               └─ Run Fix Script

🖥️ Client & UI           ├─ Client Scripts            ├─ Create Client Script
                         ├─ UI Policies               ├─ Create UI Policy
                         ├─ UI Actions                └─ Create UI Action
                         └─ UI Builder (future)

🔐 Security & Access     ├─ ACLs                      ├─ Get ACLs
                         ├─ Roles                     └─ Create ACL
                         └─ Scope Management

📧 Notifications         ├─ Email Notifications       ├─ Create Notification
                         └─ Events                    └─ Create Event

📦 DevOps                ├─ Update Sets               ├─ Create Update Set
                         ├─ Promotion                 ├─ Move Artifact
                         └─ Multi-Instance            └─ Compare Instances

🔄 Automation            ├─ Flow Designer             ├─ Create Flow
                         ├─ Scheduled Jobs            ├─ Get Flows
                         └─ IntegrationHub (future)   └─ Create Scheduled Job

🎨 Portal & UX           ├─ Service Portal            ├─ Get Widgets
                         ├─ Workspace (future)        ├─ Create Widget
                         └─ Now Experience (future)   └─ Create Page

🛒 Service Catalog       ├─ Catalog Items             ├─ Create Item
                         ├─ Variables                 ├─ Create Variable
                         └─ Record Producers          └─ Create Producer

📊 Analysis & Quality    ├─ Instance Analysis         ├─ Analyze Instance
                         ├─ Code Quality              ├─ Code Quality Score
                         ├─ OOTB Detection            ├─ Detect Overrides
                         └─ Dependencies              └─ Dependency Graph

🧪 Testing (ATF)         ├─ Test Suites               ├─ Create Suite
                         └─ Test Execution            └─ Run Suite

🏗️ SDD (Spec-Driven)     ├─ Full SDLC Pipeline        All tools + phase gates

📋 External Systems       ├─ JIRA                      ├─ Search Issues (JQL)
   (future)              ├─ Salesforce                ├─ Create Issue
                         ├─ Linear                    ├─ Get User Stories
                         └─ Workday                   └─ Transition Issue
```

### 2.2 System Connector Architecture (Extensible)

**New file:** `webapp/src/lib/system-connectors.ts`

```typescript
/**
 * System Connector Interface — extensible adapter pattern.
 * Each system (ServiceNow, JIRA, Salesforce, etc.) implements this interface.
 * The Tool Workbench renders tools from ALL active connectors uniformly.
 */

interface SystemConnector {
  /** Unique system identifier */
  id: string;                        // 'servicenow', 'jira', 'salesforce'
  
  /** Display info */
  name: string;                      // 'ServiceNow', 'JIRA', 'Salesforce'
  icon: string;                      // SVG or icon name
  color: string;                     // Brand color
  
  /** Connection config */
  authTypes: AuthType[];             // supported auth methods
  connectionSchema: FormField[];     // fields needed to connect
  
  /** Tool catalog */
  getToolCategories(): ToolCategory[];
  getTools(): ToolDefinition[];
  
  /** Execution */
  executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    credentials: SystemCredentials
  ): Promise<ToolResult>;
  
  /** Health check */
  testConnection(credentials: SystemCredentials): Promise<ConnectionResult>;
}

interface ToolCategory {
  id: string;
  system: string;
  name: string;
  description: string;
  icon: string;
  tools: string[];      // tool IDs in this category
  subcategories?: ToolCategory[];
}

interface SystemCredentials {
  systemId: string;
  instanceUrl?: string;
  authType: string;
  // ... encrypted credential fields resolved from vault
}
```

**Phase 1 implementation:** Only `ServiceNowConnector` (wraps existing `mcp-servicenow` tools)
**Future:** `JIRAConnector`, `SalesforceConnector`, etc. — each implements the same interface

### 2.3 ServiceNow Connector — Tool Category Mapping

**New file:** `webapp/src/lib/tool-categories.ts`

Maps all 147 existing tools into the hierarchy:

```typescript
const SN_TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'sn_connection',
    system: 'servicenow',
    name: 'Connection & Instance',
    icon: '📡',
    tools: ['sn_test_connection', 'sn_get_instance_info', 'sn_initialize_instance', 
            'sn_get_tables', 'sn_get_table_schema'],
  },
  {
    id: 'sn_records',
    system: 'servicenow',
    name: 'Records & Data',
    icon: '📋',
    tools: ['sn_query_records', 'sn_get_record', 'sn_create_record', 'sn_update_record'],
    subcategories: [
      {
        id: 'sn_data_migration',
        system: 'servicenow',
        name: 'Data Migration',
        icon: '📤',
        tools: ['sn_create_import_set', 'sn_run_transform', 'sn_export_records'], // future
      }
    ]
  },
  {
    id: 'sn_server_scripts',
    system: 'servicenow',
    name: 'Server Scripts',
    icon: '💻',
    tools: ['sn_get_business_rules', 'sn_create_business_rule',
            'sn_get_script_includes', 'sn_create_script_include',
            'sn_get_fix_scripts', 'sn_create_fix_script', 'sn_run_fix_script',
            'sn_get_scheduled_jobs', 'sn_create_scheduled_job'],
  },
  {
    id: 'sn_client_ui',
    system: 'servicenow',
    name: 'Client Scripts & UI',
    icon: '🖥️',
    tools: ['sn_get_client_scripts', 'sn_create_client_script',
            'sn_get_ui_policies', 'sn_create_ui_policy',
            'sn_get_ui_policy_actions', 'sn_create_ui_policy_action',
            'sn_get_ui_actions', 'sn_create_ui_action'],
    subcategories: [
      { id: 'sn_ui_builder', system: 'servicenow', name: 'UI Builder', icon: '🎨',
        tools: [] // future: Now Experience UX page tools
      }
    ]
  },
  {
    id: 'sn_notifications',
    system: 'servicenow',
    name: 'Notifications & Events',
    icon: '📧',
    tools: ['sn_get_notifications', 'sn_create_notification',
            'sn_get_events', 'sn_create_event'],
  },
  {
    id: 'sn_security',
    system: 'servicenow',
    name: 'Security & Access',
    icon: '🔐',
    tools: ['sn_get_acls', 'sn_create_acl', 'sn_get_roles', 'sn_create_role',
            'sn_set_scope', 'sn_verify_scope'],
  },
  {
    id: 'sn_update_sets',
    system: 'servicenow',
    name: 'Update Sets & Deployment',
    icon: '📦',
    tools: ['sn_list_update_sets', 'sn_get_update_set', 'sn_create_update_set',
            'sn_set_current_update_set', 'sn_complete_update_set',
            'sn_get_update_set_contents', 'sn_move_to_update_set',
            'sn_verify_update_set_capture'],
    subcategories: [
      { id: 'sn_promotion', system: 'servicenow', name: 'Promotion', icon: '🚀',
        tools: ['sn_create_promotion_package', 'sn_preview_promotion',
                'sn_validate_promotion', 'sn_execute_promotion',
                'sn_rollback_promotion', 'sn_list_promotion_history'] },
      { id: 'sn_multi_instance', system: 'servicenow', name: 'Multi-Instance', icon: '🔗',
        tools: ['sn_register_instance', 'sn_switch_instance', 'sn_compare_instances'] },
    ]
  },
  {
    id: 'sn_flow_designer',
    system: 'servicenow',
    name: 'Flow Designer & Automation',
    icon: '🔄',
    tools: [/* all FLOW_DESIGNER_TOOLS names */],
  },
  {
    id: 'sn_service_portal',
    system: 'servicenow',
    name: 'Service Portal',
    icon: '🎨',
    tools: [/* all SERVICE_PORTAL_TOOLS names */],
    subcategories: [
      { id: 'sn_workspace', system: 'servicenow', name: 'Workspace', icon: '🪟',
        tools: [] // future: workspace/Now Experience tools
      },
    ]
  },
  {
    id: 'sn_catalog',
    system: 'servicenow',
    name: 'Service Catalog',
    icon: '🛒',
    tools: [/* all CATALOG_TOOLS + ADDITIONAL catalog tools */],
  },
  {
    id: 'sn_analysis',
    system: 'servicenow',
    name: 'Analysis & Quality',
    icon: '📊',
    tools: [/* instance-analyzer, ootb-override, code-quality, anti-pattern, 
              dead-code, dependency-graph, guardrail, 4g-framework, persona */],
  },
  {
    id: 'sn_testing',
    system: 'servicenow',
    name: 'Testing (ATF)',
    icon: '🧪',
    tools: ['sn_enable_atf_property', 'sn_create_atf_suite', 
            'sn_run_atf_suite', 'sn_get_atf_results'],
  },
];
```

### 2.4 External System Categories (Future — Design Now, Build Later)

```typescript
// JIRA Connector (future Phase N)
const JIRA_CATEGORIES: ToolCategory[] = [
  {
    id: 'jira_issues',
    system: 'jira',
    name: 'Issues & Stories',
    icon: '🎫',
    tools: ['jira_search_issues', 'jira_get_issue', 'jira_create_issue',
            'jira_update_issue', 'jira_transition_issue', 'jira_add_comment'],
  },
  {
    id: 'jira_boards',
    system: 'jira',
    name: 'Boards & Sprints',
    icon: '📊',
    tools: ['jira_get_boards', 'jira_get_sprints', 'jira_get_backlog'],
  },
];

// Salesforce Connector (future Phase N)
const SFDC_CATEGORIES: ToolCategory[] = [
  {
    id: 'sfdc_objects',
    system: 'salesforce',
    name: 'Objects & Records',
    icon: '☁️',
    tools: ['sfdc_query', 'sfdc_create_record', 'sfdc_update_record'],
  },
];
```

**The UI renders ALL active system connectors uniformly.** Adding a new system = implementing `SystemConnector` interface + adding tool definitions. No UI changes needed.

### 2.5 "Systems" as a First-Class Category

In the Tool Workbench, the top-level view is:

```
┌─ Tool Workbench ─────────────────────────────────────┐
│                                                      │
│ 🔍 Search tools...                                   │
│                                                      │
│ ▼ 📡 SYSTEMS                                         │
│   ├── 🟢 ServiceNow (dev300943)    [Connected ✓]     │
│   ├── ⚫ JIRA                       [Not configured]  │
│   ├── ⚫ Salesforce                  [Coming soon]    │
│   └── ⚫ Linear                     [Coming soon]    │
│                                                      │
│ ▼ 📋 RECORDS & DATA                                  │
│   ├── Records CRUD                   [4 tools]       │
│   └── Data Migration                 [3 tools] 🔜    │
│                                                      │
│ ▼ 💻 SERVER SCRIPTS                                  │
│   ├── Business Rules                 [2 tools]       │
│   ├── Script Includes                [2 tools]       │
│   ├── Fix Scripts                    [3 tools]       │
│   └── Scheduled Jobs                 [2 tools]       │
│                                                      │
│ ▼ 🖥️ CLIENT & UI                                     │
│   ├── Client Scripts                 [2 tools]       │
│   ├── UI Policies                    [4 tools]       │
│   ├── UI Actions                     [2 tools]       │
│   └── 🔜 UI Builder                 [coming soon]    │
│                                                      │
│ ▼ 📧 NOTIFICATIONS & EVENTS                         │
│   ├── Create Notification            [▶ Run]         │
│   ├── List Notifications             [▶ Run]         │
│   ├── Create Event                   [▶ Run]         │
│   └── List Events                    [▶ Run]         │
│                                                      │
│ ▼ 🔄 FLOW DESIGNER & AUTOMATION                     │
│   ├── Flows                          [8 tools]       │
│   ├── Scheduled Jobs                 [2 tools]       │
│   └── 🔜 IntegrationHub             [coming soon]    │
│                                                      │
│ ▼ 🎨 PORTAL & UX                                    │
│   ├── Service Portal                 [14 tools]      │
│   ├── 🔜 Workspace                   [coming soon]    │
│   └── 🔜 Now Experience             [coming soon]    │
│                                                      │
│ ▼ 🛒 SERVICE CATALOG                                │
│   ├── Catalog Items                  [6 tools]       │
│   ├── Variables & Categories         [3 tools]       │
│   └── Record Producers               [1 tool]        │
│                                                      │
│ ▼ 📊 ANALYSIS & QUALITY                             │
│   ├── Instance Analysis              [3 tools]       │
│   ├── Code Quality                   [4 tools]       │
│   ├── OOTB Detection                 [2 tools]       │
│   └── Dependencies & Impact          [4 tools]       │
│                                                      │
│ ▼ 🧪 TESTING (ATF)                                  │
│   └── ATF Suites                     [4 tools]       │
│                                                      │
│ ▶ 🏗️ SDD (Spec-Driven Development)   [Full SDLC]    │
│                                                      │
│ ▼ 📋 EXTERNAL SYSTEMS (future)                      │
│   ├── 🔜 JIRA (user stories, issues)                 │
│   ├── 🔜 ServiceNow Agile (stories)                  │
│   └── 🔜 Linear (issues)                            │
└──────────────────────────────────────────────────────┘
```

---

## PART 3: Direct Tool Execution API

### 3.1 New API Route

**New file:** `/api/tools/execute/route.ts`

```typescript
// POST /api/tools/execute
// Direct tool execution (no AI agent, no LLM call)
interface DirectToolRequest {
  chatId: string;           // which chat to log result in
  toolName: string;         // 'sn_create_notification'
  args: Record<string, unknown>;
  instanceId?: string;      // which saved instance to use (default: chat's instance)
  evaluate?: boolean;       // run VAPT evaluator? (default: true for writes)
}

interface DirectToolResponse {
  success: boolean;
  result: unknown;
  evaluation?: VAPTResult;
  artifact?: { id: string; type: string; name: string; sysId: string };
  error?: string;
}
```

**Flow:**
1. Validate session (mandatory login)
2. Resolve credentials from vault (instanceId → decrypted creds)
3. Create ServiceNowClient
4. Execute tool directly via `executeToolCall()` from tool-registry
5. If write tool + evaluate=true → run guardrail validator
6. Save artifact to `session_artifacts` table
7. Save tool result as a system message in `chat_messages`
8. Return result

### 3.2 Tool Form Generator

**New file:** `webapp/src/lib/tool-form-generator.ts`

Auto-generates form configuration from tool `inputSchema`:

```typescript
function generateFormFields(inputSchema: ToolInputSchema): FormField[] {
  const fields: FormField[] = [];
  
  for (const [name, prop] of Object.entries(inputSchema.properties)) {
    fields.push({
      name,
      label: humanize(name),           // 'messageHtml' → 'Message HTML'
      type: inferFieldType(prop),       // string→text, boolean→checkbox, enum→select
      required: inputSchema.required?.includes(name) ?? false,
      default: prop.default,
      options: prop.enum?.map(v => ({ value: v, label: humanize(v) })),
      placeholder: prop.description,
      description: prop.description,
    });
  }
  
  return fields;
}
```

### 3.3 Tool Execution Panel Component

**New file:** `webapp/src/components/ToolExecutionPanel.tsx`

Renders the form for a selected tool and handles execution:

```
┌─ Create Notification ──── ServiceNow (dev300943) ─────┐
│                                                        │
│  Tool: sn_create_notification                          │
│  Category: Notifications & Events                      │
│  Type: Write operation  🛡️ VAPT will auto-evaluate     │
│                                                        │
│  ──────────────────────────────────────────────────     │
│                                                        │
│  Name *            [                              ]    │
│  Table *           [incident                    ▾ ]    │
│  Subject *         [                              ]    │
│  Message HTML *    [                              ]    │
│                    [                              ]    │
│  Recipients        [                              ]    │
│  ☑ Insert Action   ☑ Update Action                     │
│  ☑ Active                                              │
│                                                        │
│  ┌────────┐  ┌──────────────────────────────────────┐  │
│  │ Cancel │  │  ▶ Execute                           │  │
│  └────────┘  └──────────────────────────────────────┘  │
│                                                        │
│  💡 Or describe what you need in chat and the AI       │
│     agent will handle it for you.                      │
└────────────────────────────────────────────────────────┘
```

---

## PART 4: Agent Harness Architecture

*(Carried from v3 plan — key parts)*

### 4.1 Eight Defined Agents

| Agent | ID | Default Model | Tool Categories | Auto-VAPT |
|-------|----|--------------|----------------|-----------|
| 🧠 Orchestrator | `orchestrator` | haiku | None (routes) | N/A |
| 🔍 Explorer | `explorer` | sonnet | Connection, Records(read), Analysis | No |
| 🔨 Builder | `builder` | sonnet | Scripts, UI, Notifications, ACLs, Catalog, Portal | Yes |
| 🏗️ SDD | `sdd` | sonnet/opus | All 147 + phase gates | Yes |
| 📊 Analyzer | `analyzer` | sonnet | Quality, Anti-Patterns, OOTB, Dependencies | No |
| 🔄 Operator | `operator` | sonnet | Update Sets, Promotion, Multi-Instance, ATF | Yes |
| 🌊 Flow Architect | `flow_architect` | sonnet | Flow Designer, Scheduled Jobs, Events | Yes |
| 🛡️ Evaluator | `evaluator` | haiku | Guardrails, Code Quality, ACLs | N/A |

### 4.2 Orchestrator Classification + Structured Handoffs

*(Same as v3 — Anthropic three-agent pattern)*

### 4.3 VAPT Auto-Enforcement

*(Same as v3)*

---

## PART 5: Database Layer

*(Same as v3 — chats, messages, artifacts, credential vault, API keys)*

**Addition:** `system_connectors` config table for future multi-system:

```sql
-- Migration 024: system connector config
CREATE TABLE user_system_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  system_type     text NOT NULL,         -- 'servicenow', 'jira', 'salesforce'
  label           text NOT NULL,
  config          jsonb NOT NULL,        -- system-specific config (URLs, etc.)
  credentials_enc jsonb NOT NULL,        -- encrypted credentials  
  is_default      boolean DEFAULT false,
  last_connected  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sys_conn_user ON user_system_connections(user_id, system_type);
```

This **replaces** the earlier `user_saved_instances` design — it's now generic to support any system, not just ServiceNow.

---

## PART 6: UI Redesign

*(Same as v3 — NavRail, ChatTabBar, DrawerOverlay, ChatListPanel, ProfilePanel)*

**Addition to NavRail:**

```
┌────┐
│ 💬 │  Chat List
│ 🔧 │  Tool Workbench  ← opens the full tool panel described in Part 2
│ 🤖 │  Agent Config     ← agent selection & model config
│ ⚙  │  Settings
│ 👤 │  Profile / Vault  ← saved connections + API keys
│    │
│ 🌙 │  Theme
│ SN │  Logo
└────┘
```

---

## PART 7: Unified Attachments + File Parser

*(Same as v3 — single button, any file type except executables)*

---

## PART 8: Mandatory Login

*(Same as v3)*

---

## Implementation Phases (Updated)

### Phase 1: Foundation
- [ ] Copy `page.tsx` → `page-v2.tsx` 
- [ ] Migrations 021-024 (chats, messages, artifacts, system connections, API keys)
- [ ] `crypto-vault.ts` encryption
- [ ] `system-connectors.ts` interface + `ServiceNowConnector` implementation
- [ ] `tool-categories.ts` — full 147-tool category mapping
- [ ] API routes: `/api/chats/*`, `/api/user/connections/*`, `/api/user/api-keys/*`

### Phase 2: Agent Harness
- [ ] `agent-definitions.ts` — 8 agents
- [ ] `agent-orchestrator.ts` — classify, route, handoff, evaluate
- [ ] Per-agent focused system prompts
- [ ] VAPT auto-enforcement
- [ ] Modify `sn-engine.ts` for multi-agent mode

### Phase 3: Tool Workbench + Direct Execution
- [ ] `ToolWorkbench.tsx` — category tree with [▶ Run] buttons
- [ ] `ToolExecutionPanel.tsx` — auto-generated form + execute
- [ ] `tool-form-generator.ts` — schema → form field conversion
- [ ] `/api/tools/execute/route.ts` — direct tool execution API
- [ ] Tool result cards in chat

### Phase 4: UI Shell
- [ ] `NavRail.tsx`, `DrawerOverlay.tsx`
- [ ] `ChatTabBar.tsx`, `ChatListPanel.tsx`
- [ ] Refactor `page-v2.tsx` layout
- [ ] `AgentSelector.tsx`

### Phase 5: Chat Persistence + Multi-Tab
- [ ] `useChatManager.ts` hook
- [ ] DB-backed messages, cross-tab sync
- [ ] Per-chat instance connection

### Phase 6: Profile & Vault
- [ ] `ProfilePanel.tsx`
- [ ] System connection management (generic for any connector)
- [ ] API key management

### Phase 7: Attachments + File Parser
- [ ] Expand file types, block executables
- [ ] Single attachment button

### Phase 8: Artifacts + Polish
- [ ] Artifact persistence from tool results
- [ ] VAPT badges in chat
- [ ] Mobile responsive
- [ ] Dark/light theme

### Phase 9 (Future): External Systems
- [ ] JIRA connector (via official MCP server)
- [ ] ServiceNow Agile tools
- [ ] Linear connector
- [ ] Salesforce connector

---

## Files Summary

### New Files (32)
| File | Phase |
|------|-------|
| `page-v2.tsx` | 1 |
| `021_chats_and_messages.sql` | 1 |
| `022_session_artifacts.sql` | 1 |
| `023_credential_vault.sql` | 1 |
| `024_system_connections.sql` | 1 |
| `crypto-vault.ts` | 1 |
| `system-connectors.ts` | 1 |
| `tool-categories.ts` | 1 |
| `/api/chats/route.ts` | 1 |
| `/api/chats/[id]/route.ts` | 1 |
| `/api/chats/[id]/messages/route.ts` | 1 |
| `/api/user/connections/route.ts` | 1 |
| `/api/user/connections/[id]/route.ts` | 1 |
| `/api/user/api-keys/route.ts` | 1 |
| `/api/user/api-keys/[id]/route.ts` | 1 |
| `agent-definitions.ts` | 2 |
| `agent-orchestrator.ts` | 2 |
| `ToolWorkbench.tsx` | 3 |
| `ToolExecutionPanel.tsx` | 3 |
| `tool-form-generator.ts` | 3 |
| `/api/tools/execute/route.ts` | 3 |
| `NavRail.tsx` | 4 |
| `DrawerOverlay.tsx` | 4 |
| `ChatTabBar.tsx` | 4 |
| `ChatListPanel.tsx` | 4 |
| `AgentSelector.tsx` | 4 |
| `useChatManager.ts` | 5 |
| `useAgentConfig.ts` | 5 |
| `ProfilePanel.tsx` | 6 |

### Modified Files (8)
| File | Phase |
|------|-------|
| `sn-engine.ts` | 2 |
| `chat-stream/route.ts` | 5 |
| `file-parser.ts` | 7 |
| `ChatWindow.tsx` | 3,4,7 |
| `globals.css` | 3-6 |
| `types.ts` | 1-5 |
| `tool-definitions.ts` | 1 (add category metadata) |
| `key-resolver.ts` | 5 |

### UNTOUCHED
| File | Reason |
|------|--------|
| **`page.tsx`** | **DO NOT MODIFY** |

---

## Multi-Agent Plan Review

### 🔧 Tool Architect Review
- Direct tool execution is a key differentiator — users aren't forced through AI for simple tasks
- Auto-generated forms from `inputSchema` eliminate manual form maintenance
- System connector interface is clean — new systems are pluggable
- ⚠️ Need: table/reference field pickers for form fields (autocomplete from SN schema)

### 🏗️ System Design Review
- Connector pattern follows MCP standard — future JIRA/Salesforce integration is trivial
- Official Atlassian MCP server already exists with 46+ tools — just needs adapter
- `user_system_connections` generic table is better than `user_saved_instances`
- ⚠️ Need: connection health monitoring (periodic ping)

### 🎨 UX Review  
- Tool Workbench dual-purpose (configure + execute) reduces cognitive load
- [▶ Run] buttons give immediate access — no "how do I use this?" friction
- System badges (🟢 Connected, ⚫ Not configured) give clear status
- "Coming soon" markers set expectations for future systems
- ⚠️ Need: recently used tools section, favorites/pinning

### 🔒 Security Review
- Direct tool execution still goes through auth + credential resolution
- VAPT runs on direct executions too (not just agent-assisted)
- Generic credential vault supports any system's auth pattern
- ⚠️ Need: audit log for all direct tool executions

### 📋 Product Review
- "Systems" category makes the platform feel extensible, not ServiceNow-locked
- Tool workbench satisfies power users (direct) AND beginners (agent-assisted)
- Each category is also a learning path — browse tools to learn what's possible
- ⚠️ Need: tool documentation/help tooltips in the form view
