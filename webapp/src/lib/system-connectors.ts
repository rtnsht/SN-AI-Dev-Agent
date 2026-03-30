/**
 * System Connectors — typed interface for multi-system connections.
 *
 * Currently supports ServiceNow. Other system types (Jira, Salesforce, GitHub)
 * are defined as types but require separate connector implementations.
 */

export interface SystemConnector {
  id: string;
  type: 'servicenow' | 'jira' | 'salesforce' | 'github' | 'other';
  label: string;
  instanceUrl: string;
  credentialsRef: string; // reference to user_system_connections.id
  isDefault: boolean;
  isActive: boolean;
  verify(): Promise<{ valid: boolean; error?: string }>;
  test(): Promise<{ success: boolean; latencyMs?: number; error?: string }>;
}

export interface SystemConnectorConfig {
  type: SystemConnector['type'];
  label: string;
  instanceUrl: string;
  credentials: {
    username?: string;
    password?: string;
    apiKey?: string;
    token?: string;
  };
  isDefault?: boolean;
}

export class ServiceNowConnector implements SystemConnector {
  id: string;
  type: SystemConnector['type'] = 'servicenow';
  label: string;
  instanceUrl: string;
  credentialsRef: string;
  isDefault: boolean;
  isActive: boolean = true;

  constructor(config: {
    id: string;
    label: string;
    instanceUrl: string;
    credentialsRef: string;
    isDefault: boolean;
  }) {
    this.id = config.id;
    this.label = config.label;
    this.instanceUrl = config.instanceUrl;
    this.credentialsRef = config.credentialsRef;
    this.isDefault = config.isDefault;
  }

  async verify(): Promise<{ valid: boolean; error?: string }> {
    // Placeholder — actual implementation delegates to MCP sn_test_connection
    return { valid: true };
  }

  async test(): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      // Placeholder — actual implementation delegates to MCP sn_test_connection
      return { success: true, latencyMs: Date.now() - start };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }
}

export function createSystemConnector(
  config: SystemConnectorConfig & { id: string; credentialsRef: string }
): SystemConnector {
  if (config.type !== 'servicenow') {
    // Future: throw or return a stub for unsupported types
    throw new Error(`Unsupported connector type: ${config.type}`);
  }
  return new ServiceNowConnector({
    id: config.id,
    label: config.label,
    instanceUrl: config.instanceUrl,
    credentialsRef: config.credentialsRef,
    isDefault: config.isDefault ?? false,
  });
}
