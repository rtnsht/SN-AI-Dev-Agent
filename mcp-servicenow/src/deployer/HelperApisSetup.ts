/**
 * Helper APIs Setup
 * 
 * Manages deployment and discovery of required Scripted REST APIs on ServiceNow instances.
 * These APIs provide workarounds for platform limitations in the standard Table API.
 * 
 * Required Helper APIs:
 * 1. UIPolicyActionHelper - Creates UI Policy Actions with proper ui_policy reference field
 * 2. UpdateSetHelper - Sets current update set for artifact capture
 */

import { ServiceNowClient } from '../client/sn-client.js';

export interface HelperApiInfo {
  name: string;
  serviceId: string;
  sysId?: string;
  namespace?: string;
  basePath?: string;
  deployed: boolean;
}

export interface HelperApisStatus {
  initialized: boolean;
  apis: {
    uiPolicyActionHelper: HelperApiInfo;
    updateSetHelper: HelperApiInfo;
  };
}

// Cache for discovered API paths per instance
const apiPathCache = new Map<string, HelperApisStatus>();

/**
 * Get the UI Policy Action Helper API script
 */
function getUiPolicyActionHelperScript(): string {
  return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var body = request.body.data;
    var uiPolicySysId = body.ui_policy || '';
    var table = body.table || '';
    var field = body.field || '';
    var mandatory = body.mandatory || 'ignore';
    var visible = body.visible || 'ignore';
    var disabled = body.disabled || 'ignore';

    if (!uiPolicySysId || !table || !field) {
        response.setStatus(400);
        return { error: 'Missing required fields: ui_policy, table, field' };
    }

    var gr = new GlideRecord('sys_ui_policy_action');
    gr.initialize();
    gr.setValue('ui_policy', uiPolicySysId);
    gr.setValue('table', table);
    gr.setValue('field', field);
    gr.setValue('mandatory', mandatory);
    gr.setValue('visible', visible);
    gr.setValue('disabled', disabled);
    var sysId = gr.insert();

    if (sysId) {
        return { success: true, sys_id: sysId };
    } else {
        response.setStatus(500);
        return { error: 'Failed to create UI Policy Action' };
    }
})(request, response);`;
}

/**
 * Get the Update Set Helper API script
 * Replicates "Make This My Current Set" functionality using GlideUpdateSet().set()
 */
function getUpdateSetHelperScript(): string {
  return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var updateSetId = request.body.data ? request.body.data.sys_id : null;

    if (!updateSetId) {
        response.setStatus(400);
        return { error: 'sys_id parameter required in request body' };
    }

    // Verify update set exists and is in progress
    var gr = new GlideRecord('sys_update_set');
    if (!gr.get(updateSetId)) {
        response.setStatus(404);
        return { error: 'Update set not found' };
    }

    if (gr.state != 'in progress') {
        response.setStatus(400);
        return { error: 'Update set must be in progress state' };
    }

    // Set as current update set (same as "Make This My Current Set" UI Action)
    var us = new GlideUpdateSet();
    us.set(updateSetId);

    return {
        success: true,
        message: 'Update set set as current',
        update_set: {
            sys_id: gr.sys_id.toString(),
            name: gr.name.toString()
        }
    };
})(request, response);`;
}

export class HelperApisSetup {
  private client: ServiceNowClient;
  private instanceUrl: string;

  constructor(client: ServiceNowClient) {
    this.client = client;
    this.instanceUrl = client.instanceUrl;
  }

  /**
   * Check and deploy all required helper APIs
   * Returns the status of all APIs including their paths
   */
  async initializeHelperApis(): Promise<HelperApisStatus> {
    // Check cache first
    const cached = apiPathCache.get(this.instanceUrl);
    if (cached?.initialized) {
      return cached;
    }

    console.log('[HelperApisSetup] Initializing helper APIs for', this.instanceUrl);

    const status: HelperApisStatus = {
      initialized: false,
      apis: {
        uiPolicyActionHelper: {
          name: 'UIPolicyActionHelper',
          serviceId: 'ui_policy_action_helper',
          deployed: false
        },
        updateSetHelper: {
          name: 'UpdateSetHelper',
          serviceId: 'update_set_helper',
          deployed: false
        }
      }
    };

    // Check/deploy UI Policy Action Helper
    await this.checkOrDeployApi(status.apis.uiPolicyActionHelper, {
      resourceName: 'createUiPolicyAction',
      resourcePath: '/create',
      httpMethod: 'POST',
      script: getUiPolicyActionHelperScript(),
      description: 'Create UI Policy Action with GlideRecord'
    });

    // Check/deploy Update Set Helper
    await this.checkOrDeployApi(status.apis.updateSetHelper, {
      resourceName: 'setCurrentUpdateSet',
      resourcePath: '/set_current',
      httpMethod: 'POST',
      script: getUpdateSetHelperScript(),
      description: 'Set current update set for artifact capture'
    });

    status.initialized = true;
    apiPathCache.set(this.instanceUrl, status);

    return status;
  }

