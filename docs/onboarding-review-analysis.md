# CLAUDE.md Onboarding Review Analysis

> **Review Date:** 2026-03-20  
> **Reviewer Perspective:** Developer Onboarding Specialist  
> **Focus:** First-time AI agent experience, learning curve, quick reference, context gaps

---

## Executive Summary

CLAUDE.md is comprehensive but presents information in a way that challenges new AI agents. Critical concepts are buried deep, the learning path isn't progressive, and common pitfalls aren't highlighted upfront. The document would benefit from restructuring with a "Quick Start" section, better progressive disclosure, and upfront warnings about critical gotchas.

**Key Findings:**
- ⚠️ **Critical gap:** Section numbering is broken (Section 13 has subsections 14.1-14.6)
- ⚠️ **Critical gap:** No "Quick Start" - new agents must read 485 lines before understanding workflow
- ⚠️ **Critical gap:** Core concepts (update sets, scopes, MCP) are mentioned but not explained until deep in the document
- ⚠️ **Critical gap:** Custom scope requirement (must call `sn_set_scope` each turn) is buried in Section 14.6

---

## 1. Onboarding Gaps

### 1.1 Missing "Quick Start" Section

**Problem:** A new AI agent must read the entire 485-line document before understanding how to begin work. There's no "5-minute quick start" that gets an agent productive immediately.

**Impact:** High cognitive load upfront. Agents may skip critical sections or misunderstand the workflow.

**Recommendation:**
Add a new **Section 0: Quick Start** immediately after the header:

```markdown
## 0. Quick Start (5 Minutes)

**First time here?** Follow these steps to get started:

1. **Understand the workflow:**
   - User requests a feature → You create a spec → Wait for approval → Create design → Wait for approval → Implement → Deploy
   - See Section 7 for detailed workflow

2. **Before starting any requirement:**
   - Read `specs/config.properties` (phase gates)
   - Check `specs/manifest.json` (existing requirements)
   - Use templates from `templates/` folder

3. **Critical rules (read these now):**
   - ⛔ NEVER skip phases (Spec → Design → Implementation)
   - ⛔ NEVER auto-approve sign-offs
   - ⛔ NEVER deploy without user approval
   - ✅ ALWAYS stop and wait for approval at each gate

4. **Common first task:**
   - User says "Build feature X"
   - Create `specs/REQ-XXX/1-spec.md` using `templates/spec.md`
   - Stop and wait for approval

**Ready for details?** Continue reading from Section 1.
```

### 1.2 Missing Core Concept Definitions

**Problem:** Terms are used before they're explained:
- "Update set" - mentioned in Section 1, not explained until Section 13
- "Scope" - mentioned in Section 14.6, but what is it?
- "MCP" - mentioned in project structure, never explained
- "REQ-XXX" - used throughout, never explained what it means

**Impact:** New agents must infer meaning or skip ahead, leading to misunderstandings.

**Recommendation:**
Add **Section 1.5: Core Concepts** after Project Overview:

```markdown
## 1.5 Core Concepts

**Update Set:** A ServiceNow container for grouping related changes. Think of it as a "change request" that holds all artifacts (business rules, scripts, etc.) for a feature. Artifacts must be captured in update sets to be deployed.

**Scope:** ServiceNow's application isolation mechanism. "Global" scope is shared; custom scopes (applications) isolate code. When working in a custom scope, you MUST switch the session scope first (see Section 14.6).

**REQ-XXX:** A requirement identifier (e.g., REQ-001, REQ-002). Each requirement gets its own folder under `specs/REQ-XXX/` with spec, design, implementation, testing, and deployment documents.

**MCP (Model Context Protocol):** The communication layer between the webapp and ServiceNow. The `mcp-servicenow/` folder contains tools that the AI agent calls to interact with ServiceNow (create records, deploy code, etc.).
```

### 1.3 Missing "Why" Context

**Problem:** The document explains "what" and "how" but rarely "why." For example:
- Why do we need a three-layer defense for update sets? (Section 13)
- Why must scope be set each turn? (Section 14.6)
- Why are phase gates mandatory? (Section 3)

**Impact:** Without understanding the "why," agents may skip steps or misunderstand importance.

**Recommendation:**
Add "Why" callouts to critical sections:

```markdown
### 13. Update Set Artifact Capture

> **Why this matters:** ServiceNow's REST API doesn't automatically capture artifacts in update sets like the UI does. Without this three-layer defense, your code lands in the "Default" update set and can't be deployed. This is a known platform limitation (KB0867578).
```

### 1.4 Missing Connection Between Sections

