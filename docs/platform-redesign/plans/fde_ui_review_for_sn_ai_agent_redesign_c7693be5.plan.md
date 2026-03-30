---
name: FDE UI Review for SN AI Agent Redesign
overview: Review Palantir AIP FDE UI (31 screenshots + 2 spec docs) via 10 parallel agents, covering all major zones. Synthesize what to take, adapt, skip, and invent for our SN AI Agent platform redesign.
todos:
  - id: synth-fde
    content: Synthesize 10 FDE review agents into actionable plan
    status: pending
isProject: false
---

# FDE UI Review — What We Can Incorporate

## Process

10 parallel agents reviewed 10 FDE UI zones. Here is the synthesized findings organized by zone, with specific component specs and file references.

---

## ZONE 1: Left Sidebar & Navigation

**Take:**

- Collapsed icon-only mode with hover tooltips showing `Label + Shortcut` (e.g., "Pause Opt Shift R")
- Section grouping with 10px uppercase muted headers (`APPLICATIONS`, `RECENT`)
- "Beta" badge on new features
- Notification bell (only shown when count > 0)
- "What's New" as a nav item

**Adapt:**

- FDE "Home" → Our "Chats" (home returns to last active chat)
- FDE "Recording controls" → Our **"Session Log"** toggle (captures MCP tool calls as developable artifact)
- FDE "Applications" → Our **"Recent Requirements"** section (last 3-5 REQ-XXX with status badges)
- FDE "AIP Assist (⌘⇧U)" → Our **"Quick Command"** (⌘K command palette)
- FDE "Support/Account" → Our **Instance name + Connection status dot**

**Novel (FDE has no equivalent):**

- **Update Set indicator** in footer: current update set name + artifact count badge
- **Phase Gate chip** at top of NavRail: `SPEC` (blue) / `DESIGN` (purple) / `IMPL` (amber) / `TEST` (green) / `DONE` (gray)
- **Scope indicator**: shows `x_snc_ai_dev` truncated to icon when in custom scope

**Component Spec — NavRail Collapsed Mode (64px):**

```
┌────────────┐
│  [Logo]    │  ← 24px icon, tap expands
├────────────┤
│  [Phase]   │  ← 20px chip: SPEC|DESIGN|IMPL|TEST|DONE
│  [Chats]   │  ← tooltip: "Chats ⌘1"
│  [Tools]   │  ← tooltip: "Tools ⌘2"
│  [Agents]  │
│  [Settings]│
├────────────┤
│  [Instance]│  ← database icon + "dev300943" tooltip
│  [UpdateSet]│ ← package icon + "12 artifacts" badge
│  [Scope]   │  ← app icon + scope tooltip (if custom)
├────────────┤
│  [Profile] │
│  [Theme]   │
└────────────┘
```

---

## ZONE 2: Main Canvas / Context Blocks

**Take:**

