---
name: FDE-Inspired UI Implementation Plan
overview: Implement FDE UI patterns into the SN AI Agent redesign, prioritized by impact and effort. 10 items across error handling, keyboard shortcuts, token tracking, mode selector, tool workbench, context blocks, model selector, navrail, tab bar, and outline panel.
todos:
  - id: err-toast
    content: Error toast system (#DC2626, top-center, auto-dismiss)
    status: pending
  - id: shortcuts
    content: Keyboard shortcuts (Ctrl+Enter, focus-triggered hint bar)
    status: pending
  - id: token-counter
    content: Token counter with progress bar below input
    status: pending
  - id: mode-popup
    content: Mode selector popup (floating, above tab bar, per-mode color+icon)
    status: pending
  - id: tool-workbench
    content: Tool Workbench modal (4/147 badge, hybrid category toggles, diagram tools)
    status: pending
  - id: context-blocks
    content: Context blocks (numbered vertical stack, per-block + button, include children)
    status: pending
  - id: model-card
    content: Model detail card with thinking mode toggle
    status: pending
  - id: navrail-collapsed
    content: NavRail collapsed mode (64px, tooltips, phase chip)
    status: pending
  - id: tab-bar-popups
    content: Tab bar with popups (anchored above, fade animation, colored dots)
    status: pending
  - id: outline-tokens
    content: Right outline with per-item token tracking
    status: pending
isProject: false
---

# FDE-Inspired UI Implementation Plan

## Strategy

Build all components as standalone, self-contained modules under `webapp/src/components/fde/` so nothing breaks existing `page.tsx`. All components are designed for integration into `page-v2.tsx`. Components depend only on existing state management hooks (`useSessionState`, `useConnection`).

---

## Implementation Order

### 1. Error Toast System (low effort, high impact)

**File:** `webapp/src/components/fde/ErrorToast.tsx` + `webapp/src/hooks/useErrorToast.ts`

FDE spec: top-center, #DC2626 background, white ⚠ icon, close button, auto-dismiss 8s.

```tsx
// useErrorToast.ts
interface Toast {
  id: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
}
const [toasts, addToast, removeToast] = useState<Toast[]>([]);
// Auto-dismiss after 8000ms
// Stack multiple toasts vertically
```

**Entry point:** Drop into `ChatWindow.tsx` once — `<ErrorToastContainer toasts={toasts} />`

---

### 2. Keyboard Shortcuts + Shortcut Hint Bar (high impact, low effort)

**Files:** `webapp/src/components/fde/ShortcutHintBar.tsx` (inline in `ChatInputBar`)

FDE spec: Focus-triggered hint bar below textarea showing:

- "Enter to send"
- "Shift+Enter for new line"
- "Ctrl+Enter to skip agent"

```tsx
const ShortcutHintBar = () => {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`shortcut-hint-bar ${visible ? 'visible' : 'hidden'}`}>
      <span>Enter to send</span>
      <span>Shift+Enter for new line</span>
      <span className="direct-exec">Ctrl+Enter to skip agent</span>
    </div>
  );
};
```

**Changes to `handleKeyDown` in ChatWindow.tsx:**

```tsx
// Add Ctrl/Cmd+Enter for direct execution
if (e.key === 'Enter' && (isMac ? e.metaKey : e.ctrlKey)) {
  e.preventDefault();
  handleDirectExecute(); // bypass AI
  return;
}
```

---

### 3. Token Counter with Progress Bar (low effort, high impact)

**File:** `webapp/src/components/fde/TokenCounter.tsx`

FDE spec: "~11.5K / 1M tokens" with thin progress bar below input, bottom-right. Color: green < 70%, amber 70-90%, red > 90%.

```tsx
const TokenCounter = ({ used, limit }) => {
  const pct = (used / limit) * 100;
  const color = pct < 70 ? 'green' : pct < 90 ? 'amber' : 'red';
  return (
    <div className="token-counter">
      <div className="token-bar">
        <div className={`token-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="token-text">~{formatTokens(used)} / {formatTokens(limit)}</span>
    </div>
  );
};
```

Read token counts from existing `useSessionState` (messages array already tracked).

---

### 4. Mode Selector Popup (floating, above tab bar)

**File:** `webapp/src/components/fde/ModePopup.tsx`

FDE pattern: Floating card anchored ABOVE the tab bar, per-mode color + icon, sub-agent section with "Generate plan".

```tsx
const ModePopup = ({ isOpen, anchorEl, onSelect, currentMode }) => {
  // Positioned absolute, bottom: 100% from tab bar
  // Sections: SUB-AGENTS (Generate plan, Debug session) then MODES
  // Each mode: colored icon + label + hover highlight
  // Selected = blue background (#1E3A5F)
};
```

**Mode colors:**


| Mode    | Color   | Icon         |
| ------- | ------- | ------------ |
| Explore | #4C7DFF | Search       |
| Build   | #38C976 | Hammer       |
| SDD     | #A78BFA | Construction |
| Analyze | #F5C451 | Chart        |
| Operate | #F97373 | Lightning    |
| Flow    | #45B7D1 | Wave         |


**CSS animation:**

```css
.mode-popup {
  animation: fadeSlideUp 200ms ease-out;
}
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

