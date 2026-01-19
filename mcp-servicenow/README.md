# MCP ServiceNow Server

An MCP (Model Context Protocol) server that enables AI assistants like Augment to interact directly with ServiceNow instances. Includes **63 tools** across core CRUD operations and advanced brownfield instance management.

## Features

### Core Features
- **Connection Management**: Test and verify instance connectivity
- **Schema Discovery**: Get table schemas and field information
- **Record Operations**: Query, create, update, delete records
- **Script Management**: Create/read Business Rules, Script Includes, Client Scripts
- **Update Sets**: Create, manage, and **capture artifacts via REST API**

### Brownfield Enhancement Features (22 Tools)
- **Instance Analysis**: Comprehensive analysis covering 150+ artifact types across 40+ categories
- **OOTB Override Detection**: Find modified out-of-the-box artifacts
- **Dependency Mapping**: Build relationship graphs between artifacts
- **Anti-Pattern Detection**: Identify code quality issues and bad practices
- **Code Quality Scoring**: Rate scripts on A-F scale with metrics
- **Dead Code Detection**: Find unused scripts and orphaned artifacts
- **Change Impact Analysis**: Preview impact before making changes
- **Conflict Detection**: Detect conflicts between artifacts
- **Guardrail Validation**: Validate changes against configurable rules
- **Breaking Change Detection**: Detect breaking changes before deployment
- **Audit Logging**: Track AI-assisted changes for compliance
- **Persona Engine**: Adaptive settings based on user expertise
- **4G Framework**: Guardrails, Guidance, Governance, Growth
- **Approval Workflow**: Request and process change approvals
- **Multi-Instance Support**: Register, compare, and sync instances
- **Upgrade Readiness**: Analyze instance for upgrade compatibility
- **Conflict Prediction**: Predict conflicts before making changes
- **OOTB Comparison**: Compare instance against clean OOTB baseline

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-servicenow
npm install
```

### 2. Build the Server

```bash
npm run build
```

### 3. Configure Environment

Create a `.env` file:

```env
SN_INSTANCE_URL=https://your-instance.service-now.com
SN_USERNAME=admin
SN_PASSWORD=your-password
```

### 4. First-Time Setup: UpdateSetHelper API

**Important:** To capture artifacts in update sets via REST API, you need to deploy the UpdateSetHelper API to your instance:

```bash
node src/deployer/setup-updateset-api.js
```

If the API already exists on your instance, get the full path from ServiceNow:
1. Go to: System Web Services → Scripted REST APIs → UpdateSetHelper
2. Note the "Base API path" (e.g., `/api/1852730/update_set_helper`)
3. Add to `.env`: `SN_UPDATE_SET_API_PATH=/api/<namespace>/update_set_helper/set_current`

See [Update Set Artifact Capture](#update-set-artifact-capture) for details.

### 5. Test the Server

```bash
npm start
```

## VS Code / Augment Integration

The MCP server is configured in `.vscode/mcp.json`. Augment will automatically detect and use it.

### Setting Environment Variables

**macOS/Linux:**
```bash
export SN_INSTANCE_URL="https://your-instance.service-now.com"
export SN_USERNAME="admin"
export SN_PASSWORD="your-password"
```

**Windows:**
```cmd
set SN_INSTANCE_URL=https://your-instance.service-now.com
set SN_USERNAME=admin
set SN_PASSWORD=your-password
```

## Available Tools (63 Total)

### Core Tools (19)

| Tool | Description |
|------|-------------|
| `sn_test_connection` | Test connection to instance |
| `sn_get_instance_info` | Get instance information |
| `sn_get_tables` | List available tables |
| `sn_get_table_schema` | Get table field definitions |
| `sn_query_records` | Query records from any table |
| `sn_get_record` | Get single record by sys_id |
| `sn_create_record` | Create a new record |
| `sn_update_record` | Update an existing record |
| `sn_get_business_rules` | Get business rules for a table |
| `sn_create_business_rule` | Create a new business rule |
| `sn_get_script_includes` | Get script includes |
| `sn_create_script_include` | Create a script include |
| `sn_get_client_scripts` | Get client scripts for a table |
| `sn_create_client_script` | Create a client script |
| `sn_list_update_sets` | List update sets |
| `sn_get_update_set` | Get update set details |
| `sn_create_update_set` | Create a new update set |
| `sn_complete_update_set` | Complete an update set |
| `sn_get_update_set_contents` | Get update set contents |

### Extended Tools (22)

| Tool | Description |
|------|-------------|
| `sn_get_ui_policies` | Get UI policies for a table |
| `sn_create_ui_policy` | Create a new UI policy |
| `sn_get_ui_actions` | Get UI actions for a table |
| `sn_create_ui_action` | Create a new UI action |
| `sn_get_notifications` | Get email notifications |
| `sn_create_notification` | Create an email notification |
| `sn_get_events` | Get registered events |
| `sn_create_event` | Register a new event |
| `sn_get_acls` | Get access control rules |
| `sn_create_acl` | Create an access control rule |
| `sn_get_roles` | Get system roles |
| `sn_create_role` | Create a new role |
| `sn_get_catalog_items` | Get service catalog items |
| `sn_get_catalog_item` | Get catalog item details with variables |
| `sn_get_catalog_variables` | Get variables for a catalog item |
| `sn_get_requests` | Get service catalog requests |
| `sn_get_scheduled_jobs` | Get scheduled jobs |
| `sn_create_scheduled_job` | Create a scheduled job |
| `sn_get_fix_scripts` | Get fix scripts |
| `sn_create_fix_script` | Create a fix script |
| `sn_run_fix_script` | Run a fix script |

### Brownfield Analysis Tools (22)

| Tool | Description |
|------|-------------|
| `sn_analyze_instance` | Comprehensive instance analyzer covering 150+ artifact types |
| `sn_detect_ootb_overrides` | Detect modified OOTB artifacts |
| `sn_get_dependency_graph` | Build dependency graph between artifacts |
| `sn_find_anti_patterns` | Detect anti-patterns and bad practices |
| `sn_code_quality_score` | Analyze script quality (A-F grade) |
| `sn_find_dead_code` | Find unused/orphaned code |
| `sn_preview_change_impact` | Preview impact of proposed changes |
| `sn_detect_conflicts` | Detect conflicts between artifacts |
| `sn_validate_change` | Validate changes against guardrails |
| `sn_check_breaking_changes` | Detect breaking changes before deployment |
| `sn_log_change` | Log AI-assisted changes for audit |
| `sn_get_audit_history` | Retrieve audit history |
| `sn_detect_persona` | Detect user persona with adaptive settings |
| `sn_apply_4g_framework` | Apply 4G Framework (Guardrails, Guidance, Governance, Growth) |
| `sn_request_approval` | Submit change for approval |
| `sn_process_approval` | Process approval request |
| `sn_get_approval_status` | Get approval request status |
| `sn_register_instance` | Register instance for multi-instance workflows |
| `sn_list_instances` | List registered instances |
| `sn_compare_instances` | Compare artifacts between instances |
| `sn_assess_upgrade_readiness` | Analyze upgrade compatibility |
| `sn_predict_conflicts` | Predict conflicts before changes |
| `sn_compare_to_ootb` | Compare instance against OOTB baseline |

## Example Usage (via AI)

Once connected, ask Augment:

### Basic Operations
- "Test the connection to ServiceNow"
- "Show me the schema for the incident table"
- "Get all active P1 incidents"
- "Create a business rule on incident that..."
- "Create an update set called 'My Feature'"

### Brownfield Analysis
- "Analyze this ServiceNow instance for customizations"
- "Find all anti-patterns in the business rules on the incident table"
- "Show me the dependency graph for the IncidentUtils script include"
- "What's the code quality score for client scripts on the change_request table?"
- "Find all dead code and unused scripts"
- "How ready is this instance for an upgrade?"

### Change Governance
- "Preview the impact of adding a new business rule on incident"
- "Validate my proposed ACL change against guardrails"
- "Apply the 4G framework to my proposed script include"
- "Check for breaking changes before I modify this script"

### Multi-Instance
- "Compare the incident table customizations between dev and prod"
- "Predict conflicts for promoting my update set to production"

---

## Brownfield Tools Deep Dive

### Instance Analysis (`sn_analyze_instance`)

Comprehensive analysis covering 150+ artifact types across 40+ categories including:
- Business Logic (Business Rules, Script Includes, Scheduled Jobs)
- UI Components (Client Scripts, UI Policies, UI Actions)
- Security (ACLs, Roles, Data Policies)
- Integrations (REST APIs, SOAP Services, Import Sets)
- Modern Platform (Flow Designer, UI Builder, Virtual Agent)
- And many more...

**Example:**
```
"Analyze this instance focusing on security-related artifacts"
```

**Returns:**
- Total artifact counts by category
- Custom vs OOTB breakdown
- Health score (0-100)
- Prioritized recommendations

---

### Anti-Pattern Detection (`sn_find_anti_patterns`)

Detects 20+ categories of anti-patterns:
- `gr_in_client` - GlideRecord in client scripts (critical)
- `hardcoded_sysid` - Hardcoded sys_ids
- `missing_null_check` - Missing null checks before getValue()
- `synchronous_ajax` - Synchronous GlideAjax calls
- `global_business_rule` - Global business rules (expensive)
- `empty_catch` - Empty catch blocks
- `current_update_loop` - current.update() in loops
- `no_setworkflow` - Missing setWorkflow(false)
- And more...

**Example:**
```
"Find anti-patterns in business rules on the incident table"
```

---

### Code Quality Score (`sn_code_quality_score`)

Analyzes scripts and returns:
- **Grade**: A-F overall rating
- **Metrics**: Complexity, maintainability, documentation
- **Issues**: Specific problems found with severity
- **Recommendations**: Prioritized improvement suggestions

**Scoring Criteria:**
- Complexity (cyclomatic, nested depth)
- Documentation (comments, JSDoc)
- Best Practices (error handling, null checks)
- Performance (efficient patterns)

---

### 4G Framework (`sn_apply_4g_framework`)

Applies four governance pillars to proposed changes:

| Pillar | Description |
|--------|-------------|
| **Guardrails** | Hard stops (security, data integrity) |
| **Guidance** | Best practices and recommendations |
| **Governance** | Approval requirements and policies |
| **Growth** | Learning paths and skill development |

**Example:**
```
"Apply the 4G framework to creating a new ACL on sys_user"
```

---

### Upgrade Readiness (`sn_assess_upgrade_readiness`)

Analyzes instance for upgrade compatibility:
- **Grade**: A-F readiness rating
- **Risk Areas**: Modified OOTB artifacts, deprecated APIs
- **Blockers**: Critical issues that will break on upgrade
- **Recommendations**: Pre-upgrade remediation steps

---

### OOTB Comparison (`sn_compare_to_ootb`)

Compares instance against clean OOTB baseline:
- **Customization Score**: 0-100 (lower = closer to OOTB)
- **Custom Artifacts**: Net-new customizations
- **Modified OOTB**: Changed out-of-box artifacts
- **Upgrade Impact**: Which customizations will be affected

---

## Deployment Framework

The MCP ServiceNow server includes a **generic deployment framework** for deploying artifacts to ServiceNow instances.

### Quick Deploy

```bash
# Deploy using a manifest file
node src/deployer/cli.js --config src/deployments/inc-simple-002.json
```

### Creating a Deployment Manifest

Create a JSON manifest file that describes your deployment:

```json
{
  "name": "MY-FEATURE-001",
  "description": "Description of your feature",
  "updateSet": {
    "name": "My Feature Update Set",
    "description": "Contains all artifacts for my feature"
  },
  "artifacts": [
    {
      "type": "script_include",
      "name": "MyScriptInclude",
      "file": "./path/to/MyScriptInclude.js",
      "client_callable": true
    },
    {
      "type": "client_script",
      "name": "MyClientScript",
      "file": "./path/to/MyClientScript.js",
      "table": "incident",
      "type": "onChange",
      "field": "caller_id"
    },
    {
      "type": "business_rule",
      "name": "MyBusinessRule",
      "file": "./path/to/MyBusinessRule.js",
      "table": "incident",
      "when": "before",
      "insert": true
    }
  ]
}
```

### Supported Artifact Types

| Type | Table | Description |
|------|-------|-------------|
| `script_include` | sys_script_include | Server-side reusable scripts |
| `client_script` | sys_script_client | Browser-side form scripts |
| `business_rule` | sys_script | Server-side table triggers |

### Programmatic Usage

```javascript
import { ServiceNowDeployer } from './src/deployer/index.js';

