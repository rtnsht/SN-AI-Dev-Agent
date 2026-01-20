#!/usr/bin/env node
/**
 * Cleanup duplicate artifacts from REQ-003 renaming
 */

import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const api = axios.create({
    baseURL: process.env.SN_INSTANCE_URL,
    auth: { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
});

const duplicates = [
    { table: 'sys_script', name: 'REQ003_ValidateHighImpact', type: 'Business Rule' },
    { table: 'sys_script_client', name: 'REQ003_HighImpactHandler', type: 'Client Script' },
    { table: 'sys_ui_policy', name: 'REQ003_HighImpactFieldBehavior', type: 'UI Policy' },
    { table: 'sysevent_email_action', name: 'REQ003_HighImpactNotification', type: 'Notification' },
    { table: 'sysevent_register', name: 'req003.high_impact_incident', type: 'Event', field: 'event_name' }
];

async function cleanup() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🧹 CLEANUP: Removing duplicate REQ003_* artifacts');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const dup of duplicates) {
        const field = dup.field || 'name';
        try {
            // Find the duplicate
            const search = await api.get(`/api/now/table/${dup.table}`, {
                params: { sysparm_query: `${field}=${dup.name}`, sysparm_limit: 5 }
            });

            if (search.data.result && search.data.result.length > 0) {
                for (const record of search.data.result) {
                    console.log(`🗑️  Deleting ${dup.type}: ${dup.name} (${record.sys_id})`);
                    await api.delete(`/api/now/table/${dup.table}/${record.sys_id}`);
                    console.log(`   ✅ Deleted`);
                }
            } else {
                console.log(`ℹ️  ${dup.type}: ${dup.name} - not found (already cleaned)`);
            }
        } catch (error) {
            console.log(`❌ Error deleting ${dup.name}: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    console.log('\n✅ Cleanup complete!\n');
}

cleanup();

