/**
 * Approval Gate Tool
 * Manages approval workflows for AI-assisted changes
 *
 * Task 3.4 of the Brownfield Enhancement Plan - Step 3: Persona & 4G Framework
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMAS ============

export const requestApprovalSchema = z.object({
  changeId: z.string().describe('Unique identifier for this change request'),
  changeType: z.enum([
    'create_artifact',
    'modify_artifact',
    'delete_artifact',
    'schema_change',
    'acl_change',
    'integration_change'
  ]).describe('Type of change requiring approval'),

  artifactType: z.string().describe('Type of artifact being changed'),
  artifactName: z.string().describe('Name of the artifact'),
  targetTable: z.string().optional().describe('Target table if applicable'),

  requester: z.object({
    userId: z.string().optional(),
    persona: z.string(),
    name: z.string().optional()
  }).describe('Person requesting the change'),

  approvalLevel: z.enum(['team_lead', 'admin', 'architect', 'platform_owner'])
    .describe('Required approval level'),

  justification: z.string().optional().describe('Reason for the change'),
  riskAssessment: z.object({
    riskScore: z.number().optional(),
    riskLevel: z.string().optional(),
    impacts: z.array(z.string()).optional()
  }).optional().describe('Risk assessment data'),

  changeDetails: z.object({
    scriptBefore: z.string().optional(),
    scriptAfter: z.string().optional(),
    summary: z.string().optional()
  }).optional().describe('Details of the proposed change')
});

export type RequestApprovalInput = z.infer<typeof requestApprovalSchema>;

export const processApprovalSchema = z.object({
  changeId: z.string().describe('Change request ID to process'),
  decision: z.enum(['approved', 'rejected', 'needs_revision']).describe('Approval decision'),
  approver: z.object({
    userId: z.string().optional(),
    role: z.string(),
    name: z.string().optional()
  }).describe('Person approving/rejecting'),
  comments: z.string().optional().describe('Approval comments'),
  conditions: z.array(z.string()).optional().describe('Conditions for approval')
});

export type ProcessApprovalInput = z.infer<typeof processApprovalSchema>;

export const getApprovalStatusSchema = z.object({
  changeId: z.string().optional().describe('Specific change ID to check'),
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('pending'),
  limit: z.number().default(20).describe('Maximum results to return')
});

export type GetApprovalStatusInput = z.infer<typeof getApprovalStatusSchema>;

// ============ TYPES ============

interface ApprovalRequest {
  changeId: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  changeType: string;
  artifactType: string;
  artifactName: string;
  targetTable?: string;
  requester: {
    userId?: string;
    persona: string;
    name?: string;
  };
  approvalLevel: string;
  justification?: string;
  riskAssessment?: {
    riskScore?: number;
    riskLevel?: string;
    impacts?: string[];
  };
  changeDetails?: {
    scriptBefore?: string;
    scriptAfter?: string;
    summary?: string;
  };
  createdAt: string;
  processedAt?: string;
  processedBy?: {
    userId?: string;
    role: string;
    name?: string;
  };
  decision?: {
    decision: string;
    comments?: string;
    conditions?: string[];
  };
}

interface RequestApprovalResult {
  success: boolean;
  changeId: string;
  status: 'pending';
  message: string;
  approvalLevel: string;
  estimatedWaitTime: string;
  nextSteps: string[];
}

interface ProcessApprovalResult {
  success: boolean;
  changeId: string;
  decision: string;
  message: string;
  canProceed: boolean;
  conditions?: string[];
}

interface ApprovalStatusResult {
  success: boolean;
  totalPending: number;
  requests: ApprovalRequest[];
}

// In-memory approval queue
const approvalQueue: Map<string, ApprovalRequest> = new Map();

// ============ MAIN EXPORTS ============

export async function requestApproval(
  _client: ServiceNowClient,
  input: RequestApprovalInput
): Promise<RequestApprovalResult> {
  const request: ApprovalRequest = {
    changeId: input.changeId,
    status: 'pending',
    changeType: input.changeType,
    artifactType: input.artifactType,
    artifactName: input.artifactName,
    targetTable: input.targetTable,
    requester: input.requester,
    approvalLevel: input.approvalLevel,
    justification: input.justification,
    riskAssessment: input.riskAssessment,
    changeDetails: input.changeDetails,
    createdAt: new Date().toISOString()
  };

  approvalQueue.set(input.changeId, request);

  // Estimate wait time based on approval level
  const waitTimes: Record<string, string> = {
    team_lead: '< 1 hour',
    admin: '< 4 hours',
    architect: '< 1 day',
    platform_owner: '< 2 days'
  };

  return {
    success: true,
    changeId: input.changeId,
    status: 'pending',
    message: `Approval requested from ${input.approvalLevel}`,
    approvalLevel: input.approvalLevel,
    estimatedWaitTime: waitTimes[input.approvalLevel] || 'Unknown',
    nextSteps: [
      `Awaiting ${input.approvalLevel} review`,
      'You will be notified when a decision is made',
      'Use sn_get_approval_status to check progress'
    ]
  };
}


export async function processApproval(
  _client: ServiceNowClient,
  input: ProcessApprovalInput
): Promise<ProcessApprovalResult> {
  const request = approvalQueue.get(input.changeId);

  if (!request) {
    return {
      success: false,
      changeId: input.changeId,
      decision: 'error',
      message: `Change request ${input.changeId} not found`,
      canProceed: false
    };
  }

  // Update the request
  request.status = input.decision === 'approved' ? 'approved' :
                   input.decision === 'rejected' ? 'rejected' : 'needs_revision';
  request.processedAt = new Date().toISOString();
  request.processedBy = input.approver;
  request.decision = {
    decision: input.decision,
    comments: input.comments,
    conditions: input.conditions
  };

  approvalQueue.set(input.changeId, request);

  let message = '';
  if (input.decision === 'approved') {
    message = input.conditions?.length
      ? `Approved with ${input.conditions.length} condition(s)`
      : 'Approved - ready to proceed';
  } else if (input.decision === 'rejected') {
    message = `Rejected: ${input.comments || 'No reason provided'}`;
  } else {
    message = `Needs revision: ${input.comments || 'See feedback'}`;
  }

  return {
    success: true,
    changeId: input.changeId,
    decision: input.decision,
    message,
    canProceed: input.decision === 'approved',
    conditions: input.conditions
  };
}

export async function getApprovalStatus(
  _client: ServiceNowClient,
  input: GetApprovalStatusInput
): Promise<ApprovalStatusResult> {
  let requests: ApprovalRequest[] = [];

  if (input.changeId) {
    const request = approvalQueue.get(input.changeId);
    if (request) requests = [request];
  } else {
    requests = Array.from(approvalQueue.values());

    if (input.status !== 'all') {
      requests = requests.filter(r => r.status === input.status);
    }
  }

  // Sort by created date descending
  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Limit results
  requests = requests.slice(0, input.limit);

  const totalPending = Array.from(approvalQueue.values())
    .filter(r => r.status === 'pending').length;

  return {
    success: true,
    totalPending,
    requests
  };
}