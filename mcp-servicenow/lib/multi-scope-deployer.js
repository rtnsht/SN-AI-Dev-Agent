/**
 * Multi-Scope Deployer - Handles deploying artifacts across multiple scopes
 */

import { ScopeManager } from './scope-manager.js';

export class MultiScopeDeployer {
    constructor(instanceUrl, auth) {
        this.instanceUrl = instanceUrl;
        this.auth = auth;
        this.scopeManager = new ScopeManager(instanceUrl, auth);
        this.deploymentLog = [];
    }

    /**
     * Initialize - discover scopes
     */
    async initialize() {
        await this.scopeManager.discoverScopes();
        return this.scopeManager.scopes;
    }

    /**
     * Deploy a requirement with multiple artifacts across scopes
     * @param {Object} requirement - Parsed requirement object
     * @param {Array} artifacts - Array of { type, name, scope, data }
     */
    async deployRequirement(requirementId, artifacts) {
        console.log(`\n━━━ Deploying ${requirementId} ━━━\n`);

        // Group artifacts by scope
        const byScope = {};
        for (const artifact of artifacts) {
            const scope = artifact.scope || 'global';
            if (!byScope[scope]) byScope[scope] = [];
            byScope[scope].push(artifact);
        }

        console.log(`Scopes involved: ${Object.keys(byScope).join(', ')}\n`);

        // Create update sets for each scope
        for (const scope of Object.keys(byScope)) {
            const updateSetName = `${requirementId} - ${scope}`;
            const updateSetId = await this.scopeManager.getOrCreateUpdateSet(scope, updateSetName);
            console.log(`✅ Update Set for ${scope}: ${updateSetId}`);
        }

        // Deploy artifacts
        for (const [scope, scopeArtifacts] of Object.entries(byScope)) {
            console.log(`\n━━━ Deploying to scope: ${scope} ━━━\n`);
            
            for (const artifact of scopeArtifacts) {
                try {
                    const result = await this.deployArtifact(artifact, scope);
                    this.deploymentLog.push({
                        requirementId,
                        scope,
                        artifact: artifact.name,
                        type: artifact.type,
                        status: 'success',
                        sysId: result.sys_id
                    });
                    console.log(`  ✅ ${artifact.type}: ${artifact.name}`);
                } catch (err) {
                    this.deploymentLog.push({
                        requirementId,
                        scope,
                        artifact: artifact.name,
                        type: artifact.type,
                        status: 'error',
                        error: err.message
                    });
                    console.log(`  ❌ ${artifact.type}: ${artifact.name} - ${err.message}`);
                }
            }
        }

        // Move all artifacts to correct update sets
        console.log('\n━━━ Organizing Update Sets ━━━\n');
        for (const entry of this.deploymentLog.filter(e => e.status === 'success')) {
            const updateSetId = this.scopeManager.updateSets[entry.scope];
            const table = this.getTableForType(entry.type);
            const moved = await this.scopeManager.moveToUpdateSet(entry.sysId, table, updateSetId);
            if (moved) {
                console.log(`  📦 Moved ${entry.artifact} to ${entry.scope} update set`);
            }
        }

        return {
            success: this.deploymentLog.filter(e => e.status === 'success').length,
            failed: this.deploymentLog.filter(e => e.status === 'error').length,
            updateSets: this.scopeManager.getUpdateSetSummary(),
            log: this.deploymentLog
        };
    }

    /**
     * Deploy a single artifact
     */
    async deployArtifact(artifact, scope) {
        const table = this.getTableForType(artifact.type);
        
        // Add scope to the data if not global
        const data = { ...artifact.data };
        if (scope !== 'global') {
            const scopeRecord = this.scopeManager.scopes.find(s => s.scope === scope);
            if (scopeRecord) {
                data.sys_scope = scopeRecord.sysId;
            }
        }

        return await this.scopeManager.createRecord(table, data);
    }

    /**
     * Get ServiceNow table name for artifact type
     */
    getTableForType(type) {
        const mapping = {
            'Script Include': 'sys_script_include',
            'Business Rule': 'sys_script',
            'Client Script': 'sys_script_client',
            'UI Action': 'sys_ui_action',
            'UI Policy': 'sys_ui_policy',
            'Scheduled Job': 'sysauto_script',
            'REST Message': 'sys_rest_message',
            'Transform Map': 'sys_transform_map',
            'Flow': 'sys_hub_flow',
            'Subflow': 'sys_hub_flow'
        };
        return mapping[type] || type;
    }

    /**
     * Get deployment summary
     */
    getSummary() {
        return {
            totalDeployed: this.deploymentLog.filter(e => e.status === 'success').length,
            totalFailed: this.deploymentLog.filter(e => e.status === 'error').length,
            updateSets: this.scopeManager.getUpdateSetSummary(),
            byScope: this.groupLogByScope()
        };
    }

    groupLogByScope() {
        const grouped = {};
        for (const entry of this.deploymentLog) {
            if (!grouped[entry.scope]) grouped[entry.scope] = [];
            grouped[entry.scope].push(entry);
        }
        return grouped;
    }
}

export default MultiScopeDeployer;

