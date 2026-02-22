/**
 * Flow Designer Tools
 * Tools for creating and managing Flow Designer artifacts (flows, triggers, action instances, stages)
 * via the ServiceNow REST API on sys_hub_* tables.
 *
 * NOTE: Flows created via REST are draft records. They must be activated/published
 * through the Flow Designer UI to generate the required snapshots.
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ SCHEMAS ============

export const listFlowsSchema = z.object({
  status: z.enum(['draft', 'published', 'all']).optional().default('all'),
  limit: z.number().optional().default(20)
});

export const getFlowSchema = z.object({
  sys_id: z.string().describe('The sys_id of the flow')
});

export const createFlowSchema = z.object({
  name: z.string().describe('Display name of the flow'),
  internal_name: z.string().optional().describe('Internal/programmatic name (auto-generated from name if omitted)'),
  description: z.string().optional().describe('Description of the flow'),
  application: z.string().optional().describe('Scope sys_id (sys_scope.sys_id). Omit for Global scope.'),
  table: z.string().optional().describe('Table the flow operates on (e.g. sc_req_item)')
});

export const createTriggerSchema = z.object({
  flow: z.string().describe('sys_id of the parent flow'),
  trigger_definition: z.string().describe('sys_id of the trigger type definition (e.g. Service Catalog trigger)'),
  trigger_type: z.string().optional().describe('Trigger type string (e.g. "SERVICE_CATALOG")'),
  conditions: z.string().optional().describe('Encoded trigger conditions')
});

export const listActionInstancesSchema = z.object({
  flow: z.string().describe('sys_id of the parent flow'),
  limit: z.number().optional().default(50)
});

export const createActionInstanceSchema = z.object({
  flow: z.string().describe('sys_id of the parent flow'),
  action_type: z.string().describe('Snapshot sys_id of the action type to use (e.g. Create Catalog Task snapshot ID)'),
  order: z.number().optional().describe('Order/position of this action in the flow'),
  stage: z.string().optional().describe('sys_id of the flow stage this action belongs to'),
  name: z.string().optional().describe('Display name/label for this action instance')
});

export const listFlowStagesSchema = z.object({
  flow: z.string().describe('sys_id of the parent flow'),
  limit: z.number().optional().default(20)
});

export const createFlowStageSchema = z.object({
  flow: z.string().describe('sys_id of the parent flow'),
  label: z.string().describe('Display label for the stage'),
  order: z.number().optional().describe('Order/position of this stage in the flow')
});

// ============ IMPLEMENTATIONS ============

export async function listFlows(client: ServiceNowClient, input: z.infer<typeof listFlowsSchema>) {
  let query = '';
  if (input.status && input.status !== 'all') {
    query = `status=${input.status}`;
  }
  query += (query ? '^' : '') + 'ORDERBYDESCsys_created_on';

  const records = await client.getRecords('sys_hub_flow', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,internal_name,description,status,application,table,sys_created_on,sys_updated_on',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    flows: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      internal_name: r.internal_name,
      description: r.description,
      status: r.status,
      application: r.application,
      table: r.table,
      created: r.sys_created_on,
      updated: r.sys_updated_on
    }))
  };
}

export async function getFlow(client: ServiceNowClient, input: z.infer<typeof getFlowSchema>) {
  const record = await client.getRecord('sys_hub_flow', input.sys_id);
  if (!record) {
    return { success: false, error: `Flow not found: ${input.sys_id}` };
  }
  return {
    success: true,
    flow: {
      sys_id: record.sys_id,
      name: record.name,
      internal_name: record.internal_name,
      description: record.description,
      status: record.status,
      application: record.application,
      table: record.table,
      latest_snapshot: record.latest_snapshot,
      master_snapshot: record.master_snapshot,
      created: record.sys_created_on,
      updated: record.sys_updated_on
    }
  };
}

export async function createFlow(client: ServiceNowClient, input: z.infer<typeof createFlowSchema>) {
  const internalName = input.internal_name || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const data: Record<string, unknown> = {
    name: input.name,
    internal_name: internalName,
    description: input.description || '',
    status: 'draft'
  };
  if (input.application) data.application = input.application;
  if (input.table) data.table = input.table;

  const record = await client.createRecord('sys_hub_flow', data);
  return {
    success: true,
    message: `Flow "${input.name}" created as draft. Open in Flow Designer UI to add triggers/actions and activate.`,
    sys_id: record.sys_id,
    name: input.name,
    internal_name: internalName,
    status: 'draft',
    note: 'Draft flows require activation in the Flow Designer UI to generate required snapshots.'
  };
}

export async function createTrigger(client: ServiceNowClient, input: z.infer<typeof createTriggerSchema>) {
  const data: Record<string, unknown> = {
    flow: input.flow,
    trigger_definition: input.trigger_definition
  };
  if (input.trigger_type) data.trigger_type = input.trigger_type;
  if (input.conditions) data.conditions = input.conditions;

  const record = await client.createRecord('sys_hub_trigger_instance', data);
  return {
    success: true,
    message: 'Trigger instance created for flow',
    sys_id: record.sys_id,
    flow: input.flow,
    trigger_definition: input.trigger_definition,
    note: 'Configure trigger conditions in the Flow Designer UI for full functionality.'
  };
}

export async function listActionInstances(client: ServiceNowClient, input: z.infer<typeof listActionInstancesSchema>) {
  const records = await client.getRecords('sys_hub_action_instance', {
    sysparm_query: `flow=${input.flow}^ORDERBYorder`,
    sysparm_fields: 'sys_id,flow,action_type,order,compiled_snapshot,ui_id,sys_created_on',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    actionInstances: records.map(r => ({
      sys_id: r.sys_id,
      flow: r.flow,
      action_type: r.action_type,
      order: r.order,
      compiled_snapshot: r.compiled_snapshot,
      ui_id: r.ui_id,
      created: r.sys_created_on
    }))
  };
}

export async function createActionInstance(client: ServiceNowClient, input: z.infer<typeof createActionInstanceSchema>) {
  const data: Record<string, unknown> = {
    flow: input.flow,
    action_type: input.action_type
  };
  if (input.order !== undefined) data.order = input.order;
  if (input.stage) data.stage = input.stage;
  if (input.name) data.name = input.name;

  const record = await client.createRecord('sys_hub_action_instance', data);
  return {
    success: true,
    message: 'Action instance created in flow',
    sys_id: record.sys_id,
    flow: input.flow,
    action_type: input.action_type,
    order: input.order,
    note: 'Action instances use snapshot IDs for action_type, not definition IDs. Configure inputs in Flow Designer UI.'
  };
}

export async function listFlowStages(client: ServiceNowClient, input: z.infer<typeof listFlowStagesSchema>) {
  const records = await client.getRecords('sys_hub_flow_stage', {
    sysparm_query: `flow=${input.flow}^ORDERBYorder`,
    sysparm_fields: 'sys_id,flow,label,stage_id,order,sys_created_on',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    stages: records.map(r => ({
      sys_id: r.sys_id,
      flow: r.flow,
      label: r.label,
      stage_id: r.stage_id,
      order: r.order,
      created: r.sys_created_on
    }))
  };
}

export async function createFlowStage(client: ServiceNowClient, input: z.infer<typeof createFlowStageSchema>) {
  const data: Record<string, unknown> = {
    flow: input.flow,
    label: input.label
  };
  if (input.order !== undefined) data.order = input.order;

  const record = await client.createRecord('sys_hub_flow_stage', data);
  return {
    success: true,
    message: `Stage "${input.label}" created in flow`,
    sys_id: record.sys_id,
    flow: input.flow,
    label: input.label,
    order: input.order
  };
}

