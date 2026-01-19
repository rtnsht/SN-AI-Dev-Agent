/**
 * Change Impact Analyzer Tool
 * Previews the impact of proposed changes before they are made
 *
 * Task 2.1 of the Brownfield Enhancement Plan - Step 2: Guardrails & Impact Analysis
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const previewChangeImpactSchema = z.object({
  changeType: z.enum([
    'create_business_rule',
    'modify_business_rule',
    'create_client_script',
    'modify_client_script',
    'create_script_include',
    'modify_script_include',
    'create_ui_action',
    'modify_ui_action',
    'modify_table',
    'create_field',
    'modify_field',
    'delete_artifact'
  ]).describe('Type of change being proposed'),

  targetTable: z.string().optional().describe('Table the change affects'),
  targetArtifact: z.string().optional().describe('sys_id or name of artifact being modified'),

  proposedScript: z.string().optional().describe('The proposed script content'),
  proposedCondition: z.string().optional().describe('Proposed condition/filter'),
  proposedWhen: z.enum(['before', 'after', 'async', 'display']).optional().describe('When the script runs'),

  scope: z.string().optional().describe('Application scope for the change'),
  includePerformanceAnalysis: z.boolean().default(true).describe('Analyze performance impact'),
  includeSecurityAnalysis: z.boolean().default(true).describe('Analyze security implications'),
  includeDependencyAnalysis: z.boolean().default(true).describe('Analyze dependency impacts')
});

export type PreviewChangeImpactInput = z.infer<typeof previewChangeImpactSchema>;

// ============ TYPES ============

interface ImpactItem {
  category: 'performance' | 'security' | 'functionality' | 'upgrade' | 'dependency' | 'conflict';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  affectedArtifacts?: string[];
  recommendation?: string;
}

interface ConflictItem {
  type: 'duplicate_trigger' | 'order_conflict' | 'condition_overlap' | 'name_collision' | 'api_conflict';
  severity: 'critical' | 'high' | 'medium' | 'low';
  conflictsWith: string;
  description: string;
  resolution?: string;
}

interface DependencyImpact {
  artifact: string;
  type: string;
  impactType: 'will_break' | 'may_affect' | 'informational';
  description: string;
}

interface ChangeImpactResult {
  success: boolean;
  changeType: string;
  targetTable?: string;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  summary: {
    totalImpacts: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    conflictsFound: number;
    dependenciesAffected: number;
  };
  impacts: ImpactItem[];
  conflicts: ConflictItem[];
  dependencies: DependencyImpact[];
  recommendations: string[];
  approvalRequired: boolean;
  approvalReason?: string;
}

// ============ SCRIPT ANALYSIS PATTERNS ============

const PERFORMANCE_PATTERNS = [
  { pattern: /current\.update\(\)/gi, issue: 'current.update() in script', severity: 'critical' as const,
    description: 'Can cause infinite loops in Business Rules' },
  { pattern: /GlideRecord\([^)]+\)\.query\(\)/gi, issue: 'GlideRecord query', severity: 'medium' as const,
    description: 'Database query - ensure proper indexing on queried fields' },
  { pattern: /while\s*\([^)]*\.next\(\)/gi, issue: 'Loop over GlideRecord', severity: 'medium' as const,
    description: 'Iterating over records can be slow for large datasets' },
  { pattern: /getRowCount\(\)/gi, issue: 'getRowCount() usage', severity: 'high' as const,
    description: 'Counts all matching records - use getCount() or limit queries' },
  { pattern: /gs\.sleep\(/gi, issue: 'gs.sleep() usage', severity: 'high' as const,
    description: 'Blocks thread execution - avoid in synchronous scripts' },
  { pattern: /new\s+GlideDateTime\(\)/gi, issue: 'GlideDateTime creation', severity: 'low' as const,
    description: 'Multiple datetime objects can impact performance' }
];

const SECURITY_PATTERNS = [
  { pattern: /eval\s*\(/gi, issue: 'eval() usage', severity: 'critical' as const,
    description: 'Security risk - can execute arbitrary code' },
  { pattern: /new\s+Function\s*\(/gi, issue: 'Dynamic function creation', severity: 'high' as const,
    description: 'Similar to eval - security concern' },
  { pattern: /gs\.getUser\(\)\.isMemberOf/gi, issue: 'Role check in script', severity: 'info' as const,
    description: 'Ensure proper role-based access control' },
  { pattern: /setBasicAuth\s*\(/gi, issue: 'Basic auth credentials', severity: 'high' as const,
    description: 'Credentials in code - use Connection & Credential records' },
  { pattern: /password|secret|api[_-]?key/gi, issue: 'Potential hardcoded credentials', severity: 'high' as const,
    description: 'Review for hardcoded sensitive data' }
];

const UPGRADE_PATTERNS = [
  { pattern: /\$\(/gi, issue: 'jQuery selector', severity: 'medium' as const,
    description: 'jQuery is deprecated in newer ServiceNow versions' },
  { pattern: /gel\s*\(/gi, issue: 'gel() usage', severity: 'medium' as const,
    description: 'Legacy API - consider using g_form methods' },
  { pattern: /document\./gi, issue: 'Direct DOM access', severity: 'medium' as const,
    description: 'Direct DOM manipulation may break in upgrades' }
];


// ============ ANALYSIS FUNCTIONS ============

function analyzeScriptPerformance(script: string): ImpactItem[] {
  const impacts: ImpactItem[] = [];

  for (const pattern of PERFORMANCE_PATTERNS) {
    const matches = script.match(pattern.pattern);
    if (matches) {
      impacts.push({
        category: 'performance',
        severity: pattern.severity,
        title: pattern.issue,
        description: `${pattern.description}. Found ${matches.length} occurrence(s).`,
        recommendation: getPerformanceRecommendation(pattern.issue)
      });
    }
  }

  // Check script length
  const lines = script.split('\n').length;
  if (lines > 200) {
    impacts.push({
      category: 'performance',
      severity: 'medium',
      title: 'Large script',
      description: `Script has ${lines} lines. Consider breaking into smaller functions.`,
      recommendation: 'Extract reusable logic into Script Includes'
    });
  }

  return impacts;
}

function analyzeScriptSecurity(script: string): ImpactItem[] {
  const impacts: ImpactItem[] = [];

  for (const pattern of SECURITY_PATTERNS) {
    const matches = script.match(pattern.pattern);
    if (matches) {
      impacts.push({
        category: 'security',
        severity: pattern.severity,
        title: pattern.issue,
        description: pattern.description,
        recommendation: getSecurityRecommendation(pattern.issue)
      });
    }
  }

  return impacts;
}

function analyzeUpgradeRisk(script: string): ImpactItem[] {
  const impacts: ImpactItem[] = [];

  for (const pattern of UPGRADE_PATTERNS) {
    const matches = script.match(pattern.pattern);
    if (matches) {
      impacts.push({
        category: 'upgrade',
        severity: pattern.severity,
        title: pattern.issue,
        description: pattern.description,
        recommendation: 'Use supported APIs for better upgrade compatibility'
      });
    }
  }

  return impacts;
}

function getPerformanceRecommendation(issue: string): string {
  const recommendations: Record<string, string> = {
    'current.update() in script': 'Remove current.update() - changes are auto-saved. Use workflow or async BR if needed.',
    'GlideRecord query': 'Ensure queried fields are indexed. Use addEncodedQuery for complex filters.',
    'Loop over GlideRecord': 'Consider batch processing or async Business Rules for large datasets.',
    'getRowCount() usage': 'Use GlideAggregate with getCount() for better performance.',
    'gs.sleep() usage': 'Move to async Business Rule or Scheduled Job.'
  };
  return recommendations[issue] || 'Review for performance optimization.';
}

function getSecurityRecommendation(issue: string): string {
  const recommendations: Record<string, string> = {
    'eval() usage': 'Never use eval(). Refactor to use proper object methods or JSON.parse().',
    'Dynamic function creation': 'Avoid new Function(). Use defined functions instead.',
    'Basic auth credentials': 'Store credentials in Connection & Credential records.',
    'Potential hardcoded credentials': 'Move sensitive data to System Properties or Credentials.'
  };
  return recommendations[issue] || 'Review for security best practices.';
}

// ============ CONFLICT DETECTION ============

async function detectConflicts(
  client: ServiceNowClient,
  input: PreviewChangeImpactInput
): Promise<ConflictItem[]> {
  const conflicts: ConflictItem[] = [];

  if (!input.targetTable) return conflicts;

  // Check for existing Business Rules on same table with same trigger
  if (input.changeType === 'create_business_rule' && input.proposedWhen) {
    try {
      const existingRules = await client.getRecords('sys_script', {
        sysparm_query: `collection=${input.targetTable}^when=${input.proposedWhen}^active=true`,
        sysparm_fields: 'sys_id,name,order,condition',
        sysparm_limit: 50
      });

      if (existingRules.length > 10) {
        conflicts.push({
          type: 'order_conflict',
          severity: 'medium',
          conflictsWith: `${existingRules.length} existing Business Rules`,
          description: `Table already has ${existingRules.length} ${input.proposedWhen} Business Rules. Order may need adjustment.`,
          resolution: 'Review execution order to ensure correct sequence.'
        });
      }

      // Check for similar conditions
      if (input.proposedCondition) {
        for (const rule of existingRules) {
          if (rule.condition && String(rule.condition) === input.proposedCondition) {
            conflicts.push({
              type: 'condition_overlap',
              severity: 'high',
              conflictsWith: String(rule.name),
              description: `Existing rule "${rule.name}" has identical condition. May cause duplicate processing.`,
              resolution: 'Combine logic into single rule or differentiate conditions.'
            });
          }
        }
      }
    } catch {
      // Continue on error
    }
  }

  return conflicts;
}


// ============ DEPENDENCY ANALYSIS ============

async function analyzeDependencies(
  client: ServiceNowClient,
  input: PreviewChangeImpactInput
): Promise<DependencyImpact[]> {
  const dependencies: DependencyImpact[] = [];

  // If modifying a Script Include, find what depends on it
  if (input.changeType === 'modify_script_include' && input.targetArtifact) {
    try {
      // Search for references in Business Rules
      const brRefs = await client.getRecords('sys_script', {
        sysparm_query: `scriptLIKE${input.targetArtifact}^active=true`,
        sysparm_fields: 'sys_id,name',
        sysparm_limit: 20
      });

      for (const br of brRefs) {
        dependencies.push({
          artifact: String(br.name),
          type: 'Business Rule',
          impactType: 'may_affect',
          description: `Business Rule "${br.name}" calls this Script Include`
        });
      }

      // Search for references in Client Scripts
      const csRefs = await client.getRecords('sys_script_client', {
        sysparm_query: `scriptLIKE${input.targetArtifact}^active=true`,
        sysparm_fields: 'sys_id,name',
        sysparm_limit: 20
      });

      for (const cs of csRefs) {
        dependencies.push({
          artifact: String(cs.name),
          type: 'Client Script',
          impactType: 'may_affect',
          description: `Client Script "${cs.name}" references this Script Include via GlideAjax`
        });
      }

      // Search for references in other Script Includes
      const siRefs = await client.getRecords('sys_script_include', {
        sysparm_query: `scriptLIKE${input.targetArtifact}^active=true^name!=${input.targetArtifact}`,
        sysparm_fields: 'sys_id,name',
        sysparm_limit: 20
      });

      for (const si of siRefs) {
        dependencies.push({
          artifact: String(si.name),
          type: 'Script Include',
          impactType: 'may_affect',
          description: `Script Include "${si.name}" extends or uses this class`
        });
      }
    } catch {
      // Continue on error
    }
  }

  // If deleting an artifact, this is critical
  if (input.changeType === 'delete_artifact' && input.targetArtifact) {
    for (const dep of dependencies) {
      dep.impactType = 'will_break';
      dep.description = `WILL BREAK: ${dep.description}`;
    }
  }

  return dependencies;
}

// ============ RISK CALCULATION ============

function calculateRiskScore(impacts: ImpactItem[], conflicts: ConflictItem[], dependencies: DependencyImpact[]): number {
  let score = 100; // Start at 100 (no risk)

  // Deduct for impacts
  for (const impact of impacts) {
    switch (impact.severity) {
      case 'critical': score -= 25; break;
      case 'high': score -= 15; break;
      case 'medium': score -= 8; break;
      case 'low': score -= 3; break;
    }
  }

  // Deduct for conflicts
  for (const conflict of conflicts) {
    switch (conflict.severity) {
      case 'critical': score -= 30; break;
      case 'high': score -= 20; break;
      case 'medium': score -= 10; break;
      case 'low': score -= 5; break;
    }
  }

  // Deduct for dependencies that will break
  for (const dep of dependencies) {
    switch (dep.impactType) {
      case 'will_break': score -= 20; break;
      case 'may_affect': score -= 5; break;
    }
  }

  return Math.max(0, score);
}

function getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score < 30) return 'critical';
  if (score < 50) return 'high';
  if (score < 70) return 'medium';
  return 'low';
}

function shouldRequireApproval(
  impacts: ImpactItem[],
  conflicts: ConflictItem[],
  riskLevel: string
): { required: boolean; reason?: string } {
  // Critical risk always needs approval
  if (riskLevel === 'critical') {
    return { required: true, reason: 'Critical risk level requires senior review' };
  }

  // Any critical severity impact
  if (impacts.some(i => i.severity === 'critical')) {
    return { required: true, reason: 'Contains critical severity issues' };
  }

  // Any critical conflict
  if (conflicts.some(c => c.severity === 'critical')) {
    return { required: true, reason: 'Contains critical conflicts with existing artifacts' };
  }

  // Multiple high severity issues
  const highCount = impacts.filter(i => i.severity === 'high').length +
                    conflicts.filter(c => c.severity === 'high').length;
  if (highCount >= 3) {
    return { required: true, reason: 'Multiple high-severity issues detected' };
  }

  return { required: false };
}


// ============ MAIN EXPORT ============

export async function previewChangeImpact(
  client: ServiceNowClient,
  input: PreviewChangeImpactInput
): Promise<ChangeImpactResult> {
  const impacts: ImpactItem[] = [];
  let conflicts: ConflictItem[] = [];
  let dependencies: DependencyImpact[] = [];

  // Analyze proposed script if provided
  if (input.proposedScript) {
    if (input.includePerformanceAnalysis) {
      impacts.push(...analyzeScriptPerformance(input.proposedScript));
    }

    if (input.includeSecurityAnalysis) {
      impacts.push(...analyzeScriptSecurity(input.proposedScript));
    }

    // Always check upgrade risk
    impacts.push(...analyzeUpgradeRisk(input.proposedScript));
  }

  // Detect conflicts with existing artifacts
  conflicts = await detectConflicts(client, input);

  // Analyze dependency impacts
  if (input.includeDependencyAnalysis) {
    dependencies = await analyzeDependencies(client, input);
  }

  // Calculate risk
  const riskScore = calculateRiskScore(impacts, conflicts, dependencies);
  const riskLevel = getRiskLevel(riskScore);

  // Determine approval requirements
  const approvalCheck = shouldRequireApproval(impacts, conflicts, riskLevel);

  // Count by severity
  const criticalCount = impacts.filter(i => i.severity === 'critical').length;
  const highCount = impacts.filter(i => i.severity === 'high').length;
  const mediumCount = impacts.filter(i => i.severity === 'medium').length;
  const lowCount = impacts.filter(i => i.severity === 'low').length;

  // Generate recommendations
  const recommendations = generateRecommendations(impacts, conflicts, dependencies, input);

  return {
    success: true,
    changeType: input.changeType,
    targetTable: input.targetTable,
    riskScore,
    riskLevel,
    summary: {
      totalImpacts: impacts.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      conflictsFound: conflicts.length,
      dependenciesAffected: dependencies.length
    },
    impacts,
    conflicts,
    dependencies,
    recommendations,
    approvalRequired: approvalCheck.required,
    approvalReason: approvalCheck.reason
  };
}

function generateRecommendations(
  impacts: ImpactItem[],
  conflicts: ConflictItem[],
  dependencies: DependencyImpact[],
  input: PreviewChangeImpactInput
): string[] {
  const recommendations: string[] = [];

  // Add specific recommendations based on findings
  if (impacts.some(i => i.category === 'performance' && i.severity === 'critical')) {
    recommendations.push('⚠️ CRITICAL: Address performance issues before proceeding');
  }

  if (impacts.some(i => i.category === 'security')) {
    recommendations.push('🔒 Review security implications with a security admin');
  }

  if (conflicts.length > 0) {
    recommendations.push('📋 Review conflicts with existing artifacts before deploying');
  }

  if (dependencies.filter(d => d.impactType === 'will_break').length > 0) {
    recommendations.push('🚨 This change will break dependent artifacts - update them first');
  }

  if (dependencies.filter(d => d.impactType === 'may_affect').length > 5) {
    recommendations.push('📊 Many artifacts depend on this - consider a phased rollout');
  }

  if (input.changeType.includes('delete')) {
    recommendations.push('💾 Create a backup before deleting');
    recommendations.push('🧪 Test in a sub-production instance first');
  }

  if (input.changeType.includes('create') && input.targetTable === 'incident') {
    recommendations.push('📍 Incident table is heavily customized - verify no conflicts');
  }

  // General best practices
  if (recommendations.length === 0) {
    recommendations.push('✅ No major issues detected - proceed with standard testing');
  }

  return recommendations;
}