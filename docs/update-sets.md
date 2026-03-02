# Update Set Artifact Capture Reference

> ⚠️ REST API does NOT honor "current update set" session context like the UI does

## Two-Layer Defense Strategy

**Layer 1 — Session-based capture** (`sn-client.ts`):
- Cookie-jar session persistence via `axios-cookiejar-support` + `tough-cookie`
- `callSetCurrentUpdateSetApi()` calls the UpdateSetHelper Scripted REST API
- Server-side runs `GlideUpdateSet().set()` to bind the session to the target update set

**Layer 2 — Post-creation move** (fallback):
- `moveArtifactToUpdateSet()` queries `sys_update_xml` after every create/update
- Moves records to the target update set if they landed in the wrong one
- Auto-move hooks in: `createRecord`, `updateRecord`, `createBusinessRule`, `createScriptInclude`, `createClientScript`

## Duplicate Update Set Detection

| Scenario | Behavior |
|----------|----------|
| No duplicate | Creates normally |
| Duplicate found (default) | Returns `duplicateDetected: true` with existing sets |
| Duplicate + `autoTimestamp: true` | Auto-appends ISO timestamp to name |
| Duplicate + `force: true` | Skips check, creates duplicate |

**NEVER silently create duplicate update sets**

## Required Setup

1. Deploy the UpdateSetHelper Scripted REST API:
   ```bash
   cd mcp-servicenow && node src/deployer/setup-updateset-api.js
   ```
2. Configure in `.env`:
   ```
   SN_UPDATE_SET_API_PATH=/api/<namespace>/update_set_helper/set_current
   ```

## Implementation Workflow

1. Call `sn_create_update_set` — handle `duplicateDetected` response if returned
2. Call `sn_set_current_update_set` with the update set sys_id
3. Create artifacts — each response includes `updateSetCapture` field confirming capture
4. Verify with `sn_get_update_set_contents`
5. Use `sn_move_to_update_set` as fallback for any missing artifacts
