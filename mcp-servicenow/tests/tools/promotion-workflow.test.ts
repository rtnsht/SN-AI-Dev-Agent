/**
 * Tests for Promotion Workflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPromotionPackage,
  previewPromotion,
  validatePromotion,
  executePromotion,
  rollbackPromotion,
  listPromotionHistory,
  listPromotionPackages
} from '../../src/tools/promotion-workflow.js';
import { registerInstanceEnhanced } from '../../src/tools/multi-instance-manager.js';
import { MockServiceNowClient } from '../mocks/sn-client.mock.js';

describe('Promotion Workflow', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(async () => {
    mockClient = new MockServiceNowClient();
    
    // Register test instances
    await registerInstanceEnhanced(mockClient as any, {
      instanceId: 'promo-dev',
      name: 'Promo Dev',
      url: 'https://dev.service-now.com',
      environment: 'dev',
      username: 'admin',
      password: 'pass'
    });
    
    await registerInstanceEnhanced(mockClient as any, {
      instanceId: 'promo-prod',
      name: 'Promo Prod',
      url: 'https://prod.service-now.com',
      environment: 'prod',
      username: 'admin',
      password: 'pass'
    });
  });

  describe('createPromotionPackage', () => {
    it('should fail for unregistered source instance', async () => {
      const result = await createPromotionPackage(mockClient as any, {
        packageName: 'Test Package',
        sourceInstanceId: 'unknown-instance',
        artifacts: [{ type: 'business_rule', name: 'TestRule' }]
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    it('should create package with valid input', async () => {
      const result = await createPromotionPackage(mockClient as any, {
        packageName: 'My Package',
        sourceInstanceId: 'promo-dev',
        artifacts: [
          { type: 'business_rule', name: 'Rule1' },
          { type: 'script_include', name: 'Utils' }
        ],
        description: 'Test promotion'
      });

      expect(result.packageId).toBeTruthy();
      expect(result.package.name).toBe('My Package');
      expect(result.package.sourceInstanceId).toBe('promo-dev');
    });

    it('should report artifacts not found', async () => {
      const result = await createPromotionPackage(mockClient as any, {
        packageName: 'Package with missing',
        sourceInstanceId: 'promo-dev',
        artifacts: [{ type: 'business_rule', name: 'NonExistent' }]
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not found');
    });
  });

  describe('previewPromotion', () => {
    it('should fail for unknown package', async () => {
      const result = await previewPromotion(mockClient as any, {
        packageId: 'unknown-pkg',
        targetInstanceId: 'promo-prod'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail for unregistered target instance', async () => {
      // First create a package
      const pkg = await createPromotionPackage(mockClient as any, {
        packageName: 'Preview Test',
        sourceInstanceId: 'promo-dev',
        artifacts: []
      });

      const result = await previewPromotion(mockClient as any, {
        packageId: pkg.packageId,
        targetInstanceId: 'unknown-target'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });
  });

  describe('validatePromotion', () => {
    it('should fail for unknown package', async () => {
      const result = await validatePromotion(mockClient as any, {
        packageId: 'unknown-pkg',
        targetInstanceId: 'promo-prod'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('executePromotion', () => {
    it('should fail for unknown package', async () => {
      const result = await executePromotion(mockClient as any, {
        packageId: 'unknown-pkg',
        targetInstanceId: 'promo-prod',
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should respect dryRun flag', async () => {
      const pkg = await createPromotionPackage(mockClient as any, {
        packageName: 'DryRun Test',
        sourceInstanceId: 'promo-dev',
        artifacts: []
      });

      const result = await executePromotion(mockClient as any, {
        packageId: pkg.packageId,
        targetInstanceId: 'promo-prod',
        dryRun: true
      });

      expect(result.dryRun).toBe(true);
    });
  });

  describe('rollbackPromotion', () => {
    it('should fail for unknown promotion', async () => {
      const result = await rollbackPromotion(mockClient as any, {
        promotionId: 'unknown-promo'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('listPromotionHistory', () => {
    it('should return empty list initially', async () => {
      const result = await listPromotionHistory(mockClient as any, {
        limit: 10,
        status: 'all'
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.promotions)).toBe(true);
    });
  });

  describe('listPromotionPackages', () => {
    it('should list created packages', async () => {
      await createPromotionPackage(mockClient as any, {
        packageName: 'List Test',
        sourceInstanceId: 'promo-dev',
        artifacts: []
      });

      const result = await listPromotionPackages(mockClient as any, {});

      expect(result.success).toBe(true);
      expect(result.packages.length).toBeGreaterThan(0);
    });
  });
});

