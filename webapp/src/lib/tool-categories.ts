/**
 * Tool Categories — maps all ServiceNow MCP tools into a category hierarchy.
 *
 * Source of truth: mcp-servicenow/src/tool-definitions.ts (ALL_TOOLS)
 * Categories: Core | Scripts | Notifications | Quality | Analysis | Data Import | Diagrams | Deployment
 */

export interface ToolDef {
  name: string;
  description: string;
  phase?: string;
}

export interface ToolCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  tools: ToolDef[];
}

export type ToolSelectionMode = "categories" | "custom" | "all";

export interface ToolSelectionPayload {
  mode?: ToolSelectionMode;
  categories?: string[];
  toolNames?: string[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'core',
    label: 'Core',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    description: 'Essential ServiceNow operations',
    tools: [],
  },
  {
    id: 'scripts',
    label: 'Scripts',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    description: 'Script includes and business rules',
    tools: [],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    description: 'Email, SMS, and notification management',
    tools: [],
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    description: 'ATF tests, code review, and quality gates',
    tools: [],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    description: 'Instance analysis and reporting',
    tools: [],
  },
  {
    id: 'data_import',
    label: 'Data Import',
    icon: 'M4 7h16M7 4v16m10-8H7m11 6l-3 3-3-3',
    description: 'Import sets, transform maps, data sources, and execution',
    tools: [],
  },
  {
    id: 'diagrams',
    label: 'Diagrams',
    icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
    description: 'Architecture, sequence, ER, and data flow diagrams',
    tools: [
      { name: 'sn_generate_architecture_diagram', description: 'Generate system architecture diagram', phase: 'design' },
      { name: 'sn_generate_sequence_diagram', description: 'Generate sequence diagram', phase: 'design' },
      { name: 'sn_generate_data_flow_diagram', description: 'Generate data flow diagram', phase: 'design' },
      { name: 'sn_generate_er_diagram', description: 'Generate ER diagram', phase: 'design' },
    ],
  },
  {
    id: 'deployment',
    label: 'Deployment',
    icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
    description: 'Update sets, migration, and deployment',
    tools: [],
  },
];

// ─── Complete static tool registry (mirrors ALL_TOOLS from tool-definitions.ts) ───

