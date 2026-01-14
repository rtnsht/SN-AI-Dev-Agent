# MCP ServiceNow Server

An MCP (Model Context Protocol) server that enables AI assistants like Augment to interact directly with ServiceNow instances.

## Features

- **Connection Management**: Test and verify instance connectivity
- **Schema Discovery**: Get table schemas and field information
- **Record Operations**: Query, create, update, delete records
- **Script Management**: Create/read Business Rules, Script Includes, Client Scripts
- **Update Sets**: Create, manage, and **capture artifacts via REST API**

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

## Available Tools

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

## Example Usage (via AI)

Once connected, ask Augment:

- "Test the connection to ServiceNow"
- "Show me the schema for the incident table"
- "Get all active P1 incidents"
- "Create a business rule on incident that..."
- "Create an update set called 'My Feature'"

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

## Security Notes

- Store credentials in environment variables, not in code
- Use a service account with minimum required permissions
- Consider using OAuth for production environments
- Configure appropriate ACLs on the UpdateSetHelper API
