# Chat Interface — UI/UX Mockups

> All mockups use the dark theme color palette from the existing design system.
> Surface: #0B0D12 → #111318 → #161A22 → #1C2029 → #232833
> Text: #E6EDF3 (primary) #8B949E (secondary) #848D97 (disabled)
> Accent: #4C7DFF (blue) #38C976 (green) #F97373 (red)

---

## 1. FULL APPLICATION — Connected, Active Chat

```
┌──┬───────────────────────────────────────────────────────────────────────┐
│  │ SN AI Agent                          🟢 dev300943    + New Chat      │
│  ├───────────────────────────────────────────────────────────────────────┤
│  │ ┌─────────┐┌──────────────┐┌───────────┐                  ×         │
│  │ │● Chat 1 ││ Chat 2       ││ Chat 3    │               [  +  ]      │
│  │ └─────────┘└──────────────┘└───────────┘                             │
│  ├───────────────────────────────────────────────────────────────────────┤
│  │                                                                       │
│💬│ ┌─ 🔍 Explore ─┐┌─ 🔨 Build ─┐┌─ 🏗️ SDD ─┐┌─ 📊 Analyze ─┐┌─ 💬 ─┐│
│  │ └──────────────┘└────────────┘└──────────┘└──────────────┘└──────┘│
│  │                                                                       │
│🔧│              ┌────────────────────────────────────────────────┐       │
│  │              │  Analyze assignment group workload distribution │       │
│  │              │  for the "Software" group.                     │       │
│🤖│              └────────────────────────────────────────────────┘       │
│  │                                                                       │
│  │  ┌──────────────────────────────────────────────────────────────┐     │
│⚙ │  │  🔍 Explorer Agent · Sonnet                                  │     │
│  │  │                                                              │     │
│  │  │  Analyzing assignment group workload for "Software"...       │     │
│👤│  │                                                              │     │
│  │  │  I've identified 45 active tasks. 60% are assigned to 3     │     │
│  │  │  agents, indicating potential imbalance. Here's a breakdown  │     │
│🌙│  │  of top assignees and their current load:                    │     │
│  │  │                                                              │     │
│  │  │  Agent A: 15  ██████████████████████████                     │     │
│  │  │  Agent B: 12  █████████████████████                          │     │
│SN│  │  Agent C: 10  █████████████████                              │     │
│  │  │  Others:  8   █████████████                                  │     │
│  │  │                                                              │     │
│  │  │  🛠️ Tools used: sn_query_records, sn_get_record              │     │
│  │  └──────────────────────────────────────────────────────────────┘     │
│  │                                                                       │
│  │              ┌────────────────────────────────────────────────┐       │
│  │              │  Suggest reassignments to optimize.            │       │
│  │              └────────────────────────────────────────────────┘       │
│  │                                                                       │
│  │  ┌──────────────────────────────────────────────────────────────┐     │
│  │  │  🔍 Explorer Agent · Sonnet                                  │     │
│  │  │                                                              │     │
│  │  │  Based on current availability and skill sets, I recommend   │     │
│  │  │  reassigning 5 tasks from Agent A to Agent D and E. Would    │     │
│  │  │  you like me to proceed with this action?                    │     │
│  │  │                                                              │     │
│  │  │  ┌──────────────┐  ┌──────────────┐                         │     │
│  │  │  │ Yes, proceed  │  │ Show details  │                        │     │
│  │  │  └──────────────┘  └──────────────┘                         │     │
│  │  └──────────────────────────────────────────────────────────────┘     │
│  │                                                                       │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  │ 🤖 Explorer · Sonnet · 4 tools · 🟢 dev300943                   │ │
│  │  ├──────────────────────────────────────────────────────────────────┤ │
│  │  │ 📎  What should we work on next?                          ▶  🎤 │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │
│  │  This is Agentic AI and can make mistakes. Please double-check.      │
│  │                                                                       │
└──┴───────────────────────────────────────────────────────────────────────┘

LEGEND:
├── Left: NavRail (64px) with icons: 💬 Chats, 🔧 Tools, 🤖 Agents, ⚙ Settings, 👤 Profile, 🌙 Theme, SN Logo
├── Top: Header bar → Tab bar → Mode ribbon
├── Center: Chat messages with agent attribution
├── Bottom: Context bar + Input bar + Disclaimer
```

