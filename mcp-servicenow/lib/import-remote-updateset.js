/**
 * Import Update Set via Remote Update Set mechanism
 * This is the proper way to import Flow Designer flows
 * 
 * Steps:
 * 1. Create a sys_remote_update_set record
 * 2. Create sys_update_xml records for each artifact
 * 3. Preview the update set (validates records)
 * 4. Commit the update set (applies records)
 */
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import { parseStringPromise } from 'xml2js';

dotenv.config();

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

async function createRecord(table, data) {
  const resp = await axios.post(`${instanceUrl}/api/now/table/${table}`, data, { auth, headers });
  return resp.data.result;
}

async function importUpdateSet(xmlFile) {
  console.log('=== Remote Update Set Import ===\n');
  
  // Read and parse XML file
  const xmlContent = fs.readFileSync(xmlFile, 'utf-8');
  console.log(`Read file: ${xmlFile}`);
  
  // 1. Create Remote Update Set
  console.log('\n1. Creating Remote Update Set...');
  const remoteUs = await createRecord('sys_remote_update_set', {
    name: 'NewHireBundleOrchestration Flow Import',
    description: 'Automated import of New Hire Bundle Orchestration flow',
    state: 'loaded',
    application: 'global',
    release_date: new Date().toISOString().split('T')[0]
  });
  console.log(`   Created: ${remoteUs.sys_id} (${remoteUs.name})`);
  
  // 2. Parse XML to extract records
  console.log('\n2. Parsing XML and creating update records...');
  const parsed = await parseStringPromise(xmlContent);
  
  // Get all record elements from the XML
  const unload = parsed.unload;
  let recordCount = 0;
  
  for (const table of Object.keys(unload)) {
    if (table === '$' || table.startsWith('_')) continue;
    
    const records = Array.isArray(unload[table]) ? unload[table] : [unload[table]];
    
    for (const record of records) {
      if (!record || !record.sys_id) continue;
      
      // Convert record back to XML
      const sysId = record.sys_id[0];
      const updateName = `${table}_${sysId}`;
      
      // Build XML payload for this record
      let payload = `<?xml version="1.0" encoding="UTF-8"?>\\n<record_update table="${table}">\\n`;
      payload += `<${table} action="INSERT_OR_UPDATE">\\n`;
      
      for (const [field, value] of Object.entries(record)) {
        if (field === '$') continue;
        const val = Array.isArray(value) ? value[0] : value;
        if (typeof val === 'object') continue;
        payload += `<${field}>${escapeXml(val || '')}</${field}>\\n`;
      }
      
      payload += `</${table}>\\n</record_update>`;
      
      // Create sys_update_xml record
      const updateXml = await createRecord('sys_update_xml', {
        remote_update_set: remoteUs.sys_id,
        name: updateName,
        type: 'INSERT_OR_UPDATE',
        target_name: record.name ? record.name[0] : sysId,
        payload: payload,
        action: 'INSERT_OR_UPDATE'
      });
      
      console.log(`   Created update XML: ${table} - ${sysId}`);
      recordCount++;
    }
  }
  
  console.log(`\\n   Total records created: ${recordCount}`);
  
  // 3. Update remote update set to ready state
  console.log('\\n3. Update Set ready for preview/commit');
  console.log(`\\n📋 Next Steps (Manual):`);
  console.log(`   1. Go to: ${instanceUrl}/sys_remote_update_set.do?sys_id=${remoteUs.sys_id}`);
  console.log(`   2. Click "Preview Update Set" button`);
  console.log(`   3. Review any issues`);
  console.log(`   4. Click "Commit Update Set" to apply`);
  
  return remoteUs.sys_id;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Run import
const xmlFile = process.argv[2] || 'specs/REQ-002/3-implementation/NewHireBundleFlow-UpdateSet.xml';
importUpdateSet(xmlFile).catch(e => {
  console.error('Error:', e.response?.data || e.message);
});

