#!/usr/bin/env node
/**
 * Cleanup test artifacts from ServiceNow instance
 */
import dotenv from 'dotenv';
import { ServiceNowClient } from './src/deployer/ServiceNowClient.js';

dotenv.config();

const client = new ServiceNowClient({
    instanceUrl: process.env.SN_INSTANCE_URL,
    username: process.env.SN_USERNAME,
    password: process.env.SN_PASSWORD
});

async function cleanup() {
    console.log('🧹 Cleaning up test artifacts...\n');

    // Delete test script includes
    console.log('📜 Deleting test Script Includes...');
    const scripts = await client.queryRecords('sys_script_include', 'nameLIKETestCaptureArtifact', ['sys_id', 'name']);
    for (const s of scripts.result || []) {
        await client.delete(`/api/now/table/sys_script_include/${s.sys_id}`);
        console.log('   ✅ Deleted: ' + s.name);
    }
    if (!scripts.result?.length) console.log('   (none found)');

    // Delete test update sets
    console.log('\n📦 Deleting test Update Sets...');
    const updateSets = await client.queryRecords('sys_update_set', 'nameLIKETEST-UpdateSet-Capture', ['sys_id', 'name']);
    for (const us of updateSets.result || []) {
        try {
            // First delete associated update entries (sys_update_xml)
            const entries = await client.queryRecords('sys_update_xml', `update_set=${us.sys_id}`, ['sys_id']);
            for (const entry of entries.result || []) {
                await client.delete(`/api/now/table/sys_update_xml/${entry.sys_id}`);
            }
            if (entries.result?.length) {
                console.log(`   🗑️  Deleted ${entries.result.length} update entries from: ${us.name}`);
            }

            // Now delete the update set
            await client.delete(`/api/now/table/sys_update_set/${us.sys_id}`);
            console.log('   ✅ Deleted: ' + us.name);
        } catch (e) {
            console.log(`   ⚠️  Could not delete ${us.name}: ${e.message}`);
        }
    }
    if (!updateSets.result?.length) console.log('   (none found)');

    console.log('\n✅ Cleanup complete!');
}

cleanup().catch(e => console.error('Error:', e.message));

