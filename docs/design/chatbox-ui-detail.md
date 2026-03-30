# Chat Box UI — Detailed Interaction Design

> This focuses ONLY on the chat area — the central panel where the user interacts.
> Everything outside (NavRail, drawers) is excluded.

---

## 1. CHAT BOX — Anatomy of the Full Chat Area

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║  ┌─ TAB BAR ───────────────────────────────────────────────────────────┐ ║
║  │ ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐      │ ║
║  │ │ ● Incident Setup │ │  Code Review     │ │  Data Migration  │  +   │ ║
║  │ └─────────────────┘ └──────────────────┘ └──────────────────┘      │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
║  ┌─ MODE RIBBON ───────────────────────────────────────────────────────┐ ║
║  │                                                                     │ ║
║  │  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ ┌────────────┐ │ ║
║  │  │🔍 Explore│ │🔨 Build ●│ │🏗️ SDD  │ │📊 Analyze│ │💬 Freeform │ │ ║
║  │  └──────────┘ └──────────┘ └────────┘ └──────────┘ └────────────┘ │ ║
║  │                                                                     │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
║  ┌─ MESSAGE AREA (scrollable) ─────────────────────────────────────────┐ ║
║  │                                                                     │ ║
║  │                              ...messages...                         │ ║
║  │                                                                     │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
║  ┌─ INPUT AREA (fixed bottom) ─────────────────────────────────────────┐ ║
║  │  Context bar                                                        │ ║
║  │  Attachments (if any)                                               │ ║
║  │  Text input                                                         │ ║
║  │  Action buttons                                                     │ ║
║  │  Disclaimer                                                         │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 2. MESSAGE AREA — All Message Types the User Will See

### 2a. User Message (right-aligned, pill bubble)

```
                                                                          
                        ┌──────────────────────────────────────────────┐  
                        │                                              │  
                        │  Create a notification that emails the       │  
                        │  assignment group whenever a P1 incident     │  
                        │  is created.                                 │  
                        │                                              │  
                        └──────────────────────────────────────────────┘  
                                                                          
```
- Background: `var(--color-primary)` at 12% opacity
- Text: `var(--text-primary)`
- Right-aligned, rounded corners, max-width ~70%
- No avatar (clean design)


### 2b. User Message — With Attachments

```
                                                                          
                        ┌──────────────────────────────────────────────┐  
                        │                                              │  
                        │  Here's the requirements doc and the         │  
                        │  current workflow screenshot.                │  
                        │                                              │  
                        │  ┌──────────┐  ┌──────────────────────────┐  │  
                        │  │  🖼️       │  │  📄 requirements.pdf     │  │  
                        │  │  screen   │  │  1.2 MB                  │  │  
                        │  │  shot.png │  │                          │  │  
                        │  └──────────┘  └──────────────────────────┘  │  
                        │                                              │  
                        └──────────────────────────────────────────────┘  
                                                                          
```
- Images show inline thumbnail preview
- Documents show icon + filename + size
- Both in the same attachment strip (unified)


### 2c. AI Response — Standard (left-aligned, card)

```
                                                                          
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  🔨 Builder · Sonnet 4.6                                   ⋮  📋    │
  │  ──────────────────────────────────────────────────────────────────  │
  │                                                                      │
  │  I've created the notification for P1 incidents. Here's what was     │
  │  set up:                                                             │
  │                                                                      │
  │  **Notification Details:**                                           │
  │  • **Name:** P1 Incident Assignment Alert                            │
  │  • **Table:** incident                                               │
  │  • **Triggers:** On insert when priority = 1                         │
  │  • **Recipients:** Assignment group members                          │
  │  • **Subject:** `P1: ${number} - ${short_description}`               │
  │                                                                      │
  │  The notification will fire immediately when a P1 incident is        │
  │  created and assigned to a group.                                    │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
                                                                          
```
- Left-aligned, subtle card background `var(--surface-secondary)`
- Agent badge top-left: icon + name + model
- ⋮ = options menu (copy, regenerate)
- 📋 = copy entire message
- Supports full markdown (bold, lists, code blocks, tables)


