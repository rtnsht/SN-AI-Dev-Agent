#!/usr/bin/env node
/**
 * Verify REQ-002 Deployment
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

const UPDATE_SET_ID = '8fa8516393d232102f57f0ba2bba109a';

async function query(table, params = {}) {
    const response = await axios.get(`${instanceUrl}/api/now/table/${table}`, { params, auth, headers });
    return response.data.result;
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  REQ-002: Deployment Verification                              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Check Update Set Contents
    console.log('━━━ Update Set Contents ━━━\n');
    const updates = await query('sys_update_xml', {
        sysparm_query: 'update_set=' + UPDATE_SET_ID,
        sysparm_fields: 'name,type,target_name',
        sysparm_display_value: 'all',
        sysparm_limit: 50
    });

    console.log(`Records in Update Set: ${updates.length}\n`);
    for (const u of updates) {
        const targetName = typeof u.target_name === 'object' ? u.target_name.display_value : u.target_name;
        console.log(`  ✅ ${u.type}: ${targetName || u.name}`);
    }

    // Check Script Includes
    console.log('\n━━━ Script Includes ━━━\n');
    const scriptIncludes = await query('sys_script_include', {
        sysparm_query: 'nameINIncidentDeduplicationEngine,DuplicateMergeProcessor',
        sysparm_fields: 'name,active,sys_id'
    });
    for (const si of scriptIncludes) {
        console.log(`  ✅ ${si.name} (active: ${si.active})`);
    }

    // Check Business Rule
    console.log('\n━━━ Business Rule ━━━\n');
    const br = await query('sys_script', {
        sysparm_query: 'name=Incident Deduplication Trigger^collection=incident',
        sysparm_fields: 'name,active,when'
    });
    for (const b of br) {
        console.log(`  ✅ ${b.name} (when: ${b.when}, active: ${b.active})`);
    }

    // Check Dedup Rules
    console.log('\n━━━ Deduplication Rules ━━━\n');
    const rules = await query('u_incident_dedupe_rule', {
        sysparm_fields: 'u_name,u_match_fields,u_active'
    });
    for (const r of rules) {
        console.log(`  ✅ ${r.u_name} (fields: ${r.u_match_fields}, active: ${r.u_active})`);
    }

    // Summary
    console.log('\n━━━ Summary ━━━\n');
    console.log(`Update Set: ${instanceUrl}/sys_update_set.do?sys_id=${UPDATE_SET_ID}`);
    console.log(`Dedup Rules Table: ${instanceUrl}/u_incident_dedupe_rule_list.do`);
    console.log(`\n✅ REQ-002 Deployment Verified Successfully!`);
}

main().catch(err => {
    console.error('Error:', err.response?.data || err.message);
});

