# REQ-002: Test Plan

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-002 |
| **Author** | AI Development Assistant |
| **Created** | 2026-01-13 |
| **Last Updated** | 2026-01-13 |
| **Version** | 1.0 |

---

## 1. Test Scope

### 1.1 In Scope
- Custom table creation and configuration
- IncidentDeduplicationEngine functionality
- DuplicateMergeProcessor functionality
- Business Rule trigger behavior
- Pre-configured rules

### 1.2 Out of Scope
- Performance testing under heavy load
- UI testing

---

## 2. Test Strategy

### 2.1 Test Types

| Type | Description | Tools |
|------|-------------|-------|
| Deployment | Verify artifacts exist | API query |
| Functional | Test dedup logic | Manual incident creation |
| Integration | Full workflow | End-to-end test |

### 2.2 Test Environment

| Environment | Instance | Purpose |
|-------------|----------|---------|
| Dev | dev300943 | All testing |

---

## 3. Test Cases

### TC-001: Custom Table Verification

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Deployment |

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to u_incident_dedupe_rule.list | Table accessible |
| 2 | Check columns exist | All 7 columns present |
| 3 | Check pre-configured rules | 2 rules exist |

---

### TC-002: Script Include Verification

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High |
| **Type** | Deployment |

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search for IncidentDeduplicationEngine | Found |
| 2 | Search for DuplicateMergeProcessor | Found |

---

### TC-003: Business Rule Verification

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High |
| **Type** | Deployment |

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search for "Incident Deduplication Trigger" | Found |
| 2 | Verify table = incident | Correct |
| 3 | Verify when = after insert | Correct |

---

### TC-004: Deduplication Workflow

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | High |
| **Type** | Functional |

**Preconditions:**
- All artifacts deployed
- Correlation ID Match rule active

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create incident with correlation_id = "TEST-001" | Incident created |
| 2 | Create second incident with same correlation_id | Incident created |
| 3 | Check second incident parent_incident | Points to first |
| 4 | Check work notes on both | Dedup documented |

---

## 4. Entry Criteria

- [x] Design document approved
- [x] All artifacts deployed
- [x] Test environment available

---

## 5. Exit Criteria

- [x] All test cases executed
- [x] All high priority tests passed
- [x] Test results documented
- [x] Evidence captured

