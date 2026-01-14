/**
 * Setup a Scripted REST API endpoint to set current update set
 * This replicates what the "Make This My Current Set" UI Action does
 */
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

async function setupUpdateSetAPI() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Setting up UpdateSet Helper API');
    console.log('═══════════════════════════════════════════════════════\n');

    // Check if API already exists
    const existing = await axios.get(
        `${instanceUrl}/api/now/table/sys_ws_definition?sysparm_query=name=UpdateSetHelper&sysparm_fields=sys_id`,
        { auth, headers }
    );

    let apiId;
    if (existing.data.result.length > 0) {
        apiId = existing.data.result[0].sys_id;
        console.log('✅ API already exists: UpdateSetHelper');
    } else {
        // Create Scripted REST API Definition
        console.log('📦 Creating Scripted REST API: UpdateSetHelper...');
        const apiDef = await axios.post(
            `${instanceUrl}/api/now/table/sys_ws_definition`,
            {
                name: 'UpdateSetHelper',
                service_id: 'update_set_helper',
                active: true,
                short_description: 'Helper API to set current update set programmatically'
            },
            { auth, headers }
        );
        apiId = apiDef.data.result.sys_id;
        console.log('   ✅ Created API Definition');
    }

    // Check if resource already exists
    const existingResource = await axios.get(
        `${instanceUrl}/api/now/table/sys_ws_operation?sysparm_query=web_service_definition=${apiId}^name=setCurrentUpdateSet&sysparm_fields=sys_id`,
        { auth, headers }
    );

    if (existingResource.data.result.length > 0) {
        console.log('✅ Resource already exists: setCurrentUpdateSet');
    } else {
        // Create the resource/operation
        console.log('📦 Creating Resource: setCurrentUpdateSet...');
        const script = `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var updateSetId = request.queryParams.sys_id || request.body.data.sys_id;
    
    if (!updateSetId) {
        response.setStatus(400);
        return { error: 'sys_id parameter required' };
    }
    
    // Verify update set exists and is in progress
    var gr = new GlideRecord('sys_update_set');
    if (!gr.get(updateSetId)) {
        response.setStatus(404);
        return { error: 'Update set not found' };
    }
    
    if (gr.state != 'in progress') {
        response.setStatus(400);
        return { error: 'Update set must be in progress state' };
    }
    
    // Set as current update set (same as "Make This My Current Set" button)
    var us = new GlideUpdateSet();
    us.set(updateSetId);
    
    return {
        success: true,
        message: 'Update set set as current',
        update_set: {
            sys_id: gr.sys_id.toString(),
            name: gr.name.toString()
        }
    };
})(request, response);`;

        await axios.post(
            `${instanceUrl}/api/now/table/sys_ws_operation`,
            {
                web_service_definition: apiId,
                name: 'setCurrentUpdateSet',
                http_method: 'POST',
                relative_path: '/set_current',
                active: true,
                operation_script: script,
                short_description: 'Set the current update set for artifact capture'
            },
            { auth, headers }
        );
        console.log('   ✅ Created Resource');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ UpdateSetHelper API Ready');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Endpoint: POST ${instanceUrl}/api/x_snc_update_set_h/update_set_helper/set_current`);
    console.log('Body: { "sys_id": "<update_set_sys_id>" }');
}

setupUpdateSetAPI().catch(e => console.error('Error:', e.response?.data || e.message));