### 2d. AI Response — With Artifact Created

```
                                                                          
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  🔨 Builder · Sonnet 4.6                                   ⋮  📋    │
  │  ──────────────────────────────────────────────────────────────────  │
  │                                                                      │
  │  I've created the business rule to validate high-impact changes.     │
  │                                                                      │
  │  ┌─ ARTIFACT ────────────────────────────────────────────────────┐   │
  │  │                                                               │   │
  │  │  📜 Business Rule                                             │   │
  │  │  ValidateHighImpactJustification                              │   │
  │  │                                                               │   │
  │  │  Table: incident                                              │   │
  │  │  When: before · insert, update                                │   │
  │  │  sys_id: a1b2c3d4...                                         │   │
  │  │                                                               │   │
  │  │  ┌─ 🛡️ VAPT ─────────────────────────────────── 97/100 ────┐ │   │
  │  │  │  ✅ No eval() usage                                      │ │   │
  │  │  │  ✅ No hardcoded credentials                              │ │   │
  │  │  │  ✅ Proper error handling (try/catch)                     │ │   │
  │  │  │  ✅ Naming convention: PascalCase                         │ │   │
  │  │  │  💡 Consider adding sys_log for audit trail               │ │   │
  │  │  └──────────────────────────────────────────────────────────┘ │   │
  │  │                                                               │   │
  │  │  ┌───────────┐  ┌──────────┐  ┌────────────────────────┐     │   │
  │  │  │ View in SN│  │ Show Code│  │ 💾 Saved to Artifacts  │     │   │
  │  │  └───────────┘  └──────────┘  └────────────────────────┘     │   │
  │  │                                                               │   │
  │  └───────────────────────────────────────────────────────────────┘   │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
                                                                          
```
- Artifact card is embedded inside the AI response
- VAPT section is collapsible (click to expand/collapse)
- "Show Code" expands inline code block with syntax highlighting
- "Saved to Artifacts" = auto-persisted to DB


### 2e. AI Response — With Code Block

```
                                                                          
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  🔨 Builder · Sonnet 4.6                                   ⋮  📋    │
  │  ──────────────────────────────────────────────────────────────────  │
  │                                                                      │
  │  Here's the script include I created:                                │
  │                                                                      │
  │  ┌─ javascript ──────────────────────────────────────── 📋 Copy ──┐  │
  │  │                                                                │  │
  │  │  var HighImpactJustificationUtil = Class.create();             │  │
  │  │  HighImpactJustificationUtil.prototype = {                     │  │
  │  │      initialize: function() {},                                │  │
  │  │                                                                │  │
  │  │      validateJustification: function(gr) {                     │  │
  │  │          if (gr.impact == 1 && !gr.u_justification) {          │  │
  │  │              gs.addErrorMessage(                                │  │
  │  │                  'Justification required for high impact'       │  │
  │  │              );                                                │  │
  │  │              return false;                                     │  │
  │  │          }                                                     │  │
  │  │          return true;                                          │  │
  │  │      },                                                        │  │
  │  │                                                                │  │
  │  │      type: 'HighImpactJustificationUtil'                       │  │
  │  │  };                                                            │  │
  │  │                                                                │  │
  │  └────────────────────────────────────────────────────────────────┘  │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
                                                                          
```
- Code block: monospace font, dark background, syntax highlighting
- Copy button top-right of code block
- Language indicator top-left


### 2f. AI Response — With Data Table / Chart

