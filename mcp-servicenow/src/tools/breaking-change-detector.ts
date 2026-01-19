/**
 * Breaking Change Detector Tool
 * Detects changes that may break dependent functionality
 *
 * Task 2.4 of the Brownfield Enhancement Plan - Step 2: Guardrails & Impact Analysis
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const checkBreakingChangesSchema = z.object({
  artifactType: z.enum([
    'script_include',
    'table',
    'field',
    'api',
    'workflow',
    'flow'
  ]).describe('Type of artifact being modified'),

  artifactName: z.string().describe('Name or sys_id of the artifact'),
  proposedChange: z.enum([
    'delete',
    'rename',
    'modify_signature',
    'change_return_type',
    'add_required_param',
    'remove_method',
    'change_field_type',
    'remove_field',
    'deactivate'
  ]).describe('Type of change being proposed'),

  newValue: z.string().optional().describe('New name/value for rename operations'),
  scope: z.string().optional().describe('Application scope to limit search'),
  checkDepth: z.enum(['shallow', 'deep']).default('shallow').describe('Depth of dependency search')
});

export type CheckBreakingChangesInput = z.infer<typeof checkBreakingChangesSchema>;

// ============ TYPES ============

interface BreakingChangeAlert {
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedArtifact: {
    name: string;
    sys_id: string;
    type: string;
    table: string;
  };
  breakType: 'reference_break' | 'api_break' | 'data_loss' | 'workflow_break' | 'integration_break';
  description: string;
  currentUsage: string;
  recommendation: string;
}

interface BreakingChangeResult {
  success: boolean;
  artifactType: string;
  artifactName: string;
  proposedChange: string;
  summary: {
    totalAlerts: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  alerts: BreakingChangeAlert[];
  safeToProced: boolean;
  requiresApproval: boolean;
  migrationSteps?: string[];
}

// ============ TABLES TO SEARCH FOR REFERENCES ============

const SCRIPT_TABLES = [
  { table: 'sys_script', name: 'Business Rules', scriptField: 'script' },
  { table: 'sys_script_include', name: 'Script Includes', scriptField: 'script' },
  { table: 'sys_script_client', name: 'Client Scripts', scriptField: 'script' },
  { table: 'sys_ui_action', name: 'UI Actions', scriptField: 'script' },
  { table: 'sysauto_script', name: 'Scheduled Jobs', scriptField: 'script' },
  { table: 'sys_processor', name: 'Processors', scriptField: 'script' },
  { table: 'sys_ws_operation', name: 'Scripted REST Operations', scriptField: 'operation_script' },
  { table: 'sysevent_script_action', name: 'Script Actions', scriptField: 'script' }
];

// ============ HELPER FUNCTIONS ============

async function findScriptReferences(
  client: ServiceNowClient,
  artifactName: string,
  scope?: string,
  limit = 50
): Promise<Array<{ table: string; type: string; name: string; sys_id: string; usage: string }>> {
  const references: Array<{ table: string; type: string; name: string; sys_id: string; usage: string }> = [];

  for (const tableInfo of SCRIPT_TABLES) {
    try {
      let query = `${tableInfo.scriptField}LIKE${artifactName}^active=true`;
      if (scope) query += `^sys_scope.scope=${scope}`;

      const records = await client.getRecords(tableInfo.table, {
        sysparm_query: query,
        sysparm_fields: 'sys_id,name',
        sysparm_limit: limit
      });

      for (const record of records) {
        references.push({
          table: tableInfo.table,
          type: tableInfo.name,
          name: String(record.name || 'Unnamed'),
          sys_id: String(record.sys_id),
          usage: `Uses "${artifactName}" in script`
        });
      }
    } catch {
      // Continue on error
    }
  }

  return references;
}

async function findTableReferences(
  client: ServiceNowClient,
  tableName: string,
  limit = 50
): Promise<Array<{ table: string; type: string; name: string; sys_id: string; usage: string }>> {
  const references: Array<{ table: string; type: string; name: string; sys_id: string; usage: string }> = [];

  // Check Business Rules
  try {
    const brs = await client.getRecords('sys_script', {
      sysparm_query: `collection=${tableName}^active=true`,
      sysparm_fields: 'sys_id,name',
      sysparm_limit: limit
    });
    for (const br of brs) {
      references.push({
        table: 'sys_script',
        type: 'Business Rule',
        name: String(br.name),
        sys_id: String(br.sys_id),
        usage: `Runs on table ${tableName}`
      });
    }
  } catch { /* continue */ }

  // Check Client Scripts
  try {
    const css = await client.getRecords('sys_script_client', {
      sysparm_query: `table=${tableName}^active=true`,
      sysparm_fields: 'sys_id,name',
      sysparm_limit: limit
    });
    for (const cs of css) {
      references.push({
        table: 'sys_script_client',
        type: 'Client Script',
        name: String(cs.name),
        sys_id: String(cs.sys_id),
        usage: `Runs on table ${tableName}`
      });
    }
  } catch { /* continue */ }

  // Check UI Policies
  try {
    const policies = await client.getRecords('sys_ui_policy', {
      sysparm_query: `table=${tableName}^active=true`,
      sysparm_fields: 'sys_id,short_description',
      sysparm_limit: limit
    });
    for (const p of policies) {
      references.push({
        table: 'sys_ui_policy',
        type: 'UI Policy',
        name: String(p.short_description || 'Unnamed'),
        sys_id: String(p.sys_id),
        usage: `Applied on table ${tableName}`
      });
    }
  } catch { /* continue */ }

  return references;
}


