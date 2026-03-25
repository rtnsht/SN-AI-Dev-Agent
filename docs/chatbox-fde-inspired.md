# Chat Box UI — Palantir FDE-Inspired Design

> **Design DNA sourced from Palantir FDE + Blueprint Design System.**
> Every element below maps to a documented FDE pattern.

---

## Palantir FDE Design Elements Captured

| FDE Element | FDE Behavior | Our Adaptation |
|-------------|-------------|----------------|
| **Context ribbon** | Above input — add resources (object types, datasets, branches, functions) as chips | Above input — add SN resources (tables, update sets, scoped apps) as context chips |
| **Tool menu** | Below input — checkboxes to enable/disable tools | Below input — collapsible tool panel with category groups |
| **Chat outline** | Right panel — prompt history, tools used, token counts per message | Right panel — session outline with tool log, artifacts, token usage |
| **Modes** | Top selector — Platform Q&A, Exploration, Functions, Ontology, Data Integration | Top selector — Explore, Build, SDD, Analyze, Operate, Flow |
| **Skills** | Granular capabilities within modes | Agent specialization within modes |
| **Tool approval** | Required for side effects; configurable auto-approve per branch/project | Required for write ops; configurable auto-approve per category |
| **Session management** | Top toolbar — create/manage sessions | Tab bar — create/manage/switch chats |
| **Token display** | Per-message token count in outline | Per-message token count in outline |
| **Summarize/remove** | Context window management — summarize or remove old messages | Same — summarize or prune messages from outline |
| **Blueprint dark theme** | `$dark-gray2` bg, 2px radius, 4px grid, white borders on cards | Matching: #0B0D12 bg, 2-4px radius, 4px grid, subtle borders |
| **Resource chips** | Colored pills above input showing attached context (datasets, objects) | Colored chips showing attached context (tables, instances, files) |
| **Collapsible panels** | Right outline, tool menu expand/collapse | Right outline, tool menu, VAPT results all collapsible |

---