```
                                                                          
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  🔍 Explorer · Sonnet 4.6                                  ⋮  📋    │
  │  ──────────────────────────────────────────────────────────────────  │
  │                                                                      │
  │  Here's the workload distribution for the "Software" group:          │
  │                                                                      │
  │  ┌─────────────────────────────────────────────────────────────┐     │
  │  │  Agent        │ Tasks │ Load          │ Status              │     │
  │  │  ─────────────┤───────┤───────────────┤─────────────────── │     │
  │  │  Agent A      │  15   │ ████████████░ │ ⚠️ Overloaded       │     │
  │  │  Agent B      │  12   │ █████████░░░░ │ 🔶 High             │     │
  │  │  Agent C      │  10   │ ████████░░░░░ │ 🟢 Normal           │     │
  │  │  Agent D      │   5   │ ████░░░░░░░░░ │ 🟢 Available        │     │
  │  │  Agent E      │   3   │ ██░░░░░░░░░░░ │ 🟢 Available        │     │
  │  └─────────────────────────────────────────────────────────────┘     │
  │                                                                      │
  │  **Summary:** 45 active tasks across 5 agents. Agent A has 33%       │
  │  of the total workload, indicating significant imbalance.            │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
                                                                          
```
- Tables render with grid lines and alignment
- Bar charts use unicode block characters
- Status indicators with color-coded icons


### 2g. AI Response — Interactive Choices (Buttons)

```
                                                                          
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  🔍 Explorer · Sonnet 4.6                                  ⋮  📋    │
  │  ──────────────────────────────────────────────────────────────────  │
  │                                                                      │
  │  I can reassign 5 tasks from Agent A to balance the workload.        │
  │  How would you like me to proceed?                                   │
  │                                                                      │
  │  ┌───────────────────────────┐  ┌───────────────────────────────┐   │
  │  │                           │  │                               │   │
  │  │  ✅ Yes, reassign now     │  │  📋 Show me the plan first   │   │
  │  │                           │  │                               │   │
  │  └───────────────────────────┘  └───────────────────────────────┘   │
  │                                                                      │
  │  ┌───────────────────────────┐  ┌───────────────────────────────┐   │
  │  │                           │  │                               │   │
  │  │  🔄 Different approach    │  │  ❌ Cancel                    │   │
  │  │                           │  │                               │   │
  │  └───────────────────────────┘  └───────────────────────────────┘   │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
                                                                          
```
- Clickable buttons rendered as cards
- Hover effect: subtle border glow
- Clicking sends the choice as a user message


### 2h. Direct Tool Execution Result (System Card)

```
                                                                          
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  ⚡ Direct Execution                                        3:42 PM  │
  │  ──────────────────────────────────────────────────────────────────  │
  │                                                                      │
  │  ┌─ ✅ sn_create_notification ───────────────────────────────────┐   │
  │  │                                                               │   │
  │  │  Created: P1 Incident Assignment Alert                        │   │
  │  │  Table:   incident                                            │   │
  │  │  sys_id:  e7a2c3d4e5f67890                                   │   │
  │  │                                                               │   │
  │  │  🛡️ VAPT: Passed · 95/100                                     │   │
  │  │                                                               │   │
  │  │  ┌──────────┐  ┌──────────────────────────┐                   │   │
  │  │  │View in SN│  │ 💾 Saved to Artifacts    │                   │   │
  │  │  └──────────┘  └──────────────────────────┘                   │   │
  │  └───────────────────────────────────────────────────────────────┘   │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
                                                                          
```
- Labeled "⚡ Direct Execution" — distinct from agent responses
- Compact result card
- Same VAPT badge and action buttons


### 2i. System Message (Phase Gate / Info)

```
                                                                          
  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
  │                                                                      │
  │            ─────── Implementation Phase ───────                      │
  │                                                                      │
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
                                                                          
```
- Dashed border, centered, muted text
- Used for phase transitions, connection status, info notices


### 2j. Agent Processing — Inline Activity