// ============ MAIN EXPORT ============

export async function checkBreakingChanges(
  client: ServiceNowClient,
  input: CheckBreakingChangesInput
): Promise<BreakingChangeResult> {
  const alerts: BreakingChangeAlert[] = [];

  // Find references based on artifact type
  let references: Array<{ table: string; type: string; name: string; sys_id: string; usage: string }> = [];

  if (input.artifactType === 'script_include') {
    references = await findScriptReferences(client, input.artifactName, input.scope);
  } else if (input.artifactType === 'table') {
    references = await findTableReferences(client, input.artifactName);
  }

  // Create alerts based on proposed change and references
  for (const ref of references) {
    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    let breakType: BreakingChangeAlert['breakType'] = 'reference_break';
    let description = '';
    let recommendation = '';

    switch (input.proposedChange) {
      case 'delete':
        severity = 'critical';
        description = `Deleting "${input.artifactName}" will break this artifact`;
        recommendation = 'Update or remove the reference before deleting';
        break;

      case 'rename':
        severity = 'high';
        description = `Renaming "${input.artifactName}" to "${input.newValue}" will break this reference`;
        recommendation = `Update all references to use new name "${input.newValue}"`;
        break;

      case 'modify_signature':
      case 'add_required_param':
        severity = 'high';
        breakType = 'api_break';
        description = `Changing the API signature will break calls from this artifact`;
        recommendation = 'Add optional parameters or create a new method';
        break;

      case 'remove_method':
        severity = 'critical';
        breakType = 'api_break';
        description = `Removing a method will break calls from this artifact`;
        recommendation = 'Deprecate the method first and migrate callers';
        break;

      case 'deactivate':
        severity = 'high';
        description = `Deactivating "${input.artifactName}" may break this artifact`;
        recommendation = 'Verify this artifact does not require the deactivated item';
        break;

      case 'change_field_type':
      case 'remove_field':
        severity = 'critical';
        breakType = 'data_loss';
        description = `Field changes on "${input.artifactName}" may cause data loss or break scripts`;
        recommendation = 'Create migration script and update dependent artifacts';
        break;

      default:
        description = `This change may affect the artifact`;
        recommendation = 'Review and test thoroughly';
    }

    alerts.push({
      severity,
      affectedArtifact: {
        name: ref.name,
        sys_id: ref.sys_id,
        type: ref.type,
        table: ref.table
      },
      breakType,
      description,
      currentUsage: ref.usage,
      recommendation
    });
  }

  // Calculate summary
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const mediumCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  // Generate migration steps if needed
  const migrationSteps: string[] = [];
  if (alerts.length > 0) {
    migrationSteps.push('1. Create a backup of affected artifacts');
    migrationSteps.push('2. Document all current usages');

    if (input.proposedChange === 'rename' && input.newValue) {
      migrationSteps.push(`3. Update all references to use "${input.newValue}"`);
      migrationSteps.push('4. Test all affected artifacts');
      migrationSteps.push('5. Perform the rename');
    } else if (input.proposedChange === 'delete') {
      migrationSteps.push('3. Remove or update all dependent references');
      migrationSteps.push('4. Verify no runtime errors');
      migrationSteps.push('5. Delete the artifact');
    } else {
      migrationSteps.push('3. Update affected artifacts to handle the change');
      migrationSteps.push('4. Test in sub-production environment');
      migrationSteps.push('5. Deploy changes together');
    }
  }

  return {
    success: true,
    artifactType: input.artifactType,
    artifactName: input.artifactName,
    proposedChange: input.proposedChange,
    summary: {
      totalAlerts: alerts.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount
    },
    alerts,
    safeToProced: criticalCount === 0 && highCount === 0,
    requiresApproval: criticalCount > 0 || highCount > 0,
    migrationSteps: alerts.length > 0 ? migrationSteps : undefined
  };
}