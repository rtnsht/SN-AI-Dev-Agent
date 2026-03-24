/**
 * Helper APIs Setup
 *
 * Manages deployment and discovery of required Scripted REST APIs on ServiceNow instances.
 * These APIs provide workarounds for platform limitations in the standard Table API.
 *
 * Required Helper APIs:
 * 1. UIPolicyActionHelper - Creates UI Policy Actions with proper ui_policy reference field
 * 2. UpdateSetHelper - Sets current update set for artifact capture
 * 3. AddToUpdateSetHelper - Uses GlideUpdateManager2().saveRecord() to explicitly add any
 *    record to a specified update set (Layer 3 fallback for artifact capture)
 * 4. CatalogVariableHelper - Creates catalog client scripts and catalog UI policy actions
 *    with properly bound variable references (cat_variable / variable fields)
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
    addToUpdateSetHelper: HelperApiInfo;
    scopeHelper: HelperApiInfo;
    catalogVariableHelper: HelperApiInfo;
  };
}

// Cache for discovered API paths per instance.
// Never auto-evicted — use clearCache(instanceUrl) or clearAllCaches() after redeploying helper APIs.
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

/**
 * Get the Add to Update Set Helper API script.
 * Uses GlideUpdateManager2().saveRecord() to explicitly create a sys_update_xml
 * entry for ANY record in ANY table, adding it to a specified update set.
 * This is the Layer 3 fallback when session-based capture and sys_update_xml
 * move both fail (common with sys_dictionary, sysauto_script, sysevent, etc.).
 */
function getAddToUpdateSetHelperScript(): string {
  return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var body = request.body.data;
    var tableName = body.table || '';
    var recordSysId = body.sys_id || '';
    var updateSetId = body.update_set_id || '';

    if (!tableName || !recordSysId) {
        response.setStatus(400);
        return { error: 'Missing required fields: table, sys_id' };
    }

    // Get the record
    var gr = new GlideRecord(tableName);
    if (!gr.get(recordSysId)) {
        response.setStatus(404);
        return { error: 'Record not found: ' + tableName + '/' + recordSysId };
    }

    // If update_set_id provided, set it as the current update set first
    if (updateSetId) {
        var usGr = new GlideRecord('sys_update_set');
        if (usGr.get(updateSetId) && usGr.state == 'in progress') {
            var us = new GlideUpdateSet();
            us.set(updateSetId);
        } else {
            response.setStatus(400);
            return { error: 'Update set not found or not in progress: ' + updateSetId };
        }
    }

    // Use GlideUpdateManager2 to create the sys_update_xml entry
    // This is the same mechanism used by the "Add to Update Set" utility
    try {
        var updateManager = new GlideUpdateManager2();
        updateManager.saveRecord(gr);

        // Verify the entry was created
        var updateXml = new GlideRecord('sys_update_xml');
        updateXml.addQuery('remote_update_set', 'NULL');
        updateXml.addEncodedQuery('nameLIKE' + recordSysId);
        updateXml.orderByDesc('sys_created_on');
        updateXml.setLimit(1);
        updateXml.query();

        var captured = false;
        var updateXmlSysId = '';
        if (updateXml.next()) {
            captured = true;
            updateXmlSysId = updateXml.sys_id.toString();
        }

        return {
            success: true,
            message: 'Record added to update set via GlideUpdateManager2',
            table: tableName,
            sys_id: recordSysId,
            captured: captured,
            update_xml_sys_id: updateXmlSysId
        };
    } catch (e) {
        response.setStatus(500);
        return { error: 'GlideUpdateManager2.saveRecord failed: ' + e.message };
    }
})(request, response);`;
}

/**
 * Get the Scope Helper API script.
 * Switches application scope and optionally sets update set.
 * Uses gs.setCurrentApplicationId() (wrapped in try/catch — may not exist on all releases)
 * and the concoursepicker-style session update for verification.
 */
function getScopeHelperScript(): string {
  return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var body = request.body.data;
    var scopeId = body.scope_id + '';
    var updateSetId = body.update_set_id || '';

    if (!scopeId) {
        response.setStatus(400);
        return { error: 'scope_id parameter required in request body' };
    }

    var scopeGr = new GlideRecord('sys_scope');
    if (!scopeGr.get(scopeId)) {
        response.setStatus(400);
        return { success: false, error: 'Scope not found: ' + scopeId };
    }

    // Attempt scope switch (may not be available on all releases)
    try { gs.setCurrentApplicationId(scopeId); } catch(e) { /* best effort */ }

    if (updateSetId) {
        var usGr = new GlideRecord('sys_update_set');
        if (usGr.get(updateSetId) && usGr.state == 'in progress') {
            var us = new GlideUpdateSet();
            us.set(updateSetId);
        }
    }

    var currentApp = '';
    try { currentApp = gs.getCurrentApplicationId(); } catch(e) {}

    return {
        success: true,
        currentScope: currentApp,
        scopeName: scopeGr.getValue('name'),
        currentUpdateSet: updateSetId
    };
})(request, response);`;
}

