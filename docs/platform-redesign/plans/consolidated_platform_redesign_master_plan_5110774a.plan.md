---
name: Consolidated Platform Redesign Master Plan
overview: FDE-aligned platform redesign for SN AI Agent. Phase A builds the page-v2 shell (DB, APIs, crypto-vault). Phase B adds multi-agent quick tabs. Phase C builds the FDE UI component suite + ModelSelector. Phase D resolves design gaps and wires everything. chat_message_queue_feature is the only pre-existing feature fully aligned with FDE. All UI components (Phase C-UI, C-MODEL, Dx) are built from scratch for page-v2.
todos:
  - id: phase-a
    content: "PHASE A: page-v2 shell, migrations 021-025, crypto-vault, tool-categories, system-connectors, API routes (/api/chats, /api/user/connections, /api/user/api-keys, /api/models)"
    status: pending
  - id: phase-b
    content: "PHASE B: quick_query tools in mcp-servicenow, quick-agent-prompt.ts, chatStreamQuickAgent(), /api/quick-agent-stream, TabBar + multi-tab page refactor"
    status: pending
  - id: phase-c-ui
    content: "PHASE C-UI: FDE component suite (ErrorToast, ShortcutHintBar, ModePopup, ToolWorkbench, ContextBlockPanel collapsible, SessionOutline with Artifacts, NavRailCollapsed)"
    status: pending
  - id: phase-c-model
    content: "PHASE C-MODEL: ModelSelector multi-provider (types, migration 025, /api/models, AI Gateway routing, per-provider credentials)"
    status: pending
  - id: phase-d
    content: "PHASE D: friendlyToolLabel enhancements, InlineAgentActivity SVG icons, agent harness prompts, tool-metadata, useConnection/useChatStream hooks"
    status: pending
  - id: phase-dx
    content: "PHASE Dx: UI gaps (Toast/Skeleton/ConfirmDialog/Breadcrumbs/InterfaceProvider/skip-to-content/onShuffle)"
    status: pending
isProject: true
---

# Consolidated Platform Redesign Master Plan

## What's Already Done (Do Not Repeat)

Audit against source code (webapp/src/) completed 2026-03-27.

### Actually Implemented — FDE-Aligned

| Plan | FDE Relevance | Source Verification | Status |
|------|-------------|---------------------|--------|
| `chat_message_queue_feature` | HIGH — FDE chat bar allows typing while AI processes; queue drains automatically | page.tsx:172 messageQueue; ChatWindow.tsx send button has NO isLoading disable (shows queue icon); page.tsx:1622 handleDequeueMessage; page.tsx:1609 drain useEffect | DONE — no FDE alignment needed |

### Implemented But Needs FDE UI Alignment

These exist in source but need FDE-specific redesign for the new UI:

| Plan | Gap | FDE Alignment Work |
|------|-----|-------------------|
| `header_redesign` | PhaseTracker, subheader, right panel exist but are not FDE-styled | Redo as FDE NavRailCollapsed (C8), phase chips with FDE color palette, FDE-style tab bar |
| `ui_ux_elevation` | Surface tokens, focus rings, app-banner CSS exist | Extend with FDE Blueprint-style tokens (bp-* equivalents for the new design system), FDE color palette per-mode, collapsible context ribbon CSS |
| `suggestion_engine_enhancement` | Fisher-Yates, seen-prompt tracking, PromptComposer exist | Add chat bar model selector integration (C7); connect to page-v2 state; add onShuffle to SuggestionPanel |
| `custom_auth_and_palantir_ui` (auth) | bcrypt, sessions, proxy.ts auth, login/logout/me routes, 001_auth_gate.sql | AUTH IS DONE — does NOT need FDE alignment. The auth infrastructure (users, sessions, bcrypt, proxy.ts, all auth API routes) is production-ready and reusable for page-v2 |
| `custom_auth_and_palantir_ui` (UI) | No Blueprint UI, no components/ui/, no dashboard pages | ALL UI COMPONENTS MISSING — start from scratch for page-v2 |

