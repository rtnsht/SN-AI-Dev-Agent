/**
 * Instance Analyzer Tools
 * Deep analysis tools for brownfield ServiceNow instances
 * Part of the Brownfield Enhancement Plan - Step 1: Deep Instance Intelligence
 *
 * COMPREHENSIVE COVERAGE - All ServiceNow artifact types:
 * - Server Scripts: Business Rules, Script Includes, Fix Scripts, Script Actions, Processors
 * - Client Scripts: Client Scripts, UI Scripts, UI Macros
 * - UI: UI Policies, UI Actions, UI Pages, Formatters
 * - Flow Designer: Flows, Subflows, Flow Actions, Flow Triggers
 * - Process Automation: Playbooks, Decision Tables
 * - Integration Hub: Spokes, Actions, Connections
 * - Legacy Workflows: Workflows, Workflow Activities
 * - Events: Event Registry, Script Actions
 * - Email: Notifications, Email Scripts, Email Templates, Inbound Actions
 * - Service Portal: Widgets, Pages, Themes, Angular Providers
 * - Now Experience: UI Builder Pages, Components, Experiences
 * - REST/SOAP: REST Messages, Scripted REST APIs, SOAP Messages
 * - Data: Transform Maps, Import Sets, Data Sources
 * - Testing: ATF Tests, Test Suites, Test Steps
 * - Security: ACLs, Data Policies
 * - Properties: System Properties, Application Properties
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ SCHEMAS ============

export const analyzeInstanceSchema = z.object({
  scope: z.string().optional().describe('Application scope to analyze (default: all scopes)'),
  tables: z.array(z.string()).optional().describe('Specific tables to analyze (default: common tables)'),
  includeScripts: z.boolean().optional().default(true).describe('Include script content in analysis'),
  includeInactive: z.boolean().optional().default(false).describe('Include inactive artifacts'),
  limit: z.number().optional().default(100).describe('Max artifacts per category'),
  categories: z.array(z.enum([
    'all',
    // Core Development
    'server_scripts',
    'client_scripts',
    'ui',
    'flow_designer',
    'process_automation',
    'integration_hub',
    'legacy_workflows',
    'events',
    'email',
    // Portals & Experiences
    'service_portal',
    'now_experience',
    'workspace',
    // Analytics & Reporting
    'analytics',
    // AI & Automation
    'virtual_agent',
    'ai_ml',
    // Applications
    'service_catalog',
    'knowledge',
    'employee_center',
    'customer_service',
    'cmdb',
    'grc',
    'field_service',
    'apm',
    // Integration & APIs
    'rest_soap',
    'data_import',
    'discovery',
    'service_mapping',
    // Configuration
    'rules_engine',
    'sla_management',
    'navigation',
    'localization',
    'guided_setup',
    'documents',
    'assessments',
    'metrics',
    'scheduled_jobs',
    'interceptors',
    // Security & Admin
    'testing',
    'security',
    'properties',
    'deployment',
    'tables'
  ])).optional().default(['all']).describe('Categories of artifacts to analyze (40+ categories covering 150+ artifact types)')
});

export type AnalyzeInstanceInput = z.infer<typeof analyzeInstanceSchema>;

// ============ ARTIFACT TYPES ============

interface ArtifactSummary {
  type: string;
  count: number;
  customCount: number;
  ootbModifiedCount: number;
  items: ArtifactItem[];
}

interface ArtifactItem {
  sys_id: string;
  name: string;
  table?: string;
  scope?: string;
  active: boolean;
  sys_updated_on?: string;
  sys_created_by?: string;
  isCustom?: boolean;
  isOotbModified?: boolean;
}

interface InstanceAnalysis {
  success: boolean;
  timestamp: string;
  instanceUrl: string;
  scope: string;
  summary: {
    totalArtifacts: number;
    totalCustom: number;
    totalOotbModified: number;
    artifactsByType: Record<string, number>;
    artifactsByCategory: Record<string, number>;
  };
  artifacts: Record<string, ArtifactSummary>;
  recommendations: string[];
}

// ============ ARTIFACT CATEGORY DEFINITIONS ============
//
// EXTENSIBILITY GUIDE:
// ====================
// This analyzer is designed to be easily extended when new ServiceNow artifact types are introduced.
//
// TO ADD A NEW ARTIFACT TYPE TO AN EXISTING CATEGORY:
// 1. Add a new entry to the appropriate category array in ARTIFACT_DEFINITIONS below
// 2. Specify: { table: 'table_name', type: 'Display Name', nameField: 'field_for_name' }
// 3. Optional: Add tableField (for table-specific artifacts), additionalFields, additionalQuery
//
// TO ADD A NEW CATEGORY:
// 1. Add the category name to the 'categories' enum in analyzeInstanceSchema (line ~36)
// 2. Add a new array entry in ARTIFACT_DEFINITIONS below with the category key
// 3. Update the tool description in index.ts to document the new category
// 4. Optionally add recommendations in generateRecommendations() function
// 5. Optionally add health score factors in calculateHealthScore() function
//
// EXAMPLE - Adding a new "App Engine Studio" category:
// ```
// app_engine_studio: [
//   { table: 'sys_appbuilder_application', type: 'AES Applications', nameField: 'name' },
//   { table: 'sys_appbuilder_table', type: 'AES Tables', nameField: 'name' },
// ],
// ```
//
// The system handles missing tables gracefully - if a table doesn't exist (plugin not installed),
// it simply returns an empty result for that artifact type without failing.
//

interface ArtifactDefinition {
  table: string;
  type: string;
  nameField: string;
  tableField?: string;
  additionalFields?: string[];
  additionalQuery?: string;
}

const ARTIFACT_DEFINITIONS: Record<string, ArtifactDefinition[]> = {
  server_scripts: [
    { table: 'sys_script', type: 'Business Rules', nameField: 'name', tableField: 'collection' },
    { table: 'sys_script_include', type: 'Script Includes', nameField: 'name' },
    { table: 'sys_script_fix', type: 'Fix Scripts', nameField: 'name' },
    { table: 'sysevent_script_action', type: 'Script Actions', nameField: 'name' },
    { table: 'sys_processor', type: 'Processors', nameField: 'name' },
    { table: 'sysauto_script', type: 'Scheduled Jobs', nameField: 'name' },
    { table: 'ecc_agent_script_include', type: 'MID Server Script Includes', nameField: 'name' },
    { table: 'sys_script_validator', type: 'Script Validators', nameField: 'name' },
  ],
  client_scripts: [
    { table: 'sys_script_client', type: 'Client Scripts', nameField: 'name', tableField: 'table' },
    { table: 'sys_ui_script', type: 'UI Scripts', nameField: 'name' },
    { table: 'sys_ui_macro', type: 'UI Macros', nameField: 'name' },
    { table: 'catalog_script_client', type: 'Catalog Client Scripts', nameField: 'name' },
    { table: 'expert_script_client', type: 'Wizard Client Scripts', nameField: 'name' },
  ],
  ui: [
    { table: 'sys_ui_policy', type: 'UI Policies', nameField: 'short_description', tableField: 'table' },
    { table: 'sys_ui_action', type: 'UI Actions', nameField: 'name', tableField: 'table' },
    { table: 'sys_ui_page', type: 'UI Pages', nameField: 'name' },
    { table: 'sys_ui_form', type: 'Form Layouts', nameField: 'name', tableField: 'table' },
    { table: 'sys_ui_list', type: 'List Layouts', nameField: 'name', tableField: 'name' },
    { table: 'sys_ui_view', type: 'Views', nameField: 'name' },
    { table: 'sys_ui_formatter', type: 'Formatters', nameField: 'name' },
    { table: 'sys_ui_context_menu', type: 'Context Menus', nameField: 'name' },
    { table: 'sys_ui_related_list', type: 'Related Lists', nameField: 'name' },
    { table: 'sys_ui_section', type: 'Form Sections', nameField: 'caption' },
    { table: 'sys_ui_list_control', type: 'List Controls', nameField: 'name' },
    { table: 'sys_ui_style', type: 'Field Styles', nameField: 'name' },
    { table: 'sys_ui_message', type: 'UI Messages', nameField: 'key' },
    { table: 'sys_ui_hp', type: 'Homepages', nameField: 'title' },
    { table: 'sys_ui_notification', type: 'UI Notifications', nameField: 'name' },
  ],
  flow_designer: [
    { table: 'sys_hub_flow', type: 'Flows', nameField: 'name' },
    { table: 'sys_hub_action_type_definition', type: 'Flow Actions', nameField: 'name' },
    { table: 'sys_hub_trigger_definition', type: 'Flow Triggers', nameField: 'name' },
    { table: 'sys_hub_sub_flow', type: 'Subflows', nameField: 'name' },
    { table: 'sys_hub_flow_input', type: 'Flow Inputs', nameField: 'name' },
    { table: 'sys_hub_flow_output', type: 'Flow Outputs', nameField: 'name' },
  ],
  process_automation: [
    { table: 'sys_pd_playbook', type: 'Playbooks', nameField: 'name' },
    { table: 'sys_decision', type: 'Decision Tables', nameField: 'name' },
    { table: 'sys_decision_question', type: 'Decision Questions', nameField: 'name' },
    { table: 'sn_doc_task_type', type: 'Document Task Types', nameField: 'name' },
  ],
  integration_hub: [
    { table: 'sys_hub_spoke', type: 'Spokes', nameField: 'name' },
    { table: 'sys_alias', type: 'Connection Aliases', nameField: 'name' },
    { table: 'sys_connection', type: 'Connections', nameField: 'name' },
    { table: 'sys_credential', type: 'Credentials', nameField: 'name' },
    { table: 'sys_certificate', type: 'Certificates', nameField: 'name' },
  ],
  legacy_workflows: [
    { table: 'wf_workflow', type: 'Workflows', nameField: 'name', tableField: 'table' },
    { table: 'wf_activity', type: 'Workflow Activities', nameField: 'name' },
    { table: 'wf_workflow_version', type: 'Workflow Versions', nameField: 'name' },
    { table: 'wf_stage', type: 'Workflow Stages', nameField: 'name' },
  ],
  events: [
    { table: 'sysevent_register', type: 'Event Registry', nameField: 'event_name' },
    { table: 'sysevent_script_action', type: 'Script Actions (Events)', nameField: 'name' },
    { table: 'sys_trigger', type: 'Scheduled Triggers', nameField: 'name' },
  ],
  email: [
    { table: 'sysevent_email_action', type: 'Notifications', nameField: 'name', tableField: 'collection' },
    { table: 'sys_script_email', type: 'Email Scripts', nameField: 'name' },
    { table: 'sysevent_email_template', type: 'Email Templates', nameField: 'name' },
    { table: 'sysevent_in_email_action', type: 'Inbound Email Actions', nameField: 'name' },
    { table: 'sys_email_layout', type: 'Email Layouts', nameField: 'name' },
    { table: 'cmn_notif_device', type: 'Notification Devices', nameField: 'name' },
  ],
  service_portal: [
    { table: 'sp_widget', type: 'Widgets', nameField: 'name' },
    { table: 'sp_page', type: 'Portal Pages', nameField: 'title' },
    { table: 'sp_portal', type: 'Portals', nameField: 'title' },
    { table: 'sp_theme', type: 'Themes', nameField: 'name' },
    { table: 'sp_angular_provider', type: 'Angular Providers', nameField: 'name' },
    { table: 'sp_css', type: 'CSS Includes', nameField: 'name' },
    { table: 'sp_js_include', type: 'JS Includes', nameField: 'name' },
    { table: 'sp_header_footer', type: 'Headers/Footers', nameField: 'name' },
  ],
  now_experience: [
    { table: 'sys_ux_page_registry', type: 'UX Applications', nameField: 'title' },
    { table: 'sys_ux_page', type: 'UX Pages', nameField: 'title' },
    { table: 'sys_ux_macroponent', type: 'Macroponents', nameField: 'name' },
    { table: 'sys_ux_client_script', type: 'UX Client Scripts', nameField: 'name' },
    { table: 'sys_ux_data_broker_definition', type: 'Data Brokers', nameField: 'name' },
    { table: 'sys_ux_event', type: 'UX Events', nameField: 'name' },
    { table: 'sys_ux_theme', type: 'UX Themes', nameField: 'name' },
    { table: 'sys_ux_lib_component', type: 'UX Library Components', nameField: 'name' },
    { table: 'sys_ux_screen_type', type: 'UX Screen Types', nameField: 'name' },
  ],
  workspace: [
    { table: 'sys_aw_master_config', type: 'Workspace Configs', nameField: 'name' },
    { table: 'sys_aw_form_config', type: 'Workspace Form Configs', nameField: 'name' },
    { table: 'sys_aw_list_config', type: 'Workspace List Configs', nameField: 'name' },
    { table: 'sys_aw_related_list', type: 'Workspace Related Lists', nameField: 'name' },
    { table: 'sys_aw_table_config', type: 'Workspace Table Configs', nameField: 'name' },
    { table: 'aw_record_page', type: 'Workspace Record Pages', nameField: 'name' },
  ],
  analytics: [
    { table: 'sys_report', type: 'Reports', nameField: 'title' },
    { table: 'sys_report_source', type: 'Report Sources', nameField: 'name' },
    { table: 'pa_dashboards', type: 'PA Dashboards', nameField: 'name' },
    { table: 'pa_indicators', type: 'PA Indicators (KPIs)', nameField: 'name' },
    { table: 'pa_breakdowns', type: 'PA Breakdowns', nameField: 'name' },
    { table: 'pa_widgets', type: 'PA Widgets', nameField: 'name' },
    { table: 'pa_scorecards', type: 'PA Scorecards', nameField: 'name' },
    { table: 'sys_ui_hp_publisher', type: 'Homepage Widgets', nameField: 'name' },
    { table: 'sys_portal_page', type: 'Portal Pages (Legacy)', nameField: 'title' },
  ],
  virtual_agent: [
    { table: 'sys_cs_topic', type: 'VA Topics', nameField: 'name' },
    { table: 'sys_cs_topic_goal', type: 'VA Topic Goals', nameField: 'name' },
    { table: 'sys_nlu_model', type: 'NLU Models', nameField: 'name' },
    { table: 'sys_nlu_intent', type: 'NLU Intents', nameField: 'name' },
    { table: 'sys_nlu_utterance', type: 'NLU Utterances', nameField: 'name' },
  ],
  service_catalog: [
    { table: 'sc_cat_item', type: 'Catalog Items', nameField: 'name' },
    { table: 'sc_category', type: 'Catalog Categories', nameField: 'title' },
    { table: 'sc_cat_item_producer', type: 'Record Producers', nameField: 'name' },
    { table: 'item_option_new', type: 'Catalog Variables', nameField: 'name' },
    { table: 'item_option_new_set', type: 'Variable Sets', nameField: 'name' },
    { table: 'catalog_ui_policy', type: 'Catalog UI Policies', nameField: 'short_description' },
    { table: 'sc_cat_item_guide', type: 'Order Guides', nameField: 'name' },
    { table: 'sc_cat_item_content', type: 'Content Items', nameField: 'name' },
  ],
  knowledge: [
    { table: 'kb_knowledge', type: 'Knowledge Articles', nameField: 'short_description' },
    { table: 'kb_knowledge_base', type: 'Knowledge Bases', nameField: 'title' },
    { table: 'kb_category', type: 'KB Categories', nameField: 'label' },
    { table: 'kb_template', type: 'KB Templates', nameField: 'name' },
  ],
  employee_center: [
    { table: 'sn_hr_sp_portal', type: 'HR Service Portals', nameField: 'title' },
    { table: 'sn_hr_core_case', type: 'HR Case Types', nameField: 'name' },
    { table: 'sn_hr_core_topic', type: 'HR Topics', nameField: 'name' },
    { table: 'sn_hr_core_content_block', type: 'HR Content Blocks', nameField: 'name' },
  ],
  customer_service: [
    { table: 'csm_consumer', type: 'CSM Consumers', nameField: 'name' },
    { table: 'csm_case_type', type: 'CSM Case Types', nameField: 'name' },
    { table: 'sn_customerservice_case', type: 'CSM Cases', nameField: 'number' },
  ],
  cmdb: [
    { table: 'cmdb_ci', type: 'CMDB CI Types', nameField: 'name' },
    { table: 'cmdb_rel_type', type: 'CMDB Relationship Types', nameField: 'name' },
    { table: 'cmdb_identifier', type: 'CMDB Identification Rules', nameField: 'name' },
    { table: 'cmdb_ci_service', type: 'Business Services', nameField: 'name' },
  ],
  rest_soap: [
    { table: 'sys_rest_message', type: 'REST Messages', nameField: 'name' },
    { table: 'sys_rest_message_fn', type: 'REST Message Functions', nameField: 'function_name' },
    { table: 'sys_ws_definition', type: 'Scripted REST APIs', nameField: 'name' },
    { table: 'sys_ws_operation', type: 'Scripted REST Resources', nameField: 'name' },
    { table: 'sys_soap_message', type: 'SOAP Messages', nameField: 'name' },
    { table: 'sys_soap_message_function', type: 'SOAP Message Functions', nameField: 'function_name' },
  ],
  data_import: [
    { table: 'sys_transform_map', type: 'Transform Maps', nameField: 'name' },
    { table: 'sys_data_source', type: 'Data Sources', nameField: 'name' },
    { table: 'scheduled_import_set', type: 'Scheduled Imports', nameField: 'name' },
    { table: 'sys_import_set_row', type: 'Import Set Tables', nameField: 'sys_import_set' },
  ],
  testing: [
    { table: 'sys_atf_test', type: 'ATF Tests', nameField: 'name' },
    { table: 'sys_atf_test_suite', type: 'ATF Test Suites', nameField: 'name' },
    { table: 'sys_atf_step', type: 'ATF Test Steps', nameField: 'name' },
  ],
  security: [
    { table: 'sys_security_acl', type: 'ACLs', nameField: 'name' },
    { table: 'sys_data_policy2', type: 'Data Policies', nameField: 'short_description' },
    { table: 'sys_user_role', type: 'Roles', nameField: 'name' },
    { table: 'sys_user_has_role', type: 'Role Assignments', nameField: 'role' },
  ],
  properties: [
    { table: 'sys_properties', type: 'System Properties', nameField: 'name' },
    { table: 'sys_properties_category', type: 'Property Categories', nameField: 'name' },
  ],
  tables: [
    { table: 'sys_db_object', type: 'Custom Tables', nameField: 'label', additionalQuery: 'sys_scope!=global^nameNOT LIKEsys_%^nameNOT LIKEwf_%^nameNOT LIKEv_%' },
    { table: 'sys_dictionary', type: 'Dictionary Entries', nameField: 'column_label', tableField: 'name' },
    { table: 'sys_db_view', type: 'Database Views', nameField: 'name' },
    { table: 'sys_m2m', type: 'M2M Relationships', nameField: 'name' },
  ],
  // SLA & Contract Management
  sla_management: [
    { table: 'contract_sla', type: 'SLA Definitions', nameField: 'name' },
    { table: 'sla_condition_class', type: 'SLA Condition Classes', nameField: 'name' },
    { table: 'cmn_relative_duration', type: 'Relative Durations', nameField: 'name' },
    { table: 'service_offering', type: 'Service Offerings', nameField: 'name' },
  ],
  // Rules Engine (Assignment, Approval, Data Lookup)
  rules_engine: [
    { table: 'sysrule_assignment', type: 'Assignment Rules', nameField: 'name' },
    { table: 'sysrule_approval', type: 'Approval Rules', nameField: 'name' },
    { table: 'sysrule_escalate', type: 'Escalation Rules', nameField: 'name' },
    { table: 'dl_definition', type: 'Data Lookup Definitions', nameField: 'name' },
    { table: 'dl_matcher', type: 'Data Lookup Matcher Rules', nameField: 'name' },
    { table: 'sysrule', type: 'System Rules', nameField: 'name' },
    { table: 'sysrule_view', type: 'View Rules', nameField: 'name' },
  ],
  // Navigation & Menus
  navigation: [
    { table: 'sys_app_application', type: 'Application Menus', nameField: 'title' },
    { table: 'sys_app_module', type: 'Modules', nameField: 'title' },
    { table: 'sys_app_category', type: 'Application Categories', nameField: 'name' },
    { table: 'sys_perspective', type: 'Perspectives', nameField: 'name' },
    { table: 'sys_ux_app_config', type: 'UX App Configurations', nameField: 'name' },
  ],
  // Discovery & MID Server
  discovery: [
    { table: 'discovery_schedule', type: 'Discovery Schedules', nameField: 'name' },
    { table: 'discovery_probes', type: 'Discovery Probes', nameField: 'name' },
    { table: 'discovery_sensors', type: 'Discovery Sensors', nameField: 'name' },
    { table: 'sa_pattern', type: 'Discovery Patterns', nameField: 'name' },
    { table: 'ecc_agent', type: 'MID Servers', nameField: 'name' },
    { table: 'ecc_agent_script_include', type: 'MID Server Script Includes', nameField: 'name' },
    { table: 'sa_credential', type: 'Discovery Credentials', nameField: 'name' },
  ],
  // AI & Machine Learning
  ai_ml: [
    { table: 'ml_solution', type: 'ML Solutions', nameField: 'name' },
    { table: 'ml_capability_definition', type: 'ML Capabilities', nameField: 'name' },
    { table: 'sys_search_context_config', type: 'AI Search Configs', nameField: 'name' },
    { table: 'cxs_table_config', type: 'Search Sources', nameField: 'name' },
    { table: 'sys_rte_eb_action', type: 'Agent Assist Actions', nameField: 'name' },
  ],
  // Documents & Templates
  documents: [
    { table: 'sys_template', type: 'Templates', nameField: 'name' },
    { table: 'sys_template_document', type: 'Document Templates', nameField: 'name' },
    { table: 'content_block_programmatic', type: 'Content Blocks', nameField: 'name' },
    { table: 'sys_embedded_help_content', type: 'Embedded Help', nameField: 'name' },
  ],
  // Assessments & Surveys
  assessments: [
    { table: 'asmt_metric_type', type: 'Assessment Metric Types', nameField: 'name' },
    { table: 'asmt_metric', type: 'Assessment Metrics', nameField: 'name' },
    { table: 'asmt_metric_category', type: 'Assessment Categories', nameField: 'name' },
    { table: 'asmt_template', type: 'Assessment Templates', nameField: 'name' },
    { table: 'survey_template', type: 'Survey Templates', nameField: 'name' },
  ],
  // GRC (Governance, Risk, Compliance)
  grc: [
    { table: 'sn_grc_policy', type: 'GRC Policies', nameField: 'name' },
    { table: 'sn_risk_risk', type: 'Risks', nameField: 'name' },
    { table: 'sn_compliance_control', type: 'Compliance Controls', nameField: 'name' },
    { table: 'sn_audit_engagement', type: 'Audit Engagements', nameField: 'name' },
    { table: 'sn_grc_profile', type: 'GRC Profiles', nameField: 'name' },
  ],
  // Field Service Management
  field_service: [
    { table: 'fsm_work_order', type: 'Work Order Types', nameField: 'name' },
    { table: 'fsm_agent', type: 'FSM Agents', nameField: 'name' },
    { table: 'fsm_territory', type: 'Territories', nameField: 'name' },
    { table: 'sn_fsm_dispatcher_config', type: 'Dispatcher Configs', nameField: 'name' },
  ],
  // Application Portfolio Management
  apm: [
    { table: 'cmdb_ci_business_app', type: 'Business Applications', nameField: 'name' },
    { table: 'sn_apm_app_assessment', type: 'App Assessments', nameField: 'name' },
  ],
  // Localization & Translation
  localization: [
    { table: 'sys_documentation', type: 'Field Labels', nameField: 'label' },
    { table: 'sys_translated', type: 'Translated Names/Fields', nameField: 'name' },
    { table: 'sys_translated_text', type: 'Translated Text', nameField: 'name' },
    { table: 'sys_choice', type: 'Choice Lists', nameField: 'label' },
  ],
  // Guided Setup & Wizards
  guided_setup: [
    { table: 'gsw_content', type: 'Guided Setup Content', nameField: 'name' },
    { table: 'gsw_content_group', type: 'Guided Setup Groups', nameField: 'name' },
    { table: 'expert', type: 'Wizards', nameField: 'name' },
    { table: 'expert_panel', type: 'Wizard Panels', nameField: 'name' },
  ],
  // Update Sets & App Packages
  deployment: [
    { table: 'sys_update_set', type: 'Update Sets', nameField: 'name' },
    { table: 'sys_app', type: 'Scoped Applications', nameField: 'name' },
    { table: 'sys_store_app', type: 'Store Applications', nameField: 'name' },
    { table: 'sys_plugin', type: 'Plugins', nameField: 'name' },
    { table: 'sys_remote_update_set', type: 'Remote Update Sets', nameField: 'name' },
  ],
  // Service Mapping
  service_mapping: [
    { table: 'svc_mapping_pattern', type: 'Service Mapping Patterns', nameField: 'name' },
    { table: 'svc_extension', type: 'Service Extensions', nameField: 'name' },
    { table: 'svc_ci_assoc', type: 'CI Associations', nameField: 'name' },
  ],
  // Metrics & Performance
  metrics: [
    { table: 'metric_definition', type: 'Metric Definitions', nameField: 'name' },
    { table: 'sys_metric', type: 'System Metrics', nameField: 'name' },
    { table: 'syslog_transaction', type: 'Transaction Logs', nameField: 'name' },
  ],
  // Scheduled Jobs Extended
  scheduled_jobs: [
    { table: 'sysauto', type: 'Scheduled Jobs (All)', nameField: 'name' },
    { table: 'sysauto_report', type: 'Scheduled Reports', nameField: 'name' },
    { table: 'sysauto_pa', type: 'Scheduled PA Jobs', nameField: 'name' },
    { table: 'sys_auto_flush', type: 'Table Cleaner Rules', nameField: 'name' },
  ],
  // Interceptors & Redirects
  interceptors: [
    { table: 'sys_run_as', type: 'Run As Configurations', nameField: 'name' },
    { table: 'sys_impex_map', type: 'Import Export Maps', nameField: 'name' },
  ],
};

// ============ HELPER FUNCTIONS ============

/**
 * Determine if an artifact is custom (not from ServiceNow baseline)
 */