/**
 * Get the Scope Helper GET script (verify current scope).
 */
function getScopeHelperGetScript(): string {
  return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var currentApp = 'global';
    var currentAppName = 'Global';
    try {
        currentApp = gs.getCurrentApplicationId() || 'global';
        if (currentApp && currentApp !== 'global') {
            var gr = new GlideRecord('sys_scope');
            if (gr.get(currentApp)) {
                currentAppName = gr.getValue('name');
            }
        }
    } catch(e) {}

    return {
        success: true,
        currentScope: currentApp,
        currentScopeName: currentAppName
    };
})(request, response);`;
}

/**
 * Create a catalog client script with properly bound cat_variable reference.
 * Looks up the variable by name + cat_item, then sets cat_variable via GlideRecord.
 */
function getCatalogClientScriptHelperScript(): string {
  return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var body = request.body.data;
    var catItem = body.cat_item || '';
    var name = body.name || '';
    var script = body.script || '';
    var type = body.type || 'onChange';
    var catVariableName = body.cat_variable_name || '';
    var applyTo = body.apply_to || 'item';
    var active = body.active !== undefined ? body.active : true;
    var uiType = body.ui_type || 'Desktop';

    if (!catItem || !name || !script) {
        return { success: false, error: 'Missing required fields: cat_item, name, script' };
    }

    var gr = new GlideRecord('catalog_script_client');
    gr.initialize();
    gr.setValue('cat_item', catItem);
    gr.setValue('name', name);
    gr.setValue('script', script);
    gr.setValue('type', type);
    gr.setValue('apply_to', applyTo);
    gr.setValue('active', active);
    gr.setValue('ui_type', uiType);

    var variableBound = false;
    var variableSysId = '';
    if (catVariableName) {
        var varGr = new GlideRecord('item_option_new');
        varGr.addQuery('name', catVariableName);
        varGr.addQuery('cat_item', catItem);
        varGr.setLimit(1);
        varGr.query();
        if (varGr.next()) {
            variableSysId = varGr.sys_id.toString();
            gr.setValue('cat_variable', variableSysId);
            variableBound = true;
        }
    }

    var sysId = gr.insert();
    if (sysId) {
        return { success: true, sys_id: sysId, variable_bound: variableBound, variable_sys_id: variableSysId };
    } else {
        return { success: false, error: 'Failed to create catalog client script' };
    }
})(request, response);`;
}

/**
 * Create a catalog UI policy action with properly bound variable reference.
 * Looks up the variable by name + cat_item, then sets variable via GlideRecord.
 */
function getCatalogUiPolicyActionHelperScript(): string {
  return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var body = request.body.data;
    var catalogUiPolicy = body.catalog_ui_policy || '';
    var catItem = body.cat_item || '';
    var variableName = body.variable_name || '';
    var mandatory = body.mandatory || 'ignore';
    var visible = body.visible || 'ignore';
    var disabled = body.disabled || 'ignore';

    if (!catalogUiPolicy || !catItem || !variableName) {
        return { success: false, error: 'Missing required fields: catalog_ui_policy, cat_item, variable_name' };
    }

    var varGr = new GlideRecord('item_option_new');
    varGr.addQuery('name', variableName);
    varGr.addQuery('cat_item', catItem);
    varGr.setLimit(1);
    varGr.query();
    if (!varGr.next()) {
        return { success: false, error: 'Variable not found: ' + variableName + ' on cat_item ' + catItem };
    }
    var variableSysId = varGr.sys_id.toString();

    var gr = new GlideRecord('catalog_ui_policy_action');
    gr.initialize();
    gr.setValue('catalog_ui_policy', catalogUiPolicy);
    gr.setValue('variable', variableSysId);
    gr.setValue('mandatory', mandatory);
    gr.setValue('visible', visible);
    gr.setValue('disabled', disabled);
    var sysId = gr.insert();

    if (sysId) {
        return { success: true, sys_id: sysId, variable_sys_id: variableSysId };
    } else {
        return { success: false, error: 'Failed to create catalog UI policy action' };
    }
})(request, response);`;
}

/**
 * Add a catalog item to a catalog via GlideRecord (sc_cat_item_catalog M2M table).
 * The Table API returns 403 on this table due to ACL restrictions.
 * GlideRecord bypasses ACLs when run server-side in a Scripted REST API.
 */
function getCatalogAddToCatalogScript(): string {
  return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var body = request.body.data;
    var catItem = body.sc_cat_item || '';
    var catalog = body.sc_catalog || '';

    if (!catItem || !catalog) {
        response.setStatus(400);
        return { success: false, error: 'Missing required fields: sc_cat_item, sc_catalog' };
    }

    // Check if association already exists
    var existing = new GlideRecord('sc_cat_item_catalog');
    existing.addQuery('sc_cat_item', catItem);
    existing.addQuery('sc_catalog', catalog);
    existing.setLimit(1);
    existing.query();
    if (existing.next()) {
        return { success: true, sys_id: existing.sys_id.toString(), already_exists: true };
    }

    var gr = new GlideRecord('sc_cat_item_catalog');
    gr.initialize();
    gr.setValue('sc_cat_item', catItem);
    gr.setValue('sc_catalog', catalog);
    var sysId = gr.insert();

    if (sysId) {
        return { success: true, sys_id: sysId, already_exists: false };
    } else {
        response.setStatus(500);
        return { success: false, error: 'Failed to create sc_cat_item_catalog record' };
    }
})(request, response);`;
}

