/**
 * ServiceNow Deployer
 * Generic deployment framework for ServiceNow artifacts
 */
import fs from 'fs';
import path from 'path';
import { ServiceNowClient } from './ServiceNowClient.js';
import { UpdateSetManager } from './UpdateSetManager.js';
import { ArtifactTypes } from './artifacts/index.js';

export class ServiceNowDeployer {
    constructor(config) {
        this.client = new ServiceNowClient(config);
        this.updateSetManager = new UpdateSetManager(this.client);
        this.artifactHandlers = {};

        // Initialize artifact handlers
        for (const [type, HandlerClass] of Object.entries(ArtifactTypes)) {
            this.artifactHandlers[type] = new HandlerClass(this.client, this.updateSetManager);
        }
    }

    /**
     * Deploy from a manifest file
     * @param {string} manifestPath - Path to the deployment manifest JSON
     */
    async deployFromManifest(manifestPath) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const basePath = path.dirname(manifestPath);

        return this.deploy(manifest, basePath);
    }

    /**
     * Deploy from a manifest object
     * @param {Object} manifest - Deployment manifest
     * @param {string} basePath - Base path for resolving relative file paths
     */
    async deploy(manifest, basePath = process.cwd()) {
        console.log('═══════════════════════════════════════════════════════');
        console.log(`  Deploying: ${manifest.name}`);
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Instance: ${this.client.instanceUrl}`);

        const results = { success: true, artifacts: [], errors: [] };

        try {
            // Create and set update set
            const updateSetId = await this.updateSetManager.create(
                manifest.updateSet.name,
                manifest.updateSet.description || ''
            );
            await this.updateSetManager.setAsCurrent(updateSetId);

            // Deploy each artifact
            for (const artifact of manifest.artifacts) {
                try {
                    await this.deployArtifact(artifact, basePath);
                    results.artifacts.push({ name: artifact.name, success: true });
                } catch (error) {
                    console.error(`   ❌ Failed: ${error.message}`);
                    results.artifacts.push({ name: artifact.name, success: false, error: error.message });
                    results.errors.push(error);
                }
            }

            // Validate
            const validation = await this.updateSetManager.validate(updateSetId);
            results.valid = validation.valid;

            // Summary
            console.log('\n═══════════════════════════════════════════════════════');
            console.log(results.errors.length === 0 ? '  ✅ DEPLOYMENT COMPLETE' : '  ⚠️  DEPLOYMENT COMPLETE (with errors)');
            console.log('═══════════════════════════════════════════════════════');
            console.log(`Update Set: ${this.updateSetManager.getUpdateSetUrl(updateSetId)}`);

            results.updateSetId = updateSetId;
            results.updateSetUrl = this.updateSetManager.getUpdateSetUrl(updateSetId);

        } catch (error) {
            console.error('\n❌ Deployment failed:', error.message);
            results.success = false;
            results.errors.push(error);
        }

        return results;
    }

    /**
     * Deploy a single artifact
     */
    async deployArtifact(artifact, basePath) {
        const handler = this.artifactHandlers[artifact.type];
        if (!handler) {
            throw new Error(`Unknown artifact type: ${artifact.type}`);
        }

        // Load script if file path provided
        let script = artifact.script || null;
        if (artifact.file) {
            const filePath = path.resolve(basePath, artifact.file);
            script = fs.readFileSync(filePath, 'utf8');
        }

        return handler.deploy(artifact, script);
    }
}

export default ServiceNowDeployer;