## THE CHATBOX — Palantir FDE Layout Applied

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                      ║
║ ┌─ TOP TOOLBAR (FDE: session management) ──────────────────────────────────────────┐ ║
║ │                                                                                  │ ║
║ │  ┌──────────────────┐┌──────────────┐┌──────────────┐                            │ ║
║ │  │ ● Incident Setup ││ Code Review  ││ + New Session │        🟢 dev300943       │ ║
║ │  └──────────────────┘└──────────────┘└──────────────┘                            │ ║
║ │                                                                                  │ ║
║ └──────────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                      ║
║ ┌─ MODE SELECTOR (FDE: modes at top) ──────────────────────────────────────────────┐ ║
║ │                                                                                  │ ║
║ │  ┌─────────────┐┌─────────────┐┌──────────┐┌─────────────┐┌────────┐┌─────────┐│ ║
║ │  │ 🔍 Explore  ││ 🔨 Build    ││ 🏗️ SDD  ▾││ 📊 Analyze  ││🔄 Ops  ││🌊 Flow  ││ ║
║ │  └─────────────┘└──────●──────┘└──────────┘└─────────────┘└────────┘└─────────┘│ ║
║ │                   selected                                                       │ ║
║ └──────────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                      ║
║ ┌─ MAIN AREA ─────────────────────────────────────────────────┐┌─ CHAT OUTLINE ────┐ ║
║ │                                                             ││ (FDE: right panel  │ ║
║ │                                                             ││  collapsible)      │ ║
║ │                     ┌─────────────────────────────────────┐ ││                    │ ║
║ │                     │ Create a notification that emails   │ ││ SESSION OUTLINE    │ ║
║ │                     │ the assignment group when a P1      │ ││                    │ ║
║ │                     │ incident is created.                │ ││ ▼ Prompt 1    124t │ ║
║ │                     └─────────────────────────────────────┘ ││   Response    892t │ ║
║ │                                                             ││   🔧 3 tools      │ ║
║ │  ┌─────────────────────────────────────────────────────┐    ││                    │ ║
║ │  │                                                     │    ││ ▼ Prompt 2     56t │ ║
║ │  │  🔨 Builder                                         │    ││   Response    634t │ ║
║ │  │                                                     │    ││   🔧 2 tools      │ ║
║ │  │  I'll create that notification. First, let me       │    ││   📜 1 artifact   │ ║
║ │  │  check what's currently on the incident table.      │    ││                    │ ║
║ │  │                                                     │    ││ ──────────────     │ ║
║ │  │  ┌─ Tool Execution ──────────────────────────────┐  │    ││                    │ ║
║ │  │  │                                               │  │    ││ ARTIFACTS          │ ║
║ │  │  │  ✓ sn_get_table_schema(incident)      0.8s   │  │    ││                    │ ║
║ │  │  │  ✓ sn_get_notifications(incident)     1.2s   │  │    ││ 📜 BR: Validate..  │ ║
║ │  │  │  ✓ sn_create_notification(...)        2.1s   │  │    ││    🛡️ 97/100       │ ║
║ │  │  │                                               │  │    ││                    │ ║
║ │  │  └───────────────────────────────────────────────┘  │    ││ 🎨 UP: ShowJust..  │ ║
║ │  │                                                     │    ││    🛡️ 96/100       │ ║
║ │  │  Created **P1 Incident Assignment Alert**           │    ││                    │ ║
║ │  │                                                     │    ││ ──────────────     │ ║
║ │  │  ┌─ Artifact ────────────────────────────────────┐  │    ││                    │ ║
║ │  │  │  📧 Notification                              │  │    ││ TOKEN USAGE        │ ║
║ │  │  │  P1 Incident Assignment Alert                 │  │    ││                    │ ║
║ │  │  │  Table: incident · On insert                  │  │    ││ In:    3,842       │ ║
║ │  │  │  Recipients: assignment_group                 │  │    ││ Out:   1,256       │ ║
║ │  │  │                                               │  │    ││ Cache: 89% hit     │ ║
║ │  │  │  🛡️ VAPT 95/100 ────────── ✅ Passed          │  │    ││ Total: 5,098       │ ║
║ │  │  │  ✅ Recipients configured                     │  │    ││                    │ ║
║ │  │  │  ✅ Subject uses variables                    │  │    ││ ──────────────     │ ║
║ │  │  │  💡 Consider: unsubscribe mechanism           │  │    ││                    │ ║
║ │  │  │                                               │  │    ││ [Summarize old]    │ ║
║ │  │  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │  │    ││ [Clear context]    │ ║
║ │  │  │  │View ↗   │ │Show Code │ │💾 Saved       │   │  │    ││                    │ ║
║ │  │  │  └─────────┘ └──────────┘ └──────────────┘   │  │    ││                    │ ║
║ │  │  └───────────────────────────────────────────────┘  │    ││                    │ ║
║ │  │                                                     │    ││                    │ ║
║ │  │  Would you like me to also create a UI policy       │    ││                    │ ║
║ │  │  to highlight the notification recipients field?     │    ││                    │ ║
║ │  │                                                     │    ││                    │ ║
║ │  │  ┌──────────────────┐ ┌───────────────────────┐     │    ││                    │ ║
║ │  │  │ Yes, create it   │ │ No, this is enough    │     │    ││                    │ ║
║ │  │  └──────────────────┘ └───────────────────────┘     │    ││                    │ ║
║ │  │                                                     │    ││                    │ ║
║ │  └─────────────────────────────────────────────────────┘    ││                    │ ║
║ │                                                             ││                    │ ║
║ ├─ CONTEXT RIBBON (FDE: resource chips above input) ──────────┤│                    │ ║
║ │                                                             ││                    │ ║
║ │  ┌────────────┐ ┌────────────────┐ ┌──────────────────────┐ ││                    │ ║
║ │  │📋 incident │ │📦 REQ-005-Impl │ │📎 requirements.pdf  ×│ ││                    │ ║
║ │  └────────────┘ └────────────────┘ └──────────────────────┘ ││                    │ ║
║ │                                                      [+ Add]││                    │ ║
║ │                                                             ││                    │ ║
║ ├─ INPUT FIELD (FDE: bottom of page) ─────────────────────────┤│                    │ ║
║ │                                                             ││                    │ ║
║ │  ┌───────────────────────────────────────────────────────┐  ││                    │ ║
║ │  │                                                       │  ││                    │ ║
║ │  │  What should we work on next?                         │  ││                    │ ║
║ │  │                                                       │  ││                    │ ║
║ │  └───────────────────────────────────────────────────────┘  ││                    │ ║
║ │                                                             ││                    │ ║
║ │  📎 Attach   ✨ AI                          🎤    ▶ Send   ││                    │ ║
║ │                                                             ││                    │ ║
║ ├─ TOOL MENU (FDE: below input, collapsible) ─────────────────┤│                    │ ║
║ │                                                             ││                    │ ║
║ │  🔨 Build Mode · 40 tools enabled                    [▾]   ││                    │ ║
║ │                                                             ││                    │ ║
║ │  ☑ Server Scripts (9)  ☑ Client & UI (10)  ☑ Notif (4)     ││                    │ ║
║ │  ☑ Security (6)  ☑ Catalog (12)  ☐ Analysis (16)           ││                    │ ║
║ │  ☑ Update Sets (14)  ☑ Portal (14)  🔧 Tool Approval: On   ││                    │ ║
║ │                                                             ││                    │ ║
║ └─────────────────────────────────────────────────────────────┘└────────────────────┘ ║
║                                                                                      ║
║  This is Agentic AI and can make mistakes. Please double-check responses.            ║
║                                                                                      ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