/**
 * Add a catalog item to a category via GlideRecord (sc_cat_item_category M2M table).
 * The Table API may return 403 on this table due to ACL restrictions.
 * GlideRecord bypasses ACLs when run server-side in a Scripted REST API.
 */
function getCatalogAddToCategoryScript(): string {
  return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var body = request.body.data;
    var catItem = body.sc_cat_item || '';
    var category = body.sc_category || '';

    if (!catItem || !category) {
        response.setStatus(400);
        return { success: false, error: 'Missing required fields: sc_cat_item, sc_category' };
    }

    // Check if association already exists
    var existing = new GlideRecord('sc_cat_item_category');
    existing.addQuery('sc_cat_item', catItem);
    existing.addQuery('sc_category', category);
    existing.setLimit(1);
    existing.query();
    if (existing.next()) {
        return { success: true, sys_id: existing.sys_id.toString(), already_exists: true };
    }

    var gr = new GlideRecord('sc_cat_item_category');
    gr.initialize();
    gr.setValue('sc_cat_item', catItem);
    gr.setValue('sc_category', category);
    var sysId = gr.insert();

    if (sysId) {
        return { success: true, sys_id: sysId, already_exists: false };
    } else {
        response.setStatus(500);
        return { success: false, error: 'Failed to create sc_cat_item_category record' };
    }
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
        },
        addToUpdateSetHelper: {
          name: 'AddToUpdateSetHelper',
          serviceId: 'add_to_update_set_helper',
          deployed: false
        },
        scopeHelper: {
          name: 'ScopeHelper',
          serviceId: 'scope_helper',
          deployed: false
        },
        catalogVariableHelper: {
          name: 'CatalogVariableHelper',
          serviceId: 'catalog_variable_helper',
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

    // Check/deploy Add to Update Set Helper (Layer 3 fallback)
    await this.checkOrDeployApi(status.apis.addToUpdateSetHelper, {
      resourceName: 'addToUpdateSet',
      resourcePath: '/add_record',
      httpMethod: 'POST',
      script: getAddToUpdateSetHelperScript(),
      description: 'Add any record to update set via GlideUpdateManager2 (Layer 3 fallback)'
    });

    // Check/deploy Scope Helper (Tier 2 for custom scope switching)
    await this.checkOrDeployApi(status.apis.scopeHelper, {
      resourceName: 'setScope',
      resourcePath: '/set_scope',
      httpMethod: 'POST',
      script: getScopeHelperScript(),
      description: 'Switch application scope and optionally set update set'
    });

    // Deploy the GET endpoint for scope verification on the same API definition
    if (status.apis.scopeHelper.deployed && status.apis.scopeHelper.sysId) {
      try {
        // Check if GET resource already exists
        const existingGet = await this.client.getRecords('sys_ws_operation', {
          sysparm_query: `web_service_definition=${status.apis.scopeHelper.sysId}^http_method=GET`,
          sysparm_fields: 'sys_id',
          sysparm_limit: 1
        });
        if (existingGet.length === 0) {
          await this.client.createRecord('sys_ws_operation', {
            web_service_definition: status.apis.scopeHelper.sysId,
            name: 'getScope',
            http_method: 'GET',
            relative_path: '/get_scope',
            active: true,
            operation_script: getScopeHelperGetScript(),
            short_description: 'Get current application scope for verification'
          });
          console.log(`[HelperApisSetup] Deployed ScopeHelper GET: ${status.apis.scopeHelper.basePath}/get_scope`);
        }
      } catch {
        // Non-critical — GET endpoint is a convenience, POST /set_scope is the primary
      }
    }

    // Check/deploy Catalog Variable Helper (binds cat_variable / variable references)
    await this.checkOrDeployApi(status.apis.catalogVariableHelper, {
      resourceName: 'createCatalogClientScript',
      resourcePath: '/create_client_script',
      httpMethod: 'POST',
      script: getCatalogClientScriptHelperScript(),
      description: 'Create catalog client script with bound variable reference'
    });

    // Deploy the second POST endpoint for catalog UI policy actions on the same definition
    if (status.apis.catalogVariableHelper.deployed && status.apis.catalogVariableHelper.sysId) {
      try {
        const existingOp = await this.client.getRecords('sys_ws_operation', {
          sysparm_query: `web_service_definition=${status.apis.catalogVariableHelper.sysId}^http_method=POST^relative_path=/create_ui_policy_action`,
          sysparm_fields: 'sys_id',
          sysparm_limit: 1
        });
        if (existingOp.length === 0) {
          await this.client.createRecord('sys_ws_operation', {
            web_service_definition: status.apis.catalogVariableHelper.sysId,
            name: 'createCatalogUiPolicyAction',
            http_method: 'POST',
            relative_path: '/create_ui_policy_action',
            active: true,
            operation_script: getCatalogUiPolicyActionHelperScript(),
            short_description: 'Create catalog UI policy action with bound variable reference'
          });
          console.log(`[HelperApisSetup] Deployed CatalogVariableHelper POST: ${status.apis.catalogVariableHelper.basePath}/create_ui_policy_action`);
        }
      } catch (error) {
        console.error('[HelperApisSetup] Failed to deploy CatalogVariableHelper second operation:', error);
        this.clearCache();
      }

      // Deploy /add_to_catalog endpoint (bypasses sc_cat_item_catalog ACL restrictions)
      try {
        const existingAddCatalog = await this.client.getRecords('sys_ws_operation', {
          sysparm_query: `web_service_definition=${status.apis.catalogVariableHelper.sysId}^http_method=POST^relative_path=/add_to_catalog`,
          sysparm_fields: 'sys_id',
          sysparm_limit: 1
        });
        if (existingAddCatalog.length === 0) {
          await this.client.createRecord('sys_ws_operation', {
            web_service_definition: status.apis.catalogVariableHelper.sysId,
            name: 'addCatalogItemToCatalog',
            http_method: 'POST',
            relative_path: '/add_to_catalog',
            active: true,
            operation_script: getCatalogAddToCatalogScript(),
            short_description: 'Add catalog item to catalog (bypasses sc_cat_item_catalog ACL)'
          });
          console.log(`[HelperApisSetup] Deployed CatalogVariableHelper POST: ${status.apis.catalogVariableHelper.basePath}/add_to_catalog`);
        }
      } catch (error) {
        console.error('[HelperApisSetup] Failed to deploy add_to_catalog operation:', error);
      }

      // Deploy /add_to_category endpoint (bypasses sc_cat_item_category ACL restrictions)
      try {
        const existingAddCategory = await this.client.getRecords('sys_ws_operation', {
          sysparm_query: `web_service_definition=${status.apis.catalogVariableHelper.sysId}^http_method=POST^relative_path=/add_to_category`,
          sysparm_fields: 'sys_id',
          sysparm_limit: 1
        });
        if (existingAddCategory.length === 0) {
          await this.client.createRecord('sys_ws_operation', {
            web_service_definition: status.apis.catalogVariableHelper.sysId,
            name: 'addCatalogItemToCategory',
            http_method: 'POST',
            relative_path: '/add_to_category',
            active: true,
            operation_script: getCatalogAddToCategoryScript(),
            short_description: 'Add catalog item to category (bypasses sc_cat_item_category ACL)'
          });
          console.log(`[HelperApisSetup] Deployed CatalogVariableHelper POST: ${status.apis.catalogVariableHelper.basePath}/add_to_category`);
        }
      } catch (error) {
        console.error('[HelperApisSetup] Failed to deploy add_to_category operation:', error);
      }
    }

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
  getApiPath(apiKey: 'uiPolicyActionHelper' | 'updateSetHelper' | 'addToUpdateSetHelper' | 'scopeHelper' | 'catalogVariableHelper'): string | undefined {
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