function isCustomArtifact(record: Record<string, unknown>): boolean {
  const sysScope = record.sys_scope?.toString() || '';
  const sysPackage = record.sys_package?.toString() || '';
  const sysCreatedBy = record.sys_created_by?.toString() || '';
  
  // Custom if: not in global scope OR created by non-system user OR has custom scope
  const isGlobal = sysScope === 'global' || sysScope === '';
  const isSystemCreated = sysCreatedBy === 'system' || sysCreatedBy === 'admin' || sysCreatedBy === '';
  const hasOotbPackage = sysPackage.startsWith('com.snc') || sysPackage.startsWith('sn_');
  
  // If it has a custom scope (not global and not sn_*), it's custom
  if (sysScope && !sysScope.startsWith('sn_') && sysScope !== 'global') {
    return true;
  }
  
  // If created by a non-system user, likely custom
  if (!isSystemCreated && !hasOotbPackage) {
    return true;
  }
  
  return false;
}

/**
 * Check if OOTB artifact has been modified
 */
function isOotbModified(record: Record<string, unknown>): boolean {
  const sysUpdatedBy = record.sys_updated_by?.toString() || '';
  const sysCreatedBy = record.sys_created_by?.toString() || '';
  const sysPackage = record.sys_package?.toString() || '';
  
  // OOTB modified if: created by system but updated by someone else
  const isSystemCreated = sysCreatedBy === 'system' || sysCreatedBy === 'admin';
  const isUserUpdated = sysUpdatedBy !== 'system' && sysUpdatedBy !== 'admin' && sysUpdatedBy !== '';
  const hasOotbPackage = sysPackage.startsWith('com.snc') || sysPackage.startsWith('sn_');
  
  return (isSystemCreated || hasOotbPackage) && isUserUpdated;
}

