/**
 * Get existing flow update set XML to understand the structure
 */
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json' };

async function getFlowExport() {
  console.log('=== Looking for existing flow update XML records ===\n');
  
  // Get update set records that contain flow definitions
  const resp = await axios.get(`${instanceUrl}/api/now/table/sys_update_xml`, {
    auth, headers,
    params: {
      sysparm_query: 'nameLIKEsys_hub_flow^type=INSERT_OR_UPDATE',
      sysparm_fields: 'sys_id,name,type,target_name,payload,update_set',
      sysparm_limit: 5
    }
  });
  
  console.log('Found', resp.data.result.length, 'flow update XML records\n');
  
  for (const r of resp.data.result) {
    console.log('Name:', r.name);
    console.log('Target:', r.target_name);
    console.log('Type:', r.type);
    console.log('Update Set:', r.update_set);
    console.log('---');
    
    if (r.payload) {
      console.log('Payload preview:');
      console.log(r.payload.substring(0, 1500));
      console.log('\n=== END PREVIEW ===\n');
      
      // Save full payload for analysis
      fs.writeFileSync(`lib/flow-export-${r.sys_id}.xml`, r.payload);
      console.log(`Full payload saved to lib/flow-export-${r.sys_id}.xml\n`);
    }
  }
  
  // Now let's try to find update sets that have flow-related records
  console.log('\n=== Looking for update sets with flow records ===\n');
  
  const updateSets = await axios.get(`${instanceUrl}/api/now/table/sys_update_set`, {
    auth, headers,
    params: {
      sysparm_query: 'nameLIKEflow^ORdescriptionLIKEflow^state=complete^ORDERBYDESCsys_created_on',
      sysparm_fields: 'sys_id,name,state,description',
      sysparm_limit: 5
    }
  });
  
  console.log('Found', updateSets.data.result.length, 'update sets with "flow" in name/desc\n');
  updateSets.data.result.forEach(us => {
    console.log('-', us.name, '(', us.state, ')');
  });
  
  // Try to export a real flow using the Export processor
  console.log('\n=== Attempting to export a flow via XML export ===\n');
  
  // Find the "Service Catalog item request" flow
  const flowResp = await axios.get(`${instanceUrl}/api/now/table/sys_hub_flow`, {
    auth, headers,
    params: {
      sysparm_query: 'nameSTARTSWITHService Catalog',
      sysparm_fields: 'sys_id,name,internal_name',
      sysparm_limit: 3
    }
  });
  
  console.log('Found flows:');
  flowResp.data.result.forEach(f => {
    console.log('  -', f.name, '|', f.sys_id);
  });
  
  if (flowResp.data.result.length > 0) {
    const flowId = flowResp.data.result[0].sys_id;
    console.log(`\nTrying to get XML export for flow: ${flowId}`);
    
    // Try the unload endpoint
    try {
      const unloadResp = await axios.get(`${instanceUrl}/sys_hub_flow.do`, {
        auth,
        headers: { 'Accept': 'application/xml' },
        params: {
          XML: '',
          sys_id: flowId
        }
      });
      fs.writeFileSync('lib/flow-xml-export.xml', unloadResp.data);
      console.log('Flow XML saved to lib/flow-xml-export.xml');
      console.log('Preview:', unloadResp.data.substring(0, 1000));
    } catch (e) {
      console.log('Direct XML export failed:', e.response?.status, e.message);
    }
  }
}

getFlowExport().catch(e => {
  console.error('Error:', e.response?.data || e.message);
});

