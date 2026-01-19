/**
 * Guardrail Validator Tool
 * Validates proposed changes against configurable guardrails
 *
 * Task 2.3 of the Brownfield Enhancement Plan - Step 2: Guardrails & Impact Analysis
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const validateChangeSchema = z.object({
  changeType: z.enum([
    'business_rule',
    'client_script',
    'script_include',
    'ui_action',
    'ui_policy',
    'scheduled_job',
    'rest_api',
    'table_modification',
    'acl',
    'notification'
  ]).describe('Type of artifact being created/modified'),

  artifactName: z.string().describe('Name of the artifact'),
  targetTable: z.string().optional().describe('Target table for the artifact'),
  script: z.string().optional().describe('Script content to validate'),
  scope: z.string().optional().describe('Application scope'),

  // Guardrail configuration
  strictMode: z.boolean().default(false).describe('Enforce stricter guardrails'),
  customRules: z.array(z.object({
    name: z.string(),
    pattern: z.string(),
    message: z.string(),
    severity: z.enum(['block', 'warn', 'info'])
  })).optional().describe('Custom validation rules')
});

export type ValidateChangeInput = z.infer<typeof validateChangeSchema>;

// ============ TYPES ============

interface GuardrailViolation {
  rule: string;
  category: 'performance' | 'security' | 'naming' | 'best_practice' | 'compliance' | 'custom';
  severity: 'block' | 'warn' | 'info';
  message: string;
  line?: number;
  snippet?: string;
  recommendation: string;
}

interface GuardrailResult {
  success: boolean;
  valid: boolean;
  changeType: string;
  artifactName: string;
  summary: {
    totalViolations: number;
    blockers: number;
    warnings: number;
    info: number;
  };
  violations: GuardrailViolation[];
  canProceed: boolean;
  requiresApproval: boolean;
  approvalLevel?: 'team_lead' | 'admin' | 'platform_owner';
}

// ============ GUARDRAIL RULES ============

interface GuardrailRule {
  name: string;
  category: GuardrailViolation['category'];
  severity: 'block' | 'warn' | 'info';
  appliesTo: string[];
  check: (script: string, context: ValidateChangeInput) => { violated: boolean; details?: string; line?: number };
  message: string;
  recommendation: string;
}

const GUARDRAIL_RULES: GuardrailRule[] = [
  // Performance blockers
  {
    name: 'no_current_update',
    category: 'performance',
    severity: 'block',
    appliesTo: ['business_rule'],
    check: (script) => {
      const match = script.match(/current\.update\s*\(/);
      return { violated: !!match, details: match ? 'current.update() found' : undefined };
    },
    message: 'current.update() is prohibited in Business Rules - causes infinite loops',
    recommendation: 'Remove current.update(). Field changes are auto-saved. Use workflow for complex scenarios.'
  },
  {
    name: 'no_eval',
    category: 'security',
    severity: 'block',
    appliesTo: ['business_rule', 'client_script', 'script_include', 'ui_action', 'scheduled_job'],
    check: (script) => {
      const match = script.match(/\beval\s*\(/);
      return { violated: !!match };
    },
    message: 'eval() is prohibited - security vulnerability',
    recommendation: 'Refactor to use proper object methods, JSON.parse(), or Function constructor patterns.'
  },
  {
    name: 'no_hardcoded_credentials',
    category: 'security',
    severity: 'block',
    appliesTo: ['business_rule', 'script_include', 'scheduled_job', 'rest_api'],
    check: (script) => {
      const patterns = [
        /password\s*[=:]\s*['"][^'"]{3,}['"]/i,
        /api[_-]?key\s*[=:]\s*['"][^'"]{8,}['"]/i,
        /secret\s*[=:]\s*['"][^'"]{3,}['"]/i,
        /setBasicAuth\s*\([^)]+,[^)]+\)/i
      ];
      for (const pattern of patterns) {
        if (pattern.test(script)) {
          return { violated: true, details: 'Possible hardcoded credential detected' };
        }
      }
      return { violated: false };
    },
    message: 'Hardcoded credentials are prohibited',
    recommendation: 'Use Connection & Credential records or sys_properties for sensitive data.'
  },

  // Performance warnings
  {
    name: 'avoid_getRowCount',
    category: 'performance',
    severity: 'warn',
    appliesTo: ['business_rule', 'script_include', 'scheduled_job'],
    check: (script) => {
      const match = script.match(/getRowCount\s*\(/);
      return { violated: !!match };
    },
    message: 'getRowCount() is inefficient for large datasets',
    recommendation: 'Use GlideAggregate with getCount() for better performance.'
  },
  {
    name: 'avoid_gs_sleep',
    category: 'performance',
    severity: 'warn',
    appliesTo: ['business_rule', 'script_include'],
    check: (script) => {
      const match = script.match(/gs\.sleep\s*\(/);
      return { violated: !!match };
    },
    message: 'gs.sleep() blocks thread execution',
    recommendation: 'Move to async Business Rule or Scheduled Job.'
  },
  {
    name: 'limit_gliderecord_loops',
    category: 'performance',
    severity: 'warn',
    appliesTo: ['business_rule', 'client_script', 'script_include'],
    check: (script) => {
      const loopMatches = script.match(/while\s*\([^)]*\.next\s*\(\)/g) || [];
      return { violated: loopMatches.length > 3, details: `${loopMatches.length} GlideRecord loops found` };
    },
    message: 'Too many GlideRecord loops may impact performance',
    recommendation: 'Consider using GlideAggregate, batch processing, or optimizing queries.'
  },

  // Naming conventions
  {
    name: 'naming_convention',
    category: 'naming',
    severity: 'warn',
    appliesTo: ['script_include'],
    check: (_script, context) => {
      const name = context.artifactName;
      const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(name);
      return { violated: !isPascalCase, details: `Name "${name}" should be PascalCase` };
    },
    message: 'Script Include names should use PascalCase',
    recommendation: 'Rename to use PascalCase (e.g., MyScriptInclude).'
  },
  {
    name: 'br_naming_convention',
    category: 'naming',
    severity: 'info',
    appliesTo: ['business_rule'],
    check: (_script, context) => {
      const name = context.artifactName;
      const hasTablePrefix = context.targetTable && name.toLowerCase().includes(context.targetTable.toLowerCase());
      return { violated: !hasTablePrefix && !!context.targetTable };
    },
    message: 'Business Rule name should indicate target table',
    recommendation: 'Include table name in Business Rule name for easier identification.'
  },

  // Best practices
  {
    name: 'no_global_scope_scripts',
    category: 'best_practice',
    severity: 'warn',
    appliesTo: ['script_include', 'business_rule', 'client_script'],
    check: (_script, context) => {
      return { violated: context.scope === 'global' || !context.scope };
    },
    message: 'Global scope should be avoided when possible',
    recommendation: 'Use scoped applications for better isolation and upgradeability.'
  }
];


// Strict mode additional rules
const STRICT_MODE_RULES: GuardrailRule[] = [
  {
    name: 'require_try_catch',
    category: 'best_practice',
    severity: 'warn',
    appliesTo: ['business_rule', 'script_include', 'scheduled_job'],
    check: (script) => {
      const hasTryCatch = /try\s*\{/.test(script);
      return { violated: !hasTryCatch && script.length > 100 };
    },
    message: 'Error handling with try/catch is recommended',
    recommendation: 'Wrap main logic in try/catch to prevent silent failures.'
  },
  {
    name: 'require_comments',
    category: 'best_practice',
    severity: 'info',
    appliesTo: ['business_rule', 'script_include', 'scheduled_job'],
    check: (script) => {
      const lines = script.split('\n').length;
      const comments = (script.match(/\/\/|\/\*|\*\//g) || []).length;
      return { violated: lines > 20 && comments < 2 };
    },
    message: 'Code should include comments for maintainability',
    recommendation: 'Add comments explaining the purpose and logic.'
  },
  {
    name: 'no_jquery',
    category: 'compliance',
    severity: 'block',
    appliesTo: ['client_script', 'ui_action'],
    check: (script) => {
      const match = script.match(/\$\s*\(|jQuery\s*\(/);
      return { violated: !!match };
    },
    message: 'jQuery is deprecated in newer ServiceNow versions',
    recommendation: 'Use g_form, GlideAjax, or native JavaScript instead.'
  },
  {
    name: 'no_synchronous_ajax',
    category: 'performance',
    severity: 'block',
    appliesTo: ['client_script', 'ui_action'],
    check: (script) => {
      const match = script.match(/getXMLWait\s*\(/);
      return { violated: !!match };
    },
    message: 'Synchronous AJAX (getXMLWait) blocks the browser',
    recommendation: 'Use getXML() with callback for asynchronous calls.'
  }
];

// ============ MAIN EXPORT ============

export async function validateChange(
  _client: ServiceNowClient,
  input: ValidateChangeInput
): Promise<GuardrailResult> {
  const violations: GuardrailViolation[] = [];
  const script = input.script || '';

  // Get applicable rules
  let rulesToCheck = GUARDRAIL_RULES.filter(rule =>
    rule.appliesTo.includes(input.changeType)
  );

  // Add strict mode rules if enabled
  if (input.strictMode) {
    rulesToCheck = [
      ...rulesToCheck,
      ...STRICT_MODE_RULES.filter(rule => rule.appliesTo.includes(input.changeType))
    ];
  }

  // Check each rule
  for (const rule of rulesToCheck) {
    const result = rule.check(script, input);
    if (result.violated) {
      violations.push({
        rule: rule.name,
        category: rule.category,
        severity: rule.severity,
        message: rule.message,
        line: result.line,
        snippet: result.details,
        recommendation: rule.recommendation
      });
    }
  }

  // Check custom rules
  if (input.customRules) {
    for (const customRule of input.customRules) {
      try {
        const regex = new RegExp(customRule.pattern, 'gi');
        if (regex.test(script)) {
          violations.push({
            rule: customRule.name,
            category: 'custom',
            severity: customRule.severity,
            message: customRule.message,
            recommendation: 'Address the custom rule violation.'
          });
        }
      } catch {
        // Invalid regex - skip
      }
    }
  }

  // Calculate summary
  const blockers = violations.filter(v => v.severity === 'block').length;
  const warnings = violations.filter(v => v.severity === 'warn').length;
  const info = violations.filter(v => v.severity === 'info').length;

  // Determine approval requirements
  let requiresApproval = false;
  let approvalLevel: 'team_lead' | 'admin' | 'platform_owner' | undefined;

  if (blockers > 0) {
    requiresApproval = true;
    approvalLevel = 'platform_owner';
  } else if (warnings >= 3) {
    requiresApproval = true;
    approvalLevel = 'admin';
  } else if (warnings >= 1 && input.strictMode) {
    requiresApproval = true;
    approvalLevel = 'team_lead';
  }

  return {
    success: true,
    valid: blockers === 0,
    changeType: input.changeType,
    artifactName: input.artifactName,
    summary: {
      totalViolations: violations.length,
      blockers,
      warnings,
      info
    },
    violations,
    canProceed: blockers === 0,
    requiresApproval,
    approvalLevel
  };
}