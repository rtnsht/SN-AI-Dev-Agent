# REQ-001: Test Results

## Test Execution Summary

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-001 |
| **Test Date** | 2026-01-20 |
| **Tester** | AI Agent |
| **Instance** | dev300943.service-now.com |
| **Update Set** | d77099f5932a72502f57f0ba2bba105c |

---

## Deployment Verification

### Artifacts Deployed

| # | Artifact | Type | sys_id | Status |
|---|----------|------|--------|--------|
| 1 | MaintenanceWindowUtil | Script Include | af70d979932a72502f57f0ba2bba1080 | ✅ Created |
| 2 | ValidateMaintenanceWindowChange | Business Rule | 3f70d979932a72502f57f0ba2bba10b2 | ✅ Created |
| 3 | NotifyMaintenanceWindowStakeholders | Business Rule | 0080d979932a72502f57f0ba2bba10c3 | ✅ Created |
| 4 | MaintenanceWindowFormGuidance | Client Script | 8480d979932a72502f57f0ba2bba10f8 | ✅ Created |
| 5 | mw.change.created | Event | 10801d79932a72502f57f0ba2bba1005 | ✅ Created |
| 6 | mw.change.approved | Event | ec801d79932a72502f57f0ba2bba1044 | ✅ Created |
| 7 | mw.change.started | Event | 64801d79932a72502f57f0ba2bba1098 | ✅ Created |
| 8 | mw.change.closed | Event | 3c801d79932a72502f57f0ba2bba10e2 | ✅ Created |
| 9 | MW Change Created | Notification | 30805d79932a72502f57f0ba2bba1008 | ✅ Created |
| 10 | MW Change Approved | Notification | 01805d79932a72502f57f0ba2bba102f | ✅ Created |
| 11 | MW Change Started | Notification | dd805d79932a72502f57f0ba2bba1047 | ✅ Created |
| 12 | MW Change Closed | Notification | 55805d79932a72502f57f0ba2bba106d | ✅ Created |

**Deployment Result:** ✅ All 12 artifacts deployed successfully

---

## Functional Test Cases

### TC-001: Maintenance Window Detection

| Field | Value |
|-------|-------|
| **Status** | ⬜ Pending Manual Test |
| **Prerequisites** | Business service with maintenance schedule configured |

**Steps:**
1. Create a new Normal Change
2. Select a business service that has a maintenance schedule
3. Set planned start/end dates within the maintenance window

**Expected Result:**
- Info message appears indicating maintenance window detected
- Required fields are highlighted

---

### TC-002: Planning Field Validation

| Field | Value |
|-------|-------|
| **Status** | ⬜ Pending Manual Test |
| **Prerequisites** | TC-001 preconditions met |

**Steps:**
1. With maintenance window detected, leave Implementation Plan empty
2. Attempt to save the change

**Expected Result:**
- Save is blocked
- Error message lists missing required fields

---

### TC-003: Successful Save with Complete Data

| Field | Value |
|-------|-------|
| **Status** | ⬜ Pending Manual Test |
| **Prerequisites** | TC-001 preconditions met |

**Steps:**
1. Complete all required fields (Implementation Plan, Backout Plan, Test Plan)
2. Save the change

**Expected Result:**
- Change saves successfully
- mw.change.created event is fired

---

### TC-004: Stakeholder Notification on Creation

| Field | Value |
|-------|-------|
| **Status** | ⬜ Pending Manual Test |
| **Prerequisites** | TC-003 completed, service owner email configured |

**Steps:**
1. Check service owner's email inbox

**Expected Result:**
- Email received with subject "Maintenance Window Change Created: CHGxxxxxxx"

---

## Test Summary

| Category | Passed | Failed | Pending |
|----------|--------|--------|---------|
| Deployment | 12 | 0 | 0 |
| Functional | 0 | 0 | 4 |
| **Total** | 12 | 0 | 4 |

---

## Notes

- Deployment verified via API response - all artifacts created with valid sys_ids
- Functional testing requires manual execution on ServiceNow instance
- Test data setup required: Business service with maintenance_schedule populated

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | AI Agent | 2026-01-20 | ☑ |
| Reviewer | | | ☐ |

