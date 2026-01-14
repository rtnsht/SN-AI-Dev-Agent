/**
 * Deploy script for INC-SIMPLE-002: Auto-populate Region from Caller Location
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

// Create axios instance with cookie jar to maintain session state
// This is critical for update set tracking across multiple API calls
const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    baseURL: instanceUrl
}));

// Path to implementation files
const IMPL_PATH = path.join(__dirname, '../../../requirements/INC-SIMPLE-002/3-implementation');

const loadScript = (subdir, filename) =>
    fs.readFileSync(path.join(IMPL_PATH, subdir, filename), 'utf8');

// Store the target update set ID for use by moveToUpdateSet
let targetUpdateSetId = null;

/**
 * Move an artifact's update record to the target update set
 * This is needed because REST API creates don't respect the current update set session
 */
async function moveToUpdateSet(sysUpdateName) {
    if (!targetUpdateSetId) return;

    try {
        // Find the update_xml record for this artifact
        const updateXml = await client.get(
            '/api/now/table/sys_update_xml?sysparm_query=name=' + sysUpdateName + '&sysparm_fields=sys_id,update_set',
            { auth, headers }
        );

        if (updateXml.data.result.length > 0) {
            const record = updateXml.data.result[0];
            if (record.update_set !== targetUpdateSetId) {
                // Move to target update set
                await client.patch(
                    '/api/now/table/sys_update_xml/' + record.sys_id,
                    { update_set: targetUpdateSetId },
                    { auth, headers }
                );
            }
        }
    } catch (e) {
        // Silently fail - we'll validate at the end
    }
}

async function createUpdateSet() {
    console.log('\n📦 Creating Update Set...');
    const response = await client.post('/api/now/table/sys_update_set', {
        name: 'INC-SIMPLE-002 Auto-populate Region',
        description: 'Auto-populate Region field from Caller Location',
        state: 'in progress'
    }, { auth, headers });
    console.log(`   ✅ Created: ${response.data.result.name}`);

    // Store for use by moveToUpdateSet
    targetUpdateSetId = response.data.result.sys_id;
    return targetUpdateSetId;
}

async function setCurrentUpdateSet(updateSetId) {
    // Call our UpdateSetHelper API which uses GlideUpdateSet.set()
    // This replicates what "Make This My Current Set" UI Action does
    // See: sys_ui_action.do?sys_id=b2b0a4a90a00069034ac551e77265a21
    console.log('   Calling UpdateSetHelper API (like "Make This My Current Set" button)...');

    try {
        // Call our custom Scripted REST API - uses same session via cookie jar
        const response = await client.post(
            '/api/1852730/update_set_helper/set_current',
            { sys_id: updateSetId },
            { auth, headers }
        );
        console.log(`   ✅ Set as current update set: ${response.data.result.update_set.name}`);
    } catch (e) {
        // Fallback to user preference method if API fails
        console.log('   ⚠️  UpdateSetHelper API call failed, using fallback method...');
        console.log('   Error:', e.response?.data?.error?.message || e.message);
        const userPref = await client.get(
            '/api/now/table/sys_user_preference?sysparm_query=name=sys_update_set^user=' + auth.username,
            { auth, headers }
        );
        if (userPref.data.result.length > 0) {
            await client.patch(
                '/api/now/table/sys_user_preference/' + userPref.data.result[0].sys_id,
                { value: updateSetId }, { auth, headers }
            );
        } else {
            await client.post('/api/now/table/sys_user_preference', {
                name: 'sys_update_set', user: auth.username, value: updateSetId
            }, { auth, headers });
        }
        console.log('   ✅ Set as current update set via user preference');
    }
}

