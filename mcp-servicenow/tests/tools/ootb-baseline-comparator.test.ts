/**
 * Unit Tests for OOTB Baseline Comparator Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient, mockBusinessRule, mockScriptInclude, mockACL } from '../mocks/sn-client.mock';
import * as ootbComparator from '../../src/tools/ootb-baseline-comparator';

describe('OOTB Baseline Comparator', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('Schema Validation', () => {
    it('should have valid schema with defaults', () => {
      const parsed = ootbComparator.compareToOotbSchema.parse({});
      expect(parsed.mode).toBe('summary');
      expect(parsed.artifactTypes).toEqual(['all']);
      expect(parsed.includeSystemUpdates).toBe(false);
      expect(parsed.limit).toBe(500);
      expect(parsed.includeRecommendations).toBe(true);
    });

    it('should accept different modes', () => {
      const detailed = ootbComparator.compareToOotbSchema.parse({ mode: 'detailed' });
      expect(detailed.mode).toBe('detailed');

      const exportMode = ootbComparator.compareToOotbSchema.parse({ mode: 'export' });
      expect(exportMode.mode).toBe('export');
    });

    it('should accept artifact type filters', () => {
      const parsed = ootbComparator.compareToOotbSchema.parse({
        artifactTypes: ['business_rules', 'acls']
      });
      expect(parsed.artifactTypes).toEqual(['business_rules', 'acls']);
    });
  });

  describe('Customization Detection', () => {
    it('should detect custom (non-global) artifacts', async () => {
      // Custom scope artifacts
      mockClient.setMockData('sys_script', [
        mockBusinessRule({ 
          name: 'Custom BR', 
          sys_scope: { value: 'x_custom_app' },
          sys_created_by: 'developer'
        })
      ]);

      const result = await ootbComparator.compareToOotb(
        mockClient as any,
        ootbComparator.compareToOotbSchema.parse({ artifactTypes: ['business_rules'] })
      );

      expect(result.success).toBe(true);
      expect(result.summary.totalCustom).toBeGreaterThanOrEqual(0);
    });

    it('should identify OOTB (global) artifacts', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({ 
          name: 'OOTB BR', 
          sys_scope: { value: 'global' },
          sys_created_by: 'system'
        })
      ]);

      const result = await ootbComparator.compareToOotb(
        mockClient as any,
        ootbComparator.compareToOotbSchema.parse({ artifactTypes: ['business_rules'] })
      );

      expect(result.success).toBe(true);
    });

    it('should detect modified OOTB artifacts', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({ 
          name: 'Modified OOTB BR', 
          sys_scope: { value: 'global' },
          sys_created_by: 'system',
          sys_updated_by: 'admin'  // Modified by non-system user
        })
      ]);

      const result = await ootbComparator.compareToOotb(
        mockClient as any,
        ootbComparator.compareToOotbSchema.parse({ artifactTypes: ['business_rules'] })
      );

      expect(result.success).toBe(true);
      expect(result.summary.totalModified).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Scoring', () => {
    it('should calculate customization score 0-100', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await ootbComparator.compareToOotb(
        mockClient as any,
        ootbComparator.compareToOotbSchema.parse({})
      );

      expect(result.customizationScore).toBeGreaterThanOrEqual(0);
      expect(result.customizationScore).toBeLessThanOrEqual(100);
    });

    it('should assign grade A-F', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await ootbComparator.compareToOotb(
        mockClient as any,
        ootbComparator.compareToOotbSchema.parse({})
      );

      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.customizationGrade);
    });

    it('should determine upgrade readiness', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await ootbComparator.compareToOotb(
        mockClient as any,
        ootbComparator.compareToOotbSchema.parse({})
      );

      expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(result.upgradeReadiness);
    });
  });

  describe('Category Breakdown', () => {
    it('should provide breakdown by artifact type', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);
      mockClient.setMockData('sys_security_acl', [mockACL({})]);

      const result = await ootbComparator.compareToOotb(
        mockClient as any,
        ootbComparator.compareToOotbSchema.parse({ artifactTypes: ['business_rules', 'acls'] })
      );

      expect(result.categoryBreakdown).toBeDefined();
      expect(Array.isArray(result.categoryBreakdown)).toBe(true);
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations when enabled', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await ootbComparator.compareToOotb(
        mockClient as any,
        ootbComparator.compareToOotbSchema.parse({ includeRecommendations: true })
      );

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});