```
                                                                          
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  ┌─ Agent Working ─────────────────────────────────────────────────┐ │
  │  │  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ shimmer accent bar  │ │
  │  │                                                                 │ │
  │  │  ◉ 🔨 Builder · Sonnet 4.6                               15s   │ │
  │  │  ─────────────────────────────────────────────────────────────  │ │
  │  │                                                                 │ │
  │  │   │                                                             │ │
  │  │   ├── ✓ Analyzing your request                                  │ │
  │  │   │                                                             │ │
  │  │   ├── ✓ Reading incident table schema                           │ │
  │  │   │                                                             │ │
  │  │   ├── ✓ Checking existing notifications                         │ │
  │  │   │                                                             │ │
  │  │   ├── ● Creating notification: P1 Alert   ← pulsing dot        │ │
  │  │   │                                                             │ │
  │  │   ├── ○ VAPT evaluation                                        │ │
  │  │   │                                                             │ │
  │  │   └── ○ Composing response                                     │ │
  │  │                                                                 │ │
  │  │   3 of 5 steps · 2 tools completed                             │ │
  │  │                                                                 │ │
  │  │   ┌──────────┐                                                  │ │
  │  │   │ ■ Stop   │                                                  │ │
  │  │   └──────────┘                                                  │ │
  │  └─────────────────────────────────────────────────────────────────┘ │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
                                                                          
```
- Shimmer accent bar at top (animated gradient)
- Timeline with ✓ (done), ● (active, pulsing), ○ (pending)
- Shows agent name + model
- Elapsed timer
- Collapsible (click header to expand/collapse)

---