---

## 2. NAVRAIL — Detailed (Left Strip)

```
┌────────┐
│        │
│  💬    │  ← Chat List (opens drawer)
│ Chats  │
│        │
├────────┤
│        │
│  🔧    │  ← Tool Workbench (opens drawer)
│ Tools  │
│        │
├────────┤
│        │
│  🤖    │  ← Agent Configuration (opens drawer)
│ Agents │
│        │
├────────┤
│        │
│  ⚙     │  ← Settings / Connection (opens drawer)
│Settings│
│        │
├────────┤
│        │
│  👤    │  ← Profile / Credential Vault (opens drawer)
│Profile │
│        │
├────────┤
│        │
│        │
│ (flex) │  ← spacer
│        │
│        │
├────────┤
│  🌙    │  ← Theme toggle (dark/light)
├────────┤
│  ┌──┐  │
│  │SN│  │  ← Brand logo
│  └──┘  │
└────────┘
   64px

Hover state: icon + label tooltip
Active state: blue left border + highlighted icon
```

---

## 3. TOOL WORKBENCH DRAWER — Open

```
┌──┬─────────────────────────────────────┬───────────────────────────────────┐
│  │ 🔧 Tool Workbench           ✕ Close│                                   │
│  ├─────────────────────────────────────┤                                   │
│  │                                     │                                   │
│  │ 🔍 Search tools...                  │     (Chat area visible but       │
│💬│                                     │      dimmed behind backdrop)      │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │                                   │
│  │                                     │                                   │
│🔧│ ▼ 📡 SYSTEMS                        │                                   │
│●●│   ┌──────────────────────────────┐  │                                   │
│  │   │ 🟢 ServiceNow               │  │                                   │
│🤖│   │    dev300943.service-now.com │  │                                   │
│  │   │    Connected · 147 tools     │  │                                   │
│  │   ├──────────────────────────────┤  │                                   │
│⚙ │   │ ⚫ JIRA          [Configure] │  │                                   │
│  │   ├──────────────────────────────┤  │                                   │
│👤│   │ ⚫ Salesforce     Coming soon │  │                                   │
│  │   ├──────────────────────────────┤  │                                   │
│  │   │ ⚫ Linear         Coming soon │  │                                   │
│🌙│   └──────────────────────────────┘  │                                   │
│  │                                     │                                   │
│  │ ▼ 📋 RECORDS & DATA        4 tools  │                                   │
│SN│   ├── Query Records          [▶ Run]│                                   │
│  │   ├── Get Record             [▶ Run]│                                   │
│  │   ├── Create Record          [▶ Run]│                                   │
│  │   └── Update Record          [▶ Run]│                                   │
│  │                                     │                                   │
│  │ ▶ 💻 SERVER SCRIPTS         9 tools │                                   │
│  │                                     │                                   │
│  │ ▼ 🖥️ CLIENT & UI            10 tools│                                   │
│  │   ├── Client Scripts     ─────────  │                                   │
│  │   │   ├── Get Client Scripts [▶ Run]│                                   │
│  │   │   └── Create Client Scr  [▶ Run]│                                   │
│  │   ├── UI Policies        ─────────  │                                   │
│  │   │   ├── Get UI Policies    [▶ Run]│                                   │
│  │   │   ├── Create UI Policy   [▶ Run]│                                   │
│  │   │   ├── Get Policy Actions [▶ Run]│                                   │
│  │   │   └── Create Policy Act  [▶ Run]│                                   │
│  │   ├── UI Actions         ─────────  │                                   │
│  │   │   ├── Get UI Actions     [▶ Run]│                                   │
│  │   │   └── Create UI Action   [▶ Run]│                                   │
│  │   └── 🔜 UI Builder     Coming soon │                                   │
│  │                                     │                                   │
│  │ ▶ 🔐 SECURITY & ACCESS      6 tools│                                   │
│  │ ▶ 📧 NOTIFICATIONS          4 tools│                                   │
│  │ ▶ 📦 DEVOPS                 14 tools│                                   │
│  │ ▶ 🔄 FLOW & AUTOMATION      12 tools│                                   │
│  │ ▶ 🎨 PORTAL & UX           14 tools│                                   │
│  │ ▶ 🛒 SERVICE CATALOG       12 tools│                                   │
│  │ ▶ 📊 ANALYSIS & QUALITY    16 tools│                                   │
│  │ ▶ 🧪 TESTING (ATF)          4 tools│                                   │
│  │ ▶ 🏗️ SDD (Full SDLC)     All tools │                                   │
│  │                                     │                                   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │                                   │
│  │ 📋 EXTERNAL SYSTEMS (Future)        │                                   │
│  │   ├── 🔜 JIRA (User Stories)        │                                   │
│  │   ├── 🔜 SN Agile (Stories)         │                                   │
│  │   └── 🔜 Linear (Issues)            │                                   │
│  │                                     │                                   │
└──┴─────────────────────────────────────┴───────────────────────────────────┘
         ≈ 380px drawer                         Chat area (backdrop)
```

