#!/usr/bin/env node
/**
 * Execute background script to capture artifacts in Update Set
 * Uses the sysauto_script or direct script execution endpoint
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

const UPDATE_SET_ID = '42715563939232102f57f0ba2bba10eb';

async function query(table, params = {}) {
    const response = await axios.get(`${instanceUrl}/api/now/table/${table}`, { params, auth, headers });
    return response.data.result;
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Checking if scheduled trigger executed...                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Wait a bit more and check
    console.log('Waiting 10 seconds for scheduled trigger to execute...\n');
    await new Promise(r => setTimeout(r, 10000));

    // Check system logs
    console.log('━━━ Checking System Logs ━━━\n');
    const logs = await query('syslog', {
        sysparm_query: 'messageSTARTSWITHFix Script^ORDERBYDESCsys_created_on',
        sysparm_fields: 'sys_created_on,level,message',
        sysparm_limit: 10
    });

    if (logs.length > 0) {
        console.log('Fix Script logs found:');
        for (const log of logs) {
            console.log(`  [${log.sys_created_on}] ${log.message}`);
        }
    } else {
        console.log('No Fix Script logs found yet.');
    }

    // Check update set contents
    console.log('\n━━━ Checking Update Set Contents ━━━\n');
    
    const updates = await query('sys_update_xml', {
        sysparm_query: 'update_set=' + UPDATE_SET_ID,
        sysparm_fields: 'name,type,target_name',
        sysparm_limit: 20
    });
    
    console.log(`Records in Update Set: ${updates.length}`);
    
    if (updates.length > 0) {
        for (const u of updates) {
            console.log(`  ✅ ${u.type}: ${u.target_name || u.name}`);
        }
        console.log('\n🎉 Success! Artifacts captured in update set.');
    } else {
        console.log('\n⚠️  Still empty. The fix script needs to be run manually.');
        console.log('\n📋 Please do ONE of the following:\n');
        console.log('Option 1: Run Fix Script');
        console.log(`   Go to: ${instanceUrl}/sys_script_fix.do?sys_id=42e311a7939232102f57f0ba2bba109c`);
        console.log('   Click "Run Fix Script" button\n');
        
        console.log('Option 2: Scripts - Background');
        console.log(`   Go to: ${instanceUrl}/sys.scripts.do`);
        console.log('   Paste and run this script:\n');
        console.log('─'.repeat(50));
        console.log(`
var UPDATE_SET_ID = '${UPDATE_SET_ID}';
var currentUpdateSet = new GlideUpdateSet();
currentUpdateSet.set(UPDATE_SET_ID);

var artifacts = [
    {table: 'sys_script_include', name: 'IncidentPatternAnalyzer'},
    {table: 'sys_script_include', name: 'SkillBasedAssignment'},
    {table: 'sys_script_include', name: 'AutoRemediationOrchestrator'},
    {table: 'sys_script', name: 'Incident Assignment Orchestrator'}
];

for (var i = 0; i < artifacts.length; i++) {
    var gr = new GlideRecord(artifacts[i].table);
    gr.addQuery('name', artifacts[i].name);
    gr.query();
    if (gr.next()) {
        gr.update();
        gs.print('Captured: ' + artifacts[i].name);
    }
}
gs.print('Done! Check update set.');
`);
        console.log('─'.repeat(50));
    }
}

main().catch(err => {
    console.error('Error:', err.response?.data || err.message);
});