const deployer = new ServiceNowDeployer({
    instanceUrl: 'https://your-instance.service-now.com',
    username: 'admin',
    password: 'password'
});

// Deploy from manifest file
await deployer.deployFromManifest('./my-manifest.json');

// Or deploy programmatically
await deployer.deploy({
    name: 'My Feature',
    updateSet: { name: 'My Update Set' },
    artifacts: [/* ... */]
}, './base/path');
```

## Update Set Artifact Capture

### The Challenge

ServiceNow's REST API does **not automatically respect session-based update sets** the way the UI does. When you create/update records via REST API, they typically go into the "Default" update set.

### The Solution

This project includes an **UpdateSetHelper API** that replicates the OOTB "Make This My Current Set" UI Action using `GlideUpdateSet().set()`.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Create Update Set (sys_update_set)                          │
│     └─> state: 'in progress'                                    │
│                                                                 │
│  2. Set as Current via UpdateSetHelper API                      │
│     └─> POST /api/<namespace>/update_set_helper/set_current     │
│     └─> Calls GlideUpdateSet().set(sys_id)                      │
│                                                                 │
│  3. Deploy Artifacts (using same session via cookie jar)        │
│     └─> Script Includes, Business Rules, Client Scripts, etc.  │
│     └─> Artifacts automatically captured in update set         │
│                                                                 │
│  4. Validate Update Set Contents                                │
│     └─> Query sys_update_xml for update_set=<your_id>          │
│                                                                 │
│  5. Complete Update Set                                         │
│     └─> state: 'complete'                                       │
└─────────────────────────────────────────────────────────────────┘
```

