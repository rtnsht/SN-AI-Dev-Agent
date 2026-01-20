#!/usr/bin/env node
/**
 * Quick test script to verify ServiceNow connection
 */

import * as dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const username = process.env.SN_USERNAME;
const password = process.env.SN_PASSWORD;

console.log('🔍 Testing ServiceNow Connection...');
console.log(`   Instance: ${instanceUrl}`);
console.log(`   Username: ${username}`);
console.log('');

async function testConnection() {
  try {
    // Test 1: Basic connectivity
    console.log('1️⃣  Testing basic connectivity...');
    const response = await axios.get(`${instanceUrl}/api/now/table/sys_user`, {
      params: { sysparm_limit: 1 },
      auth: { username, password },
      headers: { 'Accept': 'application/json' },
      timeout: 30000
    });
    console.log('   ✅ Connected successfully!');
    
    // Test 2: Get current user
    console.log('2️⃣  Getting current user info...');
    const userResponse = await axios.get(`${instanceUrl}/api/now/table/sys_user`, {
      params: { 
        sysparm_query: `user_name=${username}`,
        sysparm_limit: 1,
        sysparm_fields: 'sys_id,user_name,name,email'
      },
      auth: { username, password },
      headers: { 'Accept': 'application/json' }
    });
    const user = userResponse.data.result[0];
    console.log(`   ✅ Logged in as: ${user.name} (${user.email})`);
    
    // Test 3: Get instance info
    console.log('3️⃣  Checking table access...');
    const tablesResponse = await axios.get(`${instanceUrl}/api/now/table/sys_db_object`, {
      params: { 
        sysparm_limit: 5,
        sysparm_fields: 'name,label'
      },
      auth: { username, password },
      headers: { 'Accept': 'application/json' }
    });
    console.log(`   ✅ Can access tables (found ${tablesResponse.data.result.length} tables)`);
    
    // Test 4: Check update set access
    console.log('4️⃣  Checking update set access...');
    const updateSetResponse = await axios.get(`${instanceUrl}/api/now/table/sys_update_set`, {
      params: { 
        sysparm_limit: 3,
        sysparm_query: 'state=in progress',
        sysparm_fields: 'name,state'
      },
      auth: { username, password },
      headers: { 'Accept': 'application/json' }
    });
    console.log(`   ✅ Found ${updateSetResponse.data.result.length} update sets in progress`);
    
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('🎉 All tests passed! Connection is working.');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('You can now use the MCP server with Augment AI.');
    console.log('Restart VS Code to enable the MCP tools.');
    
  } catch (error) {
    console.log('');
    console.log('❌ Connection failed!');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Message: ${error.response.data?.error?.message || error.message}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    process.exit(1);
  }
}

testConnection();

