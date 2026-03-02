# Flow Designer Deployment Reference

> ⚠️ Flow Designer has complex internal requirements

## Structure

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `sys_hub_flow` | Flow definition | name, internal_name, status, latest_snapshot, master_snapshot |
| `sys_hub_trigger_instance` | Flow trigger | flow, trigger_definition, trigger_type |
| `sys_hub_action_instance` | Action steps | flow, action_type, compiled_snapshot, order, ui_id |
| `sys_hub_flow_stage` | Flow stages | flow, label, stage_id, order |
| `sys_hub_flow_input` | Flow variables | Complex variable definitions |

**Critical:** Flows require `latest_snapshot` and `master_snapshot` references created when you **Activate/Publish** a flow.

## Deployment Approach

**Step 1:** Create flow structure via REST API (creates draft flow):
```bash
cd mcp-servicenow && node lib/create-flow-rest.js
```

**Step 2:** Open Flow Designer UI and:
1. Configure trigger conditions
2. Add/configure action steps
3. Click **Activate** to publish (creates snapshots)

## Key Action Type IDs

| Action | Snapshot ID | Definition ID |
|--------|-------------|---------------|
| Create Catalog Task | `af51fd0e73141300612c273ffff6a785` | `f597c41073081300612c273ffff6a767` |
| Log | `5bc1bcc6531003003bf1d9109ec587d4` | - |
| Service Catalog Trigger | - | `c43a1011c36813002841b63b12d3ae15` |

## Key Learnings

- **Snapshots are mandatory** - Flow engine requires compiled snapshots
- **Action instances use snapshot IDs** - Not definition IDs
- **UI activation required** - Creates internal metadata and snapshots
- **Draft flows are accessible** - Can be opened and edited in UI
