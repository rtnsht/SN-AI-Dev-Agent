# ServiceNow Artifact → REST API Table Mapping

Use this reference when creating deployment scripts to ensure ALL artifacts can be created via REST API.

## Core Development Artifacts

| Artifact Type | REST Table | Notes |
|---------------|------------|-------|
| Custom Field | `sys_dictionary` | Dictionary entry for table columns |
| Business Rule | `sys_script` | Set `collection` for table |
| Script Include | `sys_script_include` | Reusable server scripts |
| Client Script | `sys_script_client` | onChange, onLoad, onSubmit |
| UI Policy | `sys_ui_policy` | Declarative field behavior |
| UI Policy Action | `sys_ui_policy_action` | Link to `ui_policy` sys_id |
| UI Action | `sys_ui_action` | Buttons, links, context menus |

## Events & Notifications

| Artifact Type | REST Table | Notes |
|---------------|------------|-------|
| Event Registry | `sysevent_register` | Register event names |
| Email Notification | `sysevent_email_action` | Can trigger on event or conditions |
| Email Script | `sys_email_script` | Dynamic email content |

## Security

| Artifact Type | REST Table | Notes |
|---------------|------------|-------|
| ACL | `sys_security_acl` | Access control rules |
| ACL Role | `sys_security_acl_role` | Roles assigned to ACLs |
| Role | `sys_user_role` | System roles |

## Service Catalog

| Artifact Type | REST Table | Notes |
|---------------|------------|-------|
| Catalog Item | `sc_cat_item` | Service catalog items |
| Variable | `item_option_new` | Catalog item variables |
| Variable Set | `item_option_new_set` | Reusable variable groups |
| Catalog UI Policy | `catalog_ui_policy` | Catalog-specific UI policies |
| Catalog Client Script | `catalog_script_client` | Catalog-specific scripts |

## Workflows & Flows

| Artifact Type | REST Table | Notes |
|---------------|------------|-------|
| Workflow | `wf_workflow` | Legacy workflows |
| Flow | `sys_hub_flow` | Flow Designer flows |
| Subflow | `sys_hub_flow` | type=subflow |
| Action | `sys_hub_action_type_definition` | Flow Designer actions |

## Update Sets & Deployment

| Artifact Type | REST Table | Notes |
|---------------|------------|-------|
| Update Set | `sys_update_set` | Container for changes |
| Fix Script | `sys_script_fix` | One-time data fixes |

## Scheduled Jobs

| Artifact Type | REST Table | Notes |
|---------------|------------|-------|
| Scheduled Job | `sysauto_script` | Scheduled script execution |

---

## Deployment Checklist

Before marking implementation complete, verify:

- [ ] Every artifact in design document maps to a REST table above
- [ ] Deployment script creates ALL artifacts (no manual steps)
- [ ] If artifact can't be created via REST, document WHY and escalate