### 5. Tool Workbench Modal (4/147 badge, hybrid toggles)

**File:** `webapp/src/components/fde/ToolWorkbench.tsx`

FDE pattern: Full-width modal, 2-column (category sidebar + tool list), "4/147" badge, checkbox per tool, "Details >" link.

```tsx
<ToolWorkbench
  open={toolWorkbenchOpen}
  onClose={() => setToolWorkbenchOpen(false)}
  currentMode={phase}
  enabledTools={enabledTools}
  onToggleTool={(id) => toggleTool(id)}
/>
```

**Header:**

```tsx
<div className="tool-workbench-header">
  <Input prefix={<SearchIcon />} placeholder="Search tools..." />
  <div className="tool-count-badge">
    <span className="enabled">{enabledCount}</span>
    <span className="sep">/</span>
    <span className="total">{totalCount}</span>
  </div>
</div>
```

**Left sidebar categories (FDE-structured):**

```
CORE: Tables & Records, Update Sets, Scoped Apps
SCRIPTS: Script Includes, Business Rules, Client Scripts, UI Policies
NOTIFICATIONS & JOBS: Notifications, Scheduled Jobs, Flow Designer
QUALITY & SAFETY: VAPT/GUARDRAIL, Code Quality, ATF Testing, Conflict Detection
ANALYSIS: Instance Analyzer, Dead Code Finder, Change Impact, Dependency Graph, ACL Analyzer
DIAGRAMS: Architecture Diagrams (NEW — leverage src/core/diagram-generator.js)
DEPLOYMENT: Instance Compare, Upgrade Readiness, Service Catalog, Service Portal
```

**Tool row with Details expansion:**

```tsx
const ToolRow = ({ tool, enabled, onToggle }) => (
  <div className={`tool-row ${enabled ? 'enabled' : ''}`}>
    <Checkbox checked={enabled} onChange={onToggle} />
    <span className="tool-name">{tool.name}</span>
    <button className="details-link" onClick={() => openDetails(tool)}>
      Details ▶
    </button>
    {/* Expanded: shows inputSchema params inline */}
    {open && <SchemaViewer schema={tool.inputSchema} />}
  </div>
);
```

---

### 6. Context Blocks (numbered vertical stack, per-block + button)

**File:** `webapp/src/components/fde/ContextBlockPanel.tsx`

FDE pattern: Full-width numbered cards stacked vertically above chat.

```tsx
interface ContextBlock {
  id: string;
  type: 'table' | 'update-set' | 'scoped-app' | 'requirement' | 'instance';
  title: string; // e.g., "+ Context: Tables"
  chips: ContextChip[];
  cascadeToggle?: { label: string; enabled: boolean };
  warning?: { text: string; severity: 'info' | 'warning' | 'error' };
}

const ContextBlockPanel = ({ blocks }) => (
  <div className="context-block-panel">
    {blocks.map((block, i) => (
      <ContextBlockItem key={block.id} block={block} index={i + 1} />
    ))}
  </div>
);
```

**SN-specific block types (FDE has no equivalent):**

- **Update Set Scope block** — shows current US name + artifact count + live "Default update set" warning
- **SDD Phase Gate block** — shows REQ-XXX + phase progress bar (SPEC→DESIGN→IMPL→TEST→DEPLOY) + VAPT score
- **Instance Connection block** — multi-instance awareness with sync toggle

