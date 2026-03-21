/**
 * Update Set Management Tools
 * Tools for creating, managing, and deploying update sets
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ SCOPE SCHEMAS ============

export const setScopeSchema = z.object({
  scope_id: z.string().describe('The sys_id of the target application scope (sys_scope.sys_id / sys_app.sys_id). Omit or use "global" for Global scope.'),
  scope_name: z.string().optional().describe('Display name of the target scope (for user-facing messages)')
});

export const verifyScopeSchema = z.object({
  target_scope_id: z.string().optional().describe('Expected scope sys_id to verify against. If provided, response includes matchesTarget.')
});

// ============ SCHEMAS ============

export const listUpdateSetsSchema = z.object({
  state: z.enum(['in progress', 'complete', 'ignore', 'all']).optional().default('all'),
  limit: z.number().optional().default(20)
});

export const getUpdateSetSchema = z.object({
  sys_id: z.string().describe('The sys_id of the update set')
});

// ── Type coercion helpers (AI agents often send strings for booleans/numbers) ──
const coerceOptBool = (def: boolean) =>
  z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v === undefined ? undefined : v),
    z.boolean().optional().default(def)
  );

export const createUpdateSetSchema = z.object({
  name: z.string().describe('Name for the update set'),
  description: z.string().optional().describe('Description of the update set'),
  application: z.string().optional().describe('Scope sys_id (sys_scope.sys_id) to create the update set in a specific application scope. Omit for Global scope.'),
  parent: z.string().optional().describe('Parent update set sys_id (for batch)'),
  force: coerceOptBool(false).describe('If true, skip duplicate name check and create anyway'),
  autoTimestamp: coerceOptBool(false).describe('If true and a duplicate name exists, auto-append a timestamp to make the name unique')
});

export const setCurrentUpdateSetSchema = z.object({
  sys_id: z.string().describe('The sys_id of the update set to set as current')
});

export const completeUpdateSetSchema = z.object({
  sys_id: z.string().describe('The sys_id of the update set to complete')
});

export const getUpdateSetContentsSchema = z.object({
  sys_id: z.string().describe('The sys_id of the update set'),
  limit: z.number().optional().default(100)
});

export const moveToUpdateSetSchema = z.object({
  update_set_id: z.string().describe('The sys_id of the target update set'),
  table: z.string().describe('The table name of the artifact (e.g., "sys_script", "sys_script_include")'),
  sys_id: z.string().describe('The sys_id of the record to move to the update set')
});

// Coerce JSON string → array (AI agents sometimes stringify arrays)
const coerceJsonArray = z.preprocess(
  (v) => {
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  },
  z.array(z.object({
    table: z.string().describe('Table name (e.g., "sys_script", "sys_dictionary")'),
    sys_id: z.string().describe('sys_id of the artifact'),
    name: z.string().optional().describe('Friendly name of the artifact')
  }))
);

export const verifyUpdateSetCaptureSchema = z.object({
  update_set_id: z.string().describe('The sys_id of the update set to verify against'),
  artifacts: coerceJsonArray.describe('Array of artifacts to verify: [{table, sys_id, name?}]')
});

// ============ IMPLEMENTATIONS ============

export async function listUpdateSets(client: ServiceNowClient, input: z.infer<typeof listUpdateSetsSchema>) {
  let query = '';
  if (input.state && input.state !== 'all') {
    query = `state=${input.state}`;
  }
  query += (query ? '^' : '') + 'ORDERBYDESCsys_created_on';

  const records = await client.getRecords('sys_update_set', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,description,state,application,sys_created_on,sys_updated_on',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    updateSets: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      description: r.description,
      state: r.state,
      application: r.application,
      created: r.sys_created_on,
      updated: r.sys_updated_on
    }))
  };
}

export async function getUpdateSet(client: ServiceNowClient, input: z.infer<typeof getUpdateSetSchema>) {
  const record = await client.getRecord('sys_update_set', input.sys_id);

  if (!record) {
    return {
      success: false,
      error: `Update set not found: ${input.sys_id}`
    };
  }

  // Get update count
  const updates = await client.getRecords('sys_update_xml', {
    sysparm_query: `update_set=${input.sys_id}`,
    sysparm_fields: 'sys_id',
    sysparm_limit: 1000
  });

  return {
    success: true,
    updateSet: {
      sys_id: record.sys_id,
      name: record.name,
      description: record.description,
      state: record.state,
      application: record.application,
      updateCount: updates.length
    }
  };
}

export async function createUpdateSet(client: ServiceNowClient, input: z.infer<typeof createUpdateSetSchema>) {
  // ── Scope guard: ensure scope is active for custom-scope update sets ──
  if (input.application && input.application !== 'global' && client.getActiveScope() !== input.application) {
    const scopeResult = await client.ensureScopeActive(input.application);
    if (!scopeResult.success) {
      return scopeResult;
    }
  }

  let finalName = input.name;

  // ── Duplicate name check (unless force=true) ──────────────────────
  if (!input.force) {
    const existing = await client.getRecords('sys_update_set', {
      sysparm_query: `name=${input.name}`,
      sysparm_fields: 'sys_id,name,state,sys_created_on,application',
      sysparm_limit: 10
    });

    if (existing.length > 0) {
      // If autoTimestamp is set, append timestamp and proceed
      if (input.autoTimestamp) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        finalName = `${input.name} ${ts}`;
      } else {
        // Return duplicate info — let the AI agent / user decide
        return {
          success: false,
          duplicateDetected: true,
          message: `An update set named "${input.name}" already exists (${existing.length} match${existing.length > 1 ? 'es' : ''}).`,
          existingUpdateSets: existing.map(us => ({
            sys_id: us.sys_id,
            name: us.name,
            state: us.state,
            created: us.sys_created_on,
            application: us.application || 'global'
          })),
          options: [
            'To create anyway, call again with force: true',
            'To auto-append a timestamp, call again with autoTimestamp: true',
            'Or provide a different name'
          ]
        };
      }
    }
  }

  // ── Create the update set ─────────────────────────────────────────
  const data: Record<string, unknown> = {
    name: finalName,
    description: input.description || '',
    state: 'in progress'
  };

  if (input.application) {
    data.application = input.application;
  }

  if (input.parent) {
    data.parent = input.parent;
  }

  const record = await client.createRecord('sys_update_set', data);

  return {
    success: true,
    message: `Update Set "${finalName}" created successfully${input.application ? ' in application scope ' + input.application : ' in Global scope'}`,
    sys_id: record.sys_id,
    name: finalName,
    state: 'in progress',
    application: record.application || 'global',
    nameModified: finalName !== input.name ? { original: input.name, final: finalName } : undefined
  };
}

export async function setCurrentUpdateSet(client: ServiceNowClient, input: z.infer<typeof setCurrentUpdateSetSchema>) {
  try {
    // First verify the update set exists and is in progress
    const updateSet = await client.getRecord('sys_update_set', input.sys_id);

    if (!updateSet) {
      return { success: false, error: 'Update set not found' };
    }

    if (updateSet.state !== 'in progress') {
      return { success: false, error: 'Update set is not in progress' };
    }

    // ── Scope guard: if this update set is in a custom scope, ensure scope is active ──
    const usApplication = typeof updateSet.application === 'string'
      ? updateSet.application
      : (updateSet.application as Record<string, unknown>)?.value as string || '';
    if (usApplication && usApplication !== 'global' && client.getActiveScope() !== usApplication) {
      const scopeResult = await client.ensureScopeActive(usApplication);
      if (!scopeResult.success && scopeResult.userActionRequired) {
        return scopeResult;
      }
    }

    // Layer 1: Call the UpdateSetHelper Scripted REST API (session-based)
    // This calls GlideUpdateSet().set() on the server to set the update set for this session
    const apiResult = await client.callSetCurrentUpdateSetApi(input.sys_id);

    // Layer 2: Track the active update set ID on the client
    // Even if the API call fails, we track it so post-creation artifact moves work
    client.setActiveUpdateSet(input.sys_id);

    const warnings: string[] = [];
    if (!apiResult.success) {
      warnings.push(
        `Session-based capture may not work: ${apiResult.error}. ` +
        `Post-creation artifact move will be used as fallback.`
      );
    }

    return {
      success: true,
      message: `Update Set "${updateSet.name}" set as current for artifact capture`,
      sys_id: input.sys_id,
      name: updateSet.name,
      sessionBased: apiResult.success,
      postCreationMoveEnabled: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      note: apiResult.success
        ? 'All subsequent create/update operations will be captured in this update set (session + post-creation move).'
        : 'Post-creation artifact move is active. All create/update operations will have their sys_update_xml moved to this update set.'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to set current update set: ${error}`
    };
  }
}

export async function completeUpdateSet(client: ServiceNowClient, input: z.infer<typeof completeUpdateSetSchema>) {
  const record = await client.updateRecord('sys_update_set', input.sys_id, {
    state: 'complete'
  });

  return {
    success: true,
    message: 'Update set completed successfully',
    sys_id: record.sys_id,
    name: record.name,
    state: 'complete'
  };
}

export async function getUpdateSetContents(client: ServiceNowClient, input: z.infer<typeof getUpdateSetContentsSchema>) {
  const updates = await client.getRecords('sys_update_xml', {
    sysparm_query: `update_set=${input.sys_id}`,
    sysparm_fields: 'sys_id,name,type,target_name,action,sys_created_on',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    updateSetId: input.sys_id,
    count: updates.length,
    contents: updates.map(u => ({
      sys_id: u.sys_id,
      name: u.name,
      type: u.type,
      targetName: u.target_name,
      action: u.action,
      created: u.sys_created_on
    }))
  };
}

/**
 * Helper to extract sys_id from a ServiceNow reference field
 * (may be a plain string or an object {link, value})
 */