### NOT DONE - Was Incorrectly Claimed Complete

| # | Item | Source Reality | Status |
|---|------|--------------|--------|
| 1 | Toast.tsx, Skeleton.tsx, ConfirmDialog.tsx, Breadcrumbs.tsx | None exist | ALL MISSING |
| 2 | InterfaceProvider | Does not exist | MISSING |
| 3 | POST /api/auth/signup | No /signup route; only register-invite | MISSING |
| 4 | tailwind.config.ts with Blueprint tokens | No such file; Tailwind v4 uses CSS vars | MISSING |
| 5 | components/ui/ with Button/Input/Card/Badge | No such folder | MISSING |
| 6 | Blueprint bp-* tokens | None; surface tokens are Linear/Perplexity style | MISSING |
| 7 | Dashboard app | Chat/AI agent app; no dashboard pages | WRONG APP TYPE |
| 8 | skip-to-content link | Not present | MISSING |
| 9 | onShuffle in SuggestionPanel | No handleShuffle/onShuffle found | MISSING |
| 10 | 005_user_preferences.sql + interface themes API | No such migration or routes | MISSING |


---

## Remaining Work: 7 Phases (Accurate)

```
PHASE A:  Foundation (DB migrations 021-025, crypto-vault, tool-categories, APIs, page-v2 shell)
PHASE B:  Multi-Agent Quick Tabs (quick_query tools, TabBar, page refactor)
PHASE C-UI:   FDE UI Component Suite (ErrorToast, ShortcutHintBar, ModePopup, ToolWorkbench, ContextBlockPanel, SessionOutline, NavRailCollapsed)
PHASE C-MODEL: ModelSelector Multi-Provider (types, migration 025, /api/models, AI Gateway routing)
PHASE D:  Design Gaps (friendlyToolLabel, SVG icons, agent harness, tool-metadata, hooks)
PHASE Dx: UI Gaps (Toast, Skeleton, ConfirmDialog, Breadcrumbs, InterfaceProvider, skip-to-content)
```

---

## PHASE A: Foundation

**Goal:** Get `page-v2.tsx` rendering at `/app/v2` with real DB persistence and authenticated APIs, without touching `page.tsx`.

### A1. Database Migrations 021-024

Create `webapp/supabase/migrations/021_chats_and_messages.sql`:

```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  metadata JSONB DEFAULT '{}',  -- tool_calls, tokens, agent_attribution
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content JSONB NOT NULL,  -- { text, tool_name, tool_input, tool_output, etc. }
  metadata JSONB DEFAULT '{}',  -- tokens_used, model, round, timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sort_key INT NOT NULL DEFAULT 0
);

CREATE INDEX chats_user_id_idx ON chats(user_id);
CREATE INDEX chat_messages_chat_id_idx ON chat_messages(chat_id);
CREATE INDEX chat_messages_sort_key_idx ON chat_messages(sort_key);
```

Create `webapp/supabase/migrations/022_session_artifacts.sql`:

```sql
CREATE TABLE session_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  artifact_type TEXT NOT NULL,  -- 'business_rule', 'script_include', 'table', etc.
  display_name TEXT NOT NULL,
  external_sys_id TEXT,  -- SN record sys_id if created
  payload JSONB DEFAULT '{}',  -- full artifact data
  vapt JSONB,  -- { score, findings[], blocked }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX session_artifacts_user_id_idx ON session_artifacts(user_id);
CREATE INDEX session_artifacts_chat_id_idx ON session_artifacts(chat_id);
```

Create `webapp/supabase/migrations/023_user_api_keys.sql`:

```sql
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,  -- 'openai', 'anthropic', 'openrouter'
  label TEXT NOT NULL,  -- 'Work Key', 'Playground'
  encrypted_blob JSONB NOT NULL,  -- { iv, tag, ciphertext }
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_api_keys_user_id_idx ON user_api_keys(user_id);
```

