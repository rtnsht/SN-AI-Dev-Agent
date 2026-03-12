#!/usr/bin/env node
/**
 * Enhanced Flow Designer Export Tool
 *
 * Exports a complete flow with all related records in proper Update Set XML format
 * that can be imported using import-updateset.js
 *
 * Usage:
 *   node lib/export-complete-flow.js <flow-sys-id> [options]
 *
 * Options:
 *   --output, -o  Output file path (default: flow-export-<timestamp>.xml)
 *   --name, -n    Custom update set name
 *
 * Example:
 *   node lib/export-complete-flow.js 30f3d26187e92300e0ef0cf888cb0b91 -o my-flow.xml
 */
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

// Flow Designer related tables to export
const FLOW_TABLES = [
    'sys_hub_flow',
    'sys_hub_trigger_instance',
    'sys_hub_action_instance',
    'sys_hub_action_input',
    'sys_hub_flow_stage',
    'sys_hub_flow_input',
    'sys_hub_flow_output'
];

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        flowId: null,
        output: null,
        name: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--output' || arg === '-o') {
            options.output = args[++i];
        } else if (arg === '--name' || arg === '-n') {
            options.name = args[++i];
        } else if (!arg.startsWith('-') && !options.flowId) {
            options.flowId = arg;
        }
    }

    return options;
}

/**
 * Get record XML from ServiceNow
 */
async function getRecordXml(table, sysId) {
    const resp = await axios.get(`${instanceUrl}/${table}.do`, {
        auth,
        headers: { 'Accept': 'application/xml' },
        params: { XML: '', sys_id: sysId }
    });
    return resp.data;
}

/**
 * Get records from a table via REST API
 */
async function getRecords(table, query, fields = 'sys_id') {
    const resp = await axios.get(`${instanceUrl}/api/now/table/${table}`, {
        auth,
        headers,
        params: {
            sysparm_query: query,
            sysparm_fields: fields,
            sysparm_limit: 200
        }
    });
    return resp.data.result || [];
}

/**
 * Get a single record
 */
async function getRecord(table, sysId) {
    const resp = await axios.get(`${instanceUrl}/api/now/table/${table}/${sysId}`, {
        auth,
        headers
    });
    return resp.data.result;
}

/**
 * Convert JSON record to Update Set XML format
 */