/**
 * Build query string with optional scope and active filters
 */
function buildQuery(input: AnalyzeInstanceInput, additionalQuery?: string): string {
  const parts: string[] = [];
  
  if (input.scope) {
    parts.push(`sys_scope=${input.scope}`);
  }
  
  if (!input.includeInactive) {
    parts.push('active=true');
  }
  
  if (additionalQuery) {
    parts.push(additionalQuery);
  }
  
  return parts.join('^');
}

// ============ MAIN IMPLEMENTATION ============

/**
 * Determine which categories to analyze based on input
 */
function getCategoriesToAnalyze(input: AnalyzeInstanceInput): string[] {
  const categories = input.categories || ['all'];

  if (categories.includes('all')) {
    return Object.keys(ARTIFACT_DEFINITIONS);
  }

  return categories.filter(c => c !== 'all' && ARTIFACT_DEFINITIONS[c]);
}

/**
 * Fetch artifacts for a single definition with error handling
 */
async function fetchArtifacts(
  client: ServiceNowClient,
  def: ArtifactDefinition,
  input: AnalyzeInstanceInput
): Promise<{ def: ArtifactDefinition; records: Record<string, unknown>[] }> {
  try {
    const baseFields = [
      'sys_id',
      def.nameField,
      'active',
      'sys_scope',
      'sys_package',
      'sys_created_by',
      'sys_updated_by',
      'sys_updated_on'
    ];

    if (def.tableField) {
      baseFields.push(def.tableField);
    }

    if (def.additionalFields) {
      baseFields.push(...def.additionalFields);
    }

    const records = await client.getRecords(def.table, {
      sysparm_query: buildQuery(input, def.additionalQuery),
      sysparm_fields: [...new Set(baseFields)].join(','),
      sysparm_limit: input.limit
    });

    return { def, records };
  } catch {
    // Table might not exist in this instance (e.g., Flow Designer not installed)
    return { def, records: [] };
  }
}

