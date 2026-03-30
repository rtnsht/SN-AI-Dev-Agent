---
name: FDE-Plus Design Review
overview: A comprehensive review of the platform-redesign folder through the lens of "best of Palantir FDE + new AI-native possibilities," grounded against the actual codebase state from Augment Context Engine analysis.
todos:
  - id: review-agent-harness
    content: Detail the agent classification prompt, handoff schema, and context-reset strategy for the 8-agent orchestrator (PLAN Part 4 gap)
    status: pending
  - id: design-incremental-rendering
    content: Define how page-v2.tsx evolves across phases 1-4 without breaking intermediate states
    status: pending
  - id: decide-tool-panel-placement
    content: Resolve drawer vs inline for tool execution panels -- pick one primary pattern
    status: pending
  - id: add-tool-metadata
    content: Add read/write/admin type + contextHints to tool-categories.ts for recommendations and VAPT gating
    status: pending
  - id: enrich-chat-messages-schema
    content: Add metadata JSONB column to 021_chats_and_messages.sql for tool calls, tokens, agent attribution
    status: pending
  - id: extract-page-hooks
    content: In Phase 1 page-v2 copy, extract useConnection and useChatStream hooks to reduce the 2577-line monolith
    status: pending
  - id: context-ribbon-phase1
    content: Build context ribbon component in Phase 1 as a standalone UI piece wired to system prompt injection
    status: pending
  - id: evaluate-new-possibilities
    content: Prioritize the 8 new possibilities (A-H) and slot the top 3 into the phase plan
    status: pending
isProject: false
---

# Platform Redesign Review: Best of FDE + New Possibilities

## What Exists Today (Codebase Reality)

The Augment Context Engine retrieval confirms these are the hard constraints Phase 1 inherits:

- `**page.tsx**` is ~2577 lines, single `"use client"` component owning ALL state -- messages, credentials, connection, phases, SDD mode, model selection. Chat state lives entirely in `sessionStorage` via `[useSessionState.ts](webapp/src/hooks/useSessionState.ts)`.
- `**sn-engine.ts**` runs a **single-agent** tool-use loop with phase-based tool filtering (`PHASE_TOOL_NAMES` in `[tool-definitions.ts](mcp-servicenow/src/tool-definitions.ts)`). There is no orchestrator/router -- the same prompt handles everything.
- `**tool-registry.ts`** has a flat `TOOL_HANDLERS` map with `executeToolCall(toolName, args, snClient)` -- this is already a clean dispatch table ready for direct execution (Phase 3 can call it without AI).
- `**key-resolver.ts`** does `BYOK -> Pool -> env_fallback` resolution. Credentials are never persisted to DB -- they live only in `sessionStorage` and are sent with every API request.
- **147 tools** across 8 arrays (`TOOLS`, `MORE_TOOLS`, `ADDITIONAL_TOOLS`, `BROWNFIELD_TOOLS`, `FLOW_DESIGNER_TOOLS`, `SCOPED_APP_TOOLS`, `SERVICE_PORTAL_TOOLS`, `CATALOG_TOOLS`) merged into `ALL_TOOLS`. Each has `inputSchema` with typed properties.

---

## Review of the Platform-Redesign Docs

### What the Folder Contains


| Doc                                                                         | Verdict                                                                                                                                                                |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[HANDOFF.md](docs/platform-redesign/HANDOFF.md)`                           | Excellent entry point. Clear read order, key decisions, codebase state snapshot.                                                                                       |
| `[PLAN.md](docs/platform-redesign/PLAN.md)`                                 | Solid 9-phase plan. Parts 1-3 (tool interaction, categories, direct execution) are the strongest. Agent harness (Part 4) references "v3" without inlining the details. |
| `[DIAGRAMS.md](docs/platform-redesign/DIAGRAMS.md)`                         | 15 Mermaid diagrams covering architecture, flows, ER, and Gantt. Production-quality.                                                                                   |
| `[UI-MOCKUPS.md](docs/platform-redesign/UI-MOCKUPS.md)`                     | 14 ASCII mockups -- NavRail, drawers, tool execution, agent config, profile vault, SDD mode, mobile. Comprehensive.                                                    |
| `[CHATBOX-DETAIL.md](docs/platform-redesign/CHATBOX-DETAIL.md)`             | 7 message types (user, AI, artifact, code, table, choices, direct execution, system, agent activity). Each fully spec'd with visual treatment.                         |
| `[CHATBOX-FDE-INSPIRED.md](docs/platform-redesign/CHATBOX-FDE-INSPIRED.md)` | Element-by-element FDE mapping. Blueprint dark theme tokens. Component patterns. This is the design DNA.                                                               |


### Strengths (Keep These)

**1. Two Interaction Modes (PLAN Part 1)** -- This is the plan's killer feature. The dual path (agent-assisted chat vs. direct tool forms auto-generated from `inputSchema`) is something FDE doesn't have. It means power users skip the AI entirely for known operations, while beginners get guided assistance. The existing `executeToolCall()` in `tool-registry.ts` makes this technically trivial to wire.

**2. FDE Zone Architecture (CHATBOX-FDE-INSPIRED)** -- The 7-zone layout (top toolbar, mode selector, messages, context ribbon, input field, tool menu, chat outline) maps cleanly from FDE. The context ribbon with typed resource chips (table=blue, update set=green, scope=purple, file=gray) is a significant UX upgrade over the current "type everything into chat" model.

**3. Blueprint Design Tokens** -- The 2px radius, 4px grid, `#0B0D12`/`#161A22`/`#1C2029` surface hierarchy already matches the existing `globals.css` dark theme. This means the v2 shell can adopt these tokens incrementally without a visual break.

