/**
 * UI Policy and UI Action Tools
 * Tools for managing UI Policies and UI Actions
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ UI POLICIES ============

export const getUiPoliciesSchema = z.object({
  table: z.string().describe('Table name to get UI policies for'),
  activeOnly: z.boolean().optional().default(true),
  limit: z.number().optional().default(50)
});

export const createUiPolicySchema = z.object({
  name: z.string().describe('Short description of the policy'),
  table: z.string().describe('Table the policy applies to'),
  conditions: z.string().optional().describe('Encoded condition string'),
  scriptTrue: z.string().optional().describe('Script to run when condition is true'),
  scriptFalse: z.string().optional().describe('Script to run when condition is false'),
  onLoad: z.boolean().optional().default(true).describe('Run on form load'),
  reverseIfFalse: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true)
});

// ============ UI ACTIONS ============

export const getUiActionsSchema = z.object({
  table: z.string().describe('Table name to get UI actions for'),
  activeOnly: z.boolean().optional().default(true),
  limit: z.number().optional().default(50)
});

export const createUiActionSchema = z.object({
  name: z.string().describe('Name of the UI action'),
  table: z.string().describe('Table the action applies to'),
  script: z.string().describe('Server-side script'),
  clientScript: z.string().optional().describe('Client-side script'),
  actionName: z.string().optional().describe('Action name for client script'),
  formButton: z.boolean().optional().default(true).describe('Show as form button'),
  formLink: z.boolean().optional().default(false).describe('Show as form link'),
  formContextMenu: z.boolean().optional().default(false),
  listButton: z.boolean().optional().default(false),
  listContextMenu: z.boolean().optional().default(false),
  condition: z.string().optional().describe('Condition to show the action'),
  active: z.boolean().optional().default(true)
});

// ============ IMPLEMENTATIONS ============

export async function getUiPolicies(client: ServiceNowClient, input: z.infer<typeof getUiPoliciesSchema>) {
  let query = `table=${input.table}`;
  if (input.activeOnly) query += '^active=true';
  
  const records = await client.getRecords('sys_ui_policy', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,short_description,table,conditions,on_load,reverse_if_false,active,order',
    sysparm_limit: input.limit
  });
  
  return {
    success: true,
    table: input.table,
    count: records.length,
    uiPolicies: records.map(r => ({
      sys_id: r.sys_id,
      name: r.short_description,
      conditions: r.conditions,
      onLoad: r.on_load,
      reverseIfFalse: r.reverse_if_false,
      order: r.order,
      active: r.active
    }))
  };
}

export async function createUiPolicy(client: ServiceNowClient, input: z.infer<typeof createUiPolicySchema>) {
  const data = {
    short_description: input.name,
    table: input.table,
    conditions: input.conditions || '',
    script_true: input.scriptTrue || '',
    script_false: input.scriptFalse || '',
    on_load: input.onLoad,
    reverse_if_false: input.reverseIfFalse,
    active: input.active
  };
  
  const record = await client.createRecord('sys_ui_policy', data);
  
  return {
    success: true,
    message: `UI Policy "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    table: input.table
  };
}

export async function getUiActions(client: ServiceNowClient, input: z.infer<typeof getUiActionsSchema>) {
  let query = `table=${input.table}`;
  if (input.activeOnly) query += '^active=true';
  
  const records = await client.getRecords('sys_ui_action', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,table,action_name,form_button,form_link,list_button,condition,active,order',
    sysparm_limit: input.limit
  });
  
  return {
    success: true,
    table: input.table,
    count: records.length,
    uiActions: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      actionName: r.action_name,
      formButton: r.form_button,
      formLink: r.form_link,
      listButton: r.list_button,
      condition: r.condition,
      order: r.order,
      active: r.active
    }))
  };
}

export async function createUiAction(client: ServiceNowClient, input: z.infer<typeof createUiActionSchema>) {
  const data = {
    name: input.name,
    table: input.table,
    script: input.script,
    client_script: input.clientScript || '',
    action_name: input.actionName || input.name.toLowerCase().replace(/\s+/g, '_'),
    form_button: input.formButton,
    form_link: input.formLink,
    form_context_menu: input.formContextMenu,
    list_button: input.listButton,
    list_context_menu: input.listContextMenu,
    condition: input.condition || '',
    active: input.active
  };
  
  const record = await client.createRecord('sys_ui_action', data);
  
  return {
    success: true,
    message: `UI Action "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    table: input.table
  };
}