Create `webapp/supabase/migrations/024_user_system_connections.sql`:

```sql
CREATE TABLE user_system_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL,  -- 'servicenow', 'jira', 'salesforce'
  label TEXT NOT NULL,
  config JSONB DEFAULT '{}',  -- instance_url, scope, etc.
  credentials_enc JSONB NOT NULL,  -- encrypted via crypto-vault
  is_default BOOLEAN NOT NULL DEFAULT false,
  last_connected TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_system_connections_user_id_idx ON user_system_connections(user_id);
```

### A2. crypto-vault.ts

Create `webapp/src/lib/crypto-vault.ts`:

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.CREDENTIALS_MASTER_KEY!, 'hex'); // 32 bytes

export function encryptJson(plaintext: unknown): { iv: string; tag: string; ciphertext: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decryptJson<T>(blob: { iv: string; tag: string; ciphertext: string }): T {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  return JSON.parse(decipher.update(blob.ciphertext, 'base64', 'utf8') + decipher.final('utf8'));
}
```

### A3. tool-categories.ts

Create `webapp/src/lib/tool-categories.ts`. Source actual tool names from `mcp-servicenow/src/tool-definitions.ts`. Group all 147 tools into FDE-structured categories:

```typescript
// CORE
const CORE_TOOLS = {
  'Tables & Records': ['sn_get_record', 'sn_get_records', 'sn_create_record', 'sn_update_record', 'sn_delete_record', 'sn_get_table_schema', 'sn_get_tables', 'sn_get_record_counts', /* ... */],
  'Update Sets': ['sn_get_update_sets', 'sn_get_update_set_contents', 'sn_create_update_set', /* ... */],
  'Scoped Apps': ['sn_get_applications', 'sn_get_app_components', /* ... */],
};
// SCRIPTS: Script Includes, Business Rules, Client Scripts, UI Policies
// NOTIFICATIONS & JOBS: Notifications, Scheduled Jobs, Flow Designer
// QUALITY & SAFETY: VAPT/GUARDRAIL, Code Quality, ATF Testing, Conflict Detection
// ANALYSIS: Instance Analyzer, Dead Code Finder, Change Impact, Dependency Graph, ACL Analyzer
// DIAGRAMS: generate_architecture_diagram, generate_sequence_diagram, generate_data_flow_diagram, generate_er_diagram (NEW)
// DEPLOYMENT: Instance Compare, Upgrade Readiness, Service Catalog, Service Portal

export interface ToolCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  tools: string[];
  type?: 'read' | 'write' | 'admin';  // for VAPT gating
}

