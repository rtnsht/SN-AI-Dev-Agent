# REQ-XXX: Technical Design Document

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-XXX |
| **Spec Version** | 1.0 |
| **Author** | |
| **Created** | YYYY-MM-DD |
| **Last Updated** | YYYY-MM-DD |
| **Version** | 1.0 |
| **Status** | Draft / In Review / Approved |

---

## 1. Solution Overview

### 1.1 Summary
[High-level description of the technical solution]

### 1.2 Goals
- Goal 1
- Goal 2

### 1.3 Non-Goals
- Non-goal 1

---

## 2. Architecture

### 2.1 System Context Diagram
```
[ASCII or reference to diagram in evidence folder]
```

### 2.2 Component Diagram
```
[Show how components interact]
```

### 2.3 Sequence Diagram
```
[Show key flows]
```

---

## 3. Artifacts to Create

### 3.1 Summary Table

| Artifact | Type | Table | Description |
|----------|------|-------|-------------|
| | Script Include | sys_script_include | |
| | Business Rule | sys_script | |
| | UI Policy | sys_ui_policy | |
| | Custom Table | sys_db_object | |

### 3.2 Artifact Details

#### 3.2.1 [Artifact Name]
- **Type:** Script Include
- **Table:** sys_script_include
- **Purpose:** 
- **Key Methods:**
  - `methodName()` - Description
- **Dependencies:**

---

## 4. Data Model

### 4.1 New Tables

| Table | Label | Extends | Purpose |
|-------|-------|---------|---------|
| u_table_name | | task | |

### 4.2 Table Schema

#### u_table_name

| Column | Type | Length | Mandatory | Reference | Description |
|--------|------|--------|-----------|-----------|-------------|
| u_field | String | 100 | Yes | | |

### 4.3 Existing Table Changes

| Table | Change Type | Details |
|-------|-------------|---------|
| incident | New field | u_custom_field |

---

## 5. Integration Points

### 5.1 Internal Integrations

| System | Direction | Method | Purpose |
|--------|-----------|--------|---------|
| CMDB | Inbound | GlideRecord | Lookup CI |

### 5.2 External Integrations

| System | Direction | Protocol | Authentication |
|--------|-----------|----------|----------------|
| PagerDuty | Outbound | REST | API Key |

---

## 6. Security Considerations

### 6.1 Access Control

| Role | Access Level | Restrictions |
|------|--------------|--------------|
| itil | Read/Write | Own records |
| admin | Full | None |

### 6.2 ACLs Required

| Table | Operation | Role | Script |
|-------|-----------|------|--------|
| u_table | read | itil | |

---

## 7. Performance Considerations

- Consideration 1
- Consideration 2

### 7.1 Indexing Strategy

| Table | Index Fields | Reason |
|-------|--------------|--------|
| | | |

---

## 8. Error Handling

| Error Scenario | Handling Strategy | User Message |
|----------------|-------------------|--------------|
| | | |

---

## 9. Rollback Plan

1. Step 1
2. Step 2

---

## 10. Open Questions

| ID | Question | Owner | Status | Resolution |
|----|----------|-------|--------|------------|
| Q-001 | | | Open | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | | | ☐ |
| Technical Reviewer | | | ☐ |
| Architect | | | ☐ |

### Approval Status

> **Status:** ⬜ Draft | ⬜ In Review | ⬜ Approved | ⬜ Rejected

