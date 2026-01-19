/**
 * Conflict Detector Tool
 * Detects conflicts between ServiceNow artifacts
 *
 * Task 2.2 of the Brownfield Enhancement Plan - Step 2: Guardrails & Impact Analysis
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const detectConflictsSchema = z.object({
  targetTable: z.string().describe('Table to check for conflicts'),
  artifactType: z.enum([
    'business_rule',
    'client_script',
    'ui_policy',
    'ui_action',
    'data_policy',
    'acl',
    'all'
  ]).default('all').describe('Type of artifact to check'),
  scope: z.string().optional().describe('Filter by application scope'),
  checkOrderConflicts: z.boolean().default(true).describe('Check for execution order issues'),
  checkConditionOverlaps: z.boolean().default(true).describe('Check for overlapping conditions'),
  checkFieldConflicts: z.boolean().default(true).describe('Check for conflicting field modifications'),
  limit: z.number().default(100).describe('Maximum artifacts to analyze per type')
});

export type DetectConflictsInput = z.infer<typeof detectConflictsSchema>;

// ============ TYPES ============

interface ConflictDetail {
  type: 'order_conflict' | 'condition_overlap' | 'field_conflict' | 'trigger_conflict' |
        'permission_conflict' | 'ui_conflict' | 'naming_conflict';
  severity: 'critical' | 'high' | 'medium' | 'low';
  artifact1: {
    name: string;
    sys_id: string;
    type: string;
  };
  artifact2: {
    name: string;
    sys_id: string;
    type: string;
  };
  description: string;
  resolution: string;
  affectedField?: string;
}

interface ConflictSummary {
  totalConflicts: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  byType: Record<string, number>;
}

interface ConflictResult {
  success: boolean;
  targetTable: string;
  summary: ConflictSummary;
  conflicts: ConflictDetail[];
  recommendations: string[];
  healthScore: number;
}

// ============ ARTIFACT QUERIES ============

interface ArtifactRecord {
  sys_id: string;
  name: string;
  order?: number;
  condition?: string;
  when?: string;
  script?: string;
  active?: boolean;
  sys_scope?: { display_value?: string } | string;
  table?: string;
  collection?: string;
}

async function getBusinessRules(
  client: ServiceNowClient,
  table: string,
  scope?: string,
  limit?: number
): Promise<ArtifactRecord[]> {
  let query = `collection=${table}^active=true`;
  if (scope) query += `^sys_scope.scope=${scope}`;

  try {
    const records = await client.getRecords('sys_script', {
      sysparm_query: query,
      sysparm_fields: 'sys_id,name,order,condition,when,script,sys_scope',
      sysparm_limit: limit || 100
    });
    return records as unknown as ArtifactRecord[];
  } catch {
    return [];
  }
}

async function getClientScripts(
  client: ServiceNowClient,
  table: string,
  scope?: string,
  limit?: number
): Promise<ArtifactRecord[]> {
  let query = `table=${table}^active=true`;
  if (scope) query += `^sys_scope.scope=${scope}`;

  try {
    const records = await client.getRecords('sys_script_client', {
      sysparm_query: query,
      sysparm_fields: 'sys_id,name,order,condition,type,script,sys_scope',
      sysparm_limit: limit || 100
    });
    return records as unknown as ArtifactRecord[];
  } catch {
    return [];
  }
}

async function getUIPolicies(
  client: ServiceNowClient,
  table: string,
  scope?: string,
  limit?: number
): Promise<ArtifactRecord[]> {
  let query = `table=${table}^active=true`;
  if (scope) query += `^sys_scope.scope=${scope}`;

  try {
    const records = await client.getRecords('sys_ui_policy', {
      sysparm_query: query,
      sysparm_fields: 'sys_id,short_description,order,conditions,on_load,reverse_if_false,sys_scope',
      sysparm_limit: limit || 100
    });
    return records.map(r => ({
      ...r,
      name: String(r.short_description || 'Unnamed'),
      condition: String(r.conditions || '')
    })) as unknown as ArtifactRecord[];
  } catch {
    return [];
  }
}

async function getUIActions(
  client: ServiceNowClient,
  table: string,
  scope?: string,
  limit?: number
): Promise<ArtifactRecord[]> {
  let query = `table=${table}^active=true`;
  if (scope) query += `^sys_scope.scope=${scope}`;

  try {
    const records = await client.getRecords('sys_ui_action', {
      sysparm_query: query,
      sysparm_fields: 'sys_id,name,order,condition,script,form_button,list_button,sys_scope',
      sysparm_limit: limit || 100
    });
    return records as unknown as ArtifactRecord[];
  } catch {
    return [];
  }
}


// ============ CONFLICT DETECTION FUNCTIONS ============

function detectOrderConflicts(artifacts: ArtifactRecord[], type: string): ConflictDetail[] {
  const conflicts: ConflictDetail[] = [];

  // Group by when (for Business Rules) or type (for Client Scripts)
  const groups = new Map<string, ArtifactRecord[]>();
  for (const artifact of artifacts) {
    const key = String(artifact.when || 'default');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(artifact);
  }

  // Check each group for order conflicts
  for (const [, group] of groups) {
    // Find artifacts with same order
    const orderMap = new Map<number, ArtifactRecord[]>();
    for (const artifact of group) {
      const order = Number(artifact.order) || 100;
      if (!orderMap.has(order)) orderMap.set(order, []);
      orderMap.get(order)!.push(artifact);
    }

    // Report duplicates
    for (const [order, sameOrder] of orderMap) {
      if (sameOrder.length > 1) {
        for (let i = 0; i < sameOrder.length - 1; i++) {
          conflicts.push({
            type: 'order_conflict',
            severity: 'medium',
            artifact1: {
              name: sameOrder[i].name,
              sys_id: sameOrder[i].sys_id,
              type
            },
            artifact2: {
              name: sameOrder[i + 1].name,
              sys_id: sameOrder[i + 1].sys_id,
              type
            },
            description: `Both artifacts have order ${order}. Execution sequence is undefined.`,
            resolution: 'Assign unique order values to ensure predictable execution.'
          });
        }
      }
    }
  }

  return conflicts;
}

function detectConditionOverlaps(artifacts: ArtifactRecord[], type: string): ConflictDetail[] {
  const conflicts: ConflictDetail[] = [];

  // Check for identical conditions
  const conditionMap = new Map<string, ArtifactRecord[]>();
  for (const artifact of artifacts) {
    const condition = String(artifact.condition || '').trim() || 'none';
    if (!conditionMap.has(condition)) conditionMap.set(condition, []);
    conditionMap.get(condition)!.push(artifact);
  }

  // Report overlaps
  for (const [condition, sameCondition] of conditionMap) {
    if (condition !== 'none' && sameCondition.length > 1) {
      for (let i = 0; i < sameCondition.length - 1; i++) {
        conflicts.push({
          type: 'condition_overlap',
          severity: 'high',
          artifact1: {
            name: sameCondition[i].name,
            sys_id: sameCondition[i].sys_id,
            type
          },
          artifact2: {
            name: sameCondition[i + 1].name,
            sys_id: sameCondition[i + 1].sys_id,
            type
          },
          description: 'Artifacts have identical conditions and may duplicate processing.',
          resolution: 'Consider combining into a single artifact or differentiating conditions.'
        });
      }
    }
  }

  return conflicts;
}

function detectFieldConflicts(artifacts: ArtifactRecord[], type: string): ConflictDetail[] {
  const conflicts: ConflictDetail[] = [];

  // Parse scripts to find field modifications
  const fieldModifiers = new Map<string, ArtifactRecord[]>();

  for (const artifact of artifacts) {
    const script = String(artifact.script || '');

    // Look for current.<field> = or current.setValue patterns
    const setValueMatches = script.match(/current\.(\w+)\s*=/gi) || [];
    const setValueMethodMatches = script.match(/current\.setValue\s*\(['"](\w+)['"]/gi) || [];

    const fields = new Set<string>();
    for (const match of setValueMatches) {
      const field = match.replace(/current\./i, '').replace(/\s*=.*/, '');
      if (field && !['update', 'insert', 'setWorkflow', 'setAbortAction'].includes(field)) {
        fields.add(field.toLowerCase());
      }
    }
    for (const match of setValueMethodMatches) {
      const fieldMatch = match.match(/['"](\w+)['"]/);
      if (fieldMatch) fields.add(fieldMatch[1].toLowerCase());
    }

    for (const field of fields) {
      if (!fieldModifiers.has(field)) fieldModifiers.set(field, []);
      fieldModifiers.get(field)!.push(artifact);
    }
  }

  // Report conflicts
  for (const [field, modifiers] of fieldModifiers) {
    if (modifiers.length > 1) {
      // Check if they run at same time
      const sameWhen = new Map<string, ArtifactRecord[]>();
      for (const mod of modifiers) {
        const when = String(mod.when || 'default');
        if (!sameWhen.has(when)) sameWhen.set(when, []);
        sameWhen.get(when)!.push(mod);
      }

      for (const [, sameTime] of sameWhen) {
        if (sameTime.length > 1) {
          for (let i = 0; i < sameTime.length - 1; i++) {
            conflicts.push({
              type: 'field_conflict',
              severity: 'high',
              artifact1: {
                name: sameTime[i].name,
                sys_id: sameTime[i].sys_id,
                type
              },
              artifact2: {
                name: sameTime[i + 1].name,
                sys_id: sameTime[i + 1].sys_id,
                type
              },
              description: `Both artifacts modify field '${field}' and run at same time.`,
              resolution: 'Consolidate field logic or use order to ensure correct final value.',
              affectedField: field
            });
          }
        }
      }
    }
  }

  return conflicts;
}


