/**
 * Service Catalog Tools
 * Tools for managing Catalog Items, Variables, and Requests
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ CATALOG ITEMS ============

export const getCatalogItemsSchema = z.object({
  category: z.string().optional().describe('Filter by category sys_id'),
  query: z.string().optional().describe('Search query'),
  activeOnly: z.boolean().optional().default(true),
  limit: z.number().optional().default(50)
});

export const getCatalogItemSchema = z.object({
  sys_id: z.string().describe('Catalog item sys_id')
});

export const getCatalogVariablesSchema = z.object({
  catalogItem: z.string().describe('Catalog item sys_id')
});

// ============ CATALOG REQUESTS ============

export const getRequestsSchema = z.object({
  query: z.string().optional().describe('Encoded query'),
  limit: z.number().optional().default(50)
});

export const createRequestSchema = z.object({
  catalogItem: z.string().describe('Catalog item sys_id'),
  requestedFor: z.string().optional().describe('Requested for user sys_id'),
  variables: z.record(z.unknown()).optional().describe('Variable values')
});

// ============ IMPLEMENTATIONS ============

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
  
  // Get variables for this item
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

export async function createRequest(client: ServiceNowClient, input: z.infer<typeof createRequestSchema>) {
  // Use the Cart API or Order Now API
  // For simplicity, we create a request item directly
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

