/**
 * Multi-Instance Manager
 * 
 * Enhanced instance management with actual connection switching and cross-instance operations.
 * Builds on instance-registry.ts to provide runtime instance switching.
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// =============================================================================
// SCHEMAS
// =============================================================================

export const switchInstanceSchema = z.object({
  instanceId: z.string().describe('Instance ID to switch to')
});

export const getActiveInstanceSchema = z.object({});

export const testInstanceConnectionSchema = z.object({
  instanceId: z.string().describe('Instance ID to test')
});

export const syncArtifactSchema = z.object({
  sourceInstanceId: z.string().describe('Source instance ID'),
  targetInstanceId: z.string().describe('Target instance ID'),
  artifactType: z.enum([
    'business_rule', 'client_script', 'script_include', 
    'ui_policy', 'ui_action', 'acl'
  ]).describe('Type of artifact to sync'),
  artifactSysId: z.string().describe('Sys ID of the artifact to sync'),
  dryRun: z.boolean().default(true).describe('Preview changes without applying')
});

export const diffArtifactSchema = z.object({
  sourceInstanceId: z.string().describe('Source instance ID'),
  targetInstanceId: z.string().describe('Target instance ID'),
  artifactType: z.enum([
    'business_rule', 'client_script', 'script_include',
    'ui_policy', 'ui_action', 'acl'
  ]).describe('Type of artifact'),
  artifactName: z.string().describe('Name of the artifact to diff')
});

export type SwitchInstanceInput = z.infer<typeof switchInstanceSchema>;
export type GetActiveInstanceInput = z.infer<typeof getActiveInstanceSchema>;
export type TestInstanceConnectionInput = z.infer<typeof testInstanceConnectionSchema>;
export type SyncArtifactInput = z.infer<typeof syncArtifactSchema>;
export type DiffArtifactInput = z.infer<typeof diffArtifactSchema>;

// =============================================================================
// INSTANCE STATE
// =============================================================================

interface InstanceConfig {
  instanceId: string;
  name: string;
  url: string;
  environment: 'dev' | 'test' | 'stage' | 'prod';
  username: string;
  password: string;
  registeredAt: string;
  lastConnected?: string;
  isActive: boolean;
}

// In-memory store for registered instances
const instances = new Map<string, InstanceConfig>();
let activeInstanceId: string | null = null;
let activeClient: ServiceNowClient | null = null;

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function getTableForArtifactType(artifactType: string): string {
  const tableMap: Record<string, string> = {
    'business_rule': 'sys_script',
    'client_script': 'sys_script_client',
    'script_include': 'sys_script_include',
    'ui_policy': 'sys_ui_policy',
    'ui_action': 'sys_ui_action',
    'acl': 'sys_security_acl'
  };
  return tableMap[artifactType] || artifactType;
}

function createClientForInstance(config: InstanceConfig): ServiceNowClient {
  return new ServiceNowClient({
    instanceUrl: config.url,
    username: config.username,
    password: config.password
  });
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Register a new instance (enhanced version)
 */