function recordToUpdateSetXml(table, record) {
    let xml = `    <${table} action="INSERT_OR_UPDATE">\n`;

    for (const [key, value] of Object.entries(record)) {
        if (value === null || value === undefined) continue;

        // Skip link-type fields
        if (typeof value === 'object' && value.link) continue;

        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

        // Use CDATA for fields that might contain special characters
        if (stringValue.includes('<') || stringValue.includes('>') || stringValue.includes('&') || stringValue.length > 200) {
            xml += `        <${key}><![CDATA[${stringValue}]]></${key}>\n`;
        } else {
            xml += `        <${key}>${escapeXml(stringValue)}</${key}>\n`;
        }
    }

    xml += `    </${table}>\n`;
    return xml;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Export complete flow with all related records
 */
async function exportFlow(flowId, options = {}) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║       Enhanced Flow Designer Export Tool                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n🌐 Instance: ${instanceUrl}`);
    console.log(`📋 Flow ID: ${flowId}\n`);

    const records = {
        sys_hub_flow: [],
        sys_hub_trigger_instance: [],
        sys_hub_action_instance: [],
        sys_hub_action_input: [],
        sys_hub_flow_stage: [],
        sys_hub_flow_input: [],
        sys_hub_flow_output: []
    };

    // 1. Get flow record
    console.log('1️⃣  Exporting flow definition...');
    const flow = await getRecord('sys_hub_flow', flowId);
    if (!flow) {
        console.error(`❌ Flow not found: ${flowId}`);
        process.exit(1);
    }
    records.sys_hub_flow.push(flow);
    console.log(`   ✅ ${flow.name || flow.internal_name}`);

    // 2. Get trigger instances
    console.log('\n2️⃣  Exporting trigger instances...');
    const triggers = await getRecords('sys_hub_trigger_instance', `flow=${flowId}`, 'sys_id,name');
    for (const t of triggers) {
        const fullRecord = await getRecord('sys_hub_trigger_instance', t.sys_id);
        records.sys_hub_trigger_instance.push(fullRecord);
        console.log(`   ✅ ${fullRecord.name || t.sys_id}`);
    }

    // 3. Get action instances
    console.log('\n3️⃣  Exporting action instances...');
    const actions = await getRecords('sys_hub_action_instance', `flow=${flowId}`, 'sys_id,name,order');
    for (const a of actions) {
        const fullRecord = await getRecord('sys_hub_action_instance', a.sys_id);
        records.sys_hub_action_instance.push(fullRecord);
        console.log(`   ✅ ${fullRecord.name || `Action ${a.order}`}`);

        // 3b. Get action inputs for this action
        const actionInputs = await getRecords('sys_hub_action_input', `action_instance=${a.sys_id}`, 'sys_id');
        for (const ai of actionInputs) {
            const fullInput = await getRecord('sys_hub_action_input', ai.sys_id);
            records.sys_hub_action_input.push(fullInput);
        }
    }
    console.log(`   📥 Found ${records.sys_hub_action_input.length} action inputs`);

    // 4. Get flow stages
    console.log('\n4️⃣  Exporting flow stages...');
    const stages = await getRecords('sys_hub_flow_stage', `flow=${flowId}`, 'sys_id,label,order');
    for (const s of stages) {
        const fullRecord = await getRecord('sys_hub_flow_stage', s.sys_id);
        records.sys_hub_flow_stage.push(fullRecord);
        console.log(`   ✅ ${fullRecord.label || `Stage ${s.order}`}`);
    }

    // 5. Get flow inputs
    console.log('\n5️⃣  Exporting flow inputs...');
    const inputs = await getRecords('sys_hub_flow_input', `flow=${flowId}`, 'sys_id,name');
    for (const i of inputs) {
        const fullRecord = await getRecord('sys_hub_flow_input', i.sys_id);
        records.sys_hub_flow_input.push(fullRecord);
        console.log(`   ✅ ${fullRecord.name || i.sys_id}`);
    }

    // 6. Get flow outputs
    console.log('\n6️⃣  Exporting flow outputs...');
    const outputs = await getRecords('sys_hub_flow_output', `flow=${flowId}`, 'sys_id,name');
    for (const o of outputs) {
        const fullRecord = await getRecord('sys_hub_flow_output', o.sys_id);
        records.sys_hub_flow_output.push(fullRecord);
        console.log(`   ✅ ${fullRecord.name || o.sys_id}`);
    }

    // Generate Update Set XML
    console.log('\n7️⃣  Generating Update Set XML...');

    const flowName = flow.name || flow.internal_name || 'UnknownFlow';
    const updateSetName = options.name || `Flow Export - ${flowName}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ServiceNow Flow Designer Export
  Flow: ${flowName}
  Exported: ${new Date().toISOString()}
  Instance: ${instanceUrl}

  Import using: node lib/import-updateset.js <this-file> --direct
-->
<unload unload_date="${new Date().toISOString()}" unload_name="${updateSetName}">
`;

    // Add records in dependency order
    const tableOrder = [
        'sys_hub_flow',
        'sys_hub_trigger_instance',
        'sys_hub_flow_stage',
        'sys_hub_flow_input',
        'sys_hub_flow_output',
        'sys_hub_action_instance',
        'sys_hub_action_input'
    ];

    let totalRecords = 0;
    for (const table of tableOrder) {
        if (records[table] && records[table].length > 0) {
            xml += `\n    <!-- ${table} (${records[table].length} records) -->\n`;
            for (const record of records[table]) {
                xml += recordToUpdateSetXml(table, record);
                totalRecords++;
            }
        }
    }

    xml += '\n</unload>\n';

    // Write to file
    const outputFile = options.output || path.join(__dirname, `flow-export-${timestamp}.xml`);
    fs.writeFileSync(outputFile, xml);

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 EXPORT SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   Flow Name:      ${flowName}`);
    console.log(`   Total Records:  ${totalRecords}`);
    console.log(`   Output File:    ${outputFile}`);
    console.log('\n   Records by type:');
    for (const table of tableOrder) {
        if (records[table] && records[table].length > 0) {
            console.log(`      ${table}: ${records[table].length}`);
        }
    }

    console.log('\n📋 NEXT STEPS');
    console.log('═'.repeat(60));
    console.log(`   1. Review/modify the XML file if needed`);
    console.log(`   2. Import to target instance:`);
    console.log(`      node lib/import-updateset.js ${outputFile} --direct`);
    console.log(`   3. Activate the flow in Flow Designer UI`);

    return { outputFile, totalRecords, records };
}

/**
 * Main execution
 */
async function main() {
    const options = parseArgs();

    if (!options.flowId) {
        console.log('Enhanced Flow Designer Export Tool');
        console.log('==================================\n');
        console.log('Usage: node lib/export-complete-flow.js <flow-sys-id> [options]\n');
        console.log('Options:');
        console.log('  --output, -o  Output file path (default: flow-export-<timestamp>.xml)');
        console.log('  --name, -n    Custom update set name\n');
        console.log('Examples:');
        console.log('  node lib/export-complete-flow.js 30f3d26187e92300e0ef0cf888cb0b91');
        console.log('  node lib/export-complete-flow.js abc123 -o my-flow.xml -n "My Flow Export"\n');
        console.log('Find flow sys_id in Flow Designer URL or via:');
        console.log(`  ${instanceUrl}/sys_hub_flow_list.do`);
        process.exit(1);
    }

    await exportFlow(options.flowId, options);
}

main().catch(e => {
    console.error('\n❌ Error:', e.response?.data || e.message);
    process.exit(1);
});
