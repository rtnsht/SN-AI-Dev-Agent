# REQ-002: Technical Design Document

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-002 |
| **Spec Version** | 1.0 |
| **Author** | AI Agent |
| **Created** | 2026-01-20 |
| **Last Updated** | 2026-01-20 |
| **Version** | 1.0 |
| **Status** | Draft |

---

## 1. Instance Discovery

### 1.1 Discovery Summary

| Metric | Value |
|--------|-------|
| **Table Analyzed** | sc_req_item, sc_cat_item, sys_hub_flow |
| **Keywords Used** | new hire, equipment, bundle, onboarding, fulfillment |
| **Total Artifacts Found** | 0 (net new implementation) |
| **Discovery Date** | 2026-01-20 |

### 1.2 Relevant Existing Artifacts

| Artifact Name | Type | Action | Reason |
|---------------|------|--------|--------|
| Service Catalog | Platform | ☑ Reuse | OOB catalog infrastructure |
| Flow Designer | Platform | ☑ Reuse | Orchestration engine |
| sc_req_item | Table | ☑ Extend | Add tracking fields |

### 1.3 OOTB Capabilities Check

| OOTB Feature | Matches Requirement? | Notes |
|--------------|---------------------|-------|
| Catalog Item Workflows | ☑ Partial | Need custom orchestration flow |
| Flow Designer Wait Conditions | ☑ Full | Can wait for child task completion |
| Email Notifications | ☑ Full | OOB notification mechanism |

### 1.4 Implementation Decision

> **Based on discovery, we will:**
> - ☑ **Build New** - Custom Flow Designer flow for orchestration
> - ☑ **Extend Existing** - Extend sc_req_item with tracking fields

---

## 2. Solution Overview

### 2.1 Summary
A Flow Designer subflow triggered on RITM approval that spawns three catalog tasks (Laptop, Access, Welcome Kit), waits for all to complete, then closes the RITM and sends notifications to the requester and hiring manager.

### 2.2 Goals
- Zero manual intervention after approval
- All fulfillment tasks created atomically
- Reliable completion detection
- Timely stakeholder notifications

### 2.3 Non-Goals
- Hardware inventory management
- Approval routing logic
- Budget tracking

---

## 3. Architecture

### 3.1 System Context Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE CATALOG                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [User Request] ──▶ [RITM Approved] ──▶ [Orchestration Flow]    │
│                                              │                   │
│                    ┌─────────────────────────┼───────────────┐  │
│                    │                         ▼               │  │
│                    │    ┌──────────────────────────────┐    │  │
│                    │    │   NewHireBundle Flow         │    │  │
│                    │    │   (Flow Designer)            │    │  │
│                    │    └──────────────────────────────┘    │  │
│                    │         │         │         │          │  │
│                    │         ▼         ▼         ▼          │  │
│                    │    [Laptop]  [Access]  [Welcome]       │  │
│                    │      Task      Task      Task          │  │
│                    │         │         │         │          │  │
│                    │         └─────────┼─────────┘          │  │
│                    │                   ▼                    │  │
│                    │         [All Tasks Complete?]          │  │
│                    │                   │                    │  │
│                    │                   ▼                    │  │
│                    │         [Close RITM + Notify]          │  │
│                    └────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Flow Designer Sequence
```
1. TRIGGER: RITM state = Approved (for "New Hire Equipment Bundle")
2. ACTION: Create Catalog Task - Laptop Provisioning
3. ACTION: Create Catalog Task - Access Provisioning  
4. ACTION: Create Catalog Task - Welcome Kit Delivery
5. WAIT: All 3 tasks reach state = Closed Complete
6. ACTION: Update RITM state = Closed Complete
7. ACTION: Send Email to Requester
8. ACTION: Send Email to Hiring Manager
```

---

## 4. Artifacts to Create

### 4.1 Naming Convention

> ☑ Using clean noun+verb naming (no REQ-IDs in artifact names)

### 4.2 Summary Table

| Artifact | Type | REST Table | Automatable | Description |
|----------|------|------------|-------------|-------------|
| NewHireBundleOrchestration | Flow | sys_hub_flow | ✅ | Main orchestration flow |
| NewHireBundleCatalogItem | Catalog Item | sc_cat_item | ✅ | Bundle catalog item |
| u_hiring_manager | Field | sys_dictionary | ✅ | Hiring manager reference on RITM |
| NewHireBundleComplete | Email Template | sys_email_template | ✅ | Completion notification template |
| NewHireBundleUtil | Script Include | sys_script_include | ✅ | Helper functions |

### 4.3 Deployment Mapping Checklist

| # | Artifact Name | REST Table | Verified | Notes |
|---|---------------|------------|----------|-------|
| 1 | NewHireBundleCatalogItem | sc_cat_item | [x] | Standard catalog |
| 2 | u_hiring_manager | sys_dictionary | [x] | Custom field on sc_req_item |
| 3 | NewHireBundleUtil | sys_script_include | [x] | Script Include |
| 4 | NewHireBundleOrchestration | sys_hub_flow | [x] | Flow Designer flow |
| 5 | NewHireBundleComplete | sysevent_email_action | [x] | Notification |

### 4.4 Artifact Details

