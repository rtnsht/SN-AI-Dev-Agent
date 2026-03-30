# Platform Redesign QA Validation Matrix

> Date: 2026-03-30
> Scope: Platform Architecture Redesign implementation across `webapp/` and `mcp-servicenow/`
> Primary surfaces: `webapp/src/app/app/page-v2.tsx`, `webapp/src/lib/workspace.ts`, `webapp/src/lib/model-platform.ts`, `webapp/src/app/api/chats/route.ts`, `webapp/src/app/api/user/connections/[id]/connect/route.ts`, `mcp-servicenow/src/tools/data-import.ts`

## Objective

Define the evaluation criteria, browser verification cases, restart protocol, and agent ownership needed to prove the redesigned `/app` experience is implemented, persisted correctly, and safe to operate against a live ServiceNow instance.

## Environment And Evidence

- Local webapp base URL: `http://localhost:3001`
- App auth: use provided QA credentials during execution; do not store secrets in this document
- ServiceNow validation target: use the provided QA instance during execution; do not store secrets in this document
- Required evidence per case:
  - Browser outcome and visible UI state
  - Network/API outcome when applicable
  - Persisted state after refresh for persistence-sensitive flows
  - Pass, fail, or blocked status with concise notes

## Fix And Restart Protocol

1. Reproduce the failing case.
2. Apply the targeted fix.
3. Stop the running webapp process.
4. Delete `webapp/.next`.
5. Restart the webapp with `npm run dev -- -p 3001`.
6. Re-run the impacted browser cases before resuming the wider matrix.
7. If MCP import/transform code changes, rebuild `mcp-servicenow` before rerunning the related cases.

## Evaluation Criteria

| Criteria ID | Slice | Acceptance Criteria | Evidence |
|---|---|---|---|
| EC-AUTH-01 | Auth and routing | Protected routes redirect unauthenticated users to `/login` and restore the intended destination after login. | Browser redirect and successful post-login landing. |
| EC-AUTH-02 | Auth and sessions | Login, logout, and clear-cache flows establish and destroy the webapp session correctly. | Browser session continuity before and after logout/clear-cache. |
| EC-AUTH-03 | Admin protection | `/admin` and admin APIs are accessible only to authorized admin users. | Browser page access plus API/UI behavior. |
| EC-WS-01 | Workspace provisioning | Authenticated users receive a valid workspace, space, and project context from `/api/workspace/context`. | API/browser state showing workspace context. |
| EC-WS-02 | Hierarchy settings | Effective settings merge workspace, space, and project settings in the expected precedence order. | API response and downstream UI behavior. |
| EC-CONN-01 | Saved connections | Saved ServiceNow connections are project-scoped, can be reused, and validate successfully via the connect endpoint. | Browser connect-from-saved flow and connection banner/state. |
| EC-CHAT-01 | Chat persistence | New chats are created with `project_id` and `connection_id`, and messages persist to the server. | Chat list updates, refresh recovery, and server-backed history. |
| EC-CHAT-02 | Session recovery | Refreshing the page restores the active session, its message history, and bound connection metadata. | Browser refresh and restored conversation state. |
| EC-CHAT-03 | Session switching | Switching between persisted chats restores each conversation without cross-session data leakage. | Browser chat switching and correct message sets. |
| EC-MODEL-01 | Model catalog | `/api/models` returns the catalog with availability, transport, and metadata fields required by the selector. | API response and model selector UI. |
| EC-MODEL-02 | Free-model rules | Admin-managed free-model rules appear to eligible users and enforce access correctly. | Admin action plus user-visible selector outcome. |
| EC-MODEL-03 | Model defaults | Project-level model defaults and settings flow into newly created chats. | New chat state and persisted chat settings. |
| EC-TOOLS-01 | Tool picker | Tool selection mode and category choices are reflected in chat settings and composer state. | Browser tool UI and persisted chat settings. |
| EC-TOOLS-02 | Tool filtering | The engine respects the selected tool scope rather than exposing the entire tool catalog. | Browser/API behavior and persisted settings. |
| EC-IMPORT-01 | Import tools | Import and transform tools are registered, visible in implementation mode, and callable. | Automated tests plus browser/API evidence where surfaced. |
| EC-IMPORT-02 | ServiceNow import flows | Import/transform smoke flows work against the QA ServiceNow instance or fail with actionable, bounded errors. | Browser/API output and ServiceNow response. |
| EC-SHELL-01 | App shell | The FDE-aligned `/app` shell renders workspace/project context, session list, composer, and inspector affordances. | Browser layout verification. |
| EC-SHELL-02 | Responsive behavior | Core `/app` workflows remain usable across desktop and narrow viewports. | Browser viewport checks. |

