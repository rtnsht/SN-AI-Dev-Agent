#!/usr/bin/env node
/**
 * DeploymentHelper - Reusable deployment utility for ServiceNow artifacts
 * 
 * Handles:
 * - Update set creation and setting as current (BEFORE any artifacts)
 * - Idempotent artifact deployment (find or create)
 * - Clean artifact naming (noun+verb, no requirement IDs)
 * 
 * Usage:
 *   import DeploymentHelper from './DeploymentHelper.js';
 *   const deployer = new DeploymentHelper(config);
 *   await deployer.initialize('My Feature Update Set', 'Description');
 *   await deployer.deploy('sys_script_include', 'ValidateHighImpact', {...});
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

export class DeploymentHelper {
    constructor(config) {
        this.config = config;
        this.client = axios.create({
            baseURL: config.instanceUrl,
            auth: { username: config.username, password: config.password },
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            timeout: 30000
        });
        this.updateSetId = null;
        this.results = {};
    }

    /**
     * Initialize deployment - creates update set and sets as current
     * MUST be called before deploying any artifacts
     */
    async initialize(updateSetName, description = '') {
        console.log('\n🚀 Initializing Deployment...\n');
        console.log(`   Instance: ${this.config.instanceUrl}`);
        console.log(`   User: ${this.config.username}\n`);

        // Step 1: Create Update Set
        console.log('📦 Creating Update Set...');
        const updateSet = await this.createRecord('sys_update_set', {
            name: updateSetName,
            description: description,
            state: 'in progress'
        });
        this.updateSetId = updateSet.sys_id;
        this.results.updateSet = updateSet.sys_id;
        console.log(`   ✅ Created: ${updateSet.sys_id}`);

        // Step 2: Set as current (CRITICAL - must happen before any artifact creation)
        console.log('   Setting as current...');
        const success = await this.setCurrentUpdateSet(updateSet.sys_id);
        if (success) {
            console.log('   ✅ Update set is CURRENT - all artifacts will be captured\n');
        } else {
            console.log('   ⚠️  Could not set as current. Artifacts may go to Default update set.\n');
            console.log('   💡 Run: node src/deployer/setup-updateset-api.js\n');
        }

        return updateSet.sys_id;
    }

    /**
     * Set update set as current using the UpdateSetHelper API
     */
    async setCurrentUpdateSet(updateSetId) {
        const apiPath = process.env.SN_UPDATE_SET_API_PATH;
        if (!apiPath) {
            return false;
        }

        try {
            await this.client.post(apiPath, { sys_id: updateSetId });
            return true;
        } catch (error) {
            console.log(`   ⚠️  ${error.response?.data?.error?.message || error.message}`);
            return false;
        }
    }

    /**
     * Deploy an artifact (idempotent - finds existing or creates new)
     */
    async deploy(table, name, data, options = {}) {
        const { queryField = 'name', displayName = name } = options;
        
        try {
            // Build query to find existing
            let query = `${queryField}=${name}`;
            if (data.table) query += `^table=${data.table}`;
            if (data.collection) query += `^collection=${data.collection}`;

            // Check if exists
            const existing = await this.getRecords(table, { sysparm_query: query, sysparm_limit: 1 });

            if (existing && existing.length > 0) {
                console.log(`   ℹ️  ${displayName} exists: ${existing[0].sys_id}`);
                return { sys_id: existing[0].sys_id, existed: true };
            }

            // Create new
            const created = await this.createRecord(table, data);
            console.log(`   ✅ ${displayName}: ${created.sys_id}`);
            return { sys_id: created.sys_id, existed: false };

        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            console.log(`   ⚠️  ${displayName} error: ${msg}`);
            return { sys_id: null, error: msg };
        }
    }

    /**
     * Create a record in ServiceNow
     */
    async createRecord(table, data) {
        const response = await this.client.post(`/api/now/table/${table}`, data);
        return response.data.result;
    }

    /**
     * Get records from ServiceNow
     */
    async getRecords(table, params = {}) {
        const response = await this.client.get(`/api/now/table/${table}`, { params });
        return response.data.result;
    }

    /**
     * Get deployment results
     */
    getResults() {
        return this.results;
    }

    /**
     * Add result to results object
     */
    addResult(key, sysId) {
        this.results[key] = sysId;
    }
}

export default DeploymentHelper;

