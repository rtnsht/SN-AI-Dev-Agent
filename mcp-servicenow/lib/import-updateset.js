#!/usr/bin/env node
/**
 * Import Update Set from XML file
 * 
 * This script imports an update set XML file into ServiceNow as a Remote Update Set,
 * then previews and commits it.
 * 
 * Usage: node lib/import-updateset.js <xml-file-path>
 * 
 * The XML file should be a valid ServiceNow Update Set export.
 */

import * as dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { 
    username: process.env.SN_USERNAME, 
    password: process.env.SN_PASSWORD 
};
const headers = { 
    'Accept': 'application/json', 
    'Content-Type': 'application/json' 
};

/**
 * Create a Remote Update Set record
 */
async function createRemoteUpdateSet(name, description) {
    console.log(`\n📦 Creating Remote Update Set: ${name}`);
    
    const response = await axios.post(
        `${instanceUrl}/api/now/table/sys_remote_update_set`,
        {
            name: name,
            description: description,
            state: 'loaded',
            application: 'global'
        },
        { auth, headers }
    );
    
    const sysId = response.data.result.sys_id;
    console.log(`   ✅ Created Remote Update Set: ${sysId}`);
    return sysId;
}

/**
 * Parse XML and extract update set records
 */
function parseUpdateSetXml(xmlContent) {
    // Extract all records from the XML
    const records = [];
    
    // Match each record element (except sys_remote_update_set which is the container)
    const recordRegex = /<(sys_hub_[a-z_]+|sys_hub_action_[a-z_]+)[^>]*action="INSERT_OR_UPDATE"[^>]*>([\s\S]*?)<\/\1>/g;
    let match;
    
    while ((match = recordRegex.exec(xmlContent)) !== null) {
        const tableName = match[1];
        const recordContent = match[2];
        
        // Extract field values
        const fields = {};
        const fieldRegex = /<([a-z_]+)(?:[^>]*)?>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g;
        let fieldMatch;
        
        while ((fieldMatch = fieldRegex.exec(recordContent)) !== null) {
            const fieldName = fieldMatch[1];
            const fieldValue = fieldMatch[2] || fieldMatch[3] || '';
            fields[fieldName] = fieldValue.trim();
        }
        
        if (Object.keys(fields).length > 0) {
            records.push({ table: tableName, fields });
        }
    }
    
    return records;
}

/**
 * Create update XML records in the remote update set
 */
async function createUpdateXmlRecords(remoteUpdateSetId, records) {
    console.log(`\n📝 Creating ${records.length} update XML records...`);
    
    for (const record of records) {
        try {
            // Create the actual record in ServiceNow
            const createResponse = await axios.post(
                `${instanceUrl}/api/now/table/${record.table}`,
                record.fields,
                { auth, headers }
            );
            
            const createdSysId = createResponse.data.result.sys_id;
            console.log(`   ✅ Created ${record.table}: ${record.fields.name || record.fields.internal_name || createdSysId}`);
            
        } catch (err) {
            const errorMsg = err.response?.data?.error?.message || err.message;
            console.log(`   ⚠️  Failed to create ${record.table}: ${errorMsg}`);
        }
    }
}

/**
 * Alternative: Use the Import XML endpoint (if available)
 */
async function importViaAttachment(xmlContent, updateSetName) {
    console.log('\n📤 Attempting import via sys_remote_update_set...');
    
    // First create an empty remote update set
    const remoteSetId = await createRemoteUpdateSet(
        updateSetName,
        'Imported via API from XML file'
    );
    
    // Upload XML as attachment
    const formData = new FormData();
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    formData.append('file', blob, 'updateset.xml');
    
    try {
        await axios.post(
            `${instanceUrl}/api/now/attachment/file?table_name=sys_remote_update_set&table_sys_id=${remoteSetId}&file_name=updateset.xml`,
            xmlContent,
            {
                auth,
                headers: {
                    'Content-Type': 'application/xml',
                    'Accept': 'application/json'
                }
            }
        );
        console.log('   ✅ XML uploaded as attachment');
    } catch (err) {
        console.log('   ⚠️  Attachment upload failed:', err.response?.data?.error?.message || err.message);
    }
    
    return remoteSetId;
}

/**
 * Preview the update set
 */
async function previewUpdateSet(remoteUpdateSetId) {
    console.log('\n🔍 Previewing Update Set...');

    try {
        // Trigger preview via background script or API
        await axios.patch(
            `${instanceUrl}/api/now/table/sys_remote_update_set/${remoteUpdateSetId}`,
            { state: 'previewed' },
            { auth, headers }
        );
        console.log('   ✅ Preview initiated');
    } catch (err) {
        console.log('   ⚠️  Preview state change:', err.response?.data?.error?.message || err.message);
    }
}

/**
 * Commit the update set
 */
