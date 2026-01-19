/**
 * Unit Tests for Upgrade Readiness Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient, mockBusinessRule, mockScriptInclude } from '../mocks/sn-client.mock';
import { assessUpgradeReadinessSchema, assessUpgradeReadiness } from '../../src/tools/upgrade-readiness';

describe('Upgrade Readiness', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('Schema Validation', () => {
    it('should have valid schema with defaults', () => {
      const parsed = assessUpgradeReadinessSchema.parse({});
      expect(parsed).toBeDefined();
    });

    it('should accept target version', () => {
      const parsed = assessUpgradeReadinessSchema.parse({
        targetVersion: 'Vancouver'
      });
      expect(parsed.targetVersion).toBe('Vancouver');
    });

    it('should accept scope filter', () => {
      const parsed = assessUpgradeReadinessSchema.parse({
        scope: 'x_custom_app'
      });
      expect(parsed.scope).toBe('x_custom_app');
    });
  });

  describe('Readiness Assessment', () => {
    it('should assess upgrade readiness', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await assessUpgradeReadiness(
        mockClient as any,
        assessUpgradeReadinessSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.readinessScore).toBeDefined();
    });

    it('should return score 0-100', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await assessUpgradeReadiness(
        mockClient as any,
        assessUpgradeReadinessSchema.parse({})
      );

      expect(result.readinessScore).toBeGreaterThanOrEqual(0);
      expect(result.readinessScore).toBeLessThanOrEqual(100);
    });

    it('should return valid grade', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await assessUpgradeReadiness(
        mockClient as any,
        assessUpgradeReadinessSchema.parse({})
      );

      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
    });
  });

  describe('Risk Assessment', () => {
    it('should identify risks', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          sys_scope: { value: 'global' },
          sys_updated_by: 'admin'
        })
      ]);

      const result = await assessUpgradeReadiness(
        mockClient as any,
        assessUpgradeReadinessSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.risks).toBeDefined();
    });

    it('should categorize risks by severity', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);
      mockClient.setMockData('sys_script_include', [mockScriptInclude({})]);

      const result = await assessUpgradeReadiness(
        mockClient as any,
        assessUpgradeReadinessSchema.parse({})
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Recommendations', () => {
    it('should provide upgrade recommendations', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await assessUpgradeReadiness(
        mockClient as any,
        assessUpgradeReadinessSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});

