/**
 * Promotion Workflow
 * 
 * Manages artifact promotion between ServiceNow instances (dev → test → prod)
 * with validation, preview, and rollback capabilities.
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';
import { getClientForInstance } from './multi-instance-manager.js';

// =============================================================================
// SCHEMAS
// =============================================================================

export const createPromotionPackageSchema = z.object({
  packageName: z.string().describe('Name for this promotion package'),
  sourceInstanceId: z.string().describe('Source instance ID'),
  artifacts: z.array(z.object({
    type: z.enum([
      'business_rule', 'client_script', 'script_include',
      'ui_policy', 'ui_action', 'acl', 'ui_page', 'ui_macro'
    ]),
    name: z.string().describe('Artifact name'),
    sysId: z.string().optional().describe('Optional sys_id if known')
  })).describe('List of artifacts to include'),
  description: z.string().optional().describe('Package description')
});

export const previewPromotionSchema = z.object({
  packageId: z.string().describe('Promotion package ID'),
  targetInstanceId: z.string().describe('Target instance to preview against')
});

export const validatePromotionSchema = z.object({
  packageId: z.string().describe('Promotion package ID'),
  targetInstanceId: z.string().describe('Target instance to validate against'),
  checkConflicts: z.boolean().default(true),
  checkDependencies: z.boolean().default(true),
  checkBreakingChanges: z.boolean().default(true)
});

export const executePromotionSchema = z.object({
  packageId: z.string().describe('Promotion package ID'),
  targetInstanceId: z.string().describe('Target instance'),
  createBackup: z.boolean().default(true).describe('Backup target artifacts before overwriting'),
  dryRun: z.boolean().default(true).describe('Preview only, do not apply changes')
});

export const rollbackPromotionSchema = z.object({
  promotionId: z.string().describe('Promotion ID to rollback')
});

export const listPromotionHistorySchema = z.object({
  limit: z.number().default(10),
  status: z.enum(['all', 'pending', 'completed', 'failed', 'rolled_back']).default('all')
});

export type CreatePromotionPackageInput = z.infer<typeof createPromotionPackageSchema>;
export type PreviewPromotionInput = z.infer<typeof previewPromotionSchema>;
export type ValidatePromotionInput = z.infer<typeof validatePromotionSchema>;
export type ExecutePromotionInput = z.infer<typeof executePromotionSchema>;
export type RollbackPromotionInput = z.infer<typeof rollbackPromotionSchema>;
export type ListPromotionHistoryInput = z.infer<typeof listPromotionHistorySchema>;

// =============================================================================
// TYPES
// =============================================================================

interface ArtifactSnapshot {
  type: string;
  name: string;
  sysId: string;
  table: string;
  script?: string;
  active?: boolean;
  updatedOn: string;
  updatedBy: string;
  hash: string;
}

interface PromotionPackage {
  id: string;
  name: string;
  sourceInstanceId: string;
  description?: string;
  artifacts: ArtifactSnapshot[];
  createdAt: string;
  status: 'draft' | 'validated' | 'promoted' | 'failed';
}

interface PromotionRecord {
  id: string;
  packageId: string;
  packageName: string;
  sourceInstanceId: string;
  targetInstanceId: string;
  artifactCount: number;
  status: 'pending' | 'completed' | 'failed' | 'rolled_back';
  executedAt: string;
  executedBy: string;
  backups: ArtifactSnapshot[];
  changes: { artifact: string; action: 'created' | 'updated' | 'skipped'; previousHash?: string }[];
  error?: string;
}

// In-memory storage
const packages = new Map<string, PromotionPackage>();
const promotionHistory: PromotionRecord[] = [];

// =============================================================================
// HELPERS
// =============================================================================

function generateId(): string {
  return `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function generatePromotionId(): string {
  return `promo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function getTableForType(type: string): string {
  const tableMap: Record<string, string> = {
    'business_rule': 'sys_script',
    'client_script': 'sys_script_client',
    'script_include': 'sys_script_include',
    'ui_policy': 'sys_ui_policy',
    'ui_action': 'sys_ui_action',
    'acl': 'sys_security_acl',
    'ui_page': 'sys_ui_page',
    'ui_macro': 'sys_ui_macro'
  };
  return tableMap[type] || type;
}

function hashScript(script: string): string {
  let hash = 0;
  for (let i = 0; i < script.length; i++) {
    const char = script.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `h${Math.abs(hash).toString(16)}`;
}

async function fetchArtifact(
  client: ServiceNowClient,
  type: string,
  name: string,
  sysId?: string
): Promise<ArtifactSnapshot | null> {
  const table = getTableForType(type);
  
  try {
    const query = sysId ? `sys_id=${sysId}` : `name=${name}`;
    const records = await client.getRecords(table, {
      sysparm_query: query,
      sysparm_fields: 'sys_id,name,script,active,sys_updated_on,sys_updated_by',
      sysparm_limit: 1
    });

    if (records.length === 0) return null;

    const record = records[0];
    const script = String(record.script || '');

    return {
      type,
      name: String(record.name || name),
      sysId: String(record.sys_id),
      table,
      script,
      active: record.active === 'true' || record.active === true,
      updatedOn: String(record.sys_updated_on || ''),
      updatedBy: String(record.sys_updated_by || ''),
      hash: hashScript(script)
    };
  } catch {
    return null;
  }
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Create a promotion package with artifacts from source instance
 */