#### 4.4.1 NewHireBundleCatalogItem
- **Type:** Catalog Item
- **Table:** sc_cat_item
- **Purpose:** User-facing catalog item for requesting new hire equipment bundle
- **Variables:**
  - `new_hire_name` (String) - Name of the new hire
  - `start_date` (Date) - Expected start date
  - `hiring_manager` (Reference: sys_user) - Hiring manager for notifications
  - `department` (Reference: cmn_department) - Department for assignment
- **Workflow:** Triggers NewHireBundleOrchestration flow on approval

#### 4.4.2 NewHireBundleOrchestration (Flow Designer)
- **Type:** Flow
- **Table:** sys_hub_flow
- **Trigger:** Record Updated - sc_req_item where stage = approved AND cat_item = NewHireBundleCatalogItem
- **Flow Steps:**
  1. Create Catalog Task (Laptop Provisioning) - Assignment: Hardware Team
  2. Create Catalog Task (Access Provisioning) - Assignment: IT Security
  3. Create Catalog Task (Welcome Kit Delivery) - Assignment: Facilities
  4. Wait for Condition: All 3 tasks state = Closed Complete
  5. Update RITM: state = Closed Complete
  6. Send Email: Requester notification
  7. Send Email: Hiring manager notification

#### 4.4.3 NewHireBundleUtil (Script Include)
- **Type:** Script Include
- **Table:** sys_script_include
- **Purpose:** Utility functions for bundle orchestration
- **Key Methods:**
  - `getChildTaskStatus(ritmSysId)` - Returns status of all child tasks
  - `areAllTasksComplete(ritmSysId)` - Boolean check for completion
  - `getHiringManager(ritmSysId)` - Retrieves hiring manager from RITM variables

#### 4.4.4 u_hiring_manager (Custom Field)
- **Type:** Reference Field
- **Table:** sc_req_item (sys_dictionary)
- **Reference:** sys_user
- **Purpose:** Store hiring manager for notification purposes

#### 4.4.5 NewHireBundleComplete (Notification)
- **Type:** Email Notification
- **Table:** sysevent_email_action
- **Event:** (triggered by flow action)
- **Recipients:** Requester, Hiring Manager
- **Subject:** "New Hire Equipment Bundle Complete - ${new_hire_name}"

---

## 5. Data Model

### 5.1 New Tables

None - using existing Service Catalog tables.

### 5.2 Existing Table Changes

| Table | Change Type | Details |
|-------|-------------|---------|
| sc_req_item | New field | u_hiring_manager (Reference to sys_user) |

### 5.3 Catalog Item Variables

| Variable Name | Type | Mandatory | Reference | Description |
|---------------|------|-----------|-----------|-------------|
| new_hire_name | String | Yes | | Name of new hire |
| start_date | Date | Yes | | Expected start date |
| hiring_manager | Reference | Yes | sys_user | Manager for notifications |
| department | Reference | No | cmn_department | Department assignment |

---

## 6. Integration Points

### 6.1 Internal Integrations

| System | Direction | Method | Purpose |
|--------|-----------|--------|---------|
| Service Catalog | Inbound | GlideRecord | RITM and task management |
| Flow Designer | Internal | Flow Engine | Orchestration execution |
| Email | Outbound | gs.eventQueue | Notifications |

### 6.2 External Integrations

None required for this implementation.

---

## 7. Security Considerations

### 7.1 Access Control

| Role | Access Level | Restrictions |
|------|--------------|--------------|
| catalog_user | Create Request | Own requests only |
| itil | Fulfill Tasks | Assigned tasks only |
| catalog_admin | Full | Configure catalog items |

### 7.2 ACLs Required

No custom ACLs required - using OOB Service Catalog ACLs.

---

## 8. Performance Considerations

- Flow Designer wait conditions use efficient polling
- Child task creation is atomic (all-or-nothing)
- Email notifications are asynchronous via event queue

### 8.1 Indexing Strategy

| Table | Index Fields | Reason |
|-------|--------------|--------|
| sc_task | parent, state | Fast lookup of child task status |

---

## 9. Error Handling

| Error Scenario | Handling Strategy | User Message |
|----------------|-------------------|--------------|
| Child task creation fails | Rollback all tasks, set RITM to error state | "Bundle creation failed - contact IT" |
| Task stuck incomplete > 7 days | Flow timeout, escalate to manager | "Fulfillment delayed - escalated" |
| Hiring manager field empty | Default to requester for notification | (no user message, silent fallback) |

---

## 10. Rollback Plan

1. Delete Flow: NewHireBundleOrchestration
2. Delete Catalog Item: NewHireBundleCatalogItem
3. Remove Field: u_hiring_manager from sc_req_item
4. Delete Script Include: NewHireBundleUtil
5. Delete Notification: NewHireBundleComplete

---

## 11. Open Questions

| ID | Question | Owner | Status | Resolution |
|----|----------|-------|--------|------------|
| Q-001 | What assignment groups for each task type? | User | Resolved | Hardware Team, IT Security, Facilities |
| Q-002 | Should partial completion notify? | User | Resolved | No, only full completion triggers notification |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Agent | 2026-01-20 | ☑ |
| Approver | User | 2026-01-20 | ☑ |

### Approval Status

> **Status:** ☑ Approved

