/**
 * Flow Designer Tools
 * Tools for creating and managing Flow Designer artifacts (flows, triggers, action instances, stages)
 * via the ServiceNow REST API on sys_hub_* tables.
 *
 * NOTE: Flows created via REST are draft records. They must be activated/published
 * through the Flow Designer UI to generate the required snapshots.
 *
 * PHASES:
 * - Phase 1: Discovery Tools (action types, triggers, schemas, flow analysis)
 * - Phase 2: Subflow & Custom Action Support
 * - Phase 3: Flow Variables & Action Inputs
 * - Phase 4: Update Set Template System
 * - Phase 5: Flow Execution API
 * - Phase 6: Experimental Activation
 */

import { z } from 'zod';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ServiceNowClient } from '../client/sn-client.js';

// ESM-compatible __dirname
const __filename_esm = fileURLToPath(import.meta.url);
const __dirname_esm = path.dirname(__filename_esm);

// Helper to extract value from ServiceNow reference fields (can be string or {link, value} object)
function extractRefValue(field: unknown): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null && 'value' in field) {
    return (field as { value: string }).value;
  }
  return '';
}

// ============ PHASE 1: DISCOVERY SCHEMAS ============

export const listActionTypesSchema = z.object({
  category: z.string().optional().describe('Filter by category (e.g., "Core", "Service Catalog")'),
  search: z.string().optional().describe('Search by name or label'),
  scope: z.string().optional().describe('Filter by scope (e.g., "global")'),
  limit: z.number().optional().default(50).describe('Maximum results to return')
});

export const listTriggerDefinitionsSchema = z.object({
  type: z.string().optional().describe('Filter by trigger type (e.g., "record", "schedule", "service_catalog")'),
  search: z.string().optional().describe('Search by name or label'),
  limit: z.number().optional().default(30).describe('Maximum results to return')
});

export const getActionTypeSchemaSchema = z.object({
  sys_id: z.string().describe('The sys_id of the action type definition or snapshot')
});

export const analyzeFlowSchema = z.object({
  sys_id: z.string().describe('The sys_id of the flow to analyze'),
  include_action_inputs: z.boolean().optional().default(false).describe('Include action input configurations'),
  include_conditions: z.boolean().optional().default(false).describe('Include trigger and flow logic conditions')
});

// ============ PHASE 2: SUBFLOW & CUSTOM ACTION SCHEMAS ============

export const listSubflowsSchema = z.object({
  status: z.enum(['draft', 'published', 'all']).optional().default('all'),
  search: z.string().optional().describe('Search by name or internal_name'),
  limit: z.number().optional().default(30).describe('Maximum results to return')
});

export const createSubflowSchema = z.object({
  name: z.string().describe('Display name of the subflow'),
  internal_name: z.string().optional().describe('Internal/programmatic name (auto-generated from name if omitted)'),
  description: z.string().optional().describe('Description of the subflow'),
  application: z.string().optional().describe('Scope sys_id. Omit for Global scope.')
});

export const listCustomActionsSchema = z.object({
  scope: z.string().optional().describe('Filter by scope (e.g., "global" or custom scope)'),
  search: z.string().optional().describe('Search by name or label'),
  limit: z.number().optional().default(30).describe('Maximum results to return')
});

export const createCustomActionSchema = z.object({
  name: z.string().describe('Display name of the custom action'),
  label: z.string().describe('Label shown in Flow Designer'),
  internal_name: z.string().optional().describe('Internal/programmatic name'),
  description: z.string().optional().describe('Description of the action'),
  script: z.string().describe('Server-side script that executes when the action runs'),
  application: z.string().optional().describe('Scope sys_id. Omit for Global scope.')
});

export const callSubflowInFlowSchema = z.object({
  flow: z.string().describe('sys_id of the parent flow'),
  subflow: z.string().describe('sys_id of the subflow to call'),
  order: z.number().optional().describe('Position in the flow'),
  stage: z.string().optional().describe('sys_id of the stage this call belongs to'),
  name: z.string().optional().describe('Display name for this subflow call')
});

// ============ PHASE 3: FLOW VARIABLES & ACTION INPUTS SCHEMAS ============

export const listFlowVariablesSchema = z.object({
  flow: z.string().describe('sys_id of the flow'),
  type: z.enum(['input', 'output', 'all']).optional().default('all').describe('Filter by variable type')
});

export const createFlowVariableSchema = z.object({
  flow: z.string().describe('sys_id of the flow'),
  type: z.enum(['input', 'output']).describe('Variable type: input or output'),
  element: z.string().describe('Variable name (internal)'),
  label: z.string().describe('Display label'),
  internal_type: z.string().describe('Data type: string, boolean, reference, integer, etc.'),
  reference: z.string().optional().describe('Table name for reference types'),
  mandatory: z.boolean().optional().default(false).describe('Whether the variable is required'),
  default_value: z.string().optional().describe('Default value')
});

export const listActionInputsSchema = z.object({
  action_instance: z.string().describe('sys_id of the action instance')
});

export const createActionInputSchema = z.object({
  action_instance: z.string().describe('sys_id of the action instance'),
  name: z.string().describe('Name of the input parameter'),
  value: z.string().describe('Value to map (static value, pill reference like "{{trigger.record.field}}", or script)')
});

// ============ PHASE 4: UPDATE SET TEMPLATE SCHEMAS ============

export const exportFlowAsTemplateSchema = z.object({
  flow: z.string().describe('sys_id of the flow to export'),
  include_subflows: z.boolean().optional().default(false).describe('Include referenced subflows')
});

export const listFlowTemplatesSchema = z.object({
  search: z.string().optional().describe('Search by name'),
  status: z.enum(['draft', 'published', 'all']).optional().default('published')
});

export const createFlowFromTemplateSchema = z.object({
  template_flow: z.string().describe('sys_id of the source flow to clone'),
  new_name: z.string().describe('Name for the new flow'),
  new_internal_name: z.string().optional().describe('Internal name (auto-generated if omitted)'),
  description: z.string().optional().describe('Description for the new flow')
});

// ============ PHASE 5: FLOW EXECUTION SCHEMAS ============

export const executeFlowSchema = z.object({
  flow_internal_name: z.string().describe('Internal name of the flow (e.g., "global.my_flow")'),
  inputs: z.record(z.unknown()).optional().describe('Input values as key-value pairs'),
  wait: z.boolean().optional().default(false).describe('Wait for completion and return result')
});

export const getFlowExecutionStatusSchema = z.object({
  context_id: z.string().describe('Flow execution context sys_id')
});

export const listFlowExecutionsSchema = z.object({
  flow: z.string().optional().describe('Filter by flow sys_id'),
  status: z.string().optional().describe('Filter by status: running, completed, error'),
  limit: z.number().optional().default(20)
});

// ============ EXISTING SCHEMAS ============

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
  if (input.application) data.sys_scope = input.application;
  if (input.table) data.table = input.table;

  const record = await client.createRecord('sys_hub_flow', data);
  return {
    success: true,
    message: `Flow "${input.name}" created as draft in scope ${input.application || 'Global'}. Open in Flow Designer UI to add triggers/actions and activate.`,
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

// ============ PHASE 1: DISCOVERY IMPLEMENTATIONS ============

/**
 * List available action types (Lookup Record, Create Task, etc.) with their snapshot IDs.
 * Use the returned snapshot_id in sn_create_flow_action_instance, NOT the definition sys_id.
 */
export async function listActionTypes(client: ServiceNowClient, input: z.infer<typeof listActionTypesSchema>) {
  let query = 'active=true';

  if (input.category) {
    query += `^categoryLIKE${input.category}`;
  }
  if (input.search) {
    query += `^nameLIKE${input.search}^ORlabelLIKE${input.search}^ORinternal_nameLIKE${input.search}`;
  }
  if (input.scope) {
    query += `^sys_scope.scope=${input.scope}`;
  }
  query += '^ORDERBYlabel';

  // Query action type definitions
  const definitions = await client.getRecords('sys_hub_action_type_definition', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,label,internal_name,category,description,sys_scope',
    sysparm_limit: input.limit
  });

  // For each definition, try to find its snapshot ID in sys_hub_action_type_base
  const actionTypes = await Promise.all(definitions.map(async (def) => {
    // Query for snapshot by matching internal_name
    let snapshotId = '';
    try {
      const snapshots = await client.getRecords('sys_hub_action_type_base', {
        sysparm_query: `internal_name=${def.internal_name}`,
        sysparm_fields: 'sys_id',
        sysparm_limit: 1
      });
      if (snapshots.length > 0) {
        snapshotId = snapshots[0].sys_id;
      }
    } catch {
      // Snapshot lookup failed, continue without it
    }

    return {
      definition_sys_id: def.sys_id,
      snapshot_sys_id: snapshotId || def.sys_id, // Fallback to definition ID if no snapshot found
      name: def.name,
      label: def.label,
      internal_name: def.internal_name,
      category: def.category,
      description: def.description,
      scope: extractRefValue(def.sys_scope)
    };
  }));

  return {
    success: true,
    count: actionTypes.length,
    note: 'Use snapshot_sys_id in sn_create_flow_action_instance, not definition_sys_id',
    actionTypes
  };
}

