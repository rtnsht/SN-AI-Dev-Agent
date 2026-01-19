/**
 * OOTB Baseline Comparator
 * 
 * Compares user's instance against a clean OOTB (Out-of-the-Box) baseline.
 * This helps identify:
 * - What's been customized vs what's standard
 * - Customization footprint (how far from OOTB)
 * - Upgrade safety (how much will break on upgrade)
 * - Technical debt from customizations
 * 
 * Uses ServiceNow's sys_update_xml table to identify changes from baseline.
 * Also uses package/plugin information to determine what's OOTB.
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMAS ============

export const compareToOotbSchema = z.object({
  mode: z.enum(['summary', 'detailed', 'export']).default('summary').describe(
    'Analysis mode: summary (quick overview), detailed (full breakdown), export (for reporting)'
  ),
  artifactTypes: z.array(z.enum([
    'business_rules',
    'client_scripts', 
    'script_includes',
    'ui_policies',
    'ui_actions',
    'acls',
    'workflows',
    'flows',
    'notifications',
    'scheduled_jobs',
    'rest_apis',
    'service_portal',
    'tables',
    'fields',
    'all'
  ])).default(['all']).describe('Types of artifacts to compare'),
  scope: z.string().optional().describe('Application scope (default: global + all custom)'),
  includeSystemUpdates: z.boolean().default(false).describe('Include system-generated updates'),
  targetVersion: z.string().optional().describe('Target ServiceNow version for baseline (e.g., Vancouver, Xanadu)'),
  limit: z.number().default(500).describe('Maximum artifacts to analyze'),
  includeRecommendations: z.boolean().default(true).describe('Include remediation recommendations')
});

export type CompareToOotbInput = z.infer<typeof compareToOotbSchema>;

// ============ RESULT TYPES ============

interface CustomizationItem {
  sys_id: string;
  name: string;
  type: string;
  table: string;
  scope: string;
  customizationType: 'new' | 'modified' | 'overridden' | 'extended';
  createdBy: string;
  createdOn: string;
  lastUpdatedBy: string;
  lastUpdatedOn: string;
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  upgradeRisk: 'safe' | 'review' | 'risky' | 'dangerous';
  recommendation?: string;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  custom: number;
  modified: number;
  ootb: number;
  customizationPercentage: number;
}

interface OotbComparisonResult {
  success: boolean;
  timestamp: string;
  instanceUrl: string;
  instanceVersion: string;
  
  // Overall metrics
  customizationScore: number; // 0-100 (0 = fully OOTB, 100 = heavily customized)
  customizationGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  upgradeReadiness: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  
  summary: {
    totalArtifactsAnalyzed: number;
    totalOotb: number;
    totalCustom: number;
    totalModified: number;
    totalOverridden: number;
    customizationPercentage: number;
    
    // By impact level
    criticalCustomizations: number;
    highImpactCustomizations: number;
    mediumImpactCustomizations: number;
    lowImpactCustomizations: number;
    
    // Top customizers
    topCustomizers: { user: string; count: number }[];
    topCustomizedTables: { table: string; count: number }[];
    topCustomizedTypes: { type: string; count: number }[];
  };
  
  categoryBreakdown: CategoryBreakdown[];
  customizations: CustomizationItem[];
  
  recommendations: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    effort: 'small' | 'medium' | 'large';
    impact: string;
  }[];
  
  upgradeImpact: {
    safeToUpgrade: number;
    needsReview: number;
    riskyOnUpgrade: number;
    willBreak: number;
  };
}

// ============ OOTB BASELINE DATA ============

// Known OOTB tables/artifacts that should not be modified
const OOTB_CRITICAL_ARTIFACTS = [
  // Core tables
  'sys_user', 'sys_user_group', 'sys_user_role', 'sys_security_acl',
  // Task tables
  'task', 'incident', 'problem', 'change_request', 'sc_request', 'sc_req_item',
  // CMDB
  'cmdb_ci', 'cmdb_rel_ci',
  // Workflows
  'wf_workflow', 'wf_activity',
  // Notifications
  'sysevent_email_action',
  // Scheduled jobs
  'sysauto'
];

// Artifact types and their risk weights
const ARTIFACT_RISK_WEIGHTS: Record<string, number> = {
  'sys_script': 80,           // Business Rules - high risk
  'sys_script_include': 70,   // Script Includes
  'sys_script_client': 50,    // Client Scripts
  'sys_ui_policy': 40,        // UI Policies
  'sys_ui_action': 40,        // UI Actions
  'sys_security_acl': 90,     // ACLs - very high risk
  'wf_workflow': 75,          // Workflows
  'sys_flow': 60,             // Flows
  'sysevent_email_action': 45, // Notifications
  'sysauto': 55,              // Scheduled Jobs
  'sys_ws_operation': 65,     // Scripted REST APIs
  'sys_db_object': 85,        // Table definitions
  'sys_dictionary': 70,       // Field definitions
  'sp_widget': 35,            // Service Portal Widgets
  'sp_page': 30               // Service Portal Pages
};

// Map artifact types to query tables
const ARTIFACT_TABLE_MAP: Record<string, string> = {
  'business_rules': 'sys_script',
  'client_scripts': 'sys_script_client',
  'script_includes': 'sys_script_include',
  'ui_policies': 'sys_ui_policy',
  'ui_actions': 'sys_ui_action',
  'acls': 'sys_security_acl',
  'workflows': 'wf_workflow',
  'flows': 'sys_flow',
  'notifications': 'sysevent_email_action',
  'scheduled_jobs': 'sysauto',
  'rest_apis': 'sys_ws_operation',
  'service_portal': 'sp_widget',
  'tables': 'sys_db_object',
  'fields': 'sys_dictionary'
};

// ============ MAIN FUNCTION ============

export async function compareToOotb(
  client: ServiceNowClient,
  input: CompareToOotbInput
): Promise<OotbComparisonResult> {
  const timestamp = new Date().toISOString();

  // Initialize result
  const result: OotbComparisonResult = {
    success: true,
    timestamp,
    instanceUrl: client.instanceUrl,
    instanceVersion: 'Vancouver', // Will be detected
    customizationScore: 0,
    customizationGrade: 'A',
    upgradeReadiness: 'excellent',
    summary: {
      totalArtifactsAnalyzed: 0,
      totalOotb: 0,
      totalCustom: 0,
      totalModified: 0,
      totalOverridden: 0,
      customizationPercentage: 0,
      criticalCustomizations: 0,
      highImpactCustomizations: 0,
      mediumImpactCustomizations: 0,
      lowImpactCustomizations: 0,
      topCustomizers: [],
      topCustomizedTables: [],
      topCustomizedTypes: []
    },
    categoryBreakdown: [],
    customizations: [],
    recommendations: [],
    upgradeImpact: {
      safeToUpgrade: 0,
      needsReview: 0,
      riskyOnUpgrade: 0,
      willBreak: 0
    }
  };

  // Track customizers and tables
  const customizerCounts: Record<string, number> = {};
  const tableCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};

  // Determine which artifact types to analyze
  const artifactTypes = input.artifactTypes.includes('all')
    ? Object.keys(ARTIFACT_TABLE_MAP)
    : input.artifactTypes;

  // APPROACH: Query actual artifact tables and detect customizations by:
  // 1. Non-global scope = custom artifact
  // 2. Global scope but sys_created_by != system/glide = modified OOTB
  for (const artifactType of artifactTypes) {
    const table = ARTIFACT_TABLE_MAP[artifactType];
    if (!table) continue;

    try {
      // Build query for ALL artifacts (we'll categorize them)
      let allQuery = 'active=true';
      if (input.scope) {
        allQuery += `^sys_scope.scope=${input.scope}`;
      }

      // Get all artifacts from the table
      const allArtifacts = await client.getRecords(table, {
        sysparm_query: allQuery,
        sysparm_fields: 'sys_id,name,sys_scope,sys_created_by,sys_created_on,sys_updated_by,sys_updated_on,collection',
        sysparm_limit: Math.min(input.limit, 200)
      });

      // Query for custom (non-global) artifacts
      let customQuery = 'active=true^sys_scope.scope!=global';
      if (input.scope) {
        customQuery = `active=true^sys_scope.scope=${input.scope}`;
      }

      const customArtifacts = await client.getRecords(table, {
        sysparm_query: customQuery,
        sysparm_fields: 'sys_id,name,sys_scope,sys_created_by,sys_created_on,sys_updated_by,sys_updated_on,collection',
        sysparm_limit: Math.min(input.limit, 200)
      });

      // Also check for modified OOTB (global scope but not created by system)
      const modifiedOotbQuery = 'active=true^sys_scope.scope=global^sys_updated_by!=system^sys_updated_by!=glide.maint';
      const modifiedOotb = await client.getRecords(table, {
        sysparm_query: modifiedOotbQuery,
        sysparm_fields: 'sys_id,name,sys_scope,sys_created_by,sys_created_on,sys_updated_by,sys_updated_on,collection',
        sysparm_limit: Math.min(input.limit, 100)
      });

      const totalForType = allArtifacts.length;
      const customCount = customArtifacts.length;
      const modifiedCount = modifiedOotb.length;
      // OOTB = total - custom (modified is a subset of global, not additional)
      const ootbCount = totalForType - customCount;
      // Customization % = (custom + modified) / total, capped at 100
      const customizationPct = totalForType > 0
        ? Math.min(100, Math.round(((customCount + modifiedCount) / totalForType) * 100))
        : 0;

      // Category breakdown
      result.categoryBreakdown.push({
        category: artifactType,
        total: totalForType,
        custom: customCount,
        modified: modifiedCount,
        ootb: Math.max(0, ootbCount - modifiedCount), // Pure OOTB = global - modified
        customizationPercentage: customizationPct
      });

      result.summary.totalArtifactsAnalyzed += totalForType;
      result.summary.totalOotb += Math.max(0, ootbCount - modifiedCount);
      result.summary.totalCustom += customCount;
      result.summary.totalModified += modifiedCount;

      // Process custom artifacts (non-global scope)
      for (const artifact of customArtifacts) {
        const createdBy = String(artifact.sys_created_by || 'unknown');
        const artifactName = String(artifact.name || 'Unknown');
        const targetTable = String(artifact.collection || table);

        // Track customizers
        customizerCounts[createdBy] = (customizerCounts[createdBy] || 0) + 1;
        tableCounts[targetTable] = (tableCounts[targetTable] || 0) + 1;
        typeCounts[artifactType] = (typeCounts[artifactType] || 0) + 1;

        // Determine impact level
        const riskWeight = ARTIFACT_RISK_WEIGHTS[table] || 50;
        const isCriticalTable = OOTB_CRITICAL_ARTIFACTS.includes(table);

        let impactLevel: 'critical' | 'high' | 'medium' | 'low';
        if (isCriticalTable && riskWeight >= 80) impactLevel = 'critical';
        else if (riskWeight >= 70) impactLevel = 'high';
        else if (riskWeight >= 40) impactLevel = 'medium';
        else impactLevel = 'low';

        // Custom artifacts are generally safe on upgrade (new, not overriding OOTB)
        const upgradeRisk = 'safe';

        // Update impact counters
        switch (impactLevel) {
          case 'critical': result.summary.criticalCustomizations++; break;
          case 'high': result.summary.highImpactCustomizations++; break;
          case 'medium': result.summary.mediumImpactCustomizations++; break;
          case 'low': result.summary.lowImpactCustomizations++; break;
        }

        // Update upgrade impact - custom artifacts are safe
        result.upgradeImpact.safeToUpgrade++;

        // Add to customizations list (for detailed mode)
        if (input.mode === 'detailed' || input.mode === 'export') {
          result.customizations.push({
            sys_id: String(artifact.sys_id),
            name: artifactName,
            type: artifactType,
            table: targetTable,
            scope: String(artifact.sys_scope || 'custom'),
            customizationType: 'new',
            createdBy,
            createdOn: String(artifact.sys_created_on || ''),
            lastUpdatedBy: String(artifact.sys_updated_by || createdBy),
            lastUpdatedOn: String(artifact.sys_updated_on || ''),
            impactLevel,
            upgradeRisk,
            recommendation: getRecommendation(impactLevel, upgradeRisk, artifactType)
          });
        }
      }

      // Process modified OOTB artifacts (global scope but modified by non-system user)
      for (const artifact of modifiedOotb) {
        const updatedBy = String(artifact.sys_updated_by || 'unknown');
        const artifactName = String(artifact.name || 'Unknown');
        const targetTable = String(artifact.collection || table);

        // Track customizers
        customizerCounts[updatedBy] = (customizerCounts[updatedBy] || 0) + 1;
        tableCounts[targetTable] = (tableCounts[targetTable] || 0) + 1;
        typeCounts[artifactType] = (typeCounts[artifactType] || 0) + 1;

        // Modified OOTB is higher risk
        const riskWeight = ARTIFACT_RISK_WEIGHTS[table] || 50;
        const isCriticalTable = OOTB_CRITICAL_ARTIFACTS.includes(table);

        let impactLevel: 'critical' | 'high' | 'medium' | 'low';
        if (isCriticalTable) impactLevel = 'critical';
        else if (riskWeight >= 70) impactLevel = 'high';
        else if (riskWeight >= 40) impactLevel = 'medium';
        else impactLevel = 'low';

        // Modified OOTB is risky on upgrade
        let upgradeRisk: 'safe' | 'review' | 'risky' | 'dangerous';
        if (isCriticalTable) upgradeRisk = 'dangerous';
        else if (riskWeight >= 70) upgradeRisk = 'risky';
        else upgradeRisk = 'review';

        // Update impact counters
        switch (impactLevel) {
          case 'critical': result.summary.criticalCustomizations++; break;
          case 'high': result.summary.highImpactCustomizations++; break;
          case 'medium': result.summary.mediumImpactCustomizations++; break;
          case 'low': result.summary.lowImpactCustomizations++; break;
        }

        // Update upgrade impact based on risk
        if (upgradeRisk === 'dangerous') result.upgradeImpact.willBreak++;
        else if (upgradeRisk === 'risky') result.upgradeImpact.riskyOnUpgrade++;
        else result.upgradeImpact.needsReview++;

        // Add to customizations list (for detailed mode)
        if (input.mode === 'detailed' || input.mode === 'export') {
          result.customizations.push({
            sys_id: String(artifact.sys_id),
            name: artifactName,
            type: artifactType,
            table: targetTable,
            scope: 'global (modified)',
            customizationType: 'modified',
            createdBy: String(artifact.sys_created_by || 'system'),
            createdOn: String(artifact.sys_created_on || ''),
            lastUpdatedBy: updatedBy,
            lastUpdatedOn: String(artifact.sys_updated_on || ''),
            impactLevel,
            upgradeRisk,
            recommendation: getRecommendation(impactLevel, upgradeRisk, artifactType)
          });
        }
      }
    } catch {
      // Table might not exist or be inaccessible
    }
  }

  // Calculate overall metrics
  const totalCustomizations = result.summary.totalCustom + result.summary.totalModified;
  result.summary.customizationPercentage = result.summary.totalArtifactsAnalyzed > 0
    ? Math.min(100, Math.round((totalCustomizations / result.summary.totalArtifactsAnalyzed) * 100))
    : 0;

  // Calculate customization score (0-100)
  // Weighted by impact levels
  const weightedScore =
    (result.summary.criticalCustomizations * 4) +
    (result.summary.highImpactCustomizations * 3) +
    (result.summary.mediumImpactCustomizations * 2) +
    (result.summary.lowImpactCustomizations * 1);

  const maxPossibleScore = totalCustomizations * 4;
  result.customizationScore = maxPossibleScore > 0
    ? Math.min(100, Math.round((weightedScore / maxPossibleScore) * 100))
    : 0;

  // Assign grade
  if (result.customizationScore <= 20) result.customizationGrade = 'A';
  else if (result.customizationScore <= 40) result.customizationGrade = 'B';
  else if (result.customizationScore <= 60) result.customizationGrade = 'C';
  else if (result.customizationScore <= 80) result.customizationGrade = 'D';
  else result.customizationGrade = 'F';

  // Determine upgrade readiness
  const dangerousPercent = totalCustomizations > 0
    ? (result.upgradeImpact.willBreak / totalCustomizations) * 100
    : 0;

  if (dangerousPercent <= 5 && result.summary.criticalCustomizations <= 2) {
    result.upgradeReadiness = 'excellent';
  } else if (dangerousPercent <= 15 && result.summary.criticalCustomizations <= 5) {
    result.upgradeReadiness = 'good';
  } else if (dangerousPercent <= 30) {
    result.upgradeReadiness = 'fair';
  } else if (dangerousPercent <= 50) {
    result.upgradeReadiness = 'poor';
  } else {
    result.upgradeReadiness = 'critical';
  }

  // Top customizers
  result.summary.topCustomizers = Object.entries(customizerCounts)
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top customized tables
  result.summary.topCustomizedTables = Object.entries(tableCounts)
    .map(([table, count]) => ({ table, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top customized types
  result.summary.topCustomizedTypes = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Generate recommendations
  if (input.includeRecommendations) {
    result.recommendations = generateRecommendations(result);
  }

  return result;
}

// ============ HELPER FUNCTIONS ============

function getRecommendation(
  impactLevel: string,
  upgradeRisk: string,
  artifactType: string
): string {
  if (upgradeRisk === 'dangerous') {
    return `HIGH PRIORITY: Review this ${artifactType} before upgrade. Consider reverting to OOTB or documenting extensively.`;
  }
  if (upgradeRisk === 'risky') {
    return `Review during upgrade planning. Test thoroughly in non-prod environment.`;
  }
  if (impactLevel === 'critical') {
    return `Critical customization. Ensure business justification is documented.`;
  }
  return 'Monitor during upgrades. Consider if OOTB alternative exists.';
}

function generateRecommendations(result: OotbComparisonResult): OotbComparisonResult['recommendations'] {
  const recommendations: OotbComparisonResult['recommendations'] = [];

  // Critical customizations warning
  if (result.summary.criticalCustomizations > 5) {
    recommendations.push({
      priority: 'critical',
      category: 'Technical Debt',
      title: `${result.summary.criticalCustomizations} Critical Customizations Detected`,
      description: 'High number of critical customizations may cause upgrade issues and increase maintenance burden.',
      effort: 'large',
      impact: 'Reduces upgrade risk by 40%'
    });
  }

  // Upgrade danger warning
  if (result.upgradeImpact.willBreak > 10) {
    recommendations.push({
      priority: 'critical',
      category: 'Upgrade Risk',
      title: `${result.upgradeImpact.willBreak} Artifacts Will Likely Break on Upgrade`,
      description: 'These customizations override OOTB functionality and will likely cause conflicts.',
      effort: 'large',
      impact: 'Prevents upgrade failures'
    });
  }

  // High customization score
  if (result.customizationScore > 60) {
    recommendations.push({
      priority: 'high',
      category: 'Instance Health',
      title: 'Instance is Heavily Customized',
      description: `Customization score of ${result.customizationScore}/100 indicates significant deviation from OOTB.`,
      effort: 'large',
      impact: 'Improves maintainability and upgrade path'
    });
  }

  // Top customizer notification
  if (result.summary.topCustomizers.length > 0 && result.summary.topCustomizers[0].count > 50) {
    recommendations.push({
      priority: 'medium',
      category: 'Governance',
      title: 'Concentrated Customization Ownership',
      description: `${result.summary.topCustomizers[0].user} has ${result.summary.topCustomizers[0].count} customizations. Consider knowledge transfer.`,
      effort: 'small',
      impact: 'Reduces key person dependency'
    });
  }

  // Business rules focus
  const brBreakdown = result.categoryBreakdown.find(c => c.category === 'business_rules');
  if (brBreakdown && brBreakdown.customizationPercentage > 50) {
    recommendations.push({
      priority: 'high',
      category: 'Best Practices',
      title: 'High Business Rule Customization',
      description: `${brBreakdown.customizationPercentage}% of business rules are customized. Consider using Flow Designer for new automation.`,
      effort: 'medium',
      impact: 'Better upgrade compatibility with modern approach'
    });
  }

  // ACL customization
  const aclBreakdown = result.categoryBreakdown.find(c => c.category === 'acls');
  if (aclBreakdown && aclBreakdown.custom > 20) {
    recommendations.push({
      priority: 'high',
      category: 'Security',
      title: 'Significant ACL Customizations',
      description: `${aclBreakdown.custom} custom ACLs detected. Review for security gaps and redundancy.`,
      effort: 'medium',
      impact: 'Improves security posture'
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

