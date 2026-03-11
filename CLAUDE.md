# CLAUDE.md - AI Agent Instructions

> ⚠️ **READ THIS FILE FIRST IN EVERY SESSION BEFORE DOING ANY WORK**

This file contains mandatory rules, processes, and context for AI agents working on this project.

---

## 1. Project Overview

**Project**: Yantra - AI Dev Agent - SN
**Purpose**: AI-powered ServiceNow development with spec-driven methodology  
**Instance**: dev300943.service-now.com  

This framework enables AI agents to develop, test, and deploy ServiceNow solutions following a structured, auditable process.

---

## 2. Critical Files to Read

Before starting any requirement work, read these files:

| File | Purpose |
|------|---------|
| `specs/config.properties` | Phase gates and sign-off rules |
| `specs/manifest.json` | Registry of all requirements and their status |
| `templates/` | Templates for spec, design, test, deployment docs |

---

## 3. ⛔ MANDATORY PHASE GATE PROCESS

**YOU MUST STOP AND WAIT FOR USER APPROVAL AT EACH GATE**

```
┌─────────────────────────────────────────────────────────────┐
│                   REQUIRED WORKFLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. CREATE SPEC (1-spec.md)                                 │
│     │                                                        │
│     └──▶ 🛑 STOP: "Please review the spec. Type 'approved'  │
│                    to proceed to design phase."              │
│                                                              │
│  2. CREATE DESIGN (2-design.md)                             │
│     │                                                        │
│     └──▶ 🛑 STOP: "Please review the design. Type 'approved'│
│                    to proceed to implementation."            │
│                                                              │
│  3. CREATE IMPLEMENTATION (3-implementation/)               │
│     │                                                        │
│     └──▶ 🛑 STOP: "Please review the code. Type 'approved'  │
│                    to deploy."                               │
│                                                              │
│  4. DEPLOY & TEST                                           │
│     │                                                        │
│     └──▶ 🛑 STOP: "Tests complete. Type 'approved' to mark  │
│                    requirement as done."                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Sign-Off Rules (from config.properties)

| Phase | Sign-off Required | Gate Enforced |
|-------|------------------|---------------|
| Spec → Design | ✅ YES | ✅ YES |
| Design → Implementation | ✅ YES | ✅ YES |
| Implementation → Testing | ❌ NO | ✅ YES |
| Testing → Deployment | ❌ NO | ✅ YES |

---

## 4. ❌ NEVER DO THESE

1. **NEVER auto-approve sign-offs** - Only the user can approve
2. **NEVER skip phases** - Spec before Design before Implementation
3. **NEVER mark sign-offs as complete yourself** - Use ☐ not ☑ until user approves
4. **NEVER deploy without user approval** - Always ask first
5. **NEVER create documentation files unless requested** - No README files, etc.
6. **NEVER commit/push code** - Only user can do this

---

## 5. ✅ ALWAYS DO THESE

1. **Read this file first** in every session
2. **Read config.properties** before starting requirement work
3. **Check manifest.json** for existing requirements and their status
4. **Use templates** from `templates/` for all documents
5. **Use clean naming** - No REQ-IDs in artifact names (e.g., `ValidateHighImpact` not `REQ003_ValidateHighImpact`)
6. **Validate before deploy** - Run `node scripts/validate.cjs REQ-XXX`

---

## 6. Project Structure

```
SN-AI-Dev-Agent/
│
├── CLAUDE.md                    # ← YOU ARE HERE - Read first!
├── README.md                    # Project readme
├── package.json
│
├── specs/                       # 📋 REQUIREMENT SPECIFICATIONS
│   ├── config.properties        # Phase gate settings
│   ├── manifest.json            # Requirement registry
│   └── REQ-XXX/                 # Requirement folders
│       ├── 1-spec.md
│       ├── 2-design.md
│       ├── 3-implementation/
│       ├── 4-testing/
│       └── 5-deployment.md
│
├── templates/                   # 📝 ALL TEMPLATES
│   ├── manifest.json            # Fresh project manifest template
│   ├── manifest.schema.md       # Manifest field documentation
│   ├── spec.md                  # Spec document template
│   ├── design.md                # Design document template
│   ├── test-plan.md             # Test plan template
│   ├── deployment.md            # Deployment record template
│   ├── business-rule.js         # ServiceNow code templates
│   ├── client-script.js
│   ├── script-include.js
│   └── deployment-manifest.json # Deployment manifest template
│
├── scripts/                     # 🔧 UTILITY SCRIPTS
│   ├── validate.cjs             # Requirement validation
│   ├── validate-deployment.js   # Deployment validation
│   └── atf-runner.cjs           # ATF test integration
│
├── mcp-servicenow/              # 🔌 MCP SERVER
│   ├── src/                     # MCP source code
│   │   ├── index.ts             # Entry point
│   │   ├── client/              # ServiceNow client
│   │   ├── tools/               # MCP tools
│   │   ├── deployer/            # DeploymentHelper class
│   │   └── types/               # TypeScript types
│   ├── deploy/                  # Generic deployer
│   │   └── deploy.js            # Generic deploy script
│   ├── tests/                   # Test scripts
│   └── lib/                     # Helper libraries
│
├── src/                         # 🛠️ CLI FRAMEWORK
│   ├── cli.js
│   ├── core/
│   └── utils/
│
└── docs/                        # 📚 DOCUMENTATION
    ├── architecture.md          # Full technical architecture doc
    └── BROWNFIELD-ENHANCEMENT-PLAN.md
