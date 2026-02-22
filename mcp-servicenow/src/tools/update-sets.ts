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

export const createUpdateSetSchema = z.object({
  name: z.string().describe('Name for the update set'),
  description: z.string().optional().describe('Description of the update set'),
  application: z.string().optional().describe('Scope sys_id (sys_scope.sys_id) to create the update set in a specific application scope. Omit for Global scope.'),
  parent: z.string().optional().describe('Parent update set sys_id (for batch)')
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
  const data: Record<string, unknown> = {
    name: input.name,
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
    message: `Update Set "${input.name}" created successfully${input.application ? ' in application scope ' + input.application : ' in Global scope'}`,
    sys_id: record.sys_id,
    name: input.name,
    state: 'in progress',
    application: record.application || 'global'
  };
}

export async function setCurrentUpdateSet(client: ServiceNowClient, input: z.infer<typeof setCurrentUpdateSetSchema>) {
  // In ServiceNow, setting current update set is done via user preference
  // This requires hitting a specific endpoint or UI action
  // For API access, we'll update the user's preference
  
  try {
    // First verify the update set exists and is in progress
    const updateSet = await client.getRecord('sys_update_set', input.sys_id);
    
    if (!updateSet) {
      return { success: false, error: 'Update set not found' };
    }
    
    if (updateSet.state !== 'in progress') {
      return { success: false, error: 'Update set is not in progress' };
    }
    
    return {
      success: true,
      message: `Update Set "${updateSet.name}" is ready to be set as current`,
      sys_id: input.sys_id,
      name: updateSet.name,
      note: 'To set as current, use the ServiceNow UI or ensure your session uses this update set'
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

