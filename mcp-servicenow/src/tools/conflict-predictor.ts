/**
 * Conflict Prediction Tool
 * Predicts potential conflicts before changes are made
 * 
 * Task 4.5 of the Brownfield Enhancement Plan - Step 4: Multi-Instance & Predictive
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMAS ============

export const predictConflictsSchema = z.object({
  changeType: z.enum([
    'create_business_rule',
    'modify_business_rule', 
    'create_client_script',
    'modify_client_script',
    'create_acl',
    'modify_acl',
    'modify_field',
    'add_field',
    'create_workflow'
  ]).describe('Type of change being planned'),
  
  targetTable: z.string().describe('Table being affected'),
  artifactName: z.string().optional().describe('Name of artifact being created/modified'),
  
  proposedChanges: z.object({
    when: z.string().optional().describe('For BRs: before, after, async, display'),
    order: z.number().optional().describe('Execution order'),
    condition: z.string().optional().describe('Condition/filter'),
    script: z.string().optional().describe('Script content'),
    fieldName: z.string().optional().describe('For field changes')
  }).optional().describe('Details of proposed changes'),
  
  analyzeDepth: z.enum(['quick', 'standard', 'deep']).default('standard')
});

export type PredictConflictsInput = z.infer<typeof predictConflictsSchema>;

// ============ TYPES ============

interface PredictedConflict {
  id: string;
  type: 'order_collision' | 'condition_overlap' | 'script_conflict' | 'field_dependency' | 'performance_impact' | 'security_risk';
  severity: 'critical' | 'high' | 'medium' | 'low';
  probability: number; // 0-100
  title: string;
  description: string;
  conflictingArtifact?: {
    name: string;
    sysId: string;
    type: string;
  };
  recommendation: string;
}

interface PredictionResult {
  success: boolean;
  changeType: string;
  targetTable: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  predictedConflicts: PredictedConflict[];
  safetyAnalysis: {
    existingArtifactsOnTable: number;
    potentialCollisions: number;
    recommendedOrder?: number;
  };
  suggestions: string[];
}

// ============ MAIN EXPORT ============

export async function predictConflicts(
  client: ServiceNowClient,
  input: PredictConflictsInput
): Promise<PredictionResult> {
  const conflicts: PredictedConflict[] = [];
  let existingArtifactsOnTable = 0;
  let potentialCollisions = 0;
  
  // Get existing artifacts on the same table based on change type
  if (input.changeType.includes('business_rule')) {
    try {
      const existingBRs = await client.getRecords('sys_script', {
        sysparm_query: `collection=${input.targetTable}^active=true`,
        sysparm_fields: 'sys_id,name,when,order,condition,script',
        sysparm_limit: 100
      });

      existingArtifactsOnTable = existingBRs.length;

      // Check for order collisions
      const proposedOrder = input.proposedChanges?.order || 100;
      const proposedWhen = input.proposedChanges?.when || 'before';

      for (const br of existingBRs) {
        const brOrder = parseInt(String(br.order || '100')) || 100;
        const brWhen = String(br.when || 'before');
        const brName = String(br.name || 'Unnamed');
        const brSysId = String(br.sys_id || '');
        const brCondition = String(br.condition || '');
        const brScript = String(br.script || '');

        // Same order + same when = collision
        if (brOrder === proposedOrder && brWhen === proposedWhen) {
          potentialCollisions++;
          conflicts.push({
            id: `ORD-${brSysId.substring(0, 8)}`,
            type: 'order_collision',
            severity: 'medium',
            probability: 90,
            title: 'Order Collision Detected',
            description: `Business Rule "${brName}" has same order (${brOrder}) and timing (${brWhen})`,
            conflictingArtifact: { name: brName, sysId: brSysId, type: 'Business Rule' },
            recommendation: `Change order to ${proposedOrder + 10} to avoid collision`
          });
        }

        // Check for condition overlap (simplified)
        if (input.proposedChanges?.condition && brCondition) {
          const proposedCondition = input.proposedChanges.condition.toLowerCase();
          const existingCondition = brCondition.toLowerCase();

          if (proposedCondition.includes(existingCondition) || existingCondition.includes(proposedCondition)) {
            conflicts.push({
              id: `COND-${brSysId.substring(0, 8)}`,
              type: 'condition_overlap',
              severity: 'low',
              probability: 60,
              title: 'Condition Overlap',
              description: `Condition may overlap with "${brName}"`,
              conflictingArtifact: { name: brName, sysId: brSysId, type: 'Business Rule' },
              recommendation: 'Review conditions to ensure intended behavior'
            });
          }
        }

        // Check for script conflicts (current.update in both)
        if (input.proposedChanges?.script && brScript) {
          if (input.proposedChanges.script.includes('current.update') && brScript.includes('current.update')) {
            conflicts.push({
              id: `SCR-${brSysId.substring(0, 8)}`,
              type: 'script_conflict',
              severity: 'high',
              probability: 85,
              title: 'Multiple current.update() Calls',
              description: `Both scripts call current.update() - may cause infinite loop with "${brName}"`,
              conflictingArtifact: { name: brName, sysId: brSysId, type: 'Business Rule' },
              recommendation: 'Remove current.update() from one or both rules'
            });
          }
        }
      }
    } catch {
      // Query issue
    }
  }

  // ACL conflict prediction
  if (input.changeType.includes('acl')) {
    try {
      const existingACLs = await client.getRecords('sys_security_acl', {
        sysparm_query: `name=${input.targetTable}^active=true`,
        sysparm_fields: 'sys_id,name,operation,admin_overrides,condition',
        sysparm_limit: 50
      });
      
      existingArtifactsOnTable += existingACLs.length;
      
      if (existingACLs.length > 10) {
        conflicts.push({
          id: 'ACL-COMPLEX',
          type: 'security_risk',
          severity: 'medium',
          probability: 70,
          title: 'Complex ACL Stack',
          description: `Table has ${existingACLs.length} ACLs - adding more increases complexity`,
          recommendation: 'Consider consolidating ACLs or using row-level security'
        });
      }
    } catch {
      // Query issue
    }
  }
  
  // Calculate overall risk
  const criticalCount = conflicts.filter(c => c.severity === 'critical').length;
  const highCount = conflicts.filter(c => c.severity === 'high').length;
  const mediumCount = conflicts.filter(c => c.severity === 'medium').length;
  
  let riskScore = 100;
  riskScore -= criticalCount * 30;
  riskScore -= highCount * 15;
  riskScore -= mediumCount * 5;
  riskScore = Math.max(0, riskScore);
  
  const overallRisk = riskScore < 40 ? 'critical' : riskScore < 60 ? 'high' : riskScore < 80 ? 'medium' : 'low';
  
  // Generate suggestions
  const suggestions: string[] = [];
  if (potentialCollisions > 0) {
    suggestions.push(`Use order ${(input.proposedChanges?.order || 100) + 50} to avoid collisions`);
  }
  if (existingArtifactsOnTable > 20) {
    suggestions.push('Consider consolidating Business Rules into Script Includes');
  }
  if (conflicts.some(c => c.type === 'script_conflict')) {
    suggestions.push('Remove current.update() - it auto-saves in before rules');
  }
  
  return {
    success: true,
    changeType: input.changeType,
    targetTable: input.targetTable,
    overallRisk,
    riskScore,
    predictedConflicts: conflicts,
    safetyAnalysis: {
      existingArtifactsOnTable,
      potentialCollisions,
      recommendedOrder: potentialCollisions > 0 ? (input.proposedChanges?.order || 100) + 50 : undefined
    },
    suggestions
  };
}

