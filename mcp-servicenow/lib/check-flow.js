#!/usr/bin/env node
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const flowId = process.argv[2] || '4df1b4f6c3d3321034b6b1f1b4013111';

async function checkFlow() {
    console.log('=== Flow Record ===');
    const flow = await axios.get(`${instanceUrl}/api/now/table/sys_hub_flow/${flowId}`, {
        auth, headers: { 'Accept': 'application/json' }
    });
    const f = flow.data.result;
    console.log('Name:', f.name);
    console.log('Status:', f.status);
    console.log('Latest Snapshot:', f.latest_snapshot || 'NONE');
    console.log('Master Snapshot:', f.master_snapshot || 'NONE');
    console.log('Sys Update Name:', f.sys_update_name || 'NONE');

    console.log('\n=== Trigger ===');
    const triggers = await axios.get(`${instanceUrl}/api/now/table/sys_hub_trigger_instance`, {
        auth, headers: { 'Accept': 'application/json' },
        params: { sysparm_query: 'flow=' + flowId }
    });
    console.log('Triggers found:', triggers.data.result.length);
    if (triggers.data.result.length > 0) {
        const t = triggers.data.result[0];
        console.log('  Name:', t.name);
        console.log('  Trigger Def:', t.trigger_definition);
        console.log('  Trigger Type:', t.trigger_type);
    }

    console.log('\n=== Actions ===');
    const actions = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_instance`, {
        auth, headers: { 'Accept': 'application/json' },
        params: { sysparm_query: 'flow=' + flowId, sysparm_fields: 'sys_id,name,order,action_type,compiled_snapshot' }
    });
    console.log('Actions found:', actions.data.result.length);
    actions.data.result.forEach(a => {
        console.log('  -', a.name, '| order:', a.order, '| snapshot:', a.compiled_snapshot || 'NONE');
    });

    console.log('\n=== Stages ===');
    const stages = await axios.get(`${instanceUrl}/api/now/table/sys_hub_flow_stage`, {
        auth, headers: { 'Accept': 'application/json' },
        params: { sysparm_query: 'flow=' + flowId }
    });
    console.log('Stages found:', stages.data.result.length);
}

checkFlow().catch(e => console.error('Error:', e.response?.data || e.message));

