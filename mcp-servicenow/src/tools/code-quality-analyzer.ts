/**
 * Code Quality Analyzer Tool
 * Analyzes ServiceNow script quality and provides metrics and recommendations
 *
 * Task 1.5 of the Brownfield Enhancement Plan
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const codeQualityScoreSchema = z.object({
  artifactType: z.enum([
    'all', 'script_include', 'business_rule', 'client_script',
    'ui_action', 'ui_policy', 'scheduled_job', 'fix_script', 'flow_action'
  ]).default('all').describe('Type of artifact to analyze'),
  artifactName: z.string().optional().describe('Specific artifact name to analyze'),
  scope: z.string().optional().describe('Filter by application scope'),
  includeDetails: z.boolean().default(true).describe('Include detailed metrics per artifact'),
  minScore: z.number().min(0).max(100).optional().describe('Only return artifacts below this score'),
  limit: z.number().min(1).max(500).default(100).describe('Maximum artifacts to analyze')
});

export type CodeQualityInput = z.infer<typeof codeQualityScoreSchema>;

// ============ TYPES ============

interface QualityMetrics {
  cyclomaticComplexity: number;
  nestingDepth: number;
  lineCount: number;
  functionCount: number;
  commentRatio: number;
  hasJsDoc: boolean;
  usesStrictMode: boolean;
  hasErrorHandling: boolean;
  usesConstants: boolean;
  averageFunctionLength: number;
  longestFunctionLength: number;
  hasConsistentNaming: boolean;
}

interface QualityIssue {
  category: 'complexity' | 'documentation' | 'best_practices' | 'code_style' | 'maintainability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
}

interface ArtifactQuality {
  sys_id: string;
  name: string;
  type: string;
  table: string;
  scope: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  metrics: QualityMetrics;
  issues: QualityIssue[];
}

interface QualitySummary {
  totalArtifacts: number;
  averageScore: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  scoreDistribution: { excellent: number; good: number; fair: number; poor: number; failing: number };
  topIssues: Array<{ issue: string; count: number; severity: string }>;
  categoryScores: { complexity: number; documentation: number; bestPractices: number; codeStyle: number; maintainability: number };
}

interface CodeQualityResult {
  success: boolean;
  summary: QualitySummary;
  artifacts: ArtifactQuality[];
  recommendations: string[];
}

interface ArtifactQuery {
  table: string;
  type: string;
  nameField: string;
  scriptField: string;
  filter?: string;
}

const ARTIFACT_QUERIES: Record<string, ArtifactQuery> = {
  script_include: { table: 'sys_script_include', type: 'Script Include', nameField: 'name', scriptField: 'script', filter: 'active=true' },
  business_rule: { table: 'sys_script', type: 'Business Rule', nameField: 'name', scriptField: 'script', filter: 'active=true' },
  client_script: { table: 'sys_script_client', type: 'Client Script', nameField: 'name', scriptField: 'script', filter: 'active=true' },
  ui_action: { table: 'sys_ui_action', type: 'UI Action', nameField: 'name', scriptField: 'script', filter: 'active=true' },
  ui_policy: { table: 'sys_ui_policy_action', type: 'UI Policy', nameField: 'ui_policy.name', scriptField: 'script_true', filter: 'active=true' },
  scheduled_job: { table: 'sysauto_script', type: 'Scheduled Job', nameField: 'name', scriptField: 'script', filter: 'active=true' },
  fix_script: { table: 'sys_script_fix', type: 'Fix Script', nameField: 'name', scriptField: 'script' },
  flow_action: { table: 'sys_hub_action_type_definition', type: 'Flow Action', nameField: 'name', scriptField: 'script' }
};

// ============ QUALITY METRICS CALCULATION ============

function calculateCyclomaticComplexity(script: string): number {
  const patterns = [/\bif\s*\(/g, /\belse\s+if\s*\(/g, /\bwhile\s*\(/g, /\bfor\s*\(/g, /\bcase\s+[^:]+:/g, /\bcatch\s*\(/g, /\?\s*[^:]+\s*:/g, /\&\&/g, /\|\|/g];
  let complexity = 1;
  for (const pattern of patterns) {
    const matches = script.match(pattern);
    if (matches) complexity += matches.length;
  }
  return complexity;
}

function calculateNestingDepth(script: string): number {
  let maxDepth = 0, currentDepth = 0;
  for (const char of script) {
    if (char === '{') { currentDepth++; maxDepth = Math.max(maxDepth, currentDepth); }
    else if (char === '}') { currentDepth = Math.max(0, currentDepth - 1); }
  }
  return maxDepth;
}

function countLinesOfCode(script: string): number {
  const lines = script.split('\n');
  let count = 0, inBlockComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('/*')) inBlockComment = true;
    if (trimmed.endsWith('*/')) { inBlockComment = false; continue; }
    if (inBlockComment || trimmed === '' || trimmed.startsWith('//')) continue;
    count++;
  }
  return count;
}

