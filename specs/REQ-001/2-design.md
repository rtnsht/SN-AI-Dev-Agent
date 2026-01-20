# REQ-001: Technical Design Document

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-001 |
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
| **Table Analyzed** | change_request, cmn_schedule |
| **Keywords Used** | maintenance window, normal change, planning |
| **Total Artifacts Found** | OOTB Change Management module |
| **Discovery Date** | 2026-01-20 |

### 1.2 Relevant Existing Artifacts

| Artifact Name | Type | Action | Reason |
|---------------|------|--------|--------|
| change_request table | Table | ☑ Extend | Add maintenance window detection logic |
| cmn_schedule | Table | ☑ Reuse | Existing schedule infrastructure |
| cmdb_ci_service | Table | ☑ Reuse | Business services with schedule links |

### 1.3 OOTB Capabilities Check

| OOTB Feature | Matches Requirement? | Notes |
|--------------|---------------------|-------|
| Change Management | ☑ Partial | Base table exists, need custom validation |
| Schedule Management | ☑ Partial | Schedules exist, need MW-specific config |
| Event/Notification | ☑ Full | Standard gs.eventQueue mechanism |

### 1.4 Implementation Decision

> **Based on discovery, we will:**
> - ☑ **Extend Existing** - Add custom validation, UI messaging, and notifications to OOTB Change Management

---

## 2. Solution Overview

### 2.1 Summary
This solution extends ServiceNow's standard Change Management module with:
1. A **Script Include** to detect maintenance window overlaps and validate planning fields
2. A **Client Script** to provide real-time form guidance when maintenance window is detected
3. A **Business Rule** to enforce mandatory fields on save
4. **Events and Notifications** for stakeholder communication at lifecycle points

### 2.2 Goals
- Detect when Normal Change dates overlap with Business Service maintenance windows
- Display informative guidance on the change form
- Enforce mandatory planning fields (Implementation Plan, Backout Plan, Test Plan)
- Send notifications at: creation, approval, implementation start, closure

### 2.3 Non-Goals
- Modifying Emergency or Standard Change workflows
- Creating new maintenance window management UI
- Change collision detection

---

## 3. Architecture

### 3.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CHANGE REQUEST FORM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐         ┌─────────────────────────────┐   │
│  │ OnChange Client     │────────▶│ MaintenanceWindowUtil       │   │
│  │ Script              │  AJAX   │ (Script Include)            │   │
│  │                     │◀────────│                             │   │
│  │ - Detects field     │         │ - isInMaintenanceWindow()   │   │
│  │   changes           │         │ - getMaintenanceWindowInfo()│   │
│  │ - Shows guidance    │         │ - validatePlanningFields()  │   │
│  └─────────────────────┘         └─────────────────────────────┘   │
│                                              │                      │
└──────────────────────────────────────────────│──────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVER-SIDE LOGIC                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐         ┌─────────────────────────────┐   │
│  │ ValidateMaintenance │         │ NotifyMaintenanceWindow     │   │
│  │ WindowChange (BR)   │         │ Stakeholders (BR)           │   │
│  │                     │         │                             │   │
│  │ - Before Insert     │         │ - After Insert/Update       │   │
│  │ - Before Update     │         │ - Fires events              │   │
│  │ - Validates fields  │         │                             │   │
│  └─────────────────────┘         └──────────────┬──────────────┘   │
│                                                  │                  │
└──────────────────────────────────────────────────│──────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        NOTIFICATION LAYER                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────┐  ┌────────────────────┐                    │
│  │ Events             │  │ Notifications      │                    │
│  │                    │  │                    │                    │
│  │ • mw.change.created│  │ • MW Change Created│                    │
│  │ • mw.change.approved│ │ • MW Change Approved│                   │
│  │ • mw.change.started│  │ • MW Change Started│                    │
│  │ • mw.change.closed │  │ • MW Change Closed │                    │
│  └────────────────────┘  └────────────────────┘                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Sequence Diagram - Form Load & Validation