export async function analyzeInstance(
  client: ServiceNowClient,
  input: AnalyzeInstanceInput
): Promise<InstanceAnalysis> {
  const timestamp = new Date().toISOString();
  const scope = input.scope || 'all';

  // Initialize result structure
  const analysis: InstanceAnalysis = {
    success: true,
    timestamp,
    instanceUrl: client.instanceUrl,
    scope,
    summary: {
      totalArtifacts: 0,
      totalCustom: 0,
      totalOotbModified: 0,
      artifactsByType: {},
      artifactsByCategory: {}
    },
    artifacts: {},
    recommendations: []
  };

  // Helper to process records into artifact items
  const processRecords = (
    records: Record<string, unknown>[],
    nameField: string = 'name',
    tableField?: string
  ): ArtifactItem[] => {
    return records.map(r => {
      const custom = isCustomArtifact(r);
      const ootbMod = isOotbModified(r);
      return {
        sys_id: r.sys_id as string,
        name: r[nameField] as string || 'Unnamed',
        table: tableField ? r[tableField] as string : undefined,
        scope: r.sys_scope?.toString(),
        active: r.active === 'true' || r.active === true,
        sys_updated_on: r.sys_updated_on as string,
        sys_created_by: r.sys_created_by as string,
        isCustom: custom,
        isOotbModified: ootbMod
      };
    });
  };

  // Determine which categories to analyze
  const categoriesToAnalyze = getCategoriesToAnalyze(input);

  // Build list of all artifact definitions to fetch
  const allDefinitions: { category: string; def: ArtifactDefinition }[] = [];
  for (const category of categoriesToAnalyze) {
    const defs = ARTIFACT_DEFINITIONS[category] || [];
    for (const def of defs) {
      allDefinitions.push({ category, def });
    }
  }

  // Fetch all artifacts in parallel (batched to avoid overwhelming the instance)
  const BATCH_SIZE = 10;
  const allResults: { category: string; def: ArtifactDefinition; records: Record<string, unknown>[] }[] = [];

  for (let i = 0; i < allDefinitions.length; i += BATCH_SIZE) {
    const batch = allDefinitions.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async ({ category, def }) => {
        const result = await fetchArtifacts(client, def, input);
        return { category, ...result };
      })
    );
    allResults.push(...batchResults);
  }

  // Process results and build analysis
  const categoryTotals: Record<string, number> = {};

  for (const { category, def, records } of allResults) {
    const items = processRecords(records, def.nameField, def.tableField);
    const customCount = items.filter(i => i.isCustom).length;
    const ootbModifiedCount = items.filter(i => i.isOotbModified).length;

    // Create artifact key from type (sanitized)
    const artifactKey = def.type.toLowerCase().replace(/[^a-z0-9]/g, '_');

    analysis.artifacts[artifactKey] = {
      type: def.type,
      count: records.length,
      customCount,
      ootbModifiedCount,
      items
    };

    // Update category totals
    categoryTotals[category] = (categoryTotals[category] || 0) + records.length;

    // Update summary
    analysis.summary.artifactsByType[def.type] = records.length;
  }

  // Calculate summary totals
  const artifactCategories = Object.values(analysis.artifacts);
  analysis.summary.totalArtifacts = artifactCategories.reduce((sum, cat) => sum + cat.count, 0);
  analysis.summary.totalCustom = artifactCategories.reduce((sum, cat) => sum + cat.customCount, 0);
  analysis.summary.totalOotbModified = artifactCategories.reduce((sum, cat) => sum + cat.ootbModifiedCount, 0);
  analysis.summary.artifactsByCategory = categoryTotals;

  // Generate comprehensive recommendations
  generateRecommendations(analysis);

  return analysis;
}