**Problem:** Sections feel disconnected. For example:
- Section 13 (Update Sets) and Section 14.6 (Custom Scope) are related but separated
- Section 7 (Workflow Example) doesn't reference Section 13 or 14.6
- Section 9 (Commands) doesn't explain when to use each command

**Impact:** Agents don't see the big picture of how pieces fit together.

**Recommendation:**
Add cross-references and a "Related Sections" note at the start of complex sections:

```markdown
## 13. Update Set Artifact Capture

> **Related:** Section 14.6 (Custom Scope) - Update sets in custom scopes require scope switching first.

> **Why this matters:** [explanation]
```

---

## 2. Learning Path Issues

### 2.1 Wrong Information Order

**Problem:** Critical information is presented in the wrong order:

| Current Order | Issue | Better Order |
|--------------|-------|--------------|
| Section 3: Phase Gates | Good - early | Keep |
| Section 7: Workflow Example | Good - early | Keep |
| Section 13: Update Sets | Too late - needed for implementation | Move to Section 4-5 |
| Section 14.6: Custom Scope | Buried deep - critical for custom apps | Move to Section 6-7 |

**Impact:** Agents implementing features must jump around the document, missing critical steps.

**Recommendation:**
Restructure to progressive disclosure:

```
1. Project Overview
2. Quick Start (NEW)
3. Core Concepts (NEW)
4. Critical Files
5. Phase Gate Process
6. Update Set Basics (moved from 13)
7. Scope Basics (moved from 14.6)
8. Workflow Example
9. Advanced: Three-Layer Defense (from 13)
10. Advanced: Custom Scope Details (from 14.6)
...
```

### 2.2 No Progressive Disclosure

**Problem:** Everything is at the same level of detail. A new agent gets overwhelmed by:
- Section 13.1: Three-layer defense (very technical)
- Section 14.6: Five-tier fallback (very technical)
- Section 15: Type coercion (implementation detail)

**Impact:** New agents can't distinguish "must know" from "nice to know."

**Recommendation:**
Use clear section markers:

```markdown
## 6. Update Set Basics ⭐ **START HERE**

[Simple explanation: what update sets are, why they matter, basic workflow]

---

## 13. Advanced: Three-Layer Defense Strategy 🔧 **REFERENCE**

[Detailed technical explanation for when things go wrong]
```

### 2.3 Missing Prerequisites

**Problem:** Section 13 assumes knowledge of:
- ServiceNow REST API behavior
- Cookie-jar sessions
- `sys_update_xml` table
- `GlideUpdateSet` API

**Impact:** New agents skip this section or misunderstand it.

**Recommendation:**
Add prerequisites section:

```markdown
## 13. Update Set Artifact Capture

> **Prerequisites:** You should understand:
> - What update sets are (Section 6)
> - Basic ServiceNow REST API concepts
> - That REST API doesn't honor session context like the UI does

> **When to read this:** Read this before your first implementation. You can skip the technical details (13.1-13.3) and come back if artifacts aren't capturing correctly.
```

---

## 3. Quick Reference Needs

### 3.1 Commands Scattered

**Problem:** Section 9 lists commands but:
- Doesn't explain when to use each
- Doesn't link to related sections
- Has duplicate entries (test-connection.js appears twice)

**Impact:** Agents don't know which command to use when.

**Recommendation:**
Restructure Section 9 with context:

```markdown
## 9. Key Commands

### Before Starting Work
```bash
# Check existing requirements and their status
cat specs/manifest.json

# Read phase gate configuration
cat specs/config.properties
```

### During Development
```bash
# Validate a requirement before deploying
node scripts/validate.cjs REQ-XXX

# Deploy a requirement (after implementation approved)
cd mcp-servicenow
node deploy/deploy.js REQ-XXX
```

### Troubleshooting
```bash
# Test ServiceNow connection
cd mcp-servicenow
node tests/test-connection.js

# Validate scope switching (custom scope work)
cd mcp-servicenow
node tests/test-scope-switching.js
```
```

### 3.2 Tool Names Not Linked

**Problem:** Tool names are mentioned (e.g., `sn_create_update_set`, `sn_set_scope`) but:
- Not linked to where they're defined
- Not explained what they do
- Not shown with examples

**Impact:** Agents don't know what tools are available or how to use them.

**Recommendation:**
Add a "Common Tools" quick reference:

