/**
 * Analyze a working Flow Designer flow to understand its complete structure
 */

import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json' };

async function analyze(flowSysId) {
  const result = { flow: null, trigger: null, actions: [], stages: [], inputs: [], outputs: [] };
  
  console.log(`=== Analyzing Flow: ${flowSysId} ===\n`);
  
  // 1. Get the flow record
  const flowResp = await axios.get(`${instanceUrl}/api/now/table/sys_hub_flow/${flowSysId}`, {
    auth, headers
  });
  result.flow = flowResp.data.result;
  console.log('Flow:', result.flow.name);
  console.log('Status:', result.flow.status);
  console.log('Latest Snapshot:', result.flow.latest_snapshot);
  console.log('Master Snapshot:', result.flow.master_snapshot);
  
  // 2. Get trigger
  const triggerResp = await axios.get(`${instanceUrl}/api/now/table/sys_hub_trigger_instance`, {
    auth, headers,
    params: { 
      sysparm_query: `flow=${flowSysId}`,
      sysparm_limit: 5
    }
  });
  result.trigger = triggerResp.data.result;
  console.log('\nTrigger(s):', result.trigger.length);
  result.trigger.forEach(t => {
    console.log(`  - ${t.name} | type: ${t.trigger_type} | def: ${t.trigger_definition?.value || t.trigger_definition}`);
  });
  
  // 3. Get action instances
  const actionsResp = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_instance`, {
    auth, headers,
    params: { 
      sysparm_query: `flow=${flowSysId}^ORDERBYorder`,
      sysparm_limit: 50
    }
  });
  result.actions = actionsResp.data.result;
  console.log('\nAction Instances:', result.actions.length);
  result.actions.forEach(a => {
    console.log(`  - Order ${a.order} | ${a.name || a.sys_id} | type: ${a.action_type?.value || a.action_type} | ui_id: ${a.ui_id}`);
  });
  
  // 4. Get flow stages
  const stagesResp = await axios.get(`${instanceUrl}/api/now/table/sys_hub_flow_stage`, {
    auth, headers,
    params: { 
      sysparm_query: `flow=${flowSysId}`,
      sysparm_limit: 20
    }
  });
  result.stages = stagesResp.data.result;
  console.log('\nFlow Stages:', result.stages.length);
  result.stages.forEach(s => {
    console.log(`  - ${s.label || s.name} | order: ${s.order}`);
  });
  
  // 5. Get flow inputs (variables)
  const inputsResp = await axios.get(`${instanceUrl}/api/now/table/sys_hub_flow_input`, {
    auth, headers,
    params: { 
      sysparm_query: `model=${flowSysId}`,
      sysparm_limit: 20
    }
  });
  result.inputs = inputsResp.data.result;
  console.log('\nFlow Inputs:', result.inputs.length);
  
  // 6. Get flow outputs
  const outputsResp = await axios.get(`${instanceUrl}/api/now/table/sys_hub_flow_output`, {
    auth, headers,
    params: { 
      sysparm_query: `model=${flowSysId}`,
      sysparm_limit: 20
    }
  });
  result.outputs = outputsResp.data.result;
  console.log('Flow Outputs:', result.outputs.length);
  
  // 7. Get snapshots if they exist
  if (result.flow.latest_snapshot) {
    console.log('\n--- Checking Snapshot ---');
    try {
      const snapResp = await axios.get(`${instanceUrl}/api/now/table/sys_hub_flow_snapshot/${result.flow.latest_snapshot}`, {
        auth, headers
      });
      console.log('Snapshot found:', snapResp.data.result?.name || 'unnamed');
    } catch (e) {
      console.log('Snapshot not accessible or not in sys_hub_flow_snapshot table');
    }
  }
  
  // Save complete analysis
  fs.writeFileSync('lib/flow-analysis.json', JSON.stringify(result, null, 2));
  console.log('\n\nFull analysis saved to lib/flow-analysis.json');
}

// Use the Service Catalog item request flow
const flowSysId = process.argv[2] || '30f3d26187e92300e0ef0cf888cb0b91';
analyze(flowSysId).catch(e => {
  console.error('Error:', e.response?.data || e.message);
  process.exit(1);
});

