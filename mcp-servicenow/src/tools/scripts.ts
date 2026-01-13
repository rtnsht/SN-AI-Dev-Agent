/**
 * Script Artifact Tools
 * Tools for managing Business Rules, Script Includes, Client Scripts
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ BUSINESS RULES ============

export const getBusinessRulesSchema = z.object({
  table: z.string().describe('Table name to get business rules for'),
  activeOnly: z.boolean().optional().default(true).describe('Only return active rules'),
  limit: z.number().optional().default(50)
});

export const createBusinessRuleSchema = z.object({
  name: z.string().describe('Name of the business rule'),
  table: z.string().describe('Table the rule applies to'),
  script: z.string().describe('The script code'),
  when: z.enum(['before', 'after', 'async', 'display']).describe('When the rule runs'),
  order: z.number().optional().default(100).describe('Execution order'),
  condition: z.string().optional().describe('Condition for rule execution'),
  insert: z.boolean().optional().default(true).describe('Run on insert'),
  update: z.boolean().optional().default(true).describe('Run on update'),
  delete: z.boolean().optional().default(false).describe('Run on delete'),
  query: z.boolean().optional().default(false).describe('Run on query'),
  active: z.boolean().optional().default(true).describe('Is the rule active')
});

// ============ SCRIPT INCLUDES ============

export const getScriptIncludesSchema = z.object({
  query: z.string().optional().describe('Query filter (e.g., "nameSTARTSWITHUtil")'),
  activeOnly: z.boolean().optional().default(true),
  limit: z.number().optional().default(50)
});

export const createScriptIncludeSchema = z.object({
  name: z.string().describe('Name of the script include (also used as class name)'),
  script: z.string().describe('The script code'),
  apiName: z.string().optional().describe('API name (defaults to name)'),
  clientCallable: z.boolean().optional().default(false).describe('Can be called from client'),
  active: z.boolean().optional().default(true)
});

// ============ CLIENT SCRIPTS ============

export const getClientScriptsSchema = z.object({
  table: z.string().describe('Table name to get client scripts for'),
  activeOnly: z.boolean().optional().default(true),
  limit: z.number().optional().default(50)
});

export const createClientScriptSchema = z.object({
  name: z.string().describe('Name of the client script'),
  table: z.string().describe('Table the script applies to'),
  script: z.string().describe('The script code'),
  type: z.enum(['onLoad', 'onChange', 'onSubmit', 'onCellEdit']).describe('Script type'),
  field: z.string().optional().describe('Field name (for onChange)'),
  active: z.boolean().optional().default(true)
});

// ============ IMPLEMENTATIONS ============

export async function getBusinessRules(client: ServiceNowClient, input: z.infer<typeof getBusinessRulesSchema>) {
  let query = `collection=${input.table}`;
  if (input.activeOnly) query += '^active=true';
  
  const records = await client.getRecords('sys_script', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,collection,when,order,script,condition,active,action_insert,action_update,action_delete,action_query',
    sysparm_limit: input.limit
  });
  
  return {
    success: true,
    table: input.table,
    count: records.length,
    businessRules: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      when: r.when,
      order: r.order,
      active: r.active,
      script: r.script,
      operations: {
        insert: r.action_insert,
        update: r.action_update,
        delete: r.action_delete,
        query: r.action_query
      }
    }))
  };
}

export async function createBusinessRule(client: ServiceNowClient, input: z.infer<typeof createBusinessRuleSchema>) {
  const data = {
    name: input.name,
    collection: input.table,
    script: input.script,
    when: input.when,
    order: input.order,
    condition: input.condition || '',
    action_insert: input.insert,
    action_update: input.update,
    action_delete: input.delete,
    action_query: input.query,
    active: input.active
  };
  
  const record = await client.createRecord('sys_script', data);
  
  return {
    success: true,
    message: `Business Rule "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    table: input.table
  };
}

export async function getScriptIncludes(client: ServiceNowClient, input: z.infer<typeof getScriptIncludesSchema>) {
  let query = input.query || '';
  if (input.activeOnly) query += (query ? '^' : '') + 'active=true';
  
  const records = await client.getRecords('sys_script_include', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,api_name,script,client_callable,active,access',
    sysparm_limit: input.limit
  });
  
  return {
    success: true,
    count: records.length,
    scriptIncludes: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      apiName: r.api_name,
      clientCallable: r.client_callable,
      active: r.active,
      script: r.script
    }))
  };
}

export async function createScriptInclude(client: ServiceNowClient, input: z.infer<typeof createScriptIncludeSchema>) {
  const data = {
    name: input.name,
    api_name: input.apiName || input.name,
    script: input.script,
    client_callable: input.clientCallable,
    active: input.active,
    access: 'public'
  };
  
  const record = await client.createRecord('sys_script_include', data);
  
  return {
    success: true,
    message: `Script Include "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    apiName: data.api_name
  };
}

export async function getClientScripts(client: ServiceNowClient, input: z.infer<typeof getClientScriptsSchema>) {
  let query = `table=${input.table}`;
  if (input.activeOnly) query += '^active=true';
  
  const records = await client.getRecords('sys_script_client', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,table,type,script,field,active',
    sysparm_limit: input.limit
  });
  
  return {
    success: true,
    table: input.table,
    count: records.length,
    clientScripts: records
  };
}

export async function createClientScript(client: ServiceNowClient, input: z.infer<typeof createClientScriptSchema>) {
  const data = {
    name: input.name,
    table: input.table,
    script: input.script,
    type: input.type,
    field: input.field || '',
    active: input.active,
    ui_type: 'Desktop'
  };
  
  const record = await client.createRecord('sys_script_client', data);
  
  return {
    success: true,
    message: `Client Script "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    table: input.table,
    type: input.type
  };
}