/**
 * List available trigger definitions (Record, Schedule, Service Catalog, etc.).
 * Use the returned sys_id in sn_create_flow_trigger.
 */
export async function listTriggerDefinitions(client: ServiceNowClient, input: z.infer<typeof listTriggerDefinitionsSchema>) {
  let query = 'active=true';

  if (input.type) {
    query += `^trigger_typeLIKE${input.type}^ORinternal_nameLIKE${input.type}`;
  }
  if (input.search) {
    query += `^nameLIKE${input.search}^ORlabelLIKE${input.search}`;
  }
  query += '^ORDERBYlabel';

  const records = await client.getRecords('sys_hub_trigger_definition', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,label,internal_name,trigger_type,description,sys_scope',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    note: 'Use sys_id in sn_create_flow_trigger as trigger_definition',
    triggerDefinitions: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      label: r.label,
      internal_name: r.internal_name,
      trigger_type: r.trigger_type,
      description: r.description,
      scope: extractRefValue(r.sys_scope)
    }))
  };
}

/**
 * Get the input/output schema for a specific action type.
 * Helps understand what parameters an action expects.
 */
export async function getActionTypeSchema(client: ServiceNowClient, input: z.infer<typeof getActionTypeSchemaSchema>) {
  // Try to get the action type record
  const actionType = await client.getRecord('sys_hub_action_type_definition', input.sys_id);

  if (!actionType) {
    // Try sys_hub_action_type_base (snapshot table)
    const snapshot = await client.getRecord('sys_hub_action_type_base', input.sys_id);
    if (!snapshot) {
      return { success: false, error: `Action type not found: ${input.sys_id}` };
    }
    return {
      success: true,
      source: 'sys_hub_action_type_base',
      actionType: {
        sys_id: snapshot.sys_id,
        name: snapshot.name,
        label: snapshot.label,
        internal_name: snapshot.internal_name,
        note: 'This is a snapshot record. Input/output details may require querying the definition.'
      }
    };
  }

  // Query for action inputs (parameters)
  const inputs = await client.getRecords('sys_hub_action_type_input', {
    sysparm_query: `model=${input.sys_id}^ORDERBYorder`,
    sysparm_fields: 'sys_id,element,label,internal_type,mandatory,default_value,reference,help'
  });

  // Query for action outputs
  const outputs = await client.getRecords('sys_hub_action_type_output', {
    sysparm_query: `model=${input.sys_id}^ORDERBYorder`,
    sysparm_fields: 'sys_id,element,label,internal_type,reference'
  });

  return {
    success: true,
    source: 'sys_hub_action_type_definition',
    actionType: {
      sys_id: actionType.sys_id,
      name: actionType.name,
      label: actionType.label,
      internal_name: actionType.internal_name,
      category: actionType.category,
      description: actionType.description,
      inputs: inputs.map(i => ({
        name: i.element,
        label: i.label,
        type: i.internal_type,
        mandatory: i.mandatory === 'true' || i.mandatory === true,
        default_value: i.default_value,
        reference_table: i.reference,
        help: i.help
      })),
      outputs: outputs.map(o => ({
        name: o.element,
        label: o.label,
        type: o.internal_type,
        reference_table: o.reference
      }))
    }
  };
}

/**
 * Analyze a flow's complete structure including triggers, actions, stages, and variables.
 * Useful for understanding existing flows or debugging issues.
 */
export async function analyzeFlow(client: ServiceNowClient, input: z.infer<typeof analyzeFlowSchema>) {
  // Get flow record
  const flow = await client.getRecord('sys_hub_flow', input.sys_id);
  if (!flow) {
    return { success: false, error: `Flow not found: ${input.sys_id}` };
  }

  // Get trigger instances
  const triggers = await client.getRecords('sys_hub_trigger_instance', {
    sysparm_query: `flow=${input.sys_id}`,
    sysparm_fields: 'sys_id,name,trigger_type,trigger_definition,conditions'
  });

  // Get action instances
  const actions = await client.getRecords('sys_hub_action_instance', {
    sysparm_query: `flow=${input.sys_id}^ORDERBYorder`,
    sysparm_fields: 'sys_id,name,action_type,compiled_snapshot,order,ui_id,parent_ui_id,stage'
  });

  // Get stages
  const stages = await client.getRecords('sys_hub_flow_stage', {
    sysparm_query: `flow=${input.sys_id}^ORDERBYorder`,
    sysparm_fields: 'sys_id,label,stage_id,order,states'
  });

  // Get flow inputs (variables)
  const flowInputs = await client.getRecords('sys_hub_flow_input', {
    sysparm_query: `model=${input.sys_id}`,
    sysparm_fields: 'sys_id,element,label,internal_type,mandatory,default_value,reference'
  });

  // Get flow outputs
  const flowOutputs = await client.getRecords('sys_hub_flow_output', {
    sysparm_query: `model=${input.sys_id}`,
    sysparm_fields: 'sys_id,element,label,internal_type,reference'
  });

  // Optionally get action inputs for each action
  let actionInputsMap: Record<string, unknown[]> = {};
  if (input.include_action_inputs && actions.length > 0) {
    for (const action of actions) {
      const actionInputs = await client.getRecords('sys_hub_action_input', {
        sysparm_query: `action_instance=${action.sys_id}`,
        sysparm_fields: 'sys_id,name,value,order'
      });
      actionInputsMap[action.sys_id] = actionInputs;
    }
  }

  return {
    success: true,
    analysis: {
      flow: {
        sys_id: flow.sys_id,
        name: flow.name,
        internal_name: flow.internal_name,
        status: flow.status,
        has_snapshots: !!(flow.latest_snapshot && flow.master_snapshot),
        latest_snapshot: flow.latest_snapshot,
        master_snapshot: flow.master_snapshot,
        table: flow.table,
        description: flow.description
      },
      triggers: triggers.map(t => ({
        sys_id: t.sys_id,
        name: t.name,
        trigger_type: t.trigger_type,
        trigger_definition: extractRefValue(t.trigger_definition),
        has_conditions: !!t.conditions
      })),
      actions: actions.map(a => ({
        sys_id: a.sys_id,
        name: a.name,
        action_type: extractRefValue(a.action_type),
        compiled_snapshot: a.compiled_snapshot,
        order: a.order,
        ui_id: a.ui_id,
        parent_ui_id: a.parent_ui_id,
        stage: extractRefValue(a.stage),
        inputs: input.include_action_inputs ? actionInputsMap[a.sys_id] : undefined
      })),
      stages: stages.map(s => ({
        sys_id: s.sys_id,
        label: s.label,
        stage_id: s.stage_id,
        order: s.order
      })),
      flowInputs: flowInputs.map(i => ({
        sys_id: i.sys_id,
        name: i.element,
        label: i.label,
        type: i.internal_type,
        mandatory: i.mandatory === 'true' || i.mandatory === true,
        default_value: i.default_value,
        reference_table: i.reference
      })),
      flowOutputs: flowOutputs.map(o => ({
        sys_id: o.sys_id,
        name: o.element,
        label: o.label,
        type: o.internal_type,
        reference_table: o.reference
      })),
      summary: {
        trigger_count: triggers.length,
        action_count: actions.length,
        stage_count: stages.length,
        input_count: flowInputs.length,
        output_count: flowOutputs.length,
        is_executable: !!(flow.latest_snapshot && flow.master_snapshot && flow.status === 'published')
      }
    }
  };
}

