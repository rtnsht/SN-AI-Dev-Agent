/**
 * Dead Code Finder Tool
 * Identifies unused, orphaned, or potentially dead code in ServiceNow instances
 *
 * Task 1.6 of the Brownfield Enhancement Plan
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const findDeadCodeSchema = z.object({
  scope: z.string().optional().describe('Filter by application scope'),
  artifactTypes: z.array(z.enum([
    'all', 'script_includes', 'business_rules', 'client_scripts',
    'ui_actions', 'scheduled_jobs', 'workflows', 'notifications'
  ])).default(['all']).describe('Types of artifacts to check'),
  includeInactive: z.boolean().default(true).describe('Include inactive artifacts'),
  checkReferences: z.boolean().default(true).describe('Check if artifacts are referenced elsewhere'),
  limit: z.number().min(1).max(500).default(100).describe('Maximum artifacts to analyze per type')
});

export type FindDeadCodeInput = z.infer<typeof findDeadCodeSchema>;

// ============ TYPES ============

interface DeadCodeItem {
  sys_id: string;
  name: string;
  type: string;
  table: string;
  scope: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  lastUpdated?: string;
  updatedBy?: string;
  details?: string;
}

interface DeadCodeSummary {
  totalFound: number;
  byType: Record<string, number>;
  byConfidence: { high: number; medium: number; low: number };
  byReason: Record<string, number>;
  estimatedCleanupEffort: string;
}

interface DeadCodeResult {
  success: boolean;
  summary: DeadCodeSummary;
  items: DeadCodeItem[];
  recommendations: string[];
}

// ============ ARTIFACT DEFINITIONS ============

interface ArtifactDef {
  table: string;
  type: string;
  nameField: string;
  scriptField?: string;
  activeField?: string;
  additionalFields?: string[];
}

const ARTIFACT_DEFS: Record<string, ArtifactDef> = {
  script_includes: {
    table: 'sys_script_include',
    type: 'Script Include',
    nameField: 'name',
    scriptField: 'script',
    activeField: 'active',
    additionalFields: ['api_name', 'client_callable', 'sys_updated_on', 'sys_updated_by']
  },
  business_rules: {
    table: 'sys_script',
    type: 'Business Rule',
    nameField: 'name',
    scriptField: 'script',
    activeField: 'active',
    additionalFields: ['collection', 'when', 'sys_updated_on', 'sys_updated_by']
  },
  client_scripts: {
    table: 'sys_script_client',
    type: 'Client Script',
    nameField: 'name',
    scriptField: 'script',
    activeField: 'active',
    additionalFields: ['table', 'type', 'sys_updated_on', 'sys_updated_by']
  },
  ui_actions: {
    table: 'sys_ui_action',
    type: 'UI Action',
    nameField: 'name',
    scriptField: 'script',
    activeField: 'active',
    additionalFields: ['table', 'sys_updated_on', 'sys_updated_by']
  },
  scheduled_jobs: {
    table: 'sysauto_script',
    type: 'Scheduled Job',
    nameField: 'name',
    scriptField: 'script',
    activeField: 'active',
    additionalFields: ['run_type', 'sys_updated_on', 'sys_updated_by']
  },
  workflows: {
    table: 'wf_workflow',
    type: 'Workflow',
    nameField: 'name',
    activeField: 'active',
    additionalFields: ['table', 'sys_updated_on', 'sys_updated_by']
  },
  notifications: {
    table: 'sysevent_email_action',
    type: 'Notification',
    nameField: 'name',
    activeField: 'active',
    additionalFields: ['collection', 'sys_updated_on', 'sys_updated_by']
  }
};

// ============ HELPER FUNCTIONS ============

function getConfidenceLevel(reasons: string[]): 'high' | 'medium' | 'low' {
  if (reasons.includes('inactive') && reasons.includes('never_referenced')) return 'high';
  if (reasons.includes('inactive') || reasons.includes('never_referenced')) return 'medium';
  return 'low';
}

function estimateCleanupEffort(count: number): string {
  if (count <= 10) return 'Low (1-2 hours)';
  if (count <= 50) return 'Medium (1-2 days)';
  if (count <= 100) return 'High (1 week)';
  return 'Very High (2+ weeks)';
}


// ============ REFERENCE CHECKING ============

async function findScriptIncludeReferences(
  client: ServiceNowClient,
  scriptIncludeName: string
): Promise<number> {
  // Search for references in various script tables
  const tables = [
    { table: 'sys_script', field: 'script' },
    { table: 'sys_script_include', field: 'script' },
    { table: 'sys_script_client', field: 'script' },
    { table: 'sys_ui_action', field: 'script' },
    { table: 'sysauto_script', field: 'script' }
  ];

  let totalRefs = 0;

  for (const t of tables) {
    try {
      const records = await client.getRecords(t.table, {
        sysparm_query: `${t.field}LIKE${scriptIncludeName}`,
        sysparm_fields: 'sys_id',
        sysparm_limit: 5
      });
      totalRefs += records.length;
      if (totalRefs > 0) break; // Found at least one reference
    } catch {
      // Continue on error
    }
  }

  return totalRefs;
}

async function checkTableExists(client: ServiceNowClient, tableName: string): Promise<boolean> {
  if (!tableName) return false;
  try {
    const records = await client.getRecords('sys_db_object', {
      sysparm_query: `name=${tableName}`,
      sysparm_fields: 'sys_id',
      sysparm_limit: 1
    });
    return records.length > 0;
  } catch {
    return false;
  }
}

// ============ DEAD CODE DETECTION FUNCTIONS ============

async function findInactiveArtifacts(
  client: ServiceNowClient,
  def: ArtifactDef,
  scope: string | undefined,
  limit: number
): Promise<DeadCodeItem[]> {
  const items: DeadCodeItem[] = [];

  if (!def.activeField) return items;

  try {
    let filter = `${def.activeField}=false`;
    if (scope) {
      filter += `^sys_scope.scope=${scope}`;
    }

    const fields = ['sys_id', def.nameField, 'sys_scope.scope', ...( def.additionalFields || [])];

    const records = await client.getRecords(def.table, {
      sysparm_query: filter,
      sysparm_fields: fields.join(','),
      sysparm_limit: limit
    });

    for (const record of records) {
      items.push({
        sys_id: String(record.sys_id || ''),
        name: String(record[def.nameField] || 'Unknown'),
        type: def.type,
        table: def.table,
        scope: String(record['sys_scope.scope'] || 'global'),
        reason: 'Inactive artifact',
        confidence: 'medium',
        lastUpdated: String(record.sys_updated_on || ''),
        updatedBy: String(record.sys_updated_by || ''),
        details: 'This artifact is marked as inactive and may no longer be needed.'
      });
    }
  } catch {
    // Continue on error
  }

  return items;
}

async function findUnreferencedScriptIncludes(
  client: ServiceNowClient,
  scope: string | undefined,
  limit: number
): Promise<DeadCodeItem[]> {
  const items: DeadCodeItem[] = [];

  try {
    let filter = 'active=true';
    if (scope) {
      filter += `^sys_scope.scope=${scope}`;
    }

    const records = await client.getRecords('sys_script_include', {
      sysparm_query: filter,
      sysparm_fields: 'sys_id,name,api_name,sys_scope.scope,sys_updated_on,sys_updated_by',
      sysparm_limit: limit
    });

    for (const record of records) {
      const name = String(record.name || '');
      const apiName = String(record.api_name || name);

      // Check if this Script Include is referenced anywhere
      const refCount = await findScriptIncludeReferences(client, name);

      if (refCount === 0) {
        items.push({
          sys_id: String(record.sys_id || ''),
          name: name,
          type: 'Script Include',
          table: 'sys_script_include',
          scope: String(record['sys_scope.scope'] || 'global'),
          reason: 'Never referenced',
          confidence: 'high',
          lastUpdated: String(record.sys_updated_on || ''),
          updatedBy: String(record.sys_updated_by || ''),
          details: `Script Include "${apiName}" is not referenced in any other scripts.`
        });
      }
    }
  } catch {
    // Continue on error
  }

  return items;
}


async function findOrphanedTableArtifacts(
  client: ServiceNowClient,
  scope: string | undefined,
  limit: number
): Promise<DeadCodeItem[]> {
  const items: DeadCodeItem[] = [];

  // Check Business Rules on non-existent tables
  try {
    let filter = 'active=true^collectionISNOTEMPTY';
    if (scope) {
      filter += `^sys_scope.scope=${scope}`;
    }

    const records = await client.getRecords('sys_script', {
      sysparm_query: filter,
      sysparm_fields: 'sys_id,name,collection,sys_scope.scope,sys_updated_on,sys_updated_by',
      sysparm_limit: limit
    });

    for (const record of records) {
      const tableName = String(record.collection || '');
      if (tableName && !(await checkTableExists(client, tableName))) {
        items.push({
          sys_id: String(record.sys_id || ''),
          name: String(record.name || 'Unknown'),
          type: 'Business Rule',
          table: 'sys_script',
          scope: String(record['sys_scope.scope'] || 'global'),
          reason: 'References non-existent table',
          confidence: 'high',
          lastUpdated: String(record.sys_updated_on || ''),
          updatedBy: String(record.sys_updated_by || ''),
          details: `Business Rule references table "${tableName}" which does not exist.`
        });
      }
    }
  } catch {
    // Continue on error
  }

  // Check Client Scripts on non-existent tables
  try {
    let filter = 'active=true^tableISNOTEMPTY';
    if (scope) {
      filter += `^sys_scope.scope=${scope}`;
    }

    const records = await client.getRecords('sys_script_client', {
      sysparm_query: filter,
      sysparm_fields: 'sys_id,name,table,sys_scope.scope,sys_updated_on,sys_updated_by',
      sysparm_limit: limit
    });

    for (const record of records) {
      const tableName = String(record.table || '');
      if (tableName && !(await checkTableExists(client, tableName))) {
        items.push({
          sys_id: String(record.sys_id || ''),
          name: String(record.name || 'Unknown'),
          type: 'Client Script',
          table: 'sys_script_client',
          scope: String(record['sys_scope.scope'] || 'global'),
          reason: 'References non-existent table',
          confidence: 'high',
          lastUpdated: String(record.sys_updated_on || ''),
          updatedBy: String(record.sys_updated_by || ''),
          details: `Client Script references table "${tableName}" which does not exist.`
        });
      }
    }
  } catch {
    // Continue on error
  }

  return items;
}

async function findEmptyScripts(
  client: ServiceNowClient,
  def: ArtifactDef,
  scope: string | undefined,
  limit: number
): Promise<DeadCodeItem[]> {
  const items: DeadCodeItem[] = [];

  if (!def.scriptField) return items;

  try {
    // Look for empty or minimal scripts
    let filter = `active=true^${def.scriptField}=`;
    if (scope) {
      filter += `^sys_scope.scope=${scope}`;
    }

    const fields = ['sys_id', def.nameField, 'sys_scope.scope', ...(def.additionalFields || [])];

    const records = await client.getRecords(def.table, {
      sysparm_query: filter,
      sysparm_fields: fields.join(','),
      sysparm_limit: limit
    });

    for (const record of records) {
      items.push({
        sys_id: String(record.sys_id || ''),
        name: String(record[def.nameField] || 'Unknown'),
        type: def.type,
        table: def.table,
        scope: String(record['sys_scope.scope'] || 'global'),
        reason: 'Empty script',
        confidence: 'high',
        lastUpdated: String(record.sys_updated_on || ''),
        updatedBy: String(record.sys_updated_by || ''),
        details: 'This artifact has an empty script field and does nothing.'
      });
    }
  } catch {
    // Continue on error
  }

  return items;
}

async function findOldUnusedArtifacts(
  client: ServiceNowClient,
  def: ArtifactDef,
  scope: string | undefined,
  limit: number
): Promise<DeadCodeItem[]> {
  const items: DeadCodeItem[] = [];

  try {
    // Find artifacts not updated in over 2 years that are inactive
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const dateStr = twoYearsAgo.toISOString().split('T')[0];

    let filter = `active=false^sys_updated_on<${dateStr}`;
    if (scope) {
      filter += `^sys_scope.scope=${scope}`;
    }

    const fields = ['sys_id', def.nameField, 'sys_scope.scope', ...(def.additionalFields || [])];

    const records = await client.getRecords(def.table, {
      sysparm_query: filter,
      sysparm_fields: fields.join(','),
      sysparm_limit: limit
    });

    for (const record of records) {
      items.push({
        sys_id: String(record.sys_id || ''),
        name: String(record[def.nameField] || 'Unknown'),
        type: def.type,
        table: def.table,
        scope: String(record['sys_scope.scope'] || 'global'),
        reason: 'Stale inactive artifact',
        confidence: 'high',
        lastUpdated: String(record.sys_updated_on || ''),
        updatedBy: String(record.sys_updated_by || ''),
        details: 'This artifact has been inactive for over 2 years and is likely safe to remove.'
      });
    }
  } catch {
    // Continue on error
  }

  return items;
}


// ============ MAIN FUNCTION ============

export async function findDeadCode(
  client: ServiceNowClient,
  input: FindDeadCodeInput
): Promise<DeadCodeResult> {
  const allItems: DeadCodeItem[] = [];

  // Determine which artifact types to check
  const typesToCheck = input.artifactTypes.includes('all')
    ? Object.keys(ARTIFACT_DEFS)
    : input.artifactTypes;

  for (const artifactType of typesToCheck) {
    const def = ARTIFACT_DEFS[artifactType];
    if (!def) continue;

    // 1. Find inactive artifacts
    if (input.includeInactive) {
      const inactive = await findInactiveArtifacts(client, def, input.scope, input.limit);
      allItems.push(...inactive);
    }

    // 2. Find empty scripts
    const empty = await findEmptyScripts(client, def, input.scope, input.limit);
    allItems.push(...empty);

    // 3. Find stale old artifacts
    const stale = await findOldUnusedArtifacts(client, def, input.scope, input.limit);
    allItems.push(...stale);
  }

  // 4. Find unreferenced Script Includes (more expensive check)
  if (input.checkReferences && (input.artifactTypes.includes('all') || input.artifactTypes.includes('script_includes'))) {
    const unreferenced = await findUnreferencedScriptIncludes(client, input.scope, Math.min(input.limit, 50));
    allItems.push(...unreferenced);
  }

  // 5. Find artifacts on non-existent tables
  if (input.artifactTypes.includes('all') ||
      input.artifactTypes.includes('business_rules') ||
      input.artifactTypes.includes('client_scripts')) {
    const orphaned = await findOrphanedTableArtifacts(client, input.scope, input.limit);
    allItems.push(...orphaned);
  }

  // Deduplicate by sys_id
  const uniqueItems = Array.from(
    new Map(allItems.map(item => [item.sys_id, item])).values()
  );

  // Build summary
  const byType: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  const byConfidence = { high: 0, medium: 0, low: 0 };

  for (const item of uniqueItems) {
    byType[item.type] = (byType[item.type] || 0) + 1;
    byReason[item.reason] = (byReason[item.reason] || 0) + 1;
    byConfidence[item.confidence]++;
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (byConfidence.high > 20) {
    recommendations.push('CRITICAL: High number of confirmed dead code artifacts. Schedule a cleanup sprint.');
  }
  if (byReason['Never referenced'] > 10) {
    recommendations.push('Many Script Includes are never used. Review and consolidate or remove them.');
  }
  if (byReason['Inactive artifact'] > 50) {
    recommendations.push('Large number of inactive artifacts. Consider archiving or deleting old inactive items.');
  }
  if (byReason['Stale inactive artifact'] > 10) {
    recommendations.push('Several artifacts have been inactive for years. These are safe candidates for removal.');
  }
  if (byReason['Empty script'] > 5) {
    recommendations.push('Empty script artifacts found. These can be deleted immediately.');
  }
  if (byReason['References non-existent table'] > 0) {
    recommendations.push('Artifacts referencing deleted tables found. Remove these to prevent errors.');
  }

  if (recommendations.length === 0 && uniqueItems.length > 0) {
    recommendations.push('Review the identified dead code candidates and create a cleanup plan.');
  }

  return {
    success: true,
    summary: {
      totalFound: uniqueItems.length,
      byType,
      byConfidence,
      byReason,
      estimatedCleanupEffort: estimateCleanupEffort(uniqueItems.length)
    },
    items: uniqueItems.sort((a, b) => {
      // Sort by confidence (high first), then by type
      const confOrder = { high: 0, medium: 1, low: 2 };
      if (confOrder[a.confidence] !== confOrder[b.confidence]) {
        return confOrder[a.confidence] - confOrder[b.confidence];
      }
      return a.type.localeCompare(b.type);
    }),
    recommendations
  };
}