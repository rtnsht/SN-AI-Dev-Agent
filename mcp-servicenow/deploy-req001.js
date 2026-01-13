#!/usr/bin/env node
/**
 * Deploy REQ-001: Dynamic Service-Aware Assignment & Auto-Remediation Orchestrator
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

async function updateRecord(table, sysId, data) {
  const response = await axios.patch(`${instanceUrl}/api/now/table/${table}/${sysId}`, data, { auth, headers });
  return response.data.result;
}

async function query(table, params = {}) {
  const response = await axios.get(`${instanceUrl}/api/now/table/${table}`, { params, auth, headers });
  return response.data.result;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  REQ-001: Dynamic Assignment & Auto-Remediation Engine     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Step 1: Create Update Set
  console.log('━━━ Step 1: Creating Update Set ━━━');
  const updateSet = await createRecord('sys_update_set', {
    name: 'REQ-001 Dynamic Assignment Orchestrator',
    description: 'Dynamic Service-Aware, Skill-Based, Predictive Assignment & Auto-Remediation Orchestrator',
    state: 'in progress'
  });
  console.log(`✅ Created Update Set: ${updateSet.name} (${updateSet.sys_id})\n`);

  // Set as current update set
  const userPref = await query('sys_user_preference', {
    sysparm_query: `user=${auth.username}^name=sys_update_set`,
    sysparm_limit: 1
  });
  if (userPref.length > 0) {
    await updateRecord('sys_user_preference', userPref[0].sys_id, { value: updateSet.sys_id });
  } else {
    await createRecord('sys_user_preference', {
      name: 'sys_update_set',
      value: updateSet.sys_id
    });
  }
  console.log('✅ Set as current update set\n');

  // Store update set ID for other scripts
  console.log(`UPDATE_SET_ID=${updateSet.sys_id}`);
  return updateSet.sys_id;
}

main().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});