// ============ PHASE 2: SUBFLOW & CUSTOM ACTION IMPLEMENTATIONS ============

/**
 * List available subflows on the instance.
 * Subflows are reusable flows that can be called from other flows.
 */
export async function listSubflows(client: ServiceNowClient, input: z.infer<typeof listSubflowsSchema>) {
  let query = "type=subflow";

  if (input.status && input.status !== 'all') {
    query += `^status=${input.status}`;
  }
  if (input.search) {
    query += `^nameLIKE${input.search}^ORinternal_nameLIKE${input.search}`;
  }
  query += '^ORDERBYname';

  const records = await client.getRecords('sys_hub_flow', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,internal_name,description,status,application,sys_scope,sys_created_on',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    subflows: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      internal_name: r.internal_name,
      description: r.description,
      status: r.status,
      application: extractRefValue(r.application),
      scope: extractRefValue(r.sys_scope),
      created: r.sys_created_on
    }))
  };
}

/**
 * Create a new subflow (as draft). Subflows must be activated in the Flow Designer UI.
 */
export async function createSubflow(client: ServiceNowClient, input: z.infer<typeof createSubflowSchema>) {
  const internalName = input.internal_name || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  const data: Record<string, unknown> = {
    name: input.name,
    internal_name: internalName,
    description: input.description || '',
    type: 'subflow',
    status: 'draft'
  };
  if (input.application) data.sys_scope = input.application;

  const record = await client.createRecord('sys_hub_flow', data);
  return {
    success: true,
    message: `Subflow "${input.name}" created as draft in scope ${input.application || 'Global'}. Open in Flow Designer UI to add inputs/outputs, actions, and activate.`,
    sys_id: record.sys_id,
    name: input.name,
    internal_name: internalName,
    status: 'draft',
    note: 'Draft subflows require activation in Flow Designer UI to be callable from other flows.'
  };
}

/**
 * List custom actions (non-OOTB action type definitions).
 */
export async function listCustomActions(client: ServiceNowClient, input: z.infer<typeof listCustomActionsSchema>) {
  // Custom actions are user-created action type definitions
  let query = 'sys_class_name=sys_hub_action_type_definition';

  if (input.scope) {
    query += `^sys_scope.scope=${input.scope}`;
  }
  if (input.search) {
    query += `^nameLIKE${input.search}^ORlabelLIKE${input.search}`;
  }
  query += '^ORDERBYlabel';

  const records = await client.getRecords('sys_hub_action_type_definition', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,label,internal_name,description,category,sys_scope,sys_created_on',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    customActions: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      label: r.label,
      internal_name: r.internal_name,
      description: r.description,
      category: r.category,
      scope: extractRefValue(r.sys_scope),
      created: r.sys_created_on
    }))
  };
}

/**
 * Create a custom action type definition (as draft).
 * Custom actions encapsulate reusable server-side logic.
 */
export async function createCustomAction(client: ServiceNowClient, input: z.infer<typeof createCustomActionSchema>) {
  const internalName = input.internal_name || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  const data: Record<string, unknown> = {
    name: input.name,
    label: input.label,
    internal_name: internalName,
    description: input.description || '',
    script: input.script,
    active: true
  };
  if (input.application) data.sys_scope = input.application;

  const record = await client.createRecord('sys_hub_action_type_definition', data);
  return {
    success: true,
    message: `Custom action "${input.name}" created. Configure inputs/outputs and test in Flow Designer.`,
    sys_id: record.sys_id,
    name: input.name,
    label: input.label,
    internal_name: internalName,
    note: 'Add input/output definitions using sys_hub_action_type_input and sys_hub_action_type_output tables. Publish to make available in flows.'
  };
}

/**
 * Add a subflow call as an action step within a flow.
 * This creates an action instance that invokes a subflow.
 */
export async function callSubflowInFlow(client: ServiceNowClient, input: z.infer<typeof callSubflowInFlowSchema>) {
  // First, verify the subflow exists and get its internal_name
  const subflow = await client.getRecord('sys_hub_flow', input.subflow);
  if (!subflow) {
    return { success: false, error: `Subflow not found: ${input.subflow}` };
  }
  if (subflow.type !== 'subflow') {
    return { success: false, error: `Record ${input.subflow} is not a subflow (type: ${subflow.type})` };
  }

  // For subflow calls, we need to find or create a reference to the subflow as an action type
  // In ServiceNow, subflows are invoked through a special action type
  // The action_type should reference the subflow's snapshot or a wrapper

  // Try to find an existing subflow action type snapshot
  let actionTypeId = '';
  try {
    const snapshots = await client.getRecords('sys_hub_action_type_base', {
      sysparm_query: `internal_name=${subflow.internal_name}`,
      sysparm_fields: 'sys_id',
      sysparm_limit: 1
    });
    if (snapshots.length > 0) {
      actionTypeId = snapshots[0].sys_id;
    }
  } catch {
    // Snapshot not found, use the subflow's sys_id directly
  }

  // If no action type found, we'll use the subflow sys_id (may need UI configuration)
  if (!actionTypeId) {
    actionTypeId = input.subflow;
  }

  const data: Record<string, unknown> = {
    flow: input.flow,
    action_type: actionTypeId,
    name: input.name || `Call ${subflow.name}`
  };
  if (input.order !== undefined) data.order = input.order;
  if (input.stage) data.stage = input.stage;

  const record = await client.createRecord('sys_hub_action_instance', data);
  return {
    success: true,
    message: `Subflow call added to flow`,
    sys_id: record.sys_id,
    flow: input.flow,
    subflow: input.subflow,
    subflow_name: subflow.name,
    order: input.order,
    note: 'Configure subflow input mappings in Flow Designer UI. Subflow must be published to execute.'
  };
}

// ============ PHASE 3: FLOW VARIABLES & ACTION INPUTS IMPLEMENTATIONS ============

/**
 * List flow input and/or output variables.
 */
export async function listFlowVariables(client: ServiceNowClient, input: z.infer<typeof listFlowVariablesSchema>) {
  const results: {
    inputs: unknown[];
    outputs: unknown[];
  } = { inputs: [], outputs: [] };

  if (input.type === 'input' || input.type === 'all') {
    const inputs = await client.getRecords('sys_hub_flow_input', {
      sysparm_query: `model=${input.flow}^ORDERBYorder`,
      sysparm_fields: 'sys_id,element,label,internal_type,mandatory,default_value,reference,help,active'
    });
    results.inputs = inputs.map(i => ({
      sys_id: i.sys_id,
      name: i.element,
      label: i.label,
      type: i.internal_type,
      mandatory: i.mandatory === 'true' || i.mandatory === true,
      default_value: i.default_value,
      reference_table: i.reference,
      help: i.help,
      active: i.active === 'true' || i.active === true
    }));
  }

  if (input.type === 'output' || input.type === 'all') {
    const outputs = await client.getRecords('sys_hub_flow_output', {
      sysparm_query: `model=${input.flow}^ORDERBYorder`,
      sysparm_fields: 'sys_id,element,label,internal_type,reference,active'
    });
    results.outputs = outputs.map(o => ({
      sys_id: o.sys_id,
      name: o.element,
      label: o.label,
      type: o.internal_type,
      reference_table: o.reference,
      active: o.active === 'true' || o.active === true
    }));
  }

  return {
    success: true,
    flow: input.flow,
    input_count: results.inputs.length,
    output_count: results.outputs.length,
    ...results
  };
}

/**
 * Create a flow input or output variable.
 * Flow inputs define parameters the flow accepts; outputs define what it returns.
 */
