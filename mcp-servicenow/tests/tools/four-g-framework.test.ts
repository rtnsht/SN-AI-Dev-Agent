/**
 * Unit Tests for 4G Framework Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient, mockBusinessRule } from '../mocks/sn-client.mock';
import { apply4GFrameworkSchema, apply4GFramework } from '../../src/tools/four-g-framework';

describe('4G Framework', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('Schema Validation', () => {
    it('should require action type', () => {
      expect(() => apply4GFrameworkSchema.parse({})).toThrow();
    });

    it('should accept valid action types', () => {
      const actions = ['create_business_rule', 'create_client_script', 'create_script_include', 'create_acl'];
      actions.forEach(action => {
        const parsed = apply4GFrameworkSchema.parse({
          action: action,
          artifactName: 'Test Artifact',
          targetTable: 'incident'
        });
        expect(parsed.action).toBe(action);
      });
    });

    it('should accept target table', () => {
      const parsed = apply4GFrameworkSchema.parse({
        action: 'create_business_rule',
        artifactName: 'Test BR',
        targetTable: 'incident'
      });
      expect(parsed.targetTable).toBe('incident');
    });

    it('should accept script', () => {
      const parsed = apply4GFrameworkSchema.parse({
        action: 'create_business_rule',
        artifactName: 'Test BR',
        targetTable: 'incident',
        script: 'current.priority = 1;'
      });
      expect(parsed.script).toBe('current.priority = 1;');
    });
  });

  describe('Generate Action', () => {
    it('should generate code based on requirements', async () => {
      const result = await apply4GFramework(
        mockClient as any,
        apply4GFrameworkSchema.parse({
          action: 'create_business_rule',
          artifactName: 'Set Priority BR',
          targetTable: 'incident',
          script: 'current.priority = 1;'
        })
      );

      expect(result.success).toBe(true);
      expect(result.guardrails).toBeDefined();
    });
  });

  describe('Governance', () => {
    it('should include governance checks', async () => {
      mockClient.setMockData('sys_script', [mockBusinessRule({})]);

      const result = await apply4GFramework(
        mockClient as any,
        apply4GFrameworkSchema.parse({
          action: 'create_business_rule',
          artifactName: 'Test BR',
          targetTable: 'incident'
        })
      );

      expect(result.success).toBe(true);
      expect(result.governance).toBeDefined();
    });
  });

  describe('Guidance', () => {
    it('should provide guidance', async () => {
      const result = await apply4GFramework(
        mockClient as any,
        apply4GFrameworkSchema.parse({
          action: 'create_acl',
          artifactName: 'Test ACL',
          targetTable: 'incident'
        })
      );

      expect(result.success).toBe(true);
      expect(result.guidance).toBeDefined();
    });
  });

  describe('Guardrails', () => {
    it('should include guardrail checks', async () => {
      const result = await apply4GFramework(
        mockClient as any,
        apply4GFrameworkSchema.parse({
          action: 'create_business_rule',
          artifactName: 'Test BR',
          targetTable: 'sys_user'
        })
      );

      expect(result.success).toBe(true);
      expect(result.guardrails).toBeDefined();
    });
  });

  describe('Combined Workflow', () => {
    it('should handle full workflow context', async () => {
      const result = await apply4GFramework(
        mockClient as any,
        apply4GFrameworkSchema.parse({
          action: 'create_business_rule',
          artifactName: 'Secure BR',
          targetTable: 'incident',
          persona: 'senior_developer'
        })
      );

      expect(result.success).toBe(true);
    });
  });
});

