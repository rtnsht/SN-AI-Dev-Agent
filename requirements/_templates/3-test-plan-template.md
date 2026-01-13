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

### TC-001: [Test Case Name]

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High / Medium / Low |
| **Type** | Functional / Integration / E2E |
| **Automation** | Manual / ATF |

**Preconditions:**
- Condition 1
- Condition 2

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | | |
| 2 | | |
| 3 | | |

**Postconditions:**
- State after test

---

### TC-002: [Test Case Name]

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | |
| **Type** | |
| **Automation** | |

**Preconditions:**
- 

**Test Steps:**
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | | |

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