export async function createFlowVariable(client: ServiceNowClient, input: z.infer<typeof createFlowVariableSchema>) {
  const table = input.type === 'input' ? 'sys_hub_flow_input' : 'sys_hub_flow_output';

  const data: Record<string, unknown> = {
    model: input.flow,
    element: input.element,
    label: input.label,
    internal_type: input.internal_type,
    active: true
  };

  if (input.reference) data.reference = input.reference;
  if (input.type === 'input') {
    data.mandatory = input.mandatory || false;
    if (input.default_value) data.default_value = input.default_value;
  }

  const record = await client.createRecord(table, data);
  return {
    success: true,
    message: `Flow ${input.type} variable "${input.element}" created`,
    sys_id: record.sys_id,
    flow: input.flow,
    type: input.type,
    name: input.element,
    label: input.label,
    data_type: input.internal_type,
    note: `Variable added to flow. Access via pill data path: {{flow.${input.element}}}`
  };
}

/**
 * List input mappings for an action instance.
 * Shows how data is passed to an action's input parameters.
 */
export async function listActionInputs(client: ServiceNowClient, input: z.infer<typeof listActionInputsSchema>) {
  const records = await client.getRecords('sys_hub_action_input', {
    sysparm_query: `action_instance=${input.action_instance}^ORDERBYorder`,
    sysparm_fields: 'sys_id,name,value,order'
  });

  return {
    success: true,
    action_instance: input.action_instance,
    count: records.length,
    inputs: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      value: r.value,
      order: r.order
    }))
  };
}

/**
 * Create or configure an action instance input mapping.
 * Maps a value (static, pill reference, or script) to an action's input parameter.
 */
export async function createActionInput(client: ServiceNowClient, input: z.infer<typeof createActionInputSchema>) {
  // Check if an input with this name already exists for the action instance
  const existing = await client.getRecords('sys_hub_action_input', {
    sysparm_query: `action_instance=${input.action_instance}^name=${input.name}`,
    sysparm_limit: 1
  });

  let record;
  if (existing.length > 0) {
    // Update existing input
    record = await client.updateRecord('sys_hub_action_input', existing[0].sys_id, {
      value: input.value
    });
    return {
      success: true,
      message: `Action input "${input.name}" updated`,
      sys_id: record.sys_id,
      action_instance: input.action_instance,
      name: input.name,
      value: input.value,
      action: 'updated'
    };
  } else {
    // Create new input
    record = await client.createRecord('sys_hub_action_input', {
      action_instance: input.action_instance,
      name: input.name,
      value: input.value
    });
    return {
      success: true,
      message: `Action input "${input.name}" created`,
      sys_id: record.sys_id,
      action_instance: input.action_instance,
      name: input.name,
      value: input.value,
      action: 'created',
      note: 'Value can be static text, a pill reference like "{{trigger.record.field}}", or a script expression.'
    };
  }
}

// ============ PHASE 4: UPDATE SET TEMPLATE IMPLEMENTATIONS ============

/**
 * Export a flow's complete structure as a template for cloning.
 * Returns all related records that can be used to recreate the flow.
 */
export async function exportFlowAsTemplate(client: ServiceNowClient, input: z.infer<typeof exportFlowAsTemplateSchema>) {
  // Get flow record
  const flow = await client.getRecord('sys_hub_flow', input.flow);
  if (!flow) {
    return { success: false, error: `Flow not found: ${input.flow}` };
  }

  // Get all related records
  const [triggers, actions, stages, flowInputs, flowOutputs] = await Promise.all([
    client.getRecords('sys_hub_trigger_instance', {
      sysparm_query: `flow=${input.flow}`,
      sysparm_fields: 'sys_id,name,trigger_type,trigger_definition,conditions,trigger_inputs,trigger_outputs'
    }),
    client.getRecords('sys_hub_action_instance', {
      sysparm_query: `flow=${input.flow}^ORDERBYorder`,
      sysparm_fields: 'sys_id,name,action_type,compiled_snapshot,order,ui_id,parent_ui_id,stage,action_inputs,attributes'
    }),
    client.getRecords('sys_hub_flow_stage', {
      sysparm_query: `flow=${input.flow}^ORDERBYorder`,
      sysparm_fields: 'sys_id,label,stage_id,order,states,type'
    }),
    client.getRecords('sys_hub_flow_input', {
      sysparm_query: `model=${input.flow}`,
      sysparm_fields: 'sys_id,element,label,internal_type,mandatory,default_value,reference,help,order'
    }),
    client.getRecords('sys_hub_flow_output', {
      sysparm_query: `model=${input.flow}`,
      sysparm_fields: 'sys_id,element,label,internal_type,reference,order'
    })
  ]);

  // Get action inputs for each action
  const actionInputsMap: Record<string, unknown[]> = {};
  for (const action of actions) {
    const inputs = await client.getRecords('sys_hub_action_input', {
      sysparm_query: `action_instance=${action.sys_id}`,
      sysparm_fields: 'sys_id,name,value,order'
    });
    actionInputsMap[action.sys_id] = inputs;
  }

  return {
    success: true,
    template: {
      flow: {
        name: flow.name,
        internal_name: flow.internal_name,
        description: flow.description,
        status: flow.status,
        type: flow.type,
        table: flow.table,
        has_snapshots: !!(flow.latest_snapshot && flow.master_snapshot)
      },
      triggers: triggers.map(t => ({
        name: t.name,
        trigger_type: t.trigger_type,
        trigger_definition: extractRefValue(t.trigger_definition),
        conditions: t.conditions
      })),
      actions: actions.map(a => ({
        name: a.name,
        action_type: extractRefValue(a.action_type),
        compiled_snapshot: a.compiled_snapshot,
        order: a.order,
        ui_id: a.ui_id,
        parent_ui_id: a.parent_ui_id,
        stage_order: stages.find(s => s.sys_id === extractRefValue(a.stage))?.order,
        inputs: actionInputsMap[a.sys_id]
      })),
      stages: stages.map(s => ({
        label: s.label,
        stage_id: s.stage_id,
        order: s.order,
        type: s.type
      })),
      flowInputs: flowInputs.map(i => ({
        element: i.element,
        label: i.label,
        internal_type: i.internal_type,
        mandatory: i.mandatory,
        default_value: i.default_value,
        reference: i.reference,
        order: i.order
      })),
      flowOutputs: flowOutputs.map(o => ({
        element: o.element,
        label: o.label,
        internal_type: o.internal_type,
        reference: o.reference,
        order: o.order
      }))
    },
    note: flow.status === 'published'
      ? 'This flow is published. Cloning via update set import would preserve snapshots.'
      : 'This flow is draft. Clones will also be draft and require UI activation.'
  };
}

/**
 * List flows that can be used as templates (typically published flows).
 */
export async function listFlowTemplates(client: ServiceNowClient, input: z.infer<typeof listFlowTemplatesSchema>) {
  let query = 'type=flow';
  if (input.status && input.status !== 'all') {
    query += `^status=${input.status}`;
  }
  if (input.search) {
    query += `^nameLIKE${input.search}`;
  }
  query += '^ORDERBYname';

  const records = await client.getRecords('sys_hub_flow', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,internal_name,description,status,table,latest_snapshot,master_snapshot',
    sysparm_limit: 50
  });

  return {
    success: true,
    count: records.length,
    templates: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      internal_name: r.internal_name,
      description: r.description,
      status: r.status,
      table: r.table,
      has_snapshots: !!(r.latest_snapshot && r.master_snapshot),
      can_clone_published: r.status === 'published' && !!(r.latest_snapshot && r.master_snapshot)
    })),
    note: 'Flows with has_snapshots=true can be cloned via update set to preserve published state.'
  };
}

/**
 * Create a new flow by cloning an existing flow's structure.
 * Creates a draft flow with the same triggers, actions, stages, and variables.
 * NOTE: This creates a draft. For published clones, use update set export/import.
 */
