/**
 * Scope Manager - Handles multi-scope deployments in ServiceNow
 */

import axios from 'axios';

export class ScopeManager {
    constructor(instanceUrl, auth) {
        this.instanceUrl = instanceUrl;
        this.auth = auth;
        this.headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
        this.scopes = [];
        this.updateSets = {}; // scope -> update set sys_id
    }

    async query(table, params = {}) {
        const response = await axios.get(`${this.instanceUrl}/api/now/table/${table}`, {
            params, auth: this.auth, headers: this.headers
        });
        return response.data.result;
    }

    async createRecord(table, data) {
        const response = await axios.post(`${this.instanceUrl}/api/now/table/${table}`, data, {
            auth: this.auth, headers: this.headers
        });
        return response.data.result;
    }

    async updateRecord(table, sysId, data) {
        const response = await axios.patch(`${this.instanceUrl}/api/now/table/${table}/${sysId}`, data, {
            auth: this.auth, headers: this.headers
        });
        return response.data.result;
    }

    /**
     * Discover all available scopes on the instance
     */
    async discoverScopes() {
        const scopes = await this.query('sys_scope', {
            sysparm_query: 'active=true',
            sysparm_fields: 'sys_id,scope,name,short_description',
            sysparm_limit: 100
        });

        this.scopes = scopes.map(s => ({
            sysId: s.sys_id,
            scope: s.scope,
            name: s.name,
            description: s.short_description
        }));

        return this.scopes;
    }

    /**
     * Get or create an update set for a specific scope
     */
    async getOrCreateUpdateSet(scopeId, updateSetName) {
        // Check if we already have one cached
        if (this.updateSets[scopeId]) {
            return this.updateSets[scopeId];
        }

        // Find scope sys_id
        const scope = this.scopes.find(s => s.scope === scopeId || s.sysId === scopeId);
        const scopeSysId = scope ? scope.sysId : null;

        // Check for existing in-progress update set with this name
        const existing = await this.query('sys_update_set', {
            sysparm_query: `name=${updateSetName}^state=in progress${scopeSysId ? `^application=${scopeSysId}` : ''}`,
            sysparm_fields: 'sys_id,name,application',
            sysparm_limit: 1
        });

        if (existing.length > 0) {
            this.updateSets[scopeId] = existing[0].sys_id;
            return existing[0].sys_id;
        }

        // Create new update set
        const newUS = await this.createRecord('sys_update_set', {
            name: updateSetName,
            description: `Auto-created for ${scopeId} scope deployment`,
            state: 'in progress',
            application: scopeSysId || ''
        });

        this.updateSets[scopeId] = newUS.sys_id;
        return newUS.sys_id;
    }

    /**
     * Move an artifact's update XML to the correct update set
     */
    async moveToUpdateSet(artifactSysId, artifactTable, targetUpdateSetId) {
        const updateName = `${artifactTable}_${artifactSysId}`;

        const updateXml = await this.query('sys_update_xml', {
            sysparm_query: `name=${updateName}`,
            sysparm_fields: 'sys_id,update_set',
            sysparm_limit: 1
        });

        if (updateXml.length > 0 && updateXml[0].update_set !== targetUpdateSetId) {
            await this.updateRecord('sys_update_xml', updateXml[0].sys_id, {
                update_set: targetUpdateSetId
            });
            return true;
        }
        return false;
    }

    /**
     * Infer scope from table name
     */
    inferScopeFromTable(tableName) {
        if (!tableName) return 'global';
        
        // Custom tables start with u_ or x_
        if (tableName.startsWith('x_')) {
            const parts = tableName.split('_');
            if (parts.length >= 3) {
                return `x_${parts[1]}_${parts[2]}`;
            }
        }
        
        // Standard tables are global
        return 'global';
    }

    /**
     * Get summary of all update sets created
     */
    getUpdateSetSummary() {
        return Object.entries(this.updateSets).map(([scope, sysId]) => ({
            scope,
            updateSetId: sysId,
            url: `${this.instanceUrl}/sys_update_set.do?sys_id=${sysId}`
        }));
    }
}

export default ScopeManager;

