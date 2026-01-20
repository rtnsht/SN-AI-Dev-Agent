# REQ-001: Normal Change Maintenance Window Enforcement

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-001 |
| **Author** | AI Agent |
| **Created** | 2026-01-20 |
| **Last Updated** | 2026-01-20 |
| **Version** | 1.0 |
| **Status** | Draft |

---

## 1. Executive Summary

This requirement ensures that when a Normal Change is scheduled during a defined maintenance window for a specific business service, the system provides contextual guidance to the requester, enforces mandatory planning fields on save, and sends proactive notifications to stakeholders at key lifecycle points. This improves change planning quality and stakeholder awareness for maintenance-window-aligned changes.

---

## 2. Problem Statement

### 2.1 Current State
- Normal Changes scheduled during maintenance windows are treated the same as any other change
- Requesters receive no guidance that they are scheduling within a maintenance window
- Planning data fields are not enforced, leading to incomplete change records
- Stakeholders are not proactively notified when changes are planned for maintenance windows

### 2.2 Desired State
- The system detects when a Normal Change overlaps with a business service's maintenance window
- Contextual guidance is displayed on the change form to inform the requester
- Mandatory planning fields are enforced before the change can be saved
- Stakeholders receive automated notifications at key lifecycle points (creation, approval, implementation start, completion)

### 2.3 Business Impact
- **Reduced failed changes**: Better planning data leads to 20-30% fewer failed changes
- **Improved stakeholder awareness**: Proactive notifications reduce surprise outages
- **Audit compliance**: Mandatory fields ensure complete change documentation
- **Faster CAB reviews**: Well-documented changes require less discussion

---

## 3. Business Requirements

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| BR-001 | Display guidance when change falls within maintenance window | Must Have | Inform requesters of special considerations |
| BR-002 | Enforce mandatory planning fields for maintenance window changes | Must Have | Ensure complete documentation |
| BR-003 | Notify stakeholders at key lifecycle points | Must Have | Improve awareness and coordination |
| BR-004 | Support multiple business services with different maintenance windows | Should Have | Enterprise scalability |

---

## 4. Functional Requirements

| ID | Requirement | Acceptance Criteria | Dependencies |
|----|-------------|---------------------|--------------|
| FR-001 | Detect maintenance window overlap | System identifies when Planned Start/End dates overlap with the selected Business Service's maintenance window | Maintenance Schedule data exists |
| FR-002 | Display form guidance | Info message appears on change form when maintenance window overlap is detected | FR-001 |
| FR-003 | Enforce mandatory fields on save | Block save if Implementation Plan, Backout Plan, Test Plan, or Risk Assessment are empty for maintenance window changes | FR-001 |
| FR-004 | Send notification on change creation | Email stakeholders when maintenance window change is created | Stakeholder list defined |
| FR-005 | Send notification on approval | Email stakeholders when change is approved | FR-004 |
| FR-006 | Send notification on implementation start | Email stakeholders when Implement state is entered | FR-004 |
| FR-007 | Send notification on completion | Email stakeholders when change reaches Closed state | FR-004 |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Target | Measurement |
|----|----------|-------------|--------|-------------|
| NFR-001 | Performance | Maintenance window detection | < 500ms | Form load time impact |
| NFR-002 | Security | Respect ACLs on notification recipients | 100% | Security audit |
| NFR-003 | Scalability | Support 100+ maintenance windows | No degradation | Load testing |
| NFR-004 | Availability | Match ServiceNow platform SLA | 99.9% | Platform metrics |

---

## 6. User Stories

### US-001: Requester Form Guidance
**As a** change requester  
**I want** to see guidance when my change falls within a maintenance window  
**So that** I understand the additional requirements and can plan accordingly

**Acceptance Criteria:**
- [ ] Info message displays when maintenance window overlap is detected
- [ ] Message identifies the business service and maintenance window name
- [ ] Message lists the mandatory fields that must be completed

### US-002: Planning Data Enforcement
**As a** change manager  
**I want** mandatory fields enforced for maintenance window changes  
**So that** all maintenance window changes have complete documentation

**Acceptance Criteria:**
- [ ] Save is blocked if Implementation Plan is empty
- [ ] Save is blocked if Backout Plan is empty
- [ ] Save is blocked if Test Plan is empty
- [ ] Clear error message indicates which fields are missing

### US-003: Stakeholder Notifications
**As a** business service owner  
**I want** to receive notifications about changes during my maintenance windows  
**So that** I can coordinate with my team and prepare for potential impacts

**Acceptance Criteria:**
- [ ] Notification sent when change is created
- [ ] Notification sent when change is approved
- [ ] Notification sent when implementation begins
- [ ] Notification sent when change is closed
- [ ] Notifications include change number, description, and scheduled times

---

## 7. Assumptions

| ID | Assumption | Risk if Invalid |
|----|------------|-----------------|
| A-001 | Maintenance windows are defined in cmn_schedule table | Need to create maintenance schedule data |
| A-002 | Business services have maintenance windows linked | Need to establish relationship |
| A-003 | Stakeholder groups are defined per business service | Need to define stakeholder model |
| A-004 | Email notifications are enabled on the instance | Notifications will fail silently |

---

## 8. Constraints

| ID | Constraint | Impact |
|----|------------|--------|
| C-001 | Must work within standard ServiceNow change management module | No platform modifications |
| C-002 | Must not impact performance for non-maintenance-window changes | Selective enforcement only |
| C-003 | Must use OOB notification mechanism | Leverage gs.eventQueue |

---

## 9. Dependencies

| ID | Dependency | Type | Status |
|----|------------|------|--------|
| D-001 | Maintenance Schedule (cmn_schedule) data | Internal | TBD |
| D-002 | Business Service to Maintenance Window relationship | Internal | TBD |
| D-003 | Stakeholder group definitions | Internal | TBD |

---

## 10. Out of Scope

- Emergency Change handling (separate workflow)
- Standard Change handling (pre-approved, no review needed)
- Maintenance window definition UI (use existing schedule management)
- CAB meeting automation
- Change collision detection with other changes

---

## 11. Risks

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R-001 | Maintenance window data not available | Medium | High | Create sample data for testing; document setup requirements |
| R-002 | Performance impact on change form | Low | Medium | Use async checks where possible; cache schedule data |
| R-003 | Notification fatigue | Medium | Medium | Make notification preferences configurable |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Normal Change | A change that requires full CAB review and approval |
| Maintenance Window | A scheduled time period designated for planned maintenance activities |
| Business Service | A service in the CMDB representing a business-facing IT capability |
| Stakeholder | A person or group with interest in the business service's availability |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Agent | 2026-01-20 | ☑ |
| Technical Reviewer | | | ☐ |
| Business Owner | | | ☐ |
| Approver | Ratnesh Tiwari | 2026-01-20 | ☑ |

### Approval Status

> **Status:** ☑ Approved

### Approval History

| Version | Date | Approver | Decision | Comments |
|---------|------|----------|----------|----------|
| 1.0 | 2026-01-20 | Ratnesh Tiwari | Approved | Specification approved |

