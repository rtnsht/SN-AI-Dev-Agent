# Agent Handoff — Platform Redesign v4

> **Read this file first.** It contains everything needed to continue this work.

---

## What This Is

A complete implementation plan for redesigning the SN AI Agent platform. Created during a cloud agent planning session. All research, analysis, and design decisions are documented here.

## Files In This Directory

| File | Contents | Read Order |
|------|----------|------------|
| **`HANDOFF.md`** | This file — context, decisions, what to do next | **1st** |
| **`PLAN.md`** | Full implementation plan (v4) — 9 phases, 32 new files, 8 modified files | **2nd** |
| **`DIAGRAMS.md`** | 15 Mermaid architecture diagrams | Reference |
| **`UI-MOCKUPS.md`** | 14 ASCII UI mockups for all screens | Reference |
| **`CHATBOX-DETAIL.md`** | Detailed chat box interaction design — all 7 message types | Reference |
| **`CHATBOX-FDE-INSPIRED.md`** | Palantir FDE element-by-element mapping to our design | Reference |

## Also Read

| File | Why |
|------|-----|
| `/workspace/CLAUDE.md` | Project rules — phase gates, naming, never-do items |
| `/workspace/webapp/src/app/app/page.tsx` | Current layout (2577 lines) — DO NOT MODIFY |
| `/workspace/mcp-servicenow/src/tool-definitions.ts` | All 147 tool definitions |
| `/workspace/webapp/src/lib/sn-engine.ts` | Current AI engine |
| `/workspace/webapp/src/lib/auth.ts` | Current auth system (Supabase) |
| `/workspace/webapp/src/lib/supabase.ts` | Database client |
| `/workspace/webapp/supabase/migrations/` | All 21 existing migrations |

---

## Key Decisions Made

1. **Work on `page-v2.tsx` ONLY** — copy of page.tsx, never modify the original
2. **Palantir FDE-inspired design** — 7 zones: top toolbar, mode selector, messages, context ribbon, input field, tool menu, chat outline
3. **Blueprint design tokens** — 2px radius, 4px grid, dark theme hierarchy matching Palantir
4. **Two interaction modes** — Agent-assisted (chat) + Direct tool execution (forms auto-generated from inputSchema)
5. **8 agents** — Orchestrator(haiku), Explorer, Builder, SDD, Analyzer, Operator, Flow Architect, Evaluator(VAPT)
6. **Anthropic harness pattern** — Three-agent (Planner→Generator→Evaluator) with structured handoffs and context resets
7. **Extensible system connectors** — `SystemConnector` interface; ServiceNow first, JIRA/Salesforce/Linear future
8. **Generic credential vault** — `user_system_connections` table (not SN-specific), AES-256-GCM encrypted
9. **Mandatory login** — no anonymous chat access
10. **Unified attachments** — single button, any file type except executables

## Current Codebase State

| Area | Current State |
|------|---------------|
| **Database** | Supabase with 21 migrations. Tables: users, sessions, auth_tokens, user_instances, session_logs, etc. |
| **Auth** | Custom bcrypt+session system. Magic links, OTP, invite codes. |
| **Chat** | sessionStorage ONLY — no DB persistence. Single chat per tab. |
| **Tools** | 147 tools in 8 groups (TOOLS, MORE_TOOLS, ADDITIONAL_TOOLS, BROWNFIELD_TOOLS, FLOW_DESIGNER_TOOLS, SCOPED_APP_TOOLS, SERVICE_PORTAL_TOOLS, CATALOG_TOOLS) |
| **AI Engine** | `sn-engine.ts` — single agent loop with optional task planner. Anthropic + OpenRouter. |
| **UI** | 3-panel layout (320px left sidebar + chat + 374px right sidebar). Header has ~12 buttons. |
| **API Keys** | BYOK per-request or server env vars. No DB storage. |
| **File Parser** | PDF, DOCX, XLSX only. Separate image/doc upload buttons. |

## What To Build (Phase Order)

### Phase 1: Foundation
- Copy `page.tsx` → `webapp/src/app/app/page-v2.tsx`
- Create migrations 021-024 in `webapp/supabase/migrations/`
- Create `webapp/src/lib/crypto-vault.ts`
- Create `webapp/src/lib/system-connectors.ts`
- Create `webapp/src/lib/tool-categories.ts`
- Create API routes: `/api/chats/*`, `/api/user/connections/*`, `/api/user/api-keys/*`

### Phase 2: Agent Harness
- Create `webapp/src/lib/agent-definitions.ts`
- Create `webapp/src/lib/agent-orchestrator.ts`
- Modify `webapp/src/lib/sn-engine.ts` (add multi-agent mode)
- VAPT auto-enforcement on writes

### Phase 3: Tool Workbench + Direct Execution
- Create `webapp/src/components/ToolWorkbench.tsx`
- Create `webapp/src/components/ToolExecutionPanel.tsx`
- Create `webapp/src/lib/tool-form-generator.ts`
- Create `webapp/src/app/api/tools/execute/route.ts`

### Phase 4: UI Shell
- Create `webapp/src/components/NavRail.tsx`
- Create `webapp/src/components/DrawerOverlay.tsx`
- Create `webapp/src/components/ChatTabBar.tsx`
- Create `webapp/src/components/ChatListPanel.tsx`
- Refactor `page-v2.tsx` layout

### Phase 5-9: See PLAN.md for full details

## Research Sources Used

- **Anthropic "Effective Harnesses for Long-Running Agents"** — Two-part initializer+coding agent pattern
- **Anthropic "Harness Design for Long-Running Apps"** — Three-agent planner→generator→evaluator pattern
- **Palantir FDE docs** — Navigation, Modes & Skills, Best Practices, Tool approval workflows
- **Palantir Blueprint** — Design system: 2px radius, 4px grid, dark theme tokens
- **Atlassian MCP Server** — Official JIRA connector (46+ tools, OAuth 2.1)
- **MCP Protocol** — Anthropic's Model Context Protocol for universal tool connectivity
- **ServiceNow AI Agent Orchestrator** — SN's own multi-agent orchestration patterns