const ALL_TOOL_DEFS: ToolDef[] = [
  // Connection
  { name: 'sn_test_connection', description: 'Test connection to the ServiceNow instance' },
  { name: 'sn_get_instance_info', description: 'Get information about the connected ServiceNow instance' },
  { name: 'sn_initialize_instance', description: 'Initialize a ServiceNow instance with required helper APIs' },
  { name: 'sn_get_tables', description: 'List available tables in the instance' },
  { name: 'sn_get_table_schema', description: 'Get the schema (fields) for a specific table' },
  // Record tools
  { name: 'sn_query_records', description: 'Query records from any ServiceNow table' },
  { name: 'sn_get_record', description: 'Get a single record by sys_id' },
  { name: 'sn_create_record', description: 'Create a new record in any table' },
  { name: 'sn_update_record', description: 'Update an existing record' },
  // Data Import
  { name: 'sn_list_data_sources', description: 'List import data sources' },
  { name: 'sn_get_data_source', description: 'Get a data source by sys_id' },
  { name: 'sn_create_data_source', description: 'Create a data source for import jobs' },
  { name: 'sn_list_import_sets', description: 'List import sets and their status' },
  { name: 'sn_get_import_set_rows', description: 'Get rows loaded into an import set' },
  { name: 'sn_list_transform_maps', description: 'List transform maps' },
  { name: 'sn_get_transform_map', description: 'Get a transform map by sys_id' },
  { name: 'sn_create_transform_map', description: 'Create a transform map' },
  { name: 'sn_list_transform_entries', description: 'List transform field maps' },
  { name: 'sn_create_transform_entry', description: 'Create a transform field map entry' },
  { name: 'sn_list_transform_scripts', description: 'List transform scripts for a transform map' },
  { name: 'sn_create_transform_script', description: 'Create a transform script' },
  { name: 'sn_execute_transform_map', description: 'Execute a transform map against an import set' },
  { name: 'sn_get_transform_run_history', description: 'Get import transform run history' },
  // Business Rules
  { name: 'sn_get_business_rules', description: 'Get business rules for a table' },
  { name: 'sn_create_business_rule', description: 'Create a new business rule' },
  // Script Includes
  { name: 'sn_get_script_includes', description: 'Get script includes' },
  { name: 'sn_create_script_include', description: 'Create a new script include' },
  // Client Scripts
  { name: 'sn_get_client_scripts', description: 'Get client scripts for a table' },
  { name: 'sn_create_client_script', description: 'Create a new client script' },
  // Update Sets
  { name: 'sn_list_update_sets', description: 'List update sets in the instance' },
  { name: 'sn_get_update_set', description: 'Get details of a specific update set' },
  { name: 'sn_create_update_set', description: 'Create a new update set' },
  { name: 'sn_set_current_update_set', description: 'Set an update set as the current update set for capturing changes' },
  { name: 'sn_complete_update_set', description: 'Mark an update set as complete' },
  { name: 'sn_get_update_set_contents', description: 'Get the contents/changes in an update set' },
  { name: 'sn_move_to_update_set', description: 'Move a record\'s sys_update_xml entry to a specific update set' },
  { name: 'sn_verify_update_set_capture', description: 'Verify that ALL artifacts are captured in the active update set' },
  // Scope Management
  { name: 'sn_set_scope', description: 'Switch the session to a specific application scope' },
  { name: 'sn_verify_scope', description: 'Verify the current application scope of the REST session' },
  // UI Policies
  { name: 'sn_get_ui_policies', description: 'Get UI policies for a table' },
  { name: 'sn_create_ui_policy', description: 'Create a new UI policy' },
  { name: 'sn_get_ui_policy_actions', description: 'Get UI policy actions for a UI policy' },
  { name: 'sn_create_ui_policy_action', description: 'Create a UI policy action to define field behavior when policy triggers' },
  // UI Actions
  { name: 'sn_get_ui_actions', description: 'Get UI actions for a table' },
  { name: 'sn_create_ui_action', description: 'Create a new UI action' },
  // Notifications
  { name: 'sn_get_notifications', description: 'Get email notifications' },
  { name: 'sn_create_notification', description: 'Create an email notification' },
  // Events
  { name: 'sn_get_events', description: 'Get registered events' },
  { name: 'sn_create_event', description: 'Register a new event' },
  // ACLs
  { name: 'sn_get_acls', description: 'Get access control rules' },
  { name: 'sn_create_acl', description: 'Create an access control rule' },
  // Roles
  { name: 'sn_get_roles', description: 'Get system roles' },
  { name: 'sn_create_role', description: 'Create a new role' },
  // Catalog
  { name: 'sn_get_catalog_items', description: 'Get service catalog items' },
  { name: 'sn_get_catalog_item', description: 'Get catalog item details with variables' },
  { name: 'sn_get_catalog_variables', description: 'Get variables for a catalog item' },
  { name: 'sn_get_requests', description: 'Get service catalog requests' },
  { name: 'sn_get_catalog_categories', description: 'List service catalog categories' },
  { name: 'sn_create_catalog_item', description: 'Create a new service catalog item' },
  { name: 'sn_create_catalog_variable', description: 'Add a variable (form field) to an existing catalog item' },
  { name: 'sn_create_record_producer', description: 'Create a record producer' },
  { name: 'sn_update_catalog_item', description: 'Update an existing catalog item' },
  { name: 'sn_delete_catalog_item', description: 'Deactivate or permanently delete a catalog item' },
  { name: 'sn_add_catalog_item_to_category', description: 'Associate a catalog item with an additional category' },
  { name: 'sn_add_catalog_item_to_catalog', description: 'Associate a catalog item with a service catalog' },
  { name: 'sn_create_request', description: 'Submit a service catalog request' },
  { name: 'sn_create_catalog_client_script', description: 'Create a client script on a catalog variable' },
  // Scheduled Jobs
  { name: 'sn_get_scheduled_jobs', description: 'Get scheduled jobs' },
  { name: 'sn_create_scheduled_job', description: 'Create a scheduled job' },
  // Fix Scripts
  { name: 'sn_get_fix_scripts', description: 'Get fix scripts' },
  { name: 'sn_create_fix_script', description: 'Create a fix script' },
  { name: 'sn_run_fix_script', description: 'Run a fix script' },
  // ATF
  { name: 'sn_enable_atf_property', description: 'Enable the sn_atf.runner.enabled system property' },
  { name: 'sn_create_atf_suite', description: 'Create a complete ATF test suite' },
  { name: 'sn_run_atf_suite', description: 'Trigger ATF test suite execution' },
  { name: 'sn_get_atf_results', description: 'Poll for ATF test suite execution results' },
  // Analysis
  { name: 'sn_analyze_instance', description: 'Comprehensive instance analyzer covering 150+ artifact types' },
  { name: 'sn_detect_ootb_overrides', description: 'Detects OOTB artifacts modified in the instance' },
  { name: 'sn_get_dependency_graph', description: 'Get dependency graph for an artifact' },
  // Reports / Dashboard
  { name: 'sn_generate_report', description: 'Generate a report from the instance' },
  { name: 'sn_get_dashboard_data', description: 'Get dashboard analytics data' },
  // Flow Designer
  { name: 'sn_get_flows', description: 'Get Flow Designer flows' },
  { name: 'sn_create_flow', description: 'Create a Flow Designer flow' },
  { name: 'sn_get_flow_actions', description: 'Get Flow Designer actions' },
  { name: 'sn_activate_flow', description: 'Activate a Flow Designer flow' },
  // Scoped Apps
  { name: 'sn_get_scoped_apps', description: 'Get scoped applications' },
  { name: 'sn_create_scoped_app', description: 'Create a scoped application' },
  { name: 'sn_get_app_properties', description: 'Get properties for a scoped app' },
  { name: 'sn_create_app_property', description: 'Create an application property' },
  // Service Portal
  { name: 'sn_get_widgets', description: 'Get Service Portal widgets' },
  { name: 'sn_create_widget', description: 'Create a Service Portal widget' },
  { name: 'sn_get_pages', description: 'Get Service Portal pages' },
  { name: 'sn_create_page', description: 'Create a Service Portal page' },
  { name: 'sn_get_themes', description: 'Get Service Portal themes' },
  { name: 'sn_create_theme', description: 'Create a Service Portal theme' },
];

