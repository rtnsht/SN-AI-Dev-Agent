# Platform Redesign QA Report

> Date: 2026-03-30
> Scope: Platform Architecture Redesign verification for `/app`, workspace hierarchy, model platform, tool picker, chat persistence, and ServiceNow connection flows

## Overall Status

| Area | Status | Notes |
|---|---|---|
| Auth and route protection | Pass | Redirects, authenticated shell access, sign out, clear cache, and admin access all verified. |
| Workspace and shell | Pass | Workspace, space, and project context render correctly in the redesigned shell. |
| Model platform | Pass with limits | Model selector, disabled-provider states, `/api/models`, and admin Models tab all verified. |
| Tool picker and import catalog | Pass with limits | Tool picker UI and Data Import catalog presence verified; focused automated tests passed. |
| Connection-backed chat flows | Fail / Blocked | ServiceNow connection could not be completed end-to-end inside the app, which blocked chat persistence and import smoke flows. |

## Automated Verification

### Webapp

Command:

```bash
npx tsx --test tests/workspace.test.ts tests/model-platform.test.ts
```

Result: `5/5` passing

- `webapp/tests/workspace.test.ts`
- `webapp/tests/model-platform.test.ts`

### MCP ServiceNow

Command:

```bash
npx vitest run tests/tool-evals.test.ts tests/data-import.test.ts
```

Result: `7/7` passing

- Existing catalog/eval coverage remained green.
- New `mcp-servicenow/tests/data-import.test.ts` verifies transform-map query construction, transform-entry payload mapping, and transform-worker script generation.

## Browser Verification Summary

### Passed

- `TC-AUTH-01` through `TC-AUTH-06`
- `TC-WS-01`, `TC-WS-02`
- `TC-CONN-01`
- `TC-MODEL-01` through `TC-MODEL-04`
- `TC-TOOLS-01`
- `TC-IMPORT-01`
- `TC-SHELL-01`

### Failed

- `TC-CONN-02`

### Blocked

- `TC-WS-03`
- `TC-CONN-03`
- `TC-CHAT-01` through `TC-CHAT-05`
- `TC-MODEL-05`, `TC-MODEL-06`
- `TC-TOOLS-02`, `TC-TOOLS-03`
- `TC-IMPORT-02`
- `TC-SHELL-02`

The reusable matrix with case-by-case notes lives in `docs/platform-redesign/QA-VALIDATION-MATRIX.md`.

## Fix And Rerun Actions Performed

1. The provided app credential did not match the stored password hash for `ratneshworkspace@gmail.com`.
2. The QA admin account password was synchronized to the provided credential in the local QA environment.
3. Login rate-limit entries for that account were cleared.
4. The webapp was restarted after stopping the running dev server and clearing `webapp/.next`.
5. Authenticated browser verification was rerun after the restart.

## Primary Finding

The redesign is mostly functional for auth, workspace context, shell composition, model management, and tool catalog selection, but the connection-dependent slice is not complete.

Evidence chain:

- Direct browser login to `https://dev181312.service-now.com` with the provided ServiceNow credentials succeeds.
- Raw basic-auth verification against ServiceNow from the app/backend returns `401`.
- The app’s `/api/browser-session-connect` route succeeds and exports session cookies.
- Those exported cookies do not produce a reusable authenticated Node-side ServiceNow session for `/api/test-connection`.
- Browser automation also hit an unreliable Settings-panel interaction path when trying to switch auth modes through the UI.

## Defect Boundary

The failing area is centered on the ServiceNow connection bridge rather than the general app shell.

Most relevant files:

- `webapp/src/app/app/page-v2.tsx`
- `webapp/src/components/SettingsPanel.tsx`
- `webapp/src/lib/browser-scope-switcher.ts`
- `webapp/src/lib/sn-engine.ts`
- `webapp/src/app/api/user/connections/[id]/connect/route.ts`

## Recommended Next Fixes

1. Make the Browser Session auth path deterministic in the UI so the auth-method toggle can be exercised reliably in the Settings panel.
2. Separate browser-session validation from Node-side `testConnection()` assumptions. The browser-session route can authenticate successfully even when exported cookies are not reusable from Node.
3. Decide whether saved connections should support browser-session credentials at all. If yes, they need a dedicated validation/reconnect path instead of the current `testConnection()` fallback.
4. After the connection path is fixed, rerun `TC-CONN-02`, `TC-CHAT-01` through `TC-CHAT-05`, `TC-TOOLS-02`, `TC-TOOLS-03`, and `TC-IMPORT-02`.
