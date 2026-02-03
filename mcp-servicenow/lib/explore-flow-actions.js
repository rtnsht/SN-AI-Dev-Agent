/**
 * Script to explore Flow Designer action types and understand structure
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json' };

async function explore() {
  // 1. Find script-related action types
  console.log('=== Script-related Action Types ===\n');
  const scriptActions = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_type_definition`, {
    auth, headers,
    params: { 
      sysparm_query: 'nameLIKEscript^ORlabelLIKEscript',
      sysparm_fields: 'sys_id,name,label,internal_name',
      sysparm_limit: 15
    }
  });
  
  scriptActions.data.result.forEach(at => {
    console.log(`  - ${at.label || at.name} | internal: ${at.internal_name} | sys_id: ${at.sys_id}`);
  });

  // 2. Find trigger definitions for Service Catalog
  console.log('\n=== Service Catalog Trigger Definitions ===\n');
  const triggerDefs = await axios.get(`${instanceUrl}/api/now/table/sys_hub_trigger_definition`, {
    auth, headers,
    params: { 
      sysparm_query: 'nameLIKEcatalog^ORlabelLIKEcatalog^ORinternal_nameLIKEcatalog',
      sysparm_fields: 'sys_id,name,label,internal_name',
      sysparm_limit: 10
    }
  });
  
  triggerDefs.data.result.forEach(td => {
    console.log(`  - ${td.label || td.name} | internal: ${td.internal_name} | sys_id: ${td.sys_id}`);
  });

  // 3. Find "Create Catalog Task" action type
  console.log('\n=== Create Task/Record Action Types ===\n');
  const taskActions = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_type_definition`, {
    auth, headers,
    params: { 
      sysparm_query: 'nameLIKEcreate^nameLIKEtask^ORlabelLIKEcreate task^ORlabelLIKEcreate record',
      sysparm_fields: 'sys_id,name,label,internal_name',
      sysparm_limit: 15
    }
  });
  
  taskActions.data.result.forEach(at => {
    console.log(`  - ${at.label || at.name} | internal: ${at.internal_name} | sys_id: ${at.sys_id}`);
  });

  // 4. Look for generic create record action
  console.log('\n=== Generic Create/Update Record Actions ===\n');
  const crudActions = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_type_definition`, {
    auth, headers,
    params: { 
      sysparm_query: 'internal_nameLIKEsn_sc^ORinternal_nameLIKEglobal.create^ORinternal_nameLIKEglobal.update',
      sysparm_fields: 'sys_id,name,label,internal_name',
      sysparm_limit: 20
    }
  });
  
  crudActions.data.result.forEach(at => {
    console.log(`  - ${at.label || at.name} | internal: ${at.internal_name} | sys_id: ${at.sys_id}`);
  });

  // 5. Find all "core" action types used in flows
  console.log('\n=== Core Flow Actions (global namespace) ===\n');
  const coreActions = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_type_definition`, {
    auth, headers,
    params: { 
      sysparm_query: 'internal_nameSTARTSWITHglobal.',
      sysparm_fields: 'sys_id,name,label,internal_name',
      sysparm_limit: 30
    }
  });
  
  coreActions.data.result.forEach(at => {
    console.log(`  - ${at.label || at.name} | ${at.internal_name} | ${at.sys_id}`);
  });
}

explore().catch(e => {
  console.error('Error:', e.response?.data || e.message);
  process.exit(1);
});