// ─── Pattern-based categorisation ───────────────────────────────────────────

const CORE_PATTERNS = [
  'sn_test_connection', 'sn_get_instance_info', 'sn_initialize_instance',
  'sn_get_tables', 'sn_get_table_schema', 'sn_query_records', 'sn_get_record',
  'sn_create_record', 'sn_update_record',
];

const SCRIPT_PATTERNS = [
  'sn_create_script_include', 'sn_get_script_includes',
  'sn_create_business_rule', 'sn_get_business_rules',
  'sn_create_client_script', 'sn_get_client_scripts',
  'sn_create_ui_action', 'sn_get_ui_actions',
];

const NOTIFICATION_PATTERNS = [
  'sn_create_notification', 'sn_get_notifications',
  'sn_get_events', 'sn_create_event',
];

const QUALITY_PATTERNS = [
  'sn_enable_atf_property', 'sn_create_atf_suite', 'sn_run_atf_suite',
  'sn_get_atf_results',
];

const ANALYSIS_PATTERNS = [
  'sn_analyze_instance', 'sn_detect_ootb_overrides', 'sn_get_dependency_graph',
  'sn_generate_report', 'sn_get_dashboard_data',
];

const DATA_IMPORT_PATTERNS = [
  'sn_list_data_sources', 'sn_get_data_source', 'sn_create_data_source',
  'sn_list_import_sets', 'sn_get_import_set_rows',
  'sn_list_transform_maps', 'sn_get_transform_map', 'sn_create_transform_map',
  'sn_list_transform_entries', 'sn_create_transform_entry',
  'sn_list_transform_scripts', 'sn_create_transform_script',
  'sn_execute_transform_map', 'sn_get_transform_run_history',
];

const DEPLOY_PATTERNS = [
  'sn_create_update_set', 'sn_list_update_sets', 'sn_get_update_set',
  'sn_set_current_update_set', 'sn_complete_update_set',
  'sn_get_update_set_contents', 'sn_move_to_update_set',
  'sn_verify_update_set_capture', 'sn_set_scope', 'sn_verify_scope',
];