async function commitUpdateSet(remoteUpdateSetId) {
    console.log('\n✅ Committing Update Set...');

    try {
        await axios.patch(
            `${instanceUrl}/api/now/table/sys_remote_update_set/${remoteUpdateSetId}`,
            { state: 'committed' },
            { auth, headers }
        );
        console.log('   ✅ Update Set committed successfully!');
        return true;
    } catch (err) {
        console.log('   ⚠️  Commit failed:', err.response?.data?.error?.message || err.message);
        return false;
    }
}

/**
 * Direct record creation approach - creates Flow artifacts directly
 * This is more reliable than XML import for Flow Designer
 */
async function createFlowArtifactsDirect(xmlContent) {
    console.log('\n🚀 Creating Flow Designer artifacts directly via REST API...\n');

    const records = parseUpdateSetXml(xmlContent);
    console.log(`   Found ${records.length} records to create`);

    // Sort records: flows first, then triggers, then actions, then inputs
    const sortOrder = {
        'sys_hub_flow': 1,
        'sys_hub_trigger_instance': 2,
        'sys_hub_action_instance': 3,
        'sys_hub_action_input': 4
    };

    records.sort((a, b) => (sortOrder[a.table] || 99) - (sortOrder[b.table] || 99));

    const results = {
        success: [],
        failed: []
    };

    for (const record of records) {
        try {
            // Check if record already exists
            const existing = await axios.get(
                `${instanceUrl}/api/now/table/${record.table}`,
                {
                    auth,
                    headers,
                    params: {
                        sysparm_query: `sys_id=${record.fields.sys_id}`,
                        sysparm_limit: 1
                    }
                }
            );

            if (existing.data.result && existing.data.result.length > 0) {
                // Update existing record
                await axios.patch(
                    `${instanceUrl}/api/now/table/${record.table}/${record.fields.sys_id}`,
                    record.fields,
                    { auth, headers }
                );
                console.log(`   🔄 Updated: ${record.table} - ${record.fields.name || record.fields.sys_id}`);
            } else {
                // Create new record
                await axios.post(
                    `${instanceUrl}/api/now/table/${record.table}`,
                    record.fields,
                    { auth, headers }
                );
                console.log(`   ✅ Created: ${record.table} - ${record.fields.name || record.fields.sys_id}`);
            }

            results.success.push(record);
        } catch (err) {
            const errorMsg = err.response?.data?.error?.message || err.message;
            console.log(`   ❌ Failed: ${record.table} - ${errorMsg}`);
            results.failed.push({ record, error: errorMsg });
        }
    }

    return results;
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node lib/import-updateset.js <xml-file-path> [--direct]');
        console.log('');
        console.log('Options:');
        console.log('  --direct    Create records directly via REST API (recommended for Flow Designer)');
        console.log('');
        console.log('Example:');
        console.log('  node lib/import-updateset.js ../specs/REQ-002/3-implementation/NewHireBundleFlow-UpdateSet.xml --direct');
        process.exit(1);
    }

    const xmlFilePath = args[0];
    const directMode = args.includes('--direct');

    // Resolve path
    const resolvedPath = path.isAbsolute(xmlFilePath)
        ? xmlFilePath
        : path.resolve(process.cwd(), xmlFilePath);

    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ File not found: ${resolvedPath}`);
        process.exit(1);
    }

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          ServiceNow Update Set Import Tool                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📁 File: ${resolvedPath}`);
    console.log(`🌐 Instance: ${instanceUrl}`);
    console.log(`📋 Mode: ${directMode ? 'Direct REST API' : 'Remote Update Set'}`);

    const xmlContent = fs.readFileSync(resolvedPath, 'utf8');

    if (directMode) {
        // Create records directly - more reliable for Flow Designer
        const results = await createFlowArtifactsDirect(xmlContent);

        console.log('\n' + '═'.repeat(60));
        console.log('📊 IMPORT RESULTS');
        console.log('═'.repeat(60));
        console.log(`   ✅ Success: ${results.success.length}`);
        console.log(`   ❌ Failed:  ${results.failed.length}`);

        if (results.failed.length > 0) {
            console.log('\n   Failed records:');
            results.failed.forEach(f => {
                console.log(`      - ${f.record.table}: ${f.error}`);
            });
        }

        console.log('\n🔗 Verify in ServiceNow:');
        console.log(`   ${instanceUrl}/sys_hub_flow_list.do`);

    } else {
        // Use remote update set approach
        const updateSetName = path.basename(xmlFilePath, '.xml');
        const remoteSetId = await importViaAttachment(xmlContent, updateSetName);

        await previewUpdateSet(remoteSetId);

        console.log('\n' + '═'.repeat(60));
        console.log('📋 NEXT STEPS');
        console.log('═'.repeat(60));
        console.log(`\n1. Open Remote Update Set in ServiceNow:`);
        console.log(`   ${instanceUrl}/sys_remote_update_set.do?sys_id=${remoteSetId}`);
        console.log(`\n2. Click "Preview Update Set" if not already previewed`);
        console.log(`\n3. Review any conflicts or errors`);
        console.log(`\n4. Click "Commit Update Set" to apply changes`);
    }
}

main().catch(err => {
    console.error('\n❌ Error:', err.response?.data || err.message);
    process.exit(1);
});