**4. Tool Category Hierarchy (PLAN Part 2)** -- The three-level system/category/tool tree with 13 SN categories covering all 147 tools is well-structured. The `SystemConnector` interface for future JIRA/Salesforce is correctly designed as an adapter pattern.

**5. VAPT Auto-Enforcement (DIAGRAMS #11)** -- Auto-evaluating every write operation with a fast model (Haiku) and gating on score thresholds (pass/warn/block) is a genuine differentiator. No other ServiceNow dev tool does this.

### Gaps and Risks

**1. Agent Harness Underspecified** -- PLAN Part 4 says "Same as v3" for the 8-agent orchestrator but doesn't inline the actual classification prompt, handoff schema, or context-reset strategy. The Anthropic three-agent pattern (Planner->Generator->Evaluator) is named but not detailed enough to implement directly.

**2. Chat Persistence Migration Risk** -- The plan jumps from sessionStorage to full DB persistence (Phase 5) but doesn't address the migration path. The current `useSessionState.ts` hook writes to `sessionStorage` on every message change. Phase 1 adds DB tables but Phase 5 actually wires them -- there's a gap where the tables exist but aren't used.

**3. No Incremental Rendering Strategy** -- The mockups show the final state but don't specify how `page-v2.tsx` evolves across phases. Phase 1 copies 2577 lines, Phase 4 refactors the layout -- what happens in Phases 2-3 when new components mount inside the old shell?

**4. Tool Workbench Drawer vs Inline** -- The mockups show tool execution both as a drawer overlay (UI-MOCKUPS #3-4) and inline in chat (CHATBOX-DETAIL #2h). The plan says "inline or drawer" without deciding. This affects component architecture significantly.

---

## New Possibilities Beyond FDE

These are capabilities the current plan doesn't cover that would elevate the platform from "FDE clone with SN tools" to "AI-native development environment":

### A. Smart Context Budget Bar

FDE shows token counts in the outline. Go further: show a visual context window budget bar above the input field that fills as the conversation grows. When approaching limits, offer one-click "summarize old messages" (already in CHATBOX-FDE-INSPIRED #5 outline but not as a primary visual element). Show how much prompt caching saves in real-time (the current `sn-engine.ts` already uses Anthropic prompt caching).

### B. Artifact Timeline (Cross-Chat)

The plan saves artifacts per-chat in `session_artifacts`. Add a global artifact timeline view (NavRail icon or profile drawer section) that shows everything the user has ever created across all chats, filterable by type/system/date. This becomes the "what did I deploy last week?" answer -- something FDE doesn't have because it's session-scoped.

### C. Tool Recommendation Engine

When the user types in the input field or selects a mode, show 2-3 contextually relevant tool suggestions below the input (like GitHub Copilot suggestions but for tools). Use the context ribbon chips (which table is active, which update set) to rank suggestions. For example: if `incident` table is in context and mode is Build, suggest "Create Business Rule on incident" and "Create UI Policy on incident."

### D. Schema-Aware Autocomplete in Tool Forms

The auto-generated tool forms (PLAN Part 3.2) should have type-ahead for reference fields. When a form field is `table`, fetch the table list from the connected instance (existing `sn_get_tables` tool). When a field references a ServiceNow field name, show fields from the active table context. This already works for the AI -- make it work for direct execution too.

### E. Side-by-Side Diff for Modifications

When the Builder agent modifies an existing artifact (update vs create), show a before/after diff view in the artifact card. The `sn_update_record` tool already has the old and new values. Render them as a code diff with syntax highlighting. This gives users confidence to approve changes.

### F. One-Click Rollback from Artifact Cards

Each artifact card shows "View in SN" and "Show Code." Add "Undo/Rollback" that calls the appropriate delete or revert API. For created artifacts: delete. For modified artifacts: restore the previous version. This makes the "approve" workflow less scary -- mistakes are recoverable.

### G. Workflow Templates (Saved Multi-Step Sequences)

Let users save a successful multi-tool sequence as a reusable template. Example: "Create field + Business Rule + UI Policy + Client Script for incident validation" becomes a one-click template. The agent already produces these multi-artifact sequences -- just add save/replay on top.

### H. Live Instance Health Dashboard

The existing `sn_analyze_instance` tool returns a health score. Show it as a persistent small indicator in the header/connection badge (like the existing green dot but with a score). When clicked, expand to a mini-dashboard with artifact counts, customization level, and recommendations. This turns the tool from "run once" to "always-on awareness."

---

## Recommended Phase 1 Refinements

Based on this review, these adjustments to the Phase 1 plan would reduce risk and enable the new possibilities above:

**1. Add a `tool_metadata` export to `tool-categories.ts`** -- Beyond just categorizing tools, tag each tool with `type: 'read' | 'write' | 'admin'` and `contextHints: string[]` (e.g., `['table', 'incident']`). This enables tool recommendations (Possibility C) and VAPT gating (which tools need approval).

**2. Design the `chat_messages` table with a `metadata` JSONB column** -- Store tool calls, token counts, artifacts created, and agent attribution per message from day one. This avoids a schema migration later when Phase 2 (agents) and Phase 3 (direct execution) need to write richer data.

**3. Keep `page-v2.tsx` functional from Phase 1** -- Don't just copy and badge it. Extract the 3 largest concerns from the 2577-line file into hooks/components immediately: (a) connection/auth flow into a `useConnection` hook, (b) streaming chat into a `useChatStream` hook, (c) message rendering stays in `ChatWindow`. This makes Phases 2-4 safe to parallelize.

**4. Add the context ribbon component in Phase 1** -- Even before multi-agent (Phase 2), the context ribbon is purely a UI component that attaches metadata chips to messages. It can work with the existing single-agent engine by injecting table/scope context into the system prompt. This gives the v2 shell an immediate visual differentiator.