async function deployScriptInclude() {
    console.log('\n📜 Deploying Script Include: RegionLookupUtil...');
    const script = loadScript('script-includes', 'RegionLookupUtil.js');

    // Check if exists
    const existing = await client.get(
        '/api/now/table/sys_script_include?sysparm_query=name=RegionLookupUtil&sysparm_fields=sys_id,sys_update_name',
        { auth, headers }
    );

    const data = {
        name: 'RegionLookupUtil',
        api_name: 'global.RegionLookupUtil',
        script: script,
        client_callable: true,
        access: 'public',
        active: true,
        description: 'INC-SIMPLE-002: Utility for looking up region from user location'
    };

    let sysUpdateName;
    if (existing.data.result.length > 0) {
        sysUpdateName = existing.data.result[0].sys_update_name;
        await client.patch(
            '/api/now/table/sys_script_include/' + existing.data.result[0].sys_id,
            data, { auth, headers }
        );
        console.log('   ✅ Updated existing Script Include');
    } else {
        const resp = await client.post('/api/now/table/sys_script_include', data, { auth, headers });
        sysUpdateName = resp.data.result.sys_update_name;
        console.log('   ✅ Created Script Include');
    }

    // Move the update record to target update set
    await moveToUpdateSet(sysUpdateName);
}

async function deployClientScript() {
    console.log('\n📜 Deploying Client Script: CallerRegionLookup...');
    const script = loadScript('client-scripts', 'CallerRegionLookup.js');

    const existing = await client.get(
        '/api/now/table/sys_script_client?sysparm_query=name=CallerRegionLookup',
        { auth, headers }
    );

    const data = {
        name: 'CallerRegionLookup',
        table: 'incident',
        type: 'onChange',
        field: 'caller_id',
        script: script,
        active: true,
        description: 'INC-SIMPLE-002: Auto-populate region when caller changes'
    };

    if (existing.data.result.length > 0) {
        await client.patch(
            '/api/now/table/sys_script_client/' + existing.data.result[0].sys_id,
            data, { auth, headers }
        );
        console.log('   ✅ Updated existing Client Script');
    } else {
        await client.post('/api/now/table/sys_script_client', data, { auth, headers });
        console.log('   ✅ Created Client Script');
    }
}

async function deployBusinessRule() {
    console.log('\n📜 Deploying Business Rule: BR_AutoPopulateRegion...');
    const script = loadScript('business-rules', 'BR_AutoPopulateRegion.js');

    const existing = await client.get(
        '/api/now/table/sys_script?sysparm_query=name=BR_AutoPopulateRegion',
        { auth, headers }
    );

    const data = {
        name: 'BR_AutoPopulateRegion',
        collection: 'incident',
        when: 'before',
        action_insert: true,
        action_update: false,
        action_delete: false,
        action_query: false,
        filter_condition: 'caller_idISNOTEMPTY^u_regionISEMPTY',
        script: script,
        active: true,
        order: 100
    };

    if (existing.data.result.length > 0) {
        await client.patch(
            '/api/now/table/sys_script/' + existing.data.result[0].sys_id,
            data, { auth, headers }
        );
        console.log('   ✅ Updated existing Business Rule');
    } else {
        await client.post('/api/now/table/sys_script', data, { auth, headers });
        console.log('   ✅ Created Business Rule');
    }
}

async function validateUpdateSet(updateSetId) {
    console.log('\n🔍 Validating Update Set Contents...');
    await new Promise(r => setTimeout(r, 1000)); // Wait for system to process

    const updates = await client.get(
        '/api/now/table/sys_update_xml?sysparm_query=update_set=' + updateSetId + '&sysparm_fields=name,type,action',
        { auth, headers }
    );

    console.log(`   Found ${updates.data.result.length} artifact(s) in update set`);

    if (updates.data.result.length === 0) {
        console.log('   ⚠️  WARNING: No artifacts captured! Artifacts may need manual capture.');
        return false;
    }

    updates.data.result.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.name} [${u.action}]`);
    });

    return updates.data.result.length >= 3; // At least Script Include, Client Script, Business Rule
}

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  INC-SIMPLE-002: Auto-populate Region from Caller');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Instance: ${instanceUrl}`);

    try {
        const updateSetId = await createUpdateSet();
        await setCurrentUpdateSet(updateSetId);
        await deployScriptInclude();
        await deployClientScript();
        await deployBusinessRule();

        const isValid = await validateUpdateSet(updateSetId);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log(isValid ? '  ✅ DEPLOYMENT COMPLETE' : '  ⚠️  DEPLOYMENT COMPLETE (with warnings)');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Update Set: ${instanceUrl}/sys_update_set.do?sys_id=${updateSetId}`);
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.response?.data?.error?.message || error.message);
        process.exit(1);
    }
}

main();

