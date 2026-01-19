/**
 * Tests for Multi-Instance Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerInstanceEnhanced,
  switchInstance,
  getActiveInstance,
  testInstanceConnection,
  diffArtifact
} from '../../src/tools/multi-instance-manager.js';
import { MockServiceNowClient } from '../mocks/sn-client.mock.js';

describe('Multi-Instance Manager', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('registerInstanceEnhanced', () => {
    it('should register a new instance', async () => {
      const result = await registerInstanceEnhanced(mockClient as any, {
        instanceId: 'dev1',
        name: 'Development',
        url: 'https://dev12345.service-now.com',
        environment: 'dev',
        username: 'admin',
        password: 'password123'
      });

      expect(result.success).toBe(true);
      expect(result.instance.instanceId).toBe('dev1');
      expect(result.instance.name).toBe('Development');
      expect(result.instance.environment).toBe('dev');
      expect(result.message).toContain('registered');
    });

    it('should normalize URL by removing trailing slash', async () => {
      const result = await registerInstanceEnhanced(mockClient as any, {
        instanceId: 'dev2',
        name: 'Dev 2',
        url: 'https://dev12345.service-now.com/',
        environment: 'dev',
        username: 'admin',
        password: 'password123'
      });

      expect(result.instance.url).toBe('https://dev12345.service-now.com');
    });

    it('should not expose password in response', async () => {
      const result = await registerInstanceEnhanced(mockClient as any, {
        instanceId: 'dev3',
        name: 'Dev 3',
        url: 'https://dev12345.service-now.com',
        environment: 'dev',
        username: 'admin',
        password: 'secretpassword'
      });

      expect((result.instance as any).password).toBeUndefined();
    });
  });

  describe('switchInstance', () => {
    beforeEach(async () => {
      // Register instances first
      await registerInstanceEnhanced(mockClient as any, {
        instanceId: 'switch-dev',
        name: 'Switch Dev',
        url: 'https://dev.service-now.com',
        environment: 'dev',
        username: 'admin',
        password: 'pass'
      });
      await registerInstanceEnhanced(mockClient as any, {
        instanceId: 'switch-prod',
        name: 'Switch Prod',
        url: 'https://prod.service-now.com',
        environment: 'prod',
        username: 'admin',
        password: 'pass'
      });
    });

    it('should switch to a registered instance', async () => {
      const result = await switchInstance(mockClient as any, {
        instanceId: 'switch-prod'
      });

      expect(result.success).toBe(true);
      expect(result.currentInstance).toBe('switch-prod');
      expect(result.message).toContain('Switch Prod');
    });

    it('should fail for unknown instance', async () => {
      const result = await switchInstance(mockClient as any, {
        instanceId: 'unknown-instance'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('getActiveInstance', () => {
    it('should return active instance info', async () => {
      // Register an instance
      await registerInstanceEnhanced(mockClient as any, {
        instanceId: 'active-test',
        name: 'Active Test',
        url: 'https://active.service-now.com',
        environment: 'test',
        username: 'admin',
        password: 'pass'
      });

      const result = await getActiveInstance(mockClient as any, {});

      expect(result.success).toBe(true);
      expect(result.allInstances.length).toBeGreaterThan(0);
    });

    it('should list all registered instances', async () => {
      const result = await getActiveInstance(mockClient as any, {});

      expect(result.success).toBe(true);
      expect(Array.isArray(result.allInstances)).toBe(true);
    });
  });

  describe('testInstanceConnection', () => {
    it('should fail for unregistered instance', async () => {
      const result = await testInstanceConnection(mockClient as any, {
        instanceId: 'nonexistent'
      });

      expect(result.success).toBe(false);
      expect(result.connected).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('diffArtifact', () => {
    it('should return not_found for unregistered instances', async () => {
      const result = await diffArtifact(mockClient as any, {
        sourceInstanceId: 'unknown1',
        targetInstanceId: 'unknown2',
        artifactType: 'business_rule',
        artifactName: 'TestRule'
      });

      expect(result.success).toBe(false);
      expect(result.comparison.status).toBe('not_found');
    });

    it('should return correct artifact info', async () => {
      const result = await diffArtifact(mockClient as any, {
        sourceInstanceId: 'source',
        targetInstanceId: 'target',
        artifactType: 'script_include',
        artifactName: 'TestUtils'
      });

      expect(result.artifactName).toBe('TestUtils');
      expect(result.artifactType).toBe('script_include');
    });
  });
});

