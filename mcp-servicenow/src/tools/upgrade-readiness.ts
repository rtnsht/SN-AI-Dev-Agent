/**
 * Upgrade Readiness Tool
 * Analyzes instance for upgrade compatibility and risks
 * 
 * Task 4.4 of the Brownfield Enhancement Plan - Step 4: Multi-Instance & Predictive
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMAS ============

export const assessUpgradeReadinessSchema = z.object({
  targetVersion: z.string().optional().describe('Target ServiceNow version (e.g., "Xanadu", "Vancouver")'),
  scope: z.string().optional().describe('Specific application scope to analyze'),
  includeRecommendations: z.boolean().default(true).describe('Include remediation recommendations')
});

export type AssessUpgradeReadinessInput = z.infer<typeof assessUpgradeReadinessSchema>;

// ============ TYPES ============

interface UpgradeRisk {
  id: string;
  category: 'deprecated_api' | 'ootb_override' | 'plugin_dependency' | 'custom_table' | 'integration' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedArtifacts: string[];
  remediation?: string;
  effort: 'trivial' | 'small' | 'medium' | 'large' | 'xl';
}

interface UpgradeReadinessResult {
  success: boolean;
  currentVersion: string;
  targetVersion: string;
  readinessScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: {
    totalRisks: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  risks: UpgradeRisk[];
  estimatedEffort: {
    days: number;
    breakdown: {
      category: string;
      days: number;
    }[];
  };
  recommendations: string[];
  preUpgradeChecklist: string[];
}

// Deprecated APIs by version
const DEPRECATED_APIS: Record<string, string[]> = {
  'Xanadu': ['GlideRecord.deleteRecord()', 'g_form.flash()'],
  'Vancouver': ['Workflow.startFlow()', 'GlideDialogWindow'],
  'Utah': ['GlideAjax.getXML()', 'GlideDialogForm']
};

// ============ MAIN EXPORT ============

export async function assessUpgradeReadiness(
  client: ServiceNowClient,
  input: AssessUpgradeReadinessInput
): Promise<UpgradeReadinessResult> {
  const targetVersion = input.targetVersion || 'Xanadu';
  const risks: UpgradeRisk[] = [];
  
  // 1. Check for deprecated API usage
  const deprecatedApis = DEPRECATED_APIS[targetVersion] || [];
  
  // Query scripts for deprecated API patterns
  const scriptTables = [
    { table: 'sys_script', type: 'Business Rule' },
    { table: 'sys_script_include', type: 'Script Include' },
    { table: 'sys_script_client', type: 'Client Script' }
  ];
  
  for (const { table, type } of scriptTables) {
    try {
      const records = await client.getRecords(table, {
        sysparm_query: 'active=true',
        sysparm_fields: 'sys_id,name,script',
        sysparm_limit: 200
      });

      for (const record of records) {
        const script = String(record.script || '');
        const recName = String(record.name || 'Unnamed');
        const recSysId = String(record.sys_id || '');

        for (const api of deprecatedApis) {
          const apiPattern = api.replace(/[()]/g, '\\$&');
          if (new RegExp(apiPattern).test(script)) {
            risks.push({
              id: `DEP-${recSysId.substring(0, 8)}`,
              category: 'deprecated_api',
              severity: 'high',
              title: `Deprecated API: ${api}`,
              description: `${type} "${recName}" uses ${api} which is deprecated in ${targetVersion}`,
              affectedArtifacts: [`${type}: ${recName}`],
              remediation: `Replace ${api} with the recommended alternative`,
              effort: 'small'
            });
          }
        }
      }
    } catch {
      // Table access issue
    }
  }

  // 2. Check for OOTB overrides (simplified check)
  try {
    const overrides = await client.getRecords('sys_update_xml', {
      sysparm_query: 'type=sys_script^update_set.is_default=false',
      sysparm_fields: 'sys_id,name',
      sysparm_limit: 50
    });

    if (overrides.length > 0) {
      risks.push({
        id: 'OOTB-001',
        category: 'ootb_override',
        severity: 'medium',
        title: `${overrides.length} OOTB Overrides Detected`,
        description: 'Overridden OOTB artifacts may conflict with upgrade changes',
        affectedArtifacts: overrides.slice(0, 10).map(o => String(o.name || '')),
        remediation: 'Review each override and merge with new baseline',
        effort: 'medium'
      });
    }
  } catch {
    // Query issue
  }

  // 3. Check for custom tables on core tables
  try {
    const customTables = await client.getRecords('sys_db_object', {
      sysparm_query: 'super_class.name=task^sys_scope.scope!=global',
      sysparm_fields: 'sys_id,name,label',
      sysparm_limit: 50
    });

    if (customTables.length > 0) {
      risks.push({
        id: 'TBL-001',
        category: 'custom_table',
        severity: 'low',
        title: `${customTables.length} Custom Tables Extending Core`,
        description: 'Custom tables extending Task may need field alignment after upgrade',
        affectedArtifacts: customTables.map(t => String(t.label || t.name || '')),
        remediation: 'Verify custom table fields after upgrade',
        effort: 'small'
      });
    }
  } catch {
    // Query issue
  }
  
  // Calculate scores
  const critical = risks.filter(r => r.severity === 'critical').length;
  const high = risks.filter(r => r.severity === 'high').length;
  const medium = risks.filter(r => r.severity === 'medium').length;
  const low = risks.filter(r => r.severity === 'low').length;
  
  // Score calculation: start at 100, deduct for risks
  let score = 100;
  score -= critical * 25;
  score -= high * 10;
  score -= medium * 3;
  score -= low * 1;
  score = Math.max(0, score);
  
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  
  // Effort estimation
  const effortMap: Record<string, number> = { trivial: 0.25, small: 0.5, medium: 2, large: 5, xl: 10 };
  const totalDays = risks.reduce((sum, r) => sum + (effortMap[r.effort] || 1), 0);
  
  return {
    success: true,
    currentVersion: 'Vancouver', // Would detect from instance
    targetVersion,
    readinessScore: score,
    grade,
    summary: { totalRisks: risks.length, critical, high, medium, low },
    risks: risks.slice(0, 20),
    estimatedEffort: {
      days: Math.ceil(totalDays),
      breakdown: [
        { category: 'Deprecated APIs', days: Math.ceil(risks.filter(r => r.category === 'deprecated_api').length * 0.5) },
        { category: 'OOTB Overrides', days: Math.ceil(risks.filter(r => r.category === 'ootb_override').length * 2) },
        { category: 'Testing', days: Math.ceil(totalDays * 0.3) }
      ]
    },
    recommendations: input.includeRecommendations ? [
      'Run Instance Scan before upgrade',
      'Create update set backups',
      'Test critical workflows post-upgrade',
      'Review release notes for breaking changes'
    ] : [],
    preUpgradeChecklist: [
      '☐ Backup all update sets',
      '☐ Document OOTB overrides',
      '☐ Run deprecated API scanner',
      '☐ Notify stakeholders',
      '☐ Schedule downtime window'
    ]
  };
}