## Browser Test Cases

| Case ID | Slice | Test Case | Preconditions | Expected Result | Owner | Status | Notes |
|---|---|---|---|---|---|---|---|
| TC-AUTH-01 | Auth | Visit `/app` while signed out. | No active app session. | Redirects to `/login?redirect=/app`. | Agent A | Pass | Verified browser redirect to `/login?redirect=%2Fapp`. |
| TC-AUTH-02 | Auth | Sign in with the provided webapp credentials from `/login`. | QA account exists. | Redirects into `/app` and loads authenticated shell state. | Agent A | Pass | QA account password was repaired to the provided credential; authenticated session then established successfully. |
| TC-AUTH-03 | Auth | Reload `/app` after login. | `TC-AUTH-02` passed. | Session remains active and authenticated data reloads. | Agent A | Pass | Browser session persisted across refresh and `/app` reloaded authenticated state. |
| TC-AUTH-04 | Auth | Use profile menu `Sign Out`. | Logged in session. | Session is destroyed and user returns to `/`. | Agent A | Pass | Sign out returned the browser to the landing page and cleared authenticated state. |
| TC-AUTH-05 | Auth | Use profile menu `Clear cache`. | Logged in session. | Local session/cache is cleared and user is redirected through `/clearcache`. | Agent A | Pass | Clear-cache flow logged the user out and redirected to the landing page. |
| TC-AUTH-06 | Auth | Open `/admin` with the QA app account. | Logged in QA account. | Admin page loads if account is admin; otherwise case is blocked and recorded. | Agent A | Pass | Admin dashboard and Models tab were reachable with the QA admin account. |
| TC-WS-01 | Workspace | Load `/api/workspace/context` via app bootstrap. | Logged in session. | Response includes non-empty `workspace`, `space`, `project`, and `effectiveSettings`. | Agent B | Pass | Authenticated bootstrap returned workspace context and `/app` rendered it without context error. |
| TC-WS-02 | Workspace | Verify workspace, space, and project labels render in the shell header. | `TC-WS-01` passed. | Header shows the provisioned names and no context error. | Agent B | Pass | Header showed `My Workspace`, `Default Space`, and `Default Project`. |
| TC-WS-03 | Workspace | Update hierarchy settings through the workspace context API and verify precedence. | Logged in session and writable DB. | Effective settings reflect project > space > workspace precedence. | Agent C | Blocked | No safe browser UI exposed for editing hierarchy settings; covered partially by automated merge tests only. |
| TC-CONN-01 | Connections | Open the saved connection panel for the current project. | Logged in session. | Existing project-scoped connections load without auth or project mismatch errors. | Agent B | Pass | Saved Instances panel loaded for the active project and showed the empty-state message instead of an auth/project error. |
| TC-CONN-02 | Connections | Connect using an existing saved ServiceNow instance. | At least one saved connection exists or can be created. | Connection succeeds, right rail opens, and connection banner appears. | Agent B | Fail | Basic auth to `/api/test-connection` returned `401`, Browser Session backend returned cookies but end-to-end app connection did not complete. |
| TC-CONN-03 | Connections | Attempt to connect using a broken or invalid saved connection. | Invalid connection record available. | UI shows bounded failure state without corrupting the active session. | Agent B | Blocked | No working saved-connection baseline was available after `TC-CONN-02` failed. |
| TC-CHAT-01 | Chats | Start a new chat while a saved connection is active. | Logged in and connected. | New persisted chat is created with the active `project_id` and `connection_id`. | Agent B | Blocked | Connection prerequisite failed; no active ServiceNow connection was available for a browser chat run. |
| TC-CHAT-02 | Chats | Send a user message in the new chat. | `TC-CHAT-01` passed. | Message appears immediately and persists to server-backed history. | Agent B | Blocked | Blocked by `TC-CONN-02` and `TC-CHAT-01`. |
| TC-CHAT-03 | Chats | Refresh the page after messages exist. | `TC-CHAT-02` passed. | Same chat and message history are restored from `/api/chats/:id/messages`. | Agent B | Blocked | Blocked by `TC-CHAT-02`; no connected persisted chat session was established. |
| TC-CHAT-04 | Chats | Create a second chat and switch between the two sessions. | At least one persisted chat exists. | Each chat restores the correct history with no cross-contamination. | Agent B | Blocked | Blocked by `TC-CHAT-01` to `TC-CHAT-03`. |
| TC-CHAT-05 | Chats | Verify chat settings sync when model or connection changes. | Persisted chat exists. | `chats.settings` patch path succeeds and UI state remains consistent after refresh. | Agent B | Blocked | Blocked by the missing connected chat baseline. |
| TC-MODEL-01 | Models | Open the model selector in `/app`. | Logged in session. | Provider list, model metadata, and availability states render successfully. | Agent C | Pass | Model selector rendered Anthropic, OpenAI, Google, MiMo, MiniMax, GLM, OpenRouter, and Free Access groups. |
| TC-MODEL-02 | Models | Verify greyed-out providers show unavailable state when user/server access is missing. | At least one unavailable provider exists. | Unavailable providers are visibly disabled with explanatory copy. | Agent C | Pass | Disabled models showed `Needs key` state and unavailable-provider guidance. |
| TC-MODEL-03 | Models | Load `/api/models` and verify metadata fields. | Logged in session. | Catalog items include access source, transport, model class, speed tier, cost tier, training data, and thinking support. | Agent C | Pass | Authenticated `/api/models` returned `200` and the model metadata payload. |
| TC-MODEL-04 | Models | Open Admin `Models` tab and load model/rule data. | Admin-capable QA account required. | Model catalog and free-model rules load without API errors. | Agent C | Pass | Admin Models tab loaded catalog controls and free-access rules successfully. |
| TC-MODEL-05 | Models | Create or update a free-model rule, then verify it appears in the user model selector. | `TC-MODEL-04` passed. | Eligible user sees the model as available through admin free access. | Agent C | Blocked | Existing free-model rules were visible, but no safe mutation was performed in shared admin data. |
| TC-MODEL-06 | Models | Verify new chats inherit project-level model defaults. | Project settings writable. | Newly created chat settings reflect the configured default model. | Agent C | Blocked | No browser UI for writable project defaults and no connected chat baseline. |
| TC-TOOLS-01 | Tools | Open the tool picker and switch between selection modes. | Logged in session. | All-tools, category-based, and minimal modes are selectable and reflected in UI state. | Agent D | Pass | Tool picker opened and switched between category and all-tools modes with visible state changes. |
| TC-TOOLS-02 | Tools | Select a constrained tool scope and start a chat turn. | `TC-TOOLS-01` passed. | Persisted chat settings reflect constrained tool scope. | Agent D | Blocked | Tool scope selection worked in the UI, but no connected chat turn was completed after the connection failure. |
| TC-TOOLS-03 | Tools | Re-open the persisted chat. | `TC-TOOLS-02` passed. | Tool selection state is restored for the chat. | Agent D | Blocked | Blocked by the missing persisted connected chat from `TC-TOOLS-02`. |
| TC-IMPORT-01 | Import tools | Verify import/transform tools are present in implementation mode and in the tool catalog tests. | Buildable MCP package. | Required import/transform tools are registered and exposed. | Agent D | Pass | Data Import category was visible in the browser, and focused MCP tests passed for the import/transform tool catalog and handlers. |
| TC-IMPORT-02 | Import tools | Smoke-test import/transform interactions against the QA ServiceNow instance. | ServiceNow instance reachable. | Import/transform flow succeeds or fails with clear, bounded error output. | Agent D | Blocked | Blocked by the unresolved app-side connection flow; raw Browser Session route succeeded but the app did not complete a usable connected state. |
| TC-SHELL-01 | Shell | Verify the `/app` shell renders left rail, session list, main canvas, composer, and right rail controls. | Logged in session. | All core shell zones render and remain interactive. | Agent A | Pass | `/app` rendered the FDE shell zones, including left rail, workspace labels, composer, and settings/right-panel controls. |
| TC-SHELL-02 | Shell | Verify chat drawer/tool workbench/mobile connect panel affordances on narrow viewport. | Logged in session. | Core flows remain reachable and usable on narrow viewport. | Agent A | Blocked | Browser automation did not support reliable viewport resizing for this pass. |

