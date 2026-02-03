/**
 * Script to retrieve update set XML payloads for Flow Designer flows
 * This helps understand how ServiceNow captures flows in update sets
 */

import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json' };

async function getFlowUpdateXml(flowSysId) {
  console.log(`=== Searching for Update XML records for flow: ${flowSysId} ===\n`);
  
  // Search for update XML records that reference this flow
  const resp = await axios.get(`${instanceUrl}/api/now/table/sys_update_xml`, {
    auth, headers,
    params: { 
      sysparm_query: `nameLIKE${flowSysId}`,
      sysparm_fields: 'sys_id,name,type,action,payload,sys_created_on',
      sysparm_limit: 10
    }
  });
  
  if (resp.data.result.length > 0) {
    console.log(`Found ${resp.data.result.length} update XML record(s):\n`);
    
    for (const rec of resp.data.result) {
      console.log(`--- Record: ${rec.name} ---`);
      console.log(`Type: ${rec.type}`);
      console.log(`Action: ${rec.action}`);
      console.log(`Created: ${rec.sys_created_on}`);
      console.log(`\nPayload:\n`);
      console.log(rec.payload);
      console.log('\n' + '='.repeat(80) + '\n');
    }
    
    // Save full results to file
    const outputPath = path.join(__dirname, 'flow-updatexml-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(resp.data.result, null, 2));
    console.log(`\nFull results saved to: ${outputPath}`);
  } else {
    console.log('No update XML found for this flow sys_id.');
    console.log('Trying alternative search by flow name...\n');
    
    // Try searching by table name
    const resp2 = await axios.get(`${instanceUrl}/api/now/table/sys_update_xml`, {
      auth, headers,
      params: { 
        sysparm_query: 'nameLIKEsys_hub_flow^ORnameLIKEsys_hub_trigger^ORnameLIKEsys_hub_action',
        sysparm_fields: 'sys_id,name,type,action,sys_created_on',
        sysparm_limit: 20,
        sysparm_orderby: 'sys_created_on',
        sysparm_orderbydesc: 'true'
      }
    });
    
    console.log(`Found ${resp2.data.result.length} flow-related update XML records:`);
    resp2.data.result.forEach(r => {
      console.log(`  - ${r.name} (${r.action})`);
    });
  }
}

// Main execution
const flowSysId = process.argv[2] || '30f3d26187e92300e0ef0cf888cb0b91';
getFlowUpdateXml(flowSysId).catch(e => {
  console.error('Error:', e.response?.data || e.message);
  process.exit(1);
});