export async function createPromotionPackage(
  client: ServiceNowClient,
  input: CreatePromotionPackageInput
): Promise<{
  success: boolean;
  packageId: string;
  package: Omit<PromotionPackage, 'artifacts'> & { artifactCount: number; artifacts: { name: string; type: string; found: boolean }[] };
  errors: string[];
}> {
  const sourceClient = getClientForInstance(input.sourceInstanceId, client);

  if (!sourceClient) {
    return {
      success: false,
      packageId: '',
      package: null as any,
      errors: [`Source instance "${input.sourceInstanceId}" not found or not registered`]
    };
  }

  const packageId = generateId();
  const artifacts: ArtifactSnapshot[] = [];
  const errors: string[] = [];
  const artifactResults: { name: string; type: string; found: boolean }[] = [];

  // Fetch each artifact from source
  for (const artifact of input.artifacts) {
    const snapshot = await fetchArtifact(sourceClient, artifact.type, artifact.name, artifact.sysId);

    if (snapshot) {
      artifacts.push(snapshot);
      artifactResults.push({ name: artifact.name, type: artifact.type, found: true });
    } else {
      errors.push(`Artifact not found: ${artifact.type}/${artifact.name}`);
      artifactResults.push({ name: artifact.name, type: artifact.type, found: false });
    }
  }

  const pkg: PromotionPackage = {
    id: packageId,
    name: input.packageName,
    sourceInstanceId: input.sourceInstanceId,
    description: input.description,
    artifacts,
    createdAt: new Date().toISOString(),
    status: 'draft'
  };

  packages.set(packageId, pkg);

  return {
    success: artifacts.length > 0,
    packageId,
    package: {
      id: pkg.id,
      name: pkg.name,
      sourceInstanceId: pkg.sourceInstanceId,
      description: pkg.description,
      createdAt: pkg.createdAt,
      status: pkg.status,
      artifactCount: artifacts.length,
      artifacts: artifactResults
    },
    errors
  };
}

/**
 * Preview what changes would be made on target instance
 */
export async function previewPromotion(
  client: ServiceNowClient,
  input: PreviewPromotionInput
): Promise<{
  success: boolean;
  packageId: string;
  targetInstanceId: string;
  preview: {
    toCreate: { name: string; type: string }[];
    toUpdate: { name: string; type: string; sourceHash: string; targetHash: string }[];
    unchanged: { name: string; type: string }[];
    total: number;
  };
  error?: string;
}> {
  const pkg = packages.get(input.packageId);

  if (!pkg) {
    return {
      success: false,
      packageId: input.packageId,
      targetInstanceId: input.targetInstanceId,
      preview: { toCreate: [], toUpdate: [], unchanged: [], total: 0 },
      error: `Package "${input.packageId}" not found`
    };
  }

  const targetClient = getClientForInstance(input.targetInstanceId, client);

  if (!targetClient) {
    return {
      success: false,
      packageId: input.packageId,
      targetInstanceId: input.targetInstanceId,
      preview: { toCreate: [], toUpdate: [], unchanged: [], total: 0 },
      error: `Target instance "${input.targetInstanceId}" not registered`
    };
  }

  const toCreate: { name: string; type: string }[] = [];
  const toUpdate: { name: string; type: string; sourceHash: string; targetHash: string }[] = [];
  const unchanged: { name: string; type: string }[] = [];

  for (const artifact of pkg.artifacts) {
    const targetArtifact = await fetchArtifact(targetClient, artifact.type, artifact.name);

    if (!targetArtifact) {
      toCreate.push({ name: artifact.name, type: artifact.type });
    } else if (targetArtifact.hash !== artifact.hash) {
      toUpdate.push({
        name: artifact.name,
        type: artifact.type,
        sourceHash: artifact.hash,
        targetHash: targetArtifact.hash
      });
    } else {
      unchanged.push({ name: artifact.name, type: artifact.type });
    }
  }

  return {
    success: true,
    packageId: input.packageId,
    targetInstanceId: input.targetInstanceId,
    preview: {
      toCreate,
      toUpdate,
      unchanged,
      total: pkg.artifacts.length
    }
  };
}