---

## 4. TOOL EXECUTION PANEL — "Create Notification" (Inline Form)

```
┌──┬───────────────────────────────────────────────────────────────────────┐
│  │  ...chat messages above...                                            │
│  │                                                                       │
│  │  ┌────────────────────────────────────────────────────────────────┐   │
│  │  │ ✨ Create Notification          📧 Notifications & Events      │   │
│  │  │ ──────────────────────────────────────────────────────────────  │   │
│  │  │ 🟢 ServiceNow · dev300943       Type: Write  🛡️ VAPT enabled  │   │
│  │  │                                                                │   │
│  │  │ ┌────────────────────────────────────────────────────────────┐ │   │
│  │  │ │                                                            │ │   │
│  │  │ │  Name *                                                    │ │   │
│  │  │ │  ┌──────────────────────────────────────────────────────┐  │ │   │
│  │  │ │  │ High Priority Incident Alert                         │  │ │   │
│  │  │ │  └──────────────────────────────────────────────────────┘  │ │   │
│  │  │ │                                                            │ │   │
│  │  │ │  Table *                                                   │ │   │
│  │  │ │  ┌──────────────────────────────────────────────────────┐  │ │   │
│  │  │ │  │ incident                                          ▾  │  │ │   │
│  │  │ │  └──────────────────────────────────────────────────────┘  │ │   │
│  │  │ │                                                            │ │   │
│  │  │ │  Subject *                                                 │ │   │
│  │  │ │  ┌──────────────────────────────────────────────────────┐  │ │   │
│  │  │ │  │ P1 Alert: ${number} - ${short_description}           │  │ │   │
│  │  │ │  └──────────────────────────────────────────────────────┘  │ │   │
│  │  │ │                                                            │ │   │
│  │  │ │  Message HTML *                                            │ │   │
│  │  │ │  ┌──────────────────────────────────────────────────────┐  │ │   │
│  │  │ │  │ <p>A Priority 1 incident has been assigned.</p>      │  │ │   │
│  │  │ │  │ <p>Number: ${number}</p>                              │  │ │   │
│  │  │ │  │ <p>Description: ${short_description}</p>              │  │ │   │
│  │  │ │  │ <p>Assigned to: ${assigned_to}</p>                    │  │ │   │
│  │  │ │  └──────────────────────────────────────────────────────┘  │ │   │
│  │  │ │                                                            │ │   │
│  │  │ │  Recipients                                                │ │   │
│  │  │ │  ┌──────────────────────────────────────────────────────┐  │ │   │
│  │  │ │  │ assignment_group                                      │  │ │   │
│  │  │ │  └──────────────────────────────────────────────────────┘  │ │   │
│  │  │ │                                                            │ │   │
│  │  │ │  ☑ On Insert        ☑ On Update        ☑ Active           │ │   │
│  │  │ │                                                            │ │   │
│  │  │ └────────────────────────────────────────────────────────────┘ │   │
│  │  │                                                                │   │
│  │  │  ┌──────────┐  ┌─────────────────────────────────────────┐     │   │
│  │  │  │  Cancel   │  │  ▶ Execute                             │     │   │
│  │  │  └──────────┘  └─────────────────────────────────────────┘     │   │
│  │  │                                                                │   │
│  │  │  💡 Or describe what you need in chat and the AI agent         │   │
│  │  │     will handle it for you.                                    │   │
│  │  └────────────────────────────────────────────────────────────────┘   │
│  │                                                                       │
│  │  ...input bar below...                                                │
└──┴───────────────────────────────────────────────────────────────────────┘
```

