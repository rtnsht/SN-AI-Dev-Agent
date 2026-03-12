#!/usr/bin/env node
import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.SN_INSTANCE_URL;
const auth = {username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD};

const ourFlowId = '10e9df1614eb49e4af21206dc719ab35';
const workingFlowId = 'a7b82d60fff832104aebffffffffff23';

async function compare() {
    // Our flow
    const ourFlow = await axios.get(url + '/api/now/table/sys_hub_flow/' + ourFlowId, {auth});
    console.log('=== OUR FLOW ===');
    console.log('name:', ourFlow.data.result.name);
    console.log('status:', ourFlow.data.result.status);
    console.log('latest_snapshot:', ourFlow.data.result.latest_snapshot || 'NONE');
    console.log('master_snapshot:', ourFlow.data.result.master_snapshot || 'NONE');
    console.log('generation_source:', ourFlow.data.result.generation_source);

    // Working flow
    const workFlow = await axios.get(url + '/api/now/table/sys_hub_flow/' + workingFlowId, {auth});
    console.log('\n=== WORKING FLOW ===');
    console.log('name:', workFlow.data.result.name);
    console.log('status:', workFlow.data.result.status);
    console.log('latest_snapshot:', workFlow.data.result.latest_snapshot || 'NONE');
    console.log('master_snapshot:', workFlow.data.result.master_snapshot || 'NONE');
    console.log('generation_source:', workFlow.data.result.generation_source);

    // Check if Flow Designer renders our flow differently - try to activate
    console.log('\n=== Attempting to compile our flow ===');
    try {
        // Try using the Flow Designer compile API
        const compileResult = await axios.post(
            url + '/api/sn_flow_designer/flows/' + ourFlowId + '/compile',
            {},
            { auth, headers: { 'Content-Type': 'application/json' } }
        );
        console.log('Compile result:', compileResult.data);
    } catch (e) {
        console.log('Compile API error:', e.response?.status, e.response?.data?.error?.message || e.message);
    }
}

compare().catch(e => console.log('Error:', e.response?.data || e.message));