```
User          Client Script       AJAX/GlideAjax      Script Include       Business Rule
 │                  │                    │                   │                    │
 │  Open Change     │                    │                   │                    │
 │─────────────────▶│                    │                   │                    │
 │                  │                    │                   │                    │
 │  Change dates/   │                    │                   │                    │
 │  service         │                    │                   │                    │
 │─────────────────▶│                    │                   │                    │
 │                  │  checkMaintWindow  │                   │                    │
 │                  │───────────────────▶│                   │                    │
 │                  │                    │ isInMaintWindow() │                    │
 │                  │                    │──────────────────▶│                    │
 │                  │                    │    true/false     │                    │
 │                  │                    │◀──────────────────│                    │
 │                  │   {inWindow, info} │                   │                    │
 │                  │◀───────────────────│                   │                    │
 │  Show guidance   │                    │                   │                    │
 │◀─────────────────│                    │                   │                    │
 │                  │                    │                   │                    │
 │  Save Change     │                    │                   │                    │
 │─────────────────────────────────────────────────────────────────────────────▶│
 │                  │                    │                   │ validateFields()   │
 │                  │                    │                   │◀───────────────────│
 │                  │                    │                   │   valid/invalid    │
 │                  │                    │                   │──────────────────▶│
 │  Error or Save   │                    │                   │                    │
 │◀─────────────────────────────────────────────────────────────────────────────│
```

---

## 4. Artifacts to Create

### 4.1 Naming Convention

> ✅ Using clean, descriptive names without REQ-IDs:
> - `MaintenanceWindowUtil` (Script Include)
> - `ValidateMaintenanceWindowChange` (Business Rule)
> - `MaintenanceWindowFormGuidance` (Client Script)
> - `mw.change.created` (Event naming pattern)

### 4.2 Summary Table

| Artifact | Type | REST Table | Automatable | Description |
|----------|------|------------|-------------|-------------|
| MaintenanceWindowUtil | Script Include | sys_script_include | ✅ | Core logic for MW detection and validation |
| ValidateMaintenanceWindowChange | Business Rule | sys_script | ✅ | Enforces mandatory fields on save |
| NotifyMaintenanceWindowStakeholders | Business Rule | sys_script | ✅ | Fires notification events |
| MaintenanceWindowFormGuidance | Client Script | sys_script_client | ✅ | Displays form guidance |
| mw.change.created | Event Registration | sysevent_register | ✅ | Event for change creation |
| mw.change.approved | Event Registration | sysevent_register | ✅ | Event for change approval |
| mw.change.started | Event Registration | sysevent_register | ✅ | Event for implementation start |
| mw.change.closed | Event Registration | sysevent_register | ✅ | Event for change closure |
| MW Change Created | Notification | sysevent_email_action | ✅ | Email on creation |
| MW Change Approved | Notification | sysevent_email_action | ✅ | Email on approval |
| MW Change Started | Notification | sysevent_email_action | ✅ | Email on implementation |
| MW Change Closed | Notification | sysevent_email_action | ✅ | Email on closure |

### 4.3 Deployment Mapping Checklist

| # | Artifact Name | REST Table | Verified | Notes |
|---|---------------|------------|----------|-------|
| 1 | MaintenanceWindowUtil | sys_script_include | [x] | Standard REST API |
| 2 | ValidateMaintenanceWindowChange | sys_script | [x] | Business Rule table |
| 3 | NotifyMaintenanceWindowStakeholders | sys_script | [x] | Business Rule table |
| 4 | MaintenanceWindowFormGuidance | sys_script_client | [x] | Client Script table |
| 5 | mw.change.* events | sysevent_register | [x] | Event registry |
| 6 | MW Change * notifications | sysevent_email_action | [x] | Email action table |

### 4.4 Artifact Details

#### 4.4.1 MaintenanceWindowUtil (Script Include)
- **Type:** Script Include
- **Table:** sys_script_include
- **Client Callable:** true (for GlideAjax)
- **Purpose:** Central utility for maintenance window operations
- **Key Methods:**
  - `isInMaintenanceWindow(serviceId, startDate, endDate)` - Returns true if dates overlap with service's MW
  - `getMaintenanceWindowInfo(serviceId, startDate, endDate)` - Returns MW details for display
  - `validatePlanningFields(changeGR)` - Validates mandatory fields, returns validation result
  - `getStakeholders(serviceId)` - Returns stakeholder user/group list

#### 4.4.2 ValidateMaintenanceWindowChange (Business Rule)
- **Type:** Business Rule
- **Table:** change_request
- **When:** Before Insert, Before Update
- **Condition:** Type = Normal AND in maintenance window
- **Purpose:** Block save if planning fields are incomplete
- **Fields Validated:**
  - implementation_plan (not empty)
  - backout_plan (not empty)
  - test_plan (not empty)

#### 4.4.3 NotifyMaintenanceWindowStakeholders (Business Rule)
- **Type:** Business Rule
- **Table:** change_request
- **When:** After Insert, After Update
- **Purpose:** Fire notification events at lifecycle points
- **Events Fired:**
  - Insert + in MW → `mw.change.created`
  - State = Approved + in MW → `mw.change.approved`
  - State = Implement + in MW → `mw.change.started`
  - State = Closed + in MW → `mw.change.closed`

