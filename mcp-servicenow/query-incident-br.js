#!/usr/bin/env node
/**
 * Query all Business Rules on Incident table
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json' };

async function query(endpoint, params = {}) {
  const response = await axios.get(`${instanceUrl}${endpoint}`, { params, auth, headers });
  return response.data.result;
}

async function main() {
  console.log('Fetching all Business Rules on Incident table...\n');
  
  const businessRules = await query('/api/now/table/sys_script', {
    sysparm_query: 'collection=incident^ORDERBYorder',
    sysparm_fields: 'sys_id,name,when,order,active,action_insert,action_update,action_delete,action_query,condition,script',
    sysparm_limit: 100
  });
  
  // Output as JSON for analysis
  const output = {
    total: businessRules.length,
    active: businessRules.filter(br => br.active === 'true').length,
    inactive: businessRules.filter(br => br.active !== 'true').length,
    businessRules: businessRules.map(br => ({
      name: br.name,
      when: br.when,
      order: br.order,
      active: br.active === 'true',
      operations: {
        insert: br.action_insert === 'true',
        update: br.action_update === 'true',
        delete: br.action_delete === 'true',
        query: br.action_query === 'true'
      },
      condition: br.condition || '(none)',
      script: br.script
    }))
  };
  
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => console.error('Error:', err.message));

