#!/usr/bin/env node
/**
 * Test REQ-001 v2: Test with a CI that has a support group
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

async function createRecord(table, data) {
  const response = await axios.post(`${instanceUrl}/api/now/table/${table}`, data, { auth, headers });
  return response.data.result;
}

async function getRecord(table, sysId) {
  const response = await axios.get(`${instanceUrl}/api/now/table/${table}/${sysId}`, { 
    auth, headers,
    params: { sysparm_display_value: 'all' }
  });
  return response.data.result;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test v2: Finding a CI with Support Group                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Find a CI that has a support group
  console.log('━━━ Finding CI with Support Group ━━━\n');
  const cis = await query('cmdb_ci', {
    sysparm_query: 'support_groupISNOTEMPTY^active=true',
    sysparm_fields: 'sys_id,name,support_group',
    sysparm_display_value: 'all',
    sysparm_limit: 5
  });

  if (cis.length === 0) {
    console.log('No CIs with support groups found. Let me find any CI...\n');
    
    const anyCi = await query('cmdb_ci', {
      sysparm_query: 'active=true',
      sysparm_fields: 'sys_id,name,support_group',
      sysparm_display_value: 'all',
      sysparm_limit: 1
    });
    
    if (anyCi.length > 0) {
      console.log(`Found CI: ${anyCi[0].name.display_value} (no support group)`);
    }
    
    // Find any assignment group to test with
    const groups = await query('sys_user_group', {
      sysparm_query: 'active=true^type=itil',
      sysparm_fields: 'sys_id,name',
      sysparm_limit: 5
    });
    
    console.log('\nAvailable assignment groups:');
    for (const g of groups) {
      console.log(`  - ${g.name} (${g.sys_id})`);
    }
    return;
  }

  console.log('CIs with support groups:');
  for (const ci of cis) {
    console.log(`  - ${ci.name.display_value} → ${ci.support_group.display_value}`);
  }

  // Use first CI with support group
  const testCi = cis[0];
  console.log(`\n━━━ Creating Test Incident with CI ━━━\n`);
  console.log(`Using CI: ${testCi.name.display_value}`);
  console.log(`Support Group: ${testCi.support_group.display_value}\n`);

  const testIncident = await createRecord('incident', {
    short_description: 'TEST-REQ001-v2: Service timeout on ' + testCi.name.display_value,
    description: 'Testing the dynamic assignment orchestrator with CI',
    cmdb_ci: testCi.sys_id.value,
    impact: '2',
    urgency: '2',
    caller_id: 'admin'
  });

  console.log(`Created: ${testIncident.number}`);
  
  // Wait for processing
  await new Promise(r => setTimeout(r, 2000));
  
  const result = await getRecord('incident', testIncident.sys_id);
  
  console.log('\n━━━ Result ━━━\n');
  console.log(`Number:           ${result.number.display_value}`);
  console.log(`CI:               ${result.cmdb_ci.display_value}`);
  console.log(`Assignment Group: ${result.assignment_group.display_value || '(none)'}`);
  console.log(`Assigned To:      ${result.assigned_to.display_value || '(none)'}`);
  console.log(`Work Notes:       ${result.work_notes.display_value || '(none)'}`);
  
  console.log(`\nDirect link: ${instanceUrl}/incident.do?sys_id=${testIncident.sys_id}`);
}

main().catch(err => {
  console.error('Error:', err.response?.data || err.message);
});