**Include children toggle (FDE's most powerful pattern):**

```tsx
{/* On Table block */}
<div className="cascade-toggle">
  <span>Include reference fields</span>
  <Switch checked={includeRef} onChange={setIncludeRef} />
  <InfoIcon tooltip="Include fields from referenced tables" />
</div>
```

---

### 7. Model Detail Card + Thinking Mode Toggle

**File:** `webapp/src/components/fde/ModelSelector.tsx`

FDE pattern: Dropdown trigger → full model list → hover/select shows detail card (right panel).

```tsx
<ModelSelector
  currentModel={model}
  onChange={setModel}
  extendedThinking={extendedThinking}
  onToggleThinking={setExtendedThinking}
/>
```

**Model detail card (right panel on hover):**

```
┌─────────────────────────────┐
│ [A] Claude Opus 4.6         │
│ Anthropic                   │
│                             │
│ Class:  [Heavyweight]       │
│ Cost:   [Medium]            │
│ Speed:  [Medium]            │
│                             │
│ Context:     1M tokens      │
│ Max output:  128K tokens    │
│ Training:    Aug 2025        │
│ Capability:  Text, Vision    │
└─────────────────────────────┘
```

**Thinking toggle (in settings section of dropdown):**

```tsx
<div className="thinking-toggle">
  <label>Thinking mode</label>
  <Switch
    checked={extendedThinking}
    onChange={setExtendedThinking}
    color="#3B82F6"
  />
  <InfoIcon tooltip="Enable extended thinking for complex tasks" />
</div>
```

---

### 8. NavRail Collapsed Mode (64px, tooltips, phase chip)

**File:** `webapp/src/components/fde/NavRailCollapsed.tsx`

FDE pattern: 64px wide icon-only strip, hover tooltips with label + shortcut.

```tsx
const NavRailCollapsed = ({ phase, instance, updateSet, scope, onExpand }) => (
  <div className="navrail-collapsed">
    <button className="nav-item logo" onClick={onExpand}>[Logo]</button>

    {/* Phase chip — top, always visible */}
    <PhaseChip phase={phase} />

    {/* Core nav */}
    <NavTooltip icon={<ChatsIcon />} label="Chats" shortcut="⌘1" />
    <NavTooltip icon={<ToolsIcon />} label="Tools" shortcut="⌘2" />
    <NavTooltip icon={<AgentsIcon />} label="Agents" />
    <NavTooltip icon={<SettingsIcon />} label="Settings" />

    <div className="nav-divider" />

    {/* Instance info */}
    <NavTooltip icon={<DBIcon />} label={instance} />
    <NavTooltip icon={<PackageIcon />} label={`${updateSet.name} · ${updateSet.count} artifacts`} />
    {scope !== 'global' && <NavTooltip icon={<AppIcon />} label={scope} />}

    <div className="nav-divider" />
    <NavTooltip icon={<UserIcon />} label="Profile" />
    <NavTooltip icon={<ThemeIcon />} label="Toggle theme" />
  </div>
);
```

**Tooltip component:**

```tsx
const NavTooltip = ({ icon, label, shortcut }) => (
  <div className="nav-tooltip-wrapper">
    <button className="nav-icon-btn">{icon}</button>
    <div className="nav-tooltip">
      {label} {shortcut && <span className="shortcut">{shortcut}</span>}
    </div>
  </div>
);
```

**Phase chip colors:**


| Phase          | Color   |
| -------------- | ------- |
| SPEC           | #3B82F6 |
| DESIGN         | #A78BFA |
| IMPLEMENTATION | #F59E0B |
| TESTING        | #22C55E |
| DEPLOYED       | #6B7280 |


---

### 9. Tab Bar with Popups (anchored above, fade animation, colored dots)

**File:** `webapp/src/components/fde/TabBar.tsx`

FDE pattern: Fixed tab bar above input, 6 tabs with colored dot indicators, popup appears ABOVE tab bar.

```tsx
const TabBar = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'modes', icon: <BotIcon />, color: '#4C7DFF', badge: toolCount },
    { id: 'skills', icon: <CheckIcon />, color: '#A855F7', badge: skillCount },
    { id: 'docs', icon: <DocIcon />, color: '#E6EDF3', badge: docCount },
    { id: 'files', icon: <FolderIcon />, color: '#F59E0B', badge: fileCount },
    { id: 'tables', icon: <TableIcon />, color: '#22C55E', badge: tableCount },
    { id: 'tools', icon: <WrenchIcon />, color: '#8B949E', badge: enabledToolCount },
  ];

  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange(activeTab === tab.id ? null : tab.id)}
        />
      ))}
    </div>
  );
};
```

**Popup positioning:**

```tsx
// Positioned above tab bar via absolute positioning
const popupStyle = {
  position: 'absolute',
  bottom: tabBarHeight + 8, // 8px gap
  left: tabRect.left,
  minWidth: '320px',
  maxWidth: '420px',
};
```

**Popup close on outside click:**

```tsx
useEffect(() => {
  if (!activeTab) return;
  const handleClick = (e) => {
    if (!tabBarRef.current?.contains(e.target) &&
        !popupRef.current?.contains(e.target)) {
      onTabChange(null);
    }
  };
  document.addEventListener('mousedown', handleClick);
  return () => document.removeEventListener('mousedown', handleClick);
}, [activeTab]);
```

---

### 10. Right Outline with Per-Item Token Tracking

**File:** `webapp/src/components/fde/SessionOutline.tsx`

FDE pattern: ~220px right panel, each context item has icon + label + "67k → 109.4k" token range.

```tsx
const SessionOutline = ({ contextItems, systemPromptTokens }) => (
  <div className="session-outline">
    <div className="outline-header">
      <span>Outline</span>
      <button className="expand-btn">↗</button>
    </div>

    <div className="outline-section">
      <div className="section-label">Context:</div>
      <OutlineItem
        icon={<GearIcon />}
        label="System Prompt"
        tokens={`${systemPromptTokens.current} → ${systemPromptTokens.projected}`}
      />
      {contextItems.map(item => (
        <OutlineItem
          key={item.id}
          icon={getTypeIcon(item.type)}
          label={item.label}
          tokens={item.tokenCount === 0 ? '0' : formatTokens(item.tokenCount)}
          isActive={item.status === 'active'}
          isCancelled={item.status === 'cancelled'}
        />
      ))}
    </div>

    <div className="outline-footer">
      <span className="preview-label">Preview ▸</span>
    </div>
  </div>
);
```

**Token format:**

- "67k → 109.4k" = current → projected
- "0" = item adds no tokens (already in context)
- "—" = in progress (no count yet)

---

## New CSS Variables (add to globals.css)

```css
:root {
  /* FDE + Blueprint color reconciliation */
  --bg-page: #0C1018;
  --bg-sidebar: #0F1219;
  --bg-main: #161B22;
  --bg-card: #21262D;
  --bg-input: #1C2029;
  --bg-context-block: #1C2333;
  --text-primary: #E6EDF3;
  --text-muted: #8B949E;
  --accent-blue: #4C7DFF;
  --accent-green: #22C55E;
  --accent-orange: #F59E0B;
  --accent-red: #EF4444;
  --accent-purple: #A855F7;
  --accent-teal: #45B7D1;
  --border: rgba(255, 255, 255, 0.08);
  --toggle-on: #3B82F6;
  --toggle-off: #374151;

  /* Shadows */
  --shadow-popup: 0 8px 32px rgba(0, 0, 0, 0.4);
  --shadow-toast: 0 4px 16px rgba(220, 38, 38, 0.3);
}
```

---

## File Structure

```
webapp/src/
├── components/fde/
│   ├── ErrorToast.tsx          # 1. Error toast system
│   ├── useErrorToast.ts        # Toast state hook
│   ├── ShortcutHintBar.tsx     # 2. Keyboard shortcut hints (inline in ChatInputBar)
│   ├── TokenCounter.tsx         # 3. Token progress bar
│   ├── ModePopup.tsx           # 4. Mode selector floating popup
│   ├── ToolWorkbench.tsx       # 5. Tools modal with 4/147 badge
│   ├── ContextBlockPanel.tsx   # 6. Numbered vertical context blocks
│   ├── ContextBlockItem.tsx     # 6. Individual context block
│   ├── ModelSelector.tsx         # 7. Model selector with detail card + thinking
│   ├── NavRailCollapsed.tsx    # 8. Collapsed NavRail with tooltips
│   ├── NavTooltip.tsx          # 8. Tooltip for collapsed nav items
│   ├── TabBar.tsx              # 9. Bottom tab bar with popups
│   ├── TabPopup.tsx             # 9. Generic tab popup container
│   ├── SessionOutline.tsx       # 10. Right outline with token tracking
│   ├── OutlineItem.tsx          # 10. Individual outline row
│   └── fde.css                  # All FDE component styles
```

---

## Integration Points


| Component         | Integrates Into                      | Via                              |
| ----------------- | ------------------------------------ | -------------------------------- |
| ErrorToast        | `ChatWindow.tsx`                     | `useErrorToast` hook             |
| ShortcutHintBar   | `ChatInputBar` (inside ChatWindow)   | Inline component                 |
| TokenCounter      | Below input in `ChatWindow`          | Read from session state          |
| ModePopup         | Bottom of chat area, above TabBar    | Triggered by mode pill           |
| ToolWorkbench     | Full modal overlay                   | Triggered by Tools tab or button |
| ContextBlockPanel | Above chat messages in `page-v2.tsx` | Replaces context ribbon          |
| ModelSelector     | Replaces existing ModelSelector.tsx  | Props: model, thinking, onChange |
| NavRailCollapsed  | Left side of `page-v2.tsx`           | Replaces NavRail when collapsed  |
| TabBar            | Above input, below ModePopup         | 6-tab fixed bar                  |
| SessionOutline    | Right side of `page-v2.tsx`          | Replaces existing outline        |