export async function registerInstanceEnhanced(
  _client: ServiceNowClient,
  input: {
    instanceId: string;
    name: string;
    url: string;
    environment: 'dev' | 'test' | 'stage' | 'prod';
    username: string;
    password: string;
  }
): Promise<{
  success: boolean;
  message: string;
  instance: Omit<InstanceConfig, 'password'>;
  connectionTest: { connected: boolean; responseTime?: number; error?: string };
}> {
  // Normalize URL
  const url = input.url.replace(/\/$/, '');
  
  const config: InstanceConfig = {
    instanceId: input.instanceId,
    name: input.name,
    url,
    environment: input.environment,
    username: input.username,
    password: input.password,
    registeredAt: new Date().toISOString(),
    isActive: false
  };

  // Test connection before registering
  const testClient = createClientForInstance(config);
  let connectionTest: { connected: boolean; responseTime?: number; error?: string };
  
  try {
    const startTime = Date.now();
    const result = await testClient.testConnection();
    const responseTime = Date.now() - startTime;
    
    connectionTest = {
      connected: result.success,
      responseTime,
      error: result.success ? undefined : result.message
    };
  } catch (error) {
    connectionTest = {
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }

  // Register even if connection fails (user may fix credentials later)
  instances.set(input.instanceId, config);

  // If this is the first instance, make it active
  if (instances.size === 1) {
    activeInstanceId = input.instanceId;
    activeClient = testClient;
    config.isActive = true;
  }

  const { password: _, ...safeConfig } = config;

  return {
    success: true,
    message: connectionTest.connected
      ? `Instance "${input.name}" registered and connected`
      : `Instance "${input.name}" registered but connection failed: ${connectionTest.error}`,
    instance: safeConfig,
    connectionTest
  };
}

/**
 * Switch to a different registered instance
 */
export async function switchInstance(
  _client: ServiceNowClient,
  input: SwitchInstanceInput
): Promise<{
  success: boolean;
  message: string;
  previousInstance?: string;
  currentInstance: string | null;
  connectionStatus: { connected: boolean; responseTime?: number };
}> {
  const config = instances.get(input.instanceId);

  if (!config) {
    return {
      success: false,
      message: `Instance "${input.instanceId}" not found. Use sn_list_instances to see registered instances.`,
      currentInstance: activeInstanceId
    } as any;
  }

  const previousInstance = activeInstanceId;

  // Update active states
  if (activeInstanceId && instances.has(activeInstanceId)) {
    const prev = instances.get(activeInstanceId)!;
    prev.isActive = false;
    instances.set(activeInstanceId, prev);
  }

  // Create new client and test connection
  const newClient = createClientForInstance(config);
  let connectionStatus: { connected: boolean; responseTime?: number };

  try {
    const startTime = Date.now();
    const result = await newClient.testConnection();
    connectionStatus = {
      connected: result.success,
      responseTime: Date.now() - startTime
    };
  } catch {
    connectionStatus = { connected: false };
  }

  // Switch even if connection fails
  activeInstanceId = input.instanceId;
  activeClient = newClient;
  config.isActive = true;
  config.lastConnected = new Date().toISOString();
  instances.set(input.instanceId, config);

  return {
    success: true,
    message: connectionStatus.connected
      ? `Switched to "${config.name}" (${config.environment})`
      : `Switched to "${config.name}" but connection failed`,
    previousInstance: previousInstance || undefined,
    currentInstance: activeInstanceId,
    connectionStatus
  };
}

/**
 * Get the currently active instance
 */
export async function getActiveInstance(
  _client: ServiceNowClient,
  _input: GetActiveInstanceInput
): Promise<{
  success: boolean;
  hasActiveInstance: boolean;
  activeInstance: Omit<InstanceConfig, 'password'> | null;
  allInstances: { instanceId: string; name: string; environment: string; isActive: boolean }[];
}> {
  const activeConfig = activeInstanceId ? instances.get(activeInstanceId) : null;

  const allInstances = Array.from(instances.values()).map(i => ({
    instanceId: i.instanceId,
    name: i.name,
    environment: i.environment,
    isActive: i.isActive
  }));

  if (!activeConfig) {
    return {
      success: true,
      hasActiveInstance: false,
      activeInstance: null,
      allInstances
    };
  }

  const { password: _, ...safeConfig } = activeConfig;

  return {
    success: true,
    hasActiveInstance: true,
    activeInstance: safeConfig,
    allInstances
  };
}

/**
 * Test connection to a specific instance
 */
export async function testInstanceConnection(
  _client: ServiceNowClient,
  input: TestInstanceConnectionInput
): Promise<{
  success: boolean;
  instanceId: string;
  connected: boolean;
  responseTimeMs?: number;
  instanceInfo?: { url: string; version?: string };
  error?: string;
}> {
  const config = instances.get(input.instanceId);

  if (!config) {
    return {
      success: false,
      instanceId: input.instanceId,
      connected: false,
      error: `Instance "${input.instanceId}" not found`
    };
  }

  const testClient = createClientForInstance(config);

  try {
    const startTime = Date.now();
    const result = await testClient.testConnection();
    const responseTimeMs = Date.now() - startTime;

    return {
      success: true,
      instanceId: input.instanceId,
      connected: result.success,
      responseTimeMs,
      instanceInfo: result.success ? { url: config.url } : undefined,
      error: result.success ? undefined : result.message
    };
  } catch (error) {
    return {
      success: false,
      instanceId: input.instanceId,
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}

/**
 * Diff a specific artifact between two instances
 */
export async function diffArtifact(
  _client: ServiceNowClient,
  input: DiffArtifactInput
): Promise<{
  success: boolean;
  artifactName: string;
  artifactType: string;
  comparison: {
    existsInSource: boolean;
    existsInTarget: boolean;
    status: 'identical' | 'modified' | 'source_only' | 'target_only' | 'not_found';
    sourceDetails?: { sysId: string; updatedOn: string; updatedBy: string; scriptPreview?: string };
    targetDetails?: { sysId: string; updatedOn: string; updatedBy: string; scriptPreview?: string };
    differences?: { field: string; sourceValue: string; targetValue: string }[];
  };
}> {
  const sourceConfig = instances.get(input.sourceInstanceId);
  const targetConfig = instances.get(input.targetInstanceId);

  if (!sourceConfig || !targetConfig) {
    return {
      success: false,
      artifactName: input.artifactName,
      artifactType: input.artifactType,
      comparison: {
        existsInSource: false,
        existsInTarget: false,
        status: 'not_found'
      }
    };
  }

  const table = getTableForArtifactType(input.artifactType);
  const sourceClient = createClientForInstance(sourceConfig);
  const targetClient = createClientForInstance(targetConfig);

  // Query both instances
  let sourceRecord: any = null;
  let targetRecord: any = null;

  try {
    const sourceRecords = await sourceClient.getRecords(table, {
      sysparm_query: `name=${input.artifactName}`,
      sysparm_fields: 'sys_id,name,script,sys_updated_on,sys_updated_by,active',
      sysparm_limit: 1
    });
    sourceRecord = sourceRecords[0] || null;
  } catch { /* Source query failed */ }

  try {
    const targetRecords = await targetClient.getRecords(table, {
      sysparm_query: `name=${input.artifactName}`,
      sysparm_fields: 'sys_id,name,script,sys_updated_on,sys_updated_by,active',
      sysparm_limit: 1
    });
    targetRecord = targetRecords[0] || null;
  } catch { /* Target query failed */ }

  // Determine status
  let status: 'identical' | 'modified' | 'source_only' | 'target_only' | 'not_found';
  const differences: { field: string; sourceValue: string; targetValue: string }[] = [];

  if (!sourceRecord && !targetRecord) {
    status = 'not_found';
  } else if (sourceRecord && !targetRecord) {
    status = 'source_only';
  } else if (!sourceRecord && targetRecord) {
    status = 'target_only';
  } else {
    // Both exist - compare
    const sourceScript = String(sourceRecord.script || '');
    const targetScript = String(targetRecord.script || '');

    if (sourceScript === targetScript) {
      status = 'identical';
    } else {
      status = 'modified';
      differences.push({
        field: 'script',
        sourceValue: sourceScript.substring(0, 200) + (sourceScript.length > 200 ? '...' : ''),
        targetValue: targetScript.substring(0, 200) + (targetScript.length > 200 ? '...' : '')
      });
    }
  }

  return {
    success: true,
    artifactName: input.artifactName,
    artifactType: input.artifactType,
    comparison: {
      existsInSource: !!sourceRecord,
      existsInTarget: !!targetRecord,
      status,
      sourceDetails: sourceRecord ? {
        sysId: String(sourceRecord.sys_id),
        updatedOn: String(sourceRecord.sys_updated_on),
        updatedBy: String(sourceRecord.sys_updated_by),
        scriptPreview: String(sourceRecord.script || '').substring(0, 100)
      } : undefined,
      targetDetails: targetRecord ? {
        sysId: String(targetRecord.sys_id),
        updatedOn: String(targetRecord.sys_updated_on),
        updatedBy: String(targetRecord.sys_updated_by),
        scriptPreview: String(targetRecord.script || '').substring(0, 100)
      } : undefined,
      differences: differences.length > 0 ? differences : undefined
    }
  };
}

/**
 * Get the active client (for use by other tools)
 */
export function getActiveClient(): ServiceNowClient | null {
  return activeClient;
}

/**
 * Get client for a specific instance
 */
export function getClientForInstance(instanceId: string): ServiceNowClient | null {
  const config = instances.get(instanceId);
  if (!config) return null;
  return createClientForInstance(config);
}

