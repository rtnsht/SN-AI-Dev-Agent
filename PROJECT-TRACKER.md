# Project Tracker - SN AI Dev Agent

> **Last Updated:** 2026-02-22
> **Instance:** dev181312.service-now.com (changed from dev300943)
> **Branch:** `v1-as-webapp` (web app development)

---

## 📊 Project Status Overview

| Requirement | Title | Status | Phase | Notes |
|-------------|-------|--------|-------|-------|
| REQ-001 | Normal Change Maintenance Window Enforcement | ⚠️ Needs Redeploy | Complete | Was on dev300943, needs redeploy to dev181312 |
| REQ-002 | New Hire Equipment Bundle Orchestration | ⚠️ Needs Redeploy | Testing | Was on dev300943, flow in draft mode |
| Web App | Expose SN AI Dev Agent as a web service | ✅ MVP Running | Implementation | Running at localhost:3000 on `v1-as-webapp` branch |

---

## 🔄 REQ-002: New Hire Equipment Bundle Orchestration

### Current Status
**Phase:** Testing  
**Flow Status:** Draft (needs UI activation)

### What's Been Done

| Step | Description | Status |
|------|-------------|--------|
| 1 | Spec created and approved | ✅ Complete |
| 2 | Design created and approved | ✅ Complete |
| 3 | Implementation files created | ✅ Complete |
| 4 | Base artifacts deployed (Script Include, Catalog Item, etc.) | ✅ Complete |
| 5 | Flow Designer flow created via REST API | ✅ Created (Draft) |
| 6 | Flow activation in UI | ⏳ Pending |
| 7 | End-to-end testing | ⏳ Pending |

### Flow Designer Artifacts Created

| Artifact | sys_id | Status |
|----------|--------|--------|
| sys_hub_flow | `3a43958493beb2902f57f0ba2bba10b6` | Draft |
| sys_hub_trigger_instance | `b643958493beb2902f57f0ba2bba10d0` | Created |
| sys_hub_action_instance | `cf43958493beb2902f57f0ba2bba10d4` | Created |

### Next Steps for REQ-002

1. **Open Flow Designer UI:**
   - URL: `https://dev300943.service-now.com/now/nav/ui/classic/params/target/%24flow-designer.do%23%2Fflow/3a43958493beb2902f57f0ba2bba10b6`

2. **Configure the flow:**
   - Set trigger conditions (when RITM is approved for "New Hire Equipment Bundle")
   - Add action steps to create 3 catalog tasks (Laptop, Access, Welcome Kit)
   - Add completion monitoring logic
   - Add notification actions

3. **Activate the flow:**
   - Click "Activate" button to publish
   - This creates required snapshots

4. **Test the flow:**
   - Submit a New Hire Equipment Bundle request
   - Approve the RITM
   - Verify tasks are created
   - Close tasks and verify RITM auto-closes

5. **Update manifest.json:**
   - Change status to "deployed"
   - Change phase to "complete"

---

## 📚 Key Learnings

### Flow Designer Insights

1. **Snapshots are mandatory** - Flow engine requires `latest_snapshot` and `master_snapshot`
2. **REST API creates draft flows** - Records are created but flow needs UI activation
3. **Action types have snapshots** - Use snapshot IDs (e.g., `af51fd0e73141300612c273ffff6a785`) not definition IDs
4. **UI activation required** - Creates internal metadata and compiles the flow

### Key Action Type IDs

| Action | Snapshot ID |
|--------|-------------|
| Create Catalog Task | `af51fd0e73141300612c273ffff6a785` |
| Log | `5bc1bcc6531003003bf1d9109ec587d4` |
| Service Catalog Trigger | `c43a1011c36813002841b63b12d3ae15` |

---

## 🛠️ Tools Created

| Tool | Location | Purpose |
|------|----------|---------|
| create-flow-rest.js | `mcp-servicenow/lib/` | Create Flow Designer flows via REST API |
| deploy.js | `mcp-servicenow/deploy/` | Generic artifact deployer |

---

## 📁 Files Modified This Session

| File | Change |
|------|--------|
| `CLAUDE.md` | Updated Section 13 with Flow Designer learnings |
| `specs/manifest.json` | Updated REQ-002 status |
| `specs/REQ-002/*` | Created spec, design, implementation, testing docs |

---

## 🎯 Upcoming Work

### Immediate (REQ-002 Completion)
- [ ] Activate flow in Flow Designer UI
- [ ] Configure trigger and actions
- [ ] Test end-to-end workflow
- [ ] Mark REQ-002 as complete

### Future Enhancements — ServiceNow
- [ ] Automate flow activation via ServiceNow APIs (if possible)
- [ ] Create flow templates for common patterns
- [ ] Add ATF tests for Flow Designer flows
- [ ] Redeploy REQ-001 and REQ-002 to new instance (dev181312)

### Future Enhancements — Web App (Production Readiness)

> Logged: 2026-02-22 — These must be addressed before exposing the app to multiple users.

- [ ] **FE-001: Server-side encrypted sessions & credential security**
  - Exchange credentials for a short-lived session token on connect (HTTP-only cookie)
  - Encrypt credentials at rest in server memory (or Redis/similar) with a server-side key
  - Stop sending credentials in every request body — subsequent requests use session token only
  - Credentials must never appear in browser DevTools Network tab after initial exchange
  - Clear credentials from server memory on disconnect/timeout

- [ ] **FE-002: Structured logging & admin session monitoring**
  - Assign a unique session ID on connect, attach to all log entries for that session
  - Replace `console.log` with structured JSON logging (e.g., Winston/Pino)
  - Persist logs to file or external service (CloudWatch, Datadog, etc.)
  - Log: session ID, username, instance, tools called, duration, timestamp, outcome
  - Build an admin view (`/admin/logs` page or API) to search/filter session history by user, instance, date

- [ ] **FE-003: Credential redaction & zero-persistence guarantee**
  - Strip passwords and API keys from all log output (redact to `***`)
  - Sanitize error stack traces so credentials are never leaked on exceptions
  - Credentials must not be stored in localStorage, cookies (only HTTP-only session token), or server-side logs
  - On the client, credentials live only in React state (browser memory) — cleared on tab close/refresh
  - Document the credential lifecycle for security audits

---

## 📝 Session Notes

**2026-02-03:**
- Investigated Flow Designer internal structure
- Discovered snapshots are required for flow execution
- Created flow via REST API (draft mode)
- Flow sys_id: `3a43958493beb2902f57f0ba2bba10b6`
- Updated CLAUDE.md with learnings
- Cleaned up temporary exploration scripts

**2026-02-22:**
- Instance changed from dev300943 to dev181312
- Created `snapshot/2026-02-21` branch and `v1-as-webapp` branch
- Built full web app (Option A) — Next.js + Anthropic tool-use loop + 60+ SN tools
- Added role verification (admin/security_admin check on connect)
- Improved UI: markdown rendering, system messages, example prompts, tool cards
- Identified 3 production-readiness gaps (FE-001, FE-002, FE-003) — logged as future enhancements