function resolveRef(field: unknown): string {
  if (typeof field === 'string') return field;
  if (field && typeof field === 'object' && 'value' in (field as Record<string, unknown>)) {
    return String((field as Record<string, unknown>).value);
  }
  return String(field ?? '');
}

/** Metadata/dictionary tables that may use non-standard sys_update_xml naming */
const METADATA_TABLES = new Set([
  'sys_dictionary', 'sys_db_object', 'sys_documentation',
  'sys_choice', 'sys_ui_policy', 'sys_ui_policy_action',
  'sys_ui_section', 'sys_ui_element', 'sys_ui_form',
  'sys_ui_list', 'sys_ui_related_list', 'sys_ui_view'
]);

export async function moveToUpdateSet(client: ServiceNowClient, input: z.infer<typeof moveToUpdateSetSchema>) {
  try {
    // Verify the target update set exists and is in progress
    const updateSet = await client.getRecord('sys_update_set', input.update_set_id);
    if (!updateSet) {
      return { success: false, error: 'Target update set not found' };
    }
    if (updateSet.state !== 'in progress') {
      return { success: false, error: 'Target update set is not in progress' };
    }

    const isMetadataTable = METADATA_TABLES.has(input.table);
    const initialDelay = isMetadataTable ? 1500 : 500;
    const maxRetries = isMetadataTable ? 3 : 2;
    let targetRecords: Array<Record<string, unknown>> = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const delay = attempt === 0 ? initialDelay : initialDelay * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Strategy 1: Exact name match
      const updateName = `${input.table}_${input.sys_id}`;
      targetRecords = await client.getRecords('sys_update_xml', {
        sysparm_query: `name=${updateName}^ORDERBYDESCsys_created_on`,
        sysparm_fields: 'sys_id,name,update_set,action',
        sysparm_exclude_reference_link: true,
        sysparm_limit: 10
      });

      // Strategy 2: LIKE search on sys_id
      if (targetRecords.length === 0) {
        targetRecords = await client.getRecords('sys_update_xml', {
          sysparm_query: `nameLIKE${input.sys_id}^ORDERBYDESCsys_created_on`,
          sysparm_fields: 'sys_id,name,update_set,action',
          sysparm_exclude_reference_link: true,
          sysparm_limit: 10
        });
      }

      // Strategy 3: For metadata tables, search by table prefix + recent creation + payload
      if (targetRecords.length === 0 && isMetadataTable) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        const broadRecords = await client.getRecords('sys_update_xml', {
          sysparm_query: `nameSTARTSWITH${input.table}_^sys_created_on>=${fiveMinAgo}^ORDERBYDESCsys_created_on`,
          sysparm_fields: 'sys_id,name,update_set,action,payload',
          sysparm_exclude_reference_link: true,
          sysparm_limit: 20
        });
        targetRecords = broadRecords.filter(r =>
          String(r.payload || '').includes(input.sys_id) ||
          String(r.name || '').includes(input.sys_id)
        );
      }

      if (targetRecords.length > 0) break;
    }

    if (targetRecords.length === 0) {
      return {
        success: false,
        error: `No sys_update_xml records found for ${input.table}_${input.sys_id} after ${maxRetries} attempts. ` +
          `The record may not have generated an update XML entry yet.`
      };
    }

    let moved = 0;
    let alreadyCorrect = 0;
    const errors: string[] = [];

    for (const record of targetRecords) {
      const currentUpdateSet = resolveRef(record.update_set);
      if (currentUpdateSet === input.update_set_id) {
        alreadyCorrect++;
        continue;
      }
      try {
        await client.updateRecord('sys_update_xml', String(record.sys_id), {
          update_set: input.update_set_id
        });
        moved++;
      } catch (e) {
        errors.push(`Failed to move ${record.name}: ${e}`);
      }
    }

    return {
      success: true,
      message: `Moved ${moved} artifact(s) to update set "${updateSet.name}"`,
      update_set_id: input.update_set_id,
      update_set_name: updateSet.name,
      moved,
      alreadyCorrect,
      totalFound: targetRecords.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to move artifact to update set: ${error}`
    };
  }
}



export async function verifyUpdateSetCapture(
  client: ServiceNowClient,
  input: z.infer<typeof verifyUpdateSetCaptureSchema>
) {
  try {
    // Ensure the active update set matches
    if (client.activeUpdateSetId !== input.update_set_id) {
      client.setActiveUpdateSet(input.update_set_id);
    }

    const result = await client.verifyAllArtifactsCaptured(input.artifacts);

    // Also get the full update set contents for the summary
    const contents = await client.getRecords('sys_update_xml', {
      sysparm_query: `update_set=${input.update_set_id}`,
      sysparm_fields: 'sys_id,name,type,target_name,action,sys_created_on',
      sysparm_exclude_reference_link: true,
      sysparm_limit: 500
    });

    return {
      success: true,
      allCaptured: result.allCaptured,
      summary: {
        totalArtifacts: input.artifacts.length,
        captured: result.captured,
        movedNow: result.movedNow,
        missing: result.missing,
      },
      details: result.details,
      updateSetContents: {
        totalItems: contents.length,
        items: contents.map(c => ({
          name: c.name,
          type: c.type,
          targetName: c.target_name,
          action: c.action,
          created: c.sys_created_on
        }))
      },
      recommendation: result.allCaptured
        ? 'All artifacts are confirmed captured in the update set.'
        : `${result.missing} artifact(s) could not be captured. Use sn_move_to_update_set for each missing artifact, or verify manually in the ServiceNow instance.`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify update set capture: ${error}`
    };
  }
}

