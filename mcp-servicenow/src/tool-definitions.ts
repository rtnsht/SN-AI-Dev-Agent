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
        table: { type: 'string', description: 'The table name of the artifact (e.g., "sys_script", "sys_script_include", "sys_script_client", "sys_dictionary")' },
        sys_id: { type: 'string', description: 'The sys_id of the record to move to the update set' }
      },
      required: ['update_set_id', 'table', 'sys_id']
    }
  },
  {
    name: 'sn_verify_update_set_capture',
    description: 'Verify that ALL artifacts are captured in the active update set. Call this AFTER creating all artifacts to ensure nothing is missing. Automatically attempts to move any missing artifacts. Returns a detailed report of captured, moved, and missing items.',
    inputSchema: {
      type: 'object',
      properties: {
        update_set_id: { type: 'string', description: 'The sys_id of the update set to verify against' },
        artifacts: {
          type: 'array',
          description: 'Array of artifacts to verify',
          items: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Table name (e.g., "sys_script", "sys_dictionary")' },
              sys_id: { type: 'string', description: 'sys_id of the artifact' },
              name: { type: 'string', description: 'Friendly name of the artifact (optional)' }
            },
            required: ['table', 'sys_id']
          }
        }
      },
      required: ['update_set_id', 'artifacts']
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
    description: 'Comprehensive instance analyzer covering 150+ artifact types across 40+ categories (server/client scripts, UI, flows, portals, analytics, integrations, CMDB, etc.). Returns health score (0-100), artifact counts by type/category, custom vs OOTB detection, and recommendations. Use categories param to scope analysis.',
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
    description: 'Detects OOTB artifacts modified in the instance. Classifies by severity (critical/high/medium/low), calculates upgrade risk score (0-100), tracks skipped updates. Use for pre-upgrade planning and technical debt analysis.',
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
    description: 'Builds dependency graph between artifacts. Detects Script Include calls, GlideAjax, GlideRecord usage, class inheritance, table triggers. Returns nodes, edges, orphaned artifacts, hub artifacts, and refactoring recommendations.',
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
    description: 'Detects 25+ anti-patterns in ServiceNow code across categories: performance (current.update, getRowCount), security (eval, GlideRecord in client), maintainability (hardcoded sys_ids), upgradability, UX. Returns health score and issues by severity.',
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
    description: 'Scores script quality (A-F grade, 0-100) based on complexity, documentation, best practices, code style, and maintainability. Returns overall grade, per-artifact scores, and top issues.',
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
    description: 'Finds unused/orphaned code: unreferenced Script Includes, empty scripts, artifacts on deleted tables, stale inactive artifacts. Returns candidates with confidence levels (high/medium/low) and cleanup effort estimate.',
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
    description: 'Previews impact of proposed changes BEFORE applying. Analyzes performance, security, upgrade risk, conflicts, and dependencies. Returns risk score (0-100) and approval requirements.',
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
    description: 'Detects conflicts between artifacts on a table: order conflicts, condition overlaps, field conflicts, trigger conflicts. Returns table-level health score.',
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
    description: 'Validates changes against guardrails: performance, security, naming, best practices, compliance. Severity levels: block/warn/info. Supports strict mode for additional rules.',
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
    description: 'Detects breaking changes before modifying shared artifacts. Finds dependent artifacts for delete/rename/modify_signature/deactivate operations. Returns affected list, safe-to-proceed flag, and migration steps.',
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
    description: 'Logs AI-assisted changes for audit trails. Actions: create/update/delete/preview/validate/analyze. Generates rollback scripts, groups by session, captures before/after.',
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
    description: 'Retrieves audit history of AI-assisted changes. Filter by session, artifact, or action type.',
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
    description: 'Detects user persona (junior_developer/senior_developer/architect/admin/business_analyst/qa_engineer/project_manager) and returns adaptive guardrail settings.',
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
    description: 'Applies 4G Framework (Guardrails, Guidance, Governance, Growth) to a proposed action. Checks code quality, performance, security, naming. Determines approval level based on persona.',
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
    description: 'Submits a change for approval. Levels: team_lead, admin, architect, platform_owner. Tracks status and documents justification.',
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
    description: 'Registers a ServiceNow instance (dev/test/stage/prod) for multi-instance workflows and cross-environment comparisons.',
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
    description: 'Compares artifacts between two instances to identify drift, plan promotions, and detect differences.',
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
    description: 'Scores upgrade readiness (0-100). Identifies deprecated APIs, conflicting OOTB overrides, and estimates remediation effort.',
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
    description: 'Predicts conflicts before changes: order collisions, condition overlaps, script conflicts. Recommends safe execution order.',
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
    description: 'Compares instance against clean OOTB baseline. Returns customization score (0-100), grade (A-F), upgrade readiness, category breakdown, and recommendations.',
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
    description: 'Returns fix recommendations for specific issue types (gr_in_client, hardcoded_sysid, synchronous_ajax, etc.). Includes explanation, fix patterns with before/after code, and best practices.',
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
    description: 'Returns best practices for a ServiceNow artifact type and action (create/modify/review/optimize/secure/debug). Includes do/don\'t lists, security/performance tips, and common mistakes.',
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
    description: 'Returns ready-to-use code templates for common SN patterns (GlideRecord CRUD, GlideAjax, REST, Script Include class, BR/CS patterns, ACL, error handling, logging).',
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

