#!/usr/bin/env node
/**
 * Attempt to activate a flow via GlideScript executed on the instance
 */
import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.SN_INSTANCE_URL;
const auth = {username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD};

const flowId = process.argv[2] || '10e9df1614eb49e4af21206dc719ab35';

// GlideScript to compile and activate the flow
const script = `
var flowId = '${flowId}';
var result = {};

// Get the flow
var flow = new GlideRecord('sys_hub_flow');
if (flow.get(flowId)) {
    result.name = flow.getValue('name');
    result.status_before = flow.getValue('status');
    
    // Try to compile using Hub internal API
    try {
        // Use sn_hub API to compile
        var api = new sn_hub.FlowAPI();
        api.compileFlow(flowId);
        result.compiled = true;
    } catch(e) {
        result.compile_error = e.toString();
    }
    
    // Re-check status
    flow.get(flowId);
    result.status_after = flow.getValue('status');
    result.latest_snapshot = flow.getValue('latest_snapshot');
}

JSON.stringify(result);
`;

async function runScript() {
    console.log('Attempting to compile flow:', flowId);
    
    // Try executing via REST Script Include execution
    // This requires specific plugin/configuration
    try {
        const response = await axios.post(
            url + '/api/now/v1/scripted_rest/background_script',
            { script },
            { auth, headers: { 'Content-Type': 'application/json' } }
        );
        console.log('Result:', response.data);
    } catch (e) {
        console.log('Background script API not available:', e.response?.status);
    }

    // Alternative: Try updating the flow status directly
    console.log('\nTrying direct status update...');
    try {
        const response = await axios.patch(
            url + '/api/now/table/sys_hub_flow/' + flowId,
            { status: 'published', active: 'true' },
            { auth, headers: { 'Content-Type': 'application/json' } }
        );
        console.log('Update result:', response.data.result.status);
    } catch (e) {
        console.log('Update error:', e.response?.data?.error?.message || e.message);
    }

    // Check final state
    const flow = await axios.get(url + '/api/now/table/sys_hub_flow/' + flowId, { auth });
    console.log('\nFinal flow state:');
    console.log('  status:', flow.data.result.status);
    console.log('  latest_snapshot:', flow.data.result.latest_snapshot || 'NONE');
}

runScript().catch(e => console.error('Error:', e.message));

