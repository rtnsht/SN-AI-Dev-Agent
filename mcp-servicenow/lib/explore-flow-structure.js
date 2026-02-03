#!/usr/bin/env node
/**
 * Explore Flow Designer structure to understand how to create flows via API
 */
import * as dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json' };

async function get(table, query, fields) {
    const resp = await axios.get(`${instanceUrl}/api/now/table/${table}`, {
        auth, headers,
        params: { 
            sysparm_query: query,
            sysparm_fields: fields,
            sysparm_limit: 100
        }
    });
    return resp.data.result;
}

async function explore() {
    const flowSysId = process.argv[2];
    
    if (!flowSysId) {
        // List available flows
        console.log('Usage: node explore-flow-structure.js <flow_sys_id>\n');
        console.log('Available flows:\n');
        const flows = await get('sys_hub_flow', 'active=true', 'sys_id,name,internal_name');
        flows.slice(0, 20).forEach(f => {
            console.log(`  ${f.sys_id} - ${f.name}`);
        });
        return;
    }
    
    console.log(`\n=== Exploring Flow: ${flowSysId} ===\n`);
    
    // Get flow details
    const flow = await get('sys_hub_flow', `sys_id=${flowSysId}`, '');
    console.log('FLOW (sys_hub_flow):');
    console.log(JSON.stringify(flow[0], null, 2));
    
    // Get trigger
    console.log('\n\nTRIGGER (sys_hub_trigger_instance):');
    const triggers = await get('sys_hub_trigger_instance', `flow=${flowSysId}`, '');
    console.log(JSON.stringify(triggers, null, 2));
    
    // Get actions
    console.log('\n\nACTIONS (sys_hub_action_instance):');
    const actions = await get('sys_hub_action_instance', `flow=${flowSysId}`, '');
    console.log(JSON.stringify(actions, null, 2));
    
    // Get action inputs for first action
    if (actions.length > 0) {
        console.log('\n\nACTION INPUTS (sys_hub_action_input) for first action:');
        const inputs = await get('sys_hub_action_input', `action_instance=${actions[0].sys_id}`, '');
        console.log(JSON.stringify(inputs, null, 2));
    }
    
    // Save to file for analysis
    const output = {
        flow: flow[0],
        triggers,
        actions,
    };
    
    fs.writeFileSync(path.join(__dirname, 'flow-structure-export.json'), JSON.stringify(output, null, 2));
    console.log('\n\nSaved to lib/flow-structure-export.json');
}

explore().catch(e => console.error(e.response?.data || e.message));