---

## DESIGN ELEMENT MAPPING: FDE → Our Implementation

### 1. TOP TOOLBAR → Session/Tab Bar

**FDE:** Top toolbar for creating/managing sessions
**Ours:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────┐┌──────────────┐┌──────────────┐                    │
│  │ ● Incident Setup ││ Code Review  ││ + New Session │    🟢 dev300943   │
│  └──────────────────┘└──────────────┘└──────────────┘                    │
└──────────────────────────────────────────────────────────────────────────┘

• Tabs = FDE sessions (each is a persistent conversation)
• Active tab has filled dot ●
• "+ New Session" creates new chat
• Instance badge right-aligned (which system you're connected to)
• Tab close button on hover (×)
```

### 2. MODE SELECTOR → Mode Bar

**FDE:** Modes like Platform Q&A, Exploration, Functions, Ontology, Data Integration
**Ours:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐        │
│  │🔍 Explore│ │🔨 Build ●│ │🏗️ SDD ▾ │ │📊 Analyze│ │🔄 Ops  │        │
│  └──────────┘ └──────────┘ └─────────┘ └──────────┘ └────────┘        │
│                                                                          │
│  ▾ on SDD = has sub-config (like FDE's Data Integration mode which      │
│    lets you pick Python transforms vs Pipeline Builder)                   │
│                                                                          │
│  Selecting a mode:                                                       │
│  • Changes which agent handles your messages                             │
│  • Changes which tools are enabled (shown in tool menu below)            │
│  • Changes the system prompt focus                                       │
│  • SDD mode activates phase gate pipeline                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3. CONTEXT RIBBON → Resource Chips Above Input

**FDE:** Ribbon above prompt for adding object types, datasets, branches, functions
**Ours:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌────────────┐ ┌────────────────┐ ┌──────────────────┐                 │
│  │📋 incident │ │📦 REQ-005-Impl │ │📎 spec.pdf      ×│     [+ Add]    │
│  └────────────┘ └────────────────┘ └──────────────────┘                 │
│                                                                          │
│  Chip types (color-coded, like FDE resource types):                      │
│                                                                          │
│  📋 Table context    — blue chip   — "incident", "change_request"        │
│  📦 Update Set       — green chip  — current active update set           │
│  🔒 Scope            — purple chip — "Global", "x_app_custom"            │
│  📎 File attachment  — gray chip   — uploaded docs, images, code         │
│  🔗 Reference        — teal chip   — linked SN record (sys_id)          │
│  📋 External         — orange chip — JIRA issue, Linear ticket (future) │
│                                                                          │
│  Click "+ Add" opens picker:                                             │
│  ┌──────────────────────────────────┐                                    │
│  │ Add Context                      │                                    │
│  │ ────────────────────────────     │                                    │
│  │ 📋 Select table...              │                                    │
│  │ 📦 Select update set...          │                                    │
│  │ 🔒 Select scope...              │                                    │
│  │ 📎 Upload file...                │                                    │
│  │ 🔗 Link SN record...            │                                    │
│  └──────────────────────────────────┘                                    │
│                                                                          │
│  × on chips = remove from context                                        │
│  These chips are sent as structured context with the next message        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4. TOOL MENU → Below Input, Collapsible

**FDE:** Tool menu below input — checkboxes to enable/disable tools, approval config
**Ours:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  🔨 Build Mode · 40 of 147 tools enabled                         [▾▴]  │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  (collapsed = one-line summary above)                                    │
│  (expanded = category checkboxes below)                                  │
│                                                                          │
│  ┌── Tool Categories ───────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  ☑ 💻 Server Scripts         9 tools     [▶ Run tools...]       │   │
│  │  ☑ 🖥️ Client & UI           10 tools     [▶ Run tools...]       │   │
│  │  ☑ 📧 Notifications          4 tools     [▶ Run tools...]       │   │
│  │  ☑ 🔐 Security               6 tools     [▶ Run tools...]       │   │
│  │  ☑ 🛒 Service Catalog       12 tools     [▶ Run tools...]       │   │
│  │  ☑ 📦 Update Sets           14 tools     [▶ Run tools...]       │   │
│  │  ☑ 🎨 Portal                14 tools     [▶ Run tools...]       │   │
│  │  ☐ 📊 Analysis              16 tools  (disabled in Build mode)  │   │
│  │  ☐ 🧪 Testing                4 tools  (disabled in Build mode)  │   │
│  │                                                                  │   │
│  │  ── Approval Settings ──────────────────────────────────────     │   │
│  │  ☑ Require approval for write operations                        │   │
│  │  ☐ Auto-approve on allowlisted update sets                      │   │
│  │  ☑ 🛡️ VAPT auto-evaluation                                      │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  "▶ Run tools..." opens the direct execution panel for that category    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5. CHAT OUTLINE → Right Panel, Collapsible

**FDE:** Collapsible right panel — prompt/response history, tools used, token counts
**Ours:**
```
┌─────────────────────────┐
│ SESSION OUTLINE      [×]│    ← collapsible (FDE pattern)
│                         │
│ ▼ Prompt 1        124 t │    ← token count per message (FDE pattern)
│   ┌───────────────────┐ │
│   │ "Create a notif..."│ │    ← message preview
│   └───────────────────┘ │
│   Response          892t│
│   🔧 Tools used:        │    ← tool log (FDE pattern)
│     ✓ get_table_schema  │
│     ✓ get_notifications │
│     ✓ create_notif      │
│   📜 Artifact: P1 Alert │    ← artifact created
│      🛡️ VAPT: 95/100    │
│                         │
│ ▼ Prompt 2          56t │
│   Response          634t│
│   🔧 Tools: 2           │
│   📜 Artifact: UI Policy│
│      🛡️ VAPT: 96/100    │
│                         │
│ ─────────────────────── │
│                         │
│ ARTIFACTS (this session)│    ← artifact index
│ ┌───────────────────────┤
│ │ 📜 BR: ValidateHigh   │
│ │ 🎨 UP: ShowJustific   │
│ │ 📧 NF: P1 Alert       │
│ └───────────────────────┤
│                         │
│ ─────────────────────── │
│                         │
│ TOKEN USAGE             │    ← token tracking (FDE pattern)
│ Input:      3,842       │
│ Output:     1,256       │
│ Cache hit:  89%         │
│ Total:      5,098       │
│                         │
│ ─────────────────────── │
│                         │
│ CONTEXT MANAGEMENT      │    ← FDE pattern: manage context window
│ [Summarize old msgs]    │    ← FDE: "summarize" button
│ [Remove selected msgs]  │    ← FDE: "remove" messages
│ [Clear all context]     │
│                         │
└─────────────────────────┘
```

### 6. TOOL EXECUTION DISPLAY → Inline in Messages

**FDE:** Shows tools used in response, recorded in chat outline
**Ours:**
```
  ┌─ Tool Execution ────────────────────────────────────────────┐
  │                                                             │
  │  ✓ sn_get_table_schema(incident)                    0.8s   │
  │  ✓ sn_get_notifications(incident, active=true)      1.2s   │
  │  ● sn_create_notification(name="P1 Alert", ...)     ...    │  ← active
  │                                                             │
  │  Expand to see inputs/outputs? ──────────── [Show details]  │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  When expanded (like FDE showing tool inputs):
  
  ┌─ Tool Execution ────────────────────────────────────────────┐
  │                                                             │
  │  ✓ sn_get_table_schema                              0.8s   │
  │    Input:  { table: "incident" }                            │
  │    Output: 47 fields returned                               │
  │                                                             │
  │  ✓ sn_get_notifications                             1.2s   │
  │    Input:  { table: "incident", activeOnly: true }          │
  │    Output: 3 existing notifications found                   │
  │                                                             │
  │  ✓ sn_create_notification                           2.1s   │
  │    Input:  { name: "P1 Incident Assignment Alert",          │
  │             table: "incident", subject: "P1: ${number}..." }│
  │    Output: Created sys_id: e7a2c3d4e5f6                    │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

### 7. TOOL APPROVAL → Inline Confirmation (FDE pattern)

**FDE:** Tool approval required for side effects, configurable per branch
**Ours:**
```
  ┌─ ⚠️ Approval Required ──────────────────────────────────────┐
  │                                                             │
  │  The Builder agent wants to execute:                        │
  │                                                             │
  │  sn_create_business_rule                                    │
  │  ┌───────────────────────────────────────────────────────┐  │
  │  │ Name:  ValidateHighImpactJustification                │  │
  │  │ Table: incident                                       │  │
  │  │ When:  before · insert, update                        │  │
  │  │ Script: (142 lines)                   [Preview code]  │  │
  │  └───────────────────────────────────────────────────────┘  │
  │                                                             │
  │  This operation will create a new artifact on your          │
  │  ServiceNow instance.                                       │
  │                                                             │
  │  ┌──────────────┐ ┌───────────┐ ┌──────────────────────┐   │
  │  │ ✅ Approve    │ │ ✏️ Edit   │ │ ❌ Reject             │   │
  │  └──────────────┘ └───────────┘ └──────────────────────┘   │
  │                                                             │
  │  ☐ Auto-approve similar operations in this session          │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

---

## VISUAL DESIGN — Blueprint-Inspired Tokens

### Color Palette (matching Blueprint dark theme)

```
Surface hierarchy (4% steps, blue undertone — matches our existing globals.css):
  App background:   #0B0D12  (Blueprint: $dark-gray1)
  Card background:  #161A22  (Blueprint: $dark-gray2)
  Elevated:         #1C2029  (Blueprint: $dark-gray3)
  Hover:            #232833  (Blueprint: $dark-gray4)

Borders:
  Default:          rgba(255,255,255,0.08)  (Blueprint: white borders on dark)
  Emphasis:         rgba(255,255,255,0.15)

Text:
  Primary:          #E6EDF3
  Secondary:        #8B949E
  Disabled:         #848D97

Accents (mode colors):
  Explore:          #4C7DFF  (blue)
  Build:            #38C976  (green)
  SDD:              #A78BFA  (purple)
  Analyze:          #F5C451  (amber)
  Operate:          #F97373  (red)
  Flow:             #45B7D1  (teal)

Blueprint design tokens applied:
  Border radius:    2px  (Blueprint 5.0 reduced from 3px)
  Spacing grid:     4px  (Blueprint migrated to 4px grid)
  Card padding:     12px (Blueprint standard)
  Button height:    32px (Blueprint medium)
  Font:             Inter / -apple-system (matches our existing)
```

### Component Patterns

```
Message card (AI response):
  ┌──────────────────────────────────────────┐
  │                                          │  border: 1px solid rgba(255,255,255,0.08)
  │  content                                 │  border-radius: 2px
  │                                          │  background: #161A22
  │                                          │  padding: 12px 16px
  └──────────────────────────────────────────┘

Context chip:
  ┌──────────────┐
  │ 📋 incident  │  height: 24px
  └──────────────┘  border-radius: 2px
                    padding: 0 8px
                    font-size: 12px
                    background: mode-color at 12% opacity

Tool execution row:
  ✓ sn_get_table_schema(incident)      0.8s
  │                                        │
  └─ icon ─ tool name ─ args ─────── duration
  
  font: 12px monospace
  color: #8B949E (success: #38C976)
  spacing: 4px vertical between rows

Mode pill (selected):
  ┌──────────┐
  │🔨 Build ●│  background: mode-color at 15% opacity
  └──────────┘  border: 1px solid mode-color at 30%
                border-radius: 2px
                font-weight: 500

Mode pill (unselected):
  ┌──────────┐
  │🔍 Explore│  background: transparent
  └──────────┘  border: 1px solid rgba(255,255,255,0.08)
                color: #8B949E
                hover: background #1C2029
```

---

## COMPLETE LAYOUT — With All FDE Elements Labeled

```
     FDE: top toolbar                    FDE: session name / instance
     ↓                                   ↓
┌────┬─────────────────────────────────────────────────────────────┬──────────┐
│    │ ┌──────────┐┌─────────┐┌─────────────┐     🟢 dev300943   │ ☰ outline│
│ N  │ │●Session 1││Session 2││+ New Session │                    │          │
│ A  │ └──────────┘└─────────┘└─────────────┘                    │          │
│ V  ├─────────────────────────────────────────────────────────────┤ FDE:     │
│    │ ┌──────┐┌──────┐┌─────┐┌────────┐┌─────┐┌──────┐          │ chat     │
│ R  │ │Explor││Build●││ SDD ││Analyze ││ Ops ││ Flow │          │ outline  │
│ A  │ └──────┘└──────┘└─────┘└────────┘└─────┘└──────┘          │ panel    │
│ I  │  ↑ FDE: mode selector                                      │          │
│ L  ├─────────────────────────────────────────────────────────────┤ Prompts  │
│    │                                                             │ Tools    │
│    │                        USER MESSAGE (right-aligned)         │ Tokens   │
│    │                                                             │ Artifacts│
│    │  AI RESPONSE with:                                          │          │
│    │  • Agent badge (FDE: shows which tools used)                │          │
│    │  • Tool execution log (FDE: recorded in outline)            │          │
│    │  • Artifact card + VAPT (our addition)                      │          │
│    │  • Interactive choices (FDE: approval buttons)               │          │
│    │  • Code blocks with copy                                    │          │
│    │                                                             │ Context  │
│    │  TOOL APPROVAL (FDE: approval for side effects)             │ mgmt:    │
│    │                                                             │ Summarize│
│    │  DIRECT TOOL RESULT (our addition)                          │ Remove   │
│    │                                                             │ Clear    │
│    ├─────────────────────────────────────────────────────────────┤          │
│    │ ┌──────────┐┌────────────────┐┌──────────────┐     [+Add] │          │
│    │ │📋incident││📦 REQ-005-Impl ││📎 spec.pdf  ×│            │          │
│    │ └──────────┘└────────────────┘└──────────────┘            │          │
│    │  ↑ FDE: context ribbon (resource chips above input)        │          │
│    ├─────────────────────────────────────────────────────────────┤          │
│    │ ┌─────────────────────────────────────────────────────────┐│          │
│    │ │ What should we work on next?                            ││          │
│    │ └─────────────────────────────────────────────────────────┘│          │
│    │  📎   ✨ AI                                    🎤    ▶    │          │
│    │  ↑ FDE: input field at bottom                              │          │
│    ├─────────────────────────────────────────────────────────────┤          │
│    │ 🔨 Build · 40 tools enabled                          [▾▴] │          │
│    │ ☑ Scripts(9)  ☑ UI(10)  ☑ Notif(4)  ☑ Security(6) ...    │          │
│    │  ↑ FDE: tool menu below input (category toggles)           │          │
│    ├─────────────────────────────────────────────────────────────┤          │
│    │ This is Agentic AI and can make mistakes.                  │          │
└────┴─────────────────────────────────────────────────────────────┴──────────┘
```

---

*Every labeled element maps directly to a documented Palantir FDE feature.
Our additions beyond FDE: VAPT badges, artifact persistence, multi-system connectors,
direct tool execution forms, agent-per-mode attribution.*
