# INC-SIMPLE-002: Deployment Record

## Deployment Summary

| Field | Value |
|-------|-------|
| **Requirement ID** | INC-SIMPLE-002 |
| **Deployment Date** | 2026-01-13 |
| **Deployed By** | AI Development Assistant |
| **Target Instance** | dev300943 |
| **Status** | ✅ Deployed |

---

## Update Set

| Field | Value |
|-------|-------|
| **Name** | INC-SIMPLE-002 Auto-populate Region |
| **Sys ID** | 2268ed23935632102f57f0ba2bba10c0 |
| **State** | In Progress |
| **Link** | [View Update Set](https://dev300943.service-now.com/sys_update_set.do?sys_id=2268ed23935632102f57f0ba2bba10c0) |

---

## Deployed Artifacts

### 1. Schema Changes

| Table | Field | Type | Description |
|-------|-------|------|-------------|
| cmn_location | u_region | String(100) | Region field for locations |
| incident | u_region | String(100) | Region field for incidents |

### 2. Script Include: RegionLookupUtil

| Property | Value |
|----------|-------|
| Name | RegionLookupUtil |
| API Name | global.RegionLookupUtil |
| Client Callable | Yes |
| Active | Yes |

### 3. Client Script: CallerRegionLookup

| Property | Value |
|----------|-------|
| Name | CallerRegionLookup |
| Table | incident |
| Type | onChange |
| Field | caller_id |
| Active | Yes |

### 4. Business Rule: BR_AutoPopulateRegion

| Property | Value |
|----------|-------|
| Name | BR_AutoPopulateRegion |
| Table | incident |
| When | Before Insert |
| Condition | caller_id IS NOT EMPTY AND u_region IS EMPTY |
| Active | Yes |

---

## Data Migration

| Action | Records | Status |
|--------|---------|--------|
| Populate u_region on cmn_location | 216 | ✅ Complete |

Regions derived from location hierarchy (top-level parent = region):
- Americas
- Apac
- Emea

---

## Rollback Plan

To rollback this deployment:

1. **Deactivate artifacts:**
   - Deactivate Business Rule: BR_AutoPopulateRegion
   - Deactivate Client Script: CallerRegionLookup
   - Deactivate Script Include: RegionLookupUtil (optional)

2. **Fields can remain** (won't cause issues if inactive)

3. **Back out update set** if needed

---

## Post-Deployment Verification

| Check | Status |
|-------|--------|
| Script Include accessible via GlideAjax | ✅ |
| Client script fires on caller change | ✅ |
| Business rule populates on API insert | ✅ |
| No console errors | ✅ |
| No server errors | ✅ |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Deployer | AI Development Assistant | 2026-01-13 | ☑ |
| Approver | Ratnesh Tiwari | 2026-01-13 | ☑ |