/** Populate TOOL_CATEGORIES from a tool definitions array (e.g. from MCP package) */
export function buildToolCategories(allTools: ToolDef[]): void {
  const diagramsToolNames = new Set(['sn_generate_architecture_diagram', 'sn_generate_sequence_diagram', 'sn_generate_data_flow_diagram', 'sn_generate_er_diagram']);

  // Reset dynamic categories (keep diagrams pre-populated)
  for (const cat of TOOL_CATEGORIES) {
    if (cat.id !== 'diagrams') cat.tools = [];
  }

  for (const tool of allTools) {
    if (diagramsToolNames.has(tool.name)) continue; // already in diagrams

    let assigned = false;
    for (const pattern of CORE_PATTERNS) if (tool.name === pattern || tool.name.includes(pattern)) { TOOL_CATEGORIES[0].tools.push(tool); assigned = true; break; }
    if (!assigned) for (const pattern of SCRIPT_PATTERNS) if (tool.name === pattern || tool.name.includes(pattern)) { TOOL_CATEGORIES[1].tools.push(tool); assigned = true; break; }
    if (!assigned) for (const pattern of NOTIFICATION_PATTERNS) if (tool.name === pattern || tool.name.includes(pattern)) { TOOL_CATEGORIES[2].tools.push(tool); assigned = true; break; }
    if (!assigned) for (const pattern of QUALITY_PATTERNS) if (tool.name === pattern || tool.name.includes(pattern)) { TOOL_CATEGORIES[3].tools.push(tool); assigned = true; break; }
    if (!assigned) for (const pattern of ANALYSIS_PATTERNS) if (tool.name === pattern || tool.name.includes(pattern)) { TOOL_CATEGORIES[4].tools.push(tool); assigned = true; break; }
    if (!assigned) for (const pattern of DATA_IMPORT_PATTERNS) if (tool.name === pattern || tool.name.includes(pattern)) { TOOL_CATEGORIES[5].tools.push(tool); assigned = true; break; }
    if (!assigned) for (const pattern of DEPLOY_PATTERNS) if (tool.name === pattern || tool.name.includes(pattern)) { TOOL_CATEGORIES[7].tools.push(tool); assigned = true; break; }
    // Catch-all: uncategorised tools go to Core
    if (!assigned) TOOL_CATEGORIES[0].tools.push(tool);
  }
}

/** Build from the static ALL_TOOL_DEFS embedded in this file */
export function buildToolCategoriesFromStatic(): void {
  buildToolCategories(ALL_TOOL_DEFS);
}

/** Returns a serialisable tree of all categories with tool counts */
export function getCategoryTree(): { id: string; label: string; icon: string; count: number; tools: { name: string; description: string }[] }[] {
  return TOOL_CATEGORIES.map(c => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    count: c.tools.length,
    tools: c.tools.map(t => ({ name: t.name, description: t.description })),
  }));
}

/** Get a flat list of all tool names */
export function getAllToolNames(): string[] {
  return ALL_TOOL_DEFS.map(t => t.name);
}

export function getToolNamesForCategories(categoryIds: string[]): string[] {
  if (categoryIds.length === 0) return [];
  const selected = new Set(categoryIds);
  return TOOL_CATEGORIES
    .filter((category) => selected.has(category.id))
    .flatMap((category) => category.tools.map((tool) => tool.name));
}

export function normalizeToolSelection(
  selection?: ToolSelectionPayload | null
): Required<ToolSelectionPayload> | null {
  if (!selection) return null;

  const mode: ToolSelectionMode =
    selection.mode === "all" || selection.mode === "custom" ? selection.mode : "categories";
  const validCategories = new Set(TOOL_CATEGORIES.map((category) => category.id));
  const categories = Array.from(
    new Set((selection.categories || []).filter((categoryId) => validCategories.has(categoryId)))
  );
  const toolNames = Array.from(new Set((selection.toolNames || []).filter(Boolean)));

  return { mode, categories, toolNames };
}

export function resolveToolNamesForSelection(
  selection?: ToolSelectionPayload | null
): string[] | null {
  const normalized = normalizeToolSelection(selection);
  if (!normalized) return null;
  if (normalized.mode === "all") return getAllToolNames();
  if (normalized.mode === "custom") return normalized.toolNames;
  return getToolNamesForCategories(normalized.categories);
}