export async function createFlowFromTemplate(client: ServiceNowClient, input: z.infer<typeof createFlowFromTemplateSchema>) {
  // Get the template flow
  const template = await client.getRecord('sys_hub_flow', input.template_flow);
  if (!template) {
    return { success: false, error: `Template flow not found: ${input.template_flow}` };
  }

  const newInternalName = input.new_internal_name || input.new_name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  // Create new flow — inherit scope from template
  const newFlow = await client.createRecord('sys_hub_flow', {
    name: input.new_name,
    internal_name: newInternalName,
    description: input.description || template.description || '',
    type: template.type,
    table: template.table,
    status: 'draft',
    ...(template.sys_scope ? { sys_scope: template.sys_scope } : {})
  });

  const newFlowId = newFlow.sys_id;
  const results = {
    triggers_created: 0,
    actions_created: 0,
    stages_created: 0,
    inputs_created: 0,
    outputs_created: 0
  };

  // Clone stages first (actions may reference them)
  const templateStages = await client.getRecords('sys_hub_flow_stage', {
    sysparm_query: `flow=${input.template_flow}^ORDERBYorder`
  });
  const stageMapping: Record<string, string> = {};
  for (const stage of templateStages) {
    const newStage = await client.createRecord('sys_hub_flow_stage', {
      flow: newFlowId,
      label: stage.label,
      order: stage.order,
      type: stage.type,
      states: stage.states
    });
    stageMapping[stage.sys_id] = newStage.sys_id;
    results.stages_created++;
  }

  // Clone triggers
  const templateTriggers = await client.getRecords('sys_hub_trigger_instance', {
    sysparm_query: `flow=${input.template_flow}`
  });
  for (const trigger of templateTriggers) {
    await client.createRecord('sys_hub_trigger_instance', {
      flow: newFlowId,
      name: trigger.name,
      trigger_type: trigger.trigger_type,
      trigger_definition: extractRefValue(trigger.trigger_definition),
      conditions: trigger.conditions
    });
    results.triggers_created++;
  }

  // Clone flow inputs
  const templateInputs = await client.getRecords('sys_hub_flow_input', {
    sysparm_query: `model=${input.template_flow}`
  });
  for (const inp of templateInputs) {
    await client.createRecord('sys_hub_flow_input', {
      model: newFlowId,
      element: inp.element,
      label: inp.label,
      internal_type: inp.internal_type,
      mandatory: inp.mandatory,
      default_value: inp.default_value,
      reference: inp.reference,
      order: inp.order
    });
    results.inputs_created++;
  }

  // Clone flow outputs
  const templateOutputs = await client.getRecords('sys_hub_flow_output', {
    sysparm_query: `model=${input.template_flow}`
  });
  for (const out of templateOutputs) {
    await client.createRecord('sys_hub_flow_output', {
      model: newFlowId,
      element: out.element,
      label: out.label,
      internal_type: out.internal_type,
      reference: out.reference,
      order: out.order
    });
    results.outputs_created++;
  }

  // Clone actions
  const templateActions = await client.getRecords('sys_hub_action_instance', {
    sysparm_query: `flow=${input.template_flow}^ORDERBYorder`
  });
  const actionMapping: Record<string, string> = {};
  for (const action of templateActions) {
    const stageRef = extractRefValue(action.stage);
    const newAction = await client.createRecord('sys_hub_action_instance', {
      flow: newFlowId,
      name: action.name,
      action_type: extractRefValue(action.action_type),
      compiled_snapshot: action.compiled_snapshot,
      order: action.order,
      ui_id: action.ui_id, // Preserve UI ID for internal references
      parent_ui_id: action.parent_ui_id,
      stage: stageRef ? stageMapping[stageRef] : undefined
    });
    actionMapping[action.sys_id] = newAction.sys_id;
    results.actions_created++;

    // Clone action inputs
    const actionInputs = await client.getRecords('sys_hub_action_input', {
      sysparm_query: `action_instance=${action.sys_id}`
    });
    for (const ai of actionInputs) {
      await client.createRecord('sys_hub_action_input', {
        action_instance: newAction.sys_id,
        name: ai.name,
        value: ai.value,
        order: ai.order
      });
    }
  }

  return {
    success: true,
    message: `Flow "${input.new_name}" created from template "${template.name}"`,
    new_flow: {
      sys_id: newFlowId,
      name: input.new_name,
      internal_name: newInternalName,
      status: 'draft'
    },
    cloned: results,
    note: 'Flow created as draft. Open in Flow Designer UI to verify configuration and activate.'
  };
}

// ============ PHASE 5: FLOW EXECUTION IMPLEMENTATIONS ============

/**
 * Execute a published flow.
 * NOTE: Requires a Scripted REST API endpoint on the instance that wraps sn_fd.FlowAPI.
 * This is a template - actual implementation depends on instance configuration.
 */
export async function executeFlow(client: ServiceNowClient, input: z.infer<typeof executeFlowSchema>) {
  // This requires a custom Scripted REST API on the instance
  // The API should call: sn_fd.FlowAPI.getRunner(flowInternalName).run(inputs)

  // For now, we'll check if the flow exists and provide guidance
  const flows = await client.getRecords('sys_hub_flow', {
    sysparm_query: `internal_name=${input.flow_internal_name}^status=published`,
    sysparm_limit: 1
  });

  if (flows.length === 0) {
    return {
      success: false,
      error: `Published flow not found with internal_name: ${input.flow_internal_name}`,
      note: 'Ensure the flow is published. Use sn_list_flows to find available flows.'
    };
  }

  const flow = flows[0];

  // Check if flow has snapshots (required for execution)
  if (!flow.latest_snapshot || !flow.master_snapshot) {
    return {
      success: false,
      error: 'Flow is not executable - missing snapshots',
      note: 'Activate the flow in Flow Designer UI to generate required snapshots.'
    };
  }

  return {
    success: true,
    message: 'Flow is ready for execution',
    flow: {
      sys_id: flow.sys_id,
      name: flow.name,
      internal_name: flow.internal_name,
      status: flow.status
    },
    inputs: input.inputs || {},
    execution_guide: {
      method_1: 'Use a Background Script with: sn_fd.FlowAPI.getRunner("' + input.flow_internal_name + '").run(' + JSON.stringify(input.inputs || {}) + ')',
      method_2: 'Create a Scripted REST API endpoint that exposes FlowAPI, then call it via this tool',
      method_3: 'Use the Flow Designer UI to test the flow manually'
    },
    note: 'Direct flow execution via REST API is not supported by ServiceNow. Use one of the methods above.'
  };
}

/**
 * Get the execution status of a flow context.
 */
export async function getFlowExecutionStatus(client: ServiceNowClient, input: z.infer<typeof getFlowExecutionStatusSchema>) {
  const context = await client.getRecord('sys_hub_flow_context', input.context_id);

  if (!context) {
    return { success: false, error: `Flow context not found: ${input.context_id}` };
  }

  return {
    success: true,
    context: {
      sys_id: context.sys_id,
      flow: extractRefValue(context.flow),
      state: context.state,
      stage: context.stage,
      started: context.sys_created_on,
      updated: context.sys_updated_on,
      error: context.error_message
    }
  };
}

/**
 * List recent flow executions.
 */
export async function listFlowExecutions(client: ServiceNowClient, input: z.infer<typeof listFlowExecutionsSchema>) {
  let query = 'ORDERBYDESCsys_created_on';

  if (input.flow) {
    query = `flow=${input.flow}^` + query;
  }
  if (input.status) {
    query = `state=${input.status}^` + query;
  }

  const records = await client.getRecords('sys_hub_flow_context', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,flow,state,stage,sys_created_on,sys_updated_on,error_message',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    executions: records.map(r => ({
      context_id: r.sys_id,
      flow: extractRefValue(r.flow),
      state: r.state,
      stage: r.stage,
      started: r.sys_created_on,
      updated: r.sys_updated_on,
      has_error: !!r.error_message
    }))
  };
}

// ═══════════════════════════════════════════════════════════════
// SDK Fluent Deployment Tool
// ═══════════════════════════════════════════════════════════════

