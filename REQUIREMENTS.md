# ServiceNow Development Requirements

> 📝 **How to use this file:**
> 1. Add your requirements below
> 2. Ask me: "Build requirement #1" or "Build all requirements"
> 3. I'll develop and deploy to your dev300943 instance

---

## 🔧 Instance Configuration

**Instance:** dev300943.service-now.com

### Available Scopes (auto-detected 2026-01-13)
| Scope ID | Name | Update Set |
|----------|------|------------|
| global | Global | (Default or create new) |
| sn_itsm_workspace | ITSM Workspace | (ServiceNow managed) |
| sn_itsm_analytics | ITSM Analytics | (ServiceNow managed) |

> 💡 No custom scoped apps on this instance. All deployments use **Global** scope.
> Run `node mcp-servicenow/discover-scopes.js` to refresh.

---

## 🎯 Requirements Backlog

---

### REQ-001: [Requirement ID: INC-XZ-001 – Dynamic Service-Aware, Skill-Based, Predictive Assignment & Auto-Remediation Orchestrator]
**Status:** ✅ Done

**Description:**
> Design and implement an advanced Incident assignment and remediation engine that dynamically routes and optionally auto-resolves incidents using service context, real-time patterns, resolver skills, and external automation systems, implemented via custom script includes, business rules, and Flow Designer custom actions

**Acceptance Criteria:**
When an Incident is created or updated, a server-side engine must:

Analyse CI/service, historical incidents, current open/major incidents, and problem records to classify the incident into a pattern cluster (e.g., “recurring DB timeouts on CI X in region Y”).
​

Determine optimal assignment group + individual using:

Service ownership (from CMDB / service registry).

Skill tags and certifications of users in candidate groups.

On-call schedules from an external on-call system (e.g., PagerDuty) via REST.
​

Decide between three outcomes based on configurable rules:

Direct assignment only.

Assignment + automatic runbook execution (restart service, clear cache, scale-out, etc.).

Auto-remediation with no human assignment unless remediation fails.
​

The engine must also:

Detect incident pattern thresholds (e.g., ≥5 similar incidents in 30 minutes on the same service) and automatically create/relate a Problem record with appropriate routing.
​

Avoid duplicate automation by correlating with any active Major Incident and active automation runs for the same service/CI.

---

### REQ-002: Deduplication Engine

**Status:** ✅ Done

**Description:**
>A robust design is a server-side dedup engine that detects similar/duplicate incidents and auto-merges them into a canonical “master” incident, preserving auditability and performance.

**Acceptance Criteria:**
- [ ] Deduplication rules
Duplicate candidates are incidents matching on configurable keys, e.g.:
Same correlation_id (from external monitoring/events).
OR same cmdb_ci, category, subcategory, and normalized short_description within a rolling time window (e.g., 30 minutes).
Rules stored in a custom table u_incident_dedupe_rule to avoid hardcoding logic.

- [ ] Merge behavior

Choose a master incident: oldest open P1–P3 with non-empty assignment group; others become children.
Auto-update duplicates:

Set parent_incident to master.

Append a standardized work note referencing the master.

Optionally close duplicates with state “Resolved – Duplicate” and resolution code.
​

Aggregate important fields from children to master (e.g., caller list, affected locations) via related list or a custom JSON field, not by overwriting base fields.

**Update Sets Created:**
- REQ-002 Incident Deduplication Engine: https://dev300943.service-now.com/sys_update_set.do?sys_id=8fa8516393d232102f57f0ba2bba109a

**Artifacts Deployed:**
| Artifact | Type | Description |
|----------|------|-------------|
| u_incident_dedupe_rule | Custom Table | Stores configurable dedup rules |
| IncidentDeduplicationEngine | Script Include | Main engine for detecting duplicates |
| DuplicateMergeProcessor | Script Include | Handles merge behavior & aggregation |
| Incident Deduplication Trigger | Business Rule | Triggers engine on incident insert |
| Correlation ID Match | Dedup Rule | Matches on correlation_id (60min window) |
| CI + Category + Description Match | Dedup Rule | Matches CI+category+subcategory+short_desc (30min) |

---

<!--
TEMPLATE - Copy this for new requirements:

### REQ-XXX: [Title]
**Status:** 📋 New | 🔨 In Progress | ✅ Done | ❌ Cancelled

**Description:**
> What should this feature do?

**Scope Mapping:** *(Optional - I'll infer if not specified)*
| Artifact | Type | Target Scope |
|----------|------|--------------|
| ExampleName | Script Include | global |
| AnotherOne | Business Rule | x_custom_app |

**Trigger/When:**
- When does this run? (e.g., "When an incident is created")

**Conditions:**
- What conditions must be true?

**Actions:**
- What should happen?

**Acceptance Criteria:**
- [ ] Criteria 1
- [ ] Criteria 2

**Update Sets Created:** *(Auto-filled after deployment)*
-

---
-->

