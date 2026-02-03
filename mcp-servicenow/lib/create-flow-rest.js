/**
 * Create a Flow Designer flow using REST API
 * Based on analysis of working flows in the instance
 * 
 * Key insight: We need to create the flow in DRAFT status,
 * then let the user activate it via Flow Designer UI to create snapshots
 */
import dotenv from 'dotenv';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

// Action Type IDs (from analysis of working flows)
const ACTION_TYPES = {
  CREATE_CATALOG_TASK: 'af51fd0e73141300612c273ffff6a785', // Snapshot version
  LOG: '5bc1bcc6531003003bf1d9109ec587d4'  // Snapshot version
};

// Trigger Definition ID
const SC_TRIGGER_DEF = 'c43a1011c36813002841b63b12d3ae15';

async function createRecord(table, data) {
  try {
    const resp = await axios.post(`${instanceUrl}/api/now/table/${table}`, data, { auth, headers });
    return { success: true, data: resp.data.result };
  } catch (e) {
    return { success: false, error: e.response?.data?.error?.message || e.message };
  }
}

async function query(table, queryStr, fields) {
  const resp = await axios.get(`${instanceUrl}/api/now/table/${table}`, {
    auth, headers,
    params: {
      sysparm_query: queryStr,
      sysparm_fields: fields,
      sysparm_limit: 1
    }
  });
  return resp.data.result[0];
}

async function createNewHireFlow() {
  console.log('=== Creating New Hire Bundle Orchestration Flow ===\n');
  
  // Check if flow already exists
  const existing = await query('sys_hub_flow', 'name=NewHireBundleOrchestration', 'sys_id,name');
  if (existing) {
    console.log(`⚠️  Flow already exists: ${existing.sys_id}`);
    console.log(`   Delete it first or use a different name.`);
    return;
  }
  
  // 1. Create Flow record (without snapshots - in draft mode)
  console.log('1. Creating flow record...');
  const flowResult = await createRecord('sys_hub_flow', {
    name: 'NewHireBundleOrchestration',
    internal_name: 'global.newhirebundleorchestration',
    description: 'Orchestrates fulfillment tasks for New Hire Equipment Bundle catalog requests. Auto-creates downstream tasks, monitors completion, and closes the request item.',
    type: 'flow',
    active: true,
    status: 'draft',
    access: 'public',
    run_as: 'system',
    sys_scope: 'global'
  });
  
  if (!flowResult.success) {
    console.log(`❌ Failed to create flow: ${flowResult.error}`);
    return;
  }
  
  const flowId = flowResult.data.sys_id;
  console.log(`   ✅ Created flow: ${flowId}`);
  
  // 2. Create Trigger Instance (Service Catalog trigger)
  console.log('2. Creating trigger instance...');
  const triggerId = uuidv4();
  const triggerResult = await createRecord('sys_hub_trigger_instance', {
    name: 'Service Catalog',
    flow: flowId,
    trigger_definition: SC_TRIGGER_DEF,
    trigger_type: 'service_catalog'
  });
  
  if (!triggerResult.success) {
    console.log(`   ⚠️ Trigger creation note: ${triggerResult.error}`);
  } else {
    console.log(`   ✅ Created trigger: ${triggerResult.data.sys_id}`);
  }
  
  // 3. Create a simple action instance (Log action for testing)
  console.log('3. Creating test action instance...');
  const actionResult = await createRecord('sys_hub_action_instance', {
    flow: flowId,
    action_type: ACTION_TYPES.LOG,
    compiled_snapshot: ACTION_TYPES.LOG,
    order: 1,
    ui_id: uuidv4()
  });
  
  if (!actionResult.success) {
    console.log(`   ⚠️ Action creation note: ${actionResult.error}`);
  } else {
    console.log(`   ✅ Created action: ${actionResult.data.sys_id}`);
  }
  
  console.log('\n=== Flow Created in Draft Mode ===\n');
  console.log(`Flow URL: ${instanceUrl}/sys_hub_flow.do?sys_id=${flowId}`);
  console.log(`Flow Designer: ${instanceUrl}/now/nav/ui/classic/params/target/%24flow-designer.do%23%2Fflow/${flowId}`);
  console.log('\n⚠️ IMPORTANT: The flow is in DRAFT status.');
  console.log('   You need to open it in Flow Designer UI and:');
  console.log('   1. Configure the trigger conditions');
  console.log('   2. Add the required actions');
  console.log('   3. Click "Activate" to publish');
  console.log('   This will create the required snapshots for the flow engine.');
}

createNewHireFlow().catch(e => {
  console.error('Error:', e.response?.data || e.message);
});

