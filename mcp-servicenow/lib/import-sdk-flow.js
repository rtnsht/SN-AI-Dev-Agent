#!/usr/bin/env node
/**
 * Import SDK Flow XML into ServiceNow
 * Handles sys_hub_flow, sys_hub_trigger_instance_v2, sys_hub_action_instance_v2, sys_hub_flow_logic_instance_v2
 */

import * as dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

// Tables to import in order
const TABLES = [
    'sys_hub_flow',
    'sys_hub_trigger_instance_v2',
    'sys_hub_action_instance_v2',
    'sys_hub_flow_logic_instance_v2'
];

function parseXml(xmlContent) {
    const records = [];
    
    for (const tableName of TABLES) {
        // Match INSERT_OR_UPDATE actions for this table
        const regex = new RegExp(`<${tableName}[^>]*action="INSERT_OR_UPDATE"[^>]*>([\\s\\S]*?)<\\/${tableName}>`, 'g');
        let match;
        
        while ((match = regex.exec(xmlContent)) !== null) {
            const recordContent = match[1];
            const fields = {};
            
            // Extract field values - handle both simple and display_value formats
            // Format 1: <field>value</field>
            // Format 2: <field display_value="text">sys_id</field>
            const fieldRegex = /<([a-z_0-9]+)(?:\s+display_value="[^"]*")?(?:\s[^>]*)?>([^<]*)<\/\1>/g;
            let fieldMatch;

            while ((fieldMatch = fieldRegex.exec(recordContent)) !== null) {
                const fieldName = fieldMatch[1];
                let fieldValue = fieldMatch[2];

                // Handle CDATA sections
                fieldValue = fieldValue.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

                fields[fieldName] = fieldValue.trim();
            }

            // Also extract fields with CDATA content separately
            const cdataRegex = /<([a-z_0-9]+)(?:[^>]*)><!\[CDATA\[([\s\S]*?)\]\]><\/\1>/g;
            while ((fieldMatch = cdataRegex.exec(recordContent)) !== null) {
                const fieldName = fieldMatch[1];
                const fieldValue = fieldMatch[2];
                fields[fieldName] = fieldValue.trim();
            }
            
            if (fields.sys_id) {
                records.push({ table: tableName, fields });
            }
        }
    }
    
    return records;
}

async function importRecord(table, fields) {
    // Check if exists
    try {
        const check = await axios.get(`${instanceUrl}/api/now/table/${table}/${fields.sys_id}`, { auth, headers });
        if (check.data.result) {
            // Update existing
            await axios.patch(`${instanceUrl}/api/now/table/${table}/${fields.sys_id}`, fields, { auth, headers });
            return { action: 'updated', name: fields.name || fields.sys_id };
        }
    } catch (e) {
        // Doesn't exist, create
    }
    
    await axios.post(`${instanceUrl}/api/now/table/${table}`, fields, { auth, headers });
    return { action: 'created', name: fields.name || fields.sys_id };
}

async function main() {
    const xmlFile = process.argv[2];
    if (!xmlFile) {
        console.log('Usage: node lib/import-sdk-flow.js <xml-file>');
        process.exit(1);
    }
    
    const xmlContent = fs.readFileSync(xmlFile, 'utf-8');
    const records = parseXml(xmlContent);
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          SDK Flow Import Tool                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📁 File: ${xmlFile}`);
    console.log(`🌐 Instance: ${instanceUrl}`);
    console.log(`📦 Records found: ${records.length}\n`);
    
    let success = 0, failed = 0;
    
    for (const record of records) {
        try {
            const result = await importRecord(record.table, record.fields);
            console.log(`   ✅ ${result.action}: ${record.table} - ${result.name}`);
            success++;
        } catch (e) {
            console.log(`   ❌ Failed: ${record.table} - ${e.response?.data?.error?.message || e.message}`);
            failed++;
        }
    }
    
    console.log('\n════════════════════════════════════════════════════════════');
    console.log(`📊 Results: ✅ ${success} succeeded, ❌ ${failed} failed`);
    
    // Get flow ID
    const flowRecord = records.find(r => r.table === 'sys_hub_flow');
    if (flowRecord) {
        console.log(`\n🔗 Open in Flow Designer:`);
        console.log(`   ${instanceUrl}/sys_hub.do?sys_id=${flowRecord.fields.sys_id}`);
    }
}

main().catch(e => console.error('Error:', e.message));

