# SDLC Phase Improvements — v0.1.0-beta.1

> Date: 2026-03-23 | Related: Transcript analysis of first beta user session

## Overview

Five improvements to the SDLC workflow based on real user interaction analysis. These address incorrect ServiceNow messaging, missing ATF tooling, a critical API error bug, and an incomplete deployment phase.

---

## 1. AI Disclaimer

**File**: `webapp/src/components/ChatWindow.tsx`

Added a persistent disclaimer below the chat input:

> This is Agentic AI and can make mistakes. Please double-check responses.

Appears in both active chat (bottom bar) and connected hero (empty state). Styled at 11px muted text, matching industry standard patterns (ChatGPT, Gemini, Copilot).

---

## 2. Dedup Warning Bug Fix (Critical)

**File**: `webapp/src/lib/sn-engine.ts`

### The Bug

The duplicate tool call detection system injected a `tool_result` with a fake `tool_use_id: "dedup_warning"` that had no corresponding `tool_use` block in the previous assistant message. The Anthropic API requires every `tool_result` to match a `tool_use`, causing:

```
400 {"type":"error","error":{"type":"invalid_request_error",
"message":"messages.44.content.2: unexpected tool_use_id found in tool_result blocks: dedup_warning..."}}
```

This raw JSON error was surfaced directly to the user.

### The Fix

1. **Message structure**: Replaced fake `tool_result` with a valid `{ type: "text" }` block appended after tool_results in the same user message. Anthropic allows mixed `tool_result` + `text` content when tool_results come first.

2. **Error sanitization**: Added `sanitizeApiError()` function that converts raw API error bodies, HTTP status codes, and technical error messages into user-friendly text. Applied to both Anthropic and OpenRouter error paths.

---

## 3. Rollback Plan Messaging

**File**: `webapp/src/lib/system-prompt.ts` (design + deployment sections)

### The Problem

The system prompt instructed the AI to say "Delete the update set to remove all artifacts in a single action." In ServiceNow, deleting a `sys_update_set` record only removes the tracking record — deployed artifacts remain on the instance.

### The Fix

Updated both `<design>` and `<deployment>` sections with ServiceNow-accurate rollback guidance:

- **Mark as Ignore** — prevents promotion to other environments
- **Move entries** — relocate specific `sys_update_xml` entries to a scratch update set
- **Manual deletion** — delete artifacts in reverse dependency order (instances → layout → page → widgets)
- **Explicit note**: "Deleting an update set record only removes the sys_update_set row — deployed artifacts remain on the instance"

---

## 4. Deployment Phase Enhancements

**Files**: `system-prompt.ts`, `tool-definitions.ts`

### Pre-Deployment Quality Scan

The deployment phase now runs quality checks before finalizing:
- `sn_code_quality_score` — scans all scripted artifacts
- `sn_find_anti_patterns` — detects 25+ anti-patterns
- `sn_detect_ootb_overrides` — checks for OOTB artifact modifications

Added these tools to the `deployment` phase tool set alongside existing `sn_validate_change` and `sn_preview_change_impact`.

### Update Set Finalization

The agent now:
1. Auto-generates a description summarizing all changes
2. Presents the user with a choice:
   - **Complete with description** — ready for promotion
   - **Complete without description** — mark Complete only
   - **Leave in progress** — for further changes
   - **Ignore** — excluded from promotion

---

## 5. ATF (Automated Test Framework) Tooling

**Files**: `mcp-servicenow/src/tools/atf.ts` (new), `tool-registry.ts`, `tool-definitions.ts`, `system-prompt.ts`

### New MCP Tools

| Tool | Purpose |
|------|---------|
| `sn_enable_atf_property` | Enable `sn_atf.runner.enabled` system property |
| `sn_create_atf_suite` | Create complete suite with tests + server-side steps in one call |
| `sn_run_atf_suite` | Trigger execution: CI/CD API → Playwright browser → manual fallback |
| `sn_get_atf_results` | Poll suite + individual test pass/fail results |

### Execution Tiers

1. **CI/CD API** (`POST /api/sn_cicd/testsuite/run`) — fastest, no browser needed
2. **Playwright browser automation** — navigates to suite page, clicks "Run Test Suite" (same infrastructure as scope switching)
3. **Manual fallback** — provides user with direct link + step-by-step instructions

### ATF Capability Matrix

| Capability | Status |
|-----------|--------|
| Create ATF Suites, Tests, Steps | Fully supported via Table API |
| Server-side tests (Record Query, Validation, Run Script) | No browser required |
| Client-side/UI tests | Requires browser agent (Playwright or manual) |
| Enable ATF runner property | Fully supported |
| Trigger execution | 3-tier fallback (API → browser → manual) |
| Poll results | Fully supported |
| Test data rollback | Automatic (ATF built-in) |

### Testing Phase Flow

The `<testing>` section now follows a 3-step flow:

1. **Design & Verify** — Use existing tools to verify implementation, design comprehensive test matrix (positive/negative/security), present results
2. **Create ATF Suite** — Present capability disclosure, get user approval, then create suite with server-side steps
3. **Execute & Report** — Enable ATF property → trigger execution → poll results → report pass/fail

### Supported Server-Side Step Types

- **Run Server-Side Script** — Execute GlideRecord/GlideAggregate/GlideSystem logic
- **Record Query** — Query table with conditions, pass if record found
- **Record Validation** — Assert field values on a record
- **Record Insert** — Create test records
- **Record Update** — Modify test records

---

## Files Changed

| File | Change Type |
|------|-------------|
| `webapp/src/components/ChatWindow.tsx` | AI disclaimer |
| `webapp/src/lib/sn-engine.ts` | Dedup bug fix + error sanitization |
| `webapp/src/lib/system-prompt.ts` | Rollback, testing, deployment rewrites |
| `mcp-servicenow/src/tools/atf.ts` | New — ATF tools |
| `mcp-servicenow/src/tool-registry.ts` | Register ATF tools |
| `mcp-servicenow/src/tool-definitions.ts` | ATF definitions + deployment quality tools |