---

## 5. TOOL EXECUTION RESULT — Success Card

```
┌──────────────────────────────────────────────────────────────────────┐
│  ✅ Create Notification                              Direct Execute  │
│  ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│  Name:       High Priority Incident Alert                            │
│  Table:      incident                                                │
│  sys_id:     e7a2c3d4e5f6...                                        │
│  Subject:    P1 Alert: ${number} - ${short_description}              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 🛡️ VAPT Evaluation                             Score: 95/100  │  │
│  │ ──────────────────────────────────────────────────────────────  │  │
│  │ ✅ Naming convention: Passed                                   │  │
│  │ ✅ No hardcoded values: Passed                                 │  │
│  │ ✅ Proper recipients configured: Passed                        │  │
│  │ 💡 Recommendation: Consider adding an unsubscribe mechanism    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────────────────┐   │
│  │ View in SN ↗ │  │ Edit ✏️   │  │ 💾 Saved to Artifacts       │   │
│  └──────────────┘  └──────────┘  └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. AGENT ACTIVITY — Inline During Processing

```
  ┌────────────────────────────────────────────────────────────────────┐
  │ 🔨 Builder Agent                                                   │
  │ ─────────────────────────────────────────────────────────────────── │
  │                                                                    │
  │  ◉ Creating business rule on incident table               12s     │
  │  ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───    │
  │                                                                    │
  │  ✓  Analyzing request                                              │
  │  ✓  Reading incident table schema                                  │
  │  ✓  Checking existing business rules                               │
  │  ●  Creating business rule: ValidateHighImpact  ← active          │
  │  ○  VAPT evaluation (pending)                                      │
  │  ○  Composing response (pending)                                   │
  │                                                                    │
  │  ┌────────────────────────────────────────────────────────────┐    │
  │  │                                                            │    │
  │  │  📊 4 tools · 3 completed · ~8s remaining                  │    │
  │  │  Model: Claude Sonnet 4.6 · 🔨 Builder Agent              │    │
  │  │                                                            │    │
  │  └────────────────────────────────────────────────────────────┘    │
  │                                                                    │
  │  ┌──────────┐                                                      │
  │  │ ■ Stop   │                                                      │
  │  └──────────┘                                                      │
  └────────────────────────────────────────────────────────────────────┘
```

---

## 7. MODE RIBBON — Expanded View with Agent Info

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │🔍 Explore│ │🔨 Build ●│ │🏗️ SDD    │ │📊 Analyze│ │🔄 Operate     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
│                     ▲                                                     │
│                  selected                                                 │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  🔨 Build Mode                                                      │  │
│  │  Agent: Builder · Claude Sonnet 4.6 · ~40 tools                     │  │
│  │  Creates and modifies ServiceNow artifacts: scripts, UI policies,   │  │
│  │  notifications, ACLs, catalog items, and more.                      │  │
│  │  🛡️ VAPT auto-evaluation enabled                                    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

Mode descriptions:
  🔍 Explore    — Read-only instance discovery. "What business rules exist on incident?"
  🔨 Build      — Create/modify artifacts. "Create a notification for P1 incidents"
  🏗️ SDD        — Full SDLC with phase gates. "Build a high-impact justification feature"
  📊 Analyze    — Quality & governance. "Scan my instance for anti-patterns"
  🔄 Operate    — DevOps & deployment. "Create update set and promote to test"
  🌊 Flow       — Flow Designer & automation. "Create a flow for incident escalation"
  💬 Freeform   — All tools, no guardrails. Power user mode.
```

---

## 8. CHAT LIST DRAWER — Open

