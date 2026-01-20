#!/usr/bin/env node
/**
 * Test Update Set Flow
 * 1. Create update set (with duplicate name check)
 * 2. Set as current via UpdateSetHelper API (using configured path)
 * 3. Create a test artifact
 * 4. Verify artifact is captured in update set
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ServiceNowClient } from './src/deployer/ServiceNowClient.js';
import { UpdateSetManager } from './src/deployer/UpdateSetManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
    instanceUrl: process.env.SN_INSTANCE_URL,
    username: process.env.SN_USERNAME,
    password: process.env.SN_PASSWORD
};

async function testUpdateSetFlow() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Testing Update Set Artifact Capture Flow');
    console.log('═══════════════════════════════════════════════════════\n');

    const client = new ServiceNowClient(config);
    const updateSetManager = new UpdateSetManager(client);

    try {
        // Step 1: Create Update Set (will check for duplicates)
        const updateSetId = await updateSetManager.create(
            'TEST-UpdateSet-Capture',
            'Testing artifact capture via REST API'
        );

        // Step 2: Set as current
        await updateSetManager.setAsCurrent(updateSetId);

        // Step 3: Create a test script include
        console.log('\n📜 Creating test Script Include...');
        const scriptInclude = await client.createRecord('sys_script_include', {
            name: 'TestCaptureArtifact',
            script: `var TestCaptureArtifact = Class.create();
TestCaptureArtifact.prototype = {
    initialize: function() {},
    testMethod: function() {
        return 'Created at: ${new Date().toISOString()}';
    },
    type: 'TestCaptureArtifact'
};`,
            active: true,
            api_name: 'global.TestCaptureArtifact',
            access: 'public'
        });
        console.log(`   ✅ Created: ${scriptInclude.result.name}`);
        console.log(`   sys_update_name: ${scriptInclude.result.sys_update_name}`);

        // NOTE: NOT using compensation pattern - testing if GlideUpdateSet.set() captures directly
        // await updateSetManager.moveArtifactToUpdateSet(scriptInclude.result.sys_update_name);

        // Step 4: Validate
        const validation = await updateSetManager.validate(updateSetId);

        // Summary
        console.log('\n═══════════════════════════════════════════════════════');
        if (validation.valid) {
            console.log('  ✅ SUCCESS! Artifact captured in update set');
        } else {
            console.log('  ❌ FAILED! No artifacts captured');
        }
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Update Set URL: ${updateSetManager.getUpdateSetUrl(updateSetId)}`);

    } catch (error) {
        console.error('\n❌ Error:', error.response?.data || error.message);
        process.exit(1);
    }
}

testUpdateSetFlow();

