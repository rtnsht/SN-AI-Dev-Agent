/**
 * Create Flow Designer flow using Background Script
 * This leverages ServiceNow's internal GlideFlow API
 */

import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };

// Background script to create a simple flow
const createFlowScript = `
// Create a new Flow Designer flow programmatically
var flowName = 'NewHireBundleOrchestration';
var flowLabel = 'New Hire Bundle Orchestration';
var flowDescription = 'Orchestrates fulfillment tasks for New Hire Equipment Bundle requests.';

// Check if flow already exists
var existingFlow = new GlideRecord('sys_hub_flow');
existingFlow.addQuery('name', flowName);
existingFlow.query();

if (existingFlow.next()) {
    gs.info('Flow already exists: ' + existingFlow.sys_id);
    // Return existing flow ID
    gs.info('FLOW_SYS_ID:' + existingFlow.sys_id);
} else {
    // Create new flow record
    var flow = new GlideRecord('sys_hub_flow');
    flow.initialize();
    flow.name = flowName;
    flow.description = flowDescription;
    flow.type = 'flow';
    flow.active = true;
    flow.status = 'draft';
    flow.access = 'public';
    flow.run_as = 'system';
    flow.internal_name = 'global.' + flowName.toLowerCase();
    flow.sys_scope = 'global';
    
    var flowId = flow.insert();
    
    if (flowId) {
        gs.info('Created flow: ' + flowId);
        
        // Create Service Catalog trigger
        var trigger = new GlideRecord('sys_hub_trigger_instance');
        trigger.initialize();
        trigger.name = 'Service Catalog';
        trigger.flow = flowId;
        trigger.trigger_type = 'service_catalog';
        trigger.trigger_definition = 'c43a1011c36813002841b63b12d3ae15'; // Service Catalog trigger def
        
        var triggerId = trigger.insert();
        gs.info('Created trigger: ' + triggerId);
        
        // Create sys_flow_cat_variable_model (required for flow)
        var varModel = new GlideRecord('sys_flow_cat_variable_model');
        varModel.initialize();
        varModel.id = flowId;
        varModel.name = flowName;
        varModel.insert();
        gs.info('Created variable model');
        
        gs.info('FLOW_SYS_ID:' + flowId);
    } else {
        gs.error('Failed to create flow');
    }
}
`;

async function executeBackgroundScript(script) {
  console.log('Executing background script to create flow...\n');
  
  // Use the sys.scripts.do endpoint to execute background scripts
  const formData = new URLSearchParams();
  formData.append('script', script);
  formData.append('sysparm_ck', ''); // Will be fetched if needed
  formData.append('runscript', 'Run script');
  formData.append('quota_managed_transaction', 'false');
  
  try {
    // First, get the CSRF token by loading the scripts page
    const loginResp = await axios.get(`${instanceUrl}/sys.scripts.do`, {
      auth,
      headers: { 'Accept': 'text/html' },
      maxRedirects: 5
    });
    
    // Extract ck token from response
    const ckMatch = loginResp.data.match(/var g_ck = '([^']+)'/);
    const ck = ckMatch ? ckMatch[1] : '';
    
    if (ck) {
      formData.set('sysparm_ck', ck);
    }
    
    // Extract cookies
    const cookies = loginResp.headers['set-cookie'];
    const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
    
    // Execute the script
    const resp = await axios.post(`${instanceUrl}/sys.scripts.do`, formData.toString(), {
      auth,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html',
        'Cookie': cookieHeader
      },
      maxRedirects: 0,
      validateStatus: status => status < 400
    });
    
    console.log('Script executed.');
    
    // Look for output in response
    const outputMatch = resp.data.match(/FLOW_SYS_ID:([a-f0-9]{32})/);
    if (outputMatch) {
      console.log('Flow created with sys_id:', outputMatch[1]);
      return outputMatch[1];
    }
    
    // Save response for debugging
    fs.writeFileSync('lib/script-output.html', resp.data);
    console.log('Response saved to lib/script-output.html');
    
  } catch (e) {
    console.error('Error:', e.response?.status, e.response?.data?.substring?.(0, 500) || e.message);
  }
}

executeBackgroundScript(createFlowScript);