```

---

## 7. Requirement Workflow Example

When user says: "Build a feature for X"

```
STEP 1: Understand
├── Ask clarifying questions if needed
└── Confirm scope with user

STEP 2: Create Spec
├── Create specs/REQ-XXX/1-spec.md using template
├── Leave sign-off section with ☐ (unchecked)
└── 🛑 STOP: "I've created the spec. Please review and reply 'approved' to continue."

STEP 3: Wait for Approval
├── User reviews spec
├── User says "approved"
└── Update sign-off to ☑ with user's approval

STEP 4: Create Design
├── Create specs/REQ-XXX/2-design.md using template
├── Leave sign-off section with ☐ (unchecked)
└── 🛑 STOP: "I've created the design. Please review and reply 'approved' to continue."

STEP 5: Wait for Approval
├── User reviews design
├── User says "approved"
└── Update sign-off to ☑ with user's approval

STEP 6: Create Implementation
├── Create specs/REQ-XXX/3-implementation/ files
├── Create deployment script in mcp-servicenow/deploy/
└── 🛑 STOP: "I've created the implementation. Please review and reply 'approved' to deploy."

STEP 7: Deploy & Test
├── Run deployment script
├── Run test suite
├── Capture results in 4-testing/
└── 🛑 STOP: "Deployment and tests complete. Please review results."

STEP 8: Complete
├── Update manifest.json status
└── Create 5-deployment.md with deployment record
```

---

## 8. ServiceNow Artifact Naming

| Artifact Type | Naming Pattern | Example |
|--------------|----------------|---------|
| Script Include | PascalCase, descriptive | `HighImpactJustificationUtil` |
| Business Rule | PascalCase, action-based | `ValidateHighImpactJustification` |
| Client Script | PascalCase, event-based | `HandleHighImpactChange` |
| UI Policy | PascalCase, behavior | `HighImpactFieldBehavior` |
| Custom Field | Snake_case with u_ prefix | `u_high_impact_justification` |

---

## 9. Key Commands

```bash
# Initialize a fresh project (resets manifest.json)
node scripts/init-project.js

# Validate a requirement
node scripts/validate.cjs REQ-XXX

# Deploy a requirement (generic deployer)
cd mcp-servicenow
node deploy/deploy.js REQ-XXX

# Run tests
cd mcp-servicenow
node tests/test-connection.js

# Test ServiceNow connection
cd mcp-servicenow
node tests/test-connection.js
```

---

## 10. Sign-Off Format

In spec and design documents, use this format:

**Before user approval:**
```markdown
## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Agent | 2026-01-20 | ☐ |
| Approver | | | ☐ |