## Targeted Automated Coverage

| Auto Case ID | Scope | Assertion | File |
|---|---|---|---|
| AT-MODEL-01 | Model platform | Free-rule and server-key resolution return the correct access source and block state. | `webapp/src/lib/model-platform.ts` |
| AT-MODEL-02 | Workspace | Hierarchical settings merge in the correct precedence order. | `webapp/src/lib/workspace.ts` |
| AT-TOOLS-01 | MCP tools | Import/transform tool names remain exposed in implementation and global tool catalogs. | `mcp-servicenow/tests/tool-evals.test.ts` |
| AT-TOOLS-02 | MCP tools | Data-import handlers build the expected ServiceNow queries and payloads. | `mcp-servicenow/src/tools/data-import.ts` |

## Agent Assignment

| Agent | Focus | Assigned Cases |
|---|---|---|
| Agent A | Auth, route protection, shell entry, logout, responsive shell checks | `TC-AUTH-01` to `TC-AUTH-06`, `TC-SHELL-01`, `TC-SHELL-02` |
| Agent B | Workspace bootstrap, saved connections, chat persistence, refresh recovery, session switching | `TC-WS-01`, `TC-WS-02`, `TC-CONN-01` to `TC-CONN-03`, `TC-CHAT-01` to `TC-CHAT-05` |
| Agent C | Model platform, admin rules, project-level defaults and inheritance | `TC-WS-03`, `TC-MODEL-01` to `TC-MODEL-06` |
| Agent D | Tool picker, tool filtering, import/transform verification | `TC-TOOLS-01` to `TC-TOOLS-03`, `TC-IMPORT-01`, `TC-IMPORT-02` |

## Execution Log

| Timestamp | Action | Result |
|---|---|---|
| 2026-03-30 | Validation matrix authored. | Complete |
| 2026-03-30 | Added focused automated coverage for hierarchy merges, model catalog resolution, and MCP data-import handlers. | `webapp` tests passed; `mcp-servicenow` Vitest slice passed. |
| 2026-03-30 | Repaired the local QA admin password to the provided credential, cleared login rate limits, and restarted the webapp with a cleared `.next` cache. | Completed and rerun. |
| 2026-03-30 | Executed browser-agent verification across auth, shell, workspace, models, tools, and connection/import flows. | Mixed: core shell/auth/model/tool UI passed; connection-dependent slices failed or remained blocked. |
| 2026-03-30 | Probed direct ServiceNow login and browser-session bridge outside the UI. | Direct ServiceNow browser login passed; raw basic auth failed; browser-session route returned cookies but did not yield a reusable connected app state. |
