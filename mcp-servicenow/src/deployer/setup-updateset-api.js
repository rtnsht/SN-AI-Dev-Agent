#!/usr/bin/env node
/**
 * Setup UpdateSetHelper API on ServiceNow Instance
 * 
 * This script:
 * 1. Checks if the UpdateSetHelper API exists on your instance
 * 2. Deploys it if not present
 * 3. Checks ACL configuration
 * 4. Saves the API path to .env for future use
 * 
 * Usage:
 *   node src/deployer/setup-updateset-api.js
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ServiceNowClient } from './ServiceNowClient.js';
import { UpdateSetHelperSetup } from './UpdateSetHelperSetup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
    // Validate environment
    const instanceUrl = process.env.SN_INSTANCE_URL;
    const username = process.env.SN_USERNAME;
    const password = process.env.SN_PASSWORD;

    if (!instanceUrl || !username || !password) {
        console.error('❌ Missing ServiceNow credentials');
        console.error('Set SN_INSTANCE_URL, SN_USERNAME, and SN_PASSWORD in .env file');
        process.exit(1);
    }

    console.log(`\nInstance: ${instanceUrl}`);
    console.log(`User: ${username}\n`);

    const client = new ServiceNowClient({ instanceUrl, username, password });
    const setup = new UpdateSetHelperSetup(client);

    try {
        const result = await setup.setup();
        
        console.log('\n📋 Next Steps:');
        console.log('   1. If ACL warning shown, configure Default ACL on the API');
        console.log('   2. Test with: node test-updateset-flow.js');
        console.log('   3. Deploy artifacts using the deployer CLI\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Setup failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

main();

