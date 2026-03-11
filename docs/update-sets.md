# Update Set Artifact Capture Reference

> ⚠️ REST API does NOT honor "current update set" session context like the UI does

## Three-Layer Defense Strategy

**Layer 1 — Session-based capture** (`sn-client.ts`):
- Cookie-jar session persistence via `axios-cookiejar-support` + `tough-cookie`
- `callSetCurrentUpdateSetApi()` calls the UpdateSetHelper Scripted REST API
- Server-side runs `GlideUpdateSet().set()` to bind the session to the target update set

**Layer 2 — Post-creation move** (fallback in `sn-client.ts`):
- `moveArtifactToUpdateSet()` queries `sys_update_xml` after every create/update
- Multi-strategy search: exact name match → LIKE search → metadata table broad search with payload filtering
- Retry logic with increasing delays (metadata tables like `sys_dictionary` get 1500ms initial + 3 retries)
- Moves records to the target update set if they landed in the wrong one
- Auto-move hooks in: `createRecord`, `updateRecord`, `createBusinessRule`, `createScriptInclude`, `createClientScript`

**Layer 3 — Server-side GlideUpdateManager2** (fallback in `sn-client.ts`):
- `callAddToUpdateSetApi()` calls the AddToUpdateSetHelper Scripted REST API
- Server-side uses `GlideUpdateManager2().saveRecord(gr)` to explicitly create `sys_update_xml` entry
- Works for ANY table type, including those that don't reliably generate `sys_update_xml` entries (e.g., `sys_dictionary`, `sysauto_script`, `sysevent_register`)
- Auto-deployed alongside other helper APIs on connection init

## Duplicate Update Set Detection

| Scenario | Behavior |
|----------|----------|
| No duplicate | Creates normally |
| Duplicate found (default) | Returns `duplicateDetected: true` with existing sets |
| Duplicate + `autoTimestamp: true` | Auto-appends ISO timestamp to name |
| Duplicate + `force: true` | Skips check, creates duplicate |

**NEVER silently create duplicate update sets**

## Required Setup

All three helper APIs are auto-deployed on connection init. No manual setup required.

## Tools

| Tool | Purpose |
|------|---------|
| `sn_move_to_update_set` | Manual fallback — move a specific artifact to a target update set |
| `sn_verify_update_set_capture` | Verify ALL artifacts are captured in the update set; auto-moves missing ones |

## Implementation Workflow

1. Call `sn_create_update_set` — handle `duplicateDetected` response if returned
2. Call `sn_set_current_update_set` with the update set sys_id
3. Create artifacts — each response includes `updateSetCapture` field confirming capture
4. After ALL artifacts created, call `sn_verify_update_set_capture` with the full artifact list
5. Use `sn_move_to_update_set` as fallback for any remaining missing artifacts