export function getCategoryTree(): ToolCategory[] { /* ... */ }
export function getToolIdsInCategory(categoryId: string): string[] { /* ... */ }
export function findToolCategory(toolName: string): ToolCategory | undefined { /* ... */ }
```

### A4. system-connectors.ts

Create `webapp/src/lib/system-connectors.ts`:

```typescript
export interface SystemConnector {
  id: string;
  displayName: string;
  getToolCategories(): ToolCategory[];
  executeToolCall?(toolName: string, args: unknown): Promise<ToolResult>;  // Phase 3
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Phase 1: ServiceNowConnector stub (interfaces only, executeToolCall throws notImplemented)
```

### A5. API Routes (all authenticated via validateSession)


| Route                        | Method             | Purpose                                                         |
| ---------------------------- | ------------------ | --------------------------------------------------------------- |
| `/api/chats`                 | GET, POST          | List user chats / create chat                                   |
| `/api/chats/[id]`            | GET, PATCH, DELETE | Single chat CRUD                                                |
| `/api/chats/[id]/messages`   | GET, POST          | Paginated messages / append                                     |
| `/api/user/connections`      | GET, POST          | List / create system connections (encrypt credentials on write) |
| `/api/user/connections/[id]` | GET, PATCH, DELETE | Manage one connection                                           |
| `/api/user/api-keys`         | GET, POST          | List (masked) / create encrypted key                            |
| `/api/user/api-keys/[id]`    | GET, DELETE        | Reveal masked / delete                                          |


Auth pattern: read `SESSION_COOKIE_NAME` cookie -> `validateSession(token)` from `webapp/src/lib/auth.ts` -> 401 if null.

### A6. page-v2.tsx + v2 Route

- Copy `webapp/src/app/app/page.tsx` to `webapp/src/app/app/page-v2.tsx`
- Create `webapp/src/app/app/v2/page.tsx` that re-exports from `page-v2.tsx`
- Add a subtle "v2" badge indicator so `/app` and `/app/v2` are distinguishable
- Result: users reach redesign at `/app/v2` while production `/app` is untouched

### A7. Minimal hookup

- Prove APIs work: add `useEffect` on mount in page-v2 that calls `GET /api/chats` and logs response (console only, no state wiring yet)
- This proves auth + DB wiring without migrating sessionStorage state

---

## PHASE B: Multi-Agent Quick Tabs

**Goal:** Allow parallel agent conversations alongside the main SDD session, sharing credentials.

### B1. quick_query tool phase

Add to `PHASE_TOOL_NAMES` in `mcp-servicenow/src/tool-definitions.ts`:

```typescript
quick_query: [
  'sn_test_connection', 'sn_get_record', 'sn_get_records',
  'sn_get_tables', 'sn_get_table_schema', 'sn_get_business_rules',
  'sn_get_script_includes', 'sn_get_client_scripts', 'sn_get_ui_policies',
  'sn_get_notifications', 'sn_get_instance_info', 'sn_get_update_sets',
  'sn_get_dashboard_data', 'sn_generate_report'
],  // read-only only
```

Rebuild MCP dist.

### B2. quick-agent-prompt.ts + sn-engine.ts

Create `webapp/src/lib/quick-agent-prompt.ts`:

```typescript
// Lightweight system prompt: "You are a ServiceNow query assistant.
// Answer questions using read-only tools. Do not create, update, or deploy."
```

Add `chatStreamQuickAgent()` to `sn-engine.ts`: uses `quick_query` tools, 5-round cap, no SDD/phase parsing.

### B3. /api/quick-agent-stream route

Create `webapp/src/app/api/quick-agent-stream/route.ts`: same credential validation as `/api/chat-stream`, uses `chatStreamQuickAgent()`.

### B4. TabBar component + page.tsx refactor

Create `webapp/src/components/TabBar.tsx`: main tab (permanent, shows SDD PhaseTracker) + quick agent tabs (closeable, show "Quick" badge).

Refactor `page.tsx`: `conversations: Map<string, ConversationState>`, `activeTabId`, `handleQuickAgentSend()`.

---

## PHASE C: FDE-Inspired UI Components

All components go in `webapp/src/components/fde/` — self-contained, no breaking changes to existing `page.tsx`. Designed for page-v2 integration.

### C1. Error Toast System (lowest effort, highest impact)

File: `webapp/src/components/fde/ErrorToast.tsx` + `useErrorToast.ts`

FDE spec: top-center, #DC2626 background, white warning icon, close button, auto-dismiss 8s.

```tsx
// Drop into ChatWindow.tsx: <ErrorToastContainer toasts={toasts} />
```

### C2. Keyboard Shortcuts + Shortcut Hint Bar

Inline in `ChatInputBar`. Focus-triggered hint below textarea:

- "Enter to send"
- "Shift+Enter for new line"
- "Ctrl+Enter to skip agent"

Update `handleKeyDown`:

```tsx
if (e.key === 'Enter' && (isMac ? e.metaKey : e.ctrlKey)) {
  e.preventDefault();
  handleDirectExecute();  // bypass AI
}
```

### C3. Token Counter with Progress Bar

File: `webapp/src/components/fde/TokenCounter.tsx`

Thin progress bar below input. Format: "~11.5K / 1M tokens". Color: green < 70%, amber 70-90%, red > 90%.

### C4. Mode Selector Popup

File: `webapp/src/components/fde/ModePopup.tsx`

Floating card anchored ABOVE tab bar. Per-mode color + icon. Sub-agent section (Generate plan, Debug session) above modes. Ghosted "Summarize/Remove" toolbar at 40% opacity when context > 50% token limit.

### C5. Tool Workbench Modal

File: `webapp/src/components/fde/ToolWorkbench.tsx`

Full-width modal. Header: "Search tools..." input + "40/147" count badge. Left: category sidebar (CORE/SCRIPTS/NOTIFICATIONS/QUALITY/ANALYSIS/DIAGRAMS/DEPLOYMENT). Right: tool rows with checkbox + snake_case name + "Details >" link. NEW: DIAGRAMS category with `generate_architecture_diagram`, `generate_sequence_diagram`, etc. (leveraging existing `src/core/diagram-generator.js`).

### C6. Context Block Panel

File: `webapp/src/components/fde/ContextBlockPanel.tsx` + `ContextBlockItem.tsx`

Full-width numbered cards above chat. Per-block `+` button in header. "Include children" cascade toggle. SN-specific block types: Update Set Scope (with "Default update set" warning), SDD Phase Gate (REQ-XXX + phase progress bar), Instance Connection.

### C7. Model Selector — Multi-Provider Chat Bar Widget

**FDE Screenshot Analysis:** The model selector appears in the chat bar as a compact pill showing the current model + "Server Free" badge. Clicking expands a full panel with provider tabs (MiniMax, OpenRouter, Google, OpenAI, Anthropic, Free) and a searchable model list with per-model detail cards.

#### C7a. Type System Expansion

**File:** `webapp/src/lib/types.ts`

Expand `AIProvider` union and `ModelOption` interface:

```typescript
// Current (limited):
export type AIProvider = "anthropic" | "openrouter";

// New (multi-provider):
export type AIProvider = "anthropic" | "openrouter" | "openai" | "google" | "minimax" | "free";

export interface ModelOption {
  key: string;         // internal key e.g. "minimax-m2.7"
  label: string;        // display name e.g. "MiniMax-M2.7"
  modelId: string;      // provider's model ID e.g. "MiniMax/M2.7"
  description: string;
  provider: AIProvider;
  contextWindow?: number;      // e.g. 1000000 for 1M
  maxOutput?: number;          // e.g. 8192
  inputCost?: number;         // per 1M tokens
  outputCost?: number;         // per 1M tokens
  isFree?: boolean;            // server-provided free tier
  isDefault?: boolean;         // server-configured default
  capabilities?: string[];    // ["vision", "tool_calling", "thinking"]
}
```

#### C7b. Database Model Config Migration

**File:** `webapp/supabase/migrations/025_model_config.sql` (NEW)

```sql
CREATE TABLE model_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    AIProvider NOT NULL,
  model_key   TEXT NOT NULL,
  label       TEXT NOT NULL,
  model_id    TEXT NOT NULL,  -- Provider's canonical model ID
  context_window    INT,
  max_output        INT,
  input_cost_per_1m NUMERIC(10,4),
  output_cost_per_1m NUMERIC(10,4),
  is_free     BOOLEAN NOT NULL DEFAULT false,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  capabilities TEXT[] DEFAULT '{}',
  enabled     BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE model_config ENABLE ROW LEVEL SECURITY;

-- Server-only read (bypass RLS for server routes)
CREATE POLICY "Server can read all model_config"
  ON model_config FOR SELECT USING (true);
```

#### C7c. New API Route: Unified Model List

**File:** `webapp/src/app/api/models/route.ts` (NEW)

`GET /api/models` — returns all available models from:
1. **DB config** (`model_config` table) — server-configured free/default models
2. **OpenRouter API** — existing `fetchOpenRouterModels()` for paid models
3. **Google AI** — Gemini models via `@ai-sdk/google`
4. **OpenAI** — GPT models via `@ai-sdk/openai`
5. **MiniMax** — via AI Gateway with OIDC

Response shape:
```json
{
  "providers": [
    { "id": "minimax", "label": "MiniMax", "icon": "…" },
    { "id": "openrouter", "label": "OpenRouter", "icon": "…" },
    { "id": "google", "label": "Google", "icon": "…" },
    { "id": "openai", "label": "OpenAI", "icon": "…" },
    { "id": "anthropic", "label": "Anthropic", "icon": "…" },
    { "id": "free", "label": "Free", "icon": "…" }
  ],
  "models": [
    { "key": "minimax-m2.7", "label": "MiniMax-M2.7", "provider": "minimax",
      "modelId": "MiniMax/M2.7", "contextWindow": 1000000, "inputCost": 0.05,
      "outputCost": 0.19, "isFree": false, "isDefault": true,
      "capabilities": ["tool_calling", "thinking"], "description": "…" }
  ],
  "defaultModel": "minimax-m2.7"
}
```

#### C7d. Per-Provider Credentials Extension

**File:** `webapp/src/lib/credentials.ts` (extend Credentials type)

Add new optional fields to the existing `Credentials` interface:
```typescript
interface Credentials {
  // ... existing fields (instanceUrl, username, password, etc.)
  googleApiKey?: string;    // for Google AI / Gemini
  openAiApiKey?: string;     // for OpenAI / GPT
  minimaxApiKey?: string;    // for MiniMax direct (if not via AI Gateway)
  // ... existing fields continue
}
```

#### C7e. ModelSelector Component

**File:** `webapp/src/components/fde/ModelSelector.tsx`

**Layout (matching FDE screenshot):**

```
┌─────────────────────────────────────────────────────┐
│ [MiniMax▾] [OpenRouter] [Google] [OpenAI] [Anthro] [Free] │  ← Provider tabs
├─────────────────────────────────────────────────────┤
│ [🔍 Search models...]                    100 models  │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ MiniMax-M2.7                         [Server Free]│ │
│ │ Context: 1M  |  Input: $0.05/1M  |  Output: $0.19 │ │
│ └─────────────────────────────────────────────────┘ │
│   Gemini 2.0 Flash                                │
│   GPT-5.4                                         │
│   Claude Sonnet 4.6                                │
│   ...                                              │
├─────────────────────────────────────────────────────┤
│ FREE MODELS                                        │
│   MiniMax-M2.7 (default)                          │
│   Google Gemini 2.0 Flash                         │
│   ...                                              │
└─────────────────────────────────────────────────┘
```

**Component Props:**
```typescript
interface ModelSelectorProps {
  selectedProvider: AIProvider;
  selectedModel: string;
  onProviderChange: (p: AIProvider) => void;
  onModelChange: (key: string) => void;
  disabled?: boolean;  // true when modelLocked
}
```

**Behavior:**
- Provider tabs at top — clicking a tab filters the model list
- "Free" tab shows only `isFree: true` models from DB config
- "MiniMax" / "Anthropic" / "OpenRouter" tabs show their respective models
- Search filters across all visible models
- Selected model shows "Server Free" badge if `isFree: true`
- Model detail shows: context window, input/output cost, capabilities
- "Thinking mode" toggle in settings section (existing feature)
- Disabled when `modelLocked: true` (after first message sent)

**Integration:** Mount in `renderInputBar()` of `ChatWindow.tsx` as an inline pill/dropdown, NOT buried in settings. Also accessible from ModePopup.

#### C7f. Multi-Provider Streaming in sn-engine.ts

**File:** `webapp/src/lib/sn-engine.ts`

Extend `chatStream()` and `chat()` to route to the correct provider SDK:

```typescript
// In chatStream() — resolve provider SDK:
const provider = aiProvider; // "anthropic" | "openrouter" | "google" | "openai" | "minimax" | "free"

if (provider === "anthropic") {
  return anthropicMessages(prompt, messages, modelId, tools, abortSignal, streamingCallback);
} else if (provider === "openrouter") {
  return openRouterStream(messages, modelId, tools, abortSignal, streamingCallback);
} else if (provider === "google") {
  return googleAIStream(messages, modelId, tools, abortSignal, streamingCallback);
} else if (provider === "openai") {
  return openAIStream(messages, modelId, tools, abortSignal, streamingCallback);
} else if (provider === "minimax" || provider === "free") {
  // Route through AI Gateway with OIDC: model string = "minimax/M2.7"
  return aiGatewayStream(messages, modelId, tools, abortSignal, streamingCallback);
}
```

**AI Gateway routing (D7):** For MiniMax and free models, route through Vercel AI Gateway using OIDC (`VERCEL_OIDC_TOKEN`). Model strings become `"minimax/M2.7"` which routes to the correct provider. No per-provider SDK needed — single unified path.

#### C7g. SettingsPanel — Per-Provider API Keys

**File:** `webapp/src/components/SettingsPanel.tsx`

Expand API key inputs to cover all providers:
- Anthropic API Key (existing)
- OpenRouter API Key (existing)
- Google API Key (NEW)
- OpenAI API Key (NEW)
- MiniMax API Key (NEW)

Each provider section shows only when that provider is selected, or as a unified "Provider API Keys" section.

### C8. NavRail Collapsed Mode

File: `webapp/src/components/fde/NavRailCollapsed.tsx`

64px icon-only strip. Hover tooltips: "Chats Cmd1", "Tools Cmd2", etc. Phase chip at top (SPEC blue / DESIGN purple / IMPL amber / TEST green / DONE gray). Update Set badge with artifact count. Instance + scope indicators.

### C9. Tab Bar with Popups

File: `webapp/src/components/fde/TabBar.tsx`

6 tabs with colored dot indicators. Popup appears ABOVE tab bar. Fade animation (opacity + translateY). Close on outside click or Escape. Skills tab shows capability toggles.

### C10. Right Outline with Token Tracking

File: `webapp/src/components/fde/SessionOutline.tsx`

Per-context-item token attribution: "67k -> 109.4k" format (current -> projected). System Prompt visible with large count. "0 tokens" for items already in context. Dynamic updates when context changes.

---

## PHASE D: Design Gaps (from FDE-Plus Design Review)

These are open questions that block clean implementation of later phases.

### D1. Agent Classification Prompt + Harness Schema

Detail the 8-agent classification prompt, handoff schema, and context-reset strategy. The PLAN references "v3" without specifics. Produce: `webapp/src/lib/agent-harness/prompts.ts` with classification prompt + handoff schema.

### D2. Incremental page-v2 Rendering Strategy

Define how page-v2.tsx evolves across phases without breaking intermediate states. Key question: do new components (ContextBlockPanel, ModePopup, TabBar) mount inside the copied page.tsx shell or replace sections wholesale?

**Recommendation:** Components replace sections in order: ContextBlockPanel first (UI only, no state dependency), then ModePopup, then TabBar, then ToolWorkbench. Each is independently deployable.

### D3. Drawer vs Inline: Tool Panel Placement

Resolve: do tool execution panels appear as a drawer overlay or inline in chat? FDE shows both.

**Recommendation:** Tool Workbench is a modal (full-width overlay, C5 above). Direct execution results render inline as artifact cards in chat (already designed in CHATBOX-DETAIL.md). This matches FDE's separation of "tool browser" vs "tool result."

### D4. Add tool-metadata to tool-categories.ts

Tag each tool with `type: 'read' | 'write' | 'admin'` and `contextHints: string[]`. Enables tool recommendations and VAPT gating.

### D5. Enrich chat_messages schema

Add `metadata: JSONB` column to `021_chats_and_messages.sql` (already included above) for tool calls, tokens, agent attribution per message. Document the shape.

### D6. Extract useConnection + useChatStream hooks

In Phase A page-v2 copy, extract the 2577-line monolith's 3 largest concerns into hooks immediately:

- `useConnection`: credential/auth flow
- `useChatStream`: streaming chat logic
- Keep `ChatWindow` as the render-only component

### D7. Build ContextBlockPanel in Phase A

Even before multi-agent, ContextBlockPanel is a UI-only component that works with the existing single-agent engine by injecting table/scope context into the system prompt. Build it in Phase A for immediate visual differentiation of page-v2.

### D8. Prioritize New Possibilities (A-H from FDE-Plus review)

From the 8 novel possibilities, pick top 3 to slot into Phase C/D:


| Priority | Possibility                           | Rationale                                                                      |
| -------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| 1        | **A. Context Budget Bar**             | Already in C3 (TokenCounter); integrate into C6 ContextBlockPanel              |
| 2        | **C. Tool Recommendation Engine**     | Requires D4 (tool-metadata); slot after tool-categories.ts                     |
| 3        | **H. Live Instance Health Dashboard** | Small indicator in NavRail footer; Phase A can wire `sn_analyze_instance` call |


Skip: B (Artifact Timeline — needs full DB), D (Schema Autocomplete — needs form system), E (Diff view — needs artifact card), F (Rollback — needs artifact card), G (Workflow Templates — needs artifact save).

---

## Dependency Order

```
Phase A (Foundation)
  └── migrations 021-025 → crypto-vault → tool-categories → system-connectors → API routes → page-v2 copy + v2 route

Phase B (Multi-Agent)
  └── quick_query tools → quick-agent-prompt.ts → chatStreamQuickAgent() → /api/quick-agent-stream → TabBar + page refactor

Phase C-UI (FDE Components)
  └── C1 ErrorToast → C2 ShortcutHintBar → C4 ModePopup → C5 ToolWorkbench → C6 ContextBlockPanel → C8 NavRailCollapsed → C10 SessionOutline → C9 TabBar

Phase C-MODEL (ModelSelector)
  └── C7a types → C7b migration 025 → C7c /api/models → C7f AI Gateway routing → C7e ModelSelector → C7g SettingsPanel

Phase D (Design Gaps)
  └── D7 friendlyToolLabel → D8 SVG icons → D1 agent harness prompts → D4 tool-metadata → D6 useConnection/useChatStream hooks

Phase Dx (UI Gaps)
  └── Toast → Skeleton → ConfirmDialog → Breadcrumbs → InterfaceProvider → skip-to-content → onShuffle
```

---

## Files to Create (Phase A only)

```
webapp/supabase/migrations/021_chats_and_messages.sql
webapp/supabase/migrations/022_session_artifacts.sql
webapp/supabase/migrations/023_user_api_keys.sql
webapp/supabase/migrations/024_user_system_connections.sql
webapp/supabase/migrations/025_model_config.sql
webapp/src/lib/crypto-vault.ts
webapp/src/lib/tool-categories.ts
webapp/src/lib/system-connectors.ts
webapp/src/app/api/chats/route.ts
webapp/src/app/api/chats/[id]/route.ts
webapp/src/app/api/chats/[id]/messages/route.ts
webapp/src/app/api/user/connections/route.ts
webapp/src/app/api/user/connections/[id]/route.ts
webapp/src/app/api/user/api-keys/route.ts
webapp/src/app/api/user/api-keys/[id]/route.ts
webapp/src/app/app/page-v2.tsx        (copy of page.tsx)
webapp/src/app/app/v2/page.tsx        (re-export)
webapp/src/components/fde/ContextBlockPanel.tsx  (Phase A, early)
webapp/src/components/fde/TokenCounter.tsx       (Phase A, early)
```

