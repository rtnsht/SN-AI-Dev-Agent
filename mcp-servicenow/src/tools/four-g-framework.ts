/**
 * 4G Framework Tool
 * Implements Guardrails, Guidance, Governance, and Growth
 *
 * Task 3.2 of the Brownfield Enhancement Plan - Step 3: Persona & 4G Framework
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const apply4GFrameworkSchema = z.object({
  action: z.enum([
    'create_business_rule',
    'create_client_script',
    'create_script_include',
    'create_ui_action',
    'modify_artifact',
    'delete_artifact',
    'create_acl',
    'modify_table'
  ]).describe('Action being performed'),

  artifactName: z.string().describe('Name of the artifact'),
  targetTable: z.string().optional().describe('Target table'),
  script: z.string().optional().describe('Script content'),

  persona: z.enum([
    'junior_developer',
    'senior_developer',
    'architect',
    'admin'
  ]).default('senior_developer').describe('User persona'),

  skipGuidance: z.boolean().default(false).describe('Skip guidance messages for experienced users')
});

export type Apply4GFrameworkInput = z.infer<typeof apply4GFrameworkSchema>;

// ============ TYPES ============

interface GuardrailCheck {
  id: string;
  name: string;
  category: 'code_quality' | 'performance' | 'security' | 'upgrade_safety' | 'naming';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  passed: boolean;
  message: string;
  autoFix?: {
    available: boolean;
    description: string;
  };
}

interface GuidanceItem {
  id: string;
  title: string;
  message: string;
  context: string;
  learnMore?: string;
  example?: string;
}

interface GovernanceRule {
  id: string;
  name: string;
  requiresApproval: boolean;
  approvalLevel?: 'team_lead' | 'admin' | 'architect';
  reason?: string;
}

interface GrowthOpportunity {
  id: string;
  title: string;
  description: string;
  skillArea: string;
  resources?: string[];
}

interface FourGResult {
  success: boolean;
  action: string;
  persona: string;

  // 🛡️ GUARDRAILS - Prevent bad practices
  guardrails: {
    allPassed: boolean;
    errors: GuardrailCheck[];
    warnings: GuardrailCheck[];
    info: GuardrailCheck[];
  };

  // 🧭 GUIDANCE - Suggest better approaches
  guidance: GuidanceItem[];

  // 📋 GOVERNANCE - Enforce approval workflows
  governance: {
    canProceed: boolean;
    requiresApproval: boolean;
    approvalLevel?: string;
    rules: GovernanceRule[];
  };

  // 📈 GROWTH - Enable learning
  growth: GrowthOpportunity[];

  // Overall recommendation
  recommendation: {
    proceed: boolean;
    message: string;
    nextSteps: string[];
  };
}


// ============ GUARDRAIL DEFINITIONS ============

const GUARDRAILS: Array<{
  id: string;
  name: string;
  category: GuardrailCheck['category'];
  severity: GuardrailCheck['severity'];
  appliesTo: string[];
  check: (script: string, action: string) => boolean;
  message: string;
  autoFix?: { available: boolean; description: string };
}> = [
  {
    id: 'GR-001',
    name: 'No GlideRecord in Client Scripts',
    category: 'performance',
    severity: 'ERROR',
    appliesTo: ['create_client_script'],
    check: (script) => !/GlideRecord/.test(script),
    message: 'GlideRecord is not available in client scripts. Use GlideAjax instead.',
    autoFix: { available: true, description: 'Convert to GlideAjax pattern' }
  },
  {
    id: 'GR-002',
    name: 'No current.update() in Business Rules',
    category: 'performance',
    severity: 'ERROR',
    appliesTo: ['create_business_rule', 'modify_artifact'],
    check: (script) => !/current\.update\s*\(/.test(script),
    message: 'current.update() causes infinite loops in Business Rules.',
    autoFix: { available: true, description: 'Remove current.update() - changes auto-save' }
  },
  {
    id: 'GR-003',
    name: 'No eval() usage',
    category: 'security',
    severity: 'ERROR',
    appliesTo: ['create_business_rule', 'create_client_script', 'create_script_include'],
    check: (script) => !/\beval\s*\(/.test(script),
    message: 'eval() is a security risk and should never be used.'
  },
  {
    id: 'GR-004',
    name: 'No hardcoded sys_ids',
    category: 'upgrade_safety',
    severity: 'WARNING',
    appliesTo: ['create_business_rule', 'create_script_include', 'create_client_script'],
    check: (script) => !/[a-f0-9]{32}/.test(script),
    message: 'Hardcoded sys_ids break across instances. Use properties or queries.'
  },
  {
    id: 'GR-005',
    name: 'Script Include naming convention',
    category: 'naming',
    severity: 'WARNING',
    appliesTo: ['create_script_include'],
    check: (_script, _action) => true, // Checked separately with artifact name
    message: 'Script Include names should use PascalCase.'
  }
];

// ============ GUIDANCE DEFINITIONS ============

const GUIDANCE_TEMPLATES: Record<string, GuidanceItem[]> = {
  create_business_rule: [
    {
      id: 'GD-BR-001',
      title: 'Consider async for non-critical operations',
      message: 'If this Business Rule sends emails or updates unrelated records, make it async to improve form load times.',
      context: 'Business Rules run synchronously by default, blocking the user.',
      example: 'Set "When" to "async" for notification rules.'
    },
    {
      id: 'GD-BR-002',
      title: 'Check execution order',
      message: 'Review existing Business Rules on this table to avoid conflicts.',
      context: 'Multiple rules with similar conditions can cause unexpected behavior.'
    }
  ],
  create_client_script: [
    {
      id: 'GD-CS-001',
      title: 'Use GlideAjax for server data',
      message: 'Client scripts cannot access server-side APIs directly. Use GlideAjax.',
      context: 'GlideAjax provides asynchronous server calls from client scripts.',
      example: 'var ga = new GlideAjax("MyAjax"); ga.addParam("sysparm_name", "getData");'
    }
  ],
  create_acl: [
    {
      id: 'GD-ACL-001',
      title: 'Test ACL thoroughly',
      message: 'ACL changes can lock users out. Test with multiple roles before deploying.',
      context: 'ACLs are evaluated in order - more specific rules should have higher order.'
    }
  ]
};

// ============ GOVERNANCE RULES ============

const GOVERNANCE_RULES: Array<{
  id: string;
  name: string;
  appliesTo: string[];
  personas: string[];
  requiresApproval: boolean;
  approvalLevel: 'team_lead' | 'admin' | 'architect';
  reason: string;
}> = [
  {
    id: 'GOV-001',
    name: 'Junior developer script creation',
    appliesTo: ['create_business_rule', 'create_script_include'],
    personas: ['junior_developer'],
    requiresApproval: true,
    approvalLevel: 'team_lead',
    reason: 'Junior developers require review for server-side scripts.'
  },
  {
    id: 'GOV-002',
    name: 'ACL creation',
    appliesTo: ['create_acl'],
    personas: ['junior_developer', 'senior_developer'],
    requiresApproval: true,
    approvalLevel: 'admin',
    reason: 'ACL changes affect security and require admin approval.'
  },
  {
    id: 'GOV-003',
    name: 'Table modification',
    appliesTo: ['modify_table'],
    personas: ['junior_developer', 'senior_developer', 'admin'],
    requiresApproval: true,
    approvalLevel: 'architect',
    reason: 'Schema changes require architect approval for upgrade safety.'
  },
  {
    id: 'GOV-004',
    name: 'Artifact deletion',
    appliesTo: ['delete_artifact'],
    personas: ['junior_developer'],
    requiresApproval: true,
    approvalLevel: 'team_lead',
    reason: 'Deletions are irreversible and require review.'
  }
];


// ============ GROWTH OPPORTUNITIES ============

const GROWTH_OPPORTUNITIES: Record<string, GrowthOpportunity[]> = {
  junior_developer: [
    {
      id: 'GRW-001',
      title: 'Learn GlideAjax patterns',
      description: 'Master client-server communication in ServiceNow',
      skillArea: 'Client Scripting',
      resources: ['ServiceNow Docs: GlideAjax', 'Developer Community: Ajax Examples']
    },
    {
      id: 'GRW-002',
      title: 'Understand Business Rule lifecycle',
      description: 'Learn when rules execute and how to avoid conflicts',
      skillArea: 'Server Scripting',
      resources: ['Business Rule Best Practices', 'Order and When explained']
    }
  ],
  senior_developer: [
    {
      id: 'GRW-003',
      title: 'Performance optimization techniques',
      description: 'Advanced patterns for high-volume tables',
      skillArea: 'Performance',
      resources: ['GlideAggregate patterns', 'Async processing guide']
    }
  ]
};

// ============ MAIN EXPORT ============

export async function apply4GFramework(
  _client: ServiceNowClient,
  input: Apply4GFrameworkInput
): Promise<FourGResult> {
  const script = input.script || '';
  const errors: GuardrailCheck[] = [];
  const warnings: GuardrailCheck[] = [];
  const info: GuardrailCheck[] = [];

  // 🛡️ GUARDRAILS - Check all applicable rules
  for (const guardrail of GUARDRAILS) {
    if (guardrail.appliesTo.includes(input.action)) {
      const passed = guardrail.check(script, input.action);
      const check: GuardrailCheck = {
        id: guardrail.id,
        name: guardrail.name,
        category: guardrail.category,
        severity: guardrail.severity,
        passed,
        message: guardrail.message,
        autoFix: guardrail.autoFix
      };

      if (!passed) {
        if (guardrail.severity === 'ERROR') errors.push(check);
        else if (guardrail.severity === 'WARNING') warnings.push(check);
        else info.push(check);
      }
    }
  }

  // 🧭 GUIDANCE - Get relevant guidance
  const guidance: GuidanceItem[] = input.skipGuidance
    ? []
    : (GUIDANCE_TEMPLATES[input.action] || []);

  // 📋 GOVERNANCE - Check approval requirements
  const applicableRules = GOVERNANCE_RULES.filter(rule =>
    rule.appliesTo.includes(input.action) && rule.personas.includes(input.persona)
  );

  const requiresApproval = applicableRules.some(r => r.requiresApproval);
  const highestApproval = applicableRules.reduce((highest, rule) => {
    const levels = { team_lead: 1, admin: 2, architect: 3 };
    if (levels[rule.approvalLevel] > (levels[highest as keyof typeof levels] || 0)) {
      return rule.approvalLevel;
    }
    return highest;
  }, '' as string);

  // 📈 GROWTH - Get learning opportunities
  const growth = GROWTH_OPPORTUNITIES[input.persona] || [];

  // Overall recommendation
  const canProceed = errors.length === 0;
  const nextSteps: string[] = [];

  if (errors.length > 0) {
    nextSteps.push('Fix guardrail errors before proceeding');
  }
  if (warnings.length > 0) {
    nextSteps.push('Review warnings and address if possible');
  }
  if (requiresApproval) {
    nextSteps.push(`Get ${highestApproval} approval before deployment`);
  }
  if (canProceed && !requiresApproval) {
    nextSteps.push('Ready to proceed with creation');
  }

  return {
    success: true,
    action: input.action,
    persona: input.persona,
    guardrails: {
      allPassed: errors.length === 0,
      errors,
      warnings,
      info
    },
    guidance,
    governance: {
      canProceed,
      requiresApproval,
      approvalLevel: highestApproval || undefined,
      rules: applicableRules.map(r => ({
        id: r.id,
        name: r.name,
        requiresApproval: r.requiresApproval,
        approvalLevel: r.approvalLevel,
        reason: r.reason
      }))
    },
    growth,
    recommendation: {
      proceed: canProceed,
      message: canProceed
        ? (requiresApproval ? `Approved with ${highestApproval} review required` : 'All checks passed - ready to proceed')
        : `Blocked: ${errors.length} guardrail violation(s) must be fixed`,
      nextSteps
    }
  };
}