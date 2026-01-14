/**
 * ServiceNow REST API Client with session support
 * Handles authentication and cookie-based session management
 */
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export class ServiceNowClient {
    constructor(config) {
        this.instanceUrl = config.instanceUrl;
        this.auth = { 
            username: config.username, 
            password: config.password 
        };
        this.headers = { 
            'Accept': 'application/json', 
            'Content-Type': 'application/json' 
        };

        // Create axios instance with cookie jar for session persistence
        const jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar,
            withCredentials: true,
            baseURL: this.instanceUrl
        }));
    }

    async get(path, params = {}) {
        const response = await this.client.get(path, {
            auth: this.auth,
            headers: this.headers,
            params
        });
        return response.data;
    }

    async post(path, data) {
        const response = await this.client.post(path, data, {
            auth: this.auth,
            headers: this.headers
        });
        return response.data;
    }

    async patch(path, data) {
        const response = await this.client.patch(path, data, {
            auth: this.auth,
            headers: this.headers
        });
        return response.data;
    }

    async delete(path) {
        const response = await this.client.delete(path, {
            auth: this.auth,
            headers: this.headers
        });
        return response.data;
    }

    /**
     * Query records from a table
     */
    async queryRecords(table, query, fields = []) {
        const params = { sysparm_query: query };
        if (fields.length > 0) {
            params.sysparm_fields = fields.join(',');
        }
        return this.get(`/api/now/table/${table}`, params);
    }

    /**
     * Get a single record by sys_id
     */
    async getRecord(table, sysId, fields = []) {
        const params = {};
        if (fields.length > 0) {
            params.sysparm_fields = fields.join(',');
        }
        return this.get(`/api/now/table/${table}/${sysId}`, params);
    }

    /**
     * Create a record
     */
    async createRecord(table, data) {
        return this.post(`/api/now/table/${table}`, data);
    }

    /**
     * Update a record
     */
    async updateRecord(table, sysId, data) {
        return this.patch(`/api/now/table/${table}/${sysId}`, data);
    }

    /**
     * Find record by field value
     */
    async findRecord(table, field, value, fields = []) {
        const result = await this.queryRecords(table, `${field}=${value}`, fields);
        return result.result?.[0] || null;
    }
}

export default ServiceNowClient;

