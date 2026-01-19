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
import * as instanceAnalyzer from './tools/instance-analyzer.js';
import * as ootbOverrideDetector from './tools/ootb-override-detector.js';
import * as dependencyGraph from './tools/dependency-graph.js';
import * as antiPatternDetector from './tools/anti-pattern-detector.js';
import * as codeQualityAnalyzer from './tools/code-quality-analyzer.js';
import * as deadCodeFinder from './tools/dead-code-finder.js';
import * as changeImpactAnalyzer from './tools/change-impact-analyzer.js';
import * as conflictDetector from './tools/conflict-detector.js';
import * as guardrailValidator from './tools/guardrail-validator.js';
import * as breakingChangeDetector from './tools/breaking-change-detector.js';
import * as auditLogger from './tools/audit-logger.js';
import * as personaEngine from './tools/persona-engine.js';
import * as fourGFramework from './tools/four-g-framework.js';
import * as approvalGate from './tools/approval-gate.js';
import * as instanceRegistry from './tools/instance-registry.js';
import * as instanceCompare from './tools/instance-compare.js';
import * as upgradeReadiness from './tools/upgrade-readiness.js';
import * as conflictPredictor from './tools/conflict-predictor.js';
import * as ootbBaselineComparator from './tools/ootb-baseline-comparator.js';
import * as recommendationEngine from './tools/recommendation-engine.js';
import * as dashboardReporter from './tools/dashboard-reporter.js';
import * as multiInstanceManager from './tools/multi-instance-manager.js';
import * as promotionWorkflow from './tools/promotion-workflow.js';

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