```markdown
## 9.5 Common Tools Quick Reference

| Tool | When to Use | Example |
|------|-------------|---------|
| `sn_create_update_set` | Start of implementation | `sn_create_update_set({name: "My Feature", application: "scope_sys_id"})` |
| `sn_set_current_update_set` | After creating update set | `sn_set_current_update_set({sys_id: "update_set_sys_id"})` |
| `sn_set_scope` | Before creating update set in custom scope | `sn_set_scope({scope_id: "scope_sys_id"})` |
| `sn_verify_scope` | After scope switch or user manual switch | `sn_verify_scope({target_scope_id: "scope_sys_id"})` |

> **Full tool list:** See `mcp-servicenow/src/tool-definitions.ts` for all available tools.
```

### 3.3 Workflow Not Easy to Find

**Problem:** Section 7 (Workflow Example) is good but:
- Buried after rules and structure
- Doesn't link to related sections
- Doesn't show error handling

**Impact:** Agents may miss it or not understand how it relates to other sections.

**Recommendation:**
- Move Section 7 earlier (after Quick Start)
- Add a "Common Workflows" section with quick links:

```markdown
## 7. Common Workflows

### New Feature Request
1. [Link to workflow example]
2. [Link to spec template]
3. [Link to phase gates]

### Custom Scope Implementation
1. [Link to scope section]
2. [Link to update set section]
3. [Link to multi-scope workflow]
```

---

## 4. Context Gaps

### 4.1 ServiceNow Platform Knowledge Assumed

**Problem:** The document assumes knowledge of:
- ServiceNow's update set system
- Scope isolation model
- REST API vs UI behavior differences
- `sys_update_xml` table structure

**Impact:** New agents without ServiceNow experience are lost.

**Recommendation:**
Add a "ServiceNow Primer" section or link to external docs:

```markdown
## 1.6 ServiceNow Primer (Optional)

If you're new to ServiceNow, understand these concepts:

**Update Sets:** [explanation with analogy]
**Scopes:** [explanation with analogy]
**REST API Limitations:** [explanation]

> **External Resources:**
> - [ServiceNow Update Sets Documentation](link)
> - [ServiceNow Application Scoping](link)
```

### 4.2 Project Architecture Not Explained

**Problem:** The document shows project structure but doesn't explain:
- What is `mcp-servicenow/` vs `webapp/`?
- How do they communicate?
- What is the relationship between CLI framework and MCP server?

**Impact:** Agents don't understand the system architecture.

**Recommendation:**
Expand Section 6 (Project Structure) with explanations:

