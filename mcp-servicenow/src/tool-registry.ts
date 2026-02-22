/**
 * Tool Registry - Reusable library that decouples tool definitions and execution
 * from the MCP transport layer. Used by both the MCP server (stdio) and the web app.
 */

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

/**
 * Tool handler mapping: tool name -> async function(snClient, args) => result
 * This is the core dispatch table, decoupled from MCP transport.
 */
const TOOL_HANDLERS: Record<string, (snClient: ServiceNowClient, args: unknown) => Promise<unknown>> = {
  // Connection
  sn_test_connection: async (c) => connection.testConnection(c),
  sn_get_instance_info: async (c) => connection.getInstanceInfo(c),
  sn_get_tables: async (c, a) => connection.getTables(c, connection.getTablesSchema.parse(a)),
  sn_get_table_schema: async (c, a) => connection.getTableSchema(c, connection.getTableSchemaInputSchema.parse(a)),

  // Records
  sn_query_records: async (c, a) => records.queryRecords(c, records.queryRecordsSchema.parse(a)),
  sn_get_record: async (c, a) => records.getRecord(c, records.getRecordSchema.parse(a)),
  sn_create_record: async (c, a) => records.createRecord(c, records.createRecordSchema.parse(a)),
  sn_update_record: async (c, a) => records.updateRecord(c, records.updateRecordSchema.parse(a)),

  // Business Rules
  sn_get_business_rules: async (c, a) => scripts.getBusinessRules(c, scripts.getBusinessRulesSchema.parse(a)),
  sn_create_business_rule: async (c, a) => scripts.createBusinessRule(c, scripts.createBusinessRuleSchema.parse(a)),

  // Script Includes
  sn_get_script_includes: async (c, a) => scripts.getScriptIncludes(c, scripts.getScriptIncludesSchema.parse(a)),
  sn_create_script_include: async (c, a) => scripts.createScriptInclude(c, scripts.createScriptIncludeSchema.parse(a)),

  // Client Scripts
  sn_get_client_scripts: async (c, a) => scripts.getClientScripts(c, scripts.getClientScriptsSchema.parse(a)),
  sn_create_client_script: async (c, a) => scripts.createClientScript(c, scripts.createClientScriptSchema.parse(a)),

  // Update Sets
  sn_list_update_sets: async (c, a) => updateSets.listUpdateSets(c, updateSets.listUpdateSetsSchema.parse(a)),
  sn_get_update_set: async (c, a) => updateSets.getUpdateSet(c, updateSets.getUpdateSetSchema.parse(a)),
  sn_create_update_set: async (c, a) => updateSets.createUpdateSet(c, updateSets.createUpdateSetSchema.parse(a)),
  sn_complete_update_set: async (c, a) => updateSets.completeUpdateSet(c, updateSets.completeUpdateSetSchema.parse(a)),
  sn_get_update_set_contents: async (c, a) => updateSets.getUpdateSetContents(c, updateSets.getUpdateSetContentsSchema.parse(a)),

  // UI Policies & Actions
  sn_get_ui_policies: async (c, a) => uiPolicies.getUiPolicies(c, uiPolicies.getUiPoliciesSchema.parse(a)),
  sn_create_ui_policy: async (c, a) => uiPolicies.createUiPolicy(c, uiPolicies.createUiPolicySchema.parse(a)),
  sn_get_ui_actions: async (c, a) => uiPolicies.getUiActions(c, uiPolicies.getUiActionsSchema.parse(a)),
  sn_create_ui_action: async (c, a) => uiPolicies.createUiAction(c, uiPolicies.createUiActionSchema.parse(a)),

  // Notifications & Events
  sn_get_notifications: async (c, a) => notifications.getNotifications(c, notifications.getNotificationsSchema.parse(a)),
  sn_create_notification: async (c, a) => notifications.createNotification(c, notifications.createNotificationSchema.parse(a)),
  sn_get_events: async (c, a) => notifications.getEvents(c, notifications.getEventsSchema.parse(a)),
  sn_create_event: async (c, a) => notifications.createEvent(c, notifications.createEventSchema.parse(a)),

  // ACLs & Roles
  sn_get_acls: async (c, a) => acls.getAcls(c, acls.getAclsSchema.parse(a)),
  sn_create_acl: async (c, a) => acls.createAcl(c, acls.createAclSchema.parse(a)),
  sn_get_roles: async (c, a) => acls.getRoles(c, acls.getRolesSchema.parse(a)),
  sn_create_role: async (c, a) => acls.createRole(c, acls.createRoleSchema.parse(a)),

  // Catalog
  sn_get_catalog_items: async (c, a) => catalog.getCatalogItems(c, catalog.getCatalogItemsSchema.parse(a)),
  sn_get_catalog_item: async (c, a) => catalog.getCatalogItem(c, catalog.getCatalogItemSchema.parse(a)),
  sn_get_catalog_variables: async (c, a) => catalog.getCatalogVariables(c, catalog.getCatalogVariablesSchema.parse(a)),
  sn_get_requests: async (c, a) => catalog.getRequests(c, catalog.getRequestsSchema.parse(a)),

  // Scheduled Jobs & Fix Scripts
  sn_get_scheduled_jobs: async (c, a) => scheduledJobs.getScheduledJobs(c, scheduledJobs.getScheduledJobsSchema.parse(a)),
  sn_create_scheduled_job: async (c, a) => scheduledJobs.createScheduledJob(c, scheduledJobs.createScheduledJobSchema.parse(a)),
  sn_get_fix_scripts: async (c, a) => scheduledJobs.getFixScripts(c, scheduledJobs.getFixScriptsSchema.parse(a)),
  sn_create_fix_script: async (c, a) => scheduledJobs.createFixScript(c, scheduledJobs.createFixScriptSchema.parse(a)),
  sn_run_fix_script: async (c, a) => scheduledJobs.runFixScript(c, scheduledJobs.runFixScriptSchema.parse(a)),

  // Brownfield: Instance Intelligence
  sn_analyze_instance: async (c, a) => instanceAnalyzer.analyzeInstance(c, instanceAnalyzer.analyzeInstanceSchema.parse(a)),
  sn_detect_ootb_overrides: async (c, a) => ootbOverrideDetector.detectOotbOverrides(c, ootbOverrideDetector.detectOotbOverridesSchema.parse(a)),
  sn_get_dependency_graph: async (c, a) => dependencyGraph.getDependencyGraph(c, dependencyGraph.getDependencyGraphSchema.parse(a)),
  sn_find_anti_patterns: async (c, a) => antiPatternDetector.findAntiPatterns(c, antiPatternDetector.findAntiPatternsSchema.parse(a)),
  sn_code_quality_score: async (c, a) => codeQualityAnalyzer.getCodeQualityScore(c, codeQualityAnalyzer.codeQualityScoreSchema.parse(a)),
  sn_find_dead_code: async (c, a) => deadCodeFinder.findDeadCode(c, deadCodeFinder.findDeadCodeSchema.parse(a)),

  // Guardrails & Impact Analysis
  sn_preview_change_impact: async (c, a) => changeImpactAnalyzer.previewChangeImpact(c, changeImpactAnalyzer.previewChangeImpactSchema.parse(a)),
  sn_detect_conflicts: async (c, a) => conflictDetector.detectConflicts(c, conflictDetector.detectConflictsSchema.parse(a)),
  sn_validate_change: async (c, a) => guardrailValidator.validateChange(c, guardrailValidator.validateChangeSchema.parse(a)),
  sn_check_breaking_changes: async (c, a) => breakingChangeDetector.checkBreakingChanges(c, breakingChangeDetector.checkBreakingChangesSchema.parse(a)),
  sn_log_change: async (c, a) => auditLogger.logChange(c, auditLogger.logChangeSchema.parse(a)),
  sn_get_audit_history: async (c, a) => auditLogger.getAuditHistory(c, auditLogger.getAuditHistorySchema.parse(a)),

  // Persona & 4G Framework
  sn_detect_persona: async (c, a) => personaEngine.detectPersona(c, personaEngine.detectPersonaSchema.parse(a)),
  sn_apply_4g_framework: async (c, a) => fourGFramework.apply4GFramework(c, fourGFramework.apply4GFrameworkSchema.parse(a)),
  sn_request_approval: async (c, a) => approvalGate.requestApproval(c, approvalGate.requestApprovalSchema.parse(a)),
  sn_process_approval: async (c, a) => approvalGate.processApproval(c, approvalGate.processApprovalSchema.parse(a)),
  sn_get_approval_status: async (c, a) => approvalGate.getApprovalStatus(c, approvalGate.getApprovalStatusSchema.parse(a)),

  // Multi-Instance & Predictive
  sn_register_instance: async (c, a) => instanceRegistry.registerInstance(c, instanceRegistry.registerInstanceSchema.parse(a)),
  sn_list_instances: async (c, a) => instanceRegistry.listInstances(c, instanceRegistry.listInstancesSchema.parse(a)),
  sn_compare_instances: async (c, a) => instanceCompare.compareInstances(c, instanceCompare.compareInstancesSchema.parse(a)),
  sn_assess_upgrade_readiness: async (c, a) => upgradeReadiness.assessUpgradeReadiness(c, upgradeReadiness.assessUpgradeReadinessSchema.parse(a)),
  sn_predict_conflicts: async (c, a) => conflictPredictor.predictConflicts(c, conflictPredictor.predictConflictsSchema.parse(a)),
  sn_compare_to_ootb: async (c, a) => ootbBaselineComparator.compareToOotb(c, ootbBaselineComparator.compareToOotbSchema.parse(a)),

  // Recommendation Engine
  sn_get_fix_recommendations: async (c, a) => recommendationEngine.getFixRecommendations(c, recommendationEngine.getFixRecommendationsSchema.parse(a)),
  sn_get_best_practices: async (c, a) => recommendationEngine.getBestPractices(c, recommendationEngine.getBestPracticesSchema.parse(a)),
  sn_get_code_templates: async (c, a) => recommendationEngine.getCodeTemplates(c, recommendationEngine.getCodeTemplatesSchema.parse(a)),

  // Dashboard & Reports
  sn_generate_report: async (c, a) => dashboardReporter.generateReport(c, dashboardReporter.generateReportSchema.parse(a)),
  sn_get_dashboard_data: async (c, a) => dashboardReporter.getDashboardData(c, dashboardReporter.getDashboardDataSchema.parse(a)),

  // Multi-Instance Manager v2
  sn_register_instance_v2: async (c, a) => multiInstanceManager.registerInstanceEnhanced(c, a as {
    instanceId: string; name: string; url: string;
    environment: 'dev' | 'test' | 'stage' | 'prod';
    username: string; password: string;
  }),
  sn_switch_instance: async (c, a) => multiInstanceManager.switchInstance(c, multiInstanceManager.switchInstanceSchema.parse(a)),
  sn_get_active_instance: async (c) => multiInstanceManager.getActiveInstance(c, {}),
  sn_test_instance_connection: async (c, a) => multiInstanceManager.testInstanceConnection(c, multiInstanceManager.testInstanceConnectionSchema.parse(a)),
  sn_diff_artifact: async (c, a) => multiInstanceManager.diffArtifact(c, multiInstanceManager.diffArtifactSchema.parse(a)),

  // Promotion Workflow
  sn_create_promotion_package: async (c, a) => promotionWorkflow.createPromotionPackage(c, promotionWorkflow.createPromotionPackageSchema.parse(a)),
  sn_preview_promotion: async (c, a) => promotionWorkflow.previewPromotion(c, promotionWorkflow.previewPromotionSchema.parse(a)),
  sn_validate_promotion: async (c, a) => promotionWorkflow.validatePromotion(c, promotionWorkflow.validatePromotionSchema.parse(a)),
  sn_execute_promotion: async (c, a) => promotionWorkflow.executePromotion(c, promotionWorkflow.executePromotionSchema.parse(a)),
  sn_rollback_promotion: async (c, a) => promotionWorkflow.rollbackPromotion(c, promotionWorkflow.rollbackPromotionSchema.parse(a)),
  sn_list_promotion_history: async (c, a) => promotionWorkflow.listPromotionHistory(c, promotionWorkflow.listPromotionHistorySchema.parse(a)),
  sn_list_promotion_packages: async (c) => promotionWorkflow.listPromotionPackages(c, {}),
};

/**
 * Execute a tool by name with the given ServiceNow client and arguments.
 * This is the main entry point for the web app backend.
 */
export async function executeToolCall(
  toolName: string,
  args: unknown,
  snClient: ServiceNowClient
): Promise<unknown> {
  const handler = TOOL_HANDLERS[toolName];
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return handler(snClient, args || {});
}

/**
 * Get all tool names available in the registry.
 */
export function getToolNames(): string[] {
  return Object.keys(TOOL_HANDLERS);
}

/**
 * Check if a tool exists in the registry.
 */
export function hasTool(toolName: string): boolean {
  return toolName in TOOL_HANDLERS;
}

// Re-export ServiceNowClient and types for convenience
export { ServiceNowClient } from './client/sn-client.js';
export type { SNConfig } from './types/index.js';

// Re-export tool definitions and Anthropic converter
export { ALL_TOOLS, getAnthropicToolDefinitions } from './tool-definitions.js';
export type { ToolDefinition } from './tool-definitions.js';

