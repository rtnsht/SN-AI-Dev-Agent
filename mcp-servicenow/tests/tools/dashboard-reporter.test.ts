/**
 * Tests for Dashboard & Report Generator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient } from '../mocks/sn-client.mock.js';
import {
  generateReport,
  getDashboardData,
  generateReportSchema,
  getDashboardDataSchema
} from '../../src/tools/dashboard-reporter.js';

describe('Dashboard Reporter', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
    // Set up mock data for metrics collection
    mockClient.setMockData('sys_script', [
      { sys_id: '1', name: 'BR1' },
      { sys_id: '2', name: 'BR2' }
    ]);
    mockClient.setMockData('sys_script_client', [
      { sys_id: '1', name: 'CS1' }
    ]);
    mockClient.setMockData('sys_script_include', [
      { sys_id: '1', name: 'SI1' },
      { sys_id: '2', name: 'SI2' },
      { sys_id: '3', name: 'SI3' }
    ]);
  });

  describe('generateReport', () => {
    it('should generate HTML instance_health report', async () => {
      const input = generateReportSchema.parse({
        reportType: 'instance_health',
        format: 'html'
      });

      const result = await generateReport(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.reportType).toBe('instance_health');
      expect(result.format).toBe('html');
      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('Instance Health Report');
    });

    it('should generate HTML executive_summary report', async () => {
      const input = generateReportSchema.parse({
        reportType: 'executive_summary',
        format: 'html'
      });

      const result = await generateReport(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Executive Summary');
      expect(result.content).toContain('Instance Grade');
    });

    it('should generate JSON format report', async () => {
      const input = generateReportSchema.parse({
        reportType: 'instance_health',
        format: 'json'
      });

      const result = await generateReport(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      const parsed = JSON.parse(result.content);
      expect(parsed.reportType).toBe('instance_health');
      expect(parsed.metrics).toBeDefined();
    });

    it('should generate Markdown format report', async () => {
      const input = generateReportSchema.parse({
        reportType: 'instance_health',
        format: 'markdown'
      });

      const result = await generateReport(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.format).toBe('markdown');
      expect(result.content).toContain('# Instance Health Report');
      expect(result.content).toContain('## Key Metrics');
    });

    it('should include recommendations when enabled', async () => {
      const input = generateReportSchema.parse({
        reportType: 'instance_health',
        format: 'html',
        includeRecommendations: true
      });

      const result = await generateReport(mockClient as any, input);

      expect(result.content).toContain('Recommendations');
    });

    it('should include metrics in metadata', async () => {
      const input = generateReportSchema.parse({
        reportType: 'instance_health'
      });

      const result = await generateReport(mockClient as any, input);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.metrics).toBeDefined();
      expect(result.metadata.metrics.healthScore).toBeDefined();
      expect(result.metadata.generatedAt).toBeDefined();
    });
  });

  describe('getDashboardData', () => {
    it('should return requested metrics', async () => {
      const input = getDashboardDataSchema.parse({
        metrics: ['health_score', 'customization_count']
      });

      const result = await getDashboardData(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.metrics.health_score).toBeDefined();
      expect(result.metrics.customization_count).toBeDefined();
    });

    it('should include alerts for critical issues', async () => {
      const input = getDashboardDataSchema.parse({
        metrics: ['security_issues']
      });

      const result = await getDashboardData(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(result.alerts).toBeDefined();
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    it('should include trends data', async () => {
      const input = getDashboardDataSchema.parse({
        metrics: ['health_score']
      });

      const result = await getDashboardData(mockClient as any, input);

      expect(result.trends).toBeDefined();
      expect(result.trends.health_score).toBeDefined();
    });

    it('should use default metrics when none specified', async () => {
      const input = getDashboardDataSchema.parse({});

      const result = await getDashboardData(mockClient as any, input);

      expect(result.success).toBe(true);
      expect(Object.keys(result.metrics).length).toBeGreaterThan(0);
    });
  });
});

