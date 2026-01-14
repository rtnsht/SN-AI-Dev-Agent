# INC-SIMPLE-002: Auto-populate Region from Caller Location

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | INC-SIMPLE-002 |
| **Author** | AI Development Assistant |
| **Created** | 2026-01-13 |
| **Last Updated** | 2026-01-13 |
| **Version** | 1.0 |
| **Status** | ✅ Approved |

---

## 1. Executive Summary

When a new Incident is created and the Caller is selected, the system must automatically populate the Region field on the Incident with the Region derived from the Caller's Location record. This eliminates manual Region entry, ensures data consistency, and speeds up incident creation.

---

## 2. Problem Statement

### 2.1 Current State
- Analysts must manually select the Region field when creating incidents
- Region is often left blank or incorrectly populated
- Inconsistent data affects reporting and routing accuracy
- Time wasted on a field that can be automatically derived

### 2.2 Desired State
- Region auto-populates when Caller is selected
- Zero manual effort required for Region field
- Consistent, accurate Region data across all incidents
- Fallback behavior when Location/Region data is missing

### 2.3 Business Impact
- **Time Saved:** ~5 seconds per incident × thousands of incidents/month
- **Data Quality:** 100% Region population rate (where Location exists)
- **Reporting Accuracy:** Reliable regional metrics and dashboards

---

## 3. Business Requirements

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| BR-001 | Auto-populate Region when Caller is selected | Must Have | Core requirement |
| BR-002 | Do not overwrite manually entered Region | Should Have | Preserve user intent |
| BR-003 | Handle missing Location/Region gracefully | Must Have | Data integrity |

---

## 4. Functional Requirements

| ID | Requirement | Acceptance Criteria | Dependencies |
|----|-------------|---------------------|--------------|
| FR-001 | When Caller (caller_id) changes, lookup Caller's Location | Location sys_id retrieved from sys_user | sys_user.location populated |
| FR-002 | From Location, retrieve the Region field | Region value retrieved from cmn_location | cmn_location.u_region or equivalent field |
| FR-003 | Set Incident's Region field to derived value | incident.u_region = location.u_region | Region field exists on incident |
| FR-004 | Only set Region if currently empty | Preserve manually entered values | None |
| FR-005 | Work on both insert and update of Caller field | Trigger on before insert/update | None |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Target | Measurement |
|----|----------|-------------|--------|-------------|
| NFR-001 | Performance | Region lookup time | < 100ms | Script execution time |
| NFR-002 | Reliability | No errors on missing data | 0 errors | Error logs |

---

## 6. User Stories

### US-001: Automatic Region Population
**As a** Service Desk Analyst  
**I want** the Region field to auto-populate when I select a Caller  
**So that** I don't have to manually look up and enter the Region

**Acceptance Criteria:**
- [ ] When I select a Caller, Region fills automatically
- [ ] If Caller has no Location, Region remains empty (no error)
- [ ] If Location has no Region, Region remains empty (no error)
- [ ] If I manually set Region first, it is not overwritten

---

## 7. Assumptions

| ID | Assumption | Risk if Invalid |
|----|------------|-----------------|
| A-001 | Region field exists on cmn_location table | Need to identify correct field name |
| A-002 | Region field exists on incident table | Need to create or identify field |
| A-003 | Users have Location populated in their profile | Region will be empty for those users |

---

## 8. Technical Notes

- **Table:** incident
- **Trigger:** Before Insert (new incidents only)
- **Type:** Business Rule (server-side) + Client Script (UI feedback)
- **Scope:** Global

### Field Mapping (VERIFIED)
```
sys_user.location → cmn_location.sys_id
cmn_location.u_region → incident.u_region
```

### Fields Created
| Table | Field | Type | Label |
|-------|-------|------|-------|
| cmn_location | u_region | String(100) | Region |
| incident | u_region | String(100) | Region |

> **Note:** Fields created on dev300943 instance on 2026-01-13.

---

## 9. Out of Scope

- Creating the Region field if it doesn't exist
- Populating Region from other sources (CI, Service, etc.)
- Client-side scripts for real-time UI update
- Bulk update of existing incidents

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Development Assistant | 2026-01-13 | ☑ |
| Technical Reviewer | Ratnesh Tiwari | 2026-01-13 | ☑ |
| Approver | Ratnesh Tiwari | 2026-01-13 | ☑ |

### Approval Status

> **Status:** ✅ Approved

### Decisions Made
1. **Field name:** `u_region` on both `cmn_location` and `incident`
2. **Scope:** New incidents only (before insert)
3. **UI Feedback:** Both server-side BR and client-side script

