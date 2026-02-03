/**
 * Export a complete flow with all related records (trigger, actions, stages)
 */
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };

// Flow: "Service Catalog item request" - 30f3d26187e92300e0ef0cf888cb0b91
const FLOW_ID = '30f3d26187e92300e0ef0cf888cb0b91';

async function getXml(table, sysId) {
  const resp = await axios.get(`${instanceUrl}/${table}.do`, {
    auth,
    headers: { 'Accept': 'application/xml' },
    params: { XML: '', sys_id: sysId }
  });
  return resp.data;
}

async function getRecords(table, query, fields) {
  const resp = await axios.get(`${instanceUrl}/api/now/table/${table}`, {
    auth,
    headers: { 'Accept': 'application/json' },
    params: {
      sysparm_query: query,
      sysparm_fields: fields,
      sysparm_limit: 50
    }
  });
  return resp.data.result;
}

async function exportFlow() {
  console.log('=== Exporting complete flow structure ===\n');
  
  // 1. Get flow record
  console.log('1. Exporting flow record...');
  const flowXml = await getXml('sys_hub_flow', FLOW_ID);
  
  // 2. Get trigger instance
  console.log('2. Exporting trigger instance...');
  const triggers = await getRecords('sys_hub_trigger_instance', `flow=${FLOW_ID}`, 'sys_id,name,flow,trigger_definition,trigger_type');
  console.log(`   Found ${triggers.length} trigger(s)`);
  
  let triggerXml = '';
  for (const t of triggers) {
    const xml = await getXml('sys_hub_trigger_instance', t.sys_id);
    triggerXml += xml.replace(/^<\?xml[^?]*\?>\n?/, '').replace(/<\/?xml>\n?/g, '');
    console.log(`   - ${t.name} (${t.sys_id})`);
  }
  
  // 3. Get action instances
  console.log('3. Exporting action instances...');
  const actions = await getRecords('sys_hub_action_instance', `flow=${FLOW_ID}`, 'sys_id,name,action_type,order');
  console.log(`   Found ${actions.length} action(s)`);
  
  let actionsXml = '';
  for (const a of actions) {
    const xml = await getXml('sys_hub_action_instance', a.sys_id);
    actionsXml += xml.replace(/^<\?xml[^?]*\?>\n?/, '').replace(/<\/?xml>\n?/g, '');
    console.log(`   - ${a.name} (order: ${a.order})`);
  }
  
  // 4. Get flow stages
  console.log('4. Exporting flow stages...');
  const stages = await getRecords('sys_hub_flow_stage', `flow=${FLOW_ID}`, 'sys_id,name,order');
  console.log(`   Found ${stages.length} stage(s)`);
  
  let stagesXml = '';
  for (const s of stages) {
    const xml = await getXml('sys_hub_flow_stage', s.sys_id);
    stagesXml += xml.replace(/^<\?xml[^?]*\?>\n?/, '').replace(/<\/?xml>\n?/g, '');
  }
  
  // 5. Get flow inputs
  console.log('5. Exporting flow inputs...');
  const inputs = await getRecords('sys_hub_flow_input', `flow=${FLOW_ID}`, 'sys_id,name,type');
  console.log(`   Found ${inputs.length} input(s)`);
  
  let inputsXml = '';
  for (const i of inputs) {
    const xml = await getXml('sys_hub_flow_input', i.sys_id);
    inputsXml += xml.replace(/^<\?xml[^?]*\?>\n?/, '').replace(/<\/?xml>\n?/g, '');
  }
  
  // Combine into a single update set format
  const completeXml = `<?xml version="1.0" encoding="UTF-8"?>
<unload unload_date="${new Date().toISOString()}">
<!-- Flow Definition -->
${flowXml.replace(/^<\?xml[^?]*\?>\n?/, '').replace(/<\/?xml>\n?/g, '')}

<!-- Trigger Instance -->
${triggerXml}

<!-- Action Instances -->
${actionsXml}

<!-- Flow Stages -->
${stagesXml}

<!-- Flow Inputs -->
${inputsXml}
</unload>`;

  fs.writeFileSync('lib/complete-flow-export.xml', completeXml);
  console.log('\n✅ Complete flow exported to lib/complete-flow-export.xml');
}

exportFlow().catch(e => {
  console.error('Error:', e.response?.data || e.message);
});

