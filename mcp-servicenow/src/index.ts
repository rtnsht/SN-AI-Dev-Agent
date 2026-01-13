#!/usr/bin/env node
/**
 * MCP ServiceNow Server
 * Main entry point for the Model Context Protocol server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';

import { ServiceNowClient } from './client/sn-client.js';
import * as connection from './tools/connection.js';
import * as records from './tools/records.js';
import * as scripts from './tools/scripts.js';
import * as updateSets from './tools/update-sets.js';
import * as uiPolicies from './tools/ui-policies.js';
import * as notifications from './tools/notifications.js';
import * as acls from './tools/acls.js';
import * as catalog from './tools/catalog.js';
import * as scheduledJobs from './tools/scheduled-jobs.js';

// Load environment variables
dotenv.config();

// Initialize ServiceNow client
function createClient(): ServiceNowClient {
  const instanceUrl = process.env.SN_INSTANCE_URL;
  const username = process.env.SN_USERNAME;
  const password = process.env.SN_PASSWORD;

  if (!instanceUrl || !username || !password) {
    throw new Error('Missing required environment variables: SN_INSTANCE_URL, SN_USERNAME, SN_PASSWORD');
  }

  return new ServiceNowClient({
    instanceUrl,
    username,
    password,
    defaultScope: process.env.SN_DEFAULT_SCOPE || 'global'
  });
}

// Define available tools
const TOOLS: Tool[] = [
  // Connection tools
  {
    name: 'sn_test_connection',
    description: 'Test connection to the ServiceNow instance',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'sn_get_instance_info',
    description: 'Get information about the connected ServiceNow instance',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'sn_get_tables',
    description: 'List available tables in the instance',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional query filter' },
        limit: { type: 'number', description: 'Max tables to return', default: 50 }
      }
    }
  },
  {
    name: 'sn_get_table_schema',
    description: 'Get the schema (fields) for a specific table',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name (e.g., "incident")' }
      },
      required: ['table']
    }
  },
  // Record tools
  {
    name: 'sn_query_records',
    description: 'Query records from any ServiceNow table',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        query: { type: 'string', description: 'Encoded query string' },
        fields: { type: 'array', items: { type: 'string' }, description: 'Fields to return' },
        limit: { type: 'number', default: 20 }
      },
      required: ['table']
    }
  },
  {
    name: 'sn_get_record',
    description: 'Get a single record by sys_id',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        sys_id: { type: 'string' }
      },
      required: ['table', 'sys_id']
    }
  },
  {
    name: 'sn_create_record',
    description: 'Create a new record in any table',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        data: { type: 'object', description: 'Field values' }
      },
      required: ['table', 'data']
    }
  },
  {
    name: 'sn_update_record',
    description: 'Update an existing record',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        sys_id: { type: 'string' },
        data: { type: 'object' }
      },
      required: ['table', 'sys_id', 'data']
    }
  },
  // Business Rule tools
  {
    name: 'sn_get_business_rules',
    description: 'Get business rules for a table',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        activeOnly: { type: 'boolean', default: true }
      },
      required: ['table']
    }
  },
  {
    name: 'sn_create_business_rule',
    description: 'Create a new business rule',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        table: { type: 'string' },
        script: { type: 'string' },
        when: { type: 'string', enum: ['before', 'after', 'async', 'display'] },
        order: { type: 'number', default: 100 },
        condition: { type: 'string' },
        insert: { type: 'boolean', default: true },
        update: { type: 'boolean', default: true },
        delete: { type: 'boolean', default: false },
        query: { type: 'boolean', default: false },
        active: { type: 'boolean', default: true }
      },
      required: ['name', 'table', 'script', 'when']
    }
  },
  // Script Include tools
  {
    name: 'sn_get_script_includes',
    description: 'Get script includes',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        activeOnly: { type: 'boolean', default: true }
      }
    }
  },
  {
    name: 'sn_create_script_include',
    description: 'Create a new script include',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        script: { type: 'string' },
        clientCallable: { type: 'boolean', default: false },
        active: { type: 'boolean', default: true }
      },
      required: ['name', 'script']
    }
  }
];

// Client Script tools
const MORE_TOOLS: Tool[] = [
  {
    name: 'sn_get_client_scripts',
    description: 'Get client scripts for a table',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        activeOnly: { type: 'boolean', default: true }
      },
      required: ['table']
    }
  },
  {
    name: 'sn_create_client_script',
    description: 'Create a new client script',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        table: { type: 'string' },
        script: { type: 'string' },
        type: { type: 'string', enum: ['onLoad', 'onChange', 'onSubmit', 'onCellEdit'] },
        field: { type: 'string' },
        active: { type: 'boolean', default: true }
      },
      required: ['name', 'table', 'script', 'type']
    }
  },
  // Update Set tools
  {
    name: 'sn_list_update_sets',
    description: 'List update sets in the instance',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', enum: ['in progress', 'complete', 'ignore', 'all'], default: 'all' },
        limit: { type: 'number', default: 20 }
      }
    }
  },
  {
    name: 'sn_get_update_set',
    description: 'Get details of a specific update set',
    inputSchema: {
      type: 'object',
      properties: { sys_id: { type: 'string' } },
      required: ['sys_id']
    }
  },
  {
    name: 'sn_create_update_set',
    description: 'Create a new update set',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['name']
    }
  },
  {
    name: 'sn_complete_update_set',
    description: 'Mark an update set as complete',
    inputSchema: {
      type: 'object',
      properties: { sys_id: { type: 'string' } },
      required: ['sys_id']
    }
  },
  {
    name: 'sn_get_update_set_contents',
    description: 'Get the contents/changes in an update set',
    inputSchema: {
      type: 'object',
      properties: {
        sys_id: { type: 'string' },
        limit: { type: 'number', default: 100 }
      },
      required: ['sys_id']
    }
  }
];

// Additional tools for UI, Notifications, ACLs, Catalog, and Scheduled Jobs
const ADDITIONAL_TOOLS: Tool[] = [
  // UI Policies
  { name: 'sn_get_ui_policies', description: 'Get UI policies for a table', inputSchema: { type: 'object', properties: { table: { type: 'string' }, activeOnly: { type: 'boolean', default: true } }, required: ['table'] } },
  { name: 'sn_create_ui_policy', description: 'Create a new UI policy', inputSchema: { type: 'object', properties: { name: { type: 'string' }, table: { type: 'string' }, conditions: { type: 'string' }, scriptTrue: { type: 'string' }, scriptFalse: { type: 'string' }, onLoad: { type: 'boolean', default: true }, active: { type: 'boolean', default: true } }, required: ['name', 'table'] } },
  // UI Actions
  { name: 'sn_get_ui_actions', description: 'Get UI actions for a table', inputSchema: { type: 'object', properties: { table: { type: 'string' }, activeOnly: { type: 'boolean', default: true } }, required: ['table'] } },
  { name: 'sn_create_ui_action', description: 'Create a new UI action', inputSchema: { type: 'object', properties: { name: { type: 'string' }, table: { type: 'string' }, script: { type: 'string' }, clientScript: { type: 'string' }, formButton: { type: 'boolean', default: true }, condition: { type: 'string' }, active: { type: 'boolean', default: true } }, required: ['name', 'table', 'script'] } },
  // Notifications
  { name: 'sn_get_notifications', description: 'Get email notifications', inputSchema: { type: 'object', properties: { table: { type: 'string' }, activeOnly: { type: 'boolean', default: true } } } },
  { name: 'sn_create_notification', description: 'Create an email notification', inputSchema: { type: 'object', properties: { name: { type: 'string' }, table: { type: 'string' }, subject: { type: 'string' }, messageHtml: { type: 'string' }, recipients: { type: 'string' }, insertAction: { type: 'boolean' }, updateAction: { type: 'boolean' }, active: { type: 'boolean', default: true } }, required: ['name', 'table', 'subject', 'messageHtml'] } },
  // Events
  { name: 'sn_get_events', description: 'Get registered events', inputSchema: { type: 'object', properties: { table: { type: 'string' }, limit: { type: 'number', default: 50 } } } },
  { name: 'sn_create_event', description: 'Register a new event', inputSchema: { type: 'object', properties: { name: { type: 'string' }, table: { type: 'string' }, description: { type: 'string' } }, required: ['name', 'table'] } },
  // ACLs
  { name: 'sn_get_acls', description: 'Get access control rules', inputSchema: { type: 'object', properties: { table: { type: 'string' }, operation: { type: 'string', enum: ['read', 'write', 'create', 'delete', '*'] }, activeOnly: { type: 'boolean', default: true } } } },
  { name: 'sn_create_acl', description: 'Create an access control rule', inputSchema: { type: 'object', properties: { name: { type: 'string' }, operation: { type: 'string', enum: ['read', 'write', 'create', 'delete'] }, roles: { type: 'array', items: { type: 'string' } }, condition: { type: 'string' }, script: { type: 'string' }, active: { type: 'boolean', default: true } }, required: ['name', 'operation'] } },
  // Roles
  { name: 'sn_get_roles', description: 'Get system roles', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number', default: 100 } } } },
  { name: 'sn_create_role', description: 'Create a new role', inputSchema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, elevated: { type: 'boolean', default: false } }, required: ['name'] } },
  // Catalog
  { name: 'sn_get_catalog_items', description: 'Get service catalog items', inputSchema: { type: 'object', properties: { category: { type: 'string' }, query: { type: 'string' }, activeOnly: { type: 'boolean', default: true } } } },
  { name: 'sn_get_catalog_item', description: 'Get catalog item details with variables', inputSchema: { type: 'object', properties: { sys_id: { type: 'string' } }, required: ['sys_id'] } },
  { name: 'sn_get_catalog_variables', description: 'Get variables for a catalog item', inputSchema: { type: 'object', properties: { catalogItem: { type: 'string' } }, required: ['catalogItem'] } },
  { name: 'sn_get_requests', description: 'Get service catalog requests', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number', default: 50 } } } },
  // Scheduled Jobs
  { name: 'sn_get_scheduled_jobs', description: 'Get scheduled jobs', inputSchema: { type: 'object', properties: { activeOnly: { type: 'boolean', default: true } } } },
  { name: 'sn_create_scheduled_job', description: 'Create a scheduled job', inputSchema: { type: 'object', properties: { name: { type: 'string' }, script: { type: 'string' }, runType: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'periodically', 'once'] }, runTime: { type: 'string' }, active: { type: 'boolean', default: true } }, required: ['name', 'script', 'runType'] } },
  // Fix Scripts
  { name: 'sn_get_fix_scripts', description: 'Get fix scripts', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
  { name: 'sn_create_fix_script', description: 'Create a fix script', inputSchema: { type: 'object', properties: { name: { type: 'string' }, script: { type: 'string' }, description: { type: 'string' } }, required: ['name', 'script'] } },
  { name: 'sn_run_fix_script', description: 'Run a fix script', inputSchema: { type: 'object', properties: { sys_id: { type: 'string' } }, required: ['sys_id'] } }
];

const ALL_TOOLS = [...TOOLS, ...MORE_TOOLS, ...ADDITIONAL_TOOLS];

// Create the MCP server
const server = new Server(
  { name: 'mcp-servicenow', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

let client: ServiceNowClient | null = null;

function getClient(): ServiceNowClient {
  if (!client) {
    client = createClient();
  }
  return client;
}

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: ALL_TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const snClient = getClient();

  try {
    let result: unknown;

    switch (name) {
      // Connection tools
      case 'sn_test_connection':
        result = await connection.testConnection(snClient);
        break;
      case 'sn_get_instance_info':
        result = await connection.getInstanceInfo(snClient);
        break;
      case 'sn_get_tables':
        result = await connection.getTables(snClient, connection.getTablesSchema.parse(args));
        break;
      case 'sn_get_table_schema':
        result = await connection.getTableSchema(snClient, connection.getTableSchemaInputSchema.parse(args));
        break;

      // Record tools
      case 'sn_query_records':
        result = await records.queryRecords(snClient, records.queryRecordsSchema.parse(args));
        break;
      case 'sn_get_record':
        result = await records.getRecord(snClient, records.getRecordSchema.parse(args));
        break;
      case 'sn_create_record':
        result = await records.createRecord(snClient, records.createRecordSchema.parse(args));
        break;
      case 'sn_update_record':
        result = await records.updateRecord(snClient, records.updateRecordSchema.parse(args));
        break;

      // Business Rule tools
      case 'sn_get_business_rules':
        result = await scripts.getBusinessRules(snClient, scripts.getBusinessRulesSchema.parse(args));
        break;
      case 'sn_create_business_rule':
        result = await scripts.createBusinessRule(snClient, scripts.createBusinessRuleSchema.parse(args));
        break;

      // Script Include tools
      case 'sn_get_script_includes':
        result = await scripts.getScriptIncludes(snClient, scripts.getScriptIncludesSchema.parse(args));
        break;
      case 'sn_create_script_include':
        result = await scripts.createScriptInclude(snClient, scripts.createScriptIncludeSchema.parse(args));
        break;

      // Client Script tools
      case 'sn_get_client_scripts':
        result = await scripts.getClientScripts(snClient, scripts.getClientScriptsSchema.parse(args));
        break;
      case 'sn_create_client_script':
        result = await scripts.createClientScript(snClient, scripts.createClientScriptSchema.parse(args));
        break;

      // Update Set tools
      case 'sn_list_update_sets':
        result = await updateSets.listUpdateSets(snClient, updateSets.listUpdateSetsSchema.parse(args));
        break;
      case 'sn_get_update_set':
        result = await updateSets.getUpdateSet(snClient, updateSets.getUpdateSetSchema.parse(args));
        break;
      case 'sn_create_update_set':
        result = await updateSets.createUpdateSet(snClient, updateSets.createUpdateSetSchema.parse(args));
        break;
      case 'sn_complete_update_set':
        result = await updateSets.completeUpdateSet(snClient, updateSets.completeUpdateSetSchema.parse(args));
        break;
      case 'sn_get_update_set_contents':
        result = await updateSets.getUpdateSetContents(snClient, updateSets.getUpdateSetContentsSchema.parse(args));
        break;

      // UI Policy tools
      case 'sn_get_ui_policies':
        result = await uiPolicies.getUiPolicies(snClient, uiPolicies.getUiPoliciesSchema.parse(args));
        break;
      case 'sn_create_ui_policy':
        result = await uiPolicies.createUiPolicy(snClient, uiPolicies.createUiPolicySchema.parse(args));
        break;

      // UI Action tools
      case 'sn_get_ui_actions':
        result = await uiPolicies.getUiActions(snClient, uiPolicies.getUiActionsSchema.parse(args));
        break;
      case 'sn_create_ui_action':
        result = await uiPolicies.createUiAction(snClient, uiPolicies.createUiActionSchema.parse(args));
        break;

      // Notification tools
      case 'sn_get_notifications':
        result = await notifications.getNotifications(snClient, notifications.getNotificationsSchema.parse(args));
        break;
      case 'sn_create_notification':
        result = await notifications.createNotification(snClient, notifications.createNotificationSchema.parse(args));
        break;
      case 'sn_get_events':
        result = await notifications.getEvents(snClient, notifications.getEventsSchema.parse(args));
        break;
      case 'sn_create_event':
        result = await notifications.createEvent(snClient, notifications.createEventSchema.parse(args));
        break;

      // ACL tools
      case 'sn_get_acls':
        result = await acls.getAcls(snClient, acls.getAclsSchema.parse(args));
        break;
      case 'sn_create_acl':
        result = await acls.createAcl(snClient, acls.createAclSchema.parse(args));
        break;
      case 'sn_get_roles':
        result = await acls.getRoles(snClient, acls.getRolesSchema.parse(args));
        break;
      case 'sn_create_role':
        result = await acls.createRole(snClient, acls.createRoleSchema.parse(args));
        break;

      // Catalog tools
      case 'sn_get_catalog_items':
        result = await catalog.getCatalogItems(snClient, catalog.getCatalogItemsSchema.parse(args));
        break;
      case 'sn_get_catalog_item':
        result = await catalog.getCatalogItem(snClient, catalog.getCatalogItemSchema.parse(args));
        break;
      case 'sn_get_catalog_variables':
        result = await catalog.getCatalogVariables(snClient, catalog.getCatalogVariablesSchema.parse(args));
        break;
      case 'sn_get_requests':
        result = await catalog.getRequests(snClient, catalog.getRequestsSchema.parse(args));
        break;

      // Scheduled Job tools
      case 'sn_get_scheduled_jobs':
        result = await scheduledJobs.getScheduledJobs(snClient, scheduledJobs.getScheduledJobsSchema.parse(args));
        break;
      case 'sn_create_scheduled_job':
        result = await scheduledJobs.createScheduledJob(snClient, scheduledJobs.createScheduledJobSchema.parse(args));
        break;
      case 'sn_get_fix_scripts':
        result = await scheduledJobs.getFixScripts(snClient, scheduledJobs.getFixScriptsSchema.parse(args));
        break;
      case 'sn_create_fix_script':
        result = await scheduledJobs.createFixScript(snClient, scheduledJobs.createFixScriptSchema.parse(args));
        break;
      case 'sn_run_fix_script':
        result = await scheduledJobs.runFixScript(snClient, scheduledJobs.runFixScriptSchema.parse(args));
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: errorMessage }, null, 2) }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP ServiceNow server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