export const deploySDKFlowSchema = z.object({
  /** The complete .now.ts fluent code */
  code: z.string().describe('The complete SDK fluent .now.ts code for the flow'),
  /** The complete generated/keys.ts content declaring Now.ID keys for this flow */
  keysTs: z.string().describe('The generated/keys.ts content with Now.ID key declarations for this flow'),
  /** Filename (e.g. "AutoCloseStaleIncidents.now.ts") */
  fileName: z.string().describe('Filename for the .now.ts file (e.g. "MyFlow.now.ts")'),
  /** ServiceNow scope (e.g. "x_snc_yantra") */
  scope: z.string().describe('Scoped app scope string (e.g. "x_snc_yantra")'),
  /** sys_id of the scoped application */
  scopeId: z.string().describe('sys_id of the scoped application record'),
  /** Deprecated safety valve — reinstall is no longer allowed in this deploy path */
  reinstall: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean()
  ).optional().default(false).describe(
    'Unsupported in this deploy mode. Must be omitted or false. ' +
    'SDK flow deployment now always uses normal incremental install to avoid overwriting other flows.'
  ),
});

// ── Registry helpers ──────────────────────────────────────────────────────

interface RegistryEntry {
  flowSysId: string;
  fileName: string;
  flowDisplayName?: string;
  scope: string;
  scopeId: string;
  instanceUrl: string;
  deployedAt: string;
  status: 'deployed' | 'undeployed';
  artifactIds: { flow: string; triggers: string[]; actions: string[] };
}

interface Registry {
  version: number;
  description: string;
  flows: Record<string, RegistryEntry>;
}

function getRegistryPath(sdkFlowsDir: string): string {
  return path.join(sdkFlowsDir, 'registry.json');
}

function readRegistry(sdkFlowsDir: string): Registry {
  const regPath = getRegistryPath(sdkFlowsDir);
  if (!existsSync(regPath)) {
    return { version: 1, description: 'Tracks all SDK-deployed flows.', flows: {} };
  }
  return JSON.parse(readFileSync(regPath, 'utf-8'));
}

function writeRegistry(sdkFlowsDir: string, registry: Registry): void {
  writeFileSync(getRegistryPath(sdkFlowsDir), JSON.stringify(registry, null, 2) + '\n', 'utf-8');
}

interface ParsedKeyEntry {
  key: string;
  table: string;
  id: string;
}

function getAppWorkspaceDir(sdkFlowsDir: string, scope: string): string {
  return path.join(sdkFlowsDir, 'apps', scope);
}

function getFlowSourcePath(appDir: string, safeFileName: string): string {
  return path.join(appDir, 'src', 'fluent', safeFileName);
}

function getKeysFragmentsDir(appDir: string): string {
  return path.join(appDir, 'keys');
}

function getKeysFragmentPath(appDir: string, flowName: string): string {
  return path.join(getKeysFragmentsDir(appDir), `${flowName}.keys.ts`);
}

function getMergedKeysPath(appDir: string): string {
  return path.join(appDir, 'src', 'fluent', 'generated', 'keys.ts');
}

function parseKeyEntries(keysTs: string): ParsedKeyEntry[] {
  const entries: ParsedKeyEntry[] = [];
  const entryRegex = /([A-Za-z0-9_]+)\s*:\s*\{\s*table:\s*['"]([^'"]+)['"]\s*;\s*id:\s*['"]([^'"]+)['"]\s*\}/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(keysTs)) !== null) {
    entries.push({ key: match[1], table: match[2], id: match[3] });
  }

  return entries;
}

function extractArtifactIdsFromKeysTs(keysTs: string): { flow: string; triggers: string[]; actions: string[] } {
  const result = { flow: '', triggers: [] as string[], actions: [] as string[] };

  for (const entry of parseKeyEntries(keysTs)) {
    if (entry.table === 'sys_hub_flow') result.flow = entry.id;
    else if (entry.table === 'sys_hub_trigger_instance_v2') result.triggers.push(entry.id);
    else if (entry.table === 'sys_hub_action_instance_v2') result.actions.push(entry.id);
  }

  return result;
}

