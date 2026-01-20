#!/usr/bin/env node
/**
 * Generic Deployer for ServiceNow Requirements
 * 
 * Reads deployment-manifest.json from specs/REQ-XXX/3-implementation/
 * and deploys all artifacts to ServiceNow.
 * 
 * Usage:
 *   node deploy/deploy.js REQ-XXX
 *   node deploy/deploy.js REQ-003
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DeploymentHelper } from '../src/deployer/DeploymentHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const SPECS_DIR = path.join(__dirname, '../../specs');

const config = {
    instanceUrl: process.env.SN_INSTANCE_URL,
    username: process.env.SN_USERNAME,
    password: process.env.SN_PASSWORD
};

// Table mappings for artifact types
const TABLE_MAP = {
    'field': 'sys_dictionary',
    'script_include': 'sys_script_include',
    'business_rule': 'sys_script',
    'client_script': 'sys_script_client',
    'ui_policy': 'sys_ui_policy',
    'ui_policy_action': 'sys_ui_policy_action',
    'event': 'sysevent_register',
    'notification': 'sysevent_email_action',
    'ui_action': 'sys_ui_action'
};

async function deploy(reqId) {
    const implPath = path.join(SPECS_DIR, reqId, '3-implementation');
    const manifestPath = path.join(implPath, 'deployment-manifest.json');

    if (!fs.existsSync(manifestPath)) {
        console.error(`❌ Deployment manifest not found: ${manifestPath}`);
        console.error(`\n💡 Create specs/${reqId}/3-implementation/deployment-manifest.json`);
        process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const deployer = new DeploymentHelper(config);
    const results = {};

    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║  Deploying: ${reqId.padEnd(46)}║`);
    console.log(`║  ${(manifest.name || 'Unnamed Feature').padEnd(56)}║`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);

    try {
        // Initialize with update set
        await deployer.initialize(
            manifest.updateSetName || `${reqId} Deployment`,
            manifest.description || `Deployment for ${reqId}`
        );

        // Deploy each artifact
        for (let i = 0; i < manifest.artifacts.length; i++) {
            const artifact = manifest.artifacts[i];
            const table = TABLE_MAP[artifact.type] || artifact.table;
            const num = String(i + 1).padStart(2, '0');

            console.log(`${num}. ${artifact.type}: ${artifact.name}...`);

            // Read script content if file specified
            let data = { ...artifact.data };
            if (artifact.scriptFile) {
                const scriptPath = path.join(implPath, artifact.scriptFile);
                if (fs.existsSync(scriptPath)) {
                    data.script = fs.readFileSync(scriptPath, 'utf8');
                }
            }

            // Handle references to previous artifacts
            if (artifact.references) {
                for (const [field, refKey] of Object.entries(artifact.references)) {
                    if (results[refKey]) {
                        data[field] = results[refKey];
                    }
                }
            }

            const result = await deployer.deploy(
                table,
                artifact.name,
                data,
                artifact.options || {}
            );

            results[artifact.key || artifact.name] = result.sys_id;
        }

        // Summary
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('✅ DEPLOYMENT COMPLETE');
        console.log('═══════════════════════════════════════════════════════════════\n');
        console.log('📝 Deployed Artifacts:');
        Object.entries(results).forEach(([key, val]) => {
            console.log(`   • ${key}: ${val || 'SKIPPED'}`);
        });

        // Save results
        const resultsPath = path.join(implPath, 'deployment-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify({
            reqId,
            ...deployer.getResults(),
            artifacts: results,
            deployedAt: new Date().toISOString()
        }, null, 2));
        console.log(`\n📄 Results saved to ${resultsPath}\n`);

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        if (error.response?.data) {
            console.error('   Details:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

// Main
const reqId = process.argv[2];
if (!reqId) {
    console.error('Usage: node deploy/deploy.js REQ-XXX');
    process.exit(1);
}

deploy(reqId);

