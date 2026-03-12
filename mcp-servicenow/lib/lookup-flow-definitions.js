#!/usr/bin/env node
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };

async function lookupDefinitions() {
    console.log('🔍 Looking up Flow Designer definitions from', instanceUrl);
    console.log('');

    // Look up action type definitions
    console.log('=== Action Type Definitions ===');
    const actions = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_type_definition`, {
        auth,
        headers: { 'Accept': 'application/json' },
        params: { 
            sysparm_query: 'nameLIKElog^ORnameLIKElookup^ORnameLIKEnotification^ORnameLIKErecord^ORnameLIKEemail',
            sysparm_fields: 'sys_id,name,internal_name',
            sysparm_limit: 30
        }
    });
    
    console.log('Found', actions.data.result.length, 'action types:');
    actions.data.result.forEach(a => {
        console.log(`  ${a.sys_id} | ${a.name} | ${a.internal_name || 'N/A'}`);
    });

    // Look up trigger definitions
    console.log('\n=== Trigger Definitions ===');
    const triggers = await axios.get(`${instanceUrl}/api/now/table/sys_hub_trigger_definition`, {
        auth,
        headers: { 'Accept': 'application/json' },
        params: { 
            sysparm_query: 'nameLIKErecord^ORnameLIKEcreated^ORnameLIKEupdated^ORnameLIKEinserted',
            sysparm_fields: 'sys_id,name,internal_name',
            sysparm_limit: 20
        }
    });
    
    console.log('Found', triggers.data.result.length, 'trigger types:');
    triggers.data.result.forEach(t => {
        console.log(`  ${t.sys_id} | ${t.name} | ${t.internal_name || 'N/A'}`);
    });

    // Also look for common actions we need
    console.log('\n=== Specific Actions Needed ===');
    const specific = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_type_definition`, {
        auth,
        headers: { 'Accept': 'application/json' },
        params: { 
            sysparm_query: 'internal_name=log^ORinternal_name=lookup_record^ORinternal_name=send_email^ORinternal_name=send_notification',
            sysparm_fields: 'sys_id,name,internal_name'
        }
    });
    
    console.log('Specific actions for templates:');
    specific.data.result.forEach(a => {
        console.log(`  ${a.internal_name}: ${a.sys_id} (${a.name})`);
    });
}

lookupDefinitions().catch(e => {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
});

