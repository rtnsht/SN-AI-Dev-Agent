/**
 * Unit Tests for Instance Analyzer Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient, mockBusinessRule, mockScriptInclude, mockACL, mockUpdateSet } from '../mocks/sn-client.mock';
import { analyzeInstanceSchema, analyzeInstance } from '../../src/tools/instance-analyzer';

describe('Instance Analyzer', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('Schema Validation', () => {
    it('should have valid schema with defaults', () => {
      const parsed = analyzeInstanceSchema.parse({});
      expect(parsed).toBeDefined();
    });

    it('should accept scope filter', () => {
      const parsed = analyzeInstanceSchema.parse({
        scope: 'x_custom_app'
      });
      expect(parsed.scope).toBe('x_custom_app');
    });

    it('should accept category filters', () => {
      const parsed = analyzeInstanceSchema.parse({
        categories: ['server_scripts', 'security']
      });
      expect(parsed.categories).toContain('server_scripts');
    });
  });

  describe('Instance Analysis', () => {
    it('should analyze business rules', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({ name: 'BR1' }),
        mockBusinessRule({ name: 'BR2' })
      ]);

      const result = await analyzeInstance(
        mockClient as any,
        analyzeInstanceSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
    });

    it('should analyze script includes', async () => {
      mockClient.setMockData('sys_script_include', [
        mockScriptInclude({ name: 'SI1' }),
        mockScriptInclude({ name: 'SI2' })
      ]);

      const result = await analyzeInstance(
        mockClient as any,
        analyzeInstanceSchema.parse({})
      );

      expect(result.success).toBe(true);
    });

    it('should analyze ACLs', async () => {
      mockClient.setMockData('sys_security_acl', [
        mockACL({ name: 'ACL1' })
      ]);

      const result = await analyzeInstance(
        mockClient as any,
        analyzeInstanceSchema.parse({})
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Summary', () => {
    it('should provide summary', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await analyzeInstance(
        mockClient as any,
        analyzeInstanceSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await analyzeInstance(
        mockClient as any,
        analyzeInstanceSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should provide artifact counts', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({}),
        mockBusinessRule({})
      ]);
      mockClient.setMockData('sys_update_set', [
        mockUpdateSet({})
      ]);

      const result = await analyzeInstance(
        mockClient as any,
        analyzeInstanceSchema.parse({})
      );

      expect(result.success).toBe(true);
    });
  });
});

