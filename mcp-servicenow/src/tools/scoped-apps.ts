/**
 * Scoped Application Tools
 * Tools for managing ServiceNow custom scoped applications
 * CRITICAL: Required for Flow Designer artifact deployment
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ Tool Schemas ============

export const getCustomAppsSchema = z.object({
  activeOnly: z.boolean().optional().default(true)
    .describe('Only return active applications'),
  includeGlobal: z.boolean().optional().default(true)
    .describe('Include Global scope as an option'),
  limit: z.number().optional().default(50)
    .describe('Maximum number of applications to return')
});

export const createCustomAppSchema = z.object({
  name: z.string().describe('Application name (e.g., "My Custom App")'),
  scope: z.string().optional()
    .describe('Application scope (auto-generated if not provided, e.g., "x_snc_my_app")'),
  shortDescription: z.string().optional()
    .describe('Short description of the application'),
  version: z.string().optional().default('1.0.0')
    .describe('Application version')
});

export const getScopeSelectionOptionsSchema = z.object({
  artifactTypes: z.array(z.string()).optional()
    .describe('Types of artifacts being deployed (e.g., ["flow", "business_rule", "script_include"])')
});

// ============ Tool Implementations ============

/**
 * Get all custom scoped applications from the instance
 * Used to present scope selection options to the user before implementation
 */
export async function getCustomApps(
  client: ServiceNowClient, 
  input: z.infer<typeof getCustomAppsSchema>
) {
  const query = input.activeOnly ? 'active=true' : '';
  
  const apps = await client.getRecords('sys_app', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,scope,short_description,version,active',
    sysparm_limit: input.limit
  });

  const result: Array<{
    sys_id: string;
    name: string;
    scope: string;
    short_description?: string;
    version?: string;
    active: boolean;
    type: 'custom' | 'global';
  }> = [];

  // Add Global scope option first if requested
  if (input.includeGlobal) {
    result.push({
      sys_id: 'global',
      name: 'Global',
      scope: 'global',
      short_description: 'Global application scope (default)',
      version: '-',
      active: true,
      type: 'global'
    });
  }

  // Add custom apps
  for (const app of apps) {
    result.push({
      sys_id: app.sys_id as string,
      name: app.name as string,
      scope: app.scope as string,
      short_description: app.short_description as string | undefined,
      version: app.version as string | undefined,
      active: app.active === 'true' || app.active === true,
      type: 'custom'
    });
  }

  return {
    success: true,
    count: result.length,
    applications: result,
    note: 'Flow Designer artifacts (flows, subflows, flow actions) require a custom scoped application - they cannot be deployed to Global scope via REST API.'
  };
}

/**
 * Get scope selection options with deployment method recommendations
 * Analyzes artifact types and suggests appropriate scopes
 */
export async function getScopeSelectionOptions(
  client: ServiceNowClient,
  input: z.infer<typeof getScopeSelectionOptionsSchema>
) {
  // Get available apps
  const appsResult = await getCustomApps(client, { activeOnly: true, includeGlobal: true });
  
  // Determine if Flow Designer artifacts are involved
  const flowArtifactTypes = ['flow', 'subflow', 'flow_action', 'sys_hub_flow', 'sys_hub_action_type_definition'];
  const hasFlowArtifacts = input.artifactTypes?.some(t => 
    flowArtifactTypes.includes(t.toLowerCase())
  ) ?? false;

  // Build recommendations
  const recommendations: string[] = [];
  if (hasFlowArtifacts) {
    recommendations.push('⚠️ This requirement includes Flow Designer artifacts which REQUIRE a custom scoped application.');
    recommendations.push('Flow Designer artifacts cannot be deployed to Global scope via REST API.');
    recommendations.push('The ServiceNow Fluent SDK will be used for Flow deployment.');
  }

  return {
    success: true,
    hasFlowArtifacts,
    recommendations,
    applications: appsResult.applications,
    deploymentMethods: {
      global: {
        supportedArtifacts: ['business_rule', 'script_include', 'client_script', 'ui_policy', 'ui_action', 'acl'],
        method: 'REST API',
        note: 'Standard REST API deployment'
      },
      scoped: {
        supportedArtifacts: ['all', 'including flow designer artifacts'],
        method: 'ServiceNow Fluent SDK',
        note: 'Required for Flow Designer. Use --reinstall for first deployment.'
      }
    },
    promptTemplate: `
🎯 Application Scope Selection

${hasFlowArtifacts ? '⚠️ This requirement includes Flow Designer artifacts which require a scoped application.\n' : ''}
Available options:
${appsResult.applications.map((app, i) => 
  `  ${i + 1}. ${app.name} (${app.scope})${app.type === 'global' ? ' - Default' : ''}`
).join('\n')}
  ${appsResult.applications.length + 1}. [Create New Application]

Which application scope should I use?`
  };
}

/**
 * Create a new custom scoped application
 * Note: For full app creation with SDK support, use ServiceNow Studio or SDK init
 */
export async function createCustomApp(
  client: ServiceNowClient,
  input: z.infer<typeof createCustomAppSchema>
) {
  // Generate scope if not provided
  const scope = input.scope || `x_snc_${input.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)}`;

  // Create the app record in sys_app
  const appData = {
    name: input.name,
    scope: scope,
    short_description: input.shortDescription || `Custom application: ${input.name}`,
    version: input.version || '1.0.0',
    active: true
  };

  try {
    const record = await client.createRecord('sys_app', appData);

    return {
      success: true,
      message: `Custom application "${input.name}" created successfully`,
      application: {
        sys_id: record.sys_id,
        name: input.name,
        scope: scope,
        version: input.version || '1.0.0'
      },
      nextSteps: [
        'Update sdk-flows/now.config.json with the new scope and scopeId',
        'Run: npx now-sdk build',
        'Run: npx now-sdk install --auth <profile> --reinstall'
      ],
      sdkConfig: {
        scope: scope,
        scopeId: record.sys_id,
        name: input.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create custom application: ${(error as Error).message}`,
      suggestion: 'Consider creating the application via ServiceNow Studio for full SDK support'
    };
  }
}

