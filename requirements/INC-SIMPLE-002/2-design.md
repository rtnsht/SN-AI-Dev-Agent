# INC-SIMPLE-002: Technical Design - Auto-populate Region from Caller Location

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

## 1. Solution Overview

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      INCIDENT FORM                               │
├─────────────────────────────────────────────────────────────────┤
│  Caller: [________________▼]  ←── User selects caller           │
│                                                                  │
│  Region: [Americas________]  ←── Auto-populated                 │
└─────────────────────────────────────────────────────────────────┘
         │                              ▲
         │ onChange                     │ setValue
         ▼                              │
┌─────────────────────┐        ┌─────────────────────┐
│  Client Script      │        │  GlideAjax Response │
│  (onChange)         │───────▶│  (region value)     │
└─────────────────────┘        └─────────────────────┘
         │                              ▲
         │ GlideAjax                    │
         ▼                              │
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER SIDE                                   │
├─────────────────────────────────────────────────────────────────┤
│  Script Include: RegionLookupUtil                                │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  getRegionForUser(userId)                            │        │
│  │    1. Get user's location (sys_user.location)        │        │
│  │    2. Get location's region (cmn_location.u_region)  │        │
│  │    3. Return region value                            │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  Business Rule: Auto-populate Region (Before Insert)            │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  If caller_id is set AND u_region is empty:          │        │
│  │    → Set u_region from caller's location             │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Summary

| Component | Type | Purpose |
|-----------|------|---------|
| RegionLookupUtil | Script Include | Reusable region lookup logic |
| CallerRegionLookup | Client Script | Real-time UI update on caller change |
| BR_AutoPopulateRegion | Business Rule | Server-side fallback on insert |

---

## 2. Detailed Design

### 2.1 Script Include: RegionLookupUtil

**Purpose:** Centralized, reusable logic for looking up a user's region

**API:**
```javascript
// Get region for a user sys_id
RegionLookupUtil.getRegionForUser(userSysId) → String

// Get region for a location sys_id  
RegionLookupUtil.getRegionForLocation(locationSysId) → String
```

**Logic:**
1. Query `sys_user` to get `location` field
2. If location exists, query `cmn_location` to get `u_region`
3. Return region value or empty string

### 2.2 Client Script: CallerRegionLookup

**Type:** onChange  
**Field:** caller_id  
**Table:** incident

**Behavior:**
1. When caller_id changes, call GlideAjax to `RegionLookupUtil`
2. On response, set `u_region` field value
3. Only set if `u_region` is currently empty (preserve manual entry)

### 2.3 Business Rule: BR_AutoPopulateRegion

**Table:** incident  
**When:** Before Insert  
**Condition:** `caller_id` is not empty AND `u_region` is empty

**Logic:**
1. Get caller's location from sys_user
2. Get location's u_region from cmn_location
3. Set current.u_region

---

## 3. Data Flow

```
User Action                  System Response
───────────                  ───────────────
Select Caller ──────────────▶ Client Script fires
                              │
                              ├──▶ GlideAjax call
                              │
                              ├──▶ RegionLookupUtil.getRegionForUser()
                              │      │
                              │      ├──▶ Query sys_user.location
                              │      │
                              │      └──▶ Query cmn_location.u_region
                              │
                              └──▶ Set incident.u_region on form

Save Incident ──────────────▶ Business Rule fires (if region still empty)
                              │
                              └──▶ Same lookup logic, sets u_region
```

---

## 4. Error Handling

| Scenario | Handling |
|----------|----------|
| Caller has no location | Region remains empty (no error) |
| Location has no u_region | Region remains empty (no error) |
| Invalid caller sys_id | Graceful failure, region empty |

---

## 5. Artifacts to Create

| # | Artifact | File |
|---|----------|------|
| 1 | Script Include | `RegionLookupUtil.js` |
| 2 | Client Script | `CallerRegionLookup.js` |
| 3 | Business Rule | `BR_AutoPopulateRegion.js` |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Development Assistant | 2026-01-13 | ☑ |
| Technical Reviewer | Ratnesh Tiwari | 2026-01-13 | ☑ |
| Approver | Ratnesh Tiwari | 2026-01-13 | ☑ |

### Approval Status

> **Status:** ✅ Approved

