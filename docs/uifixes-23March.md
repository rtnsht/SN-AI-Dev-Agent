# UI Fixes — 23 March 2026

**Branch:** `cursor/uifixes-23March`
**Files changed:** 7 modified, 2 new (434 insertions, 105 deletions)

---

## Summary

Three independent workstreams shipped in this branch:

1. **Mermaid diagram error fix** — production users no longer see "Syntax error in text" banners when the AI generates invalid mermaid syntax
2. **ASCII diagram tab + queue panel redesign** — diagrams get a 4th viewing tab; queued messages move from inline chat bubbles to a collapsible panel above the input bar
3. **Tool execution limit fix** — AI no longer runs out of rounds during ATF creation; limits are now configurable via a Supabase-backed admin UI

---

## A. Mermaid Diagram Error Fix

### Problem

Mermaid v11 injects an error HTML element into the DOM when `mermaid.render()` encounters invalid syntax. The existing `try/catch` handles the JavaScript error but the DOM banner is already visible to users.

### Changes

| File | Change |
|---|---|
| `webapp/src/components/MessageBubble.tsx` | Added `await mermaid.parse()` pre-validation before `mermaid.render()` — validates syntax without DOM side-effects |
| `webapp/src/components/MessageBubble.tsx` | Added DOM cleanup in the `catch` block — removes orphaned `<div id="d{id}">` elements that mermaid leaks |
| `webapp/src/components/MessageBubble.tsx` | Added `DiagramErrorBoundary` class component wrapping `<MermaidDiagram>` — catches import failures and SVG render crashes, falls back to raw code view |

---

## B. ASCII Diagram Tab

### Problem

When mermaid rendering fails, the only fallback was a basic text-outline view derived from parsing mermaid syntax. If the syntax is invalid, the text converter also produces poor output.

### Solution

The AI now generates ASCII art independently and embeds it in the mermaid code block using `%% @ascii` / `%% @end-ascii` comment markers. Mermaid ignores `%%` comments, so SVG rendering is unaffected.

### Changes

| File | Change |
|---|---|
| `webapp/src/components/MessageBubble.tsx` | Added `extractAsciiArt()` and `stripAsciiArt()` helpers — extract AI-generated ASCII art from the comment block |
| `webapp/src/components/MessageBubble.tsx` | Added `"ascii"` to `DiagramView` union and `VIEW_OPTIONS` — 4th tab between Diagram and Text |
| `webapp/src/components/MessageBubble.tsx` | ASCII tab falls back to `mermaidToAscii()` if no `@ascii` section is present; on mermaid render failure, view defaults to ASCII tab |
| `webapp/src/lib/system-prompt.ts` | Added instruction for the AI to include `@ascii` / `@end-ascii` block with box-drawing characters inside every mermaid code fence |

### Convention

```
%% @ascii
%% ┌───────────┐      ┌───────────┐
%% │  Client    │─────>│  Server   │
%% └───────────┘      └───────────┘
%% @end-ascii
flowchart TD
  A[Client] --> B[Server]
```

---

## C. Queue Panel Redesign

### Problem

Queued messages rendered inline in the chat flow as message bubbles with dashed borders and 60% opacity. The only queue indicator near the input was a tiny count badge on the send button. The `onClearQueue` prop was wired but never used.

### Solution

Queued messages now appear in a **collapsible panel above the input bar** (matching the Cursor IDE pattern), not in the chat flow.

### Changes

| File | Change |
|---|---|
| `webapp/src/components/ChatWindow.tsx` | Added `queueExpanded` state and collapsible queue panel above `renderInputBar()` — header with chevron + "N Queued", expandable body with each message's text, "to submit" hint, cancel (X) button, and "Clear all" |
| `webapp/src/components/ChatWindow.tsx` | Queued messages filtered out of the chat message list (`!msg.queued`) |
| `webapp/src/components/ChatWindow.tsx` | Input placeholder updated to "Add a follow up..." when loading |
| `webapp/src/components/ChatWindow.tsx` | Queue count badge removed from send button |
| `webapp/src/components/MessageBubble.tsx` | Removed `onDequeue` prop, dashed border, opacity, and "Queued" badge styling (dead code since queued messages no longer render as bubbles) |

---

## D. Tool Execution Limit Fix

### Problem

During the testing phase, the AI hit the 20-round limit (reduced to 12 after planner) and told users: *"Unfortunately, I've reached the tool execution limit for this session."* ATF workflows need ~35 tool calls. The round-limit warning also caused Claude to preemptively surrender rather than complete the work.

### Root cause analysis

