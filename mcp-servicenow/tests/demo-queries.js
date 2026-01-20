#!/usr/bin/env node
/**
 * Demo: Query ServiceNow Instance
 * Shows various queries that the MCP server can perform
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

async function query(endpoint, params = {}) {
  const response = await axios.get(`${instanceUrl}${endpoint}`, { params, auth, headers });
  return response.data.result;
}

async function runDemo() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       ServiceNow Instance Query Demo                       ║');
  console.log('║       Instance: dev300943.service-now.com                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. Incident Table Schema
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 1. INCIDENT TABLE SCHEMA (Key Fields)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const schema = await query('/api/now/table/sys_dictionary', {
    sysparm_query: 'name=incident^elementISNOTEMPTY^internal_type!=collection',
    sysparm_fields: 'element,column_label,internal_type,mandatory',
    sysparm_limit: 15
  });
  schema.forEach(f => {
    const mandatory = f.mandatory === 'true' ? '⚠️ ' : '  ';
    console.log(`${mandatory}${f.element.padEnd(25)} │ ${(f.column_label || '').padEnd(20)} │ ${f.internal_type}`);
  });

  // 2. Recent Incidents
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎫 2. RECENT INCIDENTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const incidents = await query('/api/now/table/incident', {
    sysparm_query: 'ORDERBYDESCsys_created_on',
    sysparm_fields: 'number,short_description,priority,state,assigned_to',
    sysparm_display_value: 'true',
    sysparm_limit: 5
  });
  if (incidents.length === 0) {
    console.log('   No incidents found. (This is a fresh dev instance)');
  } else {
    incidents.forEach(inc => {
      const priority = ['', '🔴', '🟠', '🟡', '🟢', '⚪'][inc.priority] || '⚪';
      console.log(`${priority} ${inc.number} │ ${(inc.short_description || 'No description').substring(0, 40).padEnd(40)} │ ${inc.state}`);
    });
  }

  // 3. Business Rules on Incident
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚙️  3. BUSINESS RULES ON INCIDENT TABLE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const businessRules = await query('/api/now/table/sys_script', {
    sysparm_query: 'collection=incident^active=true',
    sysparm_fields: 'name,when,order,action_insert,action_update',
    sysparm_limit: 10
  });
  businessRules.forEach(br => {
    const ops = [];
    if (br.action_insert === 'true') ops.push('Insert');
    if (br.action_update === 'true') ops.push('Update');
    console.log(`   ${br.name.substring(0, 35).padEnd(35)} │ ${br.when.padEnd(8)} │ ${ops.join(', ')}`);
  });

  // 4. Script Includes
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 4. SCRIPT INCLUDES (Sample)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const scriptIncludes = await query('/api/now/table/sys_script_include', {
    sysparm_query: 'active=true^client_callable=true',
    sysparm_fields: 'name,api_name,client_callable',
    sysparm_limit: 8
  });
  scriptIncludes.forEach(si => {
    console.log(`   ${si.name.padEnd(35)} │ Client Callable: ✅`);
  });

  // 5. Update Sets
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📤 5. UPDATE SETS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const updateSets = await query('/api/now/table/sys_update_set', {
    sysparm_query: 'ORDERBYDESCsys_created_on',
    sysparm_fields: 'name,state,sys_created_on',
    sysparm_limit: 5
  });
  updateSets.forEach(us => {
    const stateIcon = us.state === 'in progress' ? '🔄' : us.state === 'complete' ? '✅' : '⏸️';
    console.log(`${stateIcon} ${us.name.substring(0, 40).padEnd(40)} │ ${us.state}`);
  });

  // 6. Users
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👥 6. SYSTEM USERS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const users = await query('/api/now/table/sys_user', {
    sysparm_query: 'active=true',
    sysparm_fields: 'user_name,name,email,title',
    sysparm_limit: 5
  });
  users.forEach(u => {
    console.log(`   ${(u.user_name || '').padEnd(15)} │ ${(u.name || '').padEnd(25)} │ ${u.title || ''}`);
  });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Demo Complete! These are the types of queries the      ║');
  console.log('║     MCP server enables me to run directly.                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

runDemo().catch(err => {
  console.error('Error:', err.message);
  if (err.response) console.error('Details:', err.response.data);
});

