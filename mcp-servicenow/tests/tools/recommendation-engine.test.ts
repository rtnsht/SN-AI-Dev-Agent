/**
 * Tests for AI-Powered Recommendation Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient } from '../mocks/sn-client.mock.js';
import {
  getFixRecommendations,
  getBestPractices,
  getCodeTemplates,
  getFixRecommendationsSchema,
  getBestPracticesSchema,
  getCodeTemplatesSchema
} from '../../src/tools/recommendation-engine.js';

describe('Recommendation Engine', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('getFixRecommendations', () => {
    it('should return recommendations for gr_in_client issue', async () => {
      const input = getFixRecommendationsSchema.parse({
        issueType: 'gr_in_client'
      });

      const result = await getFixRecommendations(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.issueType).toBe('gr_in_client');
      expect(result.recommendation).not.toBeNull();
      expect(result.recommendation?.severity).toBe('critical');
      expect(result.recommendation?.fixPatterns.length).toBeGreaterThan(0);
    });

    it('should return recommendations for hardcoded_sysid issue', async () => {
      const input = getFixRecommendationsSchema.parse({
        issueType: 'hardcoded_sysid'
      });

      const result = await getFixRecommendations(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.recommendation?.severity).toBe('high');
      expect(result.recommendation?.title).toContain('Hardcoded');
    });

    it('should return recommendations for answer_true_acl issue', async () => {
      const input = getFixRecommendationsSchema.parse({
        issueType: 'answer_true_acl'
      });

      const result = await getFixRecommendations(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.recommendation?.severity).toBe('critical');
      expect(result.recommendation?.impact).toContain('Complete bypass of security controls');
    });

    it('should provide contextual advice for client scripts', async () => {
      const input = getFixRecommendationsSchema.parse({
        issueType: 'gr_in_client',
        context: {
          artifactType: 'client_script',
          artifactName: 'Test Script'
        }
      });

      const result = await getFixRecommendations(mockClient as any, input);

      expect(result.contextualAdvice.length).toBeGreaterThan(0);
      expect(result.contextualAdvice.some(a => a.includes('GlideAjax'))).toBe(true);
    });

    it('should provide suggested fix when code is provided', async () => {
      const input = getFixRecommendationsSchema.parse({
        issueType: 'gr_in_client',
        code: 'var gr = new GlideRecord("incident"); gr.query();'
      });

      const result = await getFixRecommendations(mockClient as any, input);

      expect(result.suggestedFix).not.toBeNull();
    });

    it('should handle unknown issue types gracefully', async () => {
      // Use a valid enum value but one without detailed recommendations
      const input = getFixRecommendationsSchema.parse({
        issueType: 'deprecated_api'
      });

      const result = await getFixRecommendations(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.contextualAdvice.length).toBeGreaterThan(0);
    });
  });

  describe('getBestPractices', () => {
    it('should return best practices for business_rule', async () => {
      const input = getBestPracticesSchema.parse({
        artifactType: 'business_rule'
      });

      const result = await getBestPractices(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.artifactType).toBe('business_rule');
      expect(result.guide).not.toBeNull();
      expect(result.guide?.doList.length).toBeGreaterThan(0);
      expect(result.guide?.dontList.length).toBeGreaterThan(0);
    });

    it('should return best practices for client_script', async () => {
      const input = getBestPracticesSchema.parse({
        artifactType: 'client_script'
      });

      const result = await getBestPractices(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.guide?.dontList).toContain('Never use GlideRecord');
    });

    it('should return best practices for acl', async () => {
      const input = getBestPracticesSchema.parse({
        artifactType: 'acl'
      });

      const result = await getBestPractices(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.guide?.securityConsiderations.length).toBeGreaterThan(0);
    });

    it('should provide action-specific advice for create', async () => {
      const input = getBestPracticesSchema.parse({
        artifactType: 'script_include',
        action: 'create'
      });

      const result = await getBestPractices(mockClient as any, input);

      expect(result.actionSpecificAdvice.some(a => a.includes('template'))).toBe(true);
    });

    it('should provide action-specific advice for review', async () => {
      const input = getBestPracticesSchema.parse({
        artifactType: 'business_rule',
        action: 'review'
      });

      const result = await getBestPractices(mockClient as any, input);

      expect(result.actionSpecificAdvice.some(a => a.includes("don't"))).toBe(true);
    });
  });

  describe('getCodeTemplates', () => {
    it('should return template for gliderecord_query', async () => {
      const input = getCodeTemplatesSchema.parse({
        pattern: 'gliderecord_query'
      });

      const result = await getCodeTemplates(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.pattern).toBe('gliderecord_query');
      expect(result.template).not.toBeNull();
      expect(result.template?.code).toContain('GlideRecord');
    });

    it('should return template for script_include_class', async () => {
      const input = getCodeTemplatesSchema.parse({
        pattern: 'script_include_class'
      });

      const result = await getCodeTemplates(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.template?.code).toContain('Class.create');
      expect(result.template?.code).toContain('type:');
    });

    it('should return template for error_handling', async () => {
      const input = getCodeTemplatesSchema.parse({
        pattern: 'error_handling'
      });

      const result = await getCodeTemplates(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.template?.code).toContain('try');
      expect(result.template?.code).toContain('catch');
    });

    it('should substitute table option in template', async () => {
      const input = getCodeTemplatesSchema.parse({
        pattern: 'gliderecord_query',
        options: { table: 'incident' }
      });

      const result = await getCodeTemplates(mockClient as any, input);

      expect(result.template?.code).toContain('incident');
    });

    it('should return related patterns', async () => {
      const input = getCodeTemplatesSchema.parse({
        pattern: 'gliderecord_query'
      });

      const result = await getCodeTemplates(mockClient as any, input);

      expect(result.relatedPatterns.length).toBeGreaterThan(0);
      expect(result.relatedPatterns).toContain('null_check');
    });
  });
});