/**
 * Validate promotion for conflicts and dependencies
 */
export async function validatePromotion(
  client: ServiceNowClient,
  input: ValidatePromotionInput
): Promise<{
  success: boolean;
  packageId: string;
  validation: {
    isValid: boolean;
    conflicts: { artifact: string; issue: string; severity: 'warning' | 'error' }[];
    missingDependencies: { artifact: string; dependency: string }[];
    breakingChanges: { artifact: string; description: string }[];
    recommendations: string[];
  };
  error?: string;
}> {
  const pkg = packages.get(input.packageId);

  if (!pkg) {
    return {
      success: false,
      packageId: input.packageId,
      validation: {
        isValid: false,
        conflicts: [],
        missingDependencies: [],
        breakingChanges: [],
        recommendations: []
      },
      error: `Package "${input.packageId}" not found`
    };
  }

  const targetClient = getClientForInstance(input.targetInstanceId, client);

  if (!targetClient) {
    return {
      success: false,
      packageId: input.packageId,
      validation: {
        isValid: false,
        conflicts: [],
        missingDependencies: [],
        breakingChanges: [],
        recommendations: []
      },
      error: `Target instance "${input.targetInstanceId}" not registered`
    };
  }

  const conflicts: { artifact: string; issue: string; severity: 'warning' | 'error' }[] = [];
  const missingDependencies: { artifact: string; dependency: string }[] = [];
  const breakingChanges: { artifact: string; description: string }[] = [];
  const recommendations: string[] = [];

  for (const artifact of pkg.artifacts) {
    const targetArtifact = await fetchArtifact(targetClient, artifact.type, artifact.name);

    // Check for conflicts
    if (input.checkConflicts && targetArtifact) {
      // Check if target was modified more recently
      if (targetArtifact.updatedOn > artifact.updatedOn) {
        conflicts.push({
          artifact: `${artifact.type}/${artifact.name}`,
          issue: `Target was modified after source (${targetArtifact.updatedOn} > ${artifact.updatedOn})`,
          severity: 'warning'
        });
      }
    }

    // Check for dependencies (script includes referenced)
    if (input.checkDependencies && artifact.script) {
      const scriptIncludeRefs = artifact.script.match(/new\s+(\w+)\s*\(/g) || [];
      for (const ref of scriptIncludeRefs) {
        const className = ref.replace(/new\s+/, '').replace(/\s*\(/, '');
        // Check if this class exists in package or target
        const inPackage = pkg.artifacts.some(a => a.type === 'script_include' && a.name === className);
        if (!inPackage && className !== 'GlideRecord' && className !== 'GlideAjax' && !className.startsWith('Glide')) {
          const inTarget = await fetchArtifact(targetClient, 'script_include', className);
          if (!inTarget) {
            missingDependencies.push({
              artifact: `${artifact.type}/${artifact.name}`,
              dependency: `Script Include: ${className}`
            });
          }
        }
      }
    }

    // Check for breaking changes
    if (input.checkBreakingChanges && targetArtifact && artifact.script) {
      // Check if function signatures changed
      const sourceFunctions = artifact.script.match(/function\s+(\w+)\s*\([^)]*\)/g) || [];
      const targetFunctions = targetArtifact.script?.match(/function\s+(\w+)\s*\([^)]*\)/g) || [];

      for (const targetFn of targetFunctions) {
        const fnName = targetFn.match(/function\s+(\w+)/)?.[1];
        if (fnName && !sourceFunctions.some(sf => sf.includes(fnName))) {
          breakingChanges.push({
            artifact: `${artifact.type}/${artifact.name}`,
            description: `Function "${fnName}" exists in target but not in source - may break callers`
          });
        }
      }
    }
  }

  // Generate recommendations
  if (conflicts.length > 0) {
    recommendations.push('Review conflicts carefully - target instance has newer changes');
  }
  if (missingDependencies.length > 0) {
    recommendations.push('Add missing dependencies to promotion package or ensure they exist in target');
  }
  if (breakingChanges.length > 0) {
    recommendations.push('Test thoroughly after promotion - potential breaking changes detected');
  }
  if (conflicts.length === 0 && missingDependencies.length === 0 && breakingChanges.length === 0) {
    recommendations.push('Validation passed - safe to promote');
  }

  const hasErrors = conflicts.some(c => c.severity === 'error');
  pkg.status = hasErrors ? 'draft' : 'validated';
  packages.set(input.packageId, pkg);

  return {
    success: true,
    packageId: input.packageId,
    validation: {
      isValid: !hasErrors && missingDependencies.length === 0,
      conflicts,
      missingDependencies,
      breakingChanges,
      recommendations
    }
  };
}

