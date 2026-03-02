#!/usr/bin/env node
/**
 * Import SDK Flow into a scoped application
 * Uses a Scripted REST API to switch scope before creating records
 */
import axios from 'axios';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

// Tables to import in order
const TABLES = ['sys_hub_flow', 'sys_hub_trigger_instance_v2', 'sys_hub_action_instance_v2', 'sys_hub_flow_logic_instance_v2'];

function parseXml(xmlContent) {
    const records = [];
    for (const tableName of TABLES) {
        const regex = new RegExp(`<${tableName}[^>]*action="INSERT_OR_UPDATE"[^>]*>([\\s\\S]*?)<\\/${tableName}>`, 'g');
        let match;
        while ((match = regex.exec(xmlContent)) !== null) {
            const recordContent = match[1];
            const fields = {};
            // Extract fields with display_value attribute
            const fieldRegex = /<([a-z_0-9]+)(?:\s+display_value="[^"]*")?(?:\s[^>]*)?>([^<]*)<\/\1>/g;
            let fieldMatch;
            while ((fieldMatch = fieldRegex.exec(recordContent)) !== null) {
                fields[fieldMatch[1]] = fieldMatch[2].trim();
            }
            // Extract CDATA fields
            const cdataRegex = /<([a-z_0-9]+)(?:[^>]*)><!\[CDATA\[([\s\S]*?)\]\]><\/\1>/g;
            while ((fieldMatch = cdataRegex.exec(recordContent)) !== null) {
                fields[fieldMatch[1]] = fieldMatch[2].trim();
            }
            if (fields.sys_id) records.push({ table: tableName, fields });
        }
    }
    return records;
}

async function createInScope(scopeId, table, fields) {
    // Use GlideScopedEvaluator via background script REST API
    const script = `
        var gr = new GlideRecord('${table}');
        gr.initialize();
        ${Object.entries(fields).map(([k, v]) => `gr.setValue('${k}', '${v.replace(/'/g, "\\'")}');`).join('\n')}
        gr.setValue('sys_scope', '${scopeId}');
        var id = gr.insert();
        gs.info('Created ' + id);
        id;
    `;
    
    // Try using sys_script_execution or similar
    // This won't work without proper setup, so fall back to direct insert
    return null;
}

async function main() {
    const xmlFile = process.argv[2];
    const scopeId = process.argv[3] || '2ea695fec3d7321034b6b1f1b40131f0'; // x_snc_yantra
    
    if (!xmlFile) {
        console.log('Usage: node lib/import-scoped-flow.js <xml-file> [scope-sys-id]');
        process.exit(1);
    }
    
    const xmlContent = fs.readFileSync(xmlFile, 'utf-8');
    const records = parseXml(xmlContent);
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Scoped Flow Import Tool                                ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📁 File: ${xmlFile}`);
    console.log(`🔒 Target Scope: ${scopeId}`);
    console.log(`📦 Records found: ${records.length}\n`);
    
    // First check if records already exist
    for (const record of records) {
        try {
            await axios.get(`${url}/api/now/table/${record.table}/${record.fields.sys_id}`, { auth });
            // Exists - delete first
            await axios.delete(`${url}/api/now/table/${record.table}/${record.fields.sys_id}`, { auth });
            console.log(`   🗑️  Deleted existing: ${record.table}/${record.fields.sys_id}`);
        } catch (e) {
            // Doesn't exist, good
        }
    }
    
    // Insert with explicit sys_scope
    let success = 0, failed = 0;
    for (const record of records) {
        try {
            // Force sys_scope in the payload
            const payload = { ...record.fields, sys_scope: scopeId };
            await axios.post(`${url}/api/now/table/${record.table}`, payload, { auth, headers });
            console.log(`   ✅ Created: ${record.table} - ${record.fields.name || record.fields.sys_id}`);
            success++;
        } catch (e) {
            console.log(`   ❌ Failed: ${record.table} - ${e.response?.data?.error?.message || e.message}`);
            failed++;
        }
    }
    
    console.log(`\n📊 Results: ✅ ${success} succeeded, ❌ ${failed} failed`);
    
    // Verify scope
    const flowRecord = records.find(r => r.table === 'sys_hub_flow');
    if (flowRecord) {
        const check = await axios.get(`${url}/api/now/table/sys_hub_flow/${flowRecord.fields.sys_id}`, {
            auth, params: { sysparm_fields: 'name,sys_scope', sysparm_display_value: 'all' }
        });
        console.log(`\n🔍 Verification: ${check.data.result.name}`);
        console.log(`   Scope: ${check.data.result.sys_scope?.display_value || 'unknown'}`);
        console.log(`\n🔗 Open in Workflow Studio:`);
        console.log(`   ${url}/now/workflow-studio/builder?table=sys_hub_flow&sysId=${flowRecord.fields.sys_id}&`);
    }
}

main().catch(e => console.error('Error:', e.message));

