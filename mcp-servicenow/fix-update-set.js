#!/usr/bin/env node
/**
 * Add existing artifacts to the update set
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

async function updateRecord(table, sysId, data) {
  const response = await axios.patch(`${instanceUrl}/api/now/table/${table}/${sysId}`, data, { auth, headers });
  return response.data.result;
}

async function main() {
  console.log('━━━ Adding Artifacts to Update Set ━━━\n');

  // Find our script includes
  const scriptIncludes = await query('sys_script_include', {
    sysparm_query: 'nameINIncidentPatternAnalyzer,SkillBasedAssignment,AutoRemediationOrchestrator',
    sysparm_fields: 'sys_id,name,sys_update_name'
  });

  // Find our business rule
  const businessRules = await query('sys_script', {
    sysparm_query: 'name=Incident Assignment Orchestrator',
    sysparm_fields: 'sys_id,name,sys_update_name'
  });

  const artifacts = [...scriptIncludes, ...businessRules];
  
  console.log('Found artifacts:');
  for (const a of artifacts) {
    console.log(`  - ${a.name}`);
  }

  // Touch each record to add it to the current update set
  // We do this by updating a field (like description or order) with a minor change
  console.log('\nRe-saving to capture in update set...\n');

  for (const si of scriptIncludes) {
    try {
      await updateRecord('sys_script_include', si.sys_id, {
        description: (await query('sys_script_include/' + si.sys_id, {})).description + ' '
      });
      console.log(`✅ ${si.name} - resaved`);
    } catch (e) {
      // Try alternative approach - just touch the active field
      await updateRecord('sys_script_include', si.sys_id, { active: true });
      console.log(`✅ ${si.name} - touched`);
    }
  }

  for (const br of businessRules) {
    try {
      await updateRecord('sys_script', br.sys_id, { active: true });
      console.log(`✅ ${br.name} - touched`);
    } catch (e) {
      console.log(`❌ ${br.name}: ${e.message}`);
    }
  }

  // Check update set now
  console.log('\n━━━ Checking Update Set Contents ━━━\n');
  
  const updates = await query('sys_update_xml', {
    sysparm_query: 'update_set=' + UPDATE_SET_ID,
    sysparm_fields: 'name,type,target_name',
    sysparm_limit: 20
  });
  
  console.log(`Records in Update Set: ${updates.length}`);
  for (const u of updates) {
    console.log(`  - ${u.type}: ${u.target_name || u.name}`);
  }
}

main().catch(err => {
  console.error('Error:', err.response?.data || err.message);
});

