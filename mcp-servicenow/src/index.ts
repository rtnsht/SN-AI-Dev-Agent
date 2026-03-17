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
import * as scopedApps from './tools/scoped-apps.js';
import * as servicePortal from './tools/service-portal.js';
import { ALL_TOOLS } from './tool-definitions.js';

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
      case 'sn_set_current_update_set':
        result = await updateSets.setCurrentUpdateSet(snClient, updateSets.setCurrentUpdateSetSchema.parse(args));
        break;
      case 'sn_complete_update_set':
        result = await updateSets.completeUpdateSet(snClient, updateSets.completeUpdateSetSchema.parse(args));
        break;
      case 'sn_get_update_set_contents':
        result = await updateSets.getUpdateSetContents(snClient, updateSets.getUpdateSetContentsSchema.parse(args));
        break;
      case 'sn_move_to_update_set':
        result = await updateSets.moveToUpdateSet(snClient, updateSets.moveToUpdateSetSchema.parse(args));
        break;
      case 'sn_verify_update_set_capture':
        result = await updateSets.verifyUpdateSetCapture(snClient, updateSets.verifyUpdateSetCaptureSchema.parse(args));
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

      // Scoped Application tools
      case 'sn_get_custom_apps':
        result = await scopedApps.getCustomApps(snClient, scopedApps.getCustomAppsSchema.parse(args));
        break;

      case 'sn_get_scope_selection_options':
        result = await scopedApps.getScopeSelectionOptions(snClient, scopedApps.getScopeSelectionOptionsSchema.parse(args));
        break;

      case 'sn_create_custom_app':
        result = await scopedApps.createCustomApp(snClient, scopedApps.createCustomAppSchema.parse(args));
        break;

      // Service Portal tools
      case 'sn_get_sp_widgets':
        result = await servicePortal.getSpWidgets(snClient, servicePortal.getSpWidgetsSchema.parse(args));
        break;
      case 'sn_create_sp_widget':
        result = await servicePortal.createSpWidget(snClient, servicePortal.createSpWidgetSchema.parse(args));
        break;
      case 'sn_get_sp_pages':
        result = await servicePortal.getSpPages(snClient, servicePortal.getSpPagesSchema.parse(args));
        break;
      case 'sn_create_sp_page':
        result = await servicePortal.createSpPage(snClient, servicePortal.createSpPageSchema.parse(args));
        break;
      case 'sn_get_sp_portals':
        result = await servicePortal.getSpPortals(snClient, servicePortal.getSpPortalsSchema.parse(args));
        break;
      case 'sn_create_sp_portal':
        result = await servicePortal.createSpPortal(snClient, servicePortal.createSpPortalSchema.parse(args));
        break;
      case 'sn_get_sp_themes':
        result = await servicePortal.getSpThemes(snClient, servicePortal.getSpThemesSchema.parse(args));
        break;
      case 'sn_create_sp_theme':
        result = await servicePortal.createSpTheme(snClient, servicePortal.createSpThemeSchema.parse(args));
        break;
      case 'sn_get_sp_css':
        result = await servicePortal.getSpCss(snClient, servicePortal.getSpCssSchema.parse(args));
        break;
      case 'sn_create_sp_css':
        result = await servicePortal.createSpCss(snClient, servicePortal.createSpCssSchema.parse(args));
        break;
      case 'sn_get_sp_angular_providers':
        result = await servicePortal.getSpAngularProviders(snClient, servicePortal.getSpAngularProvidersSchema.parse(args));
        break;
      case 'sn_create_sp_angular_provider':
        result = await servicePortal.createSpAngularProvider(snClient, servicePortal.createSpAngularProviderSchema.parse(args));
        break;
      case 'sn_get_sp_header_footers':
        result = await servicePortal.getSpHeaderFooters(snClient, servicePortal.getSpHeaderFootersSchema.parse(args));
        break;
      case 'sn_create_sp_header_footer':
        result = await servicePortal.createSpHeaderFooter(snClient, servicePortal.createSpHeaderFooterSchema.parse(args));
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

