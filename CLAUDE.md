# CLAUDE.md - AI Agent Instructions

> ⚠️ **READ THIS FILE FIRST IN EVERY SESSION BEFORE DOING ANY WORK**

This file contains mandatory rules, processes, and context for AI agents working on this project.

---

## 1. Project Overview

**Project**: SN AI Dev Agent  
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