// Scoped Application Tools
export const SCOPED_APP_TOOLS: ToolDefinition[] = [
  {
    name: 'sn_get_custom_apps',
    description: 'Get all custom scoped applications from the instance. Useful for determining deployment scope.',
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
    description: 'Create a new custom scoped application.',
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

// ---------------------------------------------------------------------------
// Phase-based tool subsetting
// ---------------------------------------------------------------------------
// Tools are grouped by SDLC phase. "core" tools are always included.
// When a phase is active, only core + that phase's tools are sent to the LLM,
// dramatically reducing the tool-definition token footprint.

export type SDLCToolPhase = 'spec' | 'design' | 'scope_selection' | 'implementation' | 'testing' | 'deployment';

/** Per-phase round limits — lightweight phases get fewer rounds to prevent loops */
export const PHASE_ROUND_LIMITS: Record<SDLCToolPhase, number> = {
  spec: 15,
  design: 20,
  scope_selection: 5,   // Scope is a 2-3 tool call phase — hard cap prevents the loop seen in session xyhkmn8
  implementation: 30,
  testing: 20,
  deployment: 15,
};

/** Default round limit when no phase is set */
export const DEFAULT_ROUND_LIMIT = 30;

/** Core tools included in every phase */
const CORE_TOOL_NAMES = new Set([
  // Connection & instance info
  'sn_test_connection', 'sn_get_instance_info', 'sn_initialize_instance',
  // Schema inspection
  'sn_get_tables', 'sn_get_table_schema',
  // Generic read/query
  'sn_query_records', 'sn_get_record',
  // Update set read (always needed for context)
  'sn_list_update_sets', 'sn_get_update_set', 'sn_get_update_set_contents',
]);

/**
 * Per-phase core tool overrides — phases that don't need the full core set
 * can exclude tools that cause the AI to waste rounds on unnecessary queries.
 */
const CORE_TOOL_EXCLUDES: Partial<Record<SDLCToolPhase, Set<string>>> = {
  scope_selection: new Set([
    // AI doesn't need schema inspection during scope selection — already done in design
    'sn_get_tables', 'sn_get_table_schema',
    // Instance init/info already gathered — no need to re-query
    'sn_get_instance_info', 'sn_initialize_instance',
  ]),
};

/** Phase-specific tool names (in addition to core) */
const PHASE_TOOL_NAMES: Record<SDLCToolPhase, Set<string>> = {
  spec: new Set([
    // Read existing artifacts
    'sn_get_business_rules', 'sn_get_script_includes', 'sn_get_client_scripts',
    'sn_get_ui_policies', 'sn_get_ui_policy_actions', 'sn_get_ui_actions',
    'sn_get_notifications', 'sn_get_events',
    'sn_get_acls', 'sn_get_roles',
    'sn_get_catalog_items', 'sn_get_catalog_item', 'sn_get_catalog_variables', 'sn_get_requests',
    'sn_get_scheduled_jobs', 'sn_get_fix_scripts',
    // Instance analysis & brownfield discovery
    'sn_analyze_instance', 'sn_detect_ootb_overrides', 'sn_get_dependency_graph',
    'sn_find_anti_patterns', 'sn_code_quality_score', 'sn_find_dead_code',
    'sn_compare_to_ootb', 'sn_assess_upgrade_readiness',
    'sn_detect_persona', 'sn_apply_4g_framework',
    'sn_generate_report', 'sn_get_dashboard_data',
    // Flow read
    'sn_list_flows', 'sn_get_flow', 'sn_analyze_flow',
    'sn_list_subflows', 'sn_list_custom_actions',
    // Scope read
    'sn_get_custom_apps', 'sn_get_scope_selection_options',
  ]),

  scope_selection: new Set([
    // Scope selection tools
    'sn_get_custom_apps', 'sn_get_scope_selection_options', 'sn_create_custom_app',
    // Update set tools (needed to create/set update set as part of scope finalization)
    'sn_create_update_set', 'sn_set_current_update_set',
    // Flow read (to verify what exists)
    'sn_list_flows', 'sn_get_flow', 'sn_list_subflows', 'sn_list_custom_actions',
  ]),

  design: new Set([
    // Everything from spec
    'sn_get_business_rules', 'sn_get_script_includes', 'sn_get_client_scripts',
    'sn_get_ui_policies', 'sn_get_ui_policy_actions', 'sn_get_ui_actions',
    'sn_get_notifications', 'sn_get_events',
    'sn_get_acls', 'sn_get_roles',
    'sn_get_catalog_items', 'sn_get_catalog_item', 'sn_get_catalog_variables', 'sn_get_requests',
    'sn_get_scheduled_jobs', 'sn_get_fix_scripts',
    'sn_analyze_instance', 'sn_detect_ootb_overrides', 'sn_get_dependency_graph',
    'sn_find_anti_patterns', 'sn_code_quality_score', 'sn_find_dead_code',
    'sn_compare_to_ootb', 'sn_assess_upgrade_readiness',
    'sn_detect_persona', 'sn_apply_4g_framework',
    'sn_generate_report', 'sn_get_dashboard_data',
    'sn_list_flows', 'sn_get_flow', 'sn_analyze_flow',
    'sn_list_subflows', 'sn_list_custom_actions',
    'sn_get_custom_apps', 'sn_get_scope_selection_options',
    // Design-specific: conflict prediction, best practices, templates
    'sn_predict_conflicts', 'sn_compare_instances',
    'sn_preview_change_impact', 'sn_detect_conflicts',
    'sn_get_best_practices', 'sn_get_code_templates', 'sn_get_fix_recommendations',
  ]),

  implementation: new Set([
    // Read tools for verification
    'sn_get_business_rules', 'sn_get_script_includes', 'sn_get_client_scripts',
    'sn_get_ui_policies', 'sn_get_ui_policy_actions', 'sn_get_ui_actions',
    'sn_get_notifications', 'sn_get_events',
    'sn_get_acls', 'sn_get_roles',
    'sn_get_catalog_items', 'sn_get_catalog_item', 'sn_get_catalog_variables',
    'sn_get_scheduled_jobs', 'sn_get_fix_scripts',
    // Generic create/update
    'sn_create_record', 'sn_update_record',
    // Artifact creation
    'sn_create_business_rule', 'sn_create_script_include', 'sn_create_client_script',
    'sn_create_ui_policy', 'sn_create_ui_policy_action', 'sn_create_ui_action',
    'sn_create_notification', 'sn_create_event',
    'sn_create_acl', 'sn_create_role',
    'sn_create_scheduled_job',
    'sn_create_fix_script', 'sn_run_fix_script',
    // Update set management
    'sn_create_update_set', 'sn_set_current_update_set', 'sn_move_to_update_set', 'sn_verify_update_set_capture',
    // Flow Designer
    'sn_list_flows', 'sn_get_flow', 'sn_analyze_flow',
    'sn_create_flow', 'sn_create_flow_trigger', 'sn_create_flow_action_instance', 'sn_create_flow_stage',
    'sn_list_flow_stages', 'sn_list_flow_action_instances',
    'sn_list_action_types', 'sn_list_trigger_definitions', 'sn_get_action_type_schema',
    'sn_list_subflows', 'sn_create_subflow', 'sn_list_custom_actions', 'sn_create_custom_action',
    'sn_call_subflow_in_flow',
    'sn_list_flow_variables', 'sn_create_flow_variable', 'sn_list_action_inputs', 'sn_create_action_input',
    'sn_export_flow_as_template', 'sn_list_flow_templates', 'sn_create_flow_from_template',
    'sn_execute_flow', 'sn_get_flow_execution_status', 'sn_list_flow_executions',
    // Scope management
    'sn_get_custom_apps', 'sn_get_scope_selection_options', 'sn_create_custom_app',
    // Best practices & templates for implementation guidance
    'sn_get_best_practices', 'sn_get_code_templates',
    'sn_predict_conflicts', 'sn_get_dependency_graph',
  ]),

  testing: new Set([
    // Read tools for verification
    'sn_get_business_rules', 'sn_get_script_includes', 'sn_get_client_scripts',
    'sn_get_ui_policies', 'sn_get_ui_policy_actions', 'sn_get_ui_actions',
    'sn_get_acls',
    'sn_get_catalog_items', 'sn_get_catalog_item', 'sn_get_catalog_variables',
    // Code quality & validation
    'sn_find_anti_patterns', 'sn_code_quality_score',
    'sn_preview_change_impact', 'sn_detect_conflicts', 'sn_validate_change',
    'sn_check_breaking_changes',
    'sn_get_fix_recommendations', 'sn_get_best_practices',
    // Flow execution & testing
    'sn_list_flows', 'sn_get_flow', 'sn_analyze_flow',
    'sn_execute_flow', 'sn_get_flow_execution_status', 'sn_list_flow_executions',
    // Fix scripts for test data
    'sn_get_fix_scripts', 'sn_create_fix_script', 'sn_run_fix_script',
  ]),

  deployment: new Set([
    // Update set completion
    'sn_create_update_set', 'sn_set_current_update_set',
    'sn_complete_update_set', 'sn_move_to_update_set', 'sn_verify_update_set_capture',
    // Change management & audit
    'sn_log_change', 'sn_get_audit_history',
    'sn_request_approval', 'sn_process_approval', 'sn_get_approval_status',
    // Instance management & promotion
    'sn_register_instance', 'sn_list_instances',
    'sn_register_instance_v2', 'sn_switch_instance', 'sn_get_active_instance',
    'sn_test_instance_connection',
    'sn_diff_artifact', 'sn_compare_instances',
    'sn_create_promotion_package', 'sn_preview_promotion',
    'sn_validate_promotion', 'sn_execute_promotion',
    'sn_rollback_promotion', 'sn_list_promotion_history', 'sn_list_promotion_packages',
    // Reports
    'sn_generate_report', 'sn_get_dashboard_data',
  ]),
};

/**
 * Get tool definitions filtered by SDLC phase (Anthropic format).
 * Returns core tools + phase-specific tools, minus any phase-specific exclusions.
 * If phase is null/undefined, returns ALL tools (backwards compatible).
 */
export function getAnthropicToolDefinitionsForPhase(phase?: SDLCToolPhase | null) {
  if (!phase) return getAnthropicToolDefinitions();

  const phaseNames = PHASE_TOOL_NAMES[phase];
  if (!phaseNames) return getAnthropicToolDefinitions();

  const excludes = CORE_TOOL_EXCLUDES[phase];

  return ALL_TOOLS
    .filter(t => {
      if (phaseNames.has(t.name)) return true;
      if (CORE_TOOL_NAMES.has(t.name)) return !excludes || !excludes.has(t.name);
      return false;
    })
    .map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
}
