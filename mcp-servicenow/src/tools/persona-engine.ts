/**
 * Persona Engine Tool
 * Detects and manages user personas for adaptive AI assistance
 *
 * Task 3.1 of the Brownfield Enhancement Plan - Step 3: Persona & 4G Framework
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMAS ============

export const detectPersonaSchema = z.object({
  userId: z.string().optional().describe('ServiceNow user sys_id or username'),
  selfDeclared: z.enum([
    'junior_developer',
    'senior_developer',
    'architect',
    'admin',
    'business_analyst',
    'qa_engineer',
    'project_manager'
  ]).optional().describe('Self-declared persona'),
  context: z.object({
    currentTask: z.string().optional(),
    artifactType: z.string().optional(),
    complexity: z.enum(['low', 'medium', 'high']).optional()
  }).optional().describe('Current task context for adaptive behavior')
});

export type DetectPersonaInput = z.infer<typeof detectPersonaSchema>;

export const setPersonaPreferencesSchema = z.object({
  persona: z.enum([
    'junior_developer',
    'senior_developer',
    'architect',
    'admin',
    'business_analyst',
    'qa_engineer',
    'project_manager'
  ]).describe('Persona type'),
  preferences: z.object({
    verbosity: z.enum(['minimal', 'standard', 'detailed']).default('standard'),
    showExplanations: z.boolean().default(true),
    showExamples: z.boolean().default(true),
    guardrailStrictness: z.enum(['relaxed', 'standard', 'strict']).default('standard'),
    confirmationLevel: z.enum(['minimal', 'important', 'all']).default('important'),
    codeStyle: z.enum(['concise', 'documented', 'verbose']).default('documented')
  }).describe('Persona-specific preferences')
});

export type SetPersonaPreferencesInput = z.infer<typeof setPersonaPreferencesSchema>;

// ============ TYPES ============

interface PersonaProfile {
  persona: string;
  displayName: string;
  description: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  primaryNeeds: string[];
  guardrailDefaults: {
    strictness: 'relaxed' | 'standard' | 'strict';
    autoApprove: string[];
    requireApproval: string[];
  };
  communicationStyle: {
    verbosity: 'minimal' | 'standard' | 'detailed';
    useExamples: boolean;
    useAnalogies: boolean;
    technicalDepth: 'low' | 'medium' | 'high';
  };
  capabilities: string[];
}

interface DetectPersonaResult {
  success: boolean;
  detectedPersona: PersonaProfile;
  confidence: number;
  detectionMethod: 'self_declared' | 'user_profile' | 'behavior_based' | 'default';
  adaptiveSettings: {
    guardrailStrictness: string;
    confirmationLevel: string;
    verbosity: string;
    showExplanations: boolean;
  };
  recommendations: string[];
}

// ============ PERSONA DEFINITIONS ============

const PERSONA_PROFILES: Record<string, PersonaProfile> = {
  junior_developer: {
    persona: 'junior_developer',
    displayName: 'Junior Developer',
    description: 'New to ServiceNow development, learning best practices',
    skillLevel: 'beginner',
    primaryNeeds: [
      'Step-by-step guidance',
      'Explanation of concepts',
      'Examples and templates',
      'Strong guardrails to prevent mistakes'
    ],
    guardrailDefaults: {
      strictness: 'strict',
      autoApprove: [],
      requireApproval: ['delete', 'modify_ootb', 'create_business_rule', 'create_acl']
    },
    communicationStyle: {
      verbosity: 'detailed',
      useExamples: true,
      useAnalogies: true,
      technicalDepth: 'low'
    },
    capabilities: ['create_simple_artifacts', 'read_all', 'request_review']
  },

  senior_developer: {
    persona: 'senior_developer',
    displayName: 'Senior Developer',
    description: 'Experienced ServiceNow developer, knows best practices',
    skillLevel: 'advanced',
    primaryNeeds: [
      'Efficiency and speed',
      'Impact analysis',
      'Best practice enforcement',
      'Code quality metrics'
    ],
    guardrailDefaults: {
      strictness: 'standard',
      autoApprove: ['create_client_script', 'create_ui_action', 'modify_own_code'],
      requireApproval: ['delete', 'modify_ootb', 'create_acl']
    },
    communicationStyle: {
      verbosity: 'standard',
      useExamples: false,
      useAnalogies: false,
      technicalDepth: 'high'
    },
    capabilities: ['create_all_artifacts', 'modify_custom', 'approve_junior_changes']
  },

  architect: {
    persona: 'architect',
    displayName: 'Platform Architect',
    description: 'Designs solutions, ensures platform health',
    skillLevel: 'expert',
    primaryNeeds: [
      'High-level impact analysis',
      'Dependency visualization',
      'Upgrade readiness',
      'Technical debt tracking'
    ],
    guardrailDefaults: {
      strictness: 'relaxed',
      autoApprove: ['all_development_tasks'],
      requireApproval: ['schema_changes', 'acl_changes']
    },
    communicationStyle: {
      verbosity: 'minimal',
      useExamples: false,
      useAnalogies: false,
      technicalDepth: 'high'
    },
    capabilities: ['full_access', 'approve_all', 'configure_guardrails']
  }
};


// Additional personas
const ADDITIONAL_PERSONAS: Record<string, PersonaProfile> = {
  admin: {
    persona: 'admin',
    displayName: 'System Administrator',
    description: 'Manages platform configuration and user access',
    skillLevel: 'intermediate',
    primaryNeeds: [
      'Safe configuration changes',
      'Rollback support',
      'User management',
      'Security validation'
    ],
    guardrailDefaults: {
      strictness: 'standard',
      autoApprove: ['configure_forms', 'manage_users', 'create_groups'],
      requireApproval: ['acl_changes', 'workflow_changes', 'integration_changes']
    },
    communicationStyle: {
      verbosity: 'standard',
      useExamples: true,
      useAnalogies: false,
      technicalDepth: 'medium'
    },
    capabilities: ['configure_platform', 'manage_users', 'view_logs']
  },

  business_analyst: {
    persona: 'business_analyst',
    displayName: 'Business Analyst',
    description: 'Captures requirements, performs gap analysis',
    skillLevel: 'beginner',
    primaryNeeds: [
      'Requirement documentation',
      'Existing capability mapping',
      'Gap analysis',
      'Non-technical explanations'
    ],
    guardrailDefaults: {
      strictness: 'strict',
      autoApprove: ['read_all', 'create_requirements'],
      requireApproval: ['any_development']
    },
    communicationStyle: {
      verbosity: 'detailed',
      useExamples: true,
      useAnalogies: true,
      technicalDepth: 'low'
    },
    capabilities: ['read_all', 'create_requirements', 'request_development']
  },

  qa_engineer: {
    persona: 'qa_engineer',
    displayName: 'QA Engineer',
    description: 'Tests functionality, ensures quality',
    skillLevel: 'intermediate',
    primaryNeeds: [
      'Test case generation',
      'Regression analysis',
      'Coverage reports',
      'ATF support'
    ],
    guardrailDefaults: {
      strictness: 'standard',
      autoApprove: ['create_tests', 'run_tests', 'read_all'],
      requireApproval: ['modify_code', 'delete_data']
    },
    communicationStyle: {
      verbosity: 'standard',
      useExamples: true,
      useAnalogies: false,
      technicalDepth: 'medium'
    },
    capabilities: ['create_tests', 'run_tests', 'view_code', 'create_test_data']
  },

  project_manager: {
    persona: 'project_manager',
    displayName: 'Project Manager',
    description: 'Tracks progress, manages risks',
    skillLevel: 'beginner',
    primaryNeeds: [
      'Effort estimation',
      'Progress tracking',
      'Risk visibility',
      'Status dashboards'
    ],
    guardrailDefaults: {
      strictness: 'strict',
      autoApprove: ['read_all', 'view_reports'],
      requireApproval: ['any_changes']
    },
    communicationStyle: {
      verbosity: 'standard',
      useExamples: false,
      useAnalogies: true,
      technicalDepth: 'low'
    },
    capabilities: ['read_all', 'view_reports', 'track_progress']
  }
};

// Merge all personas
const ALL_PERSONAS = { ...PERSONA_PROFILES, ...ADDITIONAL_PERSONAS };

// ============ MAIN EXPORTS ============

export async function detectPersona(
  _client: ServiceNowClient,
  input: DetectPersonaInput
): Promise<DetectPersonaResult> {
  let detectedPersona: PersonaProfile;
  let confidence = 0;
  let detectionMethod: DetectPersonaResult['detectionMethod'] = 'default';

  // Priority 1: Self-declared persona
  if (input.selfDeclared && ALL_PERSONAS[input.selfDeclared]) {
    detectedPersona = ALL_PERSONAS[input.selfDeclared];
    confidence = 100;
    detectionMethod = 'self_declared';
  }
  // Priority 2: Default to senior_developer
  else {
    detectedPersona = ALL_PERSONAS['senior_developer'];
    confidence = 50;
    detectionMethod = 'default';
  }

  // Generate recommendations based on persona
  const recommendations: string[] = [];
  if (detectedPersona.skillLevel === 'beginner') {
    recommendations.push('Detailed explanations are enabled for your skill level');
    recommendations.push('Strict guardrails will help prevent common mistakes');
  } else if (detectedPersona.skillLevel === 'expert') {
    recommendations.push('Minimal confirmations for faster workflow');
    recommendations.push('You can configure guardrail strictness as needed');
  }

  return {
    success: true,
    detectedPersona,
    confidence,
    detectionMethod,
    adaptiveSettings: {
      guardrailStrictness: detectedPersona.guardrailDefaults.strictness,
      confirmationLevel: detectedPersona.skillLevel === 'beginner' ? 'all' : 'important',
      verbosity: detectedPersona.communicationStyle.verbosity,
      showExplanations: detectedPersona.communicationStyle.useExamples
    },
    recommendations
  };
}

// In-memory preferences store
const personaPreferences: Map<string, SetPersonaPreferencesInput['preferences']> = new Map();

export async function setPersonaPreferences(
  _client: ServiceNowClient,
  input: SetPersonaPreferencesInput
): Promise<{ success: boolean; message: string; preferences: SetPersonaPreferencesInput['preferences'] }> {
  personaPreferences.set(input.persona, input.preferences);

  return {
    success: true,
    message: `Preferences saved for ${input.persona}`,
    preferences: input.preferences
  };
}

export async function getPersonaPreferences(
  _client: ServiceNowClient,
  persona: string
): Promise<{ success: boolean; preferences: SetPersonaPreferencesInput['preferences'] | null }> {
  const prefs = personaPreferences.get(persona);
  return {
    success: true,
    preferences: prefs || null
  };
}