/**
 * Execute the promotion (apply changes to target instance)
 */
export async function executePromotion(
  client: ServiceNowClient,
  input: ExecutePromotionInput
): Promise<{
  success: boolean;
  promotionId: string;
  dryRun: boolean;
  result: {
    created: { name: string; type: string; sysId?: string }[];
    updated: { name: string; type: string; sysId: string }[];
    skipped: { name: string; type: string; reason: string }[];
    failed: { name: string; type: string; error: string }[];
  };
  backup?: { id: string; artifactCount: number };
  error?: string;
}> {
  const pkg = packages.get(input.packageId);

  if (!pkg) {
    return {
      success: false,
      promotionId: '',
      dryRun: input.dryRun,
      result: { created: [], updated: [], skipped: [], failed: [] },
      error: `Package "${input.packageId}" not found`
    };
  }

  const targetClient = getClientForInstance(input.targetInstanceId, client);

  if (!targetClient) {
    return {
      success: false,
      promotionId: '',
      dryRun: input.dryRun,
      result: { created: [], updated: [], skipped: [], failed: [] },
      error: `Target instance "${input.targetInstanceId}" not registered`
    };
  }

  const promotionId = generatePromotionId();
  const created: { name: string; type: string; sysId?: string }[] = [];
  const updated: { name: string; type: string; sysId: string }[] = [];
  const skipped: { name: string; type: string; reason: string }[] = [];
  const failed: { name: string; type: string; error: string }[] = [];
  const backups: ArtifactSnapshot[] = [];
  const changes: PromotionRecord['changes'] = [];

  for (const artifact of pkg.artifacts) {
    const targetArtifact = await fetchArtifact(targetClient, artifact.type, artifact.name);

    if (targetArtifact) {
      // Backup existing
      if (input.createBackup) {
        backups.push(targetArtifact);
      }

      // Check if update needed
      if (targetArtifact.hash === artifact.hash) {
        skipped.push({ name: artifact.name, type: artifact.type, reason: 'Identical content' });
        changes.push({ artifact: `${artifact.type}/${artifact.name}`, action: 'skipped' });
        continue;
      }

      // Update (dry run or actual)
      if (!input.dryRun) {
        try {
          await targetClient.updateRecord(artifact.table, targetArtifact.sysId, {
            script: artifact.script,
            active: artifact.active
          });
          updated.push({ name: artifact.name, type: artifact.type, sysId: targetArtifact.sysId });
          changes.push({ artifact: `${artifact.type}/${artifact.name}`, action: 'updated', previousHash: targetArtifact.hash });
        } catch (error) {
          failed.push({ name: artifact.name, type: artifact.type, error: String(error) });
        }
      } else {
        updated.push({ name: artifact.name, type: artifact.type, sysId: targetArtifact.sysId });
        changes.push({ artifact: `${artifact.type}/${artifact.name}`, action: 'updated', previousHash: targetArtifact.hash });
      }
    } else {
      // Create new (dry run or actual)
      if (!input.dryRun) {
        try {
          const newRecord = await targetClient.createRecord(artifact.table, {
            name: artifact.name,
            script: artifact.script,
            active: artifact.active
          });
          created.push({ name: artifact.name, type: artifact.type, sysId: String(newRecord.sys_id) });
          changes.push({ artifact: `${artifact.type}/${artifact.name}`, action: 'created' });
        } catch (error) {
          failed.push({ name: artifact.name, type: artifact.type, error: String(error) });
        }
      } else {
        created.push({ name: artifact.name, type: artifact.type });
        changes.push({ artifact: `${artifact.type}/${artifact.name}`, action: 'created' });
      }
    }
  }

  // Record the promotion
  const promotionRecord: PromotionRecord = {
    id: promotionId,
    packageId: input.packageId,
    packageName: pkg.name,
    sourceInstanceId: pkg.sourceInstanceId,
    targetInstanceId: input.targetInstanceId,
    artifactCount: pkg.artifacts.length,
    status: failed.length > 0 ? 'failed' : 'completed',
    executedAt: new Date().toISOString(),
    executedBy: 'system',
    backups,
    changes
  };

  if (!input.dryRun) {
    promotionHistory.push(promotionRecord);
    pkg.status = failed.length > 0 ? 'failed' : 'promoted';
    packages.set(input.packageId, pkg);
  }

  return {
    success: failed.length === 0,
    promotionId,
    dryRun: input.dryRun,
    result: { created, updated, skipped, failed },
    backup: backups.length > 0 ? { id: promotionId, artifactCount: backups.length } : undefined
  };
}

