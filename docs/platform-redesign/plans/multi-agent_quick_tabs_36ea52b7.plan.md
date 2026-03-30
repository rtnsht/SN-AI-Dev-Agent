---
name: Multi-Agent Quick Tabs
overview: Add a parallel sub-agent system where quick questions typed while the main AI is busy spawn independent agent sessions in separate tabs, sharing the ServiceNow connection without re-login, each with its own chat thread, read-only tool set, and auto-generated tab name.
todos:
  - id: types-and-state
    content: Create `ConversationState` type in `webapp/src/lib/conversation-state.ts` and add `ConversationTab` type to `webapp/src/lib/types.ts`. Define shared vs per-tab state boundaries.
    status: pending
  - id: quick-query-tools
    content: Add `quick_query` phase to `PHASE_TOOL_NAMES` in `mcp-servicenow/src/tool-definitions.ts` with read-only tools only. Rebuild MCP dist.
    status: pending
  - id: quick-agent-prompt
    content: Create `webapp/src/lib/quick-agent-prompt.ts` with a lightweight system prompt for quick agents (no SDD, no phase gates, read-only focus).
    status: pending
  - id: quick-agent-engine
    content: Add `chatStreamQuickAgent()` to `webapp/src/lib/sn-engine.ts` -- 5-round limit, quick_query tools, no task planner, no phase parsing.
    status: pending
  - id: quick-agent-api
    content: Create `/api/quick-agent-stream/route.ts` API route using the quick agent engine function.
    status: pending
  - id: tab-bar-component
    content: Build `webapp/src/components/TabBar.tsx` -- horizontal tab bar with main tab (permanent) + quick agent tabs (closeable). Loading indicators, auto-naming, overflow scroll.
    status: pending
  - id: page-refactor
    content: Refactor `webapp/src/app/app/page.tsx` to manage `conversations` map + `activeTabId`. Wire TabBar, switch ChatWindow props per tab, add handleQuickAgentSend().
    status: pending
  - id: chatwindow-updates
    content: Update `ChatWindow.tsx` to accept `isQuickAgent` prop, hide SDD UI for quick tabs, add 'Ask Quick Agent' option in queue UI.
    status: pending
  - id: session-persistence
    content: Extend sessionStorage logic to persist quick agent tabs (tab list + messages per tab) and restore on refresh.
    status: pending
isProject: false
---

# Multi-Agent Quick Tabs

## Current State

The app has a **single chat thread** in `[webapp/src/app/app/page.tsx](webapp/src/app/app/page.tsx)` with ~40 state variables. When the user types while the AI is busy, messages are **queued** and drained sequentially (one at a time) after the current response completes. There is no tab bar, no multi-session UI, and no parallel conversation support.

The backend is **stateless per request** -- credentials are passed in each API call body, and a fresh `ServiceNowClient` is created per request in `[webapp/src/lib/sn-engine.ts](webapp/src/lib/sn-engine.ts)`. This makes parallel sessions architecturally trivial on the server side.

## Architecture

```mermaid
flowchart TD
    subgraph browser ["Browser (Single Tab)"]
        TabBar["TabBar Component"]
        MainTab["Main Tab: SDD Session"]
        QA1["Quick Agent Tab 1"]
        QA2["Quick Agent Tab 2"]
        SharedState["Shared State: credentials, connInfo, aiProvider, model"]
    end

    subgraph api ["Next.js API Routes"]
        ChatStream["/api/chat-stream"]
        QuickStream["/api/quick-agent-stream"]
    end

    subgraph engine ["sn-engine.ts"]
        FullEngine["Full Engine: all tools, SDD prompt, high round limit"]
        QuickEngine["Quick Engine: read-only tools, lean prompt, 5-round limit"]
    end

    subgraph sn ["ServiceNow Instance"]
        SNAPI["REST API"]
    end

    TabBar --> MainTab
    TabBar --> QA1
    TabBar --> QA2
    MainTab -->|"credentials + full messages"| ChatStream
    QA1 -->|"credentials + quick messages"| QuickStream
    QA2 -->|"credentials + quick messages"| QuickStream
    ChatStream --> FullEngine
    QuickStream --> QuickEngine
    FullEngine -->|"ServiceNowClient A"| SNAPI
    QuickEngine -->|"ServiceNowClient B"| SNAPI
    QuickEngine -->|"ServiceNowClient C"| SNAPI
```



## Key Design Decisions

- **Shared credentials, isolated everything else**: `credentials`, `connected`, `connInfo`, `aiProvider`, `selectedModel` are shared across all tabs. Each tab gets its own `messages`, `isLoading`, `activityLog`, `liveStatus`, `clientSessionId`, and `abortRef`.
- **Quick agents are read-only**: They get a restricted tool set (query/get tools only, no create/update/deploy) and a lightweight system prompt (no SDD workflow). This prevents conflicts with the main session's update sets or deployments.
- **Round limit of 5**: Quick agents cap at 5 tool rounds (vs 30+ for main), keeping responses fast.
- **Tab auto-naming**: First 4-5 words of the user's message become the tab title (client-side, no API call needed). Can be refined by AI response later.
- **Queue behavior changes**: When user types while main AI is busy, instead of just queuing, show two options: "Queue for main" (existing behavior) or "Ask Quick Agent" (spawns new tab).