function analyzeFunctions(script: string): { count: number; avgLength: number; maxLength: number } {
  const functionRegex = /function\s+\w+\s*\([^)]*\)|function\s*\([^)]*\)|\w+\s*:\s*function|=>\s*\{/g;
  const matches = script.match(functionRegex) || [];
  if (matches.length === 0) return { count: 0, avgLength: 0, maxLength: 0 };
  const totalLines = countLinesOfCode(script);
  const avgLength = Math.round(totalLines / matches.length);
  return { count: matches.length, avgLength, maxLength: avgLength * 2 };
}

function calculateCommentRatio(script: string): number {
  const lines = script.split('\n');
  let commentLines = 0, codeLines = 0, inBlockComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('/*')) { inBlockComment = true; commentLines++; continue; }
    if (inBlockComment) { commentLines++; if (trimmed.endsWith('*/')) inBlockComment = false; continue; }
    if (trimmed === '') continue;
    if (trimmed.startsWith('//')) commentLines++; else { codeLines++; if (trimmed.includes('//')) commentLines += 0.5; }
  }
  return codeLines === 0 ? 0 : Math.round((commentLines / codeLines) * 100) / 100;
}


// ============ ADDITIONAL CHECKS ============

function hasJsDoc(script: string): boolean {
  return /\/\*\*[\s\S]*?\*\//.test(script);
}