/**
 * Generate recommendations based on analysis results
 */
function generateRecommendations(analysis: InstanceAnalysis): void {
  const { summary, artifacts } = analysis;

  // OOTB Modification warnings
  if (summary.totalOotbModified > 10) {
    analysis.recommendations.push(
      `⚠️ High OOTB modification count (${summary.totalOotbModified}). Review for upgrade compatibility and consider using skipped updates management.`
    );
  }

  // Business Rules
  const businessRules = artifacts['business_rules'];
  if (businessRules && businessRules.count > 50) {
    analysis.recommendations.push(
      `📊 Large number of Business Rules (${businessRules.count}). Consider consolidating, reviewing execution order, and using async business rules where appropriate.`
    );
  }

  // Client Scripts
  const clientScripts = artifacts['client_scripts'];
  if (clientScripts && clientScripts.count > 30) {
    analysis.recommendations.push(
      `🖥️ Many Client Scripts (${clientScripts.count}). Review for performance impact and consider UI Policies where appropriate.`
    );
  }

  // Legacy Workflows
  const workflows = artifacts['workflows'];
  if (workflows && workflows.count > 0) {
    analysis.recommendations.push(
      `🔄 Legacy Workflows detected (${workflows.count}). Consider migrating to Flow Designer for better maintainability and features.`
    );
  }

  // Fix Scripts
  const fixScripts = artifacts['fix_scripts'];
  if (fixScripts && fixScripts.count > 20) {
    analysis.recommendations.push(
      `🔧 Many Fix Scripts (${fixScripts.count}). Review for one-time scripts that should be deactivated after use.`
    );
  }

  // Custom Tables
  const customTables = artifacts['custom_tables'];
  if (customTables && customTables.count > 50) {
    analysis.recommendations.push(
      `📋 Large number of Custom Tables (${customTables.count}). Review for unused tables and consider data archival strategies.`
    );
  }

  // ACLs
  const acls = artifacts['acls'];
  if (acls && acls.count > 100) {
    analysis.recommendations.push(
      `🔒 Many ACLs (${acls.count}). Review for redundant or conflicting rules and consider role-based consolidation.`
    );
  }

  // Scheduled Jobs
  const scheduledJobs = artifacts['scheduled_jobs'];
  if (scheduledJobs && scheduledJobs.count > 30) {
    analysis.recommendations.push(
      `⏰ Many Scheduled Jobs (${scheduledJobs.count}). Review for overlapping schedules and performance impact.`
    );
  }

  // Service Portal Widgets
  const widgets = artifacts['widgets'];
  if (widgets && widgets.count > 50) {
    analysis.recommendations.push(
      `🎨 Many Service Portal Widgets (${widgets.count}). Consider consolidating similar widgets and using Angular Providers for shared logic.`
    );
  }

  // REST/SOAP Integrations
  const restMessages = artifacts['rest_messages'];
  const soapMessages = artifacts['soap_messages'];
  const totalIntegrations = (restMessages?.count || 0) + (soapMessages?.count || 0);
  if (totalIntegrations > 20) {
    analysis.recommendations.push(
      `🔌 Many integration endpoints (${totalIntegrations}). Consider using Integration Hub for better management and monitoring.`
    );
  }

  // ATF Tests
  const atfTests = artifacts['atf_tests'];
  if (!atfTests || atfTests.count === 0) {
    analysis.recommendations.push(
      `🧪 No ATF Tests found. Consider implementing automated testing for critical business processes.`
    );
  }

  // Transform Maps
  const transformMaps = artifacts['transform_maps'];
  if (transformMaps && transformMaps.count > 30) {
    analysis.recommendations.push(
      `📥 Many Transform Maps (${transformMaps.count}). Review for unused imports and consider consolidation.`
    );
  }

  // Virtual Agent Topics
  const vaTopics = artifacts['va_topics'];
  if (vaTopics && vaTopics.count > 50) {
    analysis.recommendations.push(
      `🤖 Many Virtual Agent Topics (${vaTopics.count}). Review for duplicate intents and consider topic consolidation.`
    );
  }

  // Catalog Items
  const catalogItems = artifacts['catalog_items'];
  if (catalogItems && catalogItems.count > 100) {
    analysis.recommendations.push(
      `📦 Large number of Catalog Items (${catalogItems.count}). Review for outdated items and consider category reorganization.`
    );
  }

  // Knowledge Articles
  const kbArticles = artifacts['knowledge_articles'];
  if (kbArticles && kbArticles.count > 200) {
    analysis.recommendations.push(
      `📚 Many Knowledge Articles (${kbArticles.count}). Consider implementing article retirement policies and quality reviews.`
    );
  }

  // PA Indicators
  const paIndicators = artifacts['pa_indicators__kpis_'];
  if (paIndicators && paIndicators.count > 50) {
    analysis.recommendations.push(
      `📈 Many Performance Analytics Indicators (${paIndicators.count}). Review for redundant KPIs and optimize data collection jobs.`
    );
  }

  // Workspace Configs
  const workspaceConfigs = artifacts['workspace_configs'];
  if (workspaceConfigs && workspaceConfigs.count > 0) {
    const workspaceFormConfigs = artifacts['workspace_form_configs'];
    analysis.recommendations.push(
      `🖥️ Agent Workspace detected (${workspaceConfigs.count} configs, ${workspaceFormConfigs?.count || 0} form configs). Ensure workspace configurations are optimized for performance.`
    );
  }

  // Now Experience/UI Builder
  const uxApps = artifacts['ux_applications'];
  const macroponents = artifacts['macroponents'];
  if (macroponents && macroponents.count > 30) {
    analysis.recommendations.push(
      `🎨 Many custom Macroponents (${macroponents.count}). Review for reusable patterns and consider shared component libraries.`
    );
  }

  // Portal Analysis
  const portals = artifacts['portals'];
  const hrPortals = artifacts['hr_service_portals'];
  const totalPortals = (portals?.count || 0) + (hrPortals?.count || 0);
  if (totalPortals > 5) {
    analysis.recommendations.push(
      `🌐 Multiple portals detected (${totalPortals}). Consider consolidating portals to reduce maintenance overhead.`
    );
  }

  // CMDB
  const cmdbCIs = artifacts['cmdb_ci_types'];
  const cmdbRels = artifacts['cmdb_relationship_types'];
  if (cmdbRels && cmdbRels.count > 50) {
    analysis.recommendations.push(
      `🔗 Many CMDB relationship types (${cmdbRels.count}). Review for proper relationship hierarchy and cleanup unused types.`
    );
  }

  // SLA Definitions
  const slaDefinitions = artifacts['sla_definitions'];
  if (slaDefinitions && slaDefinitions.count > 30) {
    analysis.recommendations.push(
      `⏱️ Many SLA Definitions (${slaDefinitions.count}). Review for overlapping SLAs and ensure proper pause/breach conditions.`
    );
  }

  // Assignment Rules
  const assignmentRules = artifacts['assignment_rules'];
  if (assignmentRules && assignmentRules.count > 50) {
    analysis.recommendations.push(
      `📋 Many Assignment Rules (${assignmentRules.count}). Review rule execution order and consider consolidating with Flow Designer.`
    );
  }

  // Discovery
  const discoverySchedules = artifacts['discovery_schedules'];
  const discoveryPatterns = artifacts['discovery_patterns'];
  if (discoverySchedules && discoverySchedules.count > 10) {
    analysis.recommendations.push(
      `🔍 Multiple Discovery Schedules (${discoverySchedules.count}). Review for overlapping schedules and optimize discovery windows.`
    );
  }

  // GRC
  const grcPolicies = artifacts['grc_policies'];
  const risks = artifacts['risks'];
  if (grcPolicies && grcPolicies.count > 0) {
    analysis.recommendations.push(
      `📜 GRC Implementation detected (${grcPolicies.count} policies, ${risks?.count || 0} risks). Ensure proper risk assessment workflows.`
    );
  }

  // Update Sets
  const updateSets = artifacts['update_sets'];
  if (updateSets && updateSets.count > 100) {
    analysis.recommendations.push(
      `📦 Many Update Sets (${updateSets.count}). Consider cleanup of old/completed update sets and implement naming conventions.`
    );
  }

  // Scoped Applications
  const scopedApps = artifacts['scoped_applications'];
  if (scopedApps && scopedApps.count > 20) {
    analysis.recommendations.push(
      `📱 Many Scoped Applications (${scopedApps.count}). Review for unused apps and ensure proper app lifecycle management.`
    );
  }

  // AI/ML
  const mlSolutions = artifacts['ml_solutions'];
  if (mlSolutions && mlSolutions.count > 0) {
    analysis.recommendations.push(
      `🤖 AI/ML Solutions detected (${mlSolutions.count}). Ensure regular model retraining and monitor prediction accuracy.`
    );
  }

  // Data Lookup Rules
  const dlDefinitions = artifacts['data_lookup_definitions'];
  if (dlDefinitions && dlDefinitions.count > 30) {
    analysis.recommendations.push(
      `📊 Many Data Lookup Definitions (${dlDefinitions.count}). Review for performance impact and consider alternatives like dynamic defaults.`
    );
  }

  // Flows
  const flows = artifacts['flows'];
  const subflows = artifacts['subflows'];
  if (flows && flows.count > 100) {
    analysis.recommendations.push(
      `🔄 Many Flows (${flows.count}, ${subflows?.count || 0} subflows). Organize flows by category and implement naming standards.`
    );
  }

  // Overall health score
  const healthScore = calculateHealthScore(analysis);
  analysis.recommendations.unshift(
    `📈 Instance Health Score: ${healthScore}/100 - ${getHealthLabel(healthScore)}`
  );
}