// Brownfield Enhancement Tools - Deep Instance Intelligence
const BROWNFIELD_TOOLS: Tool[] = [
  {
    name: 'sn_analyze_instance',
    description: `COMPREHENSIVE ServiceNow instance analyzer covering 150+ artifact types across 40+ categories:

**CORE DEVELOPMENT:**
- Server Scripts: Business Rules, Script Includes, Fix Scripts, Script Actions, Processors, Scheduled Jobs, MID Server Script Includes, Script Validators
- Client Scripts: Client Scripts, UI Scripts, UI Macros, Catalog Client Scripts, Wizard Client Scripts
- UI: UI Policies, UI Actions, UI Pages, Form/List Layouts, Views, Formatters, Context Menus, Related Lists, Form Sections, Field Styles, UI Messages
- Flow Designer: Flows, Subflows, Flow Actions, Flow Triggers, Flow Inputs/Outputs
- Process Automation: Playbooks, Decision Tables, Document Task Types
- Integration Hub: Spokes, Connection Aliases, Connections, Credentials, Certificates
- Legacy Workflows: Workflows, Workflow Activities, Versions, Stages

**EVENTS & EMAIL:**
- Events: Event Registry, Script Actions, Scheduled Triggers
- Email: Notifications, Email Scripts, Email Templates, Inbound Actions, Email Layouts

**PORTALS & EXPERIENCES:**
- Service Portal: Widgets, Pages, Portals, Themes, Angular Providers, CSS/JS Includes, Headers/Footers
- Now Experience (UI Builder): UX Apps, Pages, Macroponents, Components, Themes, Data Brokers, UX Events
- Workspace (Agent Workspace): Configs, Form/List/Table Configs, Record Pages, Related Lists

**ANALYTICS & AI:**
- Analytics: Reports, PA Dashboards, Indicators (KPIs), Breakdowns, Scorecards, Widgets, Homepages
- Virtual Agent: Topics, Goals, NLU Models, Intents, Utterances
- AI/ML: ML Solutions, ML Capabilities, AI Search Configs, Search Sources, Agent Assist

**APPLICATIONS:**
- Service Catalog: Catalog Items, Categories, Record Producers, Variables, Variable Sets, Order Guides
- Knowledge: Articles, Knowledge Bases, Categories, Templates
- Employee Center: HR Portals, Case Types, Topics, Content Blocks
- Customer Service (CSM): Consumers, Case Types, CSM Cases
- CMDB: CI Types, Relationship Types, Identification Rules, Business Services
- GRC: Policies, Risks, Controls, Audits, Profiles
- Field Service: Work Orders, Agents, Territories
- APM: Business Applications, App Assessments

**INTEGRATION & DISCOVERY:**
- REST/SOAP: REST Messages, Scripted REST APIs, SOAP Messages
- Data Import: Transform Maps, Data Sources, Scheduled Imports
- Discovery: Schedules, Probes, Sensors, Patterns, MID Servers, Credentials
- Service Mapping: Patterns, Extensions, CI Associations

**CONFIGURATION:**
- Rules Engine: Assignment Rules, Approval Rules, Escalation Rules, Data Lookups, View Rules
- SLA Management: SLA Definitions, Condition Classes, Relative Durations, Service Offerings
- Navigation: Application Menus, Modules, Categories, Perspectives
- Localization: Field Labels, Translations, Choice Lists
- Guided Setup: Wizards, Panels, Content Groups
- Documents: Templates, Document Templates, Content Blocks, Embedded Help
- Assessments: Metric Types, Metrics, Categories, Survey Templates
- Metrics: Metric Definitions, System Metrics

**ADMIN & DEPLOYMENT:**
- Testing: ATF Tests, Test Suites, Test Steps
- Security: ACLs, Data Policies, Roles
- Properties: System Properties, Property Categories
- Deployment: Update Sets, Scoped Apps, Store Apps, Plugins
- Tables: Custom Tables, Dictionary Entries, Database Views, M2M Relationships
- Scheduled Jobs: All Types, Reports, PA Jobs, Table Cleaner Rules

Returns: Instance health score (0-100), artifact counts by type/category, custom vs OOTB-modified detection, and actionable recommendations.`,
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Application scope to analyze (default: all scopes)' },
        tables: { type: 'array', items: { type: 'string' }, description: 'Specific tables to analyze' },
        includeScripts: { type: 'boolean', default: true, description: 'Include script content in analysis' },
        includeInactive: { type: 'boolean', default: false, description: 'Include inactive artifacts' },
        limit: { type: 'number', default: 100, description: 'Max artifacts per category' },
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['all', 'server_scripts', 'client_scripts', 'ui', 'flow_designer', 'process_automation',
                   'integration_hub', 'legacy_workflows', 'events', 'email', 'service_portal',
                   'now_experience', 'workspace', 'analytics', 'virtual_agent', 'ai_ml',
                   'service_catalog', 'knowledge', 'employee_center', 'customer_service', 'cmdb',
                   'grc', 'field_service', 'apm', 'rest_soap', 'data_import', 'discovery', 'service_mapping',
                   'rules_engine', 'sla_management', 'navigation', 'localization', 'guided_setup',
                   'documents', 'assessments', 'metrics', 'scheduled_jobs', 'interceptors',
                   'testing', 'security', 'properties', 'deployment', 'tables']
          },
          default: ['all'],
          description: 'Categories of artifacts to analyze (default: all). 40+ categories covering 150+ artifact types.'
        }
      }
    }
  },
  {
    name: 'sn_detect_ootb_overrides',
    description: `Detects Out-of-the-Box (OOTB) artifacts that have been modified/customized in the instance.

**PURPOSE:**
- Identify all customer modifications to baseline ServiceNow artifacts
- Calculate upgrade risk score for the instance
- Track skipped updates from previous upgrades
- Provide recommendations for reducing technical debt

**KEY FEATURES:**
- Queries sys_update_xml (Customer Updates) table to find all OOTB modifications
- Classifies overrides by severity: CRITICAL, HIGH, MEDIUM, LOW
- Tracks "Replace on Upgrade" settings (protected vs unprotected items)
- Retrieves skipped updates from upgrade history
- Calculates overall upgrade risk score (0-100)

**SEVERITY CLASSIFICATION:**
- CRITICAL: Business Rules, Script Includes, ACLs, Dictionary entries on core tables (incident, task, etc.)
- HIGH: UI Policies, UI Actions, Client Scripts, Notifications on core tables
- MEDIUM: Form layouts, List layouts, Service Portal widgets, Properties
- LOW: Other customizations with minimal upgrade impact

**USE CASES:**
- Pre-upgrade planning and risk assessment
- Technical debt analysis
- Instance health assessment
- Compliance and governance audits
- Change management planning

Returns: Upgrade risk score, override counts by severity/type/table, skipped updates, and actionable recommendations.`,
    inputSchema: {
      type: 'object',
      properties: {
        artifactTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by artifact types (e.g., sys_script, sys_script_include). Default: all types'
        },
        tables: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by target tables (e.g., incident, change_request). Default: all tables'
        },
        includeSkippedUpdates: {
          type: 'boolean',
          default: true,
          description: 'Include skipped updates from upgrade history'
        },
        includeUpgradeRisk: {
          type: 'boolean',
          default: true,
          description: 'Calculate upgrade risk score'
        },
        scope: {
          type: 'string',
          description: 'Filter by application scope'
        },
        limit: {
          type: 'number',
          default: 500,
          description: 'Maximum number of overrides to return'
        },
        severity: {
          type: 'string',
          enum: ['all', 'critical', 'high', 'medium', 'low'],
          default: 'all',
          description: 'Filter by severity level'
        }
      }
    }
  },
  {
    name: 'sn_get_dependency_graph',
    description: `Builds a dependency graph showing relationships between ServiceNow artifacts.

**PURPOSE:**
- Map dependencies between scripts, tables, and configurations
- Understand impact radius before making changes
- Find orphaned/unused artifacts
- Identify highly connected "hub" artifacts
- Plan refactoring efforts

**DEPENDENCY TYPES DETECTED:**
- Script Include calls (new ClassName(), ClassName.method())
- GlideAjax calls (Client Script → Script Include)
- GlideRecord usage (Script → Table references)
- Class inheritance (Script Include extends another)
- Table triggers (Business Rule/Client Script on specific table)

**ARTIFACT TYPES ANALYZED:**
- Script Includes
- Business Rules
- Client Scripts
- UI Actions
- UI Policies
- Scheduled Jobs
- ACLs
- Notifications

**OUTPUT:**
- Nodes: All artifacts in the graph with type, name, scope
- Edges: Relationships between artifacts with dependency type
- Summary: Counts by type, orphaned artifacts, highly connected hubs
- Recommendations: Refactoring suggestions based on graph analysis

**USE CASES:**
- "What will be affected if I change this Script Include?"
- "Which artifacts use this table?"
- "Find all unused Script Includes"
- "Show me the most connected artifacts in this scope"`,
    inputSchema: {
      type: 'object',
      properties: {
        artifactType: {
          type: 'string',
          enum: ['script_include', 'business_rule', 'client_script', 'ui_action', 'ui_policy', 'scheduled_job', 'flow', 'acl', 'notification', 'all'],
          default: 'all',
          description: 'Type of artifact to analyze'
        },
        artifactName: {
          type: 'string',
          description: 'Specific artifact name to analyze (filters to artifacts matching this name)'
        },
        scope: {
          type: 'string',
          description: 'Filter by application scope'
        },
        direction: {
          type: 'string',
          enum: ['both', 'upstream', 'downstream'],
          default: 'both',
          description: 'Direction of dependencies to trace'
        },
        depth: {
          type: 'number',
          default: 2,
          description: 'How many levels deep to trace dependencies (1-5)'
        },
        includeTableDependencies: {
          type: 'boolean',
          default: true,
          description: 'Include table/GlideRecord dependencies'
        },
        limit: {
          type: 'number',
          default: 100,
          description: 'Maximum number of artifacts to analyze'
        }
      }
    }
  },
  {
    name: 'sn_find_anti_patterns',
    description: `Detects common anti-patterns and bad practices in ServiceNow code.

**PURPOSE:**
- Find performance issues before they impact users
- Identify security vulnerabilities in scripts
- Detect maintainability problems
- Ensure upgrade compatibility
- Improve code quality

**CATEGORIES:**
- **Performance**: current.update(), getXMLWait(), getRowCount(), global scripts, GlideRecord in ACLs
- **Security**: eval(), GlideRecord in client scripts, setBasicAuth(), undeclared variables
- **Maintainability**: hardcoded sys_ids, hardcoded URLs, debug statements, poor naming
- **Upgradability**: GlideRecord without new, unsupported APIs
- **User Experience**: alert(), confirm(), setWorkflow(false), missing isLoading

**ANTI-PATTERNS DETECTED (25+):**
- current.update() in business rules (causes infinite loops)
- Synchronous GlideAjax (getXMLWait)
- getRowCount() usage (performance killer)
- GlideRecord queries in ACLs
- eval() usage (security risk)
- GlideRecord in client scripts (bypasses ACLs)
- Hardcoded sys_ids and instance URLs
- Global business rules and client scripts
- Business rules without conditions
- Client-callable Script Includes without GlideRecordSecure
- And many more...

**OUTPUT:**
- Summary with health score (0-100)
- Issues grouped by severity (critical/high/medium/low)
- Counts by category and pattern type
- Actionable recommendations

**USE CASES:**
- "Find all critical anti-patterns in my scope"
- "Check for security issues in client scripts"
- "What performance problems exist in business rules?"`,
    inputSchema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['all', 'performance', 'security', 'maintainability', 'upgradability', 'user_experience']
          },
          default: ['all'],
          description: 'Categories of anti-patterns to detect'
        },
        scope: {
          type: 'string',
          description: 'Filter by application scope'
        },
        severity: {
          type: 'string',
          enum: ['all', 'critical', 'high', 'medium', 'low'],
          default: 'all',
          description: 'Minimum severity level to report'
        },
        artifactTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['all', 'business_rules', 'client_scripts', 'script_includes', 'ui_actions', 'scheduled_jobs', 'acls', 'notifications', 'rest_apis']
          },
          default: ['all'],
          description: 'Types of artifacts to scan'
        },
        limit: {
          type: 'number',
          default: 100,
          description: 'Maximum artifacts per type to scan'
        }
      }
    }
  },
  {
    name: 'sn_code_quality_score',
    description: `Analyzes ServiceNow script quality and provides metrics and recommendations.

**PURPOSE:**
- Calculate code quality scores for scripts
- Identify complexity, documentation, and maintainability issues
- Track quality trends over time
- Prioritize refactoring efforts

**METRICS ANALYZED:**
- **Complexity**: Cyclomatic complexity, nesting depth
- **Documentation**: Comment ratio, JSDoc presence
- **Best Practices**: Error handling, strict mode, constants
- **Code Style**: Function length, naming conventions
- **Maintainability**: Script size, modularization

**GRADING:**
- A (90-100): Excellent quality
- B (80-89): Good quality
- C (70-79): Fair quality
- D (60-69): Poor quality
- F (0-59): Needs attention

**OUTPUT:**
- Overall grade and average score
- Score distribution across artifacts
- Top issues with counts
- Category-specific scores
- Per-artifact details with metrics

**USE CASES:**
- "What's the overall code quality of my scope?"
- "Which scripts need the most attention?"
- "Show me all scripts with failing quality scores"`,
    inputSchema: {
      type: 'object',
      properties: {
        artifactType: {
          type: 'string',
          enum: ['all', 'script_include', 'business_rule', 'client_script', 'ui_action', 'ui_policy', 'scheduled_job', 'fix_script', 'flow_action'],
          default: 'all',
          description: 'Type of artifact to analyze'
        },
        artifactName: {
          type: 'string',
          description: 'Specific artifact name to analyze'
        },
        scope: {
          type: 'string',
          description: 'Filter by application scope'
        },
        includeDetails: {
          type: 'boolean',
          default: true,
          description: 'Include detailed metrics per artifact'
        },
        minScore: {
          type: 'number',
          description: 'Only return artifacts below this score (for finding problem scripts)'
        },
        limit: {
          type: 'number',
          default: 100,
          description: 'Maximum artifacts to analyze'
        }
      }
    }
  },
  {
    name: 'sn_find_dead_code',
    description: `Identifies unused, orphaned, or dead code in ServiceNow instances.

**PURPOSE:**
- Find Script Includes never referenced anywhere
- Identify artifacts with empty scripts
- Detect artifacts referencing non-existent tables
- Find stale inactive artifacts (2+ years old)
- Prioritize cleanup efforts

**DETECTION METHODS:**
- **Reference Checking**: Scans all scripts to find unreferenced Script Includes
- **Table Validation**: Verifies tables still exist for Business Rules/Client Scripts
- **Empty Script Detection**: Finds active artifacts with no actual code
- **Staleness Analysis**: Identifies long-inactive artifacts safe to remove

**CONFIDENCE LEVELS:**
- **High**: Confirmed dead (unreferenced, empty, or referencing deleted table)
- **Medium**: Likely dead (inactive but may have external references)
- **Low**: Possibly dead (needs manual verification)

**OUTPUT:**
- Summary with counts by type, reason, and confidence
- Estimated cleanup effort
- Sorted list of dead code candidates
- Actionable recommendations

**USE CASES:**
- "Find all unused Script Includes in my scope"
- "What dead code can I safely remove?"
- "How much cleanup do we need before the upgrade?"`,
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: 'Filter by application scope'
        },
        artifactTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['all', 'script_includes', 'business_rules', 'client_scripts', 'ui_actions', 'scheduled_jobs', 'workflows', 'notifications']
          },
          default: ['all'],
          description: 'Types of artifacts to check'
        },
        includeInactive: {
          type: 'boolean',
          default: true,
          description: 'Include inactive artifacts in the analysis'
        },
        checkReferences: {
          type: 'boolean',
          default: true,
          description: 'Check if Script Includes are referenced (slower but more accurate)'
        },
        limit: {
          type: 'number',
          default: 100,
          description: 'Maximum artifacts to analyze per type'
        }
      }
    }
  },
  {
    name: 'sn_preview_change_impact',
    description: `Previews the impact of proposed changes BEFORE they are made. Essential guardrail for brownfield instances.

**PURPOSE:**
- Analyze proposed script changes for performance, security, and upgrade risks
- Detect conflicts with existing Business Rules, Client Scripts, and other artifacts
- Identify dependencies that will be affected by the change
- Calculate overall risk score and determine if approval is required

**ANALYSIS TYPES:**
- **Performance Analysis**: Detects current.update(), getRowCount(), gs.sleep(), inefficient loops
- **Security Analysis**: Finds eval(), hardcoded credentials, dangerous patterns
- **Upgrade Risk**: Identifies deprecated APIs like jQuery, gel(), direct DOM access
- **Conflict Detection**: Checks for duplicate triggers, condition overlaps, order conflicts
- **Dependency Analysis**: Finds all artifacts that reference/depend on the target

**RISK SCORING:**
- Score 0-100 (higher = safer)
- Risk Levels: critical (<30), high (<50), medium (<70), low (70+)
- Automatic approval requirement for critical changes

**USE CASES:**
- "Before creating this Business Rule, show me potential conflicts"
- "What will break if I modify this Script Include?"
- "Is this script safe to deploy?"`,
    inputSchema: {
      type: 'object',
      properties: {
        changeType: {
          type: 'string',
          enum: ['create_business_rule', 'modify_business_rule', 'create_client_script', 'modify_client_script',
                 'create_script_include', 'modify_script_include', 'create_ui_action', 'modify_ui_action',
                 'modify_table', 'create_field', 'modify_field', 'delete_artifact'],
          description: 'Type of change being proposed'
        },
        targetTable: {
          type: 'string',
          description: 'Table the change affects (e.g., incident, task)'
        },
        targetArtifact: {
          type: 'string',
          description: 'sys_id or name of artifact being modified'
        },
        proposedScript: {
          type: 'string',
          description: 'The proposed script content to analyze'
        },
        proposedCondition: {
          type: 'string',
          description: 'Proposed condition/filter for the artifact'
        },
        proposedWhen: {
          type: 'string',
          enum: ['before', 'after', 'async', 'display'],
          description: 'When the script runs (for Business Rules)'
        },
        scope: {
          type: 'string',
          description: 'Application scope for the change'
        },
        includePerformanceAnalysis: {
          type: 'boolean',
          default: true,
          description: 'Analyze performance impact'
        },
        includeSecurityAnalysis: {
          type: 'boolean',
          default: true,
          description: 'Analyze security implications'
        },
        includeDependencyAnalysis: {
          type: 'boolean',
          default: true,
          description: 'Analyze dependency impacts'
        }
      },
      required: ['changeType']
    }
  },
  {
    name: 'sn_detect_conflicts',
    description: `Detects conflicts between ServiceNow artifacts on a table. Essential for brownfield instances with many customizations.

**PURPOSE:**
- Find Business Rules/Client Scripts with duplicate execution orders
- Detect artifacts with identical conditions (duplicate processing)
- Identify multiple scripts modifying the same field
- Calculate table-level health score

**CONFLICT TYPES:**
- **Order Conflicts**: Multiple artifacts with same order value (undefined sequence)
- **Condition Overlaps**: Identical conditions causing duplicate processing
- **Field Conflicts**: Multiple scripts modifying same field at same trigger time
- **Trigger Conflicts**: Competing triggers for same event

**USE CASES:**
- "Check incident table for conflicting Business Rules"
- "Find all order conflicts on the task table"
- "What Client Scripts have overlapping conditions?"`,
    inputSchema: {
      type: 'object',
      properties: {
        targetTable: {
          type: 'string',
          description: 'Table to check for conflicts (e.g., incident, task)'
        },
        artifactType: {
          type: 'string',
          enum: ['business_rule', 'client_script', 'ui_policy', 'ui_action', 'all'],
          default: 'all',
          description: 'Type of artifact to check'
        },
        scope: {
          type: 'string',
          description: 'Filter by application scope'
        },
        checkOrderConflicts: {
          type: 'boolean',
          default: true,
          description: 'Check for execution order issues'
        },
        checkConditionOverlaps: {
          type: 'boolean',
          default: true,
          description: 'Check for overlapping conditions'
        },
        checkFieldConflicts: {
          type: 'boolean',
          default: true,
          description: 'Check for conflicting field modifications'
        },
        limit: {
          type: 'number',
          default: 100,
          description: 'Maximum artifacts to analyze per type'
        }
      },
      required: ['targetTable']
    }
  },
  {
    name: 'sn_validate_change',
    description: `Validates proposed changes against configurable guardrails. Core governance tool for brownfield instances.

**PURPOSE:**
- Enforce coding standards before deployment
- Block dangerous patterns (eval, current.update, hardcoded credentials)
- Warn about performance anti-patterns
- Check naming conventions and best practices

**GUARDRAIL CATEGORIES:**
- **Performance**: current.update(), getRowCount(), gs.sleep(), GlideRecord loops
- **Security**: eval(), hardcoded credentials, setBasicAuth()
- **Naming**: PascalCase for Script Includes, table prefix for Business Rules
- **Best Practice**: Global scope warnings, try/catch recommendations
- **Compliance**: jQuery deprecation, synchronous AJAX blocking

**SEVERITY LEVELS:**
- **block**: Cannot proceed without exception approval
- **warn**: Should be addressed, requires justification
- **info**: Suggestions for improvement

**STRICT MODE:**
Enables additional rules: try/catch requirement, comment requirements, jQuery blocking, synchronous AJAX blocking

**USE CASES:**
- "Validate this Business Rule before I create it"
- "Check if this Script Include follows our standards"
- "Run strict validation on this client script"`,
    inputSchema: {
      type: 'object',
      properties: {
        changeType: {
          type: 'string',
          enum: ['business_rule', 'client_script', 'script_include', 'ui_action', 'ui_policy',
                 'scheduled_job', 'rest_api', 'table_modification', 'acl', 'notification'],
          description: 'Type of artifact being created/modified'
        },
        artifactName: {
          type: 'string',
          description: 'Name of the artifact'
        },
        targetTable: {
          type: 'string',
          description: 'Target table for the artifact'
        },
        script: {
          type: 'string',
          description: 'Script content to validate'
        },
        scope: {
          type: 'string',
          description: 'Application scope'
        },
        strictMode: {
          type: 'boolean',
          default: false,
          description: 'Enforce stricter guardrails'
        },
        customRules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              pattern: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string', enum: ['block', 'warn', 'info'] }
            }
          },
          description: 'Custom validation rules with regex patterns'
        }
      },
      required: ['changeType', 'artifactName']
    }
  },
  {
    name: 'sn_check_breaking_changes',
    description: `Detects breaking changes BEFORE modifying shared artifacts. Critical for brownfield instances.

**PURPOSE:**
- Find all artifacts that depend on a Script Include before modifying/deleting
- Detect Business Rules, Client Scripts, UI Actions that will break
- Identify table dependencies before schema changes
- Generate migration steps for safe changes

**CHANGE TYPES:**
- **delete**: Find all references that will break
- **rename**: Find all references needing updates
- **modify_signature**: Find callers affected by API changes
- **remove_method**: Find callers of the method being removed
- **deactivate**: Find dependencies on the deactivated artifact
- **change_field_type/remove_field**: Find scripts using the field

**OUTPUT:**
- List of affected artifacts with severity
- Safe to proceed indicator
- Migration steps for complex changes

**USE CASES:**
- "What breaks if I delete this Script Include?"
- "Find all callers before I change this API"
- "Is it safe to rename this table?"`,
    inputSchema: {
      type: 'object',
      properties: {
        artifactType: {
          type: 'string',
          enum: ['script_include', 'table', 'field', 'api', 'workflow', 'flow'],
          description: 'Type of artifact being modified'
        },
        artifactName: {
          type: 'string',
          description: 'Name or sys_id of the artifact'
        },
        proposedChange: {
          type: 'string',
          enum: ['delete', 'rename', 'modify_signature', 'change_return_type',
                 'add_required_param', 'remove_method', 'change_field_type', 'remove_field', 'deactivate'],
          description: 'Type of change being proposed'
        },
        newValue: {
          type: 'string',
          description: 'New name/value for rename operations'
        },
        scope: {
          type: 'string',
          description: 'Application scope to limit search'
        },
        checkDepth: {
          type: 'string',
          enum: ['shallow', 'deep'],
          default: 'shallow',
          description: 'Depth of dependency search'
        }
      },
      required: ['artifactType', 'artifactName', 'proposedChange']
    }
  },
  {
    name: 'sn_log_change',
    description: `Logs AI-assisted changes for compliance, audit trails, and rollback support.

**PURPOSE:**
- Create audit trail for all AI-assisted changes
- Support compliance requirements
- Enable rollback with generated scripts
- Track validation results with changes

**ACTIONS:**
- **create**: Artifact was created
- **update**: Artifact was modified
- **delete**: Artifact was removed
- **preview**: Change was previewed (not applied)
- **validate**: Change was validated
- **analyze**: Artifact was analyzed

**FEATURES:**
- Automatic rollback script generation
- Session-based change grouping
- Validation result tracking
- Before/after script capture

**USE CASES:**
- "Log that I created this Business Rule"
- "Track the validation results for this change"
- "Generate rollback script for this update"`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete', 'preview', 'validate', 'analyze'],
          description: 'Type of action performed'
        },
        artifactType: {
          type: 'string',
          description: 'Type of artifact (e.g., business_rule, script_include)'
        },
        artifactName: {
          type: 'string',
          description: 'Name of the artifact'
        },
        artifactSysId: {
          type: 'string',
          description: 'sys_id of the artifact'
        },
        targetTable: {
          type: 'string',
          description: 'Target table for the artifact'
        },
        changeDetails: {
          type: 'object',
          properties: {
            fieldChanged: { type: 'string' },
            oldValue: { type: 'string' },
            newValue: { type: 'string' },
            scriptBefore: { type: 'string' },
            scriptAfter: { type: 'string' }
          },
          description: 'Details of the change made'
        },
        validationResult: {
          type: 'object',
          properties: {
            riskScore: { type: 'number' },
            riskLevel: { type: 'string' },
            guardrailViolations: { type: 'number' },
            conflictsFound: { type: 'number' },
            approved: { type: 'boolean' }
          },
          description: 'Results from validation checks'
        },
        sessionId: {
          type: 'string',
          description: 'Session identifier for grouping changes'
        },
        userNotes: {
          type: 'string',
          description: 'User notes about the change'
        }
      },
      required: ['action', 'artifactType', 'artifactName']
    }
  },
  {
    name: 'sn_get_audit_history',
    description: `Retrieves audit history of AI-assisted changes.

**PURPOSE:**
- Review past changes made by AI assistant
- Track changes by session
- Filter by artifact or action type
- Support compliance audits

**USE CASES:**
- "Show all changes from this session"
- "What changes were made to this artifact?"
- "Show all create actions today"`,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Filter by session ID'
        },
        artifactName: {
          type: 'string',
          description: 'Filter by artifact name'
        },
        action: {
          type: 'string',
          description: 'Filter by action type'
        },
        limit: {
          type: 'number',
          default: 50,
          description: 'Maximum entries to return'
        }
      },
      required: []
    }
  },
  // Step 3: Persona & 4G Framework Tools
  {
    name: 'sn_detect_persona',
    description: `Detects and returns user persona with adaptive settings.

**PURPOSE:**
- Identify user skill level and role
- Configure guardrail strictness based on persona
- Adapt communication style and verbosity
- Enable persona-specific capabilities

**PERSONAS:**
- **junior_developer**: Beginner, needs guidance, strict guardrails
- **senior_developer**: Advanced, efficiency-focused, standard guardrails
- **architect**: Expert, strategic view, relaxed guardrails
- **admin**: Intermediate, configuration-focused
- **business_analyst**: Beginner, requirement-focused
- **qa_engineer**: Intermediate, testing-focused
- **project_manager**: Beginner, tracking-focused

**USE CASES:**
- "Set me up as a junior developer"
- "What guardrails apply to my role?"
- "Configure AI for architect mode"`,
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'ServiceNow user sys_id or username' },
        selfDeclared: {
          type: 'string',
          enum: ['junior_developer', 'senior_developer', 'architect', 'admin',
                 'business_analyst', 'qa_engineer', 'project_manager'],
          description: 'Self-declared persona'
        },
        context: {
          type: 'object',
          properties: {
            currentTask: { type: 'string' },
            artifactType: { type: 'string' },
            complexity: { type: 'string', enum: ['low', 'medium', 'high'] }
          },
          description: 'Current task context'
        }
      },
      required: []
    }
  },
  {
    name: 'sn_apply_4g_framework',
    description: `Applies the 4G Framework (Guardrails, Guidance, Governance, Growth) to a proposed action.

**THE 4G FRAMEWORK:**
- 🛡️ **GUARDRAILS**: Prevent bad practices (errors block, warnings flag)
- 🧭 **GUIDANCE**: Suggest better approaches (contextual tips)
- 📋 **GOVERNANCE**: Enforce approval workflows (role-based gates)
- 📈 **GROWTH**: Enable learning (skill-building recommendations)

**GUARDRAIL CATEGORIES:**
- code_quality, performance, security, upgrade_safety, naming

**GOVERNANCE LEVELS:**
- team_lead, admin, architect (based on persona + action)

**USE CASES:**
- "Check this Business Rule before I create it"
- "What approvals do I need as a junior dev?"
- "Run 4G checks on this script"`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create_business_rule', 'create_client_script', 'create_script_include',
                 'create_ui_action', 'modify_artifact', 'delete_artifact', 'create_acl', 'modify_table'],
          description: 'Action being performed'
        },
        artifactName: { type: 'string', description: 'Name of the artifact' },
        targetTable: { type: 'string', description: 'Target table' },
        script: { type: 'string', description: 'Script content' },
        persona: {
          type: 'string',
          enum: ['junior_developer', 'senior_developer', 'architect', 'admin'],
          default: 'senior_developer',
          description: 'User persona'
        },
        skipGuidance: { type: 'boolean', default: false, description: 'Skip guidance for experienced users' }
      },
      required: ['action', 'artifactName']
    }
  },
  {
    name: 'sn_request_approval',
    description: `Submits a change for approval based on governance rules.

**PURPOSE:**
- Submit changes requiring approval
- Track approval status
- Document justification and risk

**APPROVAL LEVELS:**
- **team_lead**: Junior dev script creation, deletions
- **admin**: ACL changes, workflow changes
- **architect**: Schema changes, integration changes
- **platform_owner**: Critical security changes

**USE CASES:**
- "Submit this ACL for admin approval"
- "Request architect sign-off on table change"`,
    inputSchema: {
      type: 'object',
      properties: {
        changeId: { type: 'string', description: 'Unique change identifier' },
        changeType: {
          type: 'string',
          enum: ['create_artifact', 'modify_artifact', 'delete_artifact',
                 'schema_change', 'acl_change', 'integration_change'],
          description: 'Type of change'
        },
        artifactType: { type: 'string', description: 'Artifact type' },
        artifactName: { type: 'string', description: 'Artifact name' },
        targetTable: { type: 'string', description: 'Target table' },
        requester: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            persona: { type: 'string' },
            name: { type: 'string' }
          },
          description: 'Requester info'
        },
        approvalLevel: {
          type: 'string',
          enum: ['team_lead', 'admin', 'architect', 'platform_owner'],
          description: 'Required approval level'
        },
        justification: { type: 'string', description: 'Reason for change' },
        riskAssessment: {
          type: 'object',
          properties: {
            riskScore: { type: 'number' },
            riskLevel: { type: 'string' },
            impacts: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['changeId', 'changeType', 'artifactType', 'artifactName', 'requester', 'approvalLevel']
    }
  },
  {
    name: 'sn_process_approval',
    description: `Processes an approval request (approve/reject/needs_revision).

**USE CASES:**
- "Approve change CHG001"
- "Reject with feedback"`,
    inputSchema: {
      type: 'object',
      properties: {
        changeId: { type: 'string', description: 'Change ID to process' },
        decision: {
          type: 'string',
          enum: ['approved', 'rejected', 'needs_revision'],
          description: 'Approval decision'
        },
        approver: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            role: { type: 'string' },
            name: { type: 'string' }
          },
          description: 'Approver info'
        },
        comments: { type: 'string', description: 'Comments' },
        conditions: { type: 'array', items: { type: 'string' }, description: 'Conditions for approval' }
      },
      required: ['changeId', 'decision', 'approver']
    }
  },
  {
    name: 'sn_get_approval_status',
    description: `Gets status of approval requests.

**USE CASES:**
- "Check status of my pending approvals"
- "Show all approved changes"`,
    inputSchema: {
      type: 'object',
      properties: {
        changeId: { type: 'string', description: 'Specific change ID' },
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'all'],
          default: 'pending',
          description: 'Filter by status'
        },
        limit: { type: 'number', default: 20, description: 'Max results' }
      },
      required: []
    }
  },
  // Step 4: Multi-Instance & Predictive Tools
  {
    name: 'sn_register_instance',
    description: `Registers a ServiceNow instance for multi-instance workflows.

**PURPOSE:**
- Manage multiple instances (Dev, Test, Prod)
- Enable cross-environment comparisons
- Support promotion workflows

**USE CASES:**
- "Register my dev instance"
- "Add production instance to registry"`,
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Unique identifier' },
        name: { type: 'string', description: 'Display name' },
        url: { type: 'string', description: 'Instance URL' },
        environment: { type: 'string', enum: ['dev', 'test', 'stage', 'prod'] },
        description: { type: 'string', description: 'Description' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['instanceId', 'name', 'url', 'environment']
    }
  },
  {
    name: 'sn_list_instances',
    description: `Lists registered ServiceNow instances.`,
    inputSchema: {
      type: 'object',
      properties: {
        environment: { type: 'string', enum: ['dev', 'test', 'stage', 'prod', 'all'], default: 'all' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: []
    }
  },
  {
    name: 'sn_compare_instances',
    description: `Compares artifacts between two instances.

**PURPOSE:**
- Identify differences between environments
- Plan promotions from Dev to Prod
- Detect drift between instances

**USE CASES:**
- "Compare dev and prod instances"
- "What's different between test and prod?"`,
    inputSchema: {
      type: 'object',
      properties: {
        sourceInstanceId: { type: 'string', description: 'Source instance' },
        targetInstanceId: { type: 'string', description: 'Target instance' },
        artifactTypes: {
          type: 'array',
          items: { type: 'string', enum: ['business_rule', 'client_script', 'script_include', 'ui_policy', 'ui_action', 'acl', 'workflow', 'flow'] }
        },
        scope: { type: 'string', description: 'Application scope' },
        includeOOTB: { type: 'boolean', default: false }
      },
      required: ['sourceInstanceId', 'targetInstanceId']
    }
  },
  {
    name: 'sn_assess_upgrade_readiness',
    description: `Analyzes instance for upgrade compatibility.

**PURPOSE:**
- Score upgrade readiness (0-100)
- Identify deprecated API usage
- Find OOTB overrides that may conflict
- Estimate remediation effort

**USE CASES:**
- "How ready are we for Xanadu upgrade?"
- "What risks exist for Vancouver upgrade?"`,
    inputSchema: {
      type: 'object',
      properties: {
        targetVersion: { type: 'string', description: 'Target version (e.g., Xanadu, Vancouver)' },
        scope: { type: 'string', description: 'Application scope' },
        includeRecommendations: { type: 'boolean', default: true }
      },
      required: []
    }
  },
  {
    name: 'sn_predict_conflicts',
    description: `Predicts potential conflicts before making changes.

**PURPOSE:**
- Identify order collisions before creating artifacts
- Detect condition overlaps
- Find script conflicts (multiple current.update)
- Recommend safe execution order

**USE CASES:**
- "Will this BR conflict with existing rules?"
- "What order should I use for this BR?"`,
    inputSchema: {
      type: 'object',
      properties: {
        changeType: {
          type: 'string',
          enum: ['create_business_rule', 'modify_business_rule', 'create_client_script', 'modify_client_script', 'create_acl', 'modify_acl', 'modify_field', 'add_field', 'create_workflow']
        },
        targetTable: { type: 'string', description: 'Target table' },
        artifactName: { type: 'string', description: 'Artifact name' },
        proposedChanges: {
          type: 'object',
          properties: {
            when: { type: 'string' },
            order: { type: 'number' },
            condition: { type: 'string' },
            script: { type: 'string' },
            fieldName: { type: 'string' }
          }
        },
        analyzeDepth: { type: 'string', enum: ['quick', 'standard', 'deep'], default: 'standard' }
      },
      required: ['changeType', 'targetTable']
    }
  },
  // OOTB Baseline Comparator - v5 Enhancement
  {
    name: 'sn_compare_to_ootb',
    description: `Compares your instance against a clean OOTB (Out-of-the-Box) baseline.

**PURPOSE:**
- Identify what's been customized vs what's standard ServiceNow
- Calculate your "customization footprint" score
- Assess upgrade readiness based on customizations
- Find technical debt from OOTB overrides

**RETURNS:**
- Customization Score (0-100, lower is better)
- Grade (A-F based on customization level)
- Upgrade Readiness (excellent/good/fair/poor/critical)
- Category breakdown (BRs, Scripts, ACLs, etc.)
- Top customizers and customized tables
- Prioritized recommendations

**USE CASES:**
- "How customized is my instance?"
- "What's been changed from OOTB?"
- "Is my instance safe to upgrade?"
- "Show me our customization footprint"
- "Compare my instance to clean baseline"`,
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['summary', 'detailed', 'export'],
          default: 'summary',
          description: 'Analysis mode'
        },
        artifactTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['business_rules', 'client_scripts', 'script_includes', 'ui_policies', 'ui_actions', 'acls', 'workflows', 'flows', 'notifications', 'scheduled_jobs', 'rest_apis', 'service_portal', 'tables', 'fields', 'all']
          },
          default: ['all'],
          description: 'Types of artifacts to compare'
        },
        scope: { type: 'string', description: 'Application scope' },
        includeSystemUpdates: { type: 'boolean', default: false },
        targetVersion: { type: 'string', description: 'Target ServiceNow version for baseline' },
        limit: { type: 'number', default: 500 },
        includeRecommendations: { type: 'boolean', default: true }
      },
      required: []
    }
  },
  // AI-Powered Recommendation Engine - v5 Enhancement
  {
    name: 'sn_get_fix_recommendations',
    description: `Get detailed fix recommendations for a specific issue type.

**PURPOSE:**
- Provides rich context for generating better fixes
- Explains why the issue matters and its impact
- Offers multiple fix patterns with before/after code
- Includes best practices and related issues

**ISSUE TYPES:**
- gr_in_client - GlideRecord in client scripts
- hardcoded_sysid - Hardcoded sys_ids
- missing_null_check - Missing null checks
- synchronous_ajax - Synchronous AJAX calls
- global_business_rule - Global business rules
- empty_catch - Empty catch blocks
- current_update_loop - current.update() in loops
- answer_true_acl - answer=true in ACLs
- And more...

**RETURNS:**
- Detailed explanation of the issue
- Multiple fix patterns with code examples
- Best practices
- Related issues to check
- Documentation links`,
    inputSchema: {
      type: 'object',
      properties: {
        issueType: {
          type: 'string',
          enum: ['gr_in_client', 'hardcoded_sysid', 'missing_null_check', 'synchronous_ajax', 'global_business_rule', 'empty_catch', 'current_update_loop', 'no_setworkflow', 'eval_usage', 'document_write', 'innerhtml_usage', 'no_try_catch', 'gs_log_production', 'answer_true_acl', 'no_condition_business_rule', 'select_star', 'missing_index', 'excessive_queries', 'deprecated_api'],
          description: 'The type of issue to get recommendations for'
        },
        code: { type: 'string', description: 'The problematic code snippet' },
        context: {
          type: 'object',
          properties: {
            table: { type: 'string' },
            artifactType: { type: 'string' },
            artifactName: { type: 'string' }
          }
        }
      },
      required: ['issueType']
    }
  },
  {
    name: 'sn_get_best_practices',
    description: `Get comprehensive best practices for a ServiceNow artifact type.

**PURPOSE:**
- Provides do's and don'ts for creating/modifying artifacts
- Includes security and performance considerations
- Offers code templates as starting points
- Lists common mistakes to avoid

**ARTIFACT TYPES:**
- business_rule, client_script, script_include
- ui_policy, ui_action, acl
- scheduled_job, flow, rest_api
- transform_map, catalog_client_script, fix_script

**ACTIONS:**
- create - When building new artifacts
- modify - When changing existing code
- review - When auditing code quality
- optimize - When improving performance
- secure - When hardening security
- debug - When troubleshooting issues`,
    inputSchema: {
      type: 'object',
      properties: {
        artifactType: {
          type: 'string',
          enum: ['business_rule', 'client_script', 'script_include', 'ui_policy', 'ui_action', 'acl', 'scheduled_job', 'flow', 'rest_api', 'transform_map', 'catalog_client_script', 'fix_script'],
          description: 'The type of artifact'
        },
        action: {
          type: 'string',
          enum: ['create', 'modify', 'review', 'optimize', 'secure', 'debug'],
          default: 'create',
          description: 'What action you are taking'
        }
      },
      required: ['artifactType']
    }
  },
  {
    name: 'sn_get_code_templates',
    description: `Get code templates for common ServiceNow patterns.

**PURPOSE:**
- Provides ready-to-use code templates
- Ensures consistent patterns across codebase
- Includes error handling and best practices
- Shows variable placeholders to fill in

**PATTERNS:**
- gliderecord_query, gliderecord_insert, gliderecord_update
- glideajax_call, rest_message
- script_include_class
- business_rule_before, business_rule_after, business_rule_async
- client_script_onload, client_script_onchange, client_script_onsubmit
- acl_script, scheduled_job
- error_handling, null_check, logging, transaction_cancel`,
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          enum: ['gliderecord_query', 'gliderecord_insert', 'gliderecord_update', 'glideajax_call', 'rest_message', 'script_include_class', 'business_rule_before', 'business_rule_after', 'business_rule_async', 'client_script_onload', 'client_script_onchange', 'client_script_onsubmit', 'acl_script', 'scheduled_job', 'error_handling', 'null_check', 'logging', 'transaction_cancel'],
          description: 'The code pattern to get a template for'
        },
        options: {
          type: 'object',
          properties: {
            table: { type: 'string' },
            includeComments: { type: 'boolean', default: true },
            includeErrorHandling: { type: 'boolean', default: true }
          }
        }
      },
      required: ['pattern']
    }
  },
  // Dashboard & Reports - v5 Enhancement
  {
    name: 'sn_generate_report',
    description: `Generate comprehensive HTML/JSON/Markdown reports for stakeholder sharing.

**REPORT TYPES:**
- instance_health - Overall instance health with metrics and recommendations
- code_quality - Code quality analysis across all artifacts
- upgrade_readiness - Readiness assessment for upgrades
- security_audit - Security-focused analysis
- customization_summary - Summary of all customizations
- executive_summary - High-level KPIs for leadership

**FORMATS:**
- html - Beautiful, printable HTML with charts (default)
- json - Structured data for integration
- markdown - Plain text for documentation

**FEATURES:**
- Visual metrics and grades
- Customization breakdown tables
- Prioritized recommendations
- Print-friendly styling`,
    inputSchema: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          enum: ['instance_health', 'code_quality', 'upgrade_readiness', 'security_audit', 'customization_summary', 'executive_summary'],
          description: 'Type of report to generate'
        },
        format: { type: 'string', enum: ['html', 'json', 'markdown'], default: 'html' },
        includeCharts: { type: 'boolean', default: true },
        includeRecommendations: { type: 'boolean', default: true },
        scope: { type: 'string', description: 'Limit to specific application scope' }
      },
      required: ['reportType']
    }
  },
  {
    name: 'sn_get_dashboard_data',
    description: `Get real-time dashboard metrics for monitoring instance health.

**METRICS:**
- health_score - Overall instance health (0-100)
- code_quality_score - Code quality rating
- customization_count - Total customizations
- anti_pattern_count - Detected anti-patterns
- dead_code_count - Inactive/unused artifacts
- upgrade_readiness - Upgrade readiness status
- security_issues - Security issue count
- ootb_overrides - OOTB override count

**USE FOR:**
- Building custom dashboards
- CI/CD quality gates
- Monitoring trends
- Alerting on thresholds`,
    inputSchema: {
      type: 'object',
      properties: {
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['health_score', 'code_quality_score', 'customization_count', 'anti_pattern_count', 'dead_code_count', 'upgrade_readiness', 'security_issues', 'ootb_overrides']
          },
          default: ['health_score', 'code_quality_score', 'customization_count']
        },
        scope: { type: 'string', description: 'Limit to specific application scope' }
      },
      required: []
    }
  },
  // Multi-Instance Manager - v6 Enhancement
  {
    name: 'sn_register_instance_v2',
    description: `Register a ServiceNow instance for multi-instance operations.

**FEATURES:**
- Stores credentials securely in memory
- Tests connection on registration
- Supports dev/test/stage/prod environments
- First registered instance becomes active automatically

**USE FOR:**
- Setting up multi-environment workflows
- Comparing artifacts across instances
- Promoting changes from dev to prod`,
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Unique identifier (e.g., dev1, prod)' },
        name: { type: 'string', description: 'Display name' },
        url: { type: 'string', description: 'Instance URL (e.g., https://dev12345.service-now.com)' },
        environment: { type: 'string', enum: ['dev', 'test', 'stage', 'prod'] },
        username: { type: 'string', description: 'Username for authentication' },
        password: { type: 'string', description: 'Password for authentication' }
      },
      required: ['instanceId', 'name', 'url', 'environment', 'username', 'password']
    }
  },
  {
    name: 'sn_switch_instance',
    description: `Switch the active ServiceNow instance.

**BEHAVIOR:**
- Switches all subsequent operations to the specified instance
- Tests connection on switch
- Reports previous and new active instance

**EXAMPLE:**
"Switch to prod instance" → sn_switch_instance({ instanceId: "prod" })`,
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID to switch to' }
      },
      required: ['instanceId']
    }
  },
  {
    name: 'sn_get_active_instance',
    description: `Get the currently active instance and list all registered instances.

**RETURNS:**
- Active instance details (name, URL, environment)
- List of all registered instances
- Connection status`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'sn_test_instance_connection',
    description: `Test connection to a registered instance.

**RETURNS:**
- Connection success/failure
- Response time in milliseconds
- Instance URL and version info`,
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID to test' }
      },
      required: ['instanceId']
    }
  },
  {
    name: 'sn_diff_artifact',
    description: `Compare a specific artifact between two instances.

**FEATURES:**
- Finds artifact by name in both instances
- Compares script content
- Shows which instance has the artifact
- Highlights differences

**STATUS RESULTS:**
- identical - Same in both instances
- modified - Different script content
- source_only - Only exists in source instance
- target_only - Only exists in target instance
- not_found - Doesn't exist in either instance

**EXAMPLE:**
"Compare MyBusinessRule between dev and prod"`,
    inputSchema: {
      type: 'object',
      properties: {
        sourceInstanceId: { type: 'string', description: 'Source instance ID' },
        targetInstanceId: { type: 'string', description: 'Target instance ID' },
        artifactType: {
          type: 'string',
          enum: ['business_rule', 'client_script', 'script_include', 'ui_policy', 'ui_action', 'acl'],
          description: 'Type of artifact'
        },
        artifactName: { type: 'string', description: 'Name of the artifact to compare' }
      },
      required: ['sourceInstanceId', 'targetInstanceId', 'artifactType', 'artifactName']
    }
  },
  // Promotion Workflow - v6 Enhancement
  {
    name: 'sn_create_promotion_package',
    description: `Create a promotion package with artifacts to move between instances.

**WORKFLOW:**
1. Create package with artifacts from source
2. Preview changes on target
3. Validate for conflicts
4. Execute promotion (with backup)
5. Rollback if needed

**EXAMPLE:**
"Create a package with MyBusinessRule and MyScriptInclude from dev"`,
    inputSchema: {
      type: 'object',
      properties: {
        packageName: { type: 'string', description: 'Name for this promotion package' },
        sourceInstanceId: { type: 'string', description: 'Source instance ID' },
        artifacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['business_rule', 'client_script', 'script_include', 'ui_policy', 'ui_action', 'acl', 'ui_page', 'ui_macro'] },
              name: { type: 'string' },
              sysId: { type: 'string' }
            },
            required: ['type', 'name']
          }
        },
        description: { type: 'string' }
      },
      required: ['packageName', 'sourceInstanceId', 'artifacts']
    }
  },
  {
    name: 'sn_preview_promotion',
    description: `Preview what changes would be made on target instance.

**SHOWS:**
- Artifacts to CREATE (new on target)
- Artifacts to UPDATE (different content)
- Artifacts UNCHANGED (identical)`,
    inputSchema: {
      type: 'object',
      properties: {
        packageId: { type: 'string', description: 'Promotion package ID' },
        targetInstanceId: { type: 'string', description: 'Target instance to preview against' }
      },
      required: ['packageId', 'targetInstanceId']
    }
  },
  {
    name: 'sn_validate_promotion',
    description: `Validate promotion package for conflicts and dependencies.

**CHECKS:**
- Conflicts: Target modified after source
- Dependencies: Missing script includes
- Breaking changes: Removed functions

**RECOMMENDATIONS:**
- Safe to promote or issues to address`,
    inputSchema: {
      type: 'object',
      properties: {
        packageId: { type: 'string', description: 'Promotion package ID' },
        targetInstanceId: { type: 'string', description: 'Target instance' },
        checkConflicts: { type: 'boolean', default: true },
        checkDependencies: { type: 'boolean', default: true },
        checkBreakingChanges: { type: 'boolean', default: true }
      },
      required: ['packageId', 'targetInstanceId']
    }
  },
  {
    name: 'sn_execute_promotion',
    description: `Execute the promotion to apply changes to target instance.

**FEATURES:**
- Creates backup before overwriting
- Dry-run mode for preview
- Tracks what was created/updated/skipped

**SAFETY:**
- Always use dryRun=true first
- Backups enable rollback`,
    inputSchema: {
      type: 'object',
      properties: {
        packageId: { type: 'string', description: 'Promotion package ID' },
        targetInstanceId: { type: 'string', description: 'Target instance' },
        createBackup: { type: 'boolean', default: true },
        dryRun: { type: 'boolean', default: true, description: 'Preview only, do not apply' }
      },
      required: ['packageId', 'targetInstanceId']
    }
  },
  {
    name: 'sn_rollback_promotion',
    description: `Rollback a promotion to restore previous state.

**RESTORES:**
- All backed-up artifacts to their previous state
- Only works if backup was created during promotion`,
    inputSchema: {
      type: 'object',
      properties: {
        promotionId: { type: 'string', description: 'Promotion ID to rollback' }
      },
      required: ['promotionId']
    }
  },
  {
    name: 'sn_list_promotion_history',
    description: `List history of promotions.

**FILTERS:**
- all, pending, completed, failed, rolled_back`,
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 },
        status: { type: 'string', enum: ['all', 'pending', 'completed', 'failed', 'rolled_back'], default: 'all' }
      },
      required: []
    }
  },
  {
    name: 'sn_list_promotion_packages',
    description: `List all created promotion packages.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

const ALL_TOOLS = [...TOOLS, ...MORE_TOOLS, ...ADDITIONAL_TOOLS, ...BROWNFIELD_TOOLS];

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

      // Brownfield Enhancement Tools
      case 'sn_analyze_instance':
        result = await instanceAnalyzer.analyzeInstance(snClient, instanceAnalyzer.analyzeInstanceSchema.parse(args));
        break;

      case 'sn_detect_ootb_overrides':
        result = await ootbOverrideDetector.detectOotbOverrides(snClient, ootbOverrideDetector.detectOotbOverridesSchema.parse(args));
        break;

      case 'sn_get_dependency_graph':
        result = await dependencyGraph.getDependencyGraph(snClient, dependencyGraph.getDependencyGraphSchema.parse(args));
        break;

      case 'sn_find_anti_patterns':
        result = await antiPatternDetector.findAntiPatterns(snClient, antiPatternDetector.findAntiPatternsSchema.parse(args));
        break;

      case 'sn_code_quality_score':
        result = await codeQualityAnalyzer.getCodeQualityScore(snClient, codeQualityAnalyzer.codeQualityScoreSchema.parse(args));
        break;

      case 'sn_find_dead_code':
        result = await deadCodeFinder.findDeadCode(snClient, deadCodeFinder.findDeadCodeSchema.parse(args));
        break;

      // Step 2: Guardrails & Impact Analysis
      case 'sn_preview_change_impact':
        result = await changeImpactAnalyzer.previewChangeImpact(snClient, changeImpactAnalyzer.previewChangeImpactSchema.parse(args));
        break;

      case 'sn_detect_conflicts':
        result = await conflictDetector.detectConflicts(snClient, conflictDetector.detectConflictsSchema.parse(args));
        break;

      case 'sn_validate_change':
        result = await guardrailValidator.validateChange(snClient, guardrailValidator.validateChangeSchema.parse(args));
        break;

      case 'sn_check_breaking_changes':
        result = await breakingChangeDetector.checkBreakingChanges(snClient, breakingChangeDetector.checkBreakingChangesSchema.parse(args));
        break;

      case 'sn_log_change':
        result = await auditLogger.logChange(snClient, auditLogger.logChangeSchema.parse(args));
        break;

      case 'sn_get_audit_history':
        result = await auditLogger.getAuditHistory(snClient, auditLogger.getAuditHistorySchema.parse(args));
        break;

      // Step 3: Persona & 4G Framework
      case 'sn_detect_persona':
        result = await personaEngine.detectPersona(snClient, personaEngine.detectPersonaSchema.parse(args));
        break;

      case 'sn_apply_4g_framework':
        result = await fourGFramework.apply4GFramework(snClient, fourGFramework.apply4GFrameworkSchema.parse(args));
        break;

      case 'sn_request_approval':
        result = await approvalGate.requestApproval(snClient, approvalGate.requestApprovalSchema.parse(args));
        break;

      case 'sn_process_approval':
        result = await approvalGate.processApproval(snClient, approvalGate.processApprovalSchema.parse(args));
        break;

      case 'sn_get_approval_status':
        result = await approvalGate.getApprovalStatus(snClient, approvalGate.getApprovalStatusSchema.parse(args));
        break;

      // Step 4: Multi-Instance & Predictive
      case 'sn_register_instance':
        result = await instanceRegistry.registerInstance(snClient, instanceRegistry.registerInstanceSchema.parse(args));
        break;

      case 'sn_list_instances':
        result = await instanceRegistry.listInstances(snClient, instanceRegistry.listInstancesSchema.parse(args));
        break;

      case 'sn_compare_instances':
        result = await instanceCompare.compareInstances(snClient, instanceCompare.compareInstancesSchema.parse(args));
        break;

      case 'sn_assess_upgrade_readiness':
        result = await upgradeReadiness.assessUpgradeReadiness(snClient, upgradeReadiness.assessUpgradeReadinessSchema.parse(args));
        break;

      case 'sn_predict_conflicts':
        result = await conflictPredictor.predictConflicts(snClient, conflictPredictor.predictConflictsSchema.parse(args));
        break;

      case 'sn_compare_to_ootb':
        result = await ootbBaselineComparator.compareToOotb(snClient, ootbBaselineComparator.compareToOotbSchema.parse(args));
        break;

      // AI-Powered Recommendation Engine
      case 'sn_get_fix_recommendations':
        result = await recommendationEngine.getFixRecommendations(snClient, recommendationEngine.getFixRecommendationsSchema.parse(args));
        break;

      case 'sn_get_best_practices':
        result = await recommendationEngine.getBestPractices(snClient, recommendationEngine.getBestPracticesSchema.parse(args));
        break;

      case 'sn_get_code_templates':
        result = await recommendationEngine.getCodeTemplates(snClient, recommendationEngine.getCodeTemplatesSchema.parse(args));
        break;

      // Dashboard & Reports
      case 'sn_generate_report':
        result = await dashboardReporter.generateReport(snClient, dashboardReporter.generateReportSchema.parse(args));
        break;

      case 'sn_get_dashboard_data':
        result = await dashboardReporter.getDashboardData(snClient, dashboardReporter.getDashboardDataSchema.parse(args));
        break;

      // Multi-Instance Manager - v6 Enhancement
      case 'sn_register_instance_v2':
        result = await multiInstanceManager.registerInstanceEnhanced(snClient, args as {
          instanceId: string;
          name: string;
          url: string;
          environment: 'dev' | 'test' | 'stage' | 'prod';
          username: string;
          password: string;
        });
        break;

      case 'sn_switch_instance':
        result = await multiInstanceManager.switchInstance(snClient, multiInstanceManager.switchInstanceSchema.parse(args));
        break;

      case 'sn_get_active_instance':
        result = await multiInstanceManager.getActiveInstance(snClient, {});
        break;

      case 'sn_test_instance_connection':
        result = await multiInstanceManager.testInstanceConnection(snClient, multiInstanceManager.testInstanceConnectionSchema.parse(args));
        break;

      case 'sn_diff_artifact':
        result = await multiInstanceManager.diffArtifact(snClient, multiInstanceManager.diffArtifactSchema.parse(args));
        break;

      // Promotion Workflow - v6 Enhancement
      case 'sn_create_promotion_package':
        result = await promotionWorkflow.createPromotionPackage(snClient, promotionWorkflow.createPromotionPackageSchema.parse(args));
        break;

      case 'sn_preview_promotion':
        result = await promotionWorkflow.previewPromotion(snClient, promotionWorkflow.previewPromotionSchema.parse(args));
        break;

      case 'sn_validate_promotion':
        result = await promotionWorkflow.validatePromotion(snClient, promotionWorkflow.validatePromotionSchema.parse(args));
        break;

      case 'sn_execute_promotion':
        result = await promotionWorkflow.executePromotion(snClient, promotionWorkflow.executePromotionSchema.parse(args));
        break;

      case 'sn_rollback_promotion':
        result = await promotionWorkflow.rollbackPromotion(snClient, promotionWorkflow.rollbackPromotionSchema.parse(args));
        break;

      case 'sn_list_promotion_history':
        result = await promotionWorkflow.listPromotionHistory(snClient, promotionWorkflow.listPromotionHistorySchema.parse(args));
        break;

      case 'sn_list_promotion_packages':
        result = await promotionWorkflow.listPromotionPackages(snClient, {});
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