function buildMergedKeysTs(fragmentPaths: string[]): { content: string; conflicts: string[] } {
  const merged = new Map<string, ParsedKeyEntry>();
  const conflicts: string[] = [];

  for (const fragmentPath of fragmentPaths.sort()) {
    const fragment = readFileSync(fragmentPath, 'utf-8');
    for (const entry of parseKeyEntries(fragment)) {
      const existing = merged.get(entry.key);
      if (!existing) {
        merged.set(entry.key, entry);
        continue;
      }

      if (existing.table !== entry.table || existing.id !== entry.id) {
        conflicts.push(
          `Key "${entry.key}" conflicts between fragments: ` +
          `${existing.table}/${existing.id} vs ${entry.table}/${entry.id} (${path.basename(fragmentPath)})`
        );
      }
    }
  }

  const bodyLines = Array.from(merged.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(entry => `          ${entry.key}: { table: '${entry.table}'; id: '${entry.id}' }`);

  const content = [
    `import '@servicenow/sdk/global'`,
    '',
    'declare global {',
    '  namespace Now {',
    '    namespace Internal {',
    '      interface Keys extends KeysRegistry {',
    '        explicit: {',
    ...bodyLines,
    '        }',
    '      }',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');

  return { content, conflicts };
}

function refreshMergedKeysFile(appDir: string): { generatedKeysPath: string; fragmentCount: number; conflicts: string[] } {
  const keysDir = getKeysFragmentsDir(appDir);
  const generatedKeysPath = getMergedKeysPath(appDir);
  const fragmentPaths = existsSync(keysDir)
    ? readdirSync(keysDir)
      .filter(name => name.endsWith('.keys.ts'))
      .map(name => path.join(keysDir, name))
    : [];

  if (fragmentPaths.length === 0) {
    if (existsSync(generatedKeysPath)) {
      execSync(`rm -f "${generatedKeysPath}"`, { encoding: 'utf-8' });
    }
    return { generatedKeysPath, fragmentCount: 0, conflicts: [] };
  }

  const merged = buildMergedKeysTs(fragmentPaths);
  mkdirSync(path.dirname(generatedKeysPath), { recursive: true });
  writeFileSync(generatedKeysPath, merged.content, 'utf-8');
  return { generatedKeysPath, fragmentCount: fragmentPaths.length, conflicts: merged.conflicts };
}

function restorePreviousFlowSource(appDir: string, flowSourcePath: string, previousCode: string | null, keysFragmentPath: string, previousKeysTs: string | null): void {
  if (previousCode === null) execSync(`rm -f "${flowSourcePath}"`, { encoding: 'utf-8' });
  else writeFileSync(flowSourcePath, previousCode, 'utf-8');

  if (previousKeysTs === null) execSync(`rm -f "${keysFragmentPath}"`, { encoding: 'utf-8' });
  else writeFileSync(keysFragmentPath, previousKeysTs, 'utf-8');

  refreshMergedKeysFile(appDir);
}

function extractFlowDisplayName(code: string, fallbackFlowName: string): string {
  const nameMatch = code.match(/\bname\s*:\s*['"]([^'"]+)['"]/);
  return nameMatch?.[1] || fallbackFlowName;
}

async function findInstalledFlowArtifacts(client: ServiceNowClient, flowDisplayName: string, scopeId: string) {
  const flows = await client.getRecords('sys_hub_flow', {
    sysparm_query: `name=${flowDisplayName}^sys_scope=${scopeId}^ORDERBYDESCsys_updated_on`,
    sysparm_fields: 'sys_id,name,sys_updated_on',
    sysparm_limit: 1,
  });

  const flowSysId = flows[0]?.sys_id ? String(flows[0].sys_id) : '';
  if (!flowSysId) return { flow: '', triggers: [] as string[], actions: [] as string[] };

  const [triggers, actions] = await Promise.all([
    client.getRecords('sys_hub_trigger_instance_v2', {
      sysparm_query: `flow=${flowSysId}`,
      sysparm_fields: 'sys_id',
      sysparm_limit: 200,
    }).catch(() => []),
    client.getRecords('sys_hub_action_instance_v2', {
      sysparm_query: `flow=${flowSysId}`,
      sysparm_fields: 'sys_id',
      sysparm_limit: 200,
    }).catch(() => []),
  ]);

  return {
    flow: flowSysId,
    triggers: triggers.map(t => String(t.sys_id)),
    actions: actions.map(a => String(a.sys_id)),
  };
}

/**
 * Deploy SDK fluent code (.now.ts) to a ServiceNow instance.
 *
 * Uses a persistent APP-SCOPED workspace under sdk-flows/apps/{scope}/ so every
 * build/install for that scope includes all locally managed flows for the app.
 */
export async function deploySDKFlow(client: ServiceNowClient, input: z.infer<typeof deploySDKFlowSchema>) {
  const creds = client.credentials;

  if (input.reinstall === true) {
    return {
      success: false,
      error: 'reinstall=true is disabled for SDK flow deployment.',
      phase: 'input',
      hint: 'This deploy path only supports safe incremental installs. Use normal install only. If you need a baseline for an existing app, run now-sdk init --from <scopeId> outside this flow deploy helper first.',
    };
  }

  const repoRoot = path.resolve(__dirname_esm, '..', '..', '..');
  const sdkFlowsDir = path.join(repoRoot, 'sdk-flows');
  if (!existsSync(sdkFlowsDir)) {
    return { success: false, error: `sdk-flows directory not found at ${sdkFlowsDir}.` };
  }

  const safeFileName = input.fileName.endsWith('.now.ts')
    ? input.fileName
    : `${input.fileName.replace(/\.ts$/, '')}.now.ts`;
  const flowName = safeFileName.replace(/\.now\.ts$/, '');
  const flowDisplayName = extractFlowDisplayName(input.code, flowName);

  let appName: string;
  let appVersion = '1.0.0';
  try {
    const appRecord = await client.getRecord('sys_app', input.scopeId, ['name', 'version', 'scope']);
    if (appRecord && appRecord.name) {
      appName = String(appRecord.name).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (appRecord.version) appVersion = String(appRecord.version);
    } else {
      appName = input.scope.replace(/_/g, '-');
    }
  } catch {
    appName = input.scope.replace(/_/g, '-');
  }

  const appDir = getAppWorkspaceDir(sdkFlowsDir, input.scope);
  const flowSourcePath = getFlowSourcePath(appDir, safeFileName);
  const keysFragmentPath = getKeysFragmentPath(appDir, flowName);
  const previousCode = existsSync(flowSourcePath) ? readFileSync(flowSourcePath, 'utf-8') : null;
  const previousKeysTs = existsSync(keysFragmentPath) ? readFileSync(keysFragmentPath, 'utf-8') : null;

  mkdirSync(path.dirname(flowSourcePath), { recursive: true });
  mkdirSync(getKeysFragmentsDir(appDir), { recursive: true });

  const nmLink = path.join(appDir, 'node_modules');
  const nmTarget = path.join(sdkFlowsDir, 'node_modules');
  if (!existsSync(nmLink)) {
    const { symlinkSync } = await import('fs');
    symlinkSync(nmTarget, nmLink);
  }

  const instanceUrl = creds.instanceUrl.startsWith('https://')
    ? creds.instanceUrl : `https://${creds.instanceUrl}`;

  const pkgJson = {
    name: appName,
    version: appVersion,
    private: true,
    description: `SDK app workspace for ${input.scope}`,
    scripts: { build: 'now-sdk build', clean: 'rm -rf dist .now-sdk-cache .now' },
  };
  writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n');

  const nowConfig = { scope: input.scope, scopeId: input.scopeId };
  writeFileSync(path.join(appDir, 'now.config.json'), JSON.stringify(nowConfig, null, 2) + '\n');

  writeFileSync(flowSourcePath, input.code, 'utf-8');
  writeFileSync(keysFragmentPath, input.keysTs, 'utf-8');

  const mergedKeys = refreshMergedKeysFile(appDir);
  if (mergedKeys.conflicts.length > 0) {
    restorePreviousFlowSource(appDir, flowSourcePath, previousCode, keysFragmentPath, previousKeysTs);
    return {
      success: false,
      error: 'keys.ts merge conflict across app workspace',
      phase: 'keys_merge',
      details: mergedKeys.conflicts,
      flowName,
      filePath: flowSourcePath,
    };
  }

  const expectedArtifactIds = extractArtifactIdsFromKeysTs(input.keysTs);
  const distDir = path.join(appDir, 'dist');
  const cacheDir = path.join(appDir, '.now-sdk-cache');
  if (existsSync(distDir)) execSync(`rm -rf "${distDir}"`, { encoding: 'utf-8' });
  if (existsSync(cacheDir)) execSync(`rm -rf "${cacheDir}"`, { encoding: 'utf-8' });

  const ciEnv = {
    ...process.env,
    SN_SDK_NODE_ENV: 'SN_SDK_CI_INSTALL',
    SN_SDK_INSTANCE_URL: instanceUrl,
    SN_SDK_USER: creds.username,
    SN_SDK_USER_PWD: creds.password,
  };
  const execOpts = { cwd: appDir, env: ciEnv, timeout: 90_000, encoding: 'utf-8' as const };

  let buildOutput: string;
  try {
    buildOutput = execSync('npx now-sdk build 2>&1', execOpts);
  } catch (err: unknown) {
    restorePreviousFlowSource(appDir, flowSourcePath, previousCode, keysFragmentPath, previousKeysTs);
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false, error: 'SDK build failed', phase: 'build',
      details: e.stdout || e.stderr || e.message || String(err),
      flowName, filePath: flowSourcePath,
    };
  }

  const distUpdateDir = path.join(appDir, 'dist', 'app', 'update');
  const validationErrors: string[] = [];
  let targetFlowArtifactFound = false;

  if (!existsSync(distUpdateDir)) {
    validationErrors.push('dist/app/update/ not found — build produced no artifacts.');
  } else {
    const xmlFiles = readdirSync(distUpdateDir).filter(f => f.endsWith('.xml'));
    for (const xmlFile of xmlFiles) {
      const xmlContent = readFileSync(path.join(distUpdateDir, xmlFile), 'utf-8');
      if (xmlContent.includes('action="DELETE"')) {
        validationErrors.push(`CRITICAL: ${xmlFile} has action="DELETE" — destructive artifact.`);
      }
    }

    if (expectedArtifactIds.flow) {
      const targetXml = path.join(distUpdateDir, `sys_hub_flow_${expectedArtifactIds.flow}.xml`);
      if (!existsSync(targetXml)) {
        validationErrors.push(`Expected target flow artifact sys_hub_flow_${expectedArtifactIds.flow}.xml not found in build output.`);
      } else {
        const targetXmlContent = readFileSync(targetXml, 'utf-8');
        targetFlowArtifactFound = targetXmlContent.includes('action="INSERT_OR_UPDATE"');
      }
    } else {
      const anyFlowXml = xmlFiles.find(f => f.startsWith('sys_hub_flow_') && f.endsWith('.xml'));
      targetFlowArtifactFound = Boolean(anyFlowXml);
      if (!targetFlowArtifactFound) {
        validationErrors.push('No sys_hub_flow XML found. The .now.ts code may be invalid.');
      }
    }
  }

  const distScopeDir = path.join(appDir, 'dist', 'app', 'scope');
  if (existsSync(distScopeDir)) {
    const scopeFiles = readdirSync(distScopeDir).filter(f => f.startsWith('sys_app_') && f.endsWith('.xml'));
    for (const sf of scopeFiles) {
      const scopeXml = readFileSync(path.join(distScopeDir, sf), 'utf-8');
      const nameMatch = scopeXml.match(/<name>([^<]+)<\/name>/);
      if (nameMatch) {
        const builtAppName = nameMatch[1];
        if (builtAppName.toLowerCase() !== appName.toLowerCase()) {
          validationErrors.push(`sys_app name mismatch: built "${builtAppName}" but expected "${appName}". This could rename the existing app.`);
        }
      }
    }
  }

  if (validationErrors.length > 0) {
    restorePreviousFlowSource(appDir, flowSourcePath, previousCode, keysFragmentPath, previousKeysTs);
    return {
      success: false, error: 'Build output validation failed', phase: 'validation',
      validationErrors, buildOutput, flowName, filePath: flowSourcePath,
      hint: 'Check syntax: wfa.trigger(), wfa.action(), Now.ID[], TemplateValue().',
    };
  }
  if (!targetFlowArtifactFound) {
    restorePreviousFlowSource(appDir, flowSourcePath, previousCode, keysFragmentPath, previousKeysTs);
    return {
      success: false, error: 'No valid target flow artifacts in build output', phase: 'validation',
      buildOutput, flowName, filePath: flowSourcePath,
    };
  }

  let installOutput: string;
  try {
    installOutput = execSync('npx now-sdk install 2>&1', execOpts);
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const installError = e.stdout || e.stderr || e.message || String(err);
    return {
      success: false, error: 'SDK install failed', phase: 'install',
      details: installError,
      buildOutput, flowName, filePath: flowSourcePath,
      hint: 'Normal install failed. Keep reinstall disabled. If this scoped app already exists and needs a full SDK baseline, run "now-sdk init --from <scopeId>" first, then retry the incremental install.',
    };
  }

  let artifactIds = expectedArtifactIds;
  if (!artifactIds.flow) {
    artifactIds = await findInstalledFlowArtifacts(client, flowDisplayName, input.scopeId);
  }

  const registry = readRegistry(sdkFlowsDir);
  registry.flows[flowName] = {
    flowSysId: artifactIds.flow,
    fileName: safeFileName,
    flowDisplayName,
    scope: input.scope,
    scopeId: input.scopeId,
    instanceUrl,
    deployedAt: new Date().toISOString(),
    status: 'deployed',
    artifactIds,
  };
  writeRegistry(sdkFlowsDir, registry);

  return {
    success: true,
    message: `Flow "${flowName}" deployed to ${input.scope} on ${instanceUrl}`,
    flowName,
    flowDisplayName,
    fileName: safeFileName,
    scope: input.scope,
    scopeId: input.scopeId,
    flowSysId: artifactIds.flow,
    artifactIds,
    buildOutput,
    installOutput,
    filePath: flowSourcePath,
    keysFragmentPath,
    mergedKeysPath: mergedKeys.generatedKeysPath,
    workspace: appDir,
    workspaceMode: 'app-scoped-persistent',
    artifactValidation: 'PASSED — target flow artifact present and DELETE artifacts rejected',
  };
}



// ═══════════════════════════════════════════════════════════════
//  sn_undeploy_sdk_flow — Safely remove an SDK-deployed flow
// ═══════════════════════════════════════════════════════════════

export const undeploySDKFlowSchema = z.object({
  flowName: z.string().describe('Name of the flow to remove (as shown in registry, e.g. "AutoEscalateP1")'),
});

/**
 * Safely remove a flow that was deployed via the SDK.
 * Only removes flows tracked in registry.json with generation_source=fluent.
 */
export async function undeploySDKFlow(client: ServiceNowClient, input: z.infer<typeof undeploySDKFlowSchema>) {
  const repoRoot = path.resolve(__dirname_esm, '..', '..', '..');
  const sdkFlowsDir = path.join(repoRoot, 'sdk-flows');
  const registry = readRegistry(sdkFlowsDir);

  const entry = registry.flows[input.flowName];
  if (!entry) {
    return {
      success: false,
      error: `Flow "${input.flowName}" not found in registry. Only SDK-deployed flows can be undeployed.`,
      registeredFlows: Object.keys(registry.flows),
    };
  }

  if (entry.status === 'undeployed') {
    return {
      success: false,
      error: `Flow "${input.flowName}" is already undeployed.`,
    };
  }

  // Verify on instance: check generation_source=fluent
  const flowSysId = entry.flowSysId;
  if (flowSysId) {
    try {
      const flowRecord = await client.getRecord('sys_hub_flow', flowSysId) as Record<string, unknown> | null;
      if (flowRecord && flowRecord.generation_source !== 'fluent') {
        return {
          success: false,
          error: `Flow "${input.flowName}" on instance has generation_source="${flowRecord.generation_source}", not "fluent". Refusing to delete a non-SDK flow.`,
        };
      }
    } catch {
      // Flow may already be deleted on instance — that's OK
    }
  }

  const deleted: { table: string; sysId: string; success: boolean }[] = [];

  // Delete action instances
  for (const actionId of (entry.artifactIds?.actions || [])) {
    try {
      await client.deleteRecord('sys_hub_action_instance_v2', actionId);
      deleted.push({ table: 'sys_hub_action_instance_v2', sysId: actionId, success: true });
    } catch {
      deleted.push({ table: 'sys_hub_action_instance_v2', sysId: actionId, success: false });
    }
  }

  // Delete trigger instances
  for (const triggerId of (entry.artifactIds?.triggers || [])) {
    try {
      await client.deleteRecord('sys_hub_trigger_instance_v2', triggerId);
      deleted.push({ table: 'sys_hub_trigger_instance_v2', sysId: triggerId, success: true });
    } catch {
      deleted.push({ table: 'sys_hub_trigger_instance_v2', sysId: triggerId, success: false });
    }
  }

  // Delete the flow itself
  if (flowSysId) {
    try {
      await client.deleteRecord('sys_hub_flow', flowSysId);
      deleted.push({ table: 'sys_hub_flow', sysId: flowSysId, success: true });
    } catch {
      deleted.push({ table: 'sys_hub_flow', sysId: flowSysId, success: false });
    }
  }

  // Remove local flow source from the persistent app workspace and regenerate merged keys
  const appDir = getAppWorkspaceDir(sdkFlowsDir, entry.scope);
  const flowSourcePath = getFlowSourcePath(appDir, entry.fileName);
  const keysFragmentPath = getKeysFragmentPath(appDir, input.flowName);
  let localSourceRemoved = false;

  if (existsSync(flowSourcePath)) {
    execSync(`rm -f "${flowSourcePath}"`, { encoding: 'utf-8' });
    localSourceRemoved = true;
  }
  if (existsSync(keysFragmentPath)) {
    execSync(`rm -f "${keysFragmentPath}"`, { encoding: 'utf-8' });
    localSourceRemoved = true;
  }
  refreshMergedKeysFile(appDir);

  // Update registry
  registry.flows[input.flowName].status = 'undeployed';
  writeRegistry(sdkFlowsDir, registry);

  return {
    success: true,
    message: `Flow "${input.flowName}" undeployed and cleaned up.`,
    deleted,
    registryUpdated: true,
    localSourceRemoved,
    appWorkspace: appDir,
  };
}

// ═══════════════════════════════════════════════════════════════
//  sn_list_sdk_flows — List all SDK-deployed flows from registry
// ═══════════════════════════════════════════════════════════════

export const listSDKFlowsSchema = z.object({}).optional();

/**
 * List all flows tracked in the SDK registry with their deployment status.
 */
export async function listSDKFlows(_client: ServiceNowClient) {
  const repoRoot = path.resolve(__dirname_esm, '..', '..', '..');
  const sdkFlowsDir = path.join(repoRoot, 'sdk-flows');
  const registry = readRegistry(sdkFlowsDir);

  const flows = Object.entries(registry.flows).map(([name, entry]) => ({
    appWorkspace: getAppWorkspaceDir(sdkFlowsDir, entry.scope),
    name,
    flowDisplayName: entry.flowDisplayName || name,
    flowSysId: entry.flowSysId,
    scope: entry.scope,
    instanceUrl: entry.instanceUrl,
    deployedAt: entry.deployedAt,
    status: entry.status,
    fileName: entry.fileName,
    hasLocalWorkspace: existsSync(getFlowSourcePath(getAppWorkspaceDir(sdkFlowsDir, entry.scope), entry.fileName)),
  }));

  return {
    success: true,
    totalFlows: flows.length,
    deployed: flows.filter(f => f.status === 'deployed').length,
    undeployed: flows.filter(f => f.status === 'undeployed').length,
    flows,
  };
}
