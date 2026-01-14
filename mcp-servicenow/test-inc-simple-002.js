/**
 * Test script for INC-SIMPLE-002: Auto-populate Region from Caller Location
 */
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const instance = process.env.SN_INSTANCE_URL;
const auth = { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD };
const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

async function runTests() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  INC-SIMPLE-002: Test Suite');
    console.log('═══════════════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    // TC-004: Server-side Business Rule Test
    console.log('TC-004: Server-side Business Rule (API Insert)');
    console.log('─────────────────────────────────────────────────');
    
    try {
        // Find a location with region, then find a user at that location
        console.log('1. Finding a location with region...');
        const locs = await axios.get(
            `${instance}/api/now/table/cmn_location?sysparm_query=u_regionISNOTEMPTY&sysparm_limit=5&sysparm_fields=sys_id,name,u_region`,
            { auth, headers }
        );

        let testUser = null;
        let locationRegion = null;
        let locationName = null;

        for (const loc of locs.data.result) {
            // Find a user at this location
            const users = await axios.get(
                `${instance}/api/now/table/sys_user?sysparm_query=location=${loc.sys_id}&sysparm_limit=1&sysparm_fields=sys_id,name`,
                { auth, headers }
            );
            if (users.data.result.length > 0) {
                testUser = users.data.result[0];
                locationRegion = loc.u_region;
                locationName = loc.name;
                console.log(`   User: ${testUser.name}`);
                console.log(`   Location: ${locationName}`);
                console.log(`   Location Region: ${locationRegion}`);
                break;
            }
        }
        
        if (!testUser) {
            console.log('   ⚠️  No user found with location that has region');
            failed++;
        } else {
            // Create incident via API
            console.log('\n2. Creating incident via API with caller_id only...');
            const incident = await axios.post(
                `${instance}/api/now/table/incident`,
                {
                    short_description: 'TEST INC-SIMPLE-002: Auto-region test',
                    caller_id: testUser.sys_id
                },
                { auth, headers }
            );
            
            const incNumber = incident.data.result.number;
            const incRegion = incident.data.result.u_region;
            console.log(`   Created: ${incNumber}`);
            console.log(`   u_region: ${incRegion || '(empty)'}`);
            
            // Verify
            if (incRegion === locationRegion) {
                console.log('\n   ✅ PASSED: Region auto-populated correctly!');
                passed++;
            } else {
                console.log(`\n   ❌ FAILED: Expected "${locationRegion}", got "${incRegion}"`);
                failed++;
            }
            
            // Clean up
            console.log('\n3. Cleaning up test incident...');
            await axios.delete(
                `${instance}/api/now/table/incident/${incident.data.result.sys_id}`,
                { auth, headers }
            );
            console.log(`   Deleted: ${incNumber}`);
        }
    } catch (error) {
        console.error('   ❌ Error:', error.response?.data?.error?.message || error.message);
        failed++;
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════');
    
    return { passed, failed };
}

runTests();

