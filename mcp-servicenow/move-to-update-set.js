#!/usr/bin/env node
/**
 * Move artifacts from Default to REQ-001 update set
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

const TARGET_UPDATE_SET_ID = '42715563939232102f57f0ba2bba10eb';  // REQ-001

async function query(table, params = {}) {
    const response = await axios.get(`${instanceUrl}/api/now/table/${table}`, { params, auth, headers });
    return response.data.result;
}

async function updateRecord(table, sysId, data) {
    const response = await axios.patch(`${instanceUrl}/api/now/table/${table}/${sysId}`, data, { auth, headers });
    return response.data.result;
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Moving Artifacts to REQ-001 Update Set                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Find update XML records for our artifacts
    const updateNames = [
        'sys_script_include_8d225da3939232102f57f0ba2bba10f9',  // IncidentPatternAnalyzer
        'sys_script_include_1d2295e3939232102f57f0ba2bba102d',  // SkillBasedAssignment
        'sys_script_include_592295e3939232102f57f0ba2bba10be',  // AutoRemediationOrchestrator
        'sys_script_692295e3939232102f57f0ba2bba10c6'           // Business Rule
    ];

    const artifactNames = [
        'IncidentPatternAnalyzer',
        'SkillBasedAssignment',
        'AutoRemediationOrchestrator',
        'Incident Assignment Orchestrator'
    ];

    console.log('━━━ Moving update XML records ━━━\n');

    for (let i = 0; i < updateNames.length; i++) {
        const updates = await query('sys_update_xml', {
            sysparm_query: 'name=' + updateNames[i],
            sysparm_fields: 'sys_id,name,update_set',
            sysparm_display_value: 'all'
        });

        for (const u of updates) {
            if (u.update_set.value !== TARGET_UPDATE_SET_ID) {
                try {
                    await updateRecord('sys_update_xml', u.sys_id.value || u.sys_id, {
                        update_set: TARGET_UPDATE_SET_ID
                    });
                    console.log(`✅ Moved: ${artifactNames[i]}`);
                    console.log(`   From: ${u.update_set.display_value} → REQ-001 Update Set`);
                } catch (err) {
                    console.log(`❌ Failed to move ${artifactNames[i]}: ${err.response?.data?.error?.message || err.message}`);
                }
            } else {
                console.log(`✓ Already in target: ${artifactNames[i]}`);
            }
        }
    }

    // Verify
    console.log('\n━━━ Verifying Update Set Contents ━━━\n');
    
    const updates = await query('sys_update_xml', {
        sysparm_query: 'update_set=' + TARGET_UPDATE_SET_ID,
        sysparm_fields: 'name,type,target_name',
        sysparm_display_value: 'all',
        sysparm_limit: 20
    });
    
    console.log(`Records in REQ-001 Update Set: ${updates.length}`);
    for (const u of updates) {
        const targetName = typeof u.target_name === 'object' ? u.target_name.display_value : u.target_name;
        console.log(`  ✅ ${targetName || u.name}`);
    }

    if (updates.length > 0) {
        console.log('\n🎉 Success! Artifacts are now in the REQ-001 Update Set.');
        console.log(`\nView Update Set: ${instanceUrl}/sys_update_set.do?sys_id=${TARGET_UPDATE_SET_ID}`);
    }
}

main().catch(err => {
    console.error('Error:', err.response?.data || err.message);
});

