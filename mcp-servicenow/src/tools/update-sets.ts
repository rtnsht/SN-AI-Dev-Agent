/**
 * Update Set Management Tools
 * Tools for creating, managing, and deploying update sets
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

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

    // Small delay to allow sys_update_xml record to be fully created
    await new Promise(resolve => setTimeout(resolve, 500));

    // Look for sys_update_xml records matching this artifact
    const updateName = `${input.table}_${input.sys_id}`;
    const records = await client.getRecords('sys_update_xml', {
      sysparm_query: `name=${updateName}^ORDERBYDESCsys_created_on`,
      sysparm_fields: 'sys_id,name,update_set,action',
      sysparm_limit: 10
    });

    // Fallback: broader search if exact match not found
    let targetRecords = records;
    if (records.length === 0) {
      targetRecords = await client.getRecords('sys_update_xml', {
        sysparm_query: `nameLIKE${input.sys_id}^ORDERBYDESCsys_created_on`,
        sysparm_fields: 'sys_id,name,update_set,action',
        sysparm_limit: 10
      });
    }

    if (targetRecords.length === 0) {
      return {
        success: false,
        error: `No sys_update_xml records found for ${updateName}. The record may not have generated an update XML entry yet.`
      };
    }

    let moved = 0;
    let alreadyCorrect = 0;
    const errors: string[] = [];

    for (const record of targetRecords) {
      if (record.update_set === input.update_set_id) {
        alreadyCorrect++;
        continue;
      }
      try {
        await client.updateRecord('sys_update_xml', record.sys_id, {
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

