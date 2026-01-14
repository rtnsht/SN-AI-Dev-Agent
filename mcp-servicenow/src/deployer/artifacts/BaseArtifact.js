/**
 * Base class for all ServiceNow artifact deployers
 */
export class BaseArtifact {
    constructor(client, updateSetManager) {
        this.client = client;
        this.updateSetManager = updateSetManager;
    }

    /**
     * Table name for this artifact type
     */
    get table() {
        throw new Error('Subclass must implement table getter');
    }

    /**
     * Unique identifier field (usually 'name')
     */
    get identifierField() {
        return 'name';
    }

    /**
     * Deploy an artifact
     * @param {Object} config - Artifact configuration from deployment manifest
     * @param {string} script - Script content (if applicable)
     */
    async deploy(config, script = null) {
        const artifactName = config.name;
        console.log(`\n📜 Deploying ${this.constructor.name}: ${artifactName}...`);

        // Build data payload
        const data = this.buildPayload(config, script);

        // Check if exists
        const existing = await this.client.findRecord(
            this.table,
            this.identifierField,
            artifactName,
            ['sys_id', 'sys_update_name']
        );

        let sysUpdateName;

        if (existing) {
            // Update existing
            await this.client.updateRecord(this.table, existing.sys_id, data);
            sysUpdateName = existing.sys_update_name;
            console.log(`   ✅ Updated existing ${this.constructor.name}`);
        } else {
            // Create new
            const result = await this.client.createRecord(this.table, data);
            sysUpdateName = result.result.sys_update_name;
            console.log(`   ✅ Created ${this.constructor.name}`);
        }

        // Move to target update set
        await this.updateSetManager.moveArtifactToUpdateSet(sysUpdateName);

        return { success: true, sysUpdateName };
    }

    /**
     * Build the payload for the artifact - override in subclasses
     */
    buildPayload(config, script) {
        throw new Error('Subclass must implement buildPayload');
    }
}

export default BaseArtifact;

