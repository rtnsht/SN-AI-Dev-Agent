#!/usr/bin/env node
/**
 * Check where our artifacts' updates ended up
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

async function query(table, params = {}) {
    const response = await axios.get(`${instanceUrl}/api/now/table/${table}`, { params, auth, headers });
    return response.data.result;
}

async function main() {
    console.log('━━━ Finding where our artifacts\' updates went ━━━\n');

    // Check update XML for our artifacts
    const updateNames = [
        'sys_script_include_8d225da3939232102f57f0ba2bba10f9',  // IncidentPatternAnalyzer
        'sys_script_include_1d2295e3939232102f57f0ba2bba102d',  // SkillBasedAssignment
        'sys_script_include_592295e3939232102f57f0ba2bba10be',  // AutoRemediationOrchestrator
        'sys_script_692295e3939232102f57f0ba2bba10c6'           // Business Rule
    ];

    for (const name of updateNames) {
        const updates = await query('sys_update_xml', {
            sysparm_query: 'name=' + name,
            sysparm_fields: 'name,update_set,sys_created_on',
            sysparm_display_value: 'all',
            sysparm_limit: 5
        });
        
        if (updates.length > 0) {
            console.log(`${name.split('_').slice(-1)[0].substring(0,8)}...`);
            for (const u of updates) {
                console.log(`  Update Set: ${u.update_set.display_value} (${u.sys_created_on.display_value})`);
            }
        } else {
            console.log(`${name}: No update XML found`);
        }
    }

    // Check recent update sets
    console.log('\n━━━ Recent Update Sets ━━━\n');
    const updateSets = await query('sys_update_set', {
        sysparm_query: 'state=in progress^ORDERBYDESCsys_created_on',
        sysparm_fields: 'sys_id,name,state',
        sysparm_limit: 5
    });
    
    for (const us of updateSets) {
        // Count records in each
        const count = await query('sys_update_xml', {
            sysparm_query: 'update_set=' + us.sys_id,
            sysparm_fields: 'sys_id',
            sysparm_limit: 100
        });
        console.log(`${us.name}: ${count.length} records`);
    }

    // The real issue: check Default update set
    console.log('\n━━━ Checking Default Update Set ━━━\n');
    const defaultUS = await query('sys_update_set', {
        sysparm_query: 'name=Default^state=in progress',
        sysparm_fields: 'sys_id,name'
    });
    
    if (defaultUS.length > 0) {
        const defaultUpdates = await query('sys_update_xml', {
            sysparm_query: 'update_set=' + defaultUS[0].sys_id + '^nameSTARTSWITHsys_script',
            sysparm_fields: 'name,target_name,sys_created_on',
            sysparm_display_value: 'all',
            sysparm_limit: 20
        });
        console.log(`Default update set has ${defaultUpdates.length} script records`);
        for (const u of defaultUpdates) {
            console.log(`  - ${u.target_name || u.name}`);
        }
    }
}

main().catch(err => {
    console.error('Error:', err.response?.data || err.message);
});

