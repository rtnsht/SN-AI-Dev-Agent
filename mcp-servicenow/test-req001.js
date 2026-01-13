#!/usr/bin/env node
/**
 * Test REQ-001: Create test incident and verify the orchestrator works
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

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
  console.log('║  Testing REQ-001: Incident Assignment Orchestrator         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Test 1: Create incident without assignment group
  console.log('━━━ Test 1: Create incident without assignment ━━━\n');
  
  const testIncident = await createRecord('incident', {
    short_description: 'TEST-REQ001: Database timeout on production server',
    description: 'Testing the dynamic assignment orchestrator',
    category: 'software',
    subcategory: 'database',
    impact: '2',
    urgency: '2',
    caller_id: 'admin'
  });
  
  console.log(`Created: ${testIncident.number}`);
  console.log(`Sys ID: ${testIncident.sys_id}\n`);
  
  // Wait a moment for async processing
  await new Promise(r => setTimeout(r, 2000));
  
  // Fetch the incident to see what happened
  const result = await getRecord('incident', testIncident.sys_id);
  
  console.log('━━━ Result ━━━\n');
  console.log(`Number:           ${result.number.display_value}`);
  console.log(`State:            ${result.state.display_value}`);
  console.log(`Assignment Group: ${result.assignment_group.display_value || '(none)'}`);
  console.log(`Assigned To:      ${result.assigned_to.display_value || '(none)'}`);
  console.log(`Problem ID:       ${result.problem_id.display_value || '(none)'}`);
  
  // Check work notes for orchestrator activity
  console.log('\n━━━ Work Notes ━━━\n');
  console.log(result.work_notes.display_value || '(no work notes)');
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test Complete!                                            ║');
  console.log(`║  View in ServiceNow: ${result.number.display_value.padEnd(35)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log(`\nDirect link: ${instanceUrl}/incident.do?sys_id=${testIncident.sys_id}`);
}

main().catch(err => {
  console.error('Test Error:', err.response?.data || err.message);
  process.exit(1);
});

