/**
 * Anti-Pattern Detector
 *
 * Detects common bad practices and anti-patterns in ServiceNow code.
 * Based on ServiceNow Instance Scan best practices and community knowledge.
 *
 * Categories:
 * - Performance: Issues that cause slow transactions
 * - Security: Vulnerabilities and unsafe practices
 * - Maintainability: Code that's hard to maintain
 * - Upgradability: Issues that cause upgrade problems
 * - User Experience: Poor UX patterns
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const findAntiPatternsSchema = z.object({
  categories: z.array(z.enum([
    'all',
    'performance',
    'security',
    'maintainability',
    'upgradability',
    'user_experience'
  ])).optional().default(['all']).describe('Categories of anti-patterns to detect'),

  scope: z.string().optional().describe('Filter by application scope'),

  severity: z.enum(['all', 'critical', 'high', 'medium', 'low']).optional().default('all').describe(
    'Minimum severity level to report'
  ),

  artifactTypes: z.array(z.enum([
    'all',
    'business_rules',
    'client_scripts',
    'script_includes',
    'ui_actions',
    'scheduled_jobs',
    'acls',
    'notifications',
    'rest_apis'
  ])).optional().default(['all']).describe('Types of artifacts to scan'),

  limit: z.number().optional().default(100).describe('Maximum artifacts per type to scan')
});

export type FindAntiPatternsInput = z.infer<typeof findAntiPatternsSchema>;

// ============ TYPES ============

interface AntiPatternMatch {
  sys_id: string;
  artifactName: string;
  artifactType: string;
  table: string;
  patternId: string;
  patternName: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  lineNumber?: number;
  codeSnippet?: string;
}

interface AntiPatternSummary {
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  byCategory: Record<string, number>;
  byPattern: Record<string, number>;
  byArtifactType: Record<string, number>;
  healthScore: number;
}

interface AntiPatternResult {
  success: boolean;
  timestamp: string;
  instanceUrl: string;
  summary: AntiPatternSummary;
  issues: AntiPatternMatch[];
  recommendations: string[];
}

// ============ ANTI-PATTERN DEFINITIONS ============

interface PatternRule {
  id: string;
  name: string;
  category: 'performance' | 'security' | 'maintainability' | 'upgradability' | 'user_experience';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  // Regex pattern to match in script content
  pattern: RegExp;
  // Which artifact types this applies to
  appliesTo: string[];
}

const ANTI_PATTERN_RULES: PatternRule[] = [
  // ========== PERFORMANCE ==========
  {
    id: 'PERF001',
    name: 'current.update() in Business Rule',
    category: 'performance',
    severity: 'critical',
    description: 'Using current.update() in a business rule causes recursive execution and can lead to infinite loops.',
    recommendation: 'Remove current.update() - changes in before business rules are automatically saved.',
    pattern: /current\s*\.\s*update\s*\(/gi,
    appliesTo: ['business_rules']
  },
  {
    id: 'PERF002',
    name: 'Synchronous GlideAjax (getXMLWait)',
    category: 'performance',
    severity: 'high',
    description: 'getXMLWait() blocks the browser until server responds, causing poor user experience.',
    recommendation: 'Use asynchronous getXML() with callback instead of getXMLWait().',
    pattern: /getXMLWait\s*\(/gi,
    appliesTo: ['client_scripts', 'ui_actions']
  },
  {
    id: 'PERF003',
    name: 'getRowCount() usage',
    category: 'performance',
    severity: 'high',
    description: 'getRowCount() counts every row one by one, causing performance issues on large tables.',
    recommendation: 'Use GlideAggregate with COUNT for row counting.',
    pattern: /\.getRowCount\s*\(/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs', 'ui_actions']
  },
  {
    id: 'PERF004',
    name: 'Global Business Rule',
    category: 'performance',
    severity: 'medium',
    description: 'Global business rules load on every page, impacting performance.',
    recommendation: 'Add table restrictions to limit when the business rule executes.',
    pattern: /GLOBAL_BR_CHECK/gi, // Placeholder - checked via table query
    appliesTo: ['business_rules']
  },
  {
    id: 'PERF005',
    name: 'GlideRecord query in ACL',
    category: 'performance',
    severity: 'high',
    description: 'GlideRecord queries in ACLs execute on every record access, causing severe performance issues.',
    recommendation: 'Use cached data, user roles, or move logic to business rules.',
    pattern: /new\s+GlideRecord\s*\(|GlideAggregate/gi,
    appliesTo: ['acls']
  },
  {
    id: 'PERF006',
    name: 'getReference() usage',
    category: 'performance',
    severity: 'medium',
    description: 'getReference() makes synchronous server calls and is deprecated.',
    recommendation: 'Use GlideAjax or g_scratchpad to pass reference data.',
    pattern: /\.getReference\s*\(/gi,
    appliesTo: ['client_scripts', 'ui_actions']
  },
  {
    id: 'PERF007',
    name: 'Dot-walking to sys_id',
    category: 'performance',
    severity: 'medium',
    description: 'Dot-walking to sys_id (e.g., caller_id.sys_id) causes unnecessary database queries.',
    recommendation: 'Use getValue() directly on the reference field instead.',
    pattern: /\.\w+\.sys_id/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },
  {
    id: 'PERF008',
    name: 'gs.sleep() usage',
    category: 'performance',
    severity: 'high',
    description: 'gs.sleep() blocks the thread and does not release the session.',
    recommendation: 'Use scheduled jobs or events for delayed execution.',
    pattern: /gs\s*\.\s*sleep\s*\(/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },
  {
    id: 'PERF009',
    name: 'Cache flush in script',
    category: 'performance',
    severity: 'critical',
    description: 'gs.cacheFlush() or gs.setProperty() triggers system-wide cache flush causing severe performance degradation.',
    recommendation: 'Avoid cache flushes in scripts. Use proper configuration management.',
    pattern: /gs\s*\.\s*cacheFlush\s*\(|gs\s*\.\s*setProperty\s*\(/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },
  {
    id: 'PERF010',
    name: 'Query in Query Business Rule',
    category: 'performance',
    severity: 'critical',
    description: 'Query business rules that query themselves cause infinite recursion.',
    recommendation: 'Avoid GlideRecord queries on the same table in query business rules.',
    pattern: /QUERY_BR_CHECK/gi, // Placeholder - checked via table query
    appliesTo: ['business_rules']
  },
  {
    id: 'PERF011',
    name: 'getMessage() without preload',
    category: 'performance',
    severity: 'medium',
    description: 'getMessage() without preloading messages causes synchronous server calls.',
    recommendation: 'Use the Messages field on client scripts to preload messages.',
    pattern: /getMessage\s*\(/gi,
    appliesTo: ['client_scripts']
  },

  // ========== SECURITY ==========
  {
    id: 'SEC001',
    name: 'eval() usage',
    category: 'security',
    severity: 'critical',
    description: 'eval() opens code to injection attacks and makes debugging difficult.',
    recommendation: 'Refactor to avoid eval(). Use proper function calls or JSON.parse().',
    pattern: /\beval\s*\(/gi,
    appliesTo: ['business_rules', 'script_includes', 'client_scripts', 'ui_actions', 'scheduled_jobs']
  },
  {
    id: 'SEC002',
    name: 'GlideRecord in Client Script',
    category: 'security',
    severity: 'high',
    description: 'GlideRecord() in client scripts bypasses ACLs and exposes data.',
    recommendation: 'Use GlideAjax with server-side GlideRecordSecure instead.',
    pattern: /new\s+GlideRecord\s*\(/gi,
    appliesTo: ['client_scripts']
  },
  {
    id: 'SEC003',
    name: 'setBasicAuth() usage',
    category: 'security',
    severity: 'critical',
    description: 'setBasicAuth() exposes credentials in plain text in scripts.',
    recommendation: 'Use Connection and Credential Alias records instead.',
    pattern: /\.setBasicAuth\s*\(/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },
  {
    id: 'SEC004',
    name: 'GlideRecord instead of GlideRecordSecure',
    category: 'security',
    severity: 'high',
    description: 'Client-callable Script Includes should use GlideRecordSecure to enforce ACLs.',
    recommendation: 'Replace GlideRecord with GlideRecordSecure in client-callable Script Includes.',
    pattern: /CLIENT_CALLABLE_CHECK/gi, // Placeholder - checked via table query
    appliesTo: ['script_includes']
  },
  {
    id: 'SEC005',
    name: 'Undeclared loop iterator',
    category: 'security',
    severity: 'medium',
    description: 'Undeclared loop iterators (for i=0) pollute global scope and cause conflicts.',
    recommendation: 'Always declare iterators with var: for (var i=0; ...)',
    pattern: /for\s*\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=/gi,
    appliesTo: ['business_rules', 'script_includes', 'client_scripts', 'scheduled_jobs']
  },

  // ========== MAINTAINABILITY ==========
  {
    id: 'MAINT001',
    name: 'Hardcoded sys_id',
    category: 'maintainability',
    severity: 'high',
    description: 'Hardcoded sys_ids break when moving between instances.',
    recommendation: 'Use system properties, script includes, or queries to get sys_ids dynamically.',
    pattern: /['"][a-f0-9]{32}['"]/gi,
    appliesTo: ['business_rules', 'script_includes', 'client_scripts', 'ui_actions', 'scheduled_jobs']
  },
  {
    id: 'MAINT002',
    name: 'Hardcoded instance URL',
    category: 'maintainability',
    severity: 'high',
    description: 'Hardcoded instance URLs break when code is moved between instances.',
    recommendation: 'Use gs.getProperty("glide.servlet.uri") or relative URLs.',
    pattern: /https?:\/\/[a-zA-Z0-9-]+\.service-now\.com/gi,
    appliesTo: ['business_rules', 'script_includes', 'client_scripts', 'ui_actions', 'scheduled_jobs']
  },
  {
    id: 'MAINT003',
    name: 'gs.log() statement',
    category: 'maintainability',
    severity: 'low',
    description: 'gs.log() statements pollute system logs and should be removed before production.',
    recommendation: 'Remove debugging statements or use proper logging levels (gs.info, gs.warn, gs.error).',
    pattern: /gs\s*\.\s*log\s*\(/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },
  {
    id: 'MAINT004',
    name: 'console.log() statement',
    category: 'maintainability',
    severity: 'low',
    description: 'console.log() statements should be removed before production.',
    recommendation: 'Remove debugging statements before promoting to production.',
    pattern: /console\s*\.\s*log\s*\(/gi,
    appliesTo: ['client_scripts', 'ui_actions']
  },
  {
    id: 'MAINT005',
    name: 'Variable named "gr"',
    category: 'maintainability',
    severity: 'medium',
    description: 'Using "gr" as variable name can cause conflicts in global scope.',
    recommendation: 'Use descriptive variable names like "incidentGr" or "userGr".',
    pattern: /\bvar\s+gr\s*=|let\s+gr\s*=|const\s+gr\s*=/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },
  {
    id: 'MAINT006',
    name: 'new Array() usage',
    category: 'maintainability',
    severity: 'low',
    description: 'new Array() is less readable and slower than array literal notation.',
    recommendation: 'Use array literal notation: var arr = [] instead of new Array().',
    pattern: /new\s+Array\s*\(/gi,
    appliesTo: ['business_rules', 'script_includes', 'client_scripts', 'scheduled_jobs']
  },
  {
    id: 'MAINT007',
    name: 'new Object() usage',
    category: 'maintainability',
    severity: 'low',
    description: 'new Object() is less readable and slower than object literal notation.',
    recommendation: 'Use object literal notation: var obj = {} instead of new Object().',
    pattern: /new\s+Object\s*\(/gi,
    appliesTo: ['business_rules', 'script_includes', 'client_scripts', 'scheduled_jobs']
  },
  {
    id: 'MAINT008',
    name: 'document object in server script',
    category: 'maintainability',
    severity: 'high',
    description: 'The document object is not available in server-side scripts.',
    recommendation: 'Remove DOM manipulation from server scripts. Use client scripts for DOM access.',
    pattern: /\bdocument\s*\./gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },

  // ========== UPGRADABILITY ==========
  {
    id: 'UPG001',
    name: 'GlideRecord without new keyword',
    category: 'upgradability',
    severity: 'medium',
    description: 'GlideRecord should be instantiated with "new" for compatibility.',
    recommendation: 'Always use: var gr = new GlideRecord("table_name")',
    pattern: /GlideRecord\s*\(\s*['"][^'"]+['"]\s*\)(?!\s*;?\s*$)/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },
  {
    id: 'UPG002',
    name: 'Unsupported GlideLDAP API',
    category: 'upgradability',
    severity: 'high',
    description: 'GlideLDAP API is unsupported and may break in future versions.',
    recommendation: 'Use LDAP Server Data Sources with MID Server instead.',
    pattern: /GlideLDAP/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },

  // ========== USER EXPERIENCE ==========
  {
    id: 'UX001',
    name: 'alert() in client script',
    category: 'user_experience',
    severity: 'medium',
    description: 'Native alert() provides poor user experience.',
    recommendation: 'Use g_form.addInfoMessage() or GlideModal for notifications.',
    pattern: /\balert\s*\(/gi,
    appliesTo: ['client_scripts', 'ui_actions']
  },
  {
    id: 'UX002',
    name: 'confirm() in client script',
    category: 'user_experience',
    severity: 'medium',
    description: 'Native confirm() provides poor user experience.',
    recommendation: 'Use GlideModal or GlideDialogWindow for confirmations.',
    pattern: /\bconfirm\s*\(/gi,
    appliesTo: ['client_scripts', 'ui_actions']
  },
  {
    id: 'UX003',
    name: 'setWorkflow(false) usage',
    category: 'user_experience',
    severity: 'high',
    description: 'setWorkflow(false) skips business rules, causing unexpected behavior.',
    recommendation: 'Avoid setWorkflow(false) unless absolutely necessary. Document usage.',
    pattern: /\.setWorkflow\s*\(\s*false\s*\)/gi,
    appliesTo: ['business_rules', 'script_includes', 'scheduled_jobs']
  },
  {
    id: 'UX004',
    name: 'Missing isLoading check',
    category: 'user_experience',
    severity: 'low',
    description: 'onChange client scripts should check isLoading to avoid running on form load.',
    recommendation: 'Add "if (isLoading) return;" at the start of onChange scripts.',
    pattern: /ONCHANGE_ISLOADING_CHECK/gi, // Placeholder - checked via table query
    appliesTo: ['client_scripts']
  }
];


// ============ ARTIFACT QUERIES ============

interface ArtifactQuery {
  table: string;
  type: string;
  scriptField: string;
  nameField: string;
  additionalFields?: string[];
  filter?: string;
}

const ARTIFACT_QUERIES: Record<string, ArtifactQuery> = {
  business_rules: {
    table: 'sys_script',
    type: 'Business Rule',
    scriptField: 'script',
    nameField: 'name',
    additionalFields: ['collection', 'when', 'active'],
    filter: 'active=true'
  },
  client_scripts: {
    table: 'sys_script_client',
    type: 'Client Script',
    scriptField: 'script',
    nameField: 'name',
    additionalFields: ['table', 'type', 'active'],
    filter: 'active=true'
  },
  script_includes: {
    table: 'sys_script_include',
    type: 'Script Include',
    scriptField: 'script',
    nameField: 'name',
    additionalFields: ['api_name', 'client_callable', 'active'],
    filter: 'active=true'
  },
  ui_actions: {
    table: 'sys_ui_action',
    type: 'UI Action',
    scriptField: 'script',
    nameField: 'name',
    additionalFields: ['table', 'client', 'active'],
    filter: 'active=true'
  },
  scheduled_jobs: {
    table: 'sysauto_script',
    type: 'Scheduled Job',
    scriptField: 'script',
    nameField: 'name',
    additionalFields: ['active'],
    filter: 'active=true'
  },
  acls: {
    table: 'sys_security_acl',
    type: 'ACL',
    scriptField: 'script',
    nameField: 'name',
    additionalFields: ['operation', 'active'],
    filter: 'active=true^advanced=true'
  },
  notifications: {
    table: 'sysevent_email_action',
    type: 'Notification',
    scriptField: 'message_html',
    nameField: 'name',
    additionalFields: ['active'],
    filter: 'active=true'
  },
  rest_apis: {
    table: 'sys_ws_operation',
    type: 'Scripted REST Resource',
    scriptField: 'operation_script',
    nameField: 'name',
    additionalFields: ['http_method', 'active'],
    filter: 'active=true'
  }
};

// ============ HELPER FUNCTIONS ============

function extractCodeSnippet(script: string, pattern: RegExp, contextLines: number = 1): { lineNumber: number; snippet: string } | null {
  const lines = script.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);
      const snippet = lines.slice(start, end + 1).join('\n');
      return { lineNumber: i + 1, snippet };
    }
  }
  return null;
}

function getSeverityWeight(severity: string): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

function calculateHealthScore(issues: AntiPatternMatch[]): number {
  if (issues.length === 0) return 100;

  let totalPenalty = 0;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': totalPenalty += 10; break;
      case 'high': totalPenalty += 5; break;
      case 'medium': totalPenalty += 2; break;
      case 'low': totalPenalty += 1; break;
    }
  }

  // Cap penalty at 100
  return Math.max(0, 100 - Math.min(totalPenalty, 100));
}

function generateRecommendations(summary: AntiPatternSummary, issues: AntiPatternMatch[]): string[] {
  const recommendations: string[] = [];

  if (summary.criticalCount > 0) {
    recommendations.push(`🚨 CRITICAL: Address ${summary.criticalCount} critical issues immediately - these can cause system instability or security vulnerabilities.`);
  }

  if (summary.byPattern['current.update() in Business Rule'] > 0) {
    recommendations.push('Remove all current.update() calls from business rules to prevent infinite loops.');
  }

  if (summary.byPattern['Synchronous GlideAjax (getXMLWait)'] > 0) {
    recommendations.push('Replace getXMLWait() with asynchronous getXML() calls to improve user experience.');
  }

  if (summary.byPattern['Hardcoded sys_id'] > 0) {
    recommendations.push('Replace hardcoded sys_ids with dynamic lookups or system properties for instance portability.');
  }

  if (summary.byPattern['eval() usage'] > 0) {
    recommendations.push('Eliminate eval() usage to prevent injection attacks and improve code maintainability.');
  }

  if (summary.byPattern['GlideRecord in Client Script'] > 0) {
    recommendations.push('Replace client-side GlideRecord with GlideAjax to enforce ACLs and improve security.');
  }

  if (summary.byCategory['performance'] > 10) {
    recommendations.push('Consider a performance review - multiple performance anti-patterns detected.');
  }

  if (summary.byCategory['security'] > 5) {
    recommendations.push('Security review recommended - multiple security anti-patterns detected.');
  }

  if (summary.healthScore < 50) {
    recommendations.push('Code quality is concerning. Consider a comprehensive code review and refactoring effort.');
  } else if (summary.healthScore < 75) {
    recommendations.push('Code quality needs improvement. Prioritize fixing critical and high severity issues.');
  }

  return recommendations;
}

// ============ MAIN FUNCTION ============

export async function findAntiPatterns(
  client: ServiceNowClient,
  input: FindAntiPatternsInput
): Promise<AntiPatternResult> {
  const issues: AntiPatternMatch[] = [];
  const categories = input.categories?.includes('all')
    ? ['performance', 'security', 'maintainability', 'upgradability', 'user_experience']
    : input.categories || ['performance', 'security', 'maintainability', 'upgradability', 'user_experience'];

  const artifactTypes = input.artifactTypes?.includes('all')
    ? Object.keys(ARTIFACT_QUERIES)
    : input.artifactTypes || Object.keys(ARTIFACT_QUERIES);

  const severityFilter = input.severity || 'all';
  const minSeverityWeight = severityFilter === 'all' ? 0 : getSeverityWeight(severityFilter);

  // Filter rules by category and severity
  const applicableRules = ANTI_PATTERN_RULES.filter(rule => {
    const categoryMatch = categories.includes(rule.category);
    const severityMatch = getSeverityWeight(rule.severity) >= minSeverityWeight;
    return categoryMatch && severityMatch;
  });

  // Scan each artifact type
  for (const artifactType of artifactTypes) {
    const query = ARTIFACT_QUERIES[artifactType];
    if (!query) continue;

    // Get rules that apply to this artifact type
    const rulesForType = applicableRules.filter(rule =>
      rule.appliesTo.includes(artifactType) && !rule.pattern.source.includes('_CHECK')
    );

    if (rulesForType.length === 0) continue;

    try {
      // Build query
      let filter = query.filter || '';
      if (input.scope) {
        filter += (filter ? '^' : '') + `sys_scope.scope=${input.scope}`;
      }

      const fields = ['sys_id', query.nameField, query.scriptField, ...(query.additionalFields || [])];

      const records = await client.getRecords(query.table, {
        sysparm_query: filter,
        sysparm_fields: fields.join(','),
        sysparm_limit: input.limit || 100
      });

      // Scan each record
      for (const record of records) {
        const script = String(record[query.scriptField] || '');
        const name = String(record[query.nameField] || 'Unknown');
        const sysId = String(record.sys_id || '');

        if (!script) continue;

        // Check each rule
        for (const rule of rulesForType) {
          // Reset regex lastIndex for global patterns
          rule.pattern.lastIndex = 0;

          if (rule.pattern.test(script)) {
            // Reset again for extraction
            rule.pattern.lastIndex = 0;
            const codeInfo = extractCodeSnippet(script, rule.pattern);

            issues.push({
              sys_id: sysId,
              artifactName: name,
              artifactType: query.type,
              table: query.table,
              patternId: rule.id,
              patternName: rule.name,
              category: rule.category,
              severity: rule.severity,
              description: rule.description,
              recommendation: rule.recommendation,
              lineNumber: codeInfo?.lineNumber,
              codeSnippet: codeInfo?.snippet
            });
          }
        }
      }
    } catch (error) {
      // Table might not exist or be inaccessible - continue
      console.error(`Error scanning ${query.table}: ${error}`);
    }
  }

  // Check for special cases that require table queries
  await checkSpecialCases(client, issues, input, categories, minSeverityWeight);

  // Build summary
  const summary: AntiPatternSummary = {
    totalIssues: issues.length,
    criticalCount: issues.filter(i => i.severity === 'critical').length,
    highCount: issues.filter(i => i.severity === 'high').length,
    mediumCount: issues.filter(i => i.severity === 'medium').length,
    lowCount: issues.filter(i => i.severity === 'low').length,
    byCategory: {},
    byPattern: {},
    byArtifactType: {},
    healthScore: 0
  };

  // Count by category
  for (const issue of issues) {
    summary.byCategory[issue.category] = (summary.byCategory[issue.category] || 0) + 1;
    summary.byPattern[issue.patternName] = (summary.byPattern[issue.patternName] || 0) + 1;
    summary.byArtifactType[issue.artifactType] = (summary.byArtifactType[issue.artifactType] || 0) + 1;
  }

  summary.healthScore = calculateHealthScore(issues);

  const recommendations = generateRecommendations(summary, issues);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    instanceUrl: client.instanceUrl,
    summary,
    issues,
    recommendations
  };
}


// ============ SPECIAL CASE CHECKS ============

async function checkSpecialCases(
  client: ServiceNowClient,
  issues: AntiPatternMatch[],
  input: FindAntiPatternsInput,
  categories: string[],
  minSeverityWeight: number
): Promise<void> {

  // Check for Global Business Rules (no table restriction)
  if (categories.includes('performance') && getSeverityWeight('medium') >= minSeverityWeight) {
    try {
      let filter = 'active=true^collection=';
      if (input.scope) {
        filter += `^sys_scope.scope=${input.scope}`;
      }

      const globalBRs = await client.getRecords('sys_script', {
        sysparm_query: filter,
        sysparm_fields: 'sys_id,name',
        sysparm_limit: input.limit || 100
      });

      for (const br of globalBRs) {
        issues.push({
          sys_id: String(br.sys_id || ''),
          artifactName: String(br.name || 'Unknown'),
          artifactType: 'Business Rule',
          table: 'sys_script',
          patternId: 'PERF004',
          patternName: 'Global Business Rule',
          category: 'performance',
          severity: 'medium',
          description: 'Global business rules load on every page, impacting performance.',
          recommendation: 'Add table restrictions to limit when the business rule executes.'
        });
      }
    } catch (error) {
      // Continue on error
    }
  }

  // Check for Global Client Scripts
  if (categories.includes('performance') && getSeverityWeight('medium') >= minSeverityWeight) {
    try {
      let filter = 'active=true^global=true';
      if (input.scope) {
        filter += `^sys_scope.scope=${input.scope}`;
      }

      const globalCS = await client.getRecords('sys_script_client', {
        sysparm_query: filter,
        sysparm_fields: 'sys_id,name',
        sysparm_limit: input.limit || 100
      });

      for (const cs of globalCS) {
        issues.push({
          sys_id: String(cs.sys_id || ''),
          artifactName: String(cs.name || 'Unknown'),
          artifactType: 'Client Script',
          table: 'sys_script_client',
          patternId: 'PERF012',
          patternName: 'Global Client Script',
          category: 'performance',
          severity: 'medium',
          description: 'Global client scripts load on every page, impacting browser performance.',
          recommendation: 'Add table restrictions to limit when the client script loads.'
        });
      }
    } catch (error) {
      // Continue on error
    }
  }

  // Check for Client-Callable Script Includes using GlideRecord instead of GlideRecordSecure
  if (categories.includes('security') && getSeverityWeight('high') >= minSeverityWeight) {
    try {
      let filter = 'active=true^client_callable=true^scriptLIKEGlideRecord^scriptNOT LIKEGlideRecordSecure';
      if (input.scope) {
        filter += `^sys_scope.scope=${input.scope}`;
      }

      const clientCallableSIs = await client.getRecords('sys_script_include', {
        sysparm_query: filter,
        sysparm_fields: 'sys_id,name,script',
        sysparm_limit: input.limit || 100
      });

      for (const si of clientCallableSIs) {
        issues.push({
          sys_id: String(si.sys_id || ''),
          artifactName: String(si.name || 'Unknown'),
          artifactType: 'Script Include',
          table: 'sys_script_include',
          patternId: 'SEC004',
          patternName: 'GlideRecord instead of GlideRecordSecure',
          category: 'security',
          severity: 'high',
          description: 'Client-callable Script Includes should use GlideRecordSecure to enforce ACLs.',
          recommendation: 'Replace GlideRecord with GlideRecordSecure in client-callable Script Includes.'
        });
      }
    } catch (error) {
      // Continue on error
    }
  }

  // Check for Business Rules without conditions
  if (categories.includes('performance') && getSeverityWeight('medium') >= minSeverityWeight) {
    try {
      let filter = 'active=true^condition=^filter_condition=';
      if (input.scope) {
        filter += `^sys_scope.scope=${input.scope}`;
      }

      const noConditionBRs = await client.getRecords('sys_script', {
        sysparm_query: filter,
        sysparm_fields: 'sys_id,name,collection',
        sysparm_limit: input.limit || 100
      });

      for (const br of noConditionBRs) {
        issues.push({
          sys_id: String(br.sys_id || ''),
          artifactName: String(br.name || 'Unknown'),
          artifactType: 'Business Rule',
          table: 'sys_script',
          patternId: 'PERF013',
          patternName: 'Business Rule without conditions',
          category: 'performance',
          severity: 'medium',
          description: 'Business rules without conditions execute on every operation, impacting performance.',
          recommendation: 'Add conditions to limit when the business rule executes.'
        });
      }
    } catch (error) {
      // Continue on error
    }
  }

  // Check for onChange Client Scripts missing isLoading check
  if (categories.includes('user_experience') && getSeverityWeight('low') >= minSeverityWeight) {
    try {
      let filter = 'active=true^type=onChange^scriptNOT LIKEisLoading';
      if (input.scope) {
        filter += `^sys_scope.scope=${input.scope}`;
      }

      const noIsLoadingCS = await client.getRecords('sys_script_client', {
        sysparm_query: filter,
        sysparm_fields: 'sys_id,name',
        sysparm_limit: input.limit || 100
      });

      for (const cs of noIsLoadingCS) {
        issues.push({
          sys_id: String(cs.sys_id || ''),
          artifactName: String(cs.name || 'Unknown'),
          artifactType: 'Client Script',
          table: 'sys_script_client',
          patternId: 'UX004',
          patternName: 'Missing isLoading check',
          category: 'user_experience',
          severity: 'low',
          description: 'onChange client scripts should check isLoading to avoid running on form load.',
          recommendation: 'Add "if (isLoading) return;" at the start of onChange scripts.'
        });
      }
    } catch (error) {
      // Continue on error
    }
  }

  // Check for Scripted REST APIs without authentication
  if (categories.includes('security') && getSeverityWeight('high') >= minSeverityWeight) {
    try {
      let filter = 'active=true^requires_authentication=false';
      if (input.scope) {
        filter += `^sys_scope.scope=${input.scope}`;
      }

      const noAuthAPIs = await client.getRecords('sys_ws_operation', {
        sysparm_query: filter,
        sysparm_fields: 'sys_id,name',
        sysparm_limit: input.limit || 100
      });

      for (const api of noAuthAPIs) {
        issues.push({
          sys_id: String(api.sys_id || ''),
          artifactName: String(api.name || 'Unknown'),
          artifactType: 'Scripted REST Resource',
          table: 'sys_ws_operation',
          patternId: 'SEC006',
          patternName: 'Scripted REST API without authentication',
          category: 'security',
          severity: 'high',
          description: 'Scripted REST APIs without authentication expose data publicly.',
          recommendation: 'Enable authentication on Scripted REST APIs to protect data.'
        });
      }
    } catch (error) {
      // Continue on error
    }
  }
}
