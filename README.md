# r — SN AI Dev Agent for ServiceNow

**Say it. Ship it.** Build, test, and deploy ServiceNow solutions through natural language — powered by AI with a spec-driven methodology.

A full-stack framework that pairs a **Next.js web app** with an **80+ tool MCP engine** to let AI agents develop on ServiceNow instances end-to-end: from writing specs and designs to deploying business rules, client scripts, UI policies, flows, and more — all through conversation.

---

## How It Works

```
You describe what you need
    ↓
AI writes a spec → you approve
    ↓
AI writes a design → you approve
    ↓
AI builds & deploys to your instance
    ↓
AI tests and captures evidence
```

Every phase has a **gate** — the AI stops and waits for your approval before moving forward. Nothing ships without your sign-off.

---

## Quick Start

### Prerequisites

- Node.js 18+
- A ServiceNow instance (PDI or developer instance)

### 1. Install

```bash
git clone https://github.com/shunyaByteR/SN-AI-Dev-Agent.git
cd SN-AI-Dev-Agent

# Install MCP engine
cd mcp-servicenow && npm install && cd ..

# Install webapp
cd webapp && npm install && cd ..
```

### 2. Configure

```bash
cp webapp/.env.example webapp/.env
```

Edit `webapp/.env` with your credentials:

```env
# ServiceNow instance
SN_INSTANCE_URL=https://your-instance.service-now.com
SN_USERNAME=admin
SN_PASSWORD=your-password

# AI provider (pick one)
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENROUTER_API_KEY=sk-or-...
```

### 3. Build & Run

```bash
# Compile the MCP engine
cd mcp-servicenow && rm -rf dist && npx tsc && cd ..

# Start the webapp
cd webapp && npm run dev
```

Open **http://localhost:3000**, connect your instance, and start building.

---

## Project Structure

```
SN-AI-Dev-Agent/
├── webapp/                    # Next.js web application
│   ├── src/
│   │   ├── app/              # Pages & API routes
│   │   ├── components/       # Chat UI, settings, theme
│   │   └── lib/              # SN engine, logger, branding
│   └── .env                  # Configuration
│
├── mcp-servicenow/            # MCP tool engine (TypeScript)
│   ├── src/
│   │   ├── client/           # ServiceNow REST client
│   │   ├── tools/            # 34 tool modules (80+ tools)
│   │   ├── deployer/         # Helper API auto-deployment
│   │   └── types/            # Shared types
│   └── dist/                 # Compiled output
│
├── specs/                     # Requirement specifications
│   ├── manifest.json         # Requirement registry
│   ├── config.properties     # Phase gate settings
│   └── REQ-XXX/              # Per-requirement folders
│       ├── 1-spec.md
│       ├── 2-design.md
│       ├── 3-implementation/
│       ├── 4-testing/
│       └── 5-deployment.md
│
├── templates/                 # Document & code templates
├── scripts/                   # Validation & utility scripts
└── docs/                      # Architecture documentation
```

---

## Key Features

### Web Application
- **Chat interface** — Conversational AI development with streaming responses
- **Multi-provider AI** — Anthropic (Claude) and OpenRouter with model selection
- **Dark/light theme** — Configurable branding, colors, and logo
- **Live agent activity** — Timeline-style tool execution visualization
- **Session telemetry** — JSONL logging with live markdown dashboards
- **Phase tracking** — Visual SDLC pipeline (Spec → Design → Scope → Implement)
- **Voice input** — Speech-to-text for hands-free prompting
- **File attachments** — Upload images and documents for context

### MCP Tool Engine (80+ Tools)

| Category | Tools | Examples |
|----------|-------|---------|
| **Records** | CRUD, query, bulk ops | `sn_query_records`, `sn_create_record` |
| **Scripts** | Business rules, script includes, client scripts | `sn_create_business_rule`, `sn_create_script_include` |
| **UI** | UI policies, UI policy actions, catalog items | `sn_create_ui_policy`, `sn_create_catalog_item` |
| **Update Sets** | Create, capture, verify, move artifacts | `sn_create_update_set`, `sn_verify_update_set_capture` |
| **Flows** | Flow designer scaffolding and management | `sn_scaffold_flow`, `sn_get_flow` |
| **ACLs** | Access control rules | `sn_create_acl` |
| **Notifications** | Email notifications and events | `sn_create_notification` |
| **Scheduled Jobs** | Scheduled script executions | `sn_create_scheduled_job` |
| **Analysis** | Instance health, anti-patterns, conflicts | `sn_analyze_instance`, `sn_detect_anti_patterns` |
| **Quality** | Code quality, dead code, OOTB overrides | `sn_analyze_code_quality`, `sn_find_dead_code` |

### Update Set Capture (Three-Layer Defense)

Artifacts created via REST API normally land in the Default update set. Yantra uses three layers to ensure reliable capture:

1. **Session-based** — `GlideUpdateSet().set()` via helper API
2. **Post-creation move** — Multi-strategy `sys_update_xml` search and move
3. **GlideUpdateManager2** — Server-side `saveRecord()` fallback for any table type

### Helper APIs (Auto-Deployed)

On first connection, three Scripted REST APIs are automatically deployed to your instance:

| API | Purpose |
|-----|---------|
| **UIPolicyActionHelper** | Create UI Policy Actions with proper reference fields |
| **UpdateSetHelper** | Set current update set for artifact capture |
| **AddToUpdateSetHelper** | Layer 3 fallback via GlideUpdateManager2 |

---

## Configuration

### Environment Variables (`webapp/.env`)

| Variable | Description |
|----------|-------------|
| `SN_INSTANCE_URL` | ServiceNow instance URL |
| `SN_USERNAME` / `SN_PASSWORD` | Instance credentials |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENROUTER_API_KEY` | OpenRouter API key (alternative) |
| `NEXT_PUBLIC_APP_NAME` | App display name |
| `NEXT_PUBLIC_APP_TAGLINE` | Tagline shown in UI |
| `NEXT_PUBLIC_HERO_TAGLINE` | Large hero text on empty chat |
| `NEXT_PUBLIC_PRIMARY_COLOR` | Theme primary color |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window |

### Phase Gates (`specs/config.properties`)

```properties
spec.approval.required=block      # Must approve spec before design
design.approval.required=block    # Must approve design before implementation
testing.required=warn             # Warn if no tests
evidence.required=warn            # Warn if no evidence
```

---

## Development

```bash
# Rebuild MCP engine after changes
cd mcp-servicenow && rm -rf dist && npx tsc

# Type-check webapp
cd webapp && npx tsc --noEmit

# Run webapp in dev mode
cd webapp && npm run dev

# Validate a requirement
node scripts/validate.cjs REQ-XXX
```

---

## License

MIT

