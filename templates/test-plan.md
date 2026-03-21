# REQ-XXX: Test Plan

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-XXX |
| **Author** | |
| **Created** | YYYY-MM-DD |
| **Last Updated** | YYYY-MM-DD |
| **Version** | 1.0 |

---

## 1. Test Scope

### 1.1 In Scope
- Feature/Component 1
- Feature/Component 2

### 1.2 Out of Scope
- Item 1

---

## 2. Test Strategy

### 2.1 Test Types

| Type | Description | Tools |
|------|-------------|-------|
| Unit Testing | Individual functions | ServiceNow ATF |
| Integration Testing | Component interaction | Manual / ATF |
| End-to-End Testing | Full workflow | Manual |
| Performance Testing | Load/stress | Background script |

### 2.2 Test Environment

| Environment | Instance | Purpose |
|-------------|----------|---------|
| Dev | dev300943 | Development testing |
| Test | | Integration testing |
| UAT | | User acceptance |

---

## 3. Test Cases

> Test cases are auto-generated from the spec and design documents.
> Use `node scripts/generate-test-plan.cjs --req REQ-XXX` to regenerate.

<!-- AUTO_TEST_CASES -->

### 3.1 Positive Test Cases

_Happy path, valid inputs, role-based success paths._

### TC-P001: [Positive Test Case Name]

| Field | Value |
|-------|-------|
| **ID** | TC-P001 |
| **Category** | Positive |
| **Priority** | High / Medium / Low |
| **Type** | Functional |
| **Automation** | Manual / ATF |
| **Requirement** | REQ-XXX |

**Preconditions:**
- Condition 1
- Condition 2

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | | |

---

### 3.2 Negative Test Cases

_Error handling, invalid inputs, boundary violations, unauthorized access._

### TC-N001: [Negative Test Case Name]

| Field | Value |
|-------|-------|
| **ID** | TC-N001 |
| **Category** | Negative |
| **Priority** | High / Medium / Low |
| **Type** | Error Handling / Security |
| **Automation** | Manual / ATF |

**Preconditions:**
- Condition 1

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | | |

---

### 3.3 Integration Test Cases

_Cross-artifact interactions, data flow, event propagation._

---

### 3.4 Security Test Cases

_ACL verification, PII exposure checks, BLOCK-tier pattern validation._

---

### 3.5 Coverage Matrix

| Requirement | Test Cases | Covered |
|-------------|------------|---------|
| REQ-XXX | TC-P001, TC-N001 | ✅ |

---

## 4. ATF Test Suite

### 4.1 ATF Configuration

| Field | Value |
|-------|-------|
| **Suite Name** | REQ-XXX Test Suite |
| **Suite Sys ID** | |
| **Run Order** | Sequential |

### 4.2 ATF Tests

| Test Name | Type | Sys ID | Status |
|-----------|------|--------|--------|
| | Server-side | | Not Created |
| | Client-side | | Not Created |

---

## 5. Test Data

### 5.1 Required Test Data

| Data | Description | Setup Method |
|------|-------------|--------------|
| Test User | User with itil role | Manual |
| Test CI | Configuration Item | Script |

### 5.2 Test Data Scripts

```javascript
// Script to create test data
// Located in: 4-testing/test-data-setup.js
```

---

## 6. Entry Criteria

- [ ] Design document approved
- [ ] All artifacts deployed to test environment
- [ ] Test data prepared
- [ ] Test environment available

---

## 7. Exit Criteria

- [ ] All test cases executed
- [ ] All critical/high priority tests passed
- [ ] No P1/P2 defects open
- [ ] Test results documented
- [ ] Evidence captured

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| | | | |

---

## 9. Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Test Lead | | | ☐ |
| Developer | | | ☐ |

