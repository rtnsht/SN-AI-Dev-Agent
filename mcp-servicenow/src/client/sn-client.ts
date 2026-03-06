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

// Cache for helper API paths per instance
const helperApiPaths = new Map<string, { uiPolicyActionHelper?: string; updateSetHelper?: string }>();

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
  getHelperApiPath(apiKey: 'uiPolicyActionHelper' | 'updateSetHelper'): string | undefined {
    const paths = helperApiPaths.get(this.config.instanceUrl);
    return paths?.[apiKey];
  }

  /**
   * Set a helper API path (called after initialization)
   */
  setHelperApiPath(apiKey: 'uiPolicyActionHelper' | 'updateSetHelper', path: string): void {
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
   * Move a record's sys_update_xml entry to the active update set.
   * This is the reliable fallback for when session-based update set capture fails.
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

    try {
      // Small delay to allow sys_update_xml record to be created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Query sys_update_xml for this record
      // The name field follows pattern: <table>_<sys_id>
      const updateName = `${table}_${recordSysId}`;
      const records = await this.getRecords('sys_update_xml', {
        sysparm_query: `name=${updateName}^ORDERBYDESCsys_created_on`,
        sysparm_fields: 'sys_id,name,update_set,action',
        sysparm_limit: 5
      });

      for (const record of records) {
        if (record.update_set !== this._activeUpdateSetId) {
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

      // Fallback: if no records found with exact name, try broader search
      if (records.length === 0) {
        const fallbackRecords = await this.getRecords('sys_update_xml', {
          sysparm_query: `nameLIKE${recordSysId}^ORDERBYDESCsys_created_on`,
          sysparm_fields: 'sys_id,name,update_set,action',
          sysparm_limit: 5
        });

        for (const record of fallbackRecords) {
          if (record.update_set !== this._activeUpdateSetId) {
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
            moved++;
          }
        }
      }
    } catch (e) {
      const err = e as Error;
      errors.push(`Failed to query sys_update_xml: ${err.message}`);
    }

    return { moved, errors };
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

