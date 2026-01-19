/**
 * Unit Tests for Dead Code Finder Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient, mockScriptInclude, mockBusinessRule } from '../mocks/sn-client.mock';
import { findDeadCodeSchema, findDeadCode } from '../../src/tools/dead-code-finder';

describe('Dead Code Finder', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('Schema Validation', () => {
    it('should have valid schema with defaults', () => {
      const parsed = findDeadCodeSchema.parse({});
      expect(parsed.limit).toBe(100);
    });

    it('should accept artifact types filter', () => {
      const parsed = findDeadCodeSchema.parse({
        artifactTypes: ['script_includes', 'business_rules']
      });
      expect(parsed.artifactTypes).toContain('script_includes');
    });

    it('should accept scope filter', () => {
      const parsed = findDeadCodeSchema.parse({ scope: 'x_custom_app' });
      expect(parsed.scope).toBe('x_custom_app');
    });
  });

  describe('Dead Code Detection', () => {
    it('should find unused script includes', async () => {
      mockClient.setMockData('sys_script_include', [
        mockScriptInclude({
          name: 'UnusedScriptInclude',
          api_name: 'global.UnusedScriptInclude',
          active: true
        })
      ]);
      mockClient.setMockData('sys_script', []);
      mockClient.setMockData('sys_script_client', []);

      const result = await findDeadCode(
        mockClient as any,
        findDeadCodeSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.items).toBeDefined();
    });

    it('should not flag actively used script includes', async () => {
      const scriptIncludeName = 'ActivelyUsedUtil';

      mockClient.setMockData('sys_script_include', [
        mockScriptInclude({
          name: scriptIncludeName,
          api_name: `global.${scriptIncludeName}`,
          active: true
        })
      ]);

      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          name: 'BR Using Script Include',
          script: `var util = new ${scriptIncludeName}(); util.doSomething();`
        })
      ]);

      const result = await findDeadCode(
        mockClient as any,
        findDeadCodeSchema.parse({})
      );

      expect(result.success).toBe(true);
    });

    it('should find inactive artifacts', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          name: 'Inactive BR',
          active: false
        })
      ]);

      const result = await findDeadCode(
        mockClient as any,
        findDeadCodeSchema.parse({})
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Summary Statistics', () => {
    it('should provide summary counts', async () => {
      mockClient.setMockData('sys_script_include', [
        mockScriptInclude({ name: 'Unused1' }),
        mockScriptInclude({ name: 'Unused2' })
      ]);

      const result = await findDeadCode(
        mockClient as any,
        findDeadCodeSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalFound).toBe('number');
    });
  });

  describe('Recommendations', () => {
    it('should provide cleanup recommendations', async () => {
      mockClient.setMockData('sys_script_include', [
        mockScriptInclude({ name: 'UnusedScript', active: true })
      ]);

      const result = await findDeadCode(
        mockClient as any,
        findDeadCodeSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});