// ============ SCOPE TOOLS ============

/**
 * sn_set_scope — Switch to a specific application scope.
 * Runs the five-tier fallback via client.ensureScopeActive().
 * Returns success with method used, or userActionRequired with a checklist.
 */
export async function setScope(client: ServiceNowClient, input: z.infer<typeof setScopeSchema>) {
  const scopeId = input.scope_id;

  if (!scopeId || scopeId === 'global') {
    client.setActiveScope('global');
    return {
      success: true,
      message: 'Scope set to Global (no scope switch needed)',
      scopeId: 'global',
      scopeName: 'Global',
      method: 'global_default'
    };
  }

  const result = await client.ensureScopeActive(scopeId, input.scope_name);

  if (result.success) {
    return {
      success: true,
      message: `Scope switched to "${result.scopeName || scopeId}" via ${result.method}`,
      scopeId: result.scopeId,
      scopeName: result.scopeName,
      method: result.method
    };
  }

  if (result.userActionRequired) {
    return {
      success: false,
      userActionRequired: true,
      message: `I tried to switch to scope "${input.scope_name || scopeId}" automatically but it didn't work. Please do this manually:`,
      scopeId,
      scopeName: input.scope_name || scopeId,
      checklist: result.checklist,
      error: result.error
    };
  }

  return {
    success: false,
    error: result.error || 'Unknown scope switch failure'
  };
}

/**
 * sn_verify_scope — Check the current application scope.
 * Uses concoursepicker GET + sys_user_preference fallback.
 */
export async function verifyScope(client: ServiceNowClient, input: z.infer<typeof verifyScopeSchema>) {
  const result = await client.verifyCurrentScope(input.target_scope_id);

  return {
    success: true,
    currentScopeId: result.currentScopeId,
    currentScopeName: result.currentScopeName,
    matchesTarget: input.target_scope_id ? result.matchesTarget : undefined,
    targetScopeId: input.target_scope_id || undefined,
    note: result.matchesTarget === false
      ? `Current scope (${result.currentScopeName}) does not match target (${input.target_scope_id}). Call sn_set_scope to switch.`
      : undefined
  };
}
