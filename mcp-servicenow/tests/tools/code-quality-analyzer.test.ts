/**
 * Unit Tests for Code Quality Analyzer Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient, mockBusinessRule, mockScriptInclude } from '../mocks/sn-client.mock';
import { codeQualityScoreSchema, getCodeQualityScore } from '../../src/tools/code-quality-analyzer';

describe('Code Quality Analyzer', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('Schema Validation', () => {
    it('should have valid schema with defaults', () => {
      const parsed = codeQualityScoreSchema.parse({});
      expect(parsed.artifactType).toBe('all');
      expect(parsed.limit).toBe(100);
    });

    it('should accept artifact type filter', () => {
      const parsed = codeQualityScoreSchema.parse({
        artifactType: 'business_rule'
      });
      expect(parsed.artifactType).toBe('business_rule');
    });

    it('should accept scope filter', () => {
      const parsed = codeQualityScoreSchema.parse({
        scope: 'x_custom_app'
      });
      expect(parsed.scope).toBe('x_custom_app');
    });
  });

  describe('Quality Grading', () => {
    it('should analyze code quality', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          name: 'Well Written BR',
          script: `
            (function executeRule(current, previous) {
              if (current.state.changesTo(2)) {
                current.work_notes = 'Updated';
              }
            })(current, previous);
          `
        })
      ]);

      const result = await getCodeQualityScore(
        mockClient as any,
        codeQualityScoreSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.averageScore).toBeDefined();
    });

    it('should return score between 0 and 100', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await getCodeQualityScore(
        mockClient as any,
        codeQualityScoreSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.summary.averageScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageScore).toBeLessThanOrEqual(100);
    });

    it('should assign grade A-F', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await getCodeQualityScore(
        mockClient as any,
        codeQualityScoreSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.summary.overallGrade);
    });
  });

  describe('Breakdown Analysis', () => {
    it('should provide artifact breakdown', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);
      mockClient.setMockData('sys_script_include', [mockScriptInclude({})]);

      const result = await getCodeQualityScore(
        mockClient as any,
        codeQualityScoreSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
    });
  });

  describe('Recommendations', () => {
    it('should provide improvement recommendations', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          script: 'current.update(); current.update(); current.update();'
        })
      ]);

      const result = await getCodeQualityScore(
        mockClient as any,
        codeQualityScoreSchema.parse({})
      );

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});