/**
 * Calculate overall instance health score
 */
function calculateHealthScore(analysis: InstanceAnalysis): number {
  let score = 100;
  const { summary, artifacts } = analysis;

  // Deduct for OOTB modifications (major concern)
  score -= Math.min(summary.totalOotbModified * 2, 30);

  // Deduct for legacy workflows
  const workflows = artifacts['workflows'];
  if (workflows) {
    score -= Math.min(workflows.count, 15);
  }

  // Deduct for excessive business rules
  const businessRules = artifacts['business_rules'];
  if (businessRules && businessRules.count > 100) {
    score -= Math.min((businessRules.count - 100) / 10, 10);
  }

  // Deduct for no ATF tests (lack of automated testing)
  const atfTests = artifacts['atf_tests'];
  if (!atfTests || atfTests.count === 0) {
    score -= 10;
  }

  // Deduct for excessive client scripts
  const clientScripts = artifacts['client_scripts'];
  if (clientScripts && clientScripts.count > 50) {
    score -= Math.min((clientScripts.count - 50) / 5, 10);
  }

  // Deduct for many assignment rules (can slow down record creation)
  const assignmentRules = artifacts['assignment_rules'];
  if (assignmentRules && assignmentRules.count > 100) {
    score -= Math.min((assignmentRules.count - 100) / 20, 5);
  }

  // Deduct for excessive update sets (indicates poor housekeeping)
  const updateSets = artifacts['update_sets'];
  if (updateSets && updateSets.count > 500) {
    score -= 5;
  }

  // Bonus for having AI/ML solutions (modern platform usage)
  const mlSolutions = artifacts['ml_solutions'];
  if (mlSolutions && mlSolutions.count > 0) {
    score += 5;
  }

  // Bonus for using Flow Designer over legacy workflows
  const flows = artifacts['flows'];
  if (flows && flows.count > 10 && (!workflows || workflows.count < 5)) {
    score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get health label based on score
 */
function getHealthLabel(score: number): string {
  if (score >= 90) return '🟢 Excellent';
  if (score >= 75) return '🟡 Good';
  if (score >= 60) return '🟠 Fair';
  if (score >= 40) return '🔴 Needs Attention';
  return '⛔ Critical';
}