### First-Time Setup

Each ServiceNow instance has a **unique API namespace**. You have two options:

**Option 1: Run the setup script** (if API doesn't exist yet)

```bash
node src/deployer/setup-updateset-api.js
```

The script will deploy the API and save the path to your `.env` file.

**Option 2: Manual configuration** (if API already exists)

1. Go to: **System Web Services → Scripted REST APIs → UpdateSetHelper**
2. Note the **Base API path** (e.g., `/api/1852730/update_set_helper`)
3. Add to `.env`:

```env
SN_UPDATE_SET_API_PATH=/api/<namespace>/update_set_helper/set_current
```

### Configuring ACLs

If you get a **403 Forbidden** error, configure the Default ACL:

1. Go to **System Web Services → Scripted REST APIs → UpdateSetHelper**
2. Click the **Security** tab
3. Set **Default ACLs** to an appropriate ACL (e.g., "ACE Admin - REST Endpoint")
4. Click **Update**

### Testing the Setup

```bash
node test-updateset-flow.js
```

This will:
1. Create a new update set (with duplicate name check)
2. Set it as current via the API
3. Create a test script include
4. Verify the artifact was captured

### Environment Configuration

Your `.env` must include the API path:

```env
# UpdateSetHelper API path (required for update set artifact capture)
SN_UPDATE_SET_API_PATH=/api/<namespace>/update_set_helper/set_current
```

Replace `<namespace>` with your instance's namespace (e.g., `1852730`).

## Testing

The project includes comprehensive unit tests using Vitest.

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Test Coverage

| Tool | Tests |
|------|-------|
| `instance-analyzer` | 9 |
| `anti-pattern-detector` | 7 |
| `code-quality-analyzer` | 8 |
| `dead-code-finder` | 8 |
| `conflict-predictor` | 9 |
| `four-g-framework` | 9 |
| `guardrail-validator` | 8 |
| `persona-engine` | 9 |
| `upgrade-readiness` | 9 |
| `ootb-baseline-comparator` | 11 |

**Total: 87 tests**

## Security Notes

- Store credentials in environment variables, not in code
- Use a service account with minimum required permissions
- Consider using OAuth for production environments
- Configure appropriate ACLs on the UpdateSetHelper API

## Project Structure

```
mcp-servicenow/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── client/               # ServiceNow REST client
│   ├── tools/                # Tool implementations
│   │   ├── instance-analyzer.ts
│   │   ├── anti-pattern-detector.ts
│   │   ├── code-quality-analyzer.ts
│   │   ├── dead-code-finder.ts
│   │   ├── dependency-graph.ts
│   │   ├── ootb-override-detector.ts
│   │   ├── change-impact-analyzer.ts
│   │   ├── conflict-detector.ts
│   │   ├── guardrail-validator.ts
│   │   ├── breaking-change-detector.ts
│   │   ├── audit-logger.ts
│   │   ├── persona-engine.ts
│   │   ├── four-g-framework.ts
│   │   ├── approval-gate.ts
│   │   ├── instance-registry.ts
│   │   ├── instance-compare.ts
│   │   ├── upgrade-readiness.ts
│   │   ├── conflict-predictor.ts
│   │   └── ootb-baseline-comparator.ts
│   └── deployer/             # Deployment framework
├── tests/
│   ├── mocks/                # Mock ServiceNow client
│   └── tools/                # Unit tests for tools
├── dist/                     # Compiled JavaScript
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm run test`)
5. Submit a pull request

## License

MIT
