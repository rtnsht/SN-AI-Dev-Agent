# REQ-001: Deployment Record

## Deployment Summary

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-001 |
| **Title** | Normal Change Maintenance Window Enforcement |
| **Deployment Date** | 2026-01-20 |
| **Deployed By** | AI Agent |
| **Instance** | dev300943.service-now.com |
| **Update Set** | REQ-001 Maintenance Window Enforcement |
| **Update Set sys_id** | d77099f5932a72502f57f0ba2bba105c |
| **Status** | ✅ Deployed |

---

## Deployed Artifacts

### Scripts & Rules

| Artifact | Type | sys_id | Table |
|----------|------|--------|-------|
| MaintenanceWindowUtil | Script Include | af70d979932a72502f57f0ba2bba1080 | sys_script_include |
| ValidateMaintenanceWindowChange | Business Rule | 3f70d979932a72502f57f0ba2bba10b2 | sys_script |
| NotifyMaintenanceWindowStakeholders | Business Rule | 0080d979932a72502f57f0ba2bba10c3 | sys_script |
| MaintenanceWindowFormGuidance | Client Script | 8480d979932a72502f57f0ba2bba10f8 | sys_script_client |

### Events

| Event Name | sys_id |
|------------|--------|
| mw.change.created | 10801d79932a72502f57f0ba2bba1005 |
| mw.change.approved | ec801d79932a72502f57f0ba2bba1044 |
| mw.change.started | 64801d79932a72502f57f0ba2bba1098 |
| mw.change.closed | 3c801d79932a72502f57f0ba2bba10e2 |

### Notifications

| Notification Name | Event | sys_id |
|-------------------|-------|--------|
| MW Change Created | mw.change.created | 30805d79932a72502f57f0ba2bba1008 |
| MW Change Approved | mw.change.approved | 01805d79932a72502f57f0ba2bba102f |
| MW Change Started | mw.change.started | dd805d79932a72502f57f0ba2bba1047 |
| MW Change Closed | mw.change.closed | 55805d79932a72502f57f0ba2bba106d |

---

## Pre-Deployment Checklist

- [x] Spec approved
- [x] Design approved
- [x] Implementation reviewed
- [x] Update set created
- [x] All artifacts deployed

---

## Post-Deployment Verification

| Check | Status | Notes |
|-------|--------|-------|
| Script Include callable | ✅ | API deployed successfully |
| Business Rules active | ✅ | Both before/after rules active |
| Client Script active | ✅ | onChange script active |
| Events registered | ✅ | 4 events registered |
| Notifications configured | ✅ | 4 notifications configured |

---

## Configuration Required

Before full functionality, ensure:

1. **Maintenance Schedules**: Create schedules in `cmn_schedule` table
2. **Business Service Configuration**: Link maintenance schedules to business services via `maintenance_schedule` field
3. **Service Owners**: Ensure `owned_by` field is populated on business services for notifications

---

## Rollback Procedure

If rollback is required:

1. Navigate to Update Set: `d77099f5932a72502f57f0ba2bba105c`
2. Set state to "Ignore" or back out the update set
3. Alternatively, deactivate individual artifacts:
   - Business Rule: ValidateMaintenanceWindowChange
   - Business Rule: NotifyMaintenanceWindowStakeholders
   - Client Script: MaintenanceWindowFormGuidance
   - Notifications: All 4 MW Change notifications

---

## Links

| Resource | URL |
|----------|-----|
| Instance | https://dev300943.service-now.com |
| Update Set | https://dev300943.service-now.com/sys_update_set.do?sys_id=d77099f5932a72502f57f0ba2bba105c |
| Script Include | https://dev300943.service-now.com/sys_script_include.do?sys_id=af70d979932a72502f57f0ba2bba1080 |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Deployer | AI Agent | 2026-01-20 | ☑ |
| Approver | Ratnesh Tiwari | 2026-01-20 | ☑ |

> **Deployment Status:** ✅ Complete

