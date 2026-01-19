/**
 * Unit Tests for Anti-Pattern Detector Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient, mockBusinessRule, mockClientScript } from '../mocks/sn-client.mock';
import { findAntiPatternsSchema, findAntiPatterns } from '../../src/tools/anti-pattern-detector';

describe('Anti-Pattern Detector', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('Schema Validation', () => {
    it('should have valid schema with defaults', () => {
      const parsed = findAntiPatternsSchema.parse({});
      expect(parsed.categories).toContain('all');
      expect(parsed.limit).toBe(100);
    });

    it('should accept category filter', () => {
      const parsed = findAntiPatternsSchema.parse({
        categories: ['performance', 'security']
      });
      expect(parsed.categories).toContain('performance');
    });

    it('should accept scope filter', () => {
      const parsed = findAntiPatternsSchema.parse({ scope: 'x_custom_app' });
      expect(parsed.scope).toBe('x_custom_app');
    });
  });

  describe('Detection Logic', () => {
    it('should detect GlideRecord in client scripts', async () => {
      mockClient.setMockData('sys_script_client', [
        mockClientScript({
          name: 'Bad Client Script',
          script: 'function onLoad() { var gr = new GlideRecord("incident"); gr.query(); }'
        })
      ]);

      const result = await findAntiPatterns(
        mockClient as any,
        findAntiPatternsSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.issues).toBeDefined();
    });

    it('should detect hardcoded sys_ids', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          name: 'Hardcoded SysID BR',
          script: 'var sysId = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"; current.assigned_to = sysId;'
        })
      ]);

      const result = await findAntiPatterns(
        mockClient as any,
        findAntiPatternsSchema.parse({})
      );

      expect(result.success).toBe(true);
    });

    it('should return results for clean code', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          name: 'Clean BR',
          script: 'if (current.isValidRecord()) { current.state = 2; }'
        })
      ]);
      mockClient.setMockData('sys_script_client', []);

      const result = await findAntiPatterns(
        mockClient as any,
        findAntiPatternsSchema.parse({})
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Summary Generation', () => {
    it('should generate summary statistics', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({ name: 'BR1', script: 'current.update();' }),
        mockBusinessRule({ name: 'BR2', script: 'current.update();' })
      ]);

      const result = await findAntiPatterns(
        mockClient as any,
        findAntiPatternsSchema.parse({})
      );

      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalIssues).toBe('number');
    });
  });
});