function hasErrorHandling(script: string): boolean {
  return /\btry\s*\{/.test(script) && /\bcatch\s*\(/.test(script);
}

function usesStrictMode(script: string): boolean {
  return /'use strict'|"use strict"/.test(script);
}

function usesConstants(script: string): boolean {
  return /\bconst\s+[A-Z_]+\s*=/.test(script) || /var\s+[A-Z_]+\s*=/.test(script);
}

function hasConsistentNaming(script: string): boolean {
  const camelCaseVars = script.match(/\b(var|let|const)\s+([a-z][a-zA-Z0-9]*)\b/g) || [];
  const badNaming = script.match(/\b(var|let|const)\s+([a-z]|[A-Z][A-Z0-9_]*[a-z])\b/g) || [];
  return badNaming.length < camelCaseVars.length * 0.2;
}

// ============ ANALYZE SINGLE ARTIFACT ============

function analyzeScript(script: string): { metrics: QualityMetrics; issues: QualityIssue[]; score: number } {
  const funcInfo = analyzeFunctions(script);

  const metrics: QualityMetrics = {
    cyclomaticComplexity: calculateCyclomaticComplexity(script),
    nestingDepth: calculateNestingDepth(script),
    lineCount: countLinesOfCode(script),
    functionCount: funcInfo.count,
    commentRatio: calculateCommentRatio(script),
    hasJsDoc: hasJsDoc(script),
    usesStrictMode: usesStrictMode(script),
    hasErrorHandling: hasErrorHandling(script),
    usesConstants: usesConstants(script),
    averageFunctionLength: funcInfo.avgLength,
    longestFunctionLength: funcInfo.maxLength,
    hasConsistentNaming: hasConsistentNaming(script)
  };

  const issues: QualityIssue[] = [];
  let score = 100;

  // Complexity checks
  if (metrics.cyclomaticComplexity > 20) {
    issues.push({ category: 'complexity', severity: 'critical', message: `Very high cyclomatic complexity: ${metrics.cyclomaticComplexity}`, recommendation: 'Break down into smaller functions' });
    score -= 20;
  } else if (metrics.cyclomaticComplexity > 10) {
    issues.push({ category: 'complexity', severity: 'high', message: `High cyclomatic complexity: ${metrics.cyclomaticComplexity}`, recommendation: 'Consider simplifying logic' });
    score -= 10;
  } else if (metrics.cyclomaticComplexity > 5) {
    issues.push({ category: 'complexity', severity: 'medium', message: `Moderate complexity: ${metrics.cyclomaticComplexity}`, recommendation: 'Monitor for growth' });
    score -= 5;
  }

  if (metrics.nestingDepth > 5) {
    issues.push({ category: 'complexity', severity: 'high', message: `Deep nesting: ${metrics.nestingDepth} levels`, recommendation: 'Use early returns or extract functions' });
    score -= 10;
  } else if (metrics.nestingDepth > 3) {
    issues.push({ category: 'complexity', severity: 'medium', message: `Moderate nesting: ${metrics.nestingDepth} levels`, recommendation: 'Consider flattening' });
    score -= 5;
  }

  // Documentation checks
  if (metrics.lineCount > 20 && metrics.commentRatio < 0.1) {
    issues.push({ category: 'documentation', severity: 'high', message: 'Very low comment ratio', recommendation: 'Add comments explaining business logic' });
    score -= 10;
  } else if (metrics.lineCount > 50 && !metrics.hasJsDoc) {
    issues.push({ category: 'documentation', severity: 'medium', message: 'No JSDoc documentation', recommendation: 'Add JSDoc for functions' });
    score -= 5;
  }

  // Best practices
  if (metrics.lineCount > 50 && !metrics.hasErrorHandling) {
    issues.push({ category: 'best_practices', severity: 'medium', message: 'No error handling', recommendation: 'Add try/catch for robust code' });
    score -= 5;
  }

  // Code style
  if (metrics.longestFunctionLength > 100) {
    issues.push({ category: 'code_style', severity: 'high', message: `Long function: ${metrics.longestFunctionLength} lines`, recommendation: 'Break into smaller functions (<50 lines)' });
    score -= 10;
  } else if (metrics.longestFunctionLength > 50) {
    issues.push({ category: 'code_style', severity: 'medium', message: `Function length: ${metrics.longestFunctionLength} lines`, recommendation: 'Consider splitting' });
    score -= 5;
  }

  if (metrics.lineCount > 500) {
    issues.push({ category: 'maintainability', severity: 'high', message: `Very large script: ${metrics.lineCount} lines`, recommendation: 'Split into multiple Script Includes' });
    score -= 10;
  } else if (metrics.lineCount > 200) {
    issues.push({ category: 'maintainability', severity: 'medium', message: `Large script: ${metrics.lineCount} lines`, recommendation: 'Consider modularization' });
    score -= 5;
  }

  if (!metrics.hasConsistentNaming) {
    issues.push({ category: 'code_style', severity: 'low', message: 'Inconsistent naming conventions', recommendation: 'Use camelCase for variables' });
    score -= 3;
  }

  return { metrics, issues, score: Math.max(0, score) };
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}


// ============ MAIN FUNCTION ============

export async function getCodeQualityScore(
  client: ServiceNowClient,
  input: CodeQualityInput
): Promise<CodeQualityResult> {
  const artifacts: ArtifactQuality[] = [];
  const issueCounts: Record<string, { count: number; severity: string }> = {};
  const categoryScores = { complexity: 0, documentation: 0, bestPractices: 0, codeStyle: 0, maintainability: 0 };
  const categoryCounts = { complexity: 0, documentation: 0, bestPractices: 0, codeStyle: 0, maintainability: 0 };

  // Determine which artifact types to analyze
  const typesToAnalyze = input.artifactType === 'all'
    ? Object.keys(ARTIFACT_QUERIES)
    : [input.artifactType];

  for (const artifactType of typesToAnalyze) {
    const query = ARTIFACT_QUERIES[artifactType];
    if (!query) continue;

    try {
      let filter = query.filter || '';
      if (input.scope) {
        filter += (filter ? '^' : '') + `sys_scope.scope=${input.scope}`;
      }
      if (input.artifactName) {
        filter += (filter ? '^' : '') + `${query.nameField}LIKE${input.artifactName}`;
      }

      const records = await client.getRecords(query.table, {
        sysparm_query: filter,
        sysparm_fields: `sys_id,${query.nameField},${query.scriptField},sys_scope.scope`,
        sysparm_limit: input.limit || 100
      });

      for (const record of records) {
        const script = String(record[query.scriptField] || '');
        if (!script || script.length < 10) continue;

        const analysis = analyzeScript(script);

        // Filter by minScore if specified
        if (input.minScore !== undefined && analysis.score >= input.minScore) continue;

        const artifactQuality: ArtifactQuality = {
          sys_id: String(record.sys_id || ''),
          name: String(record[query.nameField] || 'Unknown'),
          type: query.type,
          table: query.table,
          scope: String(record['sys_scope.scope'] || 'global'),
          score: analysis.score,
          grade: getGrade(analysis.score),
          metrics: analysis.metrics,
          issues: analysis.issues
        };

        artifacts.push(artifactQuality);

        // Track issue counts
        for (const issue of analysis.issues) {
          const key = issue.message;
          if (!issueCounts[key]) {
            issueCounts[key] = { count: 0, severity: issue.severity };
          }
          issueCounts[key].count++;

          // Category scores
          const cat = issue.category;
          if (cat === 'complexity') { categoryCounts.complexity++; }
          else if (cat === 'documentation') { categoryCounts.documentation++; }
          else if (cat === 'best_practices') { categoryCounts.bestPractices++; }
          else if (cat === 'code_style') { categoryCounts.codeStyle++; }
          else if (cat === 'maintainability') { categoryCounts.maintainability++; }
        }
      }
    } catch (error) {
      // Continue on error
    }
  }

  // Calculate summary
  const totalArtifacts = artifacts.length;
  const averageScore = totalArtifacts > 0
    ? Math.round(artifacts.reduce((sum, a) => sum + a.score, 0) / totalArtifacts)
    : 100;

  const scoreDistribution = {
    excellent: artifacts.filter(a => a.score >= 90).length,
    good: artifacts.filter(a => a.score >= 80 && a.score < 90).length,
    fair: artifacts.filter(a => a.score >= 70 && a.score < 80).length,
    poor: artifacts.filter(a => a.score >= 60 && a.score < 70).length,
    failing: artifacts.filter(a => a.score < 60).length
  };

  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([issue, data]) => ({ issue, count: data.count, severity: data.severity }));

  // Calculate category scores (higher is worse)
  const maxCount = Math.max(...Object.values(categoryCounts), 1);
  categoryScores.complexity = Math.round(100 - (categoryCounts.complexity / maxCount * 100));
  categoryScores.documentation = Math.round(100 - (categoryCounts.documentation / maxCount * 100));
  categoryScores.bestPractices = Math.round(100 - (categoryCounts.bestPractices / maxCount * 100));
  categoryScores.codeStyle = Math.round(100 - (categoryCounts.codeStyle / maxCount * 100));
  categoryScores.maintainability = Math.round(100 - (categoryCounts.maintainability / maxCount * 100));

  // Generate recommendations
  const recommendations: string[] = [];
  if (scoreDistribution.failing > totalArtifacts * 0.2) {
    recommendations.push('CRITICAL: Over 20% of scripts have failing quality scores. Schedule a code review sprint.');
  }
  if (topIssues.some(i => i.issue.includes('complexity') && i.count > 10)) {
    recommendations.push('Many scripts have high complexity. Consider breaking them into smaller functions.');
  }
  if (topIssues.some(i => i.issue.includes('comment') && i.count > 10)) {
    recommendations.push('Documentation is lacking. Add JSDoc and inline comments for maintainability.');
  }
  if (topIssues.some(i => i.issue.includes('error handling') && i.count > 5)) {
    recommendations.push('Add try/catch blocks to handle errors gracefully.');
  }

  return {
    success: true,
    summary: {
      totalArtifacts,
      averageScore,
      overallGrade: getGrade(averageScore),
      scoreDistribution,
      topIssues,
      categoryScores
    },
    artifacts: input.includeDetails ? artifacts.sort((a, b) => a.score - b.score) : [],
    recommendations
  };
}