/**
 * OOTB Override Detector
 * 
 * Detects Out-of-the-Box (OOTB) artifacts that have been modified/customized.
 * This is critical for:
 * - Upgrade risk assessment
 * - Identifying technical debt
 * - Understanding instance customization footprint
 * - Managing skipped updates
 * 
 * Key ServiceNow Tables:
 * - sys_update_xml: Customer Updates - tracks ALL customizations
 * - sys_upgrade_history: Upgrade history records
 * - sys_upgrade_history_log: Details of each upgrade including skipped updates
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const detectOotbOverridesSchema = z.object({
  artifactTypes: z.array(z.string()).optional().describe(
    'Filter by artifact types (e.g., sys_script, sys_script_include, sys_ui_policy). Default: all types'
  ),
  tables: z.array(z.string()).optional().describe(
    'Filter by target tables (e.g., incident, change_request). Default: all tables'
  ),
  includeSkippedUpdates: z.boolean().optional().default(true).describe(
    'Include skipped updates from upgrade history'
  ),
  includeUpgradeRisk: z.boolean().optional().default(true).describe(
    'Calculate upgrade risk score for each override'
  ),
  scope: z.string().optional().describe(
    'Filter by application scope (default: all scopes)'
  ),
  limit: z.number().optional().default(500).describe(
    'Maximum number of overrides to return'
  ),
  severity: z.enum(['all', 'critical', 'high', 'medium', 'low']).optional().default('all').describe(
    'Filter by severity level'
  )
});

export type DetectOotbOverridesInput = z.infer<typeof detectOotbOverridesSchema>;

// ============ TYPES ============

interface OotbOverride {
  sys_id: string;
  name: string;
  type: string;
  targetTable: string;
  updateSetName: string;
  updatedBy: string;
  updatedOn: string;
  replaceOnUpgrade: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  upgradeRisk: string;
  recommendation: string;
}

interface SkippedUpdate {
  sys_id: string;
  name: string;
  type: string;
  upgradeVersion: string;
  skippedOn: string;
  reason: string;
  resolved: boolean;
}

interface OverrideAnalysis {
  success: boolean;
  timestamp: string;
  instanceUrl: string;
  summary: {
    totalOverrides: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    skippedUpdatesCount: number;
    overridesByType: Record<string, number>;
    overridesByTable: Record<string, number>;
    upgradeRiskScore: number;
  };
  overrides: OotbOverride[];
  skippedUpdates: SkippedUpdate[];
  recommendations: string[];
}

// ============ SEVERITY CLASSIFICATION ============
// Critical artifact types that pose highest upgrade risk
const CRITICAL_TYPES = [
  'sys_script',           // Business Rules
  'sys_script_include',   // Script Includes
  'sys_security_acl',     // ACLs
  'sys_dictionary',       // Dictionary entries
  'sys_db_object',        // Table definitions
];

const HIGH_TYPES = [
  'sys_ui_policy',        // UI Policies
  'sys_ui_action',        // UI Actions
  'sys_script_client',    // Client Scripts
  'sysevent_email_action', // Notifications
  'sys_ws_definition',    // Scripted REST APIs
];

const MEDIUM_TYPES = [
  'sys_ui_form',          // Form layouts
  'sys_ui_list',          // List layouts
  'sys_ui_view',          // Views
  'sp_widget',            // Service Portal widgets
  'sys_properties',       // System properties
];

// Critical tables that are high-risk to modify
const CRITICAL_TABLES = [
  'incident', 'problem', 'change_request', 'task',
  'sys_user', 'sys_user_group', 'cmdb_ci',
  'sc_req_item', 'sc_request', 'kb_knowledge'
];

// ============ HELPER FUNCTIONS ============

function classifySeverity(type: string, targetTable: string): 'critical' | 'high' | 'medium' | 'low' {
  // Critical if both type and table are critical
  if (CRITICAL_TYPES.includes(type) && CRITICAL_TABLES.includes(targetTable)) {
    return 'critical';
  }
  // Critical if type is critical
  if (CRITICAL_TYPES.includes(type)) {
    return 'high';
  }
  // High if type is high-risk
  if (HIGH_TYPES.includes(type)) {
    return 'medium';
  }
  // Medium if type is medium-risk
  if (MEDIUM_TYPES.includes(type)) {
    return 'medium';
  }
  return 'low';
}

function getUpgradeRisk(severity: string, replaceOnUpgrade: boolean): string {
  if (!replaceOnUpgrade) {
    return 'Protected - Will NOT be replaced on upgrade (manual review needed)';
  }
  switch (severity) {
    case 'critical':
      return 'VERY HIGH - Core functionality at risk during upgrades';
    case 'high':
      return 'HIGH - May cause issues during upgrades';
    case 'medium':
      return 'MEDIUM - Review recommended before upgrades';
    default:
      return 'LOW - Minimal upgrade impact expected';
  }
}

function getRecommendation(type: string, severity: string, replaceOnUpgrade: boolean): string {
  if (!replaceOnUpgrade) {
    return 'This customization is protected from upgrades. Document the business reason and consider if OOTB functionality can meet requirements.';
  }

  switch (severity) {
    case 'critical':
      return 'HIGH PRIORITY: Consider refactoring to use extension points, scoped apps, or less invasive customization patterns. Test thoroughly before each upgrade.';
    case 'high':
      return 'Create a pre-upgrade checklist for this customization. Consider migrating to modern alternatives (e.g., Flow Designer instead of Business Rules).';
    case 'medium':
      return 'Document the customization purpose. Review during upgrade planning.';
    default:
      return 'Low risk. Standard upgrade testing should suffice.';
  }
}

function calculateUpgradeRiskScore(overrides: OotbOverride[], skippedCount: number): number {
  let score = 100;

  // Deduct for critical overrides (heavy penalty)
  const criticalCount = overrides.filter(o => o.severity === 'critical').length;
  score -= criticalCount * 5;

  // Deduct for high overrides
  const highCount = overrides.filter(o => o.severity === 'high').length;
  score -= highCount * 2;

  // Deduct for medium overrides
  const mediumCount = overrides.filter(o => o.severity === 'medium').length;
  score -= mediumCount * 1;

  // Deduct for protected (non-replace-on-upgrade) items
  const protectedCount = overrides.filter(o => !o.replaceOnUpgrade).length;
  score -= protectedCount * 3;

  // Deduct for skipped updates
  score -= skippedCount * 2;

  return Math.max(0, Math.min(100, score));
}

function generateRecommendations(analysis: OverrideAnalysis): void {
  const { summary, overrides } = analysis;

  // Overall risk assessment
  if (summary.upgradeRiskScore >= 80) {
    analysis.recommendations.push('✅ Upgrade Risk: LOW - Instance has minimal OOTB modifications. Upgrades should be straightforward.');
  } else if (summary.upgradeRiskScore >= 60) {
    analysis.recommendations.push('⚠️ Upgrade Risk: MEDIUM - Review critical/high severity overrides before upgrading.');
  } else if (summary.upgradeRiskScore >= 40) {
    analysis.recommendations.push('🔶 Upgrade Risk: HIGH - Significant customizations detected. Plan extensive testing before upgrades.');
  } else {
    analysis.recommendations.push('🔴 Upgrade Risk: CRITICAL - Heavy customization footprint. Consider technical debt reduction before next upgrade.');
  }

  // Critical overrides
  if (summary.criticalCount > 0) {
    analysis.recommendations.push(
      `⛔ ${summary.criticalCount} CRITICAL overrides detected. These modify core platform functionality and pose highest upgrade risk.`
    );
  }

  // Skipped updates
  if (summary.skippedUpdatesCount > 10) {
    analysis.recommendations.push(
      `📋 ${summary.skippedUpdatesCount} skipped updates found. Review and resolve skipped updates in Upgrade Center.`
    );
  }

  // Protected items
  const protectedCount = overrides.filter(o => !o.replaceOnUpgrade).length;
  if (protectedCount > 5) {
    analysis.recommendations.push(
      `🔒 ${protectedCount} items have "Replace on Upgrade" disabled. These require manual reconciliation during upgrades.`
    );
  }

  // By type recommendations
  const typeEntries = Object.entries(summary.overridesByType).sort((a, b) => b[1] - a[1]);
  if (typeEntries.length > 0) {
    const topType = typeEntries[0];
    if (topType[1] > 20) {
      analysis.recommendations.push(
        `📊 Highest customization: ${topType[0]} (${topType[1]} overrides). Consider consolidation or refactoring.`
      );
    }
  }

  // By table recommendations
  const tableEntries = Object.entries(summary.overridesByTable).sort((a, b) => b[1] - a[1]);
  if (tableEntries.length > 0) {
    const topTable = tableEntries[0];
    if (topTable[1] > 15) {
      analysis.recommendations.push(
        `📋 Most customized table: ${topTable[0]} (${topTable[1]} overrides). Document business requirements and review for optimization.`
      );
    }
  }
}

// ============ MAIN EXPORT FUNCTION ============

export async function detectOotbOverrides(
  client: ServiceNowClient,
  input: DetectOotbOverridesInput
): Promise<OverrideAnalysis> {
  const analysis: OverrideAnalysis = {
    success: false,
    timestamp: new Date().toISOString(),
    instanceUrl: client.instanceUrl,
    summary: {
      totalOverrides: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      skippedUpdatesCount: 0,
      overridesByType: {},
      overridesByTable: {},
      upgradeRiskScore: 100,
    },
    overrides: [],
    skippedUpdates: [],
    recommendations: [],
  };

  try {
    // Build query for sys_update_xml (Customer Updates table)
    // This table tracks ALL customizations to OOTB artifacts
    let query = 'ORDERBYDESCsys_updated_on';

    // Filter by artifact types if specified
    if (input.artifactTypes && input.artifactTypes.length > 0) {
      query = `typeIN${input.artifactTypes.join(',')}^${query}`;
    }

    // Filter by scope if specified
    if (input.scope) {
      query = `application.scope=${input.scope}^${query}`;
    }

    // Query sys_update_xml for customer updates
    const customerUpdates = await client.getRecords('sys_update_xml', {
      sysparm_query: query,
      sysparm_limit: input.limit,
      sysparm_fields: 'sys_id,name,type,target_name,update_set,sys_updated_by,sys_updated_on,replace_on_upgrade,application',
    });

    // Process each customer update
    for (const update of customerUpdates) {
      const type = String(update.type || '');
      const targetName = String(update.target_name || update.name || '');
      const targetTable = extractTableFromTargetName(targetName);

      // Filter by tables if specified
      if (input.tables && input.tables.length > 0 && !input.tables.includes(targetTable)) {
        continue;
      }

      const severity = classifySeverity(type, targetTable);

      // Filter by severity if specified
      if (input.severity !== 'all' && severity !== input.severity) {
        continue;
      }

      const replaceOnUpgrade = update.replace_on_upgrade === 'true' || update.replace_on_upgrade === true;

      // Extract update_set display value safely
      const updateSetObj = update.update_set as { display_value?: string } | null;
      const updateSetName = updateSetObj?.display_value || String(update.update_set || 'Unknown');

      const override: OotbOverride = {
        sys_id: String(update.sys_id || ''),
        name: String(update.name || 'Unknown'),
        type: type,
        targetTable: targetTable,
        updateSetName: updateSetName,
        updatedBy: String(update.sys_updated_by || 'Unknown'),
        updatedOn: String(update.sys_updated_on || ''),
        replaceOnUpgrade: replaceOnUpgrade,
        severity: severity,
        upgradeRisk: getUpgradeRisk(severity, replaceOnUpgrade),
        recommendation: getRecommendation(type, severity, replaceOnUpgrade),
      };

      analysis.overrides.push(override);

      // Update counts
      analysis.summary.overridesByType[type] = (analysis.summary.overridesByType[type] || 0) + 1;
      if (targetTable) {
        analysis.summary.overridesByTable[targetTable] = (analysis.summary.overridesByTable[targetTable] || 0) + 1;
      }
    }

    // Query skipped updates if requested
    if (input.includeSkippedUpdates) {
      await fetchSkippedUpdates(client, analysis);
    }

    // Calculate summary counts
    analysis.summary.totalOverrides = analysis.overrides.length;
    analysis.summary.criticalCount = analysis.overrides.filter(o => o.severity === 'critical').length;
    analysis.summary.highCount = analysis.overrides.filter(o => o.severity === 'high').length;
    analysis.summary.mediumCount = analysis.overrides.filter(o => o.severity === 'medium').length;
    analysis.summary.lowCount = analysis.overrides.filter(o => o.severity === 'low').length;

    // Calculate upgrade risk score
    if (input.includeUpgradeRisk) {
      analysis.summary.upgradeRiskScore = calculateUpgradeRiskScore(
        analysis.overrides,
        analysis.summary.skippedUpdatesCount
      );
    }

    // Generate recommendations
    generateRecommendations(analysis);

    analysis.success = true;
  } catch (error) {
    analysis.recommendations.push(`Error during analysis: ${error instanceof Error ? error.message : String(error)}`);
  }

  return analysis;
}

// Helper to extract table name from target_name (format: "table_name_fieldname" or just record name)
function extractTableFromTargetName(targetName: string): string {
  // Common patterns: "incident_Business Rule Name" or just the artifact name
  const parts = targetName.split('_');
  if (parts.length >= 2) {
    // Check if first part looks like a table name
    const potentialTable = parts[0].toLowerCase();
    if (CRITICAL_TABLES.includes(potentialTable) ||
        potentialTable.startsWith('sys_') ||
        potentialTable.startsWith('cmdb_') ||
        potentialTable.startsWith('sc_')) {
      return potentialTable;
    }
  }
  return '';
}

// Fetch skipped updates from upgrade history
async function fetchSkippedUpdates(client: ServiceNowClient, analysis: OverrideAnalysis): Promise<void> {
  try {
    // Query sys_upgrade_history_log for skipped updates
    const skippedRecords = await client.getRecords('sys_upgrade_history_log', {
      sysparm_query: 'disposition=skipped^ORDERBYDESCsys_created_on',
      sysparm_limit: 100,
      sysparm_fields: 'sys_id,name,type,disposition,file_name,upgrade,sys_created_on',
    });

    for (const record of skippedRecords) {
      // Extract upgrade display value safely
      const upgradeObj = record.upgrade as { display_value?: string } | null;
      const upgradeVersion = upgradeObj?.display_value || String(record.upgrade || 'Unknown');

      const skipped: SkippedUpdate = {
        sys_id: String(record.sys_id || ''),
        name: String(record.name || record.file_name || 'Unknown'),
        type: String(record.type || ''),
        upgradeVersion: upgradeVersion,
        skippedOn: String(record.sys_created_on || ''),
        reason: 'Customer update exists - OOTB change was skipped',
        resolved: false,
      };
      analysis.skippedUpdates.push(skipped);
    }

    analysis.summary.skippedUpdatesCount = analysis.skippedUpdates.length;
  } catch {
    // Table may not exist or be accessible - that's OK
    analysis.recommendations.push('Note: Could not access upgrade history logs. Skipped update count may be incomplete.');
  }
}
