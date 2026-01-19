/**
 * Mock ServiceNow Client for Unit Testing
 * Provides predictable responses without hitting a real instance
 */

import { vi } from 'vitest';

// Mock data generators
export const mockBusinessRule = (overrides = {}) => ({
  sys_id: 'br_' + Math.random().toString(36).substr(2, 9),
  name: 'Test Business Rule',
  collection: 'incident',
  when: 'before',
  order: 100,
  active: true,
  script: 'current.update();',
  sys_scope: { value: 'global' },
  sys_created_by: 'admin',
  sys_created_on: '2024-01-01 12:00:00',
  sys_updated_by: 'admin',
  sys_updated_on: '2024-01-15 12:00:00',
  ...overrides
});

export const mockScriptInclude = (overrides = {}) => ({
  sys_id: 'si_' + Math.random().toString(36).substr(2, 9),
  name: 'TestScriptInclude',
  api_name: 'global.TestScriptInclude',
  script: 'var TestScriptInclude = Class.create();\nTestScriptInclude.prototype = { initialize: function() {} };',
  active: true,
  client_callable: false,
  sys_scope: { value: 'global' },
  sys_created_by: 'admin',
  sys_created_on: '2024-01-01 12:00:00',
  ...overrides
});

export const mockClientScript = (overrides = {}) => ({
  sys_id: 'cs_' + Math.random().toString(36).substr(2, 9),
  name: 'Test Client Script',
  table: 'incident',
  type: 'onLoad',
  active: true,
  script: 'function onLoad() { g_form.setValue("short_description", "test"); }',
  sys_scope: { value: 'global' },
  sys_created_by: 'admin',
  ...overrides
});

export const mockACL = (overrides = {}) => ({
  sys_id: 'acl_' + Math.random().toString(36).substr(2, 9),
  name: 'incident.write',
  operation: 'write',
  type: 'record',
  active: true,
  script: 'answer = gs.hasRole("itil");',
  sys_scope: { value: 'global' },
  sys_created_by: 'admin',
  ...overrides
});

export const mockUpdateSet = (overrides = {}) => ({
  sys_id: 'us_' + Math.random().toString(36).substr(2, 9),
  name: 'Test Update Set',
  state: 'in progress',
  is_default: false,
  sys_created_by: 'admin',
  sys_created_on: '2024-01-01 12:00:00',
  ...overrides
});

export const mockTable = (overrides = {}) => ({
  sys_id: 'tbl_' + Math.random().toString(36).substr(2, 9),
  name: 'u_custom_table',
  label: 'Custom Table',
  super_class: 'task',
  sys_scope: { value: 'x_custom_app' },
  sys_created_by: 'admin',
  ...overrides
});

// Mock ServiceNow Client class
export class MockServiceNowClient {
  instanceUrl = 'https://test.service-now.com';
  private mockResponses: Map<string, unknown[]> = new Map();

  constructor() {
    // Default empty responses
    this.mockResponses.set('sys_script', []);
    this.mockResponses.set('sys_script_include', []);
    this.mockResponses.set('sys_script_client', []);
    this.mockResponses.set('sys_security_acl', []);
    this.mockResponses.set('sys_update_set', []);
  }

  // Set mock data for a specific table
  setMockData(table: string, data: unknown[]) {
    this.mockResponses.set(table, data);
  }

  // Mock getRecords method
  getRecords = vi.fn(async (table: string, _params?: Record<string, unknown>) => {
    return this.mockResponses.get(table) || [];
  });

  // Mock getRecord method  
  getRecord = vi.fn(async (table: string, sysId: string) => {
    const records = this.mockResponses.get(table) || [];
    return records.find((r: { sys_id?: string }) => r.sys_id === sysId) || null;
  });

  // Mock createRecord method
  createRecord = vi.fn(async (_table: string, data: Record<string, unknown>) => ({
    sys_id: 'new_' + Math.random().toString(36).substr(2, 9),
    ...data
  }));

  // Mock updateRecord method
  updateRecord = vi.fn(async (_table: string, sysId: string, data: Record<string, unknown>) => ({
    sys_id: sysId,
    ...data
  }));

  // Mock deleteRecord method
  deleteRecord = vi.fn(async () => ({ success: true }));

  // Reset all mocks
  reset() {
    this.getRecords.mockClear();
    this.getRecord.mockClear();
    this.createRecord.mockClear();
    this.updateRecord.mockClear();
    this.deleteRecord.mockClear();
    this.mockResponses.clear();
  }
}

// Factory function for creating configured mock clients
export function createMockClient(config?: {
  businessRules?: number;
  scriptIncludes?: number;
  clientScripts?: number;
  acls?: number;
  customScope?: boolean;
}) {
  const client = new MockServiceNowClient();
  
  if (config?.businessRules) {
    const brs = Array.from({ length: config.businessRules }, (_, i) => 
      mockBusinessRule({ 
        name: `Business Rule ${i + 1}`,
        sys_scope: config.customScope ? { value: 'x_custom_app' } : { value: 'global' }
      })
    );
    client.setMockData('sys_script', brs);
  }
  
  if (config?.scriptIncludes) {
    const sis = Array.from({ length: config.scriptIncludes }, (_, i) =>
      mockScriptInclude({ 
        name: `ScriptInclude${i + 1}`,
        sys_scope: config.customScope ? { value: 'x_custom_app' } : { value: 'global' }
      })
    );
    client.setMockData('sys_script_include', sis);
  }
  
  return client;
}

