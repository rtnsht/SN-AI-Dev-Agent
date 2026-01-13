/**
 * Connection and Instance Tools
 * Tools for testing connection and getting instance information
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// Tool schemas
export const testConnectionSchema = z.object({});

export const getInstanceInfoSchema = z.object({});

export const getTablesSchema = z.object({
  query: z.string().optional().describe('Optional query filter for tables (e.g., "nameSTARTSWITHincident")'),
  limit: z.number().optional().default(50).describe('Maximum number of tables to return')
});

export const getTableSchemaInputSchema = z.object({
  table: z.string().describe('The table name to get schema for (e.g., "incident")')
});

// Tool implementations
export async function testConnection(client: ServiceNowClient) {
  const result = await client.testConnection();
  return result;
}

export async function getInstanceInfo(client: ServiceNowClient) {
  const connectionTest = await client.testConnection();
  
  if (!connectionTest.success) {
    return connectionTest;
  }
  
  const currentUser = await client.getCurrentUser();
  
  return {
    success: true,
    instanceUrl: client.instanceUrl,
    currentUser: currentUser ? {
      user_name: currentUser.user_name,
      name: currentUser.name,
      email: currentUser.email
    } : null
  };
}

export async function getTables(client: ServiceNowClient, input: z.infer<typeof getTablesSchema>) {
  const tables = await client.getTables(input.query);
  
  return {
    success: true,
    count: tables.length,
    tables: tables.slice(0, input.limit).map(t => ({
      name: t.name,
      label: t.label,
      scope: t.sys_scope,
      extendable: t.is_extendable
    }))
  };
}

export async function getTableSchema(client: ServiceNowClient, input: z.infer<typeof getTableSchemaInputSchema>) {
  const fields = await client.getTableSchema(input.table);
  
  return {
    success: true,
    table: input.table,
    fieldCount: fields.length,
    fields: fields.map(f => ({
      name: f.element,
      label: f.column_label,
      type: f.internal_type,
      maxLength: f.max_length,
      mandatory: f.mandatory === 'true' || f.mandatory === true,
      reference: f.reference || null
    }))
  };
}