```
┌──┬─────────────────────────────────────┬───────────────────────────────────┐
│  │ 💬 Chats                    ✕ Close│                                   │
│  ├─────────────────────────────────────┤                                   │
│  │                                     │                                   │
│  │ 🔍 Search chats...                  │                                   │
│💬│                                     │                                   │
│●●│ ┌─────────────────────────────────┐ │                                   │
│  │ │ + New Chat                       │ │                                   │
│🔧│ └─────────────────────────────────┘ │                                   │
│  │                                     │                                   │
│🤖│ TODAY                               │                                   │
│  │ ┌─────────────────────────────────┐ │                                   │
│  │ │ ● Incident Notification Setup   │ │   (Chat area visible             │
│⚙ │ │   🟢 dev300943 · 🔨 Build      │ │    but dimmed)                    │
│  │ │   "Create a notification for..." │ │                                   │
│👤│ │   3 min ago                      │ │                                   │
│  │ ├─────────────────────────────────┤ │                                   │
│  │ │   Workload Analysis             │ │                                   │
│🌙│ │   🟢 dev300943 · 🔍 Explore     │ │                                   │
│  │ │   "Analyzed 45 active tasks..." │ │                                   │
│  │ │   15 min ago                     │ │                                   │
│SN│ ├─────────────────────────────────┤ │                                   │
│  │ │   ATF Suite Creation            │ │                                   │
│  │ │   🟢 dev300943 · 🧪 Testing     │ │                                   │
│  │ │   "Created 12 test cases..."    │ │                                   │
│  │ │   1 hour ago                     │ │                                   │
│  │ └─────────────────────────────────┘ │                                   │
│  │                                     │                                   │
│  │ YESTERDAY                           │                                   │
│  │ ┌─────────────────────────────────┐ │                                   │
│  │ │   REQ-005 Implementation        │ │                                   │
│  │ │   🟢 dev300943 · 🏗️ SDD         │ │                                   │
│  │ │   "Deployed 4 artifacts..."     │ │                                   │
│  │ │   Yesterday 4:32 PM             │ │                                   │
│  │ ├─────────────────────────────────┤ │                                   │
│  │ │   Instance Health Check         │ │                                   │
│  │ │   🔵 test-instance · 📊 Analyze │ │                                   │
│  │ │   "Health score: 82/100..."     │ │                                   │
│  │ │   Yesterday 10:15 AM            │ │                                   │
│  │ └─────────────────────────────────┘ │                                   │
│  │                                     │                                   │
│  │ LAST 7 DAYS                         │                                   │
│  │ ┌─────────────────────────────────┐ │                                   │
│  │ │   Code Quality Audit            │ │                                   │
│  │ │   ...                            │ │                                   │
│  │ └─────────────────────────────────┘ │                                   │
│  │                                     │                                   │
└──┴─────────────────────────────────────┴───────────────────────────────────┘
```

---

## 9. AGENT CONFIGURATION DRAWER

```
┌──┬─────────────────────────────────────┬───────────────────────────────────┐
│  │ 🤖 Agent Configuration      ✕ Close│                                   │
│  ├─────────────────────────────────────┤                                   │
│  │                                     │                                   │
│  │ Routing Mode                        │                                   │
│💬│ ┌──────────────────┐ ┌───────────┐  │                                   │
│  │ │ ● Auto (AI picks)│ │ ○ Manual  │  │                                   │
│🔧│ └──────────────────┘ └───────────┘  │                                   │
│  │                                     │                                   │
│🤖│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │                                   │
│●●│                                     │                                   │
│  │ ☑ 🧠 Orchestrator                   │                                   │
│⚙ │   Model: Claude Haiku 4.5       ▾  │                                   │
│  │   Fast classification & routing     │                                   │
│👤│                                     │                                   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │                                   │
│🌙│                                     │                                   │
│  │ ☑ 🔍 Explorer                       │                                   │
│SN│   Model: Claude Sonnet 4.6      ▾  │                                   │
│  │   Read-only discovery · ~25 tools   │                                   │
│  │                                     │                                   │
│  │ ☑ 🔨 Builder                        │                                   │
│  │   Model: Claude Sonnet 4.6      ▾  │                                   │
│  │   Create/modify · ~40 tools         │                                   │
│  │                                     │                                   │
│  │ ☑ 🏗️ SDD Agent                      │                                   │
│  │   Model: Claude Opus 4.6        ▾  │                                   │
│  │   Full SDLC · 147 tools             │                                   │
│  │                                     │                                   │
│  │ ☑ 📊 Analyzer                       │                                   │
│  │   Model: Claude Sonnet 4.6      ▾  │                                   │
│  │   Quality & governance · ~30 tools  │                                   │
│  │                                     │                                   │
│  │ ☑ 🔄 Operator                       │                                   │
│  │   Model: Claude Sonnet 4.6      ▾  │                                   │
│  │   DevOps & deployment · ~25 tools   │                                   │
│  │                                     │                                   │
│  │ ☑ 🌊 Flow Architect                 │                                   │
│  │   Model: Claude Sonnet 4.6      ▾  │                                   │
│  │   Flow Designer · ~15 tools         │                                   │
│  │                                     │                                   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │                                   │
│  │                                     │                                   │
│  │ ☑ 🛡️ Evaluator (VAPT)               │                                   │
│  │   Model: Claude Haiku 4.5       ▾  │                                   │
│  │   Auto-validates every write        │                                   │
│  │   ☑ Auto-run on Builder writes      │                                   │
│  │   ☑ Auto-run on Operator writes     │                                   │
│  │   ☐ Auto-run on SDD writes          │                                   │
│  │                                     │                                   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │                                   │
│  │ Provider: Anthropic              ▾  │                                   │
│  │ (applies to all agents unless       │                                   │
│  │  overridden above)                  │                                   │
│  │                                     │                                   │
└──┴─────────────────────────────────────┴───────────────────────────────────┘
```

