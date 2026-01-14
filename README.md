# SN AI Dev Agent

**AI-Powered ServiceNow Development Framework with Spec-Driven Methodology**

An end-to-end automation framework that enables AI agents to develop, test, and deploy ServiceNow solutions following a structured, auditable process. Built for use with AI coding assistants like Augment.

---

## 🎯 What This Project Does

This framework provides:

1. **Spec-Driven Development** - Formal requirements → design → implementation → testing → deployment workflow
2. **MCP Server Integration** - Model Context Protocol server exposing ServiceNow APIs as AI-callable tools
3. **Automated Deployment** - Scripts to deploy artifacts directly to ServiceNow instances
4. **Phase Gate Validation** - Configurable checkpoints ensuring quality at each stage
5. **Evidence Capture** - Test results and deployment records for audit trails

---

## 🏗️ Project Structure

```
SN-AI-Dev-Agent/
│
├── requirements/                    # 📋 SPEC-DRIVEN DEVELOPMENT
│   ├── manifest.json               # Central registry of all requirements
│   ├── config.properties           # Phase gate settings (warn/block)
│   ├── validate.js                 # Validation script
│   ├── _templates/                 # Document templates
│   │   ├── 1-spec-template.md
│   │   ├── 2-design-template.md
│   │   ├── 3-test-plan-template.md
│   │   ├── 4-test-results-template.md
│   │   └── 5-deployment-template.md
│   ├── lib/
│   │   └── atf-runner.js           # ATF test integration
│   ├── REQ-001/                    # Example: Dynamic Assignment Orchestrator
│   │   ├── 1-spec.md               # Functional specification
│   │   ├── 2-design.md             # Technical design
│   │   ├── 3-implementation/       # Code artifacts
│   │   │   ├── script-includes/
│   │   │   └── business-rules/
│   │   ├── 4-testing/              # Test documentation
│   │   │   ├── test-plan.md
│   │   │   ├── test-results.md
│   │   │   └── evidence/
│   │   └── 5-deployment.md         # Deployment record
│   └── REQ-002/                    # Example: Deduplication Engine
│
├── mcp-servicenow/                  # 🔌 MCP SERVER
│   ├── src/
│   │   ├── index.ts                # MCP server entry point
│   │   ├── tools/                  # ServiceNow API tools
│   │   │   ├── records.ts          # CRUD operations
│   │   │   ├── scripts.ts          # Script Includes, Business Rules
│   │   │   ├── update-sets.ts      # Update set management
│   │   │   └── ...
│   │   └── req-001/                # Requirement-specific deploy scripts
│   │   └── req-002/
│   ├── test-connection.js          # Connection testing
│   └── discover-scopes.js          # Scope discovery
│
├── src/                             # 🛠️ CORE FRAMEWORK (CLI)
│   ├── cli.js                      # Command-line interface
│   └── core/                       # Pipeline modules
│
└── templates/                       # 📝 CODE TEMPLATES
    ├── business_rule.template.js
    ├── script_include.template.js
    └── client_script.template.js
```

---

## 🔄 Development Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPEC-DRIVEN DEVELOPMENT FLOW                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  1. SPEC     │───▶│  2. DESIGN   │───▶│  3. IMPLEMENT│                  │
│  │              │    │              │    │              │                  │
│  │  • Gather    │    │  • Component │    │  • Generate  │                  │
│  │    requirements│  │    architecture│  │    code      │                  │
│  │  • Write     │    │  • API design│    │  • Deploy to │                  │
│  │    spec.md   │    │  • Write     │    │    instance  │                  │
│  │  • Get       │    │    design.md │    │              │                  │
│  │    approval  │    │  • Get       │    │              │                  │
│  │              │    │    approval  │    │              │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                   │                          │
│         │    ◀── Phase Gate ──▶    ◀── Phase Gate ──▶                      │
│         │                   │                   │                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  4. TEST     │◀───│  5. DEPLOY   │◀───│  (continues) │                  │
│  │              │    │              │    │              │                  │
│  │  • Write     │    │  • Create    │    │              │                  │
│  │    test plan │    │    update set│    │              │                  │
│  │  • Execute   │    │  • Push to   │    │              │                  │
│  │    tests     │    │    instance  │    │              │                  │
│  │  • Capture   │    │  • Document  │    │              │                  │
│  │    evidence  │    │    deployment│    │              │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- ServiceNow instance (PDI or developer instance)
- VS Code with Augment extension (recommended)

### 1. Clone and Install

```bash
git clone https://github.com/your-repo/SN-AI-Dev-Agent.git
cd SN-AI-Dev-Agent

# Install MCP server dependencies
cd mcp-servicenow
npm install
cd ..
```

### 2. Configure ServiceNow Connection

```bash
# Copy example env file
cp mcp-servicenow/.env.example mcp-servicenow/.env

# Edit with your credentials
```

```env
SN_INSTANCE_URL=https://your-instance.service-now.com
SN_USERNAME=admin
SN_PASSWORD=your-password
```

### 3. Test Connection

```bash
cd mcp-servicenow
node test-connection.js
```

### 4. Configure MCP in VS Code

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "servers": {
    "servicenow": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp-servicenow/dist/index.js"]
    }
  }
}
```

---

## 📋 How to Use (with AI Assistant)

### Creating a New Requirement

1. **Tell the AI your requirement:**
   ```
   "Create a new requirement REQ-003 for an SLA breach notification system"
   ```

2. **AI will:**
   - Create `requirements/REQ-003/` folder structure
   - Generate spec from template
   - Ask clarifying questions
   - Get your approval before proceeding

3. **Review and approve the spec** (AI waits for your sign-off)

4. **AI creates technical design** → You approve

5. **AI generates code** and deploys to your instance

6. **AI runs tests** and captures evidence

### Validating a Requirement

```bash
node requirements/validate.js REQ-001
```

Output:
```
Validating REQ-001: Dynamic Assignment Orchestrator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Spec exists and approved
✅ Design exists and approved
✅ Implementation files exist
✅ Test plan exists
✅ Test results exist (5/5 passed)
✅ Deployment record exists

Status: READY FOR PRODUCTION
```

### Deploying a Requirement

```bash
cd mcp-servicenow
node src/req-001/deploy-req-001.js
```

---

##  Available MCP Tools

The MCP server exposes these ServiceNow operations:

| Tool | Description |
|------|-------------|
| `sn_query_records` | Query any table with encoded queries |
| `sn_get_record` | Get a single record by sys_id |
| `sn_create_record` | Create a new record |
| `sn_update_record` | Update an existing record |
| `sn_create_script_include` | Create Script Include |
| `sn_create_business_rule` | Create Business Rule |
| `sn_create_update_set` | Create Update Set |
| `sn_test_connection` | Test instance connectivity |
| ... and more |

---

## 🛡️ Phase Gate Configuration

Edit `requirements/config.properties`:

```properties
# Phase gate behavior: warn | block
spec.approval.required=block      # Must have approved spec
design.approval.required=block    # Must have approved design
testing.required=warn             # Warn if no tests (don't block)
evidence.required=warn            # Warn if no evidence
```

---

## 📄 License

MIT

