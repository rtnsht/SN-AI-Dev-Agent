# REQ-002: Incident Deduplication Engine

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-002 |
| **Author** | AI Development Assistant |
| **Created** | 2026-01-13 |
| **Last Updated** | 2026-01-13 |
| **Version** | 1.0 |
| **Status** | ✅ Approved |

---

## 1. Executive Summary

Implement a server-side deduplication engine that detects similar/duplicate incidents based on configurable rules and auto-merges them into a canonical "master" incident. Rules are stored in a custom table for easy maintenance without code changes.

---

## 2. Problem Statement

### 2.1 Current State
- Duplicate incidents created from multiple sources (phone, email, monitoring)
- No automatic detection of similar incidents
- Manual effort to identify and link duplicates
- Scattered information across duplicate records

### 2.2 Desired State
- Automatic detection of duplicate incidents on creation
- Configurable matching rules (no code changes needed)
- Intelligent master selection
- Aggregation of information from duplicates to master
- Optional auto-close of duplicates

### 2.3 Business Impact
- 30% reduction in duplicate incident handling
- Consolidated view of related issues
- Faster resolution through information aggregation

---

## 3. Business Requirements

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| BR-001 | Detect duplicates based on configurable rules | Must Have | Core functionality |
| BR-002 | Store rules in database table | Must Have | No-code configuration |
| BR-003 | Select optimal master incident | Must Have | Preserve important context |
| BR-004 | Link duplicates to master | Must Have | Traceability |
| BR-005 | Aggregate information to master | Should Have | Consolidated view |
| BR-006 | Auto-close duplicates (optional) | Should Have | Reduce clutter |

---

## 4. Functional Requirements

| ID | Requirement | Acceptance Criteria | Dependencies |
|----|-------------|---------------------|--------------|
| FR-001 | Create custom table for dedup rules | Table exists, CRUD operations work | None |
| FR-002 | Match on configurable fields | Rule defines fields to compare | FR-001 |
| FR-003 | Support time window for matching | Only match within X minutes | FR-001 |
| FR-004 | Normalize text for fuzzy matching | "Server down" matches "server is down" | None |
| FR-005 | Select master by priority & age | Oldest open P1-P3 with group selected | None |
| FR-006 | Set parent_incident on children | OOB field used for linking | None |
| FR-007 | Add work notes documenting merge | Audit trail maintained | None |
| FR-008 | Aggregate callers to master | List of affected users | FR-006 |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Target | Measurement |
|----|----------|-------------|--------|-------------|
| NFR-001 | Performance | Dedup check time | < 3 seconds | Script execution |
| NFR-002 | Scalability | Support multiple rules | ≥10 active rules | Configuration |
| NFR-003 | Maintainability | Rules editable by admins | No code changes | UI test |

---

## 6. User Stories

### US-001: Configure Dedup Rules
**As a** ServiceNow Administrator  
**I want** to create dedup rules in a table  
**So that** I can adjust matching criteria without code changes

**Acceptance Criteria:**
- [x] Custom table for rules exists
- [x] Can create/edit/delete rules
- [x] Can enable/disable rules

### US-002: Automatic Deduplication
**As a** Service Desk Agent  
**I want** duplicate incidents automatically detected  
**So that** I don't have to manually search for them

**Acceptance Criteria:**
- [x] New incident checked against rules
- [x] Matching incidents identified
- [x] Parent_incident set on duplicates

---

## 7. Assumptions

| ID | Assumption | Risk if Invalid |
|----|------------|-----------------|
| A-001 | parent_incident field available on incident | Need custom field |
| A-002 | Incidents have correlation_id from monitoring | Rule won't match |

---

## 8. Out of Scope

- UI to display duplicate relationships
- Retroactive deduplication of existing incidents
- Cross-instance deduplication

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Development Assistant | 2026-01-13 | ☑ |
| Technical Reviewer | Ratnesh Tiwari | 2026-01-13 | ☑ |
| Approver | Ratnesh Tiwari | 2026-01-13 | ☑ |

### Approval Status

> **Status:** ✅ Approved

