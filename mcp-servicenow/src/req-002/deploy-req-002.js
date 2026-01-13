#!/usr/bin/env node
/**
 * REQ-002: Incident Deduplication Engine
 * Deploys all artifacts for the deduplication feature
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

// Load script files
const loadScript = (filename) => fs.readFileSync(path.join(__dirname, filename), 'utf8');

async function createRecord(table, data) {
    const response = await axios.post(`${instanceUrl}/api/now/table/${table}`, data, { auth, headers });
    return response.data.result;
}

async function query(table, params = {}) {
    const response = await axios.get(`${instanceUrl}/api/now/table/${table}`, { params, auth, headers });
    return response.data.result;
}

async function updateRecord(table, sysId, data) {
    const response = await axios.patch(`${instanceUrl}/api/now/table/${table}/${sysId}`, data, { auth, headers });
    return response.data.result;
}

const deployedArtifacts = [];

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  REQ-002: Incident Deduplication Engine Deployment             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Step 1: Create Update Set
    console.log('━━━ Step 1: Creating Update Set ━━━\n');
    const updateSet = await createRecord('sys_update_set', {
        name: 'REQ-002 Incident Deduplication Engine',
        description: 'Server-side dedup engine for detecting and merging duplicate incidents',
        state: 'in progress'
    });
    console.log(`✅ Update Set: ${updateSet.sys_id}`);
    console.log(`   ${instanceUrl}/sys_update_set.do?sys_id=${updateSet.sys_id}\n`);

    // Step 2: Create Custom Table for Dedup Rules
    console.log('━━━ Step 2: Creating Custom Table u_incident_dedupe_rule ━━━\n');
    
    // Check if table exists first
    const existingTable = await query('sys_db_object', {
        sysparm_query: 'name=u_incident_dedupe_rule',
        sysparm_limit: 1
    });

    let tableId;
    if (existingTable.length > 0) {
        tableId = existingTable[0].sys_id;
        console.log(`✓ Table already exists: ${tableId}`);
    } else {
        const table = await createRecord('sys_db_object', {
            name: 'u_incident_dedupe_rule',
            label: 'Incident Deduplication Rule',
            super_class: '', // Extend from nothing (standalone table)
            access: 'public',
            create_access: true,
            read_access: true,
            update_access: true,
            delete_access: true
        });
        tableId = table.sys_id;
        console.log(`✅ Created table: ${tableId}`);
        deployedArtifacts.push({ table: 'sys_db_object', sysId: tableId, name: 'u_incident_dedupe_rule' });
    }

    // Step 3: Create table columns
    console.log('\n━━━ Step 3: Creating Table Columns ━━━\n');
    await createTableColumns(tableId);

    // Step 4: Deploy Script Includes
    console.log('\n━━━ Step 4: Deploying Script Includes ━━━\n');
    await deployScriptIncludes();

    // Step 5: Deploy Business Rule
    console.log('\n━━━ Step 5: Deploying Business Rule ━━━\n');
    await deployBusinessRule();

    // Step 6: Create sample dedup rules
    console.log('\n━━━ Step 6: Creating Sample Dedup Rules ━━━\n');
    await createSampleRules();

    // Step 7: Move artifacts to update set
    console.log('\n━━━ Step 7: Organizing Update Set ━━━\n');
    await organizeUpdateSet(updateSet.sys_id);

    // Summary
    console.log('\n━━━ Deployment Complete ━━━\n');
    console.log(`Deployed ${deployedArtifacts.length} artifacts:`);
    for (const a of deployedArtifacts) {
        console.log(`  ✅ ${a.table}: ${a.name}`);
    }
    console.log(`\nUpdate Set: ${instanceUrl}/sys_update_set.do?sys_id=${updateSet.sys_id}`);
}

async function createTableColumns(tableId) {
    const columns = [
        { element: 'u_name', column_label: 'Name', internal_type: 'string', max_length: 100 },
        { element: 'u_match_fields', column_label: 'Match Fields', internal_type: 'string', max_length: 500,
          comments: 'Comma-separated field names (e.g., correlation_id,cmdb_ci,category)' },
        { element: 'u_time_window_minutes', column_label: 'Time Window (minutes)', internal_type: 'integer', default_value: '30' },
        { element: 'u_normalize_description', column_label: 'Normalize Short Description', internal_type: 'boolean', default_value: 'false' },
        { element: 'u_auto_close_duplicates', column_label: 'Auto-Close Duplicates', internal_type: 'boolean', default_value: 'false' },
        { element: 'u_priority', column_label: 'Priority', internal_type: 'integer', default_value: '100' },
        { element: 'u_active', column_label: 'Active', internal_type: 'boolean', default_value: 'true' }
    ];

    for (const col of columns) {
        const existing = await query('sys_dictionary', {
            sysparm_query: `name=u_incident_dedupe_rule^element=${col.element}`,
            sysparm_limit: 1
        });

        if (existing.length === 0) {
            const record = await createRecord('sys_dictionary', {
                name: 'u_incident_dedupe_rule',
                element: col.element,
                column_label: col.column_label,
                internal_type: col.internal_type,
                max_length: col.max_length || 40,
                comments: col.comments || '',
                default_value: col.default_value || ''
            });
            console.log(`  ✅ Column: ${col.element}`);
            deployedArtifacts.push({ table: 'sys_dictionary', sysId: record.sys_id, name: col.element });
        } else {
            console.log(`  ✓ Column exists: ${col.element}`);
        }
    }
}

async function deployScriptIncludes() {
    const scriptIncludes = [
        { name: 'IncidentDeduplicationEngine', file: 'IncidentDeduplicationEngine.js',
          description: 'Server-side engine for detecting duplicate incidents based on configurable rules' },
        { name: 'DuplicateMergeProcessor', file: 'DuplicateMergeProcessor.js',
          description: 'Handles merge behavior for duplicate incidents - master selection, linking, aggregation' }
    ];

    for (const si of scriptIncludes) {
        const script = loadScript(si.file);

        // Check if exists
        const existing = await query('sys_script_include', {
            sysparm_query: `name=${si.name}`,
            sysparm_limit: 1
        });

        if (existing.length > 0) {
            await updateRecord('sys_script_include', existing[0].sys_id, { script });
            console.log(`  ✓ Updated: ${si.name}`);
            deployedArtifacts.push({ table: 'sys_script_include', sysId: existing[0].sys_id, name: si.name });
        } else {
            const record = await createRecord('sys_script_include', {
                name: si.name,
                api_name: 'global.' + si.name,
                script: script,
                description: si.description,
                active: true,
                access: 'public',
                client_callable: false
            });
            console.log(`  ✅ Created: ${si.name}`);
            deployedArtifacts.push({ table: 'sys_script_include', sysId: record.sys_id, name: si.name });
        }
    }
}

async function deployBusinessRule() {
    const brScript = loadScript('IncidentDeduplicationTrigger.js');
    const brName = 'Incident Deduplication Trigger';

    const existing = await query('sys_script', {
        sysparm_query: `name=${brName}^collection=incident`,
        sysparm_limit: 1
    });

    if (existing.length > 0) {
        await updateRecord('sys_script', existing[0].sys_id, { script: brScript });
        console.log(`  ✓ Updated: ${brName}`);
        deployedArtifacts.push({ table: 'sys_script', sysId: existing[0].sys_id, name: brName });
    } else {
        const record = await createRecord('sys_script', {
            name: brName,
            collection: 'incident',
            script: brScript,
            when: 'after',
            action_insert: true,
            action_update: false,
            action_delete: false,
            action_query: false,
            order: 500,
            active: true,
            comments: 'Triggers deduplication engine when new incidents are created'
        });
        console.log(`  ✅ Created: ${brName}`);
        deployedArtifacts.push({ table: 'sys_script', sysId: record.sys_id, name: brName });
    }
}

async function createSampleRules() {
    const rules = [
        {
            u_name: 'Correlation ID Match',
            u_match_fields: 'correlation_id',
            u_time_window_minutes: 60,
            u_normalize_description: false,
            u_auto_close_duplicates: true,
            u_priority: 10,
            u_active: true
        },
        {
            u_name: 'CI + Category + Description Match',
            u_match_fields: 'cmdb_ci,category,subcategory,short_description',
            u_time_window_minutes: 30,
            u_normalize_description: true,
            u_auto_close_duplicates: false,
            u_priority: 20,
            u_active: true
        }
    ];

    for (const rule of rules) {
        const existing = await query('u_incident_dedupe_rule', {
            sysparm_query: `u_name=${rule.u_name}`,
            sysparm_limit: 1
        });

        if (existing.length === 0) {
            try {
                const record = await createRecord('u_incident_dedupe_rule', rule);
                console.log(`  ✅ Rule: ${rule.u_name}`);
                deployedArtifacts.push({ table: 'u_incident_dedupe_rule', sysId: record.sys_id, name: rule.u_name });
            } catch (err) {
                console.log(`  ⚠️ Could not create rule (table may need cache refresh): ${rule.u_name}`);
            }
        } else {
            console.log(`  ✓ Rule exists: ${rule.u_name}`);
        }
    }
}

async function organizeUpdateSet(updateSetId) {
    for (const artifact of deployedArtifacts) {
        const updateName = `${artifact.table}_${artifact.sysId}`;

        const updateXml = await query('sys_update_xml', {
            sysparm_query: `name=${updateName}`,
            sysparm_fields: 'sys_id,update_set',
            sysparm_limit: 1
        });

        if (updateXml.length > 0 && updateXml[0].update_set !== updateSetId) {
            try {
                await updateRecord('sys_update_xml', updateXml[0].sys_id, { update_set: updateSetId });
                console.log(`  📦 Moved: ${artifact.name}`);
            } catch (err) {
                console.log(`  ⚠️ Could not move: ${artifact.name}`);
            }
        }
    }
}

main().catch(err => {
    console.error('Error:', err.response?.data || err.message);
    process.exit(1);
});

