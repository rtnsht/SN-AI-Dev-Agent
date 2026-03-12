/**
 * Update Set Manager
 * Handles creation, activation, and artifact tracking for update sets
 */
export class UpdateSetManager {
    constructor(client) {
        this.client = client;
        this.currentUpdateSetId = null;
    }

    /**
     * Create a new update set
     * Checks for duplicate names and appends timestamp if needed
     */
    async create(name, description = '') {
        console.log(`\n📦 Creating Update Set: ${name}...`);

        // Check if update set with same name already exists
        const uniqueName = await this.getUniqueName(name);
        if (uniqueName !== name) {
            console.log(`   ⚠️  Name already exists, using: ${uniqueName}`);
        }

        const result = await this.client.createRecord('sys_update_set', {
            name: uniqueName,
            description,
            state: 'in progress'
        });

        this.currentUpdateSetId = result.result.sys_id;
        console.log(`   ✅ Created: ${result.result.name}`);
        return this.currentUpdateSetId;
    }

    /**
     * Get a unique update set name by checking for duplicates
     * Appends datetime timestamp if name already exists
     */
    async getUniqueName(name) {
        try {
            const existing = await this.client.queryRecords(
                'sys_update_set',
                `name=${name}`,
                ['sys_id']
            );

            if (existing.result && existing.result.length > 0) {
                // Name exists, append timestamp
                const timestamp = new Date().toISOString()
                    .replace(/[T:]/g, '-')
                    .replace(/\..+/, '');  // Format: 2026-01-14-10-30-45
                return `${name}_${timestamp}`;
            }
        } catch (e) {
            // If query fails, just return original name
        }
        return name;
    }

    /**
     * Set the current update set using the UpdateSetHelper API
     * Requires SN_UPDATE_SET_API_PATH to be configured in .env
     */
    async setAsCurrent(updateSetId) {
        console.log('   Setting as current update set...');

        const apiPath = process.env.SN_UPDATE_SET_API_PATH;

        if (!apiPath) {
            console.log('   ❌ SN_UPDATE_SET_API_PATH not configured!');
            console.log('   📝 Add to .env: SN_UPDATE_SET_API_PATH=/api/<namespace>/update_set_helper/set_current');
            console.log('   📝 Or run: node src/deployer/setup-updateset-api.js');
            throw new Error('SN_UPDATE_SET_API_PATH not configured in .env');
        }

        try {
            await this.client.post(apiPath, { sys_id: updateSetId });
            console.log(`   ✅ Set as current via UpdateSetHelper API`);
        } catch (e) {
            const errorMsg = e.response?.data?.error?.message || e.message;
            console.log(`   ❌ Failed to set current update set: ${errorMsg}`);

            if (e.response?.status === 403) {
                console.log('   📝 Check Default ACL on the UpdateSetHelper API');
            } else if (e.response?.status === 404) {
                console.log('   📝 API not found - verify SN_UPDATE_SET_API_PATH is correct');
            }

            throw new Error(`Failed to set current update set: ${errorMsg}`);
        }

        this.currentUpdateSetId = updateSetId;
    }

    /**
     * Extract sys_id from a ServiceNow reference field (may be string or {link, value} object)
     */
    _resolveRef(field) {
        if (typeof field === 'string') return field;
        if (field && typeof field === 'object' && 'value' in field) return String(field.value);
        return String(field ?? '');
    }

    /**
     * Move an artifact's update record to the current update set.
     * Uses retry logic with increasing delays for reliable capture.
     * This compensates for REST API not respecting session-based update set.
     *
     * Three-layer defense strategy:
     * - Layer 1: Session-based capture (handled by setCurrentUpdateSet)
     * - Layer 2: Post-creation sys_update_xml move (this method)
     * - Layer 3: Server-side GlideUpdateManager2 (handled by MCP TypeScript client)
     */
    async moveArtifactToUpdateSet(sysUpdateName) {
        if (!this.currentUpdateSetId || !sysUpdateName) return;

        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const delay = attempt === 0 ? 1000 : 1500 * (attempt + 1);
            await new Promise(r => setTimeout(r, delay));

            try {
                const record = await this.client.findRecord(
                    'sys_update_xml',
                    'name',
                    sysUpdateName,
                    ['sys_id', 'update_set']
                );

                if (record) {
                    const currentUpdateSet = this._resolveRef(record.update_set);
                    if (currentUpdateSet !== this.currentUpdateSetId) {
                        await this.client.updateRecord('sys_update_xml', record.sys_id, {
                            update_set: this.currentUpdateSetId
                        });
                    }
                    return; // Success — stop retrying
                }
            } catch (e) {
                if (attempt === maxRetries - 1) {
                    console.warn(`   ⚠️  Failed to move ${sysUpdateName} to update set after ${maxRetries} attempts`);
                }
                // Otherwise retry
            }
        }
    }

    /**
     * Validate update set contents
     */
    async validate(updateSetId) {
        console.log('\n🔍 Validating Update Set Contents...');
        await new Promise(r => setTimeout(r, 1000));

        const result = await this.client.queryRecords(
            'sys_update_xml',
            `update_set=${updateSetId}`,
            ['name', 'type', 'action']
        );

        const artifacts = result.result || [];
        console.log(`   Found ${artifacts.length} artifact(s) in update set`);

        if (artifacts.length === 0) {
            console.log('   ⚠️  WARNING: No artifacts captured!');
            return { valid: false, artifacts: [] };
        }

        artifacts.forEach((u, i) => {
            console.log(`   ${i + 1}. ${u.name} [${u.action}]`);
        });

        return { valid: artifacts.length > 0, artifacts };
    }

    /**
     * Get update set URL
     */
    getUpdateSetUrl(updateSetId) {
        return `${this.client.instanceUrl}/sys_update_set.do?sys_id=${updateSetId}`;
    }
}

export default UpdateSetManager;

