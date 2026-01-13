#!/usr/bin/env node
/**
 * Deploy and execute a Fix Script to capture artifacts in Update Set
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

const UPDATE_SET_ID = '42715563939232102f57f0ba2bba10eb';

const FIX_SCRIPT = `
// Fix Script: Capture REQ-001 artifacts in Update Set
// This script sets the update set context and re-saves each artifact

(function() {
    var UPDATE_SET_ID = '${UPDATE_SET_ID}';
    
    // Set the update set as current for this session
    var currentUpdateSet = new GlideUpdateSet();
    currentUpdateSet.set(UPDATE_SET_ID);
    gs.info('Fix Script: Set update set to ' + UPDATE_SET_ID);
    
    var capturedCount = 0;
    
    // Capture Script Includes
    var scriptIncludes = ['IncidentPatternAnalyzer', 'SkillBasedAssignment', 'AutoRemediationOrchestrator'];
    for (var i = 0; i < scriptIncludes.length; i++) {
        var siGr = new GlideRecord('sys_script_include');
        siGr.addQuery('name', scriptIncludes[i]);
        siGr.query();
        if (siGr.next()) {
            // Touch the record to trigger update set capture
            siGr.setWorkflow(false); // Don't trigger business rules
            siGr.autoSysFields(false); // Don't update sys_updated_on etc
            siGr.update();
            gs.info('Fix Script: Captured ' + scriptIncludes[i]);
            capturedCount++;
        } else {
            gs.warn('Fix Script: Not found - ' + scriptIncludes[i]);
        }
    }
    
    // Capture Business Rule
    var brGr = new GlideRecord('sys_script');
    brGr.addQuery('name', 'Incident Assignment Orchestrator');
    brGr.addQuery('collection', 'incident');
    brGr.query();
    if (brGr.next()) {
        brGr.setWorkflow(false);
        brGr.autoSysFields(false);
        brGr.update();
        gs.info('Fix Script: Captured Business Rule - Incident Assignment Orchestrator');
        capturedCount++;
    }
    
    gs.info('Fix Script: Complete. Captured ' + capturedCount + ' artifacts.');
    return 'Captured ' + capturedCount + ' artifacts in update set';
})();
`;

async function createRecord(table, data) {
    const response = await axios.post(`${instanceUrl}/api/now/table/${table}`, data, { auth, headers });
    return response.data.result;
}

async function query(table, params = {}) {
    const response = await axios.get(`${instanceUrl}/api/now/table/${table}`, { params, auth, headers });
    return response.data.result;
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Fix Script: Capture Artifacts in Update Set              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Step 1: Create the Fix Script
    console.log('━━━ Step 1: Creating Fix Script ━━━\n');
    
    const fixScript = await createRecord('sys_script_fix', {
        name: 'REQ-001 - Capture Artifacts in Update Set',
        description: 'One-time fix script to capture REQ-001 artifacts in the update set',
        script: FIX_SCRIPT,
        active: true
    });
    
    console.log(`✅ Created Fix Script: ${fixScript.sys_id}`);
    console.log(`   View: ${instanceUrl}/sys_script_fix.do?sys_id=${fixScript.sys_id}\n`);

    // Step 2: Execute via Background Script (sys_script_execution)
    console.log('━━━ Step 2: Executing Fix Script ━━━\n');
    console.log('⚠️  Fix Scripts need to be run manually or via scheduled job.');
    console.log('   Please go to the link above and click "Run Fix Script"\n');
    console.log('   OR run this in Scripts - Background:\n');
    console.log('─'.repeat(60));
    console.log(FIX_SCRIPT);
    console.log('─'.repeat(60));
    
    console.log('\n━━━ Alternative: Checking if sys.scripts.execute is available ━━━\n');
    
    // Try to execute via scripted REST or background script table
    try {
        // Use the Script Execution API if available
        const execResponse = await axios.post(
            `${instanceUrl}/api/now/table/sys_trigger`, 
            {
                name: 'Execute REQ-001 Fix Script',
                trigger_type: '0', // Run once
                script: FIX_SCRIPT,
                next_action: new Date().toISOString()
            }, 
            { auth, headers }
        );
        console.log('✅ Scheduled execution via sys_trigger');
        console.log('   Waiting 5 seconds for execution...');
        await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
        console.log('ℹ️  Direct execution not available. Please run manually.');
    }

    // Step 3: Check results
    console.log('\n━━━ Step 3: Checking Update Set Contents ━━━\n');
    
    const updates = await query('sys_update_xml', {
        sysparm_query: 'update_set=' + UPDATE_SET_ID,
        sysparm_fields: 'name,type,target_name',
        sysparm_limit: 20
    });
    
    console.log(`Records in Update Set: ${updates.length}`);
    for (const u of updates) {
        console.log(`  ✅ ${u.type}: ${u.target_name || u.name}`);
    }
    
    if (updates.length === 0) {
        console.log('\n⚠️  Update set still empty. Please run the fix script manually:');
        console.log(`   ${instanceUrl}/sys_script_fix.do?sys_id=${fixScript.sys_id}`);
    }
}

main().catch(err => {
    console.error('Error:', err.response?.data || err.message);
});

