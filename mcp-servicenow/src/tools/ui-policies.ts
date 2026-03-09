/**
 * UI Policy and UI Action Tools
 * Tools for managing UI Policies and UI Actions
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ UI POLICIES ============

// ── Type coercion helpers (AI agents often send strings for booleans/numbers) ──
const coerceOptBool = (def: boolean) =>
  z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v === undefined ? undefined : v),
    z.boolean().optional().default(def)
  );
const coerceOptNum = (def: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && /^\d+$/.test(v) ? parseInt(v, 10) : v),
    z.number().optional().default(def)
  );

export const getUiPoliciesSchema = z.object({
  table: z.string().describe('Table name to get UI policies for'),
  activeOnly: coerceOptBool(true),
  limit: coerceOptNum(50)
});

export const createUiPolicySchema = z.object({
  name: z.string().describe('Short description of the policy'),
  table: z.string().describe('Table the policy applies to'),
  conditions: z.string().optional().describe('Encoded condition string'),
  scriptTrue: z.string().optional().describe('Script to run when condition is true'),
  scriptFalse: z.string().optional().describe('Script to run when condition is false'),
  onLoad: coerceOptBool(true).describe('Run on form load'),
  reverseIfFalse: coerceOptBool(true),
  active: coerceOptBool(true)
});

// ============ UI POLICY ACTIONS ============
// UI Policy Actions define field behaviors when policy triggers (mandatory, visible, disabled)

export const getUiPolicyActionsSchema = z.object({
  uiPolicySysId: z.string().describe('sys_id of the UI Policy to get actions for'),
  limit: z.number().optional().default(50)
});

export const createUiPolicyActionSchema = z.object({
  uiPolicySysId: z.string().describe('sys_id of the parent UI Policy'),
  field: z.string().describe('Field name to apply action to'),
  mandatory: z.enum(['true', 'false', 'ignore']).optional().default('ignore').describe('Make field mandatory'),
  visible: z.enum(['true', 'false', 'ignore']).optional().default('ignore').describe('Make field visible'),
  disabled: z.enum(['true', 'false', 'ignore']).optional().default('ignore').describe('Make field read-only/disabled'),
  value: z.string().optional().describe('Set field value (optional)')
});

// ============ UI ACTIONS ============

export const getUiActionsSchema = z.object({
  table: z.string().describe('Table name to get UI actions for'),
  activeOnly: coerceOptBool(true),
  limit: coerceOptNum(50)
});

export const createUiActionSchema = z.object({
  name: z.string().describe('Name of the UI action'),
  table: z.string().describe('Table the action applies to'),
  script: z.string().describe('Server-side script'),
  clientScript: z.string().optional().describe('Client-side script'),
  actionName: z.string().optional().describe('Action name for client script'),
  formButton: coerceOptBool(true).describe('Show as form button'),
  formLink: coerceOptBool(false).describe('Show as form link'),
  formContextMenu: coerceOptBool(false),
  listButton: coerceOptBool(false),
  listContextMenu: coerceOptBool(false),
  condition: z.string().optional().describe('Condition to show the action'),
  active: coerceOptBool(true)
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

// ============ UI POLICY ACTIONS IMPLEMENTATIONS ============

export async function getUiPolicyActions(client: ServiceNowClient, input: z.infer<typeof getUiPolicyActionsSchema>) {
  const query = `ui_policy=${input.uiPolicySysId}`;

  const records = await client.getRecords('sys_ui_policy_action', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,ui_policy,field,mandatory,visible,disabled,value',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    uiPolicySysId: input.uiPolicySysId,
    count: records.length,
    actions: records.map(r => ({
      sys_id: r.sys_id,
      field: r.field,
      mandatory: r.mandatory,
      visible: r.visible,
      disabled: r.disabled,
      value: r.value
    }))
  };
}

export async function createUiPolicyAction(client: ServiceNowClient, input: z.infer<typeof createUiPolicyActionSchema>) {
  // First, look up the parent UI Policy to get its table
  // This is required because sys_ui_policy_action needs both ui_policy and table fields
  const uiPolicyRecords = await client.getRecords('sys_ui_policy', {
    sysparm_query: `sys_id=${input.uiPolicySysId}`,
    sysparm_fields: 'sys_id,table,short_description',
    sysparm_limit: 1
  });

  if (!uiPolicyRecords || uiPolicyRecords.length === 0) {
    throw new Error(`UI Policy with sys_id "${input.uiPolicySysId}" not found`);
  }

  const uiPolicy = uiPolicyRecords[0];
  const tableName = uiPolicy.table;

  if (!tableName) {
    throw new Error(`UI Policy "${input.uiPolicySysId}" does not have a table specified`);
  }

  // Use the Scripted REST API to create UI Policy Actions
  // This is required because the standard Table API cannot properly set the ui_policy reference field
  // The helper API uses GlideRecord internally which has full access to set all fields

  // Get the API path from the client (set during helper API initialization)
  // Falls back to env var or hardcoded path for backward compatibility
  const helperBasePath = client.getHelperApiPath('uiPolicyActionHelper')
    || process.env.SN_UI_POLICY_ACTION_API_PATH
    || '/api/37610/ui_policy_action_helper';
  const API_PATH = `${helperBasePath}/create`;

  const data: Record<string, unknown> = {
    ui_policy: input.uiPolicySysId,
    table: tableName,
    field: input.field,
    mandatory: input.mandatory || 'ignore',
    visible: input.visible || 'ignore',
    disabled: input.disabled || 'ignore'
  };

  // Only set value if provided
  if (input.value !== undefined) {
    data.value = input.value;
  }

  // Call the Scripted REST API
  const result = await client.callScriptedRestApi<{ success: boolean; sys_id: string; error?: string }>(
    API_PATH,
    'POST',
    data
  );

  if (!result.success) {
    throw new Error(`Failed to create UI Policy Action: ${result.error || 'Unknown error'}`);
  }

  return {
    success: true,
    message: `UI Policy Action for field "${input.field}" created successfully on table "${tableName}"`,
    sys_id: result.sys_id,
    uiPolicySysId: input.uiPolicySysId,
    uiPolicyName: uiPolicy.short_description,
    table: tableName,
    field: input.field,
    mandatory: input.mandatory,
    visible: input.visible,
    disabled: input.disabled
  };
}