// ============ MAIN EXPORT ============

export async function detectConflicts(
  client: ServiceNowClient,
  input: DetectConflictsInput
): Promise<ConflictResult> {
  const allConflicts: ConflictDetail[] = [];

  // Get artifacts based on type
  const typesToCheck = input.artifactType === 'all'
    ? ['business_rule', 'client_script', 'ui_policy', 'ui_action']
    : [input.artifactType];

  for (const type of typesToCheck) {
    let artifacts: ArtifactRecord[] = [];

    switch (type) {
      case 'business_rule':
        artifacts = await getBusinessRules(client, input.targetTable, input.scope, input.limit);
        break;
      case 'client_script':
        artifacts = await getClientScripts(client, input.targetTable, input.scope, input.limit);
        break;
      case 'ui_policy':
        artifacts = await getUIPolicies(client, input.targetTable, input.scope, input.limit);
        break;
      case 'ui_action':
        artifacts = await getUIActions(client, input.targetTable, input.scope, input.limit);
        break;
    }

    if (artifacts.length === 0) continue;

    // Run conflict checks
    if (input.checkOrderConflicts) {
      allConflicts.push(...detectOrderConflicts(artifacts, type));
    }

    if (input.checkConditionOverlaps) {
      allConflicts.push(...detectConditionOverlaps(artifacts, type));
    }

    if (input.checkFieldConflicts && (type === 'business_rule')) {
      allConflicts.push(...detectFieldConflicts(artifacts, type));
    }
  }

  // Calculate summary
  const criticalCount = allConflicts.filter(c => c.severity === 'critical').length;
  const highCount = allConflicts.filter(c => c.severity === 'high').length;
  const mediumCount = allConflicts.filter(c => c.severity === 'medium').length;
  const lowCount = allConflicts.filter(c => c.severity === 'low').length;

  const byType: Record<string, number> = {};
  for (const conflict of allConflicts) {
    byType[conflict.type] = (byType[conflict.type] || 0) + 1;
  }

  // Calculate health score
  let healthScore = 100;
  healthScore -= criticalCount * 20;
  healthScore -= highCount * 10;
  healthScore -= mediumCount * 5;
  healthScore -= lowCount * 2;
  healthScore = Math.max(0, healthScore);

  // Generate recommendations
  const recommendations: string[] = [];

  if (byType['order_conflict'] > 0) {
    recommendations.push(`📊 Review execution order for ${byType['order_conflict']} artifacts with duplicate order values`);
  }

  if (byType['condition_overlap'] > 0) {
    recommendations.push(`🔄 Consider consolidating ${byType['condition_overlap']} artifacts with identical conditions`);
  }

  if (byType['field_conflict'] > 0) {
    recommendations.push(`⚠️ ${byType['field_conflict']} field conflicts detected - review to prevent unexpected overwrites`);
  }

  if (allConflicts.length === 0) {
    recommendations.push('✅ No conflicts detected on this table');
  }

  if (healthScore < 50) {
    recommendations.push('🚨 High conflict count - consider a code review session');
  }

  return {
    success: true,
    targetTable: input.targetTable,
    summary: {
      totalConflicts: allConflicts.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      byType
    },
    conflicts: allConflicts,
    recommendations,
    healthScore
  };
}