/**
 * Rollback a promotion to previous state
 */
export async function rollbackPromotion(
  client: ServiceNowClient,
  input: RollbackPromotionInput
): Promise<{
  success: boolean;
  promotionId: string;
  rollback: {
    restored: { name: string; type: string }[];
    failed: { name: string; type: string; error: string }[];
  };
  error?: string;
}> {
  const promotion = promotionHistory.find(p => p.id === input.promotionId);

  if (!promotion) {
    return {
      success: false,
      promotionId: input.promotionId,
      rollback: { restored: [], failed: [] },
      error: `Promotion "${input.promotionId}" not found`
    };
  }

  if (promotion.status === 'rolled_back') {
    return {
      success: false,
      promotionId: input.promotionId,
      rollback: { restored: [], failed: [] },
      error: 'Promotion already rolled back'
    };
  }

  if (promotion.backups.length === 0) {
    return {
      success: false,
      promotionId: input.promotionId,
      rollback: { restored: [], failed: [] },
      error: 'No backups available for rollback'
    };
  }

  const targetClient = getClientForInstance(promotion.targetInstanceId, client);

  if (!targetClient) {
    return {
      success: false,
      promotionId: input.promotionId,
      rollback: { restored: [], failed: [] },
      error: `Target instance "${promotion.targetInstanceId}" not available`
    };
  }

  const restored: { name: string; type: string }[] = [];
  const failed: { name: string; type: string; error: string }[] = [];

  for (const backup of promotion.backups) {
    try {
      await targetClient.updateRecord(backup.table, backup.sysId, {
        script: backup.script,
        active: backup.active
      });
      restored.push({ name: backup.name, type: backup.type });
    } catch (error) {
      failed.push({ name: backup.name, type: backup.type, error: String(error) });
    }
  }

  // Update promotion status
  promotion.status = failed.length === 0 ? 'rolled_back' : 'failed';

  return {
    success: failed.length === 0,
    promotionId: input.promotionId,
    rollback: { restored, failed }
  };
}

/**
 * List promotion history
 */
export async function listPromotionHistory(
  _client: ServiceNowClient,
  input: ListPromotionHistoryInput
): Promise<{
  success: boolean;
  promotions: Omit<PromotionRecord, 'backups' | 'changes'>[];
  total: number;
}> {
  let filtered = promotionHistory;

  if (input.status !== 'all') {
    filtered = promotionHistory.filter(p => p.status === input.status);
  }

  const promotions = filtered
    .slice(-input.limit)
    .reverse()
    .map(({ backups: _b, changes: _c, ...rest }) => rest);

  return {
    success: true,
    promotions,
    total: filtered.length
  };
}

/**
 * List available promotion packages
 */
export async function listPromotionPackages(
  _client: ServiceNowClient,
  _input: {}
): Promise<{
  success: boolean;
  packages: Omit<PromotionPackage, 'artifacts'>[];
  total: number;
}> {
  const pkgs = Array.from(packages.values()).map(({ artifacts: _a, ...rest }) => ({
    ...rest,
    artifactCount: _a.length
  }));

  return {
    success: true,
    packages: pkgs as any,
    total: pkgs.length
  };
}