| Factor | Detail |
|---|---|
| Testing phase cap | 20 rounds (hardcoded in `PHASE_ROUND_LIMITS`) |
| Planner reduction | 60% retention, minimum 5 → effective 12 rounds |
| ATF workflow cost | ~23 calls for verification + ~12 for creation/execution = ~35 total |
| Warning behavior | System note at 3 rounds remaining caused Claude to announce the limit and dump a verbose "resume plan" |
| Non-streaming gap | `chat()` and `chatOpenRouter()` hardcoded 30 rounds, ignored phase limits |
| Provider divergence | Planner reduction used `effectiveMaxRounds` in Anthropic path but `maxToolRounds` in OpenRouter path |

### Changes

| File | Change |
|---|---|
| `mcp-servicenow/src/tool-definitions.ts` | Phase round limits bumped: testing 20→40, design 20→25, implementation 30→40 |
| `webapp/src/lib/sn-engine.ts` | Extracted `computeAdjustedRounds()` shared helper with 0.75 factor (was 0.6), minimum 10 (was 5), and `Math.min` safety clamp to prevent minimum from exceeding a phase's hard cap |
| `webapp/src/lib/sn-engine.ts` | Both `chatStream()` and `chatStreamOpenRouter()` now use the shared helper identically |
| `webapp/src/lib/sn-engine.ts` | `chat()` and `chatOpenRouter()` now use `getPhaseRoundLimit(phase)` instead of hardcoded 30 |
| `webapp/src/lib/sn-engine.ts` | Replaced module-level `_phaseRoundLimits` cache with async `loadEngineConfig()` — reads from Supabase `engine_config` table with 5-minute TTL, falls back to `tool-definitions.ts` constants |
| `webapp/src/lib/sn-engine.ts` | Reworded the round-limit warning to forbid disclosing limits to users |
| `webapp/src/lib/sn-engine.ts` | Updated `PHASE_GATE_REMINDERS` thresholds: testing 15→30, design 12→18, implementation 25→32 |
| `webapp/src/lib/system-prompt.ts` | Added reinforcement near concealment rules: never mention round limits, tool capacity, or provide resume plans |

### Supabase engine_config table

**Migration:** `webapp/supabase/migrations/018_engine_config.sql` (applied to production)

| Key | Default Value | Description |
|---|---|---|
| `phase_round_limits` | `{spec:15, design:25, scope_selection:5, implementation:40, testing:40, deployment:15}` | Max tool rounds per SDLC phase |
| `default_round_limit` | `30` | Fallback when no phase is set |
| `planner_budget_factor` | `0.75` | Fraction of budget retained after planner |
| `planner_budget_minimum` | `10` | Floor after planner reduction |

### Admin API

**New file:** `webapp/src/app/api/admin/engine-config/route.ts`

- `GET` — returns all config key-value pairs
- `POST` — upserts a single key with validation, invalidates in-memory cache, audit-logs the change

**Validation** (in `webapp/src/lib/request-validation.ts`):

| Key | Constraint |
|---|---|
| `phase_round_limits` | All 6 phases required, each 1-100 |
| `default_round_limit` | Integer 1-100 |
| `planner_budget_factor` | Number 0.01-1.0 |
| `planner_budget_minimum` | Integer 1-50 |

### Admin UI — "Engine" tab

**File:** `webapp/src/app/admin/page.tsx` (8th tab)

- Phase Round Limits card: 6 number inputs with min/max validation, inline defaults and phase descriptions
- Planner Settings card: budget factor (with percentage label), minimum rounds, default round limit
- Single "Save All" button
- "Reset to Defaults" button
- Dirty state indicator ("Unsaved changes")
- Propagation delay toast on save ("Changes take up to 5 minutes to apply")

---

## Deployment Notes

1. Migration `018_engine_config.sql` has been applied to the Supabase production instance
2. MCP package rebuild required: `cd mcp-servicenow && rm -rf dist && npx tsc`
3. System prompt change will invalidate Anthropic prompt cache on first request per user (one-time cost)
4. Cache invalidation from admin saves is best-effort across Vercel isolates; the 5-minute TTL is the primary mechanism

## Files Changed

| File | Lines | Type |
|---|---|---|
| `mcp-servicenow/src/tool-definitions.ts` | +3 -3 | Modified |
| `webapp/src/app/admin/page.tsx` | +163 | Modified |
| `webapp/src/app/api/admin/engine-config/route.ts` | +70 | **New** |
| `webapp/src/components/ChatWindow.tsx` | +75 -12 | Modified |
| `webapp/src/components/MessageBubble.tsx` | +70 -64 | Modified |
| `webapp/src/lib/request-validation.ts` | +43 | Modified |
| `webapp/src/lib/sn-engine.ts` | +90 -26 | Modified |
| `webapp/src/lib/system-prompt.ts` | +2 | Modified |
| `webapp/supabase/migrations/018_engine_config.sql` | +18 | **New** |
