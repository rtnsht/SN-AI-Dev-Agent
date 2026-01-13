#!/usr/bin/env node
/**
 * Check deployment status and system logs
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
  console.log('━━━ Checking Business Rule ━━━\n');
  
  const brs = await query('sys_script', {
    sysparm_query: 'name=Incident Assignment Orchestrator',
    sysparm_fields: 'sys_id,name,active,collection,when,condition,order,script'
  });
  
  if (brs.length === 0) {
    console.log('❌ Business Rule not found!');
    return;
  }
  
  const br = brs[0];
  console.log(`Name:      ${br.name}`);
  console.log(`Active:    ${br.active}`);
  console.log(`Table:     ${br.collection}`);
  console.log(`When:      ${br.when}`);
  console.log(`Order:     ${br.order}`);
  console.log(`Condition: ${br.condition || '(none)'}`);
  console.log(`\nScript preview:\n${br.script.substring(0, 200)}...`);
  
  console.log('\n━━━ Checking Script Includes ━━━\n');
  
  const sis = await query('sys_script_include', {
    sysparm_query: 'nameINIncidentPatternAnalyzer,SkillBasedAssignment,AutoRemediationOrchestrator',
    sysparm_fields: 'sys_id,name,active'
  });
  
  for (const si of sis) {
    console.log(`${si.active === 'true' ? '✅' : '❌'} ${si.name} (active: ${si.active})`);
  }
  
  console.log('\n━━━ Recent System Logs ━━━\n');
  
  const logs = await query('syslog', {
    sysparm_query: 'messageSTARTSWITHIncidentAssignment^ORmessageSTARTSWITHAutoRemediation^ORDERBYDESCsys_created_on',
    sysparm_fields: 'sys_created_on,level,message',
    sysparm_limit: 10
  });
  
  if (logs.length === 0) {
    console.log('No orchestrator logs found (this might be okay if no gs.info calls reached)');
  } else {
    for (const log of logs) {
      console.log(`[${log.sys_created_on}] ${log.level}: ${log.message}`);
    }
  }
  
  console.log('\n━━━ Update Set Contents ━━━\n');
  
  const updateSetId = '42715563939232102f57f0ba2bba10eb';
  const updates = await query('sys_update_xml', {
    sysparm_query: 'update_set=' + updateSetId,
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