## 3. INPUT AREA — Full Detail

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║  ┌─ CONTEXT BAR ───────────────────────────────────────────────────────┐ ║
║  │                                                                     │ ║
║  │  🔨 Builder · Sonnet 4.6 · 40 tools · 🟢 dev300943 · 🛡️ VAPT on   │ ║
║  │                                                                     │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
║  ┌─ ATTACHMENT PREVIEW (only visible when files attached) ─────────────┐ ║
║  │                                                                     │ ║
║  │  ┌──────────┐  ┌──────────────────┐  ┌───────────────────┐         │ ║
║  │  │  🖼️       │  │  📄 spec.pdf     │  │  📊 data.csv     │         │ ║
║  │  │  thumb    ×│  │  2.1 MB        × │  │  456 KB         × │         │ ║
║  │  └──────────┘  └──────────────────┘  └───────────────────┘         │ ║
║  │                                                                     │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
║  ┌─ INPUT BOX ─────────────────────────────────────────────────────────┐ ║
║  │                                                                     │ ║
║  │  ┌─────────────────────────────────────────────────────────────┐   │ ║
║  │  │                                                             │   │ ║
║  │  │  Create a business rule that validates the justification    │   │ ║
║  │  │  field when impact is set to 1-High on the incident table.  │   │ ║
║  │  │  It should run before insert and update.                    │   │ ║
║  │  │                                                             │   │ ║
║  │  └─────────────────────────────────────────────────────────────┘   │ ║
║  │                                                                     │ ║
║  │  ┌─ ACTION ROW ─────────────────────────────────────────────────┐  │ ║
║  │  │                                                              │  │ ║
║  │  │  ┌───┐  ┌─────────┐                    ┌───┐  ┌───┐  ┌───┐ │  │ ║
║  │  │  │ 📎│  │ ✨ AI   │                    │ 🎤│  │ ■ │  │ ▶ │ │  │ ║
║  │  │  └───┘  └─────────┘                    └───┘  └───┘  └───┘ │  │ ║
║  │  │   │        │                              │      │      │   │  │ ║
║  │  │   │        │                              │      │      │   │  │ ║
║  │  │   │        └── AI writing assist          │      │      │   │  │ ║
║  │  │   │            (Grammar / Enhance /        │      │      │   │  │ ║
║  │  │   │             Undo)                      │      │      └── Send  ║
║  │  │   │                                       │      │              │  ║
║  │  │   └── Attach ANY file                     │      └── Stop      │  ║
║  │  │       (images, docs, code,                │         (while AI  │  ║
║  │  │        csv, json, yaml, txt,              │          is active) │  ║
║  │  │        md — NOT executables)              │                     │  ║
║  │  │                                           └── Voice input      │  ║
║  │  │                                                                │  ║
║  │  └────────────────────────────────────────────────────────────────┘  │ ║
║  │                                                                     │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
║  This is Agentic AI and can make mistakes. Please double-check.          ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 4. COMPLETE CHAT SESSION — Full Conversation Flow

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║  ── Tab Bar ─────────────────────────────────────────────────────────── ║
║  │ ● Incident Setup │  Code Review  │  +                                ║
║  ── Mode Ribbon ─────────────────────────────────────────────────────── ║
║  │ 🔍 Explore │ 🔨 Build ● │ 🏗️ SDD │ 📊 Analyze │ 💬 Freeform │     ║
║  ─────────────────────────────────────────────────────────────────────── ║
║                                                                          ║
║ ┌─ Scrollable Messages ──────────────────────────────────────────────┐  ║
║ │                                                                    │  ║
║ │                                                                    │  ║
║ │                    ┌─────────────────────────────────────────────┐ │  ║
║ │                    │  I need a business rule on the incident     │ │  ║
║ │                    │  table that requires a justification field  │ │  ║
║ │                    │  when impact is set to High.                │ │  ║
║ │                    └─────────────────────────────────────────────┘ │  ║
║ │                                                                    │  ║
║ │  ┌──────────────────────────────────────────────────────────────┐  │  ║
║ │  │  🔨 Builder · Sonnet 4.6                           ⋮  📋    │  │  ║
║ │  │  ────────────────────────────────────────────────────────── │  │  ║
║ │  │                                                             │  │  ║
║ │  │  I'll create that for you. First, a couple of questions:    │  │  ║
║ │  │                                                             │  │  ║
║ │  │  **What should happen when the justification is missing?**  │  │  ║
║ │  │                                                             │  │  ║
║ │  │  ┌──────────────────────┐  ┌────────────────────────────┐  │  │  ║
║ │  │  │ 🚫 Block the save    │  │ ⚠️ Show warning, allow save│  │  │  ║
║ │  │  └──────────────────────┘  └────────────────────────────┘  │  │  ║
║ │  │                                                             │  │  ║
║ │  └──────────────────────────────────────────────────────────────┘  │  ║
║ │                                                                    │  ║
║ │                    ┌─────────────────────────────────────────────┐ │  ║
║ │                    │  Block the save                             │ │  ║
║ │                    └─────────────────────────────────────────────┘ │  ║
║ │                                                                    │  ║
║ │  ┌──────────────────────────────────────────────────────────────┐  │  ║
║ │  │  🔨 Builder · Sonnet 4.6                           ⋮  📋    │  │  ║
║ │  │  ────────────────────────────────────────────────────────── │  │  ║
║ │  │                                                             │  │  ║
║ │  │  Got it. I'll create:                                       │  │  ║
║ │  │  1. A custom field `u_high_impact_justification`            │  │  ║
║ │  │  2. A business rule to block saves without justification    │  │  ║
║ │  │  3. A UI policy to show the field only when impact = High   │  │  ║
║ │  │                                                             │  │  ║
║ │  │  ┌─ ARTIFACT ─────────────────────────────────────────────┐ │  │  ║
║ │  │  │  📜 Business Rule                                      │ │  │  ║
║ │  │  │  ValidateHighImpactJustification                       │ │  │  ║
║ │  │  │  Table: incident · When: before · insert, update       │ │  │  ║
║ │  │  │  sys_id: a1b2c3...                                     │ │  │  ║
║ │  │  │                                                        │ │  │  ║
║ │  │  │  🛡️ VAPT: 97/100 ─── ✅ Passed ──────────────────────  │ │  │  ║
║ │  │  │  ✅ No eval()  ✅ Error handling  ✅ Naming convention  │ │  │  ║
║ │  │  │  💡 Consider: Add sys_log for audit trail              │ │  │  ║
║ │  │  │                                                        │ │  │  ║
║ │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │ │  │  ║
║ │  │  │  │View in SN│  │Show Code │  │💾 Saved           │     │ │  │  ║
║ │  │  │  └──────────┘  └──────────┘  └──────────────────┘     │ │  │  ║
║ │  │  └────────────────────────────────────────────────────────┘ │  │  ║
║ │  │                                                             │  │  ║
║ │  │  ┌─ ARTIFACT ─────────────────────────────────────────────┐ │  │  ║
║ │  │  │  🎨 UI Policy                                          │ │  │  ║
║ │  │  │  ShowJustificationOnHighImpact                         │ │  │  ║
║ │  │  │  Table: incident · Condition: impact=1                 │ │  │  ║
║ │  │  │  sys_id: d4e5f6...                                     │ │  │  ║
║ │  │  │                                                        │ │  │  ║
║ │  │  │  🛡️ VAPT: 96/100 ─── ✅ Passed ──────────────────────  │ │  │  ║
║ │  │  │                                                        │ │  │  ║
║ │  │  │  ┌──────────┐  ┌──────────────────┐                   │ │  │  ║
║ │  │  │  │View in SN│  │💾 Saved           │                   │ │  │  ║
║ │  │  │  └──────────┘  └──────────────────┘                   │ │  │  ║
║ │  │  └────────────────────────────────────────────────────────┘ │  │  ║
║ │  │                                                             │  │  ║
║ │  │  Both artifacts are in update set "Default" and verified.   │  │  ║
║ │  │                                                             │  │  ║
║ │  │  Would you like me to create the custom field as well,      │  │  ║
║ │  │  or have you already added it?                              │  │  ║
║ │  │                                                             │  │  ║
║ │  │  ┌────────────────────────┐  ┌──────────────────────┐      │  │  ║
║ │  │  │ ✅ Create the field too│  │ Already have it       │      │  │  ║
║ │  │  └────────────────────────┘  └──────────────────────┘      │  │  ║
║ │  │                                                             │  │  ║
║ │  └──────────────────────────────────────────────────────────────┘  │  ║
║ │                                                                    │  ║
║ └────────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  ── Context Bar ─────────────────────────────────────────────────────── ║
║  🔨 Builder · Sonnet 4.6 · 40 tools · 🟢 dev300943 · 🛡️ VAPT on       ║
║  ── Input ───────────────────────────────────────────────────────────── ║
║  ┌──────────────────────────────────────────────────────────────────┐   ║
║  │  What should we work on next?                                    │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║  📎   ✨ AI                                            🎤       ▶      ║
║                                                                          ║
║  This is Agentic AI and can make mistakes. Please double-check.          ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 5. KEY INTERACTION PATTERNS SUMMARY

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  HOW USERS INTERACT WITH THE CHAT BOX:                                   │
│                                                                          │
│  1️⃣  TYPE in the input bar → AI agent handles it                         │
│     • Natural language, like talking to a person                         │
│     • Mode ribbon tells agent which tools to use                         │
│     • Context bar shows what's active                                    │
│                                                                          │
│  2️⃣  CLICK choice buttons in AI responses → quick decisions              │
│     • "Block the save" vs "Show warning"                                 │
│     • "Yes, proceed" vs "Show details"                                   │
│     • Sends choice as user message                                       │
│                                                                          │
│  3️⃣  ATTACH files via 📎 button → images + docs + code                   │
│     • Single button for everything                                       │
│     • Drag-and-drop supported                                            │
│     • Paste from clipboard supported                                     │
│                                                                          │
│  4️⃣  SWITCH MODES via ribbon → changes agent + tools                     │
│     • Explore (read-only), Build (write), SDD (SDLC), etc.              │
│     • Changes context bar + available tools                              │
│                                                                          │
│  5️⃣  EXECUTE TOOLS directly via Tool Workbench (🔧 nav icon)             │
│     • Browse categories → pick tool → fill form → Execute               │
│     • Result appears in chat as system card                              │
│     • No AI needed for simple operations                                 │
│                                                                          │
│  6️⃣  VIEW ARTIFACTS created during the session                           │
│     • Inline artifact cards with VAPT scores                             │
│     • "View in SN" opens ServiceNow in new tab                          │
│     • "Show Code" expands inline code block                              │
│     • All saved to DB automatically                                      │
│                                                                          │
│  7️⃣  VOICE INPUT via 🎤 button → speak instead of type                   │
│     • Web Speech API with Whisper fallback                               │
│     • Transcribed text appears in input                                  │
│                                                                          │
│  8️⃣  SWITCH CHATS via tabs → multiple conversations                      │
│     • Each chat has its own instance, mode, agent config                 │
│     • All messages persisted to DB                                       │
│     • Can have different chats in different browser tabs                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

*Dark theme shown. Light theme uses inverted surface/text colors with same structure.*
