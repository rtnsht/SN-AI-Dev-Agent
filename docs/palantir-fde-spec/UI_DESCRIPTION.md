# Palantir AIP FDE (Foundry Development Environment) — Complete UI Specification

## Application Overview

This is **Palantir AIP FDE** (AI Platform - Foundry Development Environment), a dark-themed and light-themed AI-powered development IDE for building ontology-based applications on the Palantir Foundry platform. It uses an agentic chat interface powered by Claude models, with context-aware tools for code, data, and ontology manipulation.

**Resolution:** 1280 × 642 (observed)  
**Theme:** Dark mode (deep navy/charcoal backgrounds, white/light gray text)  
**Primary Font:** Sans-serif (likely Inter or similar system font)  
**Accent Colors:** Blue (#3B82F6 range) for active states, teal/green for ontology badges, orange/amber for file badges, pink/red for error toasts

---

## Global Layout (3-Column)

### Column 1: Left Sidebar (~120px wide, collapsible)

**Background:** Slightly darker than the main canvas (#0F1117 range)

**Top Section — Navigation Links:**
| Icon | Label | Shortcut |
|------|-------|----------|
| 🏠 | Home | — |
| 🔍 | Search... | ⌘ I |
| 🔔 | Notifications | — |
| ✨ | What's New | — |

**Middle Section — "Recent" group:**
- Recent
- Files
- Applications

**Applications Section:**
- Header: "APPLICATIONS" (uppercase, muted gray, ~10px font)
- Item: "AI FDE" with a small colored icon and "Beta" badge below it

**Recording Controls (mid-sidebar):**
- Red circle record button (active recording indicator)
- Timestamp display (e.g., "0:00", "0:14", "1:04", etc.)
- Pause button (⏸)

**Bottom Section — Fixed Footer Links:**
- AIP Assist (with keyboard shortcut ⌘ ⇧ U)
- Support
- Account

**Collapsed State (step_31):** When sidebar text labels are hidden, only icons remain visible in a narrow strip. A tooltip appears on hover showing the label + shortcut (e.g., "Pause Opt Shift R").

Additional icon buttons visible in collapsed sidebar:
- Pause/Record
- Refresh/Reload
- Analytics/Chart
- Grid/Dashboard
- Monitor/Screen

---

### Column 2: Main Canvas / Chat Area (~700-800px, flexible)

**Background:** Dark charcoal (#1A1D27 range)

**Top Bar:**
- Left: Palantir logo (circular green icon) + "AI FDE" title + hamburger menu (≡)
- Center: Session title — "New session · Mar 27, 2026, 8:01 AM" (editable)
- Right: "Show system prompt" button with refresh/settings icon (⚙)
- Loading spinner (appears next to session title during processing)

**Context Blocks (numbered, stacked vertically):**

Each context block is a full-width card with:
- **Number badge** on the left (e.g., "1", "2", "3") — muted gray circle
- **Header bar** with type label (darker background strip):
  - "**+ Context: Ontologies**" — with a "+" icon to add more
  - "**+ Context: Folders**" — with a "+" icon to add more
- **Content area** below the header showing attached items as pill/badge chips:
  - Ontology chip: Green/teal circle icon + "uk dental Ontology" (rounded pill, dark bg)
  - Folder chip: Gray folder icon + "uk-dental" (rounded pill, dark bg)
  - Toggle: "Include children" with a blue toggle switch (ON) and info icon (ⓘ)

**Step 3 — Agent Output Area:**
- When a sub-agent runs and is cancelled, shows: *"The sub-agent was cancelled"* in italicized orange/amber text
- Code/delete icons (</> and 🗑) appear in the top-right of each step block

**Generate Plan Form (step_11, step_12):**
- Header: "Generate plan"
- Description text: "Describe the task you want to generate a plan for. All previous context will be available to the planning agent."
- Input field: Placeholder "Describe the task..." (full-width text input, dark bg, subtle border)
- Toggle 1: "Allow exploration" (blue toggle, ON) with info icon (ⓘ)
- Toggle 2: "Allow the model to ask clarifying questions or request resources" (blue toggle, ON) with info icon (ⓘ)
- Section: "Relevant resources:" with "▼ Add resources" expandable
- Model config: "Configure model: ≡ Claude Opus 4.6 ▾" (dropdown)
- Action buttons at bottom:
  - Left: "Cancel" (full-width, secondary/outline style)
  - Right: "✓ Generate plan" (full-width, primary/filled style)
- Above the form: ghosted toolbar buttons "← Summarize above" and "→ Remove below"

---

### Column 3: Right Sidebar — Outline Panel (~220px)

**Header:** "Outline" with an expand/fullscreen icon (↗) on the right  
**Background:** Slightly different shade from main canvas

**Content — "Context:" section:**
| Icon | Label | Token Count |
|------|-------|-------------|
| ⚙ (gear/circle) | System Prompt | 67k → 109.4k (or 53k → 3k) |
| ◉ (green circle) | uk dental Ontology | 0 |
| 📁 (folder) | uk-dental | 1.5k |
| ✕ (x mark) | Sub-agent creation cancelled | 8 |
| ✦ (sparkle) | Creating plan | — |

- Each item shows a **token count** on the far right (e.g., "67k → 109.4k", "0", "1.5k", "8")
- The outline updates dynamically as context blocks are added/removed

**Bottom:** "Preview" label (collapsed panel, expandable)

---

## Bottom Toolbar (Fixed Footer Bar)

### Resource Tabs Row

A horizontally scrollable tab bar with category-colored dot indicators:

| Tab | Icon/Color | Badge |
|-----|-----------|-------|
| 🤖 Modes | Blue grid icon | — |
| 🎯 Skills | Purple dot | "8" (when active) |
| 📄 Documentation | White/gray doc icon | "8" (when active) |
| 📁 Files | Orange dot | "8" (when active) |
| ◉ Ontology | Green dot | "8" (when active) |
| ⚡ Functions | Gray dot | — |
| 🔒 Permissions | Purple dot | — |
| 🖼 Media | Gray dot | — |

Each tab, when clicked, opens a popup menu above the toolbar.

### Chat Input Area

- Full-width text input: Placeholder "Ask a question or prompt an agent to perform a task on your Foundry instance..."
- Background: Slightly lighter than main canvas, rounded corners, subtle border
- Keyboard shortcut hint (appears on focus): "Press **Enter** to send, **Shift+Enter** for new line, **Ctrl+Enter** to skip starting the agent"

**Left side of input — Attachment icons row:**
Small icon buttons (each with a count badge showing "0" or a number):
- 📎 Attachment
- 📧 (0)
- 📄 (3 or 0)
- 🔗 (0)
- 📊 (0)
- Several more icon buttons in sequence (approximately 20+ tiny icon buttons)

The icon row uses very small icons (~14px) with count badges, serving as quick-attach shortcuts for different resource types.

**Right side of input:**
- ≡ (hamburger/settings) icon
- Model selector: "Claude Opus 4.6 ▾" (dropdown trigger)
- 🎙 Microphone button
- ▶ Send/Submit button (right-arrow icon, blue accent)

**Far bottom-right (outside input):**
- Token counter: "~11.5K / 1M tokens" (usage indicator with progress bar)
- Or after actions: "~5K / 1M tokens"

---

## Popup Menus (Triggered from Bottom Tabs)

### Modes Tab Popup (step_01, step_09, step_10)

Appears as a floating card above the Modes tab:

**Sub-agents section:**
- ✦ **Generate plan** (sparkle icon, likely purple/magenta)

**Modes section:**
- 🔄 **Transform data** (orange/red icon)
- ◉ **Modify ontology** (blue circle icon)
- ⚡ **Write functions** (gray code icon)
- ✕ **Exploration** (pink/red X icon)
- 🟩 **OSDK React** (green square icon)

Hover state: Item gets a subtle light background highlight

### Skills Tab Popup (step_02)

Floating card with checkmark items:
- ✓ Change mode
- ✓ Request clarification
- ✓ Load documentation

### Documentation Tab Popup (step_03, step_04)

**Loading state (step_03):** Shows "↑ Loading prompts..." with items appearing:
- Left column: ✓ Change mode, ✓ Request clarification, ✓ Load documentation
- Right column: Foundry documentation, Documentation bundles, Documentation pages

**Loaded state (step_04):**
- **Custom documentation** section: "No prompts found"
- **Foundry documentation** section:
  - 📦 Documentation bundles
  - 📄 Documentation pages

### Files Tab Popup (step_05, step_14, step_20)

Floating card with file type options:
- 📁 **Folders & projects** (orange folder icon)
- 📊 **Datasets & media sets** (blue/teal icon)
- 💻 **Code repositories** (dark terminal icon)
- 🔍 **Search all** (magnifying glass icon)

### Ontology Tab Popup (step_15)

Floating card with ontology resource types:
- ◉ **Ontologies** (green circle)
- 📊 **Objects** (grid icon)
- ⚡ **Action type** (lightning icon)
- 🔲 **Interfaces** (dashed square icon)
- ◉ **Object types** (blue circle icon)

### Functions Tab Popup (step_16)

Extends the Ontology popup with additional items:
- All Ontology items (same as above)
- Plus: 📊 **Language models**, ⚡ **Ontology functions**

### Branch Menu (step_17)

Small floating card near the branch icon (top-right of toolbar area):
- 🔍 Search branches
- \+ Create branch

---

## File Picker Dialog (step_06, step_07)

**Modal overlay** centered on screen, dark semi-transparent backdrop.

**Header:** "Open" title + "Search files..." input (full-width, blue-bordered) + Close (✕) button

**Layout — 2-column:**

**Left sidebar:**
- "Select a space..." dropdown
- **Quick access links:**
  - Recent files
  - Favorites
  - All projects
  - Data Catalog
  - Object datasources
  - Shared with you
- **Type filter section:**
  - Multiple file type rows with colored icons and badges (blurred/redacted in video)
- **Tags:** "Click to search for tags..." input

**Right content area:**
- Breadcrumb: "All > Recent files"
- "Show hidden" checkbox toggle (top-right)
- File listing rows (blurred/loading lines representing file entries)

**Footer:**
- "Cancel" button (outline/secondary)
- "Select" button (blue, primary)

---

## Tools Modal (step_19 through step_26)

Full-width modal overlay with a search bar and categorized tool list.

**Header:** 🔍 "Search tools..." input + "Clear" button (top-right)

**Layout — 2-column:**

### Left Column — Tool Categories (scrollable list)

**"All" tab** at top: Shows total count badge (e.g., "4/114")

**Core section:**
| Category | Count |
|----------|-------|
| 📊 Datasets | 0/6 |
| 🔀 Foundry Branching | 0/3 |
| ◉ Ontology | 0/18 |

**Code Editing section:**
| Category | Count |
|----------|-------|
| 🤖 AIP Logic | 0/9 |
| ✏️ Authoring | 0/4 |
| 💻 Code Repositories | 0/5 |
| </> Code Workspaces | 0/6 |
| ⚙️ Pipeline Builder | 0/8 |

**Other section:**
| Category | Count |
|----------|-------|
| 🔐 Cipher | 0/5 |
| 📊 Evals | 0/7 |
| 📁 Filesystem | 0/3 |
| ⚡ Functions | 0/7 |
| 🔀 Local Branching | 0/3 |
| ◉ Ontology SDK | 0/2 |
| 🟩 OSDK React | 0/5 |
| 🔒 Permissions | 0/4 |
| 📋 Planning | 4/5 |
| 🔍 Search | 0/6 |
| 📐 Solution Design | 0/4 |

Selected category gets a **blue highlight background** and shows its tools in the right column.

### Right Column — Tool Details

Shows tools for the selected category. Each tool is a row with:
- Checkbox (☐) to enable/disable the tool
- Tool name in `snake_case` format (e.g., `ci_checks`, `create_code_repo`, `load_code_repo`)
- Some tools have "Details >" link for more info
- Blue filled checkboxes (☑) indicate already-enabled tools

**Example categories and their tools:**

**Code Repositories (0/5):**
- ☐ ci_checks
- ☐ create_code_repo
- ☐ load_code_repo
- ☐ add_missing_project_imports ... (Details >)
- ☐ create_tag

**Code Workspaces (0/6):**
- ☐ container_get_file_contents
- ☐ container_put_file ⚙
- ☐ container_edit_file
- ☐ container_sync

**Pipeline Builder (scrolled view):**
- ☐ create_pipeline_builder
- ☐ get_pipeline_builder_definition
- ☐ put_pipeline_builder
- ☐ edit_pipeline_builder
- ☐ preview_pipeline_builder_node
- ☐ lookup_pipeline_expression_declarations
- ☐ lookup_pipeline_transform_declarations
- ☐ deploy_pipeline_builder (Details >)

**Planning (4/5):**
- ☐ generate_plan
- ☑ load_documentation (blue checkmark — enabled)
- ☑ load_documentation_bundles (blue checkmark — enabled)
- ☑ request_clarification_from_user (blue checkmark — enabled)
- ☑ change_mode (blue checkmark — enabled)

**Ontology (0/18):**
- **OBJECT** sub-header:
  - ☐ load_object_types
  - ☐ edit_object_type
  - ☐ create_object_type
  - ☐ create_object_type_permissions_datas...
  - ☐ edit_object_type_conditional_formatting
  - ☐ delete_object_type
- **ACTION** sub-header:
  - ☐ load_action_types
  - ☐ edit_action_type

**Cipher (0/5):**
- ☐ cipher_get_channel
- ☐ cipher_get_license
- ☐ list_cipher_channels_in_folder
- ☐ cipher_create_channel
- ☐ cipher_create_license

**OSDK React (0/5):**
- ☐ publish_osdk_react_app_or_widget
- ☐ request_ontology_api_access_for_custom...
- ☐ get_ontology_sdk_resources
- ☐ create_or_edit_ontology_sdk
- ☐ create_widget_set

**Solution Design (0/4):**
- ☐ get_solution_design_diagram
- ☐ modify_solution_design_diagram
- ☐ patch_solution_design_diagram
- ☐ create_solution_design_diagram

---

## Model Selector Dropdown (step_27, step_28)

Floating dropdown anchored to the model selector button in the chat input.

**Header:** 🔍 "Search models..." input + "Clear" button

### Model List (scrollable)

**AI ANTHROPIC section:**
| Model Name |
|------------|
| Claude 3 Haiku |
| Claude 3.5 Haiku |
| Claude 3.5 Sonnet V2 |
| Claude 3.7 Sonnet |
| Claude Haiku 4.5 |
| Claude Opus 4 |
| Claude Opus 4.1 |
| Claude Opus 4.5 |
| **Claude Opus 4.6** (highlighted/selected — blue text) |
| Claude Sonnet 4 |
| Claude Sonnet 4.5 |
| Claude Sonnet 4.6 |

### Model Detail Card (right panel, step_28)

When a model is selected/hovered, a detail card appears:
- **Model icon:** Anthropic "A" logo (dark circle)
- **Model name:** "Claude Opus 4.6" (bold, large)
- **Provider:** "Anthropic" (muted text)
- **External link icon** (↗)

**Specs table:**
| Property | Value | Style |
|----------|-------|-------|
| Model Class | Heavyweight | Blue badge |
| Cost | Medium | Gray badge |
| Speed | Medium | Gray badge |

**Additional details:**
| Property | Value |
|----------|-------|
| Context window | 1M tokens |
| Max output tokens | 128K tokens |
| Training data | Up to Aug 2025 |
| Capability | Text, Vision |

### Settings Section (below model list)

- **Thinking mode** label
- Toggle: "Enable thinking" (OFF/dark) with info icon (ⓘ)

---

## Error Toast (step_30)

**Position:** Top-center of the screen  
**Style:** Red/pink background (#DC2626 range), rounded corners, with close (✕) button  
**Icon:** ⚠ Warning circle (white on red)  
**Text:** "Unable to access microphone [NotAllowedError] Permission dismissed"

---

## Color System Summary

| Element | Color (approx hex) |
|---------|-------------------|
| Page background | #0D1117 |
| Sidebar background | #0F1219 |
| Main canvas background | #161B22 |
| Context block header bg | #1C2333 |
| Card/popup background | #21262D |
| Input field background | #1C2333 |
| Primary text | #E6EDF3 |
| Secondary/muted text | #8B949E |
| Blue accent (active tabs, badges) | #3B82F6 |
| Green accent (ontology) | #22C55E |
| Orange accent (files) | #F59E0B |
| Red accent (record, errors) | #EF4444 |
| Purple accent (skills, permissions) | #A855F7 |
| Selected item highlight | #1E3A5F (subtle blue bg) |
| Toggle ON | #3B82F6 |
| Toggle OFF | #374151 |
| Border/divider | #30363D |
| Badge background | #21262D |
| Pill chip background | #1E2533 |

---

## Typography Summary

| Element | Size (approx) | Weight | Color |
|---------|--------------|--------|-------|
| App title "AI FDE" | 16px | Bold | White |
| Session title | 13px | Regular | #8B949E |
| Section headers (APPLICATIONS) | 10px | Bold/Uppercase | #8B949E |
| Nav items (Home, Search...) | 13px | Regular | #E6EDF3 |
| Context block title | 13px | Semibold | White |
| Pill/chip text | 12px | Medium | White |
| Tab labels | 12px | Medium | #E6EDF3 |
| Tool names (snake_case) | 13px | Regular (monospace-like) | #E6EDF3 |
| Modal title | 14px | Semibold | White |
| Count badges | 11px | Medium | #8B949E |
| Token counter | 11px | Regular | #8B949E |
| Input placeholder | 13px | Regular | #8B949E |
| Keyboard shortcuts | 11px | Regular | #8B949E |

---

## Interaction Flow Summary (Click-by-Click)

1. **step_01** — Initial state: Main canvas shows 2 context blocks (Ontologies + Folders), Modes popup open showing Sub-agents and Modes options
2. **step_02** — Click "Skills" tab: Shows popup with enabled skills (Change mode, Request clarification, Load documentation)
3. **step_03** — Click "Documentation" tab: Shows loading state with "Loading prompts..." then populates
4. **step_04** — Documentation loaded: Shows "Custom documentation" (empty) and "Foundry documentation" with bundles and pages
5. **step_05** — Click "Files" tab: Shows popup with file type options (Folders & projects, Datasets, Code repos, Search all)
6. **step_06** — Click a file option: Opens OS-level file picker dialog (loading state)
7. **step_07** — File picker loaded: Shows full file browser with sidebar (Recent, Favorites, All projects, etc.) and file listing
8. **step_08** — Close file picker: Returns to main view
9. **step_09** — Click "Modes" tab: Popup shows with Exploration highlighted on hover
10. **step_10** — Hover "Transform data" in modes: Highlight shifts
11. **step_11** — Click "Generate plan": Step 3 form appears with task description input, toggles, resources, and model config
12. **step_12** — Generate plan form detail: Shows toolbar buttons (Summarize above / Remove below) above the form
13. **step_13** — Cancel the plan: Shows "The sub-agent was cancelled" message, outline updates
14. **step_14** — Click "Files" tab again: Popup re-appears
15. **step_15** — Click "Ontology" tab: Shows ontology resource types (Ontologies, Objects, Action type, Interfaces, Object types)
16. **step_16** — Click "Functions" tab: Extends the menu with Language models and Ontology functions
17. **step_17** — Click branch icon: Shows "Search branches" and "Create branch" options
18. **step_18** — Click into chat input: Shows focus state with keyboard shortcut hints (Enter, Shift+Enter, Ctrl+Enter)
19. **step_19** — Open tools modal: Full tools browser with categorized left sidebar and tool checkboxes on right
20. **step_20** — Scroll tools modal: Shows Pipeline Builder tools and Planning section
21. **step_21** — Click "Ontology" category: Shows Object and Action sub-headers with tool list
22. **step_22** — Click "Cipher" category: Shows Cipher-related tools
23. **step_23** — Click "OSDK React" category: Shows OSDK React tools
24. **step_24** — Click "Solution Design" category: Shows diagram-related tools
25. **step_25** — Scroll back to "Code Repositories": Shows repo tools again
26. **step_26** — Click "Planning" category: Shows planning tools with some pre-enabled (blue checkmarks)
27. **step_27** — Click model selector: Opens model dropdown with Anthropic Claude models list and settings
28. **step_28** — Hover/select "Claude Opus 4.6": Shows detail card with model specs (Heavyweight, Medium cost/speed, 1M context, Vision)
29. **step_29** — Close model selector: Returns to main view with toolbar visible
30. **step_30** — Click microphone button: Error toast appears — "Unable to access microphone" permission error
31. **step_31** — Hover sidebar bottom: Shows collapsed sidebar with icon-only view and keyboard shortcut tooltip

---

## Key UI Patterns for Cursor Implementation

### Popup Behavior
- Tab popups appear **above** the tab bar, anchored to the clicked tab
- They close when clicking outside or clicking another tab
- Smooth fade-in animation

### Modal Behavior
- Tools modal and file picker are centered overlays with dark backdrop
- Close via ✕ button, Cancel button, or clicking backdrop

### Toggle Switches
- Standard iOS-style toggle (pill shape)
- Blue (#3B82F6) when ON, gray (#374151) when OFF
- Text label to the right of toggle

### Numbered Steps
- Each agent step gets an incrementing number in a muted circle
- Steps stack vertically with clear visual separation

### Badge/Pill Chips
- Rounded rectangle, dark background with subtle border
- Small colored dot/icon on the left indicating type
- Used for ontology selections, folder selections, etc.

### Token Counter
- Thin progress bar with "~XK / 1M tokens" text
- Located at the bottom-right corner
- Updates in real-time as context changes
