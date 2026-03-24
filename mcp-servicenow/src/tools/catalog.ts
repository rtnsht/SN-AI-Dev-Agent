/**
 * Service Catalog Tools
 * Tools for managing Catalog Items, Variables, Categories, and Requests
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

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

// ============ READ SCHEMAS ============

export const getCatalogItemsSchema = z.object({
  category: z.string().optional().describe('Filter by category sys_id'),
  query: z.string().optional().describe('Search query'),
  activeOnly: coerceOptBool(true),
  limit: coerceOptNum(50)
});

export const getCatalogItemSchema = z.object({
  sys_id: z.string().describe('Catalog item sys_id')
});

export const getCatalogVariablesSchema = z.object({
  catalogItem: z.string().describe('Catalog item sys_id')
});

export const getRequestsSchema = z.object({
  query: z.string().optional().describe('Encoded query'),
  limit: coerceOptNum(50)
});

export const getCatalogCategoriesSchema = z.object({
  query: z.string().optional().describe('Search query (e.g. nameSTARTSWITHHardware)'),
  activeOnly: coerceOptBool(true),
  limit: coerceOptNum(50)
});

// ============ CREATE / MUTATE SCHEMAS ============

export const createCatalogItemSchema = z.object({
  name: z.string().describe('Catalog item name'),
  short_description: z.string().optional().describe('Short description shown in lists'),
  description: z.string().optional().describe('Full HTML description'),
  category: z.string().optional().describe('Primary category sys_id'),
  active: coerceOptBool(true),
  price: z.string().optional().describe('Price (e.g. "0" or "49.99")'),
  recurring_price: z.string().optional().describe('Recurring price'),
  order: coerceOptNum(0).describe('Display order within category'),
  workflow: z.string().optional().describe('Workflow sys_id for fulfillment'),
});

export const createCatalogVariableSchema = z.object({
  cat_item: z.string().describe('Parent catalog item sys_id'),
  name: z.string().describe('Internal variable name (used in scripts)'),
  question_text: z.string().describe('Label shown to the user'),
  type: coerceOptNum(6).describe('Variable type: 1=Yes/No, 6=Single Line Text, 7=Multi Line Text, 8=Reference, 10=Select Box, 18=Lookup Select Box, 21=List Collector'),
  order: coerceOptNum(100).describe('Display order on the form'),
  mandatory: coerceOptBool(false).describe('Whether the variable is required'),
  default_value: z.string().optional().describe('Default value'),
  reference: z.string().optional().describe('Reference table (for type 8/Reference variables)'),
  reference_qual: z.string().optional().describe('Reference qualifier'),
});

export const createRecordProducerSchema = z.object({
  name: z.string().describe('Record producer name'),
  table_name: z.string().describe('Target table for record creation (e.g. "incident")'),
  short_description: z.string().optional().describe('Short description'),
  description: z.string().optional().describe('Full HTML description'),
  category: z.string().optional().describe('Primary category sys_id'),
  active: coerceOptBool(true),
  script: z.string().optional().describe('Post-insert script'),
});

export const updateCatalogItemSchema = z.object({
  sys_id: z.string().describe('Catalog item sys_id to update'),
  data: z.record(z.unknown()).describe('Fields to update (e.g. { name, active, category })'),
});

export const deleteCatalogItemSchema = z.object({
  sys_id: z.string().describe('Catalog item sys_id'),
  hard_delete: coerceOptBool(false).describe('If false (default), sets active=false; if true, permanently deletes the record'),
});

export const addItemToCategorySchema = z.object({
  sc_cat_item: z.string().describe('Catalog item sys_id'),
  sc_category: z.string().describe('Category sys_id'),
});

export const addItemToCatalogSchema = z.object({
  sc_cat_item: z.string().describe('Catalog item sys_id'),
  sc_catalog: z.string().describe('Catalog sys_id'),
});

export const createRequestSchema = z.object({
  catalogItem: z.string().describe('Catalog item sys_id'),
  requestedFor: z.string().optional().describe('Requested for user sys_id'),
  variables: z.record(z.unknown()).optional().describe('Variable values')
});

export const createCatalogClientScriptSchema = z.object({
  cat_item: z.string().describe('Catalog item sys_id'),
  name: z.string().describe('Name of the catalog client script'),
  script: z.string().describe('Script code'),
  type: z.enum(['onLoad', 'onChange', 'onSubmit']).describe('Script type'),
  cat_variable: z.string().optional().describe('Variable name to bind (for onChange scripts). The variable must exist on the catalog item.'),
  apply_to: z.string().optional().default('item').describe('Apply to: item (default) or variable_set'),
  active: coerceOptBool(true)
});

export const createCatalogUiPolicyActionSchema = z.object({
  catalog_ui_policy: z.string().describe('sys_id of the parent catalog UI policy'),
  variable: z.string().describe('Variable name to target (must exist on the catalog item)'),
  cat_item: z.string().describe('Catalog item sys_id (used to look up variable)'),
  mandatory: z.string().optional().default('ignore').describe('Make variable mandatory: true/false/ignore'),
  visible: z.string().optional().default('ignore').describe('Make variable visible: true/false/ignore'),
  disabled: z.string().optional().default('ignore').describe('Make variable disabled: true/false/ignore')
});

// ============ READ IMPLEMENTATIONS ============

export async function getCatalogItems(client: ServiceNowClient, input: z.infer<typeof getCatalogItemsSchema>) {
  let query = '';
  if (input.category) query = `category=${input.category}`;
  if (input.query) query += (query ? '^' : '') + `nameSTARTSWITH${input.query}`;
  if (input.activeOnly) query += (query ? '^' : '') + 'active=true';

  const records = await client.getRecords('sc_cat_item', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,short_description,category,active,order,price,workflow',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    catalogItems: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      shortDescription: r.short_description,
      category: r.category,
      order: r.order,
      price: r.price,
      hasWorkflow: !!r.workflow,
      active: r.active
    }))
  };
}

export async function getCatalogItem(client: ServiceNowClient, input: z.infer<typeof getCatalogItemSchema>) {
  const record = await client.getRecord('sc_cat_item', input.sys_id);

  if (!record) {
    return { success: false, error: 'Catalog item not found' };
  }

  const variables = await client.getRecords('item_option_new', {
    sysparm_query: `cat_item=${input.sys_id}^ORDERBYorder`,
    sysparm_fields: 'sys_id,name,question_text,type,mandatory,order,default_value'
  });

  return {
    success: true,
    catalogItem: {
      sys_id: record.sys_id,
      name: record.name,
      shortDescription: record.short_description,
      description: record.description,
      category: record.category,
      active: record.active
    },
    variables: variables.map(v => ({
      sys_id: v.sys_id,
      name: v.name,
      label: v.question_text,
      type: v.type,
      mandatory: v.mandatory,
      order: v.order,
      defaultValue: v.default_value
    }))
  };
}

export async function getCatalogVariables(client: ServiceNowClient, input: z.infer<typeof getCatalogVariablesSchema>) {
  const variables = await client.getRecords('item_option_new', {
    sysparm_query: `cat_item=${input.catalogItem}^ORDERBYorder`,
    sysparm_fields: 'sys_id,name,question_text,type,mandatory,order,default_value,reference,reference_qual'
  });

  return {
    success: true,
    catalogItem: input.catalogItem,
    count: variables.length,
    variables: variables.map(v => ({
      sys_id: v.sys_id,
      name: v.name,
      label: v.question_text,
      type: v.type,
      mandatory: v.mandatory,
      order: v.order,
      defaultValue: v.default_value,
      reference: v.reference
    }))
  };
}

export async function getRequests(client: ServiceNowClient, input: z.infer<typeof getRequestsSchema>) {
  const params: Record<string, unknown> = {
    sysparm_fields: 'sys_id,number,short_description,requested_for,state,opened_at,closed_at',
    sysparm_limit: input.limit
  };
  if (input.query) params.sysparm_query = input.query;

  const records = await client.getRecords('sc_request', params);

  return {
    success: true,
    count: records.length,
    requests: records.map(r => ({
      sys_id: r.sys_id,
      number: r.number,
      shortDescription: r.short_description,
      requestedFor: r.requested_for,
      state: r.state,
      openedAt: r.opened_at,
      closedAt: r.closed_at
    }))
  };
}

export async function getCatalogCategories(client: ServiceNowClient, input: z.infer<typeof getCatalogCategoriesSchema>) {
  let query = '';
  if (input.query) query = input.query;
  if (input.activeOnly) query += (query ? '^' : '') + 'active=true';

  const records = await client.getRecords('sc_category', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,title,description,active,parent,icon',
    sysparm_limit: input.limit
  });

  return {
    success: true,
    count: records.length,
    categories: records.map(r => ({
      sys_id: r.sys_id,
      title: r.title,
      description: r.description,
      active: r.active,
      parent: r.parent,
      icon: r.icon
    }))
  };
}

// ============ CREATE / MUTATE IMPLEMENTATIONS ============

export async function createCatalogItem(client: ServiceNowClient, input: z.infer<typeof createCatalogItemSchema>) {
  const data: Record<string, unknown> = {
    name: input.name,
    active: input.active,
    order: input.order,
  };
  if (input.short_description) data.short_description = input.short_description;
  if (input.description) data.description = input.description;
  if (input.category) data.category = input.category;
  if (input.price) data.price = input.price;
  if (input.recurring_price) data.recurring_price = input.recurring_price;
  if (input.workflow) data.workflow = input.workflow;

  const record = await client.createRecord('sc_cat_item', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sc_cat_item', record.sys_id);
  }

  return {
    success: true,
    message: `Catalog item "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: record.name,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function createCatalogVariable(client: ServiceNowClient, input: z.infer<typeof createCatalogVariableSchema>) {
  const data: Record<string, unknown> = {
    cat_item: input.cat_item,
    name: input.name,
    question_text: input.question_text,
    type: input.type,
    order: input.order,
    mandatory: input.mandatory,
  };
  if (input.default_value) data.default_value = input.default_value;
  if (input.reference) data.reference = input.reference;
  if (input.reference_qual) data.reference_qual = input.reference_qual;

  const record = await client.createRecord('item_option_new', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('item_option_new', record.sys_id);
  }

  return {
    success: true,
    message: `Catalog variable "${input.name}" created on item ${input.cat_item}`,
    sys_id: record.sys_id,
    name: input.name,
    catalogItem: input.cat_item,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function createRecordProducer(client: ServiceNowClient, input: z.infer<typeof createRecordProducerSchema>) {
  const data: Record<string, unknown> = {
    name: input.name,
    table_name: input.table_name,
    active: input.active,
  };
  if (input.short_description) data.short_description = input.short_description;
  if (input.description) data.description = input.description;
  if (input.category) data.category = input.category;
  if (input.script) data.script = input.script;

  const record = await client.createRecord('sc_cat_item_producer', data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sc_cat_item_producer', record.sys_id);
  }

  return {
    success: true,
    message: `Record producer "${input.name}" created for table ${input.table_name}`,
    sys_id: record.sys_id,
    name: record.name,
    tableName: input.table_name,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function updateCatalogItem(client: ServiceNowClient, input: z.infer<typeof updateCatalogItemSchema>) {
  const record = await client.updateRecord('sc_cat_item', input.sys_id, input.data);

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sc_cat_item', record.sys_id);
  }

  return {
    success: true,
    message: `Catalog item ${input.sys_id} updated successfully`,
    sys_id: record.sys_id,
    record,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function deleteCatalogItem(client: ServiceNowClient, input: z.infer<typeof deleteCatalogItemSchema>) {
  if (input.hard_delete) {
    await client.deleteRecord('sc_cat_item', input.sys_id);
    return {
      success: true,
      message: `Catalog item ${input.sys_id} permanently deleted`,
      sys_id: input.sys_id,
      action: 'hard_delete' as const,
    };
  }

  const record = await client.updateRecord('sc_cat_item', input.sys_id, { active: false });

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sc_cat_item', record.sys_id);
  }

  return {
    success: true,
    message: `Catalog item ${input.sys_id} deactivated`,
    sys_id: record.sys_id,
    action: 'deactivated' as const,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function addCatalogItemToCategory(client: ServiceNowClient, input: z.infer<typeof addItemToCategorySchema>) {
  const record = await client.createRecord('sc_cat_item_category', {
    sc_cat_item: input.sc_cat_item,
    sc_category: input.sc_category,
  });

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sc_cat_item_category', record.sys_id);
  }

  return {
    success: true,
    message: `Catalog item associated with category`,
    sys_id: record.sys_id,
    catalogItem: input.sc_cat_item,
    category: input.sc_category,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function addCatalogItemToCatalog(client: ServiceNowClient, input: z.infer<typeof addItemToCatalogSchema>) {
  const record = await client.createRecord('sc_cat_item_catalog', {
    sc_cat_item: input.sc_cat_item,
    sc_catalog: input.sc_catalog,
  });

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('sc_cat_item_catalog', record.sys_id);
  }

  return {
    success: true,
    message: `Catalog item associated with catalog`,
    sys_id: record.sys_id,
    catalogItem: input.sc_cat_item,
    catalog: input.sc_catalog,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function createRequest(client: ServiceNowClient, input: z.infer<typeof createRequestSchema>) {
  const requestData = {
    cat_item: input.catalogItem,
    requested_for: input.requestedFor || '',
    variables: JSON.stringify(input.variables || {})
  };

  const record = await client.createRecord('sc_req_item', requestData);

  return {
    success: true,
    message: 'Request created successfully',
    sys_id: record.sys_id,
    number: record.number,
    state: record.state
  };
}

export async function createCatalogClientScript(client: ServiceNowClient, input: z.infer<typeof createCatalogClientScriptSchema>) {
  const helperBasePath = client.getHelperApiPath('catalogVariableHelper');
  if (!helperBasePath) {
    throw new Error('CatalogVariableHelper API not available. It will be auto-deployed on next connection.');
  }

  const data: Record<string, unknown> = {
    cat_item: input.cat_item,
    name: input.name,
    script: input.script,
    type: input.type,
    apply_to: input.apply_to || 'item',
    active: input.active,
    ui_type: 'Desktop'
  };

  if (input.cat_variable) {
    data.cat_variable_name = input.cat_variable;
  }

  const result = await client.callScriptedRestApi<{
    success: boolean; sys_id: string; variable_bound: boolean; variable_sys_id: string; error?: string;
  }>(`${helperBasePath}/create_client_script`, 'POST', data);

  if (!result.success) {
    throw new Error(`Failed to create catalog client script: ${result.error || 'Unknown error'}`);
  }

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('catalog_script_client', result.sys_id);
  }

  return {
    success: true,
    message: `Catalog client script "${input.name}" created${result.variable_bound ? ` with variable "${input.cat_variable}" bound` : ''}`,
    sys_id: result.sys_id,
    cat_item: input.cat_item,
    type: input.type,
    variable_bound: result.variable_bound,
    variable_sys_id: result.variable_sys_id || undefined,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function createCatalogUiPolicyAction(client: ServiceNowClient, input: z.infer<typeof createCatalogUiPolicyActionSchema>) {
  const helperBasePath = client.getHelperApiPath('catalogVariableHelper');
  if (!helperBasePath) {
    throw new Error('CatalogVariableHelper API not available. It will be auto-deployed on next connection.');
  }

  const data: Record<string, unknown> = {
    catalog_ui_policy: input.catalog_ui_policy,
    cat_item: input.cat_item,
    variable_name: input.variable,
    mandatory: input.mandatory || 'ignore',
    visible: input.visible || 'ignore',
    disabled: input.disabled || 'ignore'
  };

  const result = await client.callScriptedRestApi<{
    success: boolean; sys_id: string; variable_sys_id: string; error?: string;
  }>(`${helperBasePath}/create_ui_policy_action`, 'POST', data);

  if (!result.success) {
    throw new Error(`Failed to create catalog UI policy action: ${result.error || 'Unknown error'}`);
  }

  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet('catalog_ui_policy_action', result.sys_id);
  }

  return {
    success: true,
    message: `Catalog UI policy action created for variable "${input.variable}"`,
    sys_id: result.sys_id,
    catalog_ui_policy: input.catalog_ui_policy,
    variable: input.variable,
    variable_sys_id: result.variable_sys_id,
    mandatory: input.mandatory,
    visible: input.visible,
    disabled: input.disabled,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