---

## 10. PROFILE & CREDENTIAL VAULT DRAWER

```
┌──┬─────────────────────────────────────┬───────────────────────────────────┐
│  │ 👤 Profile & Vault          ✕ Close│                                   │
│  ├─────────────────────────────────────┤                                   │
│  │                                     │                                   │
│  │ ┌─────────────────────────────────┐ │                                   │
│💬│ │  👤 John Doe                     │ │                                   │
│  │ │  john@company.com               │ │                                   │
│🔧│ │  Role: user                      │ │                                   │
│  │ │  [Change Password] [Sign Out]   │ │                                   │
│🤖│ └─────────────────────────────────┘ │                                   │
│  │                                     │                                   │
│⚙ │ ━━━ SAVED CONNECTIONS ━━━━━━━━━━━   │                                   │
│  │                                     │                                   │
│👤│ ┌─────────────────────────────────┐ │                                   │
│●●│ │ 🟢 Dev Instance (default)       │ │                                   │
│  │ │    ServiceNow                    │ │                                   │
│🌙│ │    dev300943.service-now.com    │ │                                   │
│  │ │    admin · Basic Auth            │ │                                   │
│SN│ │    Last: 3 min ago               │ │                                   │
│  │ │    [Test] [Edit] [Delete]       │ │                                   │
│  │ ├─────────────────────────────────┤ │                                   │
│  │ │ ⚫ Test Instance                 │ │                                   │
│  │ │    ServiceNow                    │ │                                   │
│  │ │    test-acme.service-now.com    │ │                                   │
│  │ │    admin · OAuth                 │ │                                   │
│  │ │    Last: 2 days ago              │ │                                   │
│  │ │    [Test] [Edit] [Delete]       │ │                                   │
│  │ ├─────────────────────────────────┤ │                                   │
│  │ │ ⚫ JIRA Cloud                    │ │                                   │
│  │ │    Atlassian                      │ │                                   │
│  │ │    acme.atlassian.net            │ │                                   │
│  │ │    API Token                      │ │                                   │
│  │ │    [Test] [Edit] [Delete]       │ │                                   │
│  │ └─────────────────────────────────┘ │                                   │
│  │                                     │                                   │
│  │ [ + Add Connection ]                │                                   │
│  │                                     │                                   │
│  │ ━━━ API KEYS ━━━━━━━━━━━━━━━━━━━━   │                                   │
│  │                                     │                                   │
│  │ ┌─────────────────────────────────┐ │                                   │
│  │ │ 🔑 Anthropic (default)          │ │                                   │
│  │ │    sk-ant-...****7kQ2           │ │                                   │
│  │ │    Added: Mar 20, 2026           │ │                                   │
│  │ │    [Delete]                      │ │                                   │
│  │ ├─────────────────────────────────┤ │                                   │
│  │ │ 🔑 OpenRouter                   │ │                                   │
│  │ │    sk-or-...****9xB4            │ │                                   │
│  │ │    Added: Mar 15, 2026           │ │                                   │
│  │ │    [Delete]                      │ │                                   │
│  │ └─────────────────────────────────┘ │                                   │
│  │                                     │                                   │
│  │ [ + Add API Key ]                   │                                   │
│  │                                     │                                   │
└──┴─────────────────────────────────────┴───────────────────────────────────┘
```

---

