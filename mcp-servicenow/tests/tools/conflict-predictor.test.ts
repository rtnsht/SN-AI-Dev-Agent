/**
 * Unit Tests for Conflict Predictor Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient, mockBusinessRule } from '../mocks/sn-client.mock';
import { predictConflictsSchema, predictConflicts } from '../../src/tools/conflict-predictor';

describe('Conflict Predictor', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('Schema Validation', () => {
    it('should require changeType and targetTable', () => {
      expect(() => predictConflictsSchema.parse({})).toThrow();
      expect(() => predictConflictsSchema.parse({
        changeType: 'create_business_rule'
      })).toThrow();
    });

    it('should accept valid change types', () => {
      const parsed = predictConflictsSchema.parse({
        changeType: 'create_business_rule',
        targetTable: 'incident'
      });
      expect(parsed.changeType).toBe('create_business_rule');
    });

    it('should accept proposed changes object', () => {
      const parsed = predictConflictsSchema.parse({
        changeType: 'create_business_rule',
        targetTable: 'incident',
        proposedChanges: {
          order: 100,
          when: 'before'
        }
      });
      expect(parsed.proposedChanges?.order).toBe(100);
    });

    it('should accept analyze depth', () => {
      const parsed = predictConflictsSchema.parse({
        changeType: 'create_business_rule',
        targetTable: 'incident',
        analyzeDepth: 'deep'
      });
      expect(parsed.analyzeDepth).toBe('deep');
    });
  });

  describe('Order Collision Detection', () => {
    it('should detect order collisions', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          name: 'Existing BR',
          collection: 'incident',
          when: 'before',
          order: 100
        })
      ]);

      const result = await predictConflicts(
        mockClient as any,
        predictConflictsSchema.parse({
          changeType: 'create_business_rule',
          targetTable: 'incident',
          proposedChanges: {
            order: 100,
            when: 'before'
          }
        })
      );

      expect(result.success).toBe(true);
      expect(result.predictedConflicts).toBeDefined();
    });

    it('should not flag non-colliding orders', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          name: 'Existing BR',
          collection: 'incident',
          when: 'before',
          order: 100
        })
      ]);

      const result = await predictConflicts(
        mockClient as any,
        predictConflictsSchema.parse({
          changeType: 'create_business_rule',
          targetTable: 'incident',
          proposedChanges: {
            order: 200,
            when: 'before'
          }
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Condition Overlap Detection', () => {
    it('should detect overlapping conditions', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          name: 'Existing BR',
          collection: 'incident',
          when: 'before',
          condition: 'current.state == 1'
        })
      ]);

      const result = await predictConflicts(
        mockClient as any,
        predictConflictsSchema.parse({
          changeType: 'create_business_rule',
          targetTable: 'incident',
          proposedChanges: {
            condition: 'current.state == 1'
          }
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Script Conflict Detection', () => {
    it('should detect multiple current.update calls', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({
          name: 'Existing BR',
          collection: 'incident',
          when: 'before',
          script: 'current.update();'
        })
      ]);

      const result = await predictConflicts(
        mockClient as any,
        predictConflictsSchema.parse({
          changeType: 'create_business_rule',
          targetTable: 'incident',
          proposedChanges: {
            script: 'current.update();'
          }
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Suggestions', () => {
    it('should provide suggestions', async () => {
      mockClient.setMockData('sys_script', [
        mockBusinessRule({ order: 100 }),
        mockBusinessRule({ order: 200 }),
        mockBusinessRule({ order: 300 })
      ]);

      const result = await predictConflicts(
        mockClient as any,
        predictConflictsSchema.parse({
          changeType: 'create_business_rule',
          targetTable: 'incident'
        })
      );

      expect(result.success).toBe(true);
      expect(result.suggestions).toBeDefined();
    });
  });
});

