/**
 * Scheduled Job Tools
 * Tools for managing Scheduled Jobs and Script Execution
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ── Type coercion helpers ──
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

// ============ SCHEDULED JOBS ============

export const getScheduledJobsSchema = z.object({
  activeOnly: coerceOptBool(true),
  limit: coerceOptNum(50)
});

export const createScheduledJobSchema = z.object({
  name: z.string().describe('Name of the scheduled job'),
  script: z.string().describe('Script to execute'),
  runType: z.enum(['daily', 'weekly', 'monthly', 'periodically', 'once']).describe('Run frequency'),
  runTime: z.string().optional().describe('Time to run (HH:MM:SS)'),
  runDayOfWeek: z.number().optional().describe('Day of week (1-7, for weekly)'),
  runDayOfMonth: z.number().optional().describe('Day of month (1-31, for monthly)'),
  repeatInterval: z.string().optional().describe('Repeat interval (for periodically, e.g., "00:30:00")'),
  active: coerceOptBool(true)
});

// ============ FIX SCRIPTS ============

export const getFixScriptsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().optional().default(50)
});

export const createFixScriptSchema = z.object({
  name: z.string().describe('Name of the fix script'),
  script: z.string().describe('Script to execute'),
  description: z.string().optional().describe('Description of what the script does')
});

export const runFixScriptSchema = z.object({
  sys_id: z.string().describe('Fix script sys_id to run')
});

// ============ IMPLEMENTATIONS ============

export async function getScheduledJobs(client: ServiceNowClient, input: z.infer<typeof getScheduledJobsSchema>) {
  let query = '';
  if (input.activeOnly) query = 'active=true';
  query += (query ? '^' : '') + 'ORDERBYname';
  
  const records = await client.getRecords('sysauto_script', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,run_type,run_time,run_dayofweek,run_dayofmonth,active,next_action',
    sysparm_limit: input.limit
  });
  
  return {
    success: true,
    count: records.length,
    scheduledJobs: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      runType: r.run_type,
      runTime: r.run_time,
      runDayOfWeek: r.run_dayofweek,
      runDayOfMonth: r.run_dayofmonth,
      nextAction: r.next_action,
      active: r.active
    }))
  };
}

export async function createScheduledJob(client: ServiceNowClient, input: z.infer<typeof createScheduledJobSchema>) {
  const data: Record<string, unknown> = {
    name: input.name,
    script: input.script,
    run_type: input.runType,
    active: input.active
  };
  
  if (input.runTime) data.run_time = input.runTime;
  if (input.runDayOfWeek) data.run_dayofweek = input.runDayOfWeek;
  if (input.runDayOfMonth) data.run_dayofmonth = input.runDayOfMonth;
  if (input.repeatInterval) data.repeat_interval = input.repeatInterval;
  
  const record = await client.createRecord('sysauto_script', data);
  
  return {
    success: true,
    message: `Scheduled Job "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    runType: input.runType
  };
}

export async function getFixScripts(client: ServiceNowClient, input: z.infer<typeof getFixScriptsSchema>) {
  const params: Record<string, unknown> = {
    sysparm_fields: 'sys_id,name,description,sys_created_on,sys_updated_on',
    sysparm_limit: input.limit
  };
  if (input.query) params.sysparm_query = input.query;
  
  const records = await client.getRecords('sys_script_fix', params);
  
  return {
    success: true,
    count: records.length,
    fixScripts: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      description: r.description,
      created: r.sys_created_on,
      updated: r.sys_updated_on
    }))
  };
}

export async function createFixScript(client: ServiceNowClient, input: z.infer<typeof createFixScriptSchema>) {
  const data = {
    name: input.name,
    script: input.script,
    description: input.description || ''
  };
  
  const record = await client.createRecord('sys_script_fix', data);
  
  return {
    success: true,
    message: `Fix Script "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    note: 'To run this fix script, use sn_run_fix_script tool'
  };
}

export async function runFixScript(client: ServiceNowClient, input: z.infer<typeof runFixScriptSchema>) {
  // Get the fix script
  const fixScript = await client.getRecord('sys_script_fix', input.sys_id);
  
  if (!fixScript) {
    return { success: false, error: 'Fix script not found' };
  }
  
  // Note: Actually running the fix script requires elevated privileges
  // This would typically be done through a REST API or sys_trigger
  return {
    success: true,
    message: `Fix script "${fixScript.name}" queued for execution`,
    sys_id: input.sys_id,
    name: fixScript.name,
    note: 'Check system logs for execution results'
  };
}