## 11. INPUT BAR — Detailed Anatomy

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Context Bar (above input, subtle)                                         │
│  🔨 Builder · Sonnet 4.6 · 40 tools · 🟢 dev300943 · 🛡️ VAPT on         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌── Attached Files (when present) ───────────────────────────────────┐   │
│  │ ┌─────────┐  ┌──────────────────┐  ┌──────────────────┐           │   │
│  │ │ 🖼️ img  ×│  │ 📄 report.pdf  × │  │ 📊 data.xlsx  ×  │           │   │
│  │ │ preview  │  │ 2.1 MB           │  │ 456 KB            │           │   │
│  │ └─────────┘  └──────────────────┘  └──────────────────┘           │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌── Main Input ──────────────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │  What should we work on next?                                      │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌── Action Row ──────────────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │  [📎]   [✨ AI]                               [🎤]  [■ Stop] [▶] │   │
│  │   │       │                                     │              │   │   │
│  │   │       │                                     │              │   │   │
│  │   │       └─ Enhance/Grammar                    └─ Voice       │   │   │
│  │   │          (existing feature)                    input       Send│   │
│  │   │                                                            │   │   │
│  │   └─ Single attach button                                      │   │   │
│  │      Opens file picker for ANY type                            │   │   │
│  │      (images, docs, code, text, csv...)                        │   │   │
│  │      Blocked: .exe, .bat, .sh, .cmd, .ps1, .msi               │   │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  This is Agentic AI and can make mistakes. Please double-check responses. │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. EMPTY STATE — First Visit After Login (No Chats)

```
┌──┬───────────────────────────────────────────────────────────────────────┐
│  │                         SN AI Agent                                    │
│  │                                                                       │
│💬│                                                                       │
│  │                          ┌──────┐                                     │
│🔧│                          │  SN  │                                     │
│  │                          │ LOGO │                                     │
│🤖│                          └──────┘                                     │
│  │                                                                       │
│⚙ │                      SN AI Agent                                     │
│  │                                                                       │
│👤│              Ship ServiceNow Features with AI.                        │
│  │                                                                       │
│  │                                                                       │
│🌙│          ┌─────────────────────────────────────────┐                  │
│  │          │  Get started by connecting an instance   │                  │
│SN│          │  or selecting a tool from the workbench. │                  │
│  │          └─────────────────────────────────────────┘                  │
│  │                                                                       │
│  │     ┌─────────────────────────────────────────────────────────┐       │
│  │     │ 📎  What should we work on next?                    ▶  │       │
│  │     └─────────────────────────────────────────────────────────┘       │
│  │                                                                       │
│  │     ┌───────────┐ ┌───────────────┐ ┌────────────┐ ┌─────────┐      │
│  │     │✨ For you  │ │🔨 Build       │ │🔍 Explore   │ │📋 Quick │      │
│  │     └───────────┘ └───────────────┘ └────────────┘ └─────────┘      │
│  │                                                                       │
│  │     ┌────────────────────────────────────────────────────────┐        │
│  │     │ 🔨  Create a business rule for incident validation     │        │
│  │     ├────────────────────────────────────────────────────────┤        │
│  │     │ 🔍  Analyze my instance for code quality issues        │        │
│  │     ├────────────────────────────────────────────────────────┤        │
│  │     │ 📧  Set up email notifications for high priority       │        │
│  │     ├────────────────────────────────────────────────────────┤        │
│  │     │ 🔄  Create update set for my next deployment           │        │
│  │     └────────────────────────────────────────────────────────┘        │
│  │                                                                       │
│  │     This is Agentic AI and can make mistakes.                         │
│  │                                                                       │
└──┴───────────────────────────────────────────────────────────────────────┘
```

---

## 13. SDD MODE — Phase Gates Active