## Files to Create

- `**webapp/src/components/TabBar.tsx`** -- Tab bar UI above the chat area with main tab + quick agent tabs. Each tab shows a name, loading indicator, and close button. Visual badge distinguishes "Quick Agent" tabs from the main "SDD" tab.
- `**webapp/src/lib/conversation-state.ts**` -- `ConversationState` type and factory. Extracts per-tab state (messages, isLoading, activityLog, liveStatus, sessionId, abortController) into a reusable structure with `createConversation()` helper.
- `**webapp/src/app/api/quick-agent-stream/route.ts**` -- Dedicated API route for quick agents. Same credential validation as `chat-stream` but uses the quick agent system prompt and read-only tool set.
- `**webapp/src/lib/quick-agent-prompt.ts**` -- Lightweight system prompt for quick agents: "You are a ServiceNow query assistant. Answer questions about the instance using read-only tools. Do not create, update, or deploy anything."

## Files to Modify

- `**[webapp/src/app/app/page.tsx](webapp/src/app/app/page.tsx)**` -- Major refactor:
  - Add `conversations: Map<string, ConversationState>` and `activeTabId` state
  - Keep main tab state as `conversations.get("main")`, SDD state stays at page level
  - Add `handleQuickAgentSend()` that creates a new tab, starts a parallel streaming request
  - Modify queue UI to offer "Ask Quick Agent" option
  - Render `TabBar` between header and `ChatWindow`
  - Switch `ChatWindow` props based on `activeTabId`
- `**[webapp/src/components/ChatWindow.tsx](webapp/src/components/ChatWindow.tsx)**` -- Minor changes:
  - Accept `isQuickAgent?: boolean` prop to hide SDD-specific UI (phase tracker, SDD chip, approval buttons)
  - Show a subtle "Quick Agent -- separate session" indicator when `isQuickAgent`
  - Queue UI: add "Ask Quick Agent" button alongside existing queue behavior
- `**[webapp/src/lib/sn-engine.ts](webapp/src/lib/sn-engine.ts)**` -- Add `chatStreamQuickAgent()` variant:
  - Uses `getFilteredTools("quick_query")` for read-only tool set
  - Uses `buildQuickAgentPrompt()` instead of `buildSystemPrompt()`
  - Caps `maxToolRounds` at 5
  - Skips task planner, phase gate parsing, and SDD-specific logic
- `**[mcp-servicenow/src/tool-definitions.ts](mcp-servicenow/src/tool-definitions.ts)**` -- Add `quick_query` to `PHASE_TOOL_NAMES`:
  - Include: `sn_test_connection`, `sn_get_record`, `sn_get_records`, `sn_get_tables`, `sn_get_table_schema`, `sn_get_business_rules`, `sn_get_script_includes`, `sn_get_client_scripts`, `sn_get_ui_policies`, `sn_get_notifications`, `sn_get_instance_info`, `sn_get_update_sets`, `sn_get_update_set_contents`, `sn_get_dashboard_data`, `sn_generate_report`
  - Exclude all create/update/delete/deploy tools
- `**[webapp/src/lib/types.ts](webapp/src/lib/types.ts)**` -- Add types:
  - `ConversationTab` interface (id, name, type: "main" | "quick", isLoading, messageCount, createdAt)
  - Extend `QueuedMessage` or add a dispatch target field

## UX Flow

```mermaid
flowchart TD
    UserTypes["User types message while AI is busy"]
    Check{"Main AI loading?"}
    UserTypes --> Check
    Check -->|No| SendNormal["Send to main chat normally"]
    Check -->|Yes| ShowOptions["Show: Queue for Main | Ask Quick Agent"]
    ShowOptions -->|Queue| ExistingQueue["Add to queue (existing behavior)"]
    ShowOptions -->|Quick Agent| CreateTab["Create new Quick Agent tab"]
    CreateTab --> AutoName["Auto-name tab from message"]
    AutoName --> SendQuick["POST /api/quick-agent-stream with shared credentials"]
    SendQuick --> StreamResponse["Stream response in new tab"]
    StreamResponse --> TabReady["Tab shows response, user can switch back to main"]
```



## Visual Layout

The tab bar sits between the header/subheader and the chat window:

```
+----------------------------------------------------------+
| Header: Logo | About | Release | ... | New Chat | SignIn |
+----------------------------------------------------------+
| Subheader: PhaseTracker (only for main tab)              |
+----------------------------------------------------------+
| TabBar: [Main (SDD)] [Incidents Q...] [Cases Q...] [+]  |
+----------------------------------------------------------+
|                                                          |
|                   ChatWindow                             |
|            (content switches per active tab)             |
|                                                          |
+----------------------------------------------------------+
```

- Main tab always exists, cannot be closed
- Quick agent tabs show a "Quick" badge and can be closed
- Active tab is visually highlighted
- Tabs with loading state show a pulsing dot
- Tab overflow: horizontal scroll with fade edges

## Session Isolation

Each quick agent tab gets:

- Its own `clientSessionId` (for telemetry)
- Its own `messages[]` array
- Its own `AbortController` (can cancel independently)
- Its own streaming connection
- A "separate session" indicator in the chat UI

The main tab's SDD state (`activeReqId`, `currentPhase`, `completedPhases`, `sddMode`) is unaffected by quick agents.