> **Status:** ⬜ Draft
```

**After user approval:**
```markdown
## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Agent | 2026-01-20 | ☑ |
| Approver | Ratnesh Tiwari | 2026-01-20 | ☑ |

> **Status:** ☑ Approved
```

---

## 11. Error Recovery

If you make a mistake:
1. **Acknowledge it** - Don't hide errors
2. **Explain what went wrong** - Be transparent
3. **Propose fix** - Offer solution
4. **Wait for user direction** - Don't auto-fix without permission

---

## 12. Session Start Checklist

At the start of every session involving requirements:

- [ ] Read this CLAUDE.md file
- [ ] Read specs/config.properties
- [ ] Check specs/manifest.json for context
- [ ] Identify which requirement(s) are in progress
- [ ] Confirm current phase with user before continuing

---

## 13. Update Set Artifact Capture

> ⚠️ **IMPORTANT: REST API does NOT honor "current update set" session context like the UI does**

Artifacts created via REST API land in the "Default" update set instead of the intended target. This framework implements a **two-layer defense strategy** to ensure reliable capture.

### 14.1 Two-Layer Defense Strategy

**Layer 1 — Session-based capture** (`sn-client.ts`):
- Cookie-jar session persistence via `axios-cookiejar-support` + `tough-cookie`
- `callSetCurrentUpdateSetApi()` calls the UpdateSetHelper Scripted REST API
- Server-side runs `GlideUpdateSet().set()` to bind the session to the target update set

**Layer 2 — Post-creation move** (fallback in `sn-client.ts`):
- `moveArtifactToUpdateSet()` queries `sys_update_xml` after every create/update
- Moves records to the target update set if they landed in the wrong one
- Auto-move hooks in: `createRecord`, `updateRecord`, `createBusinessRule`, `createScriptInclude`, `createClientScript`

### 14.2 Duplicate Update Set Detection

`sn_create_update_set` checks for existing update sets with the same name **before** creating:

| Scenario | Behavior |
|----------|----------|
| No duplicate | Creates normally |
| Duplicate found (default) | Returns `duplicateDetected: true` with existing sets and 3 options |
| Duplicate + `autoTimestamp: true` | Auto-appends ISO timestamp to name |
| Duplicate + `force: true` | Skips check, creates duplicate |

**NEVER silently create duplicate update sets** — always surface the conflict to the user first.

### 14.3 New Tools

| Tool | Purpose |
|------|---------|
| `sn_move_to_update_set` | Manual fallback — move a specific artifact to a target update set |

### 14.4 Required Setup

1. Deploy the UpdateSetHelper Scripted REST API:
   ```bash
   cd mcp-servicenow
   node src/deployer/setup-updateset-api.js
   ```
2. Configure in `.env`:
   ```
   SN_UPDATE_SET_API_PATH=/api/<namespace>/update_set_helper/set_current
   ```

### 14.5 Implementation Workflow (for AI agents)

1. Call `sn_create_update_set` — handle `duplicateDetected` response if returned
2. Call `sn_set_current_update_set` with the update set sys_id
3. Create artifacts — each response includes `updateSetCapture` field confirming capture
4. Verify with `sn_get_update_set_contents`
5. Use `sn_move_to_update_set` as fallback for any missing artifacts

---

## 14. Live Session Telemetry

Every AI agent session generates a live-updating telemetry dashboard at `webapp/logs/telemetry-session-{suffix}.md`.

### How It Works
1. User clicks **Connect** → POST `/api/session-start` logs connection metadata and starts a 15-second telemetry interval
2. Every `logger.log()` call triggers a throttled `updateTelemetry()` (max once per 15s)
3. The telemetry generator parses the session JSONL log and regenerates the markdown dashboard
4. One file per session, overwritten in place — open in VS Code to watch live

### What's Captured
- **Connect metadata**: instance URL, username, model, AI provider
- **Phase transitions**: spec → design → scope_selection → implementation
- **Round-by-round activity**: tools called, durations, tokens, stop reasons
- **Tool usage stats**: per-tool call counts, success/failure rates, avg duration
- **Errors**: timestamped with tool name and message
- **Session Updates**: conversational narration with intent-based tool descriptions, phase-aware context, error categorization, and efficiency assessment

### Key Files
| File | Purpose |
|------|---------|
| `webapp/src/lib/telemetry-generator.ts` | JSONL parser → markdown generator + conversational narration |
| `webapp/src/lib/logger.ts` | Hooks `updateTelemetry()` into every log write |
| `webapp/src/app/api/session-start/route.ts` | Logs connect event, starts telemetry stream |

---

## 15. AI Agent Type Coercion (Schema Hardening)

AI agents frequently send string values where schemas expect `boolean`, `number`, or `object`. All MCP tool schemas use `z.preprocess()` to transparently coerce these inputs.

### Coerced Types
- **String → Boolean**: `"true"` / `"false"` → `true` / `false`
- **String → Number**: `"100"` → `100`
- **JSON String → Object**: `'{"name":"x"}'` → `{name:"x"}`

### Files with Coercion
`scripts.ts`, `records.ts`, `ui-policies.ts`, `notifications.ts`, `update-sets.ts`, `scheduled-jobs.ts`, `acls.ts`

### After Editing MCP Schemas
```bash
cd mcp-servicenow && rm -rf dist && npx tsc
```
Then restart the webapp server.

---

## 16. Inline Agent Activity (Chat Thinking Block)

Agent activity is displayed **inline in the chat flow** as a collapsible thinking block during AI processing. There is no sidebar Agent Activity panel.

### Key Design
- **No emojis/icons** — only pulsing dot (active step) and ✓ checkmark (completed step) in muted gray
- **Conversational labels** — tool names are mapped to friendly text (e.g., `sn_get_business_rules` + `{table:"incident"}` → "Business rules on incident")
- **Collapsible** — header shows latest step + tool count, chevron toggles step list
- **Deduplication** — "Starting...", "Round N: Analyzing..." merged into single "Analyzing your request..."

### Key Files
| File | Purpose |
|------|---------|
| `webapp/src/components/ChatWindow.tsx` | `InlineAgentActivity` component, `friendlyToolLabel()`, `processActivityLog()` |
| `webapp/src/app/page.tsx` | Captures `tool_start` events with `toolName` + `toolInput` into `activityLog[]` |

---

## 17. Theme System & Branding

### Theme Toggle
- Dark/light mode via `ThemeProvider.tsx` + `ThemeToggle.tsx` (sun/moon button in header)
- Persists to `localStorage`; defaults to dark
- CSS vars defined per theme in `globals.css` via `[data-theme="light"]` / `[data-theme="dark"]`

### Branding Configuration
All values configurable via `NEXT_PUBLIC_*` env vars in `webapp/.env`:

| Env Var | Default |
|---------|---------|
| `NEXT_PUBLIC_APP_NAME` | "Yantra - AI Dev Agent - SN" |
| `NEXT_PUBLIC_APP_TAGLINE` | "Say it. Ship it." |
| `NEXT_PUBLIC_APP_LOGO` | "/yantra-logo.png" |
| `NEXT_PUBLIC_PRIMARY_COLOR` | "blue" (or any preset: purple, green, teal, red, orange, indigo, or hex) |
| `NEXT_PUBLIC_ACCENT_COLOR` | "purple" |

### Key Files
| File | Purpose |
|------|---------|
| `webapp/src/lib/branding.ts` | Color presets (dark + light), env var resolution, CSS var exports |
| `webapp/src/components/ThemeProvider.tsx` | React context, theme state, CSS var injection |
| `webapp/src/components/ThemeToggle.tsx` | Toggle button UI |

---

## 18. UI Layout Notes

### Right Sidebar
Shows **only Connection info** (user, instance URL, roles). Pipeline Status and Agent Activity have been removed from the sidebar.

### Chat Avatars
User and AI avatars are **hidden** from the chat UI. The `userName` data is still available in the backend for telemetry/logging.

### Header Bar
Contains: Settings toggle, app title, connection badge, PhaseTracker (SDLC pipeline), theme toggle, Export button, New Chat button.

