#!/usr/bin/env node
/**
 * Deploy all REQ-001 artifacts to ServiceNow
 */

import * as dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

// Path to implementation files in requirements folder
const IMPL_PATH = path.join(__dirname, '../../../requirements/REQ-001/3-implementation');

async function createRecord(table, data) {
  const response = await axios.post(`${instanceUrl}/api/now/table/${table}`, data, { auth, headers });
  return response.data.result;
}

function readScriptInclude(filename) {
  return fs.readFileSync(path.join(IMPL_PATH, 'script-includes', filename), 'utf8');
}

function readBusinessRule(filename) {
  return fs.readFileSync(path.join(IMPL_PATH, 'business-rules', filename), 'utf8');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Deploying REQ-001 Artifacts to ServiceNow                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Deploy Script Includes
  console.log('━━━ Deploying Script Includes ━━━\n');

  const scriptIncludes = [
    { name: 'IncidentPatternAnalyzer', file: 'IncidentPatternAnalyzer.js', 
      desc: 'Analyzes CI/service, historical incidents, patterns for classification' },
    { name: 'SkillBasedAssignment', file: 'SkillBasedAssignment.js',
      desc: 'Determines optimal assignment using service ownership, skills, on-call' },
    { name: 'AutoRemediationOrchestrator', file: 'AutoRemediationOrchestrator.js',
      desc: 'Handles automation decisions and runbook execution' }
  ];

  for (const si of scriptIncludes) {
    try {
      const script = readScriptInclude(si.file);
      const result = await createRecord('sys_script_include', {
        name: si.name,
        api_name: 'global.' + si.name,
        script: script,
        description: si.desc,
        active: true,
        client_callable: false,
        access: 'public'
      });
      console.log(`✅ ${si.name} (${result.sys_id})`);
    } catch (err) {
      console.log(`❌ ${si.name}: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  // Deploy Business Rule
  console.log('\n━━━ Deploying Business Rule ━━━\n');

  try {
    const brScript = readBusinessRule('BR_IncidentAssignmentOrchestrator.js');
    // Extract just the function body for the BR
    const scriptBody = brScript.replace(/\/\*\*[\s\S]*?\*\/\s*/, '');
    
    const br = await createRecord('sys_script', {
      name: 'Incident Assignment Orchestrator',
      collection: 'incident',
      when: 'before',
      action_insert: true,
      action_update: true,
      action_delete: false,
      action_query: false,
      order: 50,
      condition: 'current.assignment_group.nil()',
      script: scriptBody,
      active: true
    });
    console.log(`✅ Business Rule: Incident Assignment Orchestrator (${br.sys_id})`);
  } catch (err) {
    console.log(`❌ Business Rule: ${err.response?.data?.error?.message || err.message}`);
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Deployment Complete!                                   ║');
  console.log('║  Update Set: REQ-001 Dynamic Assignment Orchestrator       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('Deployment Error:', err.response?.data || err.message);
  process.exit(1);
});

