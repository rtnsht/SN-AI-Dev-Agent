/**
 * ServiceNow REST API Client
 * Handles all HTTP communication with ServiceNow instances
 *
 * Features:
 * - Cookie-jar session persistence (so GlideUpdateSet().set() persists across calls)
 * - Active update set tracking with post-creation artifact move
 * - Auto-initialization of helper APIs on first connection
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { SNConfig, SNRecord, SNQueryParams, SNApiResponse, SNErrorResponse } from '../types/index.js';

// Helper API key type
type HelperApiKey = 'uiPolicyActionHelper' | 'updateSetHelper' | 'addToUpdateSetHelper';

// Cache for helper API paths per instance
const helperApiPaths = new Map<string, Partial<Record<HelperApiKey, string>>>();

export class ServiceNowClient {
  private client: AxiosInstance;
  private config: SNConfig;

  /** The sys_id of the currently active update set (set via sn_set_current_update_set) */
  private _activeUpdateSetId: string | null = null;

  /** Whether helper APIs have been initialized for this instance */
  private _helperApisInitialized: boolean = false;

  constructor(config: SNConfig) {
    this.config = config;

    // Remove trailing slash from URL
    const baseURL = config.instanceUrl.replace(/\/$/, '');

    // Create cookie jar for session persistence
    // This ensures GlideUpdateSet().set() effects persist across REST calls
    const jar = new CookieJar();

    this.client = wrapper(axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      auth: {
        username: config.username,
        password: config.password
      },
      timeout: 30000,
      jar,
      withCredentials: true
    }));
  }

  /**
   * Get the cached helper API path for a specific helper
   */
  getHelperApiPath(apiKey: HelperApiKey): string | undefined {
    const paths = helperApiPaths.get(this.config.instanceUrl);
    return paths?.[apiKey];
  }

  /**
   * Set a helper API path (called after initialization)
   */
  setHelperApiPath(apiKey: HelperApiKey, path: string): void {
    let paths = helperApiPaths.get(this.config.instanceUrl);
    if (!paths) {
      paths = {};
      helperApiPaths.set(this.config.instanceUrl, paths);
    }
    paths[apiKey] = path;
  }

  /**
   * Check if helper APIs have been initialized
   */
  get helperApisInitialized(): boolean {
    return this._helperApisInitialized;
  }

  /**
   * Mark helper APIs as initialized
   */
  set helperApisInitialized(value: boolean) {
    this._helperApisInitialized = value;
  }

  // ─── Active Update Set Tracking ──────────────────────────────

  /** Get the currently active update set ID */
  get activeUpdateSetId(): string | null {
    return this._activeUpdateSetId;
  }

  /** Set the active update set ID (called by sn_set_current_update_set) */
  setActiveUpdateSet(sysId: string | null): void {
    this._activeUpdateSetId = sysId;
  }

  /**
   * Call the UpdateSetHelper Scripted REST API to set the current update set
   * for this session (uses GlideUpdateSet().set() on the server side).
   * Requires SN_UPDATE_SET_API_PATH environment variable to be configured.
   */
  async callSetCurrentUpdateSetApi(updateSetId: string): Promise<{ success: boolean; error?: string }> {
    const apiPath = process.env.SN_UPDATE_SET_API_PATH;
    if (!apiPath) {
      return {
        success: false,
        error: 'SN_UPDATE_SET_API_PATH not configured in .env. Run: node src/deployer/setup-updateset-api.js'
      };
    }

    try {
      const response = await this.client.post<SNApiResponse<{ success: boolean; message: string }>>(
        apiPath,
        { sys_id: updateSetId },
        {
          auth: { username: this.config.username, password: this.config.password },
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        }
      );
      this._activeUpdateSetId = updateSetId;
      return { success: true };
    } catch (error) {
      const axiosError = error as AxiosError<SNErrorResponse>;
      const msg = axiosError.response?.data?.error?.message || axiosError.message;
      return { success: false, error: msg };
    }
  }

  /**
   * Call the AddToUpdateSetHelper Scripted REST API to explicitly add a record
   * to an update set using GlideUpdateManager2().saveRecord() on the server side.
   * This is the Layer 3 fallback for artifact capture — works for any table type
   * including sys_dictionary, sysauto_script, sysevent_register, etc.
   */
  async callAddToUpdateSetApi(
    table: string,
    recordSysId: string,
    updateSetId?: string
  ): Promise<{ success: boolean; captured?: boolean; updateXmlSysId?: string; error?: string }> {
    const helperPath = this.getHelperApiPath('addToUpdateSetHelper');
    if (!helperPath) {
      return {
        success: false,
        error: 'AddToUpdateSetHelper API not available. It will be auto-deployed on next connection.'
      };
    }

    const apiEndpoint = `${helperPath}/add_record`;

    try {
      const response = await this.client.post<SNApiResponse<{
        success: boolean;
        captured: boolean;
        update_xml_sys_id: string;
        message: string;
      }>>(
        apiEndpoint,
        {
          table,
          sys_id: recordSysId,
          update_set_id: updateSetId || this._activeUpdateSetId || ''
        },
        {
          auth: { username: this.config.username, password: this.config.password },
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        }
      );

      const result = response.data.result;
      return {
        success: true,
        captured: result?.captured ?? false,
        updateXmlSysId: result?.update_xml_sys_id || undefined
      };
    } catch (error) {
      const axiosError = error as AxiosError<SNErrorResponse>;
      const msg = axiosError.response?.data?.error?.message || axiosError.message;
      return { success: false, error: msg };
    }
  }

  /**
   * Extract the sys_id value from a ServiceNow reference field.
   * Reference fields can be returned as plain strings or as objects {link, value}.
   */
  private resolveRefValue(field: unknown): string {
    if (typeof field === 'string') return field;
    if (field && typeof field === 'object' && 'value' in (field as Record<string, unknown>)) {
      return String((field as Record<string, unknown>).value);
    }
    return String(field ?? '');
  }

  /**
   * Tables that are metadata/dictionary tables where sys_update_xml records
   * may take longer to appear and may use non-standard naming patterns.
   */
  private static readonly METADATA_TABLES = new Set([
    'sys_dictionary', 'sys_db_object', 'sys_documentation',
    'sys_choice', 'sys_ui_policy', 'sys_ui_policy_action',
    'sys_ui_section', 'sys_ui_element', 'sys_ui_form',
    'sys_ui_list', 'sys_ui_related_list', 'sys_ui_view'
  ]);

  /**
   * Move a record's sys_update_xml entry to the active update set.
   * This is the reliable fallback for when session-based update set capture fails.
   *
   * Uses a multi-strategy search with retry logic:
   * 1. Exact name match: <table>_<sys_id>
   * 2. LIKE search on sys_id
   * 3. LIKE search on table name with recent creation time
   *
   * @param table - The table the record was created/updated in (e.g. 'sys_script')
   * @param recordSysId - The sys_id of the created/updated record
   * @returns Object with moved count and any errors
   */
  async moveArtifactToUpdateSet(table: string, recordSysId: string): Promise<{ moved: number; errors: string[] }> {
    if (!this._activeUpdateSetId) {
      return { moved: 0, errors: [] }; // No active update set, nothing to do
    }

    const errors: string[] = [];
    let moved = 0;
    const isMetadataTable = ServiceNowClient.METADATA_TABLES.has(table);

    // Metadata tables (sys_dictionary etc.) need more time for sys_update_xml generation
    const initialDelay = isMetadataTable ? 1500 : 500;
    const maxRetries = isMetadataTable ? 3 : 2;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const delay = attempt === 0 ? initialDelay : initialDelay * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      let foundRecords: SNRecord[] = [];

      try {
        // Strategy 1: Exact name match (<table>_<sys_id>)
        const updateName = `${table}_${recordSysId}`;
        foundRecords = await this.getRecords('sys_update_xml', {
          sysparm_query: `name=${updateName}^ORDERBYDESCsys_created_on`,
          sysparm_fields: 'sys_id,name,update_set,action',
          sysparm_exclude_reference_link: true,
          sysparm_limit: 5
        });

        // Strategy 2: LIKE search on sys_id (covers variant naming patterns)
        if (foundRecords.length === 0) {
          foundRecords = await this.getRecords('sys_update_xml', {
            sysparm_query: `nameLIKE${recordSysId}^ORDERBYDESCsys_created_on`,
            sysparm_fields: 'sys_id,name,update_set,action',
            sysparm_exclude_reference_link: true,
            sysparm_limit: 5
          });
        }

        // Strategy 3: For metadata tables, search by table type + recent creation
        // sys_dictionary records may use naming like sys_dictionary_<table>.<element>
        if (foundRecords.length === 0 && isMetadataTable) {
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
          foundRecords = await this.getRecords('sys_update_xml', {
            sysparm_query: `nameSTARTSWITH${table}_^sys_created_on>=${fiveMinAgo}^ORDERBYDESCsys_created_on`,
            sysparm_fields: 'sys_id,name,update_set,action,payload',
            sysparm_exclude_reference_link: true,
            sysparm_limit: 20
          });
          // Filter to only records whose payload contains the sys_id
          if (foundRecords.length > 0) {
            foundRecords = foundRecords.filter(r =>
              String(r.payload || '').includes(recordSysId) ||
              String(r.name || '').includes(recordSysId)
            );
          }
        }

        if (foundRecords.length > 0) {
          for (const record of foundRecords) {
            const currentUpdateSet = this.resolveRefValue(record.update_set);
            if (currentUpdateSet !== this._activeUpdateSetId) {
              try {
                await this.updateRecord('sys_update_xml', record.sys_id, {
                  update_set: this._activeUpdateSetId
                });
                moved++;
              } catch (e) {
                const err = e as Error;
                errors.push(`Failed to move ${record.name}: ${err.message}`);
              }
            } else {
              // Already in correct update set (session-based capture worked)
              moved++;
            }
          }
          break; // Success — stop retrying
        }
      } catch (e) {
        const err = e as Error;
        if (attempt === maxRetries - 1) {
          errors.push(`Failed to query sys_update_xml: ${err.message}`);
        }
        // Otherwise retry
      }
    }

    // Layer 3 fallback: Use AddToUpdateSetHelper API (GlideUpdateManager2.saveRecord)
    // This works for ANY table type, including those that don't reliably generate sys_update_xml
    if (moved === 0) {
      const layer3Result = await this.callAddToUpdateSetApi(table, recordSysId, this._activeUpdateSetId || undefined);
      if (layer3Result.success && layer3Result.captured) {
        moved = 1;
        // Clear any previous errors since Layer 3 succeeded
        errors.length = 0;
      } else if (layer3Result.error && !layer3Result.error.includes('not available')) {
        errors.push(`Layer 3 (GlideUpdateManager2) also failed: ${layer3Result.error}`);
      }
    }

    // Final fallback: if still nothing found after all 3 layers, log a warning
    if (moved === 0 && errors.length === 0) {
      errors.push(
        `No sys_update_xml entry found for ${table} record ${recordSysId} after ${maxRetries} attempts ` +
        `and Layer 3 fallback. The record may need manual capture via sn_move_to_update_set.`
      );
    }

    return { moved, errors };
  }

  /**
   * Verify that a list of artifacts are all captured in the active update set.
   * Returns a detailed report of which artifacts are captured, missing, or need moving.
   *
   * @param artifacts - Array of {table, sys_id, name} for each artifact to verify
   * @returns Verification result with captured/missing/moved counts
   */
  async verifyAllArtifactsCaptured(
    artifacts: Array<{ table: string; sys_id: string; name?: string }>
  ): Promise<{
    allCaptured: boolean;
    captured: number;
    missing: number;
    movedNow: number;
    details: Array<{ table: string; sys_id: string; name?: string; status: 'captured' | 'moved' | 'missing'; error?: string }>;
  }> {
    if (!this._activeUpdateSetId) {
      return {
        allCaptured: false,
        captured: 0,
        missing: artifacts.length,
        movedNow: 0,
        details: artifacts.map(a => ({ ...a, status: 'missing' as const, error: 'No active update set' }))
      };
    }

    // Get all contents of the active update set
    const updateSetContents = await this.getRecords('sys_update_xml', {
      sysparm_query: `update_set=${this._activeUpdateSetId}`,
      sysparm_fields: 'sys_id,name,type,target_name,action',
      sysparm_exclude_reference_link: true,
      sysparm_limit: 500
    });

    // Build a Set of all sys_ids mentioned in the update set names/payloads
    const capturedNames = new Set(updateSetContents.map(r => String(r.name || '')));

    const details: Array<{ table: string; sys_id: string; name?: string; status: 'captured' | 'moved' | 'missing'; error?: string }> = [];
    let captured = 0;
    let missing = 0;
    let movedNow = 0;

    for (const artifact of artifacts) {
      const expectedName = `${artifact.table}_${artifact.sys_id}`;
      // Check if any captured record name contains this artifact's sys_id or matches the expected name
      const found = capturedNames.has(expectedName) ||
        [...capturedNames].some(name => name.includes(artifact.sys_id));

      if (found) {
        captured++;
        details.push({ ...artifact, status: 'captured' });
      } else {
        // Attempt to move it now
        const moveResult = await this.moveArtifactToUpdateSet(artifact.table, artifact.sys_id);
        if (moveResult.moved > 0) {
          movedNow++;
          details.push({ ...artifact, status: 'moved' });
        } else {
          missing++;
          details.push({
            ...artifact,
            status: 'missing',
            error: moveResult.errors.length > 0 ? moveResult.errors.join('; ') : 'Not found in sys_update_xml'
          });
        }
      }
    }

    return {
      allCaptured: missing === 0,
      captured,
      missing,
      movedNow,
      details
    };
  }


  /**
   * Test connection to ServiceNow instance
   */
  async testConnection(): Promise<{ success: boolean; message: string; instanceInfo?: unknown }> {
    try {
      const response = await this.client.get('/api/now/table/sys_user', {
        params: { sysparm_limit: 1 }
      });

      return {
        success: true,
        message: `Connected to ${this.config.instanceUrl}`,
        instanceInfo: {
          url: this.config.instanceUrl,
          authenticated: true
        }
      };
    } catch (error) {
      const axiosError = error as AxiosError<SNErrorResponse>;
      return {
        success: false,
        message: axiosError.response?.data?.error?.message || axiosError.message
      };
    }
  }

  /**
   * Query records from a table
   */
  async getRecords(table: string, params: SNQueryParams = {}): Promise<SNRecord[]> {
    const response = await this.client.get<SNApiResponse<SNRecord[]>>(
      `/api/now/table/${table}`,
      { params }
    );
    return response.data.result;
  }

  /**
   * Get a single record by sys_id
   */
  async getRecord(table: string, sysId: string, fields?: string[]): Promise<SNRecord | null> {
    const params: SNQueryParams = {};
    if (fields?.length) {
      params.sysparm_fields = fields.join(',');
    }

    const response = await this.client.get<SNApiResponse<SNRecord>>(
      `/api/now/table/${table}/${sysId}`,
      { params }
    );
    return response.data.result;
  }

  /**
   * Create a new record
   */
  async createRecord(table: string, data: Record<string, unknown>): Promise<SNRecord> {
    const response = await this.client.post<SNApiResponse<SNRecord>>(
      `/api/now/table/${table}`,
      data
    );
    return response.data.result;
  }

  /**
   * Update an existing record
   */
  async updateRecord(table: string, sysId: string, data: Record<string, unknown>): Promise<SNRecord> {
    const response = await this.client.patch<SNApiResponse<SNRecord>>(
      `/api/now/table/${table}/${sysId}`,
      data
    );
    return response.data.result;
  }

  /**
   * Delete a record
   */
  async deleteRecord(table: string, sysId: string): Promise<void> {
    await this.client.delete(`/api/now/table/${table}/${sysId}`);
  }

  /**
   * Get table schema (fields/columns)
   */
  async getTableSchema(tableName: string): Promise<SNRecord[]> {
    const response = await this.client.get<SNApiResponse<SNRecord[]>>(
      '/api/now/table/sys_dictionary',
      {
        params: {
          sysparm_query: `name=${tableName}^elementISNOTEMPTY`,
          sysparm_fields: 'element,column_label,internal_type,max_length,mandatory,reference,default_value,choice'
        }
      }
    );
    return response.data.result;
  }

  /**
   * Get list of tables
   */
  async getTables(query?: string): Promise<SNRecord[]> {
    const params: SNQueryParams = {
      sysparm_fields: 'name,label,super_class,sys_scope,is_extendable',
      sysparm_limit: 100
    };
    if (query) {
      params.sysparm_query = query;
    }

    const response = await this.client.get<SNApiResponse<SNRecord[]>>(
      '/api/now/table/sys_db_object',
      { params }
    );
    return response.data.result;
  }

  /**
   * Execute a background script (requires elevated privileges)
   */
  async executeScript(script: string): Promise<unknown> {
    // Note: This requires the Scripted REST API or sys_script_execution
    // This is a simplified version - real implementation would need proper endpoint
    const response = await this.client.post('/api/now/table/sys_script_execution', {
      script
    });
    return response.data.result;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<SNRecord | null> {
    const response = await this.client.get<SNApiResponse<SNRecord[]>>(
      '/api/now/table/sys_user',
      {
        params: {
          sysparm_query: `user_name=${this.config.username}`,
          sysparm_limit: 1
        }
      }
    );
    const users = response.data.result;
    return users && users.length > 0 ? users[0] : null;
  }

  get instanceUrl(): string {
    return this.config.instanceUrl;
  }

  /** Expose credentials for SDK CI mode (used by sn_deploy_sdk_flow tool) */
  get credentials(): { instanceUrl: string; username: string; password: string } {
    return {
      instanceUrl: this.config.instanceUrl,
      username: this.config.username,
      password: this.config.password,
    };
  }

  /**
   * Call a custom Scripted REST API endpoint
   * @param path API path (e.g., '/api/37610/ui_policy_action_helper/create')
   * @param method HTTP method
   * @param data Request body
   * @returns API response
   */
  async callScriptedRestApi<T = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    data?: Record<string, unknown>
  ): Promise<T> {
    const config = {
      method,
      url: path,
      ...(data && method !== 'GET' ? { data } : {}),
      ...(data && method === 'GET' ? { params: data } : {})
    };

    const response = await this.client.request<{ result: T }>(config);
    return response.data.result;
  }
}

export default ServiceNowClient;

