#!/usr/bin/env node
/**
 * Fix Script v2: Capture artifacts properly (without setWorkflow false)
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

const UPDATE_SET_ID = '42715563939232102f57f0ba2bba10eb';

async function createRecord(table, data) {
    const response = await axios.post(`${instanceUrl}/api/now/table/${table}`, data, { auth, headers });
    return response.data.result;
}

async function query(table, params = {}) {
    const response = await axios.get(`${instanceUrl}/api/now/table/${table}`, { params, auth, headers });
    return response.data.result;
}

async function deleteRecord(table, sysId) {
    await axios.delete(`${instanceUrl}/api/now/table/${table}/${sysId}`, { auth, headers });
}

// Corrected Fix Script - don't disable workflow/autoSysFields
const FIX_SCRIPT_V2 = `
(function() {
    var UPDATE_SET_ID = '${UPDATE_SET_ID}';
    
    // Set the update set as current
    var currentUpdateSet = new GlideUpdateSet();
    currentUpdateSet.set(UPDATE_SET_ID);
    gs.info('Fix Script v2: Update set context set');
    
    var capturedCount = 0;
    
    // Script Includes - use setValue to trigger a real change
    var scriptIncludes = ['IncidentPatternAnalyzer', 'SkillBasedAssignment', 'AutoRemediationOrchestrator'];
    for (var i = 0; i < scriptIncludes.length; i++) {
        var siGr = new GlideRecord('sys_script_include');
        siGr.addQuery('name', scriptIncludes[i]);
        siGr.query();
        if (siGr.next()) {
            // Make a trivial change to force update set capture
            var desc = siGr.getValue('description') || '';
            siGr.setValue('description', desc.trim() + ' ');
            siGr.update();
            gs.info('Fix Script v2: Captured ' + scriptIncludes[i]);
            capturedCount++;
        }
    }
    
    // Business Rule
    var brGr = new GlideRecord('sys_script');
    brGr.addQuery('name', 'Incident Assignment Orchestrator');
    brGr.addQuery('collection', 'incident');
    brGr.query();
    if (brGr.next()) {
        var brDesc = brGr.getValue('comments') || '';
        brGr.setValue('comments', brDesc.trim() + ' ');
        brGr.update();
        gs.info('Fix Script v2: Captured Business Rule');
        capturedCount++;
    }
    
    gs.info('Fix Script v2: Complete. Captured ' + capturedCount + ' artifacts.');
})();
`;

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Fix Script v2: Proper Update Set Capture                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Delete old fix script trigger if exists
    console.log('━━━ Cleaning up old triggers ━━━\n');
    const oldTriggers = await query('sys_trigger', {
        sysparm_query: 'nameSTARTSWITHExecute REQ-001',
        sysparm_fields: 'sys_id,name'
    });
    for (const t of oldTriggers) {
        await deleteRecord('sys_trigger', t.sys_id);
        console.log(`Deleted old trigger: ${t.name}`);
    }

    // Create new trigger with corrected script
    console.log('\n━━━ Creating new scheduled execution ━━━\n');
    
    const trigger = await createRecord('sys_trigger', {
        name: 'Execute REQ-001 Fix Script v2',
        trigger_type: '0', // Run once
        script: FIX_SCRIPT_V2,
        next_action: new Date(Date.now() + 2000).toISOString() // Run in 2 seconds
    });
    console.log(`✅ Created trigger: ${trigger.sys_id}`);
    
    console.log('\nWaiting 15 seconds for execution...\n');
    await new Promise(r => setTimeout(r, 15000));

    // Check logs
    console.log('━━━ Checking System Logs ━━━\n');
    const logs = await query('syslog', {
        sysparm_query: 'messageSTARTSWITHFix Script v2^ORDERBYDESCsys_created_on',
        sysparm_fields: 'sys_created_on,message',
        sysparm_limit: 10
    });
    for (const log of logs) {
        console.log(`  ${log.message}`);
    }

    // Check update set
    console.log('\n━━━ Checking Update Set Contents ━━━\n');
    const updates = await query('sys_update_xml', {
        sysparm_query: 'update_set=' + UPDATE_SET_ID,
        sysparm_fields: 'name,type,target_name',
        sysparm_limit: 20
    });
    
    console.log(`Records in Update Set: ${updates.length}`);
    for (const u of updates) {
        console.log(`  ✅ ${u.target_name || u.name}`);
    }
    
    if (updates.length === 0) {
        console.log('\n⚠️  Still not captured. Checking if records exist in any update set...\n');
        
        // Check where the records ended up
        const siCheck = await query('sys_script_include', {
            sysparm_query: 'name=IncidentPatternAnalyzer',
            sysparm_fields: 'sys_id,name,sys_update_name,sys_package'
        });
        if (siCheck.length > 0) {
            console.log(`IncidentPatternAnalyzer sys_update_name: ${siCheck[0].sys_update_name}`);
        }
    }
}

main().catch(err => {
    console.error('Error:', err.response?.data || err.message);
});