```markdown
## 6. Project Structure

```
SN-AI-Dev-Agent/
│
├── CLAUDE.md                    # ← YOU ARE HERE
│
├── specs/                       # 📋 REQUIREMENT SPECIFICATIONS
│   └── [Your work lives here - specs, designs, implementations]
│
├── mcp-servicenow/              # 🔌 MCP SERVER (ServiceNow Integration)
│   └── [Tools that talk to ServiceNow - you call these via MCP]
│
├── webapp/                      # 🌐 WEB INTERFACE
│   └── [User-facing UI - you don't edit this during requirements]
│
└── templates/                   # 📝 TEMPLATES
    └── [Use these for all new requirements]
```

**Key Relationships:**
- **You (AI Agent)** → Create files in `specs/REQ-XXX/`
- **You** → Call MCP tools (defined in `mcp-servicenow/src/tools/`)
- **MCP Tools** → Talk to ServiceNow via REST API
- **Webapp** → Provides the chat interface you use
```

### 4.3 Error Scenarios Not Covered

**Problem:** The document doesn't explain:
- What happens if update set capture fails?
- What to do if scope switching fails?
- How to recover from phase gate mistakes?

**Impact:** Agents don't know how to handle errors.

**Recommendation:**
Expand Section 11 (Error Recovery) with common scenarios:

```markdown
## 11. Error Recovery & Troubleshooting

### Common Errors

**Artifacts not in update set:**
1. Check if scope was set correctly (Section 14.6)
2. Verify update set is "in progress" state
3. Use `sn_verify_update_set_capture` tool
4. See Section 13 for three-layer defense details

**Scope switch failed:**
1. Check if you're in a custom scope (not Global)
2. Try `sn_verify_scope` to see current state
3. If all tiers fail, follow Tier 5 manual checklist (Section 14.6)

**Phase gate mistake:**
1. Don't skip phases - go back and create missing documents
2. Don't auto-approve - wait for user approval
3. Update sign-off sections correctly (Section 10)
```

---

## 5. Specific Improvements

### 5.1 Fix Section Numbering

**Critical Bug:** Section 13 is titled "Update Set Artifact Capture" but has subsections 14.1-14.6. Section 14 is "Live Session Telemetry" but comes after 13's subsections.

**Fix:**
```markdown
## 13. Update Set Artifact Capture
### 13.1 Three-Layer Defense Strategy
### 13.2 Duplicate Update Set Detection
### 13.3 New Tools
### 13.4 Required Setup
### 13.5 Implementation Workflow
### 13.6 Custom Scope Update Set Capture

## 14. Live Session Telemetry
[rest of section 14]

## 15. AI Agent Type Coercion
[rest of section 15]

## 16. Inline Agent Activity
[rest of section 16]

## 17. Theme System & Branding
[rest of section 17]

## 18. UI Layout Notes
[rest of section 18]
```

### 5.2 Add "Critical Warnings" Box

**Add at the top, after the header:**

```markdown
## ⚠️ Critical Warnings (Read First)

1. **Custom Scope Work:** If working in a custom scope (not Global), you MUST call `sn_set_scope` at the start of EVERY implementation turn. The REST client resets each request. See Section 14.6.

2. **Update Set Capture:** ServiceNow REST API doesn't automatically capture artifacts. The three-layer defense (Section 13) handles this, but you must create the update set and set it as current first.

3. **Phase Gates:** NEVER skip phases or auto-approve. Always wait for user approval at each gate (Section 3).

4. **Scope + Update Set:** When creating an update set in a custom scope, switch scope FIRST, then create the update set. The scope guard in `sn_create_update_set` will catch this, but it's better to do it explicitly.
```

### 5.3 Add Decision Trees

**Add visual decision trees for common scenarios:**

```markdown
## 7.5 Decision Trees

### Starting a New Requirement

```
User says "Build feature X"
    │
    ├─→ Is this a new requirement?
    │   ├─→ YES: Create REQ-XXX folder, start with 1-spec.md
    │   └─→ NO: Check manifest.json for existing REQ-XXX
    │
    ├─→ What scope?
    │   ├─→ Global: Create update set (no application param)
    │   └─→ Custom: Call sn_set_scope first, then create update set
    │
    └─→ Follow phase gates (Section 3)
```

### Custom Scope Implementation

```
Start implementation turn
    │
    ├─→ Is target scope custom (not Global)?
    │   ├─→ YES: Call sn_set_scope({scope_id})
    │   │   ├─→ Success: Continue
    │   │   └─→ userActionRequired: Present checklist, wait for user
    │   └─→ NO: Skip scope switch
    │
    ├─→ Create update set
    │   └─→ Set as current
    │
    └─→ Create artifacts (they'll auto-capture in update set)
```
```

### 5.4 Add "Before You Start" Checklist

**Add as Section 2.5:**

```markdown
## 2.5 Before Starting Any Requirement - Checklist

- [ ] Read this CLAUDE.md file completely
- [ ] Read `specs/config.properties` (understand phase gates)
- [ ] Check `specs/manifest.json` (see existing requirements)
- [ ] Understand update sets (Section 6 or 13)
- [ ] If custom scope: Understand scope switching (Section 7 or 14.6)
- [ ] Know where templates are (`templates/` folder)
- [ ] Know the workflow (Section 7)
- [ ] Understand sign-off format (Section 10)

**First requirement?** Start with Section 0 (Quick Start) and follow the workflow example (Section 7) step-by-step.
```

### 5.5 Improve Section 14.6 (Custom Scope) Visibility

**Problem:** Critical information is buried. The requirement to call `sn_set_scope` each turn is easy to miss.

**Fix:**
1. Add a prominent callout at the top of Section 14.6:

```markdown
## 14.6 Custom Scope Update Set Capture

> ⚠️ **CRITICAL:** If you're working in a custom scope, you MUST call `sn_set_scope` at the start of EVERY implementation turn. The REST client is recreated each request, so scope resets. This is the #1 mistake new agents make.

**Quick Reference:**
- Custom scope? → Call `sn_set_scope` first
- Then create update set with `application=scope_sys_id`
- Verify with `sn_verify_scope` if unsure
```

2. Add a cross-reference in Section 7 (Workflow):

```markdown
## 7. Requirement Workflow Example

...

STEP 6: Create Implementation
├── **If custom scope:** Call `sn_set_scope` first (see Section 14.6) ⚠️
├── Create specs/REQ-XXX/3-implementation/ files
├── Create deployment script in mcp-servicenow/deploy/
└── 🛑 STOP: "I've created the implementation. Please review and reply 'approved' to deploy."
```

### 5.6 Add Examples Section

**Add Section 8.5 with concrete examples:**

```markdown
## 8.5 ServiceNow Artifact Examples

### Example 1: Simple Business Rule (Global Scope)

```javascript
// Name: ValidateHighImpactJustification
// Table: change_request
// When: before, insert, update
// Script:
(function executeRule(current, previous) {
    if (current.risk === 'high' && !current.u_high_impact_justification) {
        gs.addErrorMessage('High impact changes require justification');
        current.setAbortAction(true);
    }
})(current, previous);
```

### Example 2: Script Include (Custom Scope)

```javascript
// Name: HighImpactJustificationUtil
// Script:
var HighImpactJustificationUtil = Class.create();
HighImpactJustificationUtil.prototype = {
    initialize: function() {},
    validateJustification: function(change) {
        // Implementation
    },
    type: 'HighImpactJustificationUtil'
};
```

> **Note:** Use templates from `templates/` folder for full examples with all required fields.
```

---

## 6. Summary of Recommendations

### High Priority (Do First)

1. ✅ **Fix section numbering** (Section 13 → 13.1-13.6, renumber 14-18)
2. ✅ **Add Section 0: Quick Start** (5-minute getting started)
3. ✅ **Add Section 1.5: Core Concepts** (define update sets, scopes, MCP, REQ-XXX)
4. ✅ **Add Critical Warnings box** at the top
5. ✅ **Move Section 14.6 content earlier** (or add prominent cross-references)

### Medium Priority

6. ✅ **Restructure Section 9** (Commands with context)
7. ✅ **Add Section 9.5: Common Tools Quick Reference**
8. ✅ **Expand Section 11** (Error Recovery with scenarios)
9. ✅ **Add Section 2.5: Before You Start Checklist**
10. ✅ **Add cross-references** between related sections

### Low Priority (Nice to Have)

11. ✅ **Add decision trees** (Section 7.5)
12. ✅ **Add examples section** (Section 8.5)
13. ✅ **Add ServiceNow Primer** (Section 1.6)
14. ✅ **Add "Why" callouts** to critical sections
15. ✅ **Progressive disclosure markers** (⭐ START HERE, 🔧 REFERENCE)

---

## 7. Proposed New Structure

```
CLAUDE.md
│
├── Header + Critical Warnings Box
│
├── 0. Quick Start (5 Minutes) ⭐ NEW
│   └── Getting started workflow, critical rules, first task
│
├── 1. Project Overview
│   ├── 1.5 Core Concepts ⭐ NEW
│   └── 1.6 ServiceNow Primer (Optional) ⭐ NEW
│
├── 2. Critical Files to Read
│   └── 2.5 Before You Start Checklist ⭐ NEW
│
├── 3. ⛔ MANDATORY PHASE GATE PROCESS
│
├── 4. Update Set Basics ⭐ MOVED FROM 13
│   └── What they are, why they matter, basic workflow
│
├── 5. Scope Basics ⭐ MOVED FROM 14.6
│   └── What scopes are, when to switch, basic workflow
│
├── 6. Project Structure (with explanations)
│
├── 7. Requirement Workflow Example
│   └── 7.5 Decision Trees ⭐ NEW
│
├── 8. ServiceNow Artifact Naming
│   └── 8.5 Examples ⭐ NEW
│
├── 9. Key Commands (restructured with context)
│   └── 9.5 Common Tools Quick Reference ⭐ NEW
│
├── 10. Sign-Off Format
│
├── 11. Error Recovery & Troubleshooting (expanded)
│
├── 12. Session Start Checklist
│
├── 13. Advanced: Update Set Artifact Capture 🔧 REFERENCE
│   ├── 13.1 Three-Layer Defense Strategy
│   ├── 13.2 Duplicate Update Set Detection
│   ├── 13.3 New Tools
│   ├── 13.4 Required Setup
│   ├── 13.5 Implementation Workflow
│   └── 13.6 Custom Scope Update Set Capture
│
├── 14. Live Session Telemetry
│
├── 15. AI Agent Type Coercion
│
├── 16. Inline Agent Activity
│
├── 17. Theme System & Branding
│
└── 18. UI Layout Notes
```

---

## 8. Testing the Improvements

After implementing these changes, test with a new AI agent:

1. **First-time read:** Can an agent understand the workflow in < 10 minutes?
2. **Quick reference:** Can an agent find "how to create an update set in custom scope" in < 30 seconds?
3. **Error recovery:** Can an agent understand what to do when scope switch fails?
4. **Progressive disclosure:** Can an agent skip advanced sections and still be productive?

---

## Conclusion

CLAUDE.md is comprehensive but needs restructuring for onboarding. The proposed changes will:
- ✅ Reduce cognitive load for new agents
- ✅ Make critical information easier to find
- ✅ Provide progressive disclosure (basics → advanced)
- ✅ Fix structural issues (numbering, organization)
- ✅ Add missing context and examples

**Estimated Impact:** New agents should be productive 50% faster with these changes.
