/**
 * Tool Definitions - All ServiceNow tool schemas.
 * Single source of truth for both MCP server and web app.
 *
 * MCP format uses 'inputSchema', Anthropic format uses 'input_schema'.
 * Use getAnthropicToolDefinitions() for Anthropic API format.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOLS: ToolDefinition[] = [
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
    name: 'sn_initialize_instance',
    description: 'Initialize a ServiceNow instance with required helper APIs. Call this when connecting to a new instance to auto-deploy helper APIs (e.g., UIPolicyActionHelper, UpdateSetHelper) that work around platform limitations.',
    inputSchema: {
      type: 'object',
      properties: {
        deployMissingApis: {
          type: 'boolean',
          description: 'Deploy missing helper APIs to the instance (default: true)',
          default: true
        }
      }
    }
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
export const MORE_TOOLS: ToolDefinition[] = [
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
    description: 'Create a new update set. Checks for duplicate names first — if a duplicate exists, returns existing matches and options (force, autoTimestamp, or rename). Use the "application" field to target a specific scope.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the update set' },
        description: { type: 'string', description: 'Description of the update set' },
        application: { type: 'string', description: 'Scope sys_id (sys_scope.sys_id) to create the update set in a specific application scope. Omit for Global scope.' },
        parent: { type: 'string', description: 'Parent update set sys_id (for batch update sets)' },
        force: { type: 'boolean', default: false, description: 'If true, skip duplicate name check and create anyway' },
        autoTimestamp: { type: 'boolean', default: false, description: 'If true and a duplicate exists, auto-append a timestamp to the name' }
      },
      required: ['name']
    }
  },
  {
    name: 'sn_set_current_update_set',
    description: 'Set an update set as the current update set for capturing changes. The update set must exist and be in "in progress" state.',
    inputSchema: {
      type: 'object',
      properties: { sys_id: { type: 'string', description: 'The sys_id of the update set to set as current' } },
      required: ['sys_id']
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
  },
  {
    name: 'sn_move_to_update_set',
    description: 'Move a record\'s sys_update_xml entry to a specific update set. Use this to fix artifacts that landed in the wrong update set (e.g., Default instead of the target). This is the manual fallback for automatic update set capture.',
    inputSchema: {
      type: 'object',
      properties: {
        update_set_id: { type: 'string', description: 'The sys_id of the target update set' },
        table: { type: 'string', description: 'The table name of the artifact (e.g., "sys_script", "sys_script_include", "sys_script_client")' },
        sys_id: { type: 'string', description: 'The sys_id of the record to move to the update set' }
      },
      required: ['update_set_id', 'table', 'sys_id']
    }
  }
];

// Additional tools for UI, Notifications, ACLs, Catalog, and Scheduled Jobs
export const ADDITIONAL_TOOLS: ToolDefinition[] = [
  // UI Policies
  { name: 'sn_get_ui_policies', description: 'Get UI policies for a table', inputSchema: { type: 'object', properties: { table: { type: 'string' }, activeOnly: { type: 'boolean', default: true } }, required: ['table'] } },
  { name: 'sn_create_ui_policy', description: 'Create a new UI policy', inputSchema: { type: 'object', properties: { name: { type: 'string' }, table: { type: 'string' }, conditions: { type: 'string' }, scriptTrue: { type: 'string' }, scriptFalse: { type: 'string' }, onLoad: { type: 'boolean', default: true }, active: { type: 'boolean', default: true } }, required: ['name', 'table'] } },
  // UI Policy Actions (field behaviors when policy triggers)
  { name: 'sn_get_ui_policy_actions', description: 'Get UI policy actions for a UI policy. UI Policy Actions define field behaviors (mandatory, visible, disabled) when the policy triggers.', inputSchema: { type: 'object', properties: { uiPolicySysId: { type: 'string', description: 'sys_id of the UI Policy' }, limit: { type: 'number', default: 50 } }, required: ['uiPolicySysId'] } },
  { name: 'sn_create_ui_policy_action', description: 'Create a UI policy action to define field behavior when policy triggers. Use this AFTER creating a UI Policy to set fields as mandatory, visible, or disabled.', inputSchema: { type: 'object', properties: { uiPolicySysId: { type: 'string', description: 'sys_id of the parent UI Policy' }, field: { type: 'string', description: 'Field name to apply action to' }, mandatory: { type: 'string', enum: ['true', 'false', 'ignore'], default: 'ignore', description: 'Make field mandatory' }, visible: { type: 'string', enum: ['true', 'false', 'ignore'], default: 'ignore', description: 'Make field visible' }, disabled: { type: 'string', enum: ['true', 'false', 'ignore'], default: 'ignore', description: 'Make field read-only/disabled' }, value: { type: 'string', description: 'Set field value (optional)' } }, required: ['uiPolicySysId', 'field'] } },
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
export const BROWNFIELD_TOOLS: ToolDefinition[] = [
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

// Flow Designer Tools
export const FLOW_DESIGNER_TOOLS: ToolDefinition[] = [
  {
    name: 'sn_list_flows',
    description: 'List Flow Designer flows on the instance. Returns flow name, status (draft/published), internal_name, and table.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'published', 'all'], description: 'Filter by flow status' },
        limit: { type: 'number', description: 'Max results to return (default 20)' }
      },
      required: []
    }
  },
  {
    name: 'sn_get_flow',
    description: 'Get details of a specific Flow Designer flow by sys_id, including snapshot references.',
    inputSchema: {
      type: 'object',
      properties: {
        sys_id: { type: 'string', description: 'The sys_id of the flow' }
      },
      required: ['sys_id']
    }
  },
  {
    name: 'sn_create_flow',
    description: 'Create a new Flow Designer flow (as draft). The flow must be activated in the Flow Designer UI to generate required snapshots. Use this to scaffold a flow, then instruct the user to open Flow Designer to configure and activate it.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name of the flow' },
        internal_name: { type: 'string', description: 'Internal/programmatic name (auto-generated from name if omitted)' },
        description: { type: 'string', description: 'Description of the flow' },
        application: { type: 'string', description: 'Scope sys_id. Omit for Global scope.' },
        table: { type: 'string', description: 'Table the flow operates on (e.g. sc_req_item)' }
      },
      required: ['name']
    }
  },
  {
    name: 'sn_create_flow_trigger',
    description: 'Create a trigger instance on a flow. Requires the trigger_definition sys_id (e.g. Service Catalog trigger). Configure conditions in Flow Designer UI after creation.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'sys_id of the parent flow' },
        trigger_definition: { type: 'string', description: 'sys_id of the trigger type definition' },
        trigger_type: { type: 'string', description: 'Trigger type string (e.g. "SERVICE_CATALOG")' },
        conditions: { type: 'string', description: 'Encoded trigger conditions' }
      },
      required: ['flow', 'trigger_definition']
    }
  },
  {
    name: 'sn_list_flow_action_instances',
    description: 'List action instances (steps) within a flow.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'sys_id of the parent flow' },
        limit: { type: 'number', description: 'Max results (default 50)' }
      },
      required: ['flow']
    }
  },
  {
    name: 'sn_create_flow_action_instance',
    description: 'Create an action instance (step) in a flow. Use the action_type snapshot sys_id (not definition ID). Common snapshot IDs: Create Catalog Task = af51fd0e73141300612c273ffff6a785, Log = 5bc1bcc6531003003bf1d9109ec587d4.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'sys_id of the parent flow' },
        action_type: { type: 'string', description: 'Snapshot sys_id of the action type' },
        order: { type: 'number', description: 'Position in the flow' },
        stage: { type: 'string', description: 'sys_id of the flow stage this action belongs to' },
        name: { type: 'string', description: 'Display name for this action step' }
      },
      required: ['flow', 'action_type']
    }
  },
  {
    name: 'sn_list_flow_stages',
    description: 'List stages within a flow.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'sys_id of the parent flow' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['flow']
    }
  },
  {
    name: 'sn_create_flow_stage',
    description: 'Create a stage in a flow. Stages group action instances.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'sys_id of the parent flow' },
        label: { type: 'string', description: 'Display label for the stage' },
        order: { type: 'number', description: 'Position of this stage in the flow' }
      },
      required: ['flow', 'label']
    }
  },
  // ============ PHASE 1: DISCOVERY TOOLS ============
  {
    name: 'sn_list_action_types',
    description: 'List available Flow Designer action types (Lookup Record, Create Task, Update Record, etc.) with their snapshot IDs. IMPORTANT: Use the returned snapshot_sys_id (not definition_sys_id) when calling sn_create_flow_action_instance.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category (e.g., "Core", "Service Catalog")' },
        search: { type: 'string', description: 'Search by name, label, or internal_name' },
        scope: { type: 'string', description: 'Filter by scope (e.g., "global")' },
        limit: { type: 'number', description: 'Maximum results to return (default 50)' }
      },
      required: []
    }
  },
  {
    name: 'sn_list_trigger_definitions',
    description: 'List available Flow Designer trigger definitions (Record-based, Schedule, Service Catalog, Inbound Email, etc.). Use the returned sys_id as trigger_definition in sn_create_flow_trigger.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter by trigger type (e.g., "record", "schedule", "service_catalog")' },
        search: { type: 'string', description: 'Search by name or label' },
        limit: { type: 'number', description: 'Maximum results to return (default 30)' }
      },
      required: []
    }
  },
  {
    name: 'sn_get_action_type_schema',
    description: 'Get the input/output schema for a specific action type. Shows what parameters the action expects and what outputs it produces. Useful for understanding how to configure action inputs.',
    inputSchema: {
      type: 'object',
      properties: {
        sys_id: { type: 'string', description: 'The sys_id of the action type definition or snapshot' }
      },
      required: ['sys_id']
    }
  },
  {
    name: 'sn_analyze_flow',
    description: 'Analyze a flow\'s complete structure including triggers, actions, stages, and variables. Returns detailed breakdown of all components. Useful for understanding existing flows, debugging, or creating similar flows.',
    inputSchema: {
      type: 'object',
      properties: {
        sys_id: { type: 'string', description: 'The sys_id of the flow to analyze' },
        include_action_inputs: { type: 'boolean', description: 'Include action input configurations (default false)' },
        include_conditions: { type: 'boolean', description: 'Include trigger and flow logic conditions (default false)' }
      },
      required: ['sys_id']
    }
  },
  // ============ PHASE 2: SUBFLOW & CUSTOM ACTION TOOLS ============
  {
    name: 'sn_list_subflows',
    description: 'List available subflows on the instance. Subflows are reusable flows that can be called from other flows.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'published', 'all'], description: 'Filter by status (default all)' },
        search: { type: 'string', description: 'Search by name or internal_name' },
        limit: { type: 'number', description: 'Maximum results (default 30)' }
      },
      required: []
    }
  },
  {
    name: 'sn_create_subflow',
    description: 'Create a new subflow (as draft). Subflows are reusable flow components callable from other flows. Must be activated in Flow Designer UI.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name of the subflow' },
        internal_name: { type: 'string', description: 'Internal/programmatic name (auto-generated if omitted)' },
        description: { type: 'string', description: 'Description of the subflow' },
        application: { type: 'string', description: 'Scope sys_id. Omit for Global scope.' }
      },
      required: ['name']
    }
  },
  {
    name: 'sn_list_custom_actions',
    description: 'List custom (user-created) action type definitions. These are reusable actions that can be used in flows.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Filter by scope (e.g., "global")' },
        search: { type: 'string', description: 'Search by name or label' },
        limit: { type: 'number', description: 'Maximum results (default 30)' }
      },
      required: []
    }
  },
  {
    name: 'sn_create_custom_action',
    description: 'Create a custom action type definition. Custom actions encapsulate reusable server-side logic that can be called from flows.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the custom action' },
        label: { type: 'string', description: 'Label shown in Flow Designer' },
        internal_name: { type: 'string', description: 'Internal/programmatic name' },
        description: { type: 'string', description: 'Description of what the action does' },
        script: { type: 'string', description: 'Server-side script that executes when the action runs' },
        application: { type: 'string', description: 'Scope sys_id. Omit for Global scope.' }
      },
      required: ['name', 'label', 'script']
    }
  },
  {
    name: 'sn_call_subflow_in_flow',
    description: 'Add a subflow call as an action step within a flow. This creates an action instance that invokes a subflow.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'sys_id of the parent flow' },
        subflow: { type: 'string', description: 'sys_id of the subflow to call' },
        order: { type: 'number', description: 'Position in the flow' },
        stage: { type: 'string', description: 'sys_id of the stage this call belongs to' },
        name: { type: 'string', description: 'Display name for this subflow call' }
      },
      required: ['flow', 'subflow']
    }
  },
  // ============ PHASE 3: FLOW VARIABLES & ACTION INPUTS TOOLS ============
  {
    name: 'sn_list_flow_variables',
    description: 'List flow input and/or output variables. Flow inputs define parameters the flow accepts; outputs define what it returns.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'sys_id of the flow' },
        type: { type: 'string', enum: ['input', 'output', 'all'], description: 'Filter by variable type (default all)' }
      },
      required: ['flow']
    }
  },
  {
    name: 'sn_create_flow_variable',
    description: 'Create a flow input or output variable. Inputs define parameters the flow accepts; outputs define what it returns. Access via pill path: {{flow.variable_name}}',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'sys_id of the flow' },
        type: { type: 'string', enum: ['input', 'output'], description: 'Variable type' },
        element: { type: 'string', description: 'Variable name (internal)' },
        label: { type: 'string', description: 'Display label' },
        internal_type: { type: 'string', description: 'Data type: string, boolean, reference, integer, glide_date_time, etc.' },
        reference: { type: 'string', description: 'Table name for reference types' },
        mandatory: { type: 'boolean', description: 'Whether the variable is required (inputs only)' },
        default_value: { type: 'string', description: 'Default value (inputs only)' }
      },
      required: ['flow', 'type', 'element', 'label', 'internal_type']
    }
  },
  {
    name: 'sn_list_action_inputs',
    description: 'List input mappings for an action instance. Shows how data is passed to an action\'s input parameters.',
    inputSchema: {
      type: 'object',
      properties: {
        action_instance: { type: 'string', description: 'sys_id of the action instance' }
      },
      required: ['action_instance']
    }
  },
  {
    name: 'sn_create_action_input',
    description: 'Create or update an action instance input mapping. Maps a value to an action\'s input parameter. Value can be static text, a pill reference like "{{trigger.record.field}}", or a script.',
    inputSchema: {
      type: 'object',
      properties: {
        action_instance: { type: 'string', description: 'sys_id of the action instance' },
        name: { type: 'string', description: 'Name of the input parameter' },
        value: { type: 'string', description: 'Value to map (static, pill reference, or script)' }
      },
      required: ['action_instance', 'name', 'value']
    }
  },
  // ============ PHASE 4: UPDATE SET TEMPLATE TOOLS ============
  {
    name: 'sn_export_flow_as_template',
    description: 'Export a flow\'s complete structure as a template. Returns all related records (triggers, actions, stages, variables) that can be used to recreate or clone the flow.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'sys_id of the flow to export' },
        include_subflows: { type: 'boolean', description: 'Include referenced subflows (default false)' }
      },
      required: ['flow']
    }
  },
  {
    name: 'sn_list_flow_templates',
    description: 'List flows that can be used as templates. Published flows with snapshots can be cloned via update set to preserve their executable state.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search by name' },
        status: { type: 'string', enum: ['draft', 'published', 'all'], description: 'Filter by status (default published)' }
      },
      required: []
    }
  },
  {
    name: 'sn_create_flow_from_template',
    description: 'Create a new flow by cloning an existing flow\'s structure. Copies triggers, actions, stages, and variables. NOTE: Creates a draft flow - for published clones with snapshots, use update set export/import.',
    inputSchema: {
      type: 'object',
      properties: {
        template_flow: { type: 'string', description: 'sys_id of the source flow to clone' },
        new_name: { type: 'string', description: 'Name for the new flow' },
        new_internal_name: { type: 'string', description: 'Internal name (auto-generated if omitted)' },
        description: { type: 'string', description: 'Description for the new flow' }
      },
      required: ['template_flow', 'new_name']
    }
  },
  // ============ PHASE 5: FLOW EXECUTION TOOLS ============
  {
    name: 'sn_execute_flow',
    description: 'Check if a flow is ready for execution and get execution guidance. Direct REST API execution is not supported by ServiceNow - use Background Script or Scripted REST API.',
    inputSchema: {
      type: 'object',
      properties: {
        flow_internal_name: { type: 'string', description: 'Internal name of the flow (e.g., "global.my_flow")' },
        inputs: { type: 'object', description: 'Input values as key-value pairs' },
        wait: { type: 'boolean', description: 'Wait for completion (default false)' }
      },
      required: ['flow_internal_name']
    }
  },
  {
    name: 'sn_get_flow_execution_status',
    description: 'Get the execution status of a flow context. Use the context_id from flow execution results.',
    inputSchema: {
      type: 'object',
      properties: {
        context_id: { type: 'string', description: 'Flow execution context sys_id' }
      },
      required: ['context_id']
    }
  },
  {
    name: 'sn_list_flow_executions',
    description: 'List recent flow executions from sys_hub_flow_context. Shows execution history, status, and any errors.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: { type: 'string', description: 'Filter by flow sys_id' },
        status: { type: 'string', description: 'Filter by status: running, completed, error' },
        limit: { type: 'number', description: 'Maximum results (default 20)' }
      },
      required: []
    }
  }
];

// Scoped Application Tools - CRITICAL for Flow Designer deployment
export const SCOPED_APP_TOOLS: ToolDefinition[] = [
  {
    name: 'sn_get_custom_apps',
    description: 'Get all custom scoped applications from the instance. IMPORTANT: Must be called before implementation phase to determine deployment scope. Flow Designer artifacts (flows, subflows, flow actions) REQUIRE a custom scoped application.',
    inputSchema: {
      type: 'object',
      properties: {
        activeOnly: { type: 'boolean', description: 'Only return active applications (default: true)' },
        includeGlobal: { type: 'boolean', description: 'Include Global scope as an option (default: true)' },
        limit: { type: 'number', description: 'Max applications to return (default: 50)' }
      },
      required: []
    }
  },
  {
    name: 'sn_get_scope_selection_options',
    description: 'Get scope selection options with deployment method recommendations. Analyzes artifact types and suggests appropriate scopes. Call this BEFORE starting implementation to determine which scope to use.',
    inputSchema: {
      type: 'object',
      properties: {
        artifactTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of artifacts being deployed (e.g., ["flow", "business_rule", "script_include"])'
        }
      },
      required: []
    }
  },
  {
    name: 'sn_create_custom_app',
    description: 'Create a new custom scoped application. Use this when user wants to deploy Flow Designer artifacts but no suitable custom app exists.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Application name (e.g., "My Custom App")' },
        scope: { type: 'string', description: 'Application scope (auto-generated if not provided)' },
        shortDescription: { type: 'string', description: 'Short description of the application' },
        version: { type: 'string', description: 'Application version (default: 1.0.0)' }
      },
      required: ['name']
    }
  }
];

export const ALL_TOOLS = [...TOOLS, ...MORE_TOOLS, ...ADDITIONAL_TOOLS, ...BROWNFIELD_TOOLS, ...FLOW_DESIGNER_TOOLS, ...SCOPED_APP_TOOLS];

/**
 * Convert tool definitions to Anthropic Messages API format.
 * Changes 'inputSchema' to 'input_schema'.
 */
export function getAnthropicToolDefinitions() {
  return ALL_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}
