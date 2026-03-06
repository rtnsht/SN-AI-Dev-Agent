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
├── webapp/                      # 🌐 NEXT.JS WEB APPLICATION
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main page (state owner, orchestration)
│   │   │   └── api/             # API routes
│   │   │       ├── chat/        # POST /api/chat (non-streaming)
│   │   │       ├── chat-stream/ # POST /api/chat-stream (SSE streaming)
│   │   │       ├── test-connection/ # POST /api/test-connection
│   │   │       ├── instance-prompts/ # POST /api/instance-prompts (dynamic starter cards)
│   │   │       ├── config/      # GET /api/config (public settings)
│   │   │       └── openrouter-models/ # GET /api/openrouter-models
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx   # Message list, input, dynamic prompts
│   │   │   ├── MessageBubble.tsx # Message rendering, user avatar initial
│   │   │   ├── SettingsPanel.tsx # Credentials, API key, usage meter
│   │   │   └── PhaseTracker.tsx # SDLC phase stepper
│   │   └── lib/
│   │       ├── sn-engine.ts     # AI orchestrator + instance prompt fetcher
│   │       ├── system-prompt.ts # SDLC prompt + confidentiality guardrails
│   │       ├── rate-limiter.ts  # IP-based sliding window limiter
│   │       └── types.ts         # Shared types (ChatMessage.hidden, etc.)
│   └── .env                     # API keys, rate limits, feature flags
│
├── src/                         # 🛠️ CLI FRAMEWORK
│   ├── cli.js
│   ├── core/
│   └── utils/
│
└── docs/                        # 📚 DOCUMENTATION
    ├── architecture.md          # Technical architecture (v2.3)
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

# Import Flow Designer Update Set (see Section 13)
node mcp-servicenow/lib/import-updateset.js <xml-file> --direct

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

## 13. Flow Designer Deployment

> ⚠️ **IMPORTANT: Flow Designer has complex internal requirements**

Flow Designer flows require **snapshots** that are created by the Flow Designer engine. Direct REST API table inserts create records but the flow won't be functional until activated via the UI.

### 13.1 Understanding Flow Designer Structure

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `sys_hub_flow` | Flow definition | name, internal_name, status, latest_snapshot, master_snapshot |
| `sys_hub_trigger_instance` | Flow trigger | flow, trigger_definition, trigger_type |
| `sys_hub_action_instance` | Action steps | flow, action_type, compiled_snapshot, order, ui_id |
| `sys_hub_flow_stage` | Flow stages | flow, label, stage_id, order |
| `sys_hub_flow_input` | Flow variables | Complex variable definitions |

**Critical:** Flows require `latest_snapshot` and `master_snapshot` references created when you **Activate/Publish** a flow.

### 13.2 Recommended Approach: REST API + Manual Activation

**Step 1:** Create flow structure via REST API (creates draft flow):
```bash
cd mcp-servicenow
node lib/create-flow-rest.js
```

**Step 2:** Open Flow Designer UI and:
1. Configure trigger conditions
2. Add/configure action steps
3. Click **Activate** to publish (creates snapshots)

### 13.3 Key Action Type IDs (for reference)

| Action | Snapshot ID | Definition ID |
|--------|-------------|---------------|
| Create Catalog Task | `af51fd0e73141300612c273ffff6a785` | `f597c41073081300612c273ffff6a767` |
| Log | `5bc1bcc6531003003bf1d9109ec587d4` | - |
| Service Catalog Trigger | - | `c43a1011c36813002841b63b12d3ae15` |

### 13.4 Alternative: Manual Flow Creation

For complex flows, create manually in Flow Designer UI:
1. Navigate to `Process Automation > Flow Designer`
2. Create new flow with trigger and actions
3. Activate the flow
4. Capture in Update Set for version control

### 13.5 Lessons Learned

- **Snapshots are mandatory** - Flow engine requires compiled snapshots
- **Action instances use snapshot IDs** - Not definition IDs
- **UI activation required** - Creates internal metadata and snapshots
- **Draft flows are accessible** - Can be opened and edited in UI

---

## 14. Update Set Artifact Capture

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

