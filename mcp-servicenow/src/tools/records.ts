/**
 * Record Operations Tools
 * Tools for CRUD operations on ServiceNow tables
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// Tool schemas
export const queryRecordsSchema = z.object({
  table: z.string().describe('The table name to query (e.g., "incident", "sys_user")'),
  query: z.string().optional().describe('Encoded query string (e.g., "active=true^priority=1")'),
  fields: z.array(z.string()).optional().describe('List of fields to return'),
  limit: z.number().optional().default(20).describe('Maximum records to return'),
  offset: z.number().optional().default(0).describe('Offset for pagination')
});

export const getRecordSchema = z.object({
  table: z.string().describe('The table name'),
  sys_id: z.string().describe('The sys_id of the record'),
  fields: z.array(z.string()).optional().describe('List of fields to return')
});

// Coerce JSON string → object (AI agents sometimes send data as a stringified JSON)
const coerceJsonObject = z.preprocess(
  (v) => {
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  },
  z.record(z.unknown())
);

export const createRecordSchema = z.object({
  table: z.string().describe('The table name to create record in'),
  data: coerceJsonObject.describe('Field values for the new record')
});

export const updateRecordSchema = z.object({
  table: z.string().describe('The table name'),
  sys_id: z.string().describe('The sys_id of the record to update'),
  data: coerceJsonObject.describe('Field values to update')
});

export const deleteRecordSchema = z.object({
  table: z.string().describe('The table name'),
  sys_id: z.string().describe('The sys_id of the record to delete')
});

// Tool implementations
export async function queryRecords(client: ServiceNowClient, input: z.infer<typeof queryRecordsSchema>) {
  const params: Record<string, unknown> = {
    sysparm_limit: input.limit,
    sysparm_offset: input.offset
  };
  
  if (input.query) {
    params.sysparm_query = input.query;
  }
  if (input.fields?.length) {
    params.sysparm_fields = input.fields.join(',');
  }
  
  const records = await client.getRecords(input.table, params);
  
  return {
    success: true,
    table: input.table,
    count: records.length,
    records: records
  };
}

export async function getRecord(client: ServiceNowClient, input: z.infer<typeof getRecordSchema>) {
  const record = await client.getRecord(input.table, input.sys_id, input.fields);
  
  if (!record) {
    return {
      success: false,
      error: `Record not found: ${input.table}/${input.sys_id}`
    };
  }
  
  return {
    success: true,
    table: input.table,
    record: record
  };
}

export async function createRecord(client: ServiceNowClient, input: z.infer<typeof createRecordSchema>) {
  const record = await client.createRecord(input.table, input.data);

  // Auto-move sys_update_xml to active update set (if one is set)
  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet(input.table, record.sys_id);
  }

  return {
    success: true,
    message: `Record created successfully`,
    table: input.table,
    sys_id: record.sys_id,
    record: record,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function updateRecord(client: ServiceNowClient, input: z.infer<typeof updateRecordSchema>) {
  const record = await client.updateRecord(input.table, input.sys_id, input.data);

  // Auto-move sys_update_xml to active update set (if one is set)
  let updateSetCapture: { moved: number; errors: string[] } | undefined;
  if (client.activeUpdateSetId) {
    updateSetCapture = await client.moveArtifactToUpdateSet(input.table, record.sys_id);
  }

  return {
    success: true,
    message: `Record updated successfully`,
    table: input.table,
    sys_id: record.sys_id,
    record: record,
    updateSetCapture: updateSetCapture ? {
      activeUpdateSet: client.activeUpdateSetId,
      moved: updateSetCapture.moved,
      errors: updateSetCapture.errors.length > 0 ? updateSetCapture.errors : undefined
    } : undefined
  };
}

export async function deleteRecord(client: ServiceNowClient, input: z.infer<typeof deleteRecordSchema>) {
  await client.deleteRecord(input.table, input.sys_id);
  
  return {
    success: true,
    message: `Record deleted successfully`,
    table: input.table,
    sys_id: input.sys_id
  };
}