```
┌──┬───────────────────────────────────────────────────────────────────────┐
│  │ SN AI Agent                          🟢 dev300943    + New Chat      │
│  ├───────────────────────────────────────────────────────────────────────┤
│  │ ┌────────────┐┌───────────────────┐                                   │
│  │ │● REQ-005   ││ Workload Analysis │           [  +  ]                │
│  │ └────────────┘└───────────────────┘                                   │
│  ├───────────────────────────────────────────────────────────────────────┤
│  │                                                                       │
│  │  ┌──────┐┌────────┐┌─────────┐┌──────┐┌─────────┐┌────────────┐     │
│  │  │1 Spec││2 Design││3 Scope ✓││4 Impl││5 Testing││6 Deployment│     │
│  │  │  ✓   ││   ✓    ││    ✓    ││  ●   ││    ○    ││     ○      │     │
│  │  └──────┘└────────┘└─────────┘└──────┘└─────────┘└────────────┘     │
│  │                                                                       │
│  │  REQ-005 · Implementation Phase · 🏗️ SDD Agent · Opus 4.6           │
│  │                                                                       │
│  │  ┌──────────────────────────────────────────────────────────────┐     │
│  │  │  🏗️ SDD Agent · Opus 4.6                                     │     │
│  │  │                                                              │     │
│  │  │  I've created the following artifacts for REQ-005:           │     │
│  │  │                                                              │     │
│  │  │  ┌────────────────────────────────────────────────────────┐  │     │
│  │  │  │ Artifact                         │ Status │ VAPT Score │  │     │
│  │  │  │ ─────────────────────────────────┤────────┤────────────│  │     │
│  │  │  │ BR: ValidateHighImpact           │ ✅     │ 🛡️ 97/100  │  │     │
│  │  │  │ SI: HighImpactJustificationUtil  │ ✅     │ 🛡️ 94/100  │  │     │
│  │  │  │ CS: HandleHighImpactChange       │ ✅     │ 🛡️ 91/100  │  │     │
│  │  │  │ UP: HighImpactFieldBehavior      │ ✅     │ 🛡️ 96/100  │  │     │
│  │  │  └────────────────────────────────────────────────────────┘  │     │
│  │  │                                                              │     │
│  │  │  All artifacts verified in update set "REQ-005-Impl".       │     │
│  │  │                                                              │     │
│  │  │  🛑 Please review the implementation. Type 'approved'        │     │
│  │  │     to proceed to testing phase.                             │     │
│  │  │                                                              │     │
│  │  │  ┌──────────────────┐  ┌──────────────────────────────┐     │     │
│  │  │  │ ✅ Approved       │  │ 🔍 Review Artifacts          │     │     │
│  │  │  └──────────────────┘  └──────────────────────────────┘     │     │
│  │  └──────────────────────────────────────────────────────────────┘     │
│  │                                                                       │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  │ 🏗️ SDD · Opus 4.6 · 147 tools · 🟢 dev300943 · 🛡️ VAPT on     │ │
│  │  ├──────────────────────────────────────────────────────────────────┤ │
│  │  │ 📎  What should we work on next?                          ▶  🎤 │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │
│  │  This is Agentic AI and can make mistakes.                            │
│  │                                                                       │
└──┴───────────────────────────────────────────────────────────────────────┘
```

---

## 14. MOBILE VIEW — Responsive Layout

```
┌──────────────────────────────────┐
│ SN AI Agent       🟢  + New     │
├──────────────────────────────────┤
│ ┌────────────┐┌──────────┐      │
│ │● Chat 1    ││ Chat 2   │  +   │
│ └────────────┘└──────────┘      │
├──────────────────────────────────┤
│ 🔍 Explore │ 🔨 Build │ 📊 ... │
├──────────────────────────────────┤
│                                  │
│ ┌──────────────────────────────┐ │
│ │ Analyze workload for the     │ │
│ │ "Software" group.            │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🔍 Explorer · Sonnet         │ │
│ │                              │ │
│ │ I've identified 45 active    │ │
│ │ tasks. 60% are assigned to   │ │
│ │ 3 agents.                    │ │
│ │                              │ │
│ │ Agent A: 15 ████████████     │ │
│ │ Agent B: 12 █████████        │ │
│ │ Agent C: 10 ████████         │ │
│ │ Others:  8  ██████           │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🤖 Explorer · 4 tools · dev │ │
│ ├──────────────────────────────┤ │
│ │📎 What next?           ▶  🎤│ │
│ └──────────────────────────────┘ │
│ AI disclaimer                    │
├──────────────────────────────────┤
│  💬    🔧     🤖     ⚙    👤   │
│ Chats  Tools  Agent  Set  Prof  │
└──────────────────────────────────┘
   ↑ Bottom tab bar replaces NavRail
```

---

*These mockups represent the dark theme. Light theme inverts surface/text colors while maintaining the same layout structure.*
