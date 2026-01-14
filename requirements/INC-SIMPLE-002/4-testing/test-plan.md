# INC-SIMPLE-002: Test Plan - Auto-populate Region from Caller Location

## Test Overview

| Field | Value |
|-------|-------|
| **Requirement ID** | INC-SIMPLE-002 |
| **Test Author** | AI Development Assistant |
| **Created** | 2026-01-13 |
| **Target Environment** | dev300943 |

---

## Test Cases

### TC-001: Region Auto-populates on Caller Selection (UI)
**Objective:** Verify Region field auto-populates when Caller is selected on the form

**Prerequisites:**
- User with location that has u_region populated

**Steps:**
1. Navigate to Incident > Create New
2. Select a Caller who has a Location with Region
3. Observe the Region field

**Expected Result:**
- Region field auto-populates with the Caller's location region
- No manual entry required

---

### TC-002: Region Not Overwritten if Already Set
**Objective:** Verify manually entered Region is preserved

**Steps:**
1. Navigate to Incident > Create New
2. Set Region field manually to "Test Region"
3. Select a Caller with a different region

**Expected Result:**
- Region field remains "Test Region"
- Not overwritten by caller's region

---

### TC-003: Caller with No Location
**Objective:** Verify graceful handling when Caller has no Location

**Steps:**
1. Find or create a user with no Location set
2. Create new Incident
3. Select this user as Caller

**Expected Result:**
- Region field remains empty
- No errors displayed
- Form remains functional

---

### TC-004: Server-side Business Rule (API Insert)
**Objective:** Verify Region is populated when incident is created via API

**Steps:**
1. Create incident via REST API with caller_id set
2. Do not include u_region in request
3. Query the created incident

**Expected Result:**
- u_region is populated based on caller's location

---

### TC-005: Location with No Region
**Objective:** Verify handling when Location exists but has no Region

**Steps:**
1. Find a user whose location has empty u_region
2. Create incident with this user as Caller

**Expected Result:**
- Region field remains empty
- No errors

---

## Test Data

### Users for Testing

| User | Location | Expected Region |
|------|----------|-----------------|
| Abel Tuter | (check instance) | (derived from location) |
| David Loo | (check instance) | (derived from location) |

---

## Pass Criteria

- All 5 test cases pass
- No JavaScript errors in browser console
- No server errors in system logs

