/**
 * Get action type details from ServiceNow
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json' };

async function getActionTypes() {
  const typeIds = [
    'af51fd0e73141300612c273ffff6a785',  // Used in action instances
    '5bc1bcc6531003003bf1d9109ec587d4',  // Used in action instances
    'f597c41073081300612c273ffff6a767',  // Create Catalog Task
    '5b7b05e0871903005d90bba826cb0ba4',  // Create Catalog Task on Request Item
  ];
  
  for (const typeId of typeIds) {
    console.log(`\n--- Looking up: ${typeId} ---`);
    
    // Try sys_hub_action_type_base first
    try {
      const resp = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_type_base/${typeId}`, {
        auth, headers
      });
      const r = resp.data.result;
      console.log('Name:', r.name);
      console.log('Label:', r.label);
      console.log('Internal Name:', r.internal_name);
      console.log('Class:', r.sys_class_name);
    } catch (e) {
      console.log('Not found in sys_hub_action_type_base, trying query...');
      
      // Try query approach
      try {
        const resp2 = await axios.get(`${instanceUrl}/api/now/table/sys_hub_action_type_base`, {
          auth, headers,
          params: {
            sysparm_query: `sys_id=${typeId}`,
            sysparm_limit: 1
          }
        });
        if (resp2.data.result.length > 0) {
          const r = resp2.data.result[0];
          console.log('Name:', r.name);
          console.log('Label:', r.label);
          console.log('Internal Name:', r.internal_name);
        } else {
          console.log('Not found');
        }
      } catch (e2) {
        console.log('Error:', e2.response?.data?.error?.message || e2.message);
      }
    }
  }
}

getActionTypes().catch(e => {
  console.error('Error:', e.response?.data || e.message);
  process.exit(1);
});

