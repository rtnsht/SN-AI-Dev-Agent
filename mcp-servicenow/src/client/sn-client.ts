/**
 * ServiceNow REST API Client
 * Handles all HTTP communication with ServiceNow instances
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { SNConfig, SNRecord, SNQueryParams, SNApiResponse, SNErrorResponse } from '../types/index.js';

export class ServiceNowClient {
  private client: AxiosInstance;
  private config: SNConfig;

  constructor(config: SNConfig) {
    this.config = config;
    
    // Remove trailing slash from URL
    const baseURL = config.instanceUrl.replace(/\/$/, '');
    
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      auth: {
        username: config.username,
        password: config.password
      },
      timeout: 30000
    });
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
}

export default ServiceNowClient;

