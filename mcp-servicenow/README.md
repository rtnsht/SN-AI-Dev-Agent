# MCP ServiceNow Server

An MCP (Model Context Protocol) server that enables AI assistants like Augment to interact directly with ServiceNow instances.

## Features

- **Connection Management**: Test and verify instance connectivity
- **Schema Discovery**: Get table schemas and field information
- **Record Operations**: Query, create, update, delete records
- **Script Management**: Create/read Business Rules, Script Includes, Client Scripts
- **Update Sets**: Create and manage update sets

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

### 4. Test the Server

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

## Security Notes

- Store credentials in environment variables, not in code
- Use a service account with minimum required permissions
- Consider using OAuth for production environments

