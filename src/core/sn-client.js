/**
 * ServiceNow REST API Client
 * Handles all communication with ServiceNow instances
 */

import axios from 'axios';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export class SNClient {
  constructor(instanceConfig = null) {
    this.config = instanceConfig || config.getInstanceConfig();
    this.baseUrl = this.config.url;
    this.client = null;
    this.authenticated = false;
  }

  async initialize() {
    if (!this.baseUrl) {
      throw new Error('ServiceNow instance URL not configured');
    }

    // Remove trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // Set up authentication
    if (this.config.authMethod === 'basic') {
      this.client.defaults.auth = {
        username: this.config.username,
        password: this.config.password
      };
    } else if (this.config.authMethod === 'oauth') {
      await this.setupOAuth();
    }

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => this.handleError(error)
    );

    logger.debug(`SNClient initialized for ${this.baseUrl}`);
    return this;
  }

  async setupOAuth() {
    // OAuth token retrieval
    const tokenResponse = await axios.post(`${this.baseUrl}/oauth_token.do`, {
      grant_type: 'password',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      username: this.config.username,
      password: this.config.password
    });

    this.accessToken = tokenResponse.data.access_token;
    this.client.defaults.headers['Authorization'] = `Bearer ${this.accessToken}`;
  }

  handleError(error) {
    if (error.response) {
      logger.error(`API Error: ${error.response.status}`, {
        url: error.config?.url,
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      logger.error('No response received from ServiceNow');
    } else {
      logger.error(`Request error: ${error.message}`);
    }
    throw error;
  }

  // Test connection to instance
  async testConnection() {
    try {
      const response = await this.client.get('/api/now/table/sys_user?sysparm_limit=1');
      logger.success(`Connected to ${this.baseUrl}`);
      this.authenticated = true;
      return true;
    } catch (error) {
      logger.error(`Failed to connect to ${this.baseUrl}`);
      return false;
    }
  }

  // Generic GET request
  async get(endpoint, params = {}) {
    const response = await this.client.get(endpoint, { params });
    return response.data.result;
  }

  // Generic POST request
  async post(endpoint, data) {
    const response = await this.client.post(endpoint, data);
    return response.data.result;
  }

  // Generic PUT request
  async put(endpoint, data) {
    const response = await this.client.put(endpoint, data);
    return response.data.result;
  }

  // Generic PATCH request
  async patch(endpoint, data) {
    const response = await this.client.patch(endpoint, data);
    return response.data.result;
  }

  // Generic DELETE request
  async delete(endpoint) {
    const response = await this.client.delete(endpoint);
    return response.data;
  }

  // Table API helpers
  async getRecords(table, query = '', fields = [], limit = 100) {
    const params = {
      sysparm_limit: limit
    };
    if (query) params.sysparm_query = query;
    if (fields.length) params.sysparm_fields = fields.join(',');

    return this.get(`/api/now/table/${table}`, params);
  }

  async getRecord(table, sysId) {
    return this.get(`/api/now/table/${table}/${sysId}`);
  }

  async createRecord(table, data) {
    return this.post(`/api/now/table/${table}`, data);
  }

  async updateRecord(table, sysId, data) {
    return this.patch(`/api/now/table/${table}/${sysId}`, data);
  }

  async deleteRecord(table, sysId) {
    return this.delete(`/api/now/table/${table}/${sysId}`);
  }

  // Get table schema/metadata
  async getTableSchema(tableName) {
    const fields = await this.getRecords('sys_dictionary', 
      `name=${tableName}`, 
      ['element', 'column_label', 'internal_type', 'max_length', 'mandatory', 'reference']
    );
    return fields;
  }

  // Get instance info
  async getInstanceInfo() {
    const stats = await this.get('/api/now/stats');
    return stats;
  }
}

export default SNClient;