- **Numbered full-width vertical stack** of context blocks (not horizontal ribbon)
- **Per-block `+` add button** in block header (not single combined "+ Add")
- **"Include children" toggle** per block (FDE's most powerful pattern)
- **Session title editable** in top bar ("New session · Mar 27, 2026")
- **Code/delete icons** in top-right of each step block
- **Sub-agent cancelled**: orange italic text message

**Adapt:**
Our current horizontal ribbon → FDE's vertical numbered blocks. But for mobile/compact, keep a chip-based hybrid.

**Novel (FDE has no equivalent for SN):**

- **"Update Set Scope" block** — shows current update set + artifact preview + live warning when in "Default" (Global) scope (three-layer capture awareness from CLAUDE.md Section 13)
- **"SDD Phase Gate" block** — shows active REQ-XXX, phase progress bar, artifact count, VAPT score
- **"Instance Connection" block** — shows multi-instance awareness with sync toggle

**FDE-to-SN Block Type Mapping:**


| FDE Block         | SN Equivalent        | Color  |
| ----------------- | -------------------- | ------ |
| Ontologies        | Tables               | Blue   |
| Folders           | Update Sets          | Green  |
| Code Repositories | Scoped Apps          | Purple |
| Datasets          | Requirements         | Amber  |
| Functions         | Instance Connections | Teal   |
| Permissions       | Security Scopes      | Red    |


---

## ZONE 3: Mode Selector & Sub-Agents

**Take:**

- **Floating popup** anchored above the tab bar (not a fixed ribbon)
- **"Generate plan" as sub-agent entry** with sparkle icon, distinct from modes
- **Per-mode color + icon coding** (Transform=orange, Ontology=blue, Functions=gray, Exploration=pink)
- **"Generate plan" form** with toggles, model config, ghosted toolbar above form
- **Ghosted toolbar** ("← Summarize above" / "→ Remove below") appears at 40% opacity when context > 50% token limit

**Our "Generate plan" Equivalent for SDD Mode:**

```
┌─ GENERATE SDD PLAN ───────────────────────────────────┐
│  🏗️  Solution Design Document                          │
│  "Create a structured SDD for your requirement..."      │
│                                                         │
│  ┌─ REQUIREMENT / TASK ────────────────────────────┐   │
│  │  Describe the feature or change you want...       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  🏷️  Metadata                                         │
│  ├── Requirement ID:  [REQ-XXX (auto)             ]    │
│  ├── Priority:        [P1 ▾]                          │
│  ├── Category:       [Enhancement ▾]                  │
│  └── Target Scope:   [Global ▾]                       │
│                                                         │
│  📋  Phase Gates                                       │
│  ├── ☑ Require spec sign-off before design             │
│  ├── ☑ Require design sign-off before impl             │
│  ├── ☐ Auto-deploy after testing                       │
│                                                         │
│  🔍  Agent Behavior                                     │
│  ├── Allow exploration       [●──] ON                 │
│  ├── Allow clarifying questions [●──] ON              │
│                                                         │
│  ← Summarize context        → Clear resources           │
│  ┌──────────────┐  ┌──────────────────────────────┐    │
│  │   Cancel     │  │   🏗️ Generate SDD           │    │
│  └──────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Ghosted Toolbar Spec:**


| Context State | Opacity | When                    |
| ------------- | ------- | ----------------------- |
| Hidden        | 0%      | Context < 30% of limit  |
| Ghosted       | 40%     | Context 30-50% of limit |
| Visible       | 100%    | Context > 50% of limit  |
| Urgent        | Pulsing | Context > 80% of limit  |


---

## ZONE 4: Bottom Tab Bar & Popups

**Take:**

- **Tab bar with category-colored dot indicators** (blue=Modes, purple=Skills, white=Doc, orange=Files, green=Tables)
- **Popup appears ABOVE tab bar** (not below), anchored to the tab
- **Fade-in animation** (opacity 0→1, translateY(8→0), 200ms ease-out)
- **Closes on outside click or Escape**
- **Badge counts** showing active items (e.g., "8")

**Our 6 Tabs:**


| Tab       | Color  | Badge Shows         |
| --------- | ------ | ------------------- |
| 🤖 Modes  | Blue   | Tool count          |
| 🎯 Skills | Purple | Enabled skill count |
| 📄 Docs   | White  | Loaded doc count    |
| 📁 Files  | Orange | Attachment count    |
| 📋 Tables | Green  | Table context count |
| ⚡ Tools   | Gray   | Active tool count   |


**Skills Tab Content (our equivalent of FDE's capabilities):**

```
┌─ Skills ──────────────────────────────────┐
│  ┌─ Agent Capabilities ────────────────┐  │
│  │  ☑ Change mode                        │  │
│  │  ☑ Request clarification              │  │
│  │  ☑ Load documentation                │  │
│  │  ☐ Auto-fix issues                  │  │
│  └──────────────────────────────────────┘  │
│  ┌─ Quality & Safety ─────────────────┐  │
│  │  ☑ Phase gate enforcement             │  │
│  │  ☑ VAPT scanning (auto)              │  │
│  │  ☐ Require manual approval for writes │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

## ZONE 5: File Picker & Resource Attachment

**Take:**

- **Type-segmented picker** — 4 resource types shown as distinct options (FDE: Folders/Datasets/Code/Search)
- **Full 2-column modal picker** for browse mode (FDE step_06/07)
- **"Include children" toggle** on chips (FDE ontology) → our "Include related records" / "Include reference fields"
- **Quick filters** in left sidebar (Recent, Favorites, All)

**FDE → SN Resource Mapping:**


| FDE Type              | SN Equivalent |
| --------------------- | ------------- |
| Folders & projects    | Update Sets   |
| Datasets & media sets | Tables        |
| Code repositories     | Scoped Apps   |
| Search all            | Global search |


**Our 4-Tab Attachment Modal:**

```
┌─ Attach from ServiceNow Instance ────────────────────────── ✕  │
├───────────────────────────────────────────────────────────────┤
│  [📋 Tables]  [📦 Update Sets]  [🔒 Scoped Apps]  [📜 Artifacts]  │
│                                                                  │
│  ┌─ Left Sidebar ──────────┐  ┌─ Right Content ─────────────┐ │
│  │ ⭐ Favorites             │  │ Breadcrumb: Tables > incident │ │
│  │ 🕐 Recent               │  │ [ ] Show system fields         │ │
│  │ 📁 All tables           │  │                                │ │
│  │ 📊 By category          │  │ ┌──────────────────────────┐   │ │
│  │   Core (incident...)    │  │ │ Number    │ sys_id       │   │ │
│  │   Service Catalog       │  │ │ Short desc│ state        │   │ │
│  │   Security              │  │ └──────────────────────────┘   │ │
│  └─────────────────────────┘  └────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  Selected: incident (47 fields)        [Cancel]  [Attach]     │
└───────────────────────────────────────────────────────────────┘
```

---

## ZONE 6: Tools Modal (Most Detailed FDE Zone)

**Take:**

- **"4/114" count badge** on "All" tab — shows selected/total
- **Checkbox enable/disable** per tool (FDE's most granular control)
- **Tool name in `snake_case`** + "Details >" link for expanded description
- **Blue filled checkbox** (☑) = already-enabled tools
- **Category section headers** (Core, Code Editing, Other)
- **Pre-enabled tools** shown with blue checkmarks

**Decision: HYBRID approach (not full 147 checkboxes):**

- Per-category toggles (like we already have in `CHATBOX-FDE-INSPIRED.md`)
- Individual tool override within a category
- Phase-gated tools in SDD mode (not just mode-gated)
- VAPT warnings on high-risk tools

**NEW Category: Architecture Diagrams (from FDE's Solution Design):**

```
┌─ Architecture ─────────────────────────────┐
│ ☑ generate_architecture_diagram (Mermaid) │
│ ☑ generate_sequence_diagram                 │
│ ☑ generate_data_flow_diagram               │
│ ☑ generate_er_diagram                      │
└────────────────────────────────────────────┘
```

Leverage existing `src/core/diagram-generator.js`.

**Our Tool Categories (147 tools mapped to FDE structure):**

```
CORE: Tables & Records(12), Update Sets(8), Scoped Apps(4)
SCRIPTS: Script Includes(6), Business Rules(5), Client Scripts(4), UI Policies(4)
NOTIFICATIONS & JOBS: Notifications(6), Scheduled Jobs(4), Flow Designer(6)
QUALITY & SAFETY: VAPT/GUARDRAIL(8), Code Quality(4), ATF Testing(4), Conflict Detection(4)
ANALYSIS: Instance Analyzer(10), Dead Code Finder(2), Change Impact(2), Dependency Graph(2), ACL Analyzer(3)
DIAGRAMS: Architecture(5) ← NEW
DEPLOYMENT: Instance Compare(4), Upgrade Readiness(2), Service Catalog(6), Service Portal(4)
```

---

## ZONE 7: Model Selector & Thinking Mode

**Take:**

- **Model detail card** (right panel when hovering) — shows: Model Class badge, Cost badge, Speed badge, Context window, Max output tokens, Training cutoff, Capabilities
- **"Thinking mode" toggle** in settings section — exposes Claude extended thinking to users
- **Model list grouped by provider** ("AI ANTHROPIC" header)

**Our Model Detail Card Spec:**


| Field          | Value                       | Style                |
| -------------- | --------------------------- | -------------------- |
| Model Class    | Heavyweight / Medium / Fast | Blue/Gray/Gray badge |
| Cost           | Low / Medium / High         | Gray badge           |
| Speed          | Slow / Medium / Fast        | Gray badge           |
| Context window | Dynamic per model           | plain text           |
| Max output     | Dynamic per model           | plain text           |
| Training data  | e.g., "Up to Aug 2025"      | plain text           |
| Capabilities   | Text, Vision, etc.          | plain text           |


**Thinking Mode Implementation:**

```
Settings section (below model list):
  Thinking mode
  [●──] Enable thinking    ⓘ
```

- OFF by default, user enables per session
- When ON: shows thinking budget indicator next to model name
- `Extended thinking` parameter passed to API when enabled

---

## ZONE 8: Chat Input & Keyboard Shortcuts

**Take:**

- **Focus-triggered shortcut hint bar**: "Press Enter to send, Shift+Enter for new line, Ctrl+Enter to skip starting the agent"
- **~14-icon resource quick-attach row** with count badges (not single attach dropdown)
- **Token counter with progress bar** below input: "~11.5K / 1M tokens"
- **Send button changes to ⌘⏎ when modifier held** (shows direct execution is active)

**Shortcut Spec:**


| Shortcut         | Action                          |
| ---------------- | ------------------------------- |
| `Enter`          | Submit to AI                    |
| `Shift+Enter`    | Newline in textarea             |
| `Ctrl/Cmd+Enter` | Direct tool execution (skip AI) |
| `Escape`         | Close popups, cancel recording  |


**Token Counter Spec:**

- Position: below input, bottom-right
- Color: green < 70%, amber 70-90%, red > 90%
- Format: "~X.XK / YMK tokens"
- At > 85%: inline suggestion "Context nearly full. Consider /summarize."

**Enhanced Resource Icon Row (~12 icons):**

```
📎(3) │ 📋(1) │ 📦(1) │ 🔒 │ 📂 │ 📊 │ 📄(2) │ 🔗 │ ⚡ │ 🎯 │ 🔀 │ 📁  [+ Add]
```

Each icon is a **toggle**: click opens type-specific picker, badge shows active count.

---

## ZONE 9: Right Outline Panel & Token Tracking

**Take:**

- **Per-context-item token attribution** (FDE shows "67k → 109.4k" meaning before → after)
- **System Prompt visible** in outline with large token count
- **"0 tokens"** for items already in context (no additional cost)
- **Dynamic updates** when context blocks are added/removed
- **Active sub-agent** shown with sparkle icon + "Creating plan..." (no count)

**Our Session Outline Spec:**

```
┌─ Outline ──────────────────────────────────────────────────── ↗  │
│ Context:                                                        │
│ ⚙ System Prompt         │ 67k → 109.4k                         │
│ ◉ incident (table)      │ 0                                   │
│ 📁 REQ-005-Impl         │ 1.5k                                 │
│ ✕ Sub-agent cancelled   │ 8                                   │
│ ✦ Creating plan...      │ —                                   │
│                                                                  │
│ Preview ▸                                                        │
└──────────────────────────────────────────────────────────────────┘
```

**"67k → 109.4k" format:**

- Left = current tokens consumed by this context item
- Right = projected tokens after this item is fully resolved/expanded
- Arrow indicates direction of token growth

---

## ZONE 10: Color System & Error Handling

**Take:**

- **FDE's hex values are authoritative** — adopt #0D1117 (page bg), #161B22 (main canvas), #21262D (popup), #E6EDF3 (primary text), #8B949E (muted text)
- **Reconcile with our Blueprint dark theme** — blend FDE's darker backgrounds with Blueprint's slightly lighter tones

**Color Reconciliation (adopt FDE's values):**


| Element         | FDE     | Our Blueprint (current) | Adopt           |
| --------------- | ------- | ----------------------- | --------------- |
| Page background | #0D1117 | #0B0D12                 | Blend → #0C1018 |
| Sidebar         | #0F1219 | #0B0D12                 | FDE             |
| Main canvas     | #161B22 | #161A22                 | Blend → #161B22 |
| Card/popup      | #21262D | #1C2029                 | FDE             |
| Input field     | #1C2333 | #1C2029                 | Blend → #1C2029 |
| Primary text    | #E6EDF3 | #E6EDF3                 | Same            |
| Muted text      | #8B949E | #8B949E                 | Same            |
| Blue accent     | #3B82F6 | #4C7DFF                 | Keep ours       |
| Border/divider  | #30363D | rgba(255,255,255,0.08)  | Keep ours       |


**Standardized Error Toast:**

```
Position: top-center
Background: #DC2626 (red)
Icon: ⚠ white on red
Close: ✕ button top-right
Animation: slide down + fade in, auto-dismiss after 8s
```

Our error toasts should all use this pattern — current toasts are inconsistent.

**Toggle Switch Spec (match FDE exactly):**

- ON: #3B82F6 (blue), pill shape
- OFF: #374151 (gray)
- Size: 32px wide, 18px tall
- Thumb: white circle, 14px

---

## Summary: Take / Adapt / Skip / Novel


| Zone               | Take                                                   | Adapt                                                 | Skip                                         | Novel                                                |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| **Sidebar**        | Tooltips, section headers, Beta badge                  | Recording→SessionLog, Apps→Recent REQs, AIP Assist→⌘K | File picker, Refresh, Analytics/Grid/Monitor | Update Set indicator, Phase chip, Scope badge        |
| **Context Blocks** | Numbered vertical blocks, per-block + button           | Horizontal ribbon → vertical blocks                   | FDE's strict vertical (need hybrid)          | Update Set scope warning block, SDD phase gate block |
| **Mode Selector**  | Floating popup, sub-agent section, per-mode color+icon | SDD "Generate plan" form with phase gates             | —                                            | Ghosted "Summarize/Remove" toolbar                   |
| **Tab Bar**        | Popup anchored above, fade animation, badge counts     | Our 6 tabs with colored dots                          | Permissions/Media tabs (no SN equiv)         | Skills tab (capability toggles)                      |
| **File Picker**    | 4-type segmentation, 2-column modal                    | Full picker for SN instance files                     | OS-level file dialog                         | Table picker, Update Set picker, Scoped App picker   |
| **Tools Modal**    | 4/114 badge, checkbox per tool, Details link           | Hybrid (category + per-tool)                          | Full 147 individual checkboxes               | Architecture Diagrams category                       |
| **Model Selector** | Model detail card, thinking toggle                     | Our existing dropdown                                 | —                                            | Per-session thinking toggle                          |
| **Chat Input**     | Focus-triggered shortcut hints, ~14-icon row           | Token counter with progress bar, ⌘⏎ hint              | FDE's ~20 attachment icons                   | Resource quick-attach toggle row                     |
| **Outline Panel**  | Per-item token attribution, "67k → 109k" format        | Our outline gets per-context tokens                   | FDE's "Preview" (unused)                     | System Prompt visible in outline                     |
| **Color/Error**    | FDE hex values, error toast pattern                    | Blend FDE + Blueprint colors                          | —                                            | Standardized error toast system                      |


---

## Priority for Implementation (Phase 1)

1. **Error toast system** — self-contained, no dependency on redesign
2. **Keyboard shortcuts** (Ctrl+Enter, shortcut hint bar) — high impact, low effort
3. **Token counter with progress bar** — existing code just needs UI
4. **Mode selector popup** replacing ribbon — moderate effort, high visual impact
5. **Tool Workbench modal** with "4/147" badge — leverages existing tool definitions
6. **Context blocks** (numbered, vertical, per-block + button) — larger effort
7. **Model detail card + thinking toggle** — depends on AI SDK v6 extended thinking
8. **NavRail collapsed mode** — moderate effort
9. **Tab bar with popups** — moderate effort
10. **Right outline with per-item tokens** — larger effort

