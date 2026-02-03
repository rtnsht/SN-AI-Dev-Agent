/**
 * Check available Flow Designer APIs in ServiceNow
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json' };

async function checkApis() {
  console.log('=== Checking Flow Designer APIs ===\n');
  
  // Check for Flow Designer related REST APIs
  const apiEndpoints = [
    '/api/now/flow_designer',
    '/api/sn_flow_designer',
    '/api/now/flow',
    '/api/sn_hub',
    '/api/now/hub',
  ];
  
  for (const endpoint of apiEndpoints) {
    try {
      const resp = await axios.get(`${instanceUrl}${endpoint}`, {
        auth, headers
      });
      console.log(`✅ ${endpoint} - Available`);
      console.log('   Response:', JSON.stringify(resp.data).substring(0, 200));
    } catch (e) {
      if (e.response?.status === 404) {
        console.log(`❌ ${endpoint} - Not Found`);
      } else if (e.response?.status === 401 || e.response?.status === 403) {
        console.log(`🔒 ${endpoint} - Unauthorized/Forbidden (API may exist)`);
      } else {
        console.log(`⚠️ ${endpoint} - Error: ${e.response?.status || e.message}`);
      }
    }
  }
  
  // Check for sys_script_include related to Flow Designer
  console.log('\n=== Checking Flow Designer Script Includes ===\n');
  const scriptIncludes = await axios.get(`${instanceUrl}/api/now/table/sys_script_include`, {
    auth, headers,
    params: {
      sysparm_query: 'nameLIKEFlowDesigner^ORnameLIKEHubFlow^ORnameLIKEFlowEngine',
      sysparm_fields: 'name,api_name,active',
      sysparm_limit: 10
    }
  });
  
  console.log('Flow-related Script Includes:');
  scriptIncludes.data.result.forEach(si => {
    console.log(`  - ${si.name} (${si.api_name}) - Active: ${si.active}`);
  });

  // Check for REST API definitions
  console.log('\n=== Checking Scripted REST APIs ===\n');
  const restApis = await axios.get(`${instanceUrl}/api/now/table/sys_ws_definition`, {
    auth, headers,
    params: {
      sysparm_query: 'nameLIKEflow^ORnameLIKEhub',
      sysparm_fields: 'name,namespace,service_id,active',
      sysparm_limit: 10
    }
  });
  
  console.log('Flow-related REST APIs:');
  restApis.data.result.forEach(api => {
    console.log(`  - ${api.name} | namespace: ${api.namespace} | Active: ${api.active}`);
  });
}

checkApis().catch(e => {
  console.error('Error:', e.response?.data || e.message);
  process.exit(1);
});