  /**
   * Get cached API status (call initializeHelperApis first)
   */
  getCachedStatus(): HelperApisStatus | undefined {
    return apiPathCache.get(this.instanceUrl);
  }

  /**
   * Get the API path for a specific helper
   */
  getApiPath(apiKey: 'uiPolicyActionHelper' | 'updateSetHelper'): string | undefined {
    const cached = apiPathCache.get(this.instanceUrl);
    return cached?.apis[apiKey]?.basePath;
  }

  private async detectApi(apiInfo: HelperApiInfo): Promise<void> {
    try {
      const records = await this.client.getRecords('sys_ws_definition', {
        sysparm_query: `service_id=${apiInfo.serviceId}`,
        sysparm_fields: 'sys_id,name,service_id,namespace',
        sysparm_limit: 1
      });

      if (records.length > 0) {
        const api = records[0];
        apiInfo.sysId = api.sys_id as string;
        apiInfo.namespace = api.namespace as string;
        apiInfo.basePath = `/api/${apiInfo.namespace}/${apiInfo.serviceId}`;
        apiInfo.deployed = true;
        console.log(`[HelperApisSetup] Found ${apiInfo.name}: ${apiInfo.basePath}`);
      }
    } catch {
      // API not found
    }
  }

  private async checkOrDeployApi(
    apiInfo: HelperApiInfo,
    resourceConfig: {
      resourceName: string;
      resourcePath: string;
      httpMethod: string;
      script: string;
      description: string;
    }
  ): Promise<void> {
    // First try to detect existing API
    await this.detectApi(apiInfo);

    if (apiInfo.deployed) {
      return; // Already exists
    }

    console.log(`[HelperApisSetup] Deploying ${apiInfo.name}...`);

    try {
      // Create API Definition
      const apiDef = await this.client.createRecord('sys_ws_definition', {
        name: apiInfo.name,
        service_id: apiInfo.serviceId,
        active: true,
        short_description: `Helper API for ${apiInfo.name}`
      });

      apiInfo.sysId = apiDef.sys_id as string;

      // Get the namespace from the created record
      const fullRecord = await this.client.getRecord('sys_ws_definition', apiInfo.sysId, ['namespace']);
      apiInfo.namespace = fullRecord?.namespace as string || 'global';
      apiInfo.basePath = `/api/${apiInfo.namespace}/${apiInfo.serviceId}`;

      // Create Resource/Operation
      await this.client.createRecord('sys_ws_operation', {
        web_service_definition: apiInfo.sysId,
        name: resourceConfig.resourceName,
        http_method: resourceConfig.httpMethod,
        relative_path: resourceConfig.resourcePath,
        active: true,
        operation_script: resourceConfig.script,
        short_description: resourceConfig.description
      });

      apiInfo.deployed = true;
      console.log(`[HelperApisSetup] Deployed ${apiInfo.name}: ${apiInfo.basePath}${resourceConfig.resourcePath}`);
    } catch (error) {
      console.error(`[HelperApisSetup] Failed to deploy ${apiInfo.name}:`, error);
      throw error;
    }
  }

  /**
   * Clear the cache for this instance (useful for re-initialization)
   */
  clearCache(): void {
    apiPathCache.delete(this.instanceUrl);
  }

  /**
   * Clear all cached API paths
   */
  static clearAllCaches(): void {
    apiPathCache.clear();
  }
}

// Export singleton getter for easy access
let _helperSetupInstance: HelperApisSetup | null = null;

export function getHelperApisSetup(client: ServiceNowClient): HelperApisSetup {
  // Create new instance if client changed
  if (!_helperSetupInstance || _helperSetupInstance['instanceUrl'] !== client.instanceUrl) {
    _helperSetupInstance = new HelperApisSetup(client);
  }
  return _helperSetupInstance;
}

