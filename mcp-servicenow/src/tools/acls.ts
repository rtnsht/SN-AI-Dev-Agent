/**
 * ACL (Access Control) Tools
 * Tools for managing Access Control Lists and Roles
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

// ============ ACLs ============

export const getAclsSchema = z.object({
  table: z.string().optional().describe('Filter by table name'),
  operation: z.enum(['read', 'write', 'create', 'delete', '*']).optional().describe('Filter by operation'),
  activeOnly: coerceOptBool(true),
  limit: coerceOptNum(50)
});

export const createAclSchema = z.object({
  name: z.string().describe('ACL name (table.field or table.*)'),
  operation: z.enum(['read', 'write', 'create', 'delete']).describe('Operation to control'),
  roles: z.array(z.string()).optional().describe('Required roles (role names)'),
  condition: z.string().optional().describe('Script condition'),
  script: z.string().optional().describe('Advanced script'),
  active: coerceOptBool(true)
});

// ============ ROLES ============

export const getRolesSchema = z.object({
  query: z.string().optional().describe('Query filter for roles'),
  limit: coerceOptNum(100)
});

export const createRoleSchema = z.object({
  name: z.string().describe('Role name (internal name)'),
  description: z.string().optional().describe('Role description'),
  suffix: z.string().optional().describe('Suffix for scoped apps'),
  assignableBy: z.string().optional().describe('Role that can assign this role'),
  elevated: coerceOptBool(false).describe('Is elevated privilege')
});

// ============ IMPLEMENTATIONS ============

export async function getAcls(client: ServiceNowClient, input: z.infer<typeof getAclsSchema>) {
  let query = '';
  if (input.table) query = `nameSTARTSWITH${input.table}`;
  if (input.operation && input.operation !== '*') {
    query += (query ? '^' : '') + `operation=${input.operation}`;
  }
  if (input.activeOnly) query += (query ? '^' : '') + 'active=true';
  
  const records = await client.getRecords('sys_security_acl', {
    sysparm_query: query,
    sysparm_fields: 'sys_id,name,operation,type,condition,script,active,admin_overrides',
    sysparm_limit: input.limit
  });
  
  return {
    success: true,
    count: records.length,
    acls: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      operation: r.operation,
      type: r.type,
      condition: r.condition,
      hasScript: !!r.script,
      active: r.active,
      adminOverrides: r.admin_overrides
    }))
  };
}

export async function createAcl(client: ServiceNowClient, input: z.infer<typeof createAclSchema>) {
  const data: Record<string, unknown> = {
    name: input.name,
    operation: input.operation,
    condition: input.condition || '',
    script: input.script || '',
    active: input.active,
    type: 'record'
  };
  
  const record = await client.createRecord('sys_security_acl', data);
  
  // If roles specified, create ACL role entries
  if (input.roles && input.roles.length > 0) {
    for (const roleName of input.roles) {
      // Find the role sys_id
      const roles = await client.getRecords('sys_user_role', {
        sysparm_query: `name=${roleName}`,
        sysparm_limit: 1
      });
      
      if (roles.length > 0) {
        await client.createRecord('sys_security_acl_role', {
          sys_security_acl: record.sys_id,
          sys_user_role: roles[0].sys_id
        });
      }
    }
  }
  
  return {
    success: true,
    message: `ACL "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name,
    operation: input.operation,
    rolesAdded: input.roles || []
  };
}

export async function getRoles(client: ServiceNowClient, input: z.infer<typeof getRolesSchema>) {
  const params: Record<string, unknown> = {
    sysparm_fields: 'sys_id,name,description,suffix,elevated_privilege',
    sysparm_limit: input.limit
  };
  if (input.query) params.sysparm_query = input.query;
  
  const records = await client.getRecords('sys_user_role', params);
  
  return {
    success: true,
    count: records.length,
    roles: records.map(r => ({
      sys_id: r.sys_id,
      name: r.name,
      description: r.description,
      suffix: r.suffix,
      elevated: r.elevated_privilege
    }))
  };
}

export async function createRole(client: ServiceNowClient, input: z.infer<typeof createRoleSchema>) {
  const data = {
    name: input.name,
    description: input.description || '',
    suffix: input.suffix || '',
    assignable_by: input.assignableBy || '',
    elevated_privilege: input.elevated
  };
  
  const record = await client.createRecord('sys_user_role', data);
  
  return {
    success: true,
    message: `Role "${input.name}" created successfully`,
    sys_id: record.sys_id,
    name: input.name
  };
}

