#!/usr/bin/env node
/**
 * Cleanup invalid Flow Designer records
 */
import * as dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const instanceUrl = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json' };

async function cleanup() {
    console.log('Cleaning up invalid flow records...\n');
    
    const tables = [
        'sys_hub_action_input',
        'sys_hub_action_instance', 
        'sys_hub_trigger_instance',
        'sys_hub_flow'
    ];
    
    const patterns = [
        'flow_newhire',
        'trigger_newhire',
        'action_newhire',
        'input_newhire'
    ];
    
    for (const table of tables) {
        try {
            const query = patterns.map(p => `sys_idLIKE${p}`).join('^OR');
            const resp = await axios.get(`${instanceUrl}/api/now/table/${table}`, {
                auth,
                headers,
                params: { 
                    sysparm_query: query,
                    sysparm_fields: 'sys_id,name'
                }
            });
            
            for (const rec of resp.data.result || []) {
                await axios.delete(`${instanceUrl}/api/now/table/${table}/${rec.sys_id}`, {
                    auth,
                    headers
                });
                console.log(`Deleted: ${table} - ${rec.sys_id}`);
            }
        } catch (err) {
            console.log(`Error on ${table}: ${err.response?.data?.error?.message || err.message}`);
        }
    }
    
    console.log('\nCleanup complete');
}

cleanup();

