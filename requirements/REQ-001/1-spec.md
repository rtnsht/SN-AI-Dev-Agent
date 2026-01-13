# REQ-001: Dynamic Service-Aware, Skill-Based, Predictive Assignment & Auto-Remediation Orchestrator

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-001 (INC-XZ-001) |
| **Author** | AI Development Assistant |
| **Created** | 2026-01-13 |
| **Last Updated** | 2026-01-13 |
| **Version** | 1.0 |
| **Status** | ✅ Approved |

---

## 1. Executive Summary

Design and implement an advanced Incident assignment and remediation engine that dynamically routes and optionally auto-resolves incidents using service context, real-time patterns, resolver skills, and external automation systems. This replaces traditional static assignment rules with an intelligent, adaptive system.

---

## 2. Problem Statement

### 2.1 Current State
- Static assignment rules based on category/subcategory
- No consideration of resolver skills or workload
- Manual pattern detection for recurring issues
- No automated remediation for known issues
- Delayed Problem creation when patterns emerge

### 2.2 Desired State
- Dynamic assignment based on CI/service ownership, skills, and availability
- Automatic pattern detection and Problem creation
- Integration with on-call systems (PagerDuty)
- Auto-remediation for known issue patterns
- Reduced mean time to resolution (MTTR)

### 2.3 Business Impact
- 40% reduction in incident assignment time
- 60% faster Problem creation for recurring issues
- 25% reduction in MTTR through auto-remediation
- Improved resolver satisfaction through skill-matched assignments

---

## 3. Business Requirements

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| BR-001 | System shall intelligently route incidents to best-fit resolver | Must Have | Core value proposition |
| BR-002 | System shall detect patterns and auto-create Problems | Must Have | Proactive problem management |
| BR-003 | System shall support auto-remediation for known issues | Should Have | Reduce human workload |
| BR-004 | System shall integrate with on-call schedules | Nice to Have | 24/7 coverage |

---

## 4. Functional Requirements

| ID | Requirement | Acceptance Criteria | Dependencies |
|----|-------------|---------------------|--------------|
| FR-001 | Analyze incident CI/service to determine ownership | Assignment group from CMDB service map | CMDB populated |
| FR-002 | Detect similar incidents within time window | ≥5 similar in 30 min triggers Problem | Historical data |
| FR-003 | Evaluate resolver skills and certifications | Match skills to incident category | Skill data in user records |
| FR-004 | Check on-call schedule for P1/P2 incidents | Query PagerDuty or equivalent | Integration configured |
| FR-005 | Execute runbooks for known issue patterns | Trigger external automation | Runbook definitions |
| FR-006 | Auto-resolve incidents when remediation succeeds | Update state, add work notes | FR-005 |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Target | Measurement |
|----|----------|-------------|--------|-------------|
| NFR-001 | Performance | Assignment decision time | < 2 seconds | Script execution time |
| NFR-002 | Security | No privilege escalation | All operations as caller | ACL enforcement |
| NFR-003 | Scalability | Handle incident volume | 1000/hour | Load testing |
| NFR-004 | Availability | No single point of failure | 99.9% | ServiceNow SLA |

---

## 6. User Stories

### US-001: Intelligent Assignment
**As a** Service Desk Agent  
**I want** incidents to be automatically assigned to the best resolver  
**So that** I don't have to manually search for the right team

**Acceptance Criteria:**
- [x] Assignment considers CI ownership
- [x] Assignment considers resolver skills
- [x] Assignment considers current workload

### US-002: Pattern Detection
**As a** Problem Manager  
**I want** the system to detect recurring incidents  
**So that** Problems are created proactively

**Acceptance Criteria:**
- [x] Pattern detection within 30-minute window
- [x] Automatic Problem creation at threshold
- [x] Incidents linked to Problem

### US-003: Auto-Remediation
**As a** an IT Operations Manager  
**I want** known issues to be auto-remediated  
**So that** human resolvers focus on complex issues

**Acceptance Criteria:**
- [x] Runbook execution for known patterns
- [x] Auto-resolution on success
- [x] Fallback to human on failure

---

## 7. Assumptions

| ID | Assumption | Risk if Invalid |
|----|------------|-----------------|
| A-001 | CMDB service maps are populated | Assignment defaults to category-based |
| A-002 | User skill data exists | Skills-based matching disabled |
| A-003 | External automation systems available | Auto-remediation unavailable |

---

## 8. Constraints

| ID | Constraint | Impact |
|----|------------|--------|
| C-001 | Must work in global scope | No scoped app dependencies |
| C-002 | Cannot modify OOB incident form | Use work notes for communication |
| C-003 | Must be backward compatible | Existing assignments not affected |

---

## 9. Out of Scope

- Custom incident form modifications
- SLA calculations
- Customer portal changes
- Email notifications

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Development Assistant | 2026-01-13 | ☑ |
| Technical Reviewer | Ratnesh Tiwari | 2026-01-13 | ☑ |
| Approver | Ratnesh Tiwari | 2026-01-13 | ☑ |

### Approval Status

> **Status:** ✅ Approved