#### 4.4.4 MaintenanceWindowFormGuidance (Client Script)
- **Type:** Client Script (onChange)
- **Table:** change_request
- **Fields:** cmdb_ci, start_date, end_date
- **Purpose:** Display info message when MW detected
- **Behavior:**
  - Calls MaintenanceWindowUtil via GlideAjax
  - Shows/hides info message based on MW overlap
  - Lists required planning fields in message

---

## 5. Data Model

### 5.1 New Tables
No new tables required.

### 5.2 Existing Table Usage

| Table | Purpose |
|-------|---------|
| change_request | Target table for validation and notifications |
| cmn_schedule | Maintenance window schedule definitions |
| cmn_schedule_span | Schedule time spans |
| cmdb_ci_service | Business services with maintenance_schedule reference |

### 5.3 Key Relationships

```
change_request.cmdb_ci ──────▶ cmdb_ci_service
                                      │
                                      │ maintenance_schedule
                                      ▼
                               cmn_schedule
                                      │
                                      │ (schedule entries)
                                      ▼
                              cmn_schedule_span
```

### 5.4 Assumptions About Data

| Field/Table | Assumption | Fallback |
|-------------|------------|----------|
| cmdb_ci_service.maintenance_schedule | Reference to cmn_schedule exists | Skip MW check if null |
| cmn_schedule type | Type = "maintenance" or similar | Check any schedule overlap |

---

## 6. Integration Points

### 6.1 Internal Integrations

| System | Direction | Method | Purpose |
|--------|-----------|--------|---------|
| CMDB | Inbound | GlideRecord | Get business service and MW schedule |
| Schedule API | Inbound | GlideSchedule | Check date overlap with MW |
| Event Queue | Outbound | gs.eventQueue | Trigger notifications |
| Notification Engine | Outbound | Email Action | Send stakeholder emails |

### 6.2 External Integrations
None required.

---

## 7. Security Considerations

### 7.1 Access Control

| Role | Access Level | Notes |
|------|--------------|-------|
| itil | Standard change access | Can create/edit changes |
| change_manager | Full change access | Can approve changes |
| admin | Full access | System administration |

### 7.2 ACLs Required
No new ACLs required - using existing change_request ACLs.

### 7.3 Script Include Security
- MaintenanceWindowUtil marked as `client_callable: true` for GlideAjax
- Input validation on all parameters to prevent injection

---

## 8. Performance Considerations

- **Schedule Lookup Caching:** GlideSchedule operations can be expensive; minimize calls
- **Client Script Debounce:** Add 500ms debounce on field changes to reduce AJAX calls
- **Business Rule Efficiency:** Exit early if change type is not Normal

### 8.1 Indexing Strategy

| Table | Index Fields | Reason |
|-------|--------------|--------|
| cmdb_ci_service | maintenance_schedule | Quick lookup of MW reference |

---

## 9. Error Handling

| Error Scenario | Handling Strategy | User Message |
|----------------|-------------------|--------------|
| Business service has no MW schedule | Skip validation, allow save | (No message - normal flow) |
| Schedule lookup fails | Log error, allow save | (Silent - don't block user) |
| Missing planning field | Block save | "Please complete the following fields: [list]" |
| AJAX call fails | Log error, hide guidance | (Silent failure - guidance not shown) |

---

## 10. Rollback Plan

1. Deactivate Business Rules: ValidateMaintenanceWindowChange, NotifyMaintenanceWindowStakeholders
2. Deactivate Client Script: MaintenanceWindowFormGuidance
3. Deactivate Notifications: All MW Change * notifications
4. Script Include can remain (no impact if not called)

---

## 11. Open Questions

| ID | Question | Owner | Status | Resolution |
|----|----------|-------|--------|------------|
| Q-001 | Where is stakeholder list defined for business services? | Ratnesh Tiwari | ☑ Resolved | Use service owner field (owned_by on cmdb_ci_service) |
| Q-002 | Should validation apply to state changes or only initial save? | Ratnesh Tiwari | ☑ Resolved | Validate on both insert and update |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Agent | 2026-01-20 | ☑ |
| Technical Reviewer | | | ☐ |
| Architect | Ratnesh Tiwari | 2026-01-20 | ☑ |

### Approval Status

> **Status:** ☑ Approved

### Approval History

| Version | Date | Approver | Decision | Comments |
|---------|------|----------|----------|----------|
| 1.0 | 2026-01-20 | Ratnesh Tiwari | Approved | Design approved with Q-001/Q-002 resolved |

