/**
 * Audit Logger Tool
 * Logs AI-assisted changes for compliance and rollback
 *
 * Task 2.6 of the Brownfield Enhancement Plan - Step 2: Guardrails & Impact Analysis
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const logChangeSchema = z.object({
  action: z.enum([
    'create',
    'update',
    'delete',
    'preview',
    'validate',
    'analyze'
  ]).describe('Type of action performed'),

  artifactType: z.string().describe('Type of artifact (e.g., business_rule, script_include)'),
  artifactName: z.string().describe('Name of the artifact'),
  artifactSysId: z.string().optional().describe('sys_id of the artifact'),
  targetTable: z.string().optional().describe('Target table for the artifact'),

  // Change details
  changeDetails: z.object({
    fieldChanged: z.string().optional(),
    oldValue: z.string().optional(),
    newValue: z.string().optional(),
    scriptBefore: z.string().optional(),
    scriptAfter: z.string().optional()
  }).optional().describe('Details of the change made'),

  // Validation results
  validationResult: z.object({
    riskScore: z.number().optional(),
    riskLevel: z.string().optional(),
    guardrailViolations: z.number().optional(),
    conflictsFound: z.number().optional(),
    approved: z.boolean().optional()
  }).optional().describe('Results from validation checks'),

  // Metadata
  sessionId: z.string().optional().describe('Session identifier for grouping changes'),
  userNotes: z.string().optional().describe('User notes about the change')
});

export type LogChangeInput = z.infer<typeof logChangeSchema>;

// ============ TYPES ============

interface AuditEntry {
  timestamp: string;
  action: string;
  artifactType: string;
  artifactName: string;
  artifactSysId?: string;
  targetTable?: string;
  changeDetails?: {
    fieldChanged?: string;
    oldValue?: string;
    newValue?: string;
    scriptBefore?: string;
    scriptAfter?: string;
  };
  validationResult?: {
    riskScore?: number;
    riskLevel?: string;
    guardrailViolations?: number;
    conflictsFound?: number;
    approved?: boolean;
  };
  sessionId?: string;
  userNotes?: string;
}

interface LogChangeResult {
  success: boolean;
  logId: string;
  timestamp: string;
  message: string;
  summary: {
    action: string;
    artifactType: string;
    artifactName: string;
    riskLevel?: string;
  };
  // For rollback support
  rollbackInfo?: {
    canRollback: boolean;
    rollbackScript?: string;
  };
}

// In-memory audit log (in production, this would be stored in ServiceNow)
const auditLog: AuditEntry[] = [];

// ============ HELPER FUNCTIONS ============

function generateLogId(): string {
  return 'LOG' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generateRollbackScript(entry: AuditEntry): string | undefined {
  if (entry.action === 'create' && entry.artifactSysId) {
    return `// Rollback: Delete the created artifact
var gr = new GlideRecord('${getTableForType(entry.artifactType)}');
if (gr.get('${entry.artifactSysId}')) {
  gr.deleteRecord();
  gs.info('Rolled back: Deleted ${entry.artifactName}');
}`;
  }

  if (entry.action === 'update' && entry.artifactSysId && entry.changeDetails?.scriptBefore) {
    return `// Rollback: Restore previous script
var gr = new GlideRecord('${getTableForType(entry.artifactType)}');
if (gr.get('${entry.artifactSysId}')) {
  gr.script = \`${entry.changeDetails.scriptBefore.replace(/`/g, '\\`')}\`;
  gr.update();
  gs.info('Rolled back: Restored ${entry.artifactName}');
}`;
  }

  if (entry.action === 'delete' && entry.changeDetails?.scriptBefore) {
    return `// Rollback: Recreate deleted artifact
// Note: Manual recreation needed - save the following script:
/*
${entry.changeDetails.scriptBefore}
*/`;
  }

  return undefined;
}

function getTableForType(artifactType: string): string {
  const tableMap: Record<string, string> = {
    'business_rule': 'sys_script',
    'script_include': 'sys_script_include',
    'client_script': 'sys_script_client',
    'ui_action': 'sys_ui_action',
    'ui_policy': 'sys_ui_policy',
    'scheduled_job': 'sysauto_script',
    'fix_script': 'sys_script_fix',
    'acl': 'sys_security_acl'
  };
  return tableMap[artifactType] || artifactType;
}

// ============ MAIN EXPORTS ============

export async function logChange(
  _client: ServiceNowClient,
  input: LogChangeInput
): Promise<LogChangeResult> {
  const timestamp = new Date().toISOString();
  const logId = generateLogId();

  const entry: AuditEntry = {
    timestamp,
    action: input.action,
    artifactType: input.artifactType,
    artifactName: input.artifactName,
    artifactSysId: input.artifactSysId,
    targetTable: input.targetTable,
    changeDetails: input.changeDetails,
    validationResult: input.validationResult,
    sessionId: input.sessionId,
    userNotes: input.userNotes
  };

  // Store in memory (in production, would write to ServiceNow)
  auditLog.push(entry);

  // Generate rollback info for modification actions
  let rollbackInfo: LogChangeResult['rollbackInfo'];
  if (['create', 'update', 'delete'].includes(input.action)) {
    const rollbackScript = generateRollbackScript(entry);
    rollbackInfo = {
      canRollback: !!rollbackScript,
      rollbackScript
    };
  }

  return {
    success: true,
    logId,
    timestamp,
    message: `Logged ${input.action} action on ${input.artifactType}: ${input.artifactName}`,
    summary: {
      action: input.action,
      artifactType: input.artifactType,
      artifactName: input.artifactName,
      riskLevel: input.validationResult?.riskLevel
    },
    rollbackInfo
  };
}

// Schema for getting audit history
export const getAuditHistorySchema = z.object({
  sessionId: z.string().optional().describe('Filter by session ID'),
  artifactName: z.string().optional().describe('Filter by artifact name'),
  action: z.string().optional().describe('Filter by action type'),
  limit: z.number().default(50).describe('Maximum entries to return')
});

export type GetAuditHistoryInput = z.infer<typeof getAuditHistorySchema>;

interface AuditHistoryResult {
  success: boolean;
  totalEntries: number;
  entries: AuditEntry[];
  summary: {
    creates: number;
    updates: number;
    deletes: number;
    validates: number;
    analyzes: number;
  };
}

export async function getAuditHistory(
  _client: ServiceNowClient,
  input: GetAuditHistoryInput
): Promise<AuditHistoryResult> {
  let filtered = [...auditLog];

  if (input.sessionId) {
    filtered = filtered.filter(e => e.sessionId === input.sessionId);
  }
  if (input.artifactName) {
    filtered = filtered.filter(e => e.artifactName.includes(input.artifactName!));
  }
  if (input.action) {
    filtered = filtered.filter(e => e.action === input.action);
  }

  // Sort by timestamp descending
  filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Limit results
  const entries = filtered.slice(0, input.limit);

  return {
    success: true,
    totalEntries: filtered.length,
    entries,
    summary: {
      creates: filtered.filter(e => e.action === 'create').length,
      updates: filtered.filter(e => e.action === 'update').length,
      deletes: filtered.filter(e => e.action === 'delete').length,
      validates: filtered.filter(e => e.action === 'validate').length,
      analyzes: filtered.filter(e => e.action === 'analyze').length
    }
  };
}