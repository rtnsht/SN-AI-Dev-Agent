/**
 * Notification Tools
 * Tools for managing Email Notifications and Events
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ NOTIFICATIONS ============

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

export const getNotificationsSchema = z.object({
  table: z.string().optional().describe('Filter by table name'),
  activeOnly: coerceOptBool(true),
  limit: coerceOptNum(50)
});

export const createNotificationSchema = z.object({
  name: z.string().describe('Name of the notification'),
  table: z.string().describe('Table the notification monitors'),
  subject: z.string().describe('Email subject line'),
  messageHtml: z.string().describe('HTML email body'),
  recipients: z.string().optional().describe('Recipient field or user/group sys_id'),
  sendSelf: coerceOptBool(false).describe('Send to event creator'),
  condition: z.string().optional().describe('Condition for sending'),
  insertAction: coerceOptBool(false).describe('Send on insert'),
  updateAction: coerceOptBool(true).describe('Send on update'),
  active: coerceOptBool(true)
});

// ============ EVENTS ============

export const getEventsSchema = z.object({
  table: z.string().optional().describe('Filter by table name'),
  limit: z.number().optional().default(50)
});

export const createEventSchema = z.object({
  name: z.string().describe('Event name (suffix will be added)'),
  table: z.string().describe('Table the event applies to'),
  description: z.string().optional().describe('Description of the event'),
  queue: z.string().optional().default('event.queue').describe('Event queue')
});

// ============ IMPLEMENTATIONS ============

export async function getNotifications(client: ServiceNowClient, input: z.infer<typeof getNotificationsSchema>) {
  let query = '';
  if (input.table) query = `collection=${input.table}`;
  if (input.activeOnly) query += (query ? '^' : '') + 'active=true';
  
  const records = await client.getRecords('sysevent_email_action', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,collection,subject,send_self,condition,action_insert,action_update,active',
    sysparm_limit: input.limit
  });
  
  return {
    success: true,
    count: records.length,
    notifications: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      table: r.collection,
      subject: r.subject,
      sendSelf: r.send_self,
      condition: r.condition,
      onInsert: r.action_insert,
      onUpdate: r.action_update,
      active: r.active
    }))
  };
}

export async function createNotification(client: ServiceNowClient, input: z.infer<typeof createNotificationSchema>) {
  const data = {
    name: input.name,
    collection: input.table,
    subject: input.subject,
    message_html: input.messageHtml,
    recipient_fields: input.recipients || '',
    send_self: input.sendSelf,
    condition: input.condition || '',
    action_insert: input.insertAction,
    action_update: input.updateAction,
    active: input.active,
    content_type: 'text/html'
  };
  
  const record = await client.createRecord('sysevent_email_action', data);
  
  return {
    success: true,
    message: `Notification "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    table: input.table
  };
}

export async function getEvents(client: ServiceNowClient, input: z.infer<typeof getEventsSchema>) {
  let query = '';
  if (input.table) query = `table=${input.table}`;
  query += (query ? '^' : '') + 'ORDERBYname';
  
  const records = await client.getRecords('sysevent_register', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,event_name,table,suffix,description',
    sysparm_limit: input.limit
  });
  
  return {
    success: true,
    count: records.length,
    events: records.map(r => ({
      sys_id: r.sys_id,
      eventName: r.event_name,
      table: r.table,
      suffix: r.suffix,
      description: r.description
    }))
  };
}

export async function createEvent(client: ServiceNowClient, input: z.infer<typeof createEventSchema>) {
  const data = {
    event_name: input.name,
    table: input.table,
    suffix: input.name,
    description: input.description || '',
    queue: input.queue
  };
  
  const record = await client.createRecord('sysevent_register', data);
  
  return {
    success: true,
    message: `Event "${input.name}" registered successfully`,
    sys_id: record.sys_id,
    eventName: input.name,
    table: input.table
  };
}

