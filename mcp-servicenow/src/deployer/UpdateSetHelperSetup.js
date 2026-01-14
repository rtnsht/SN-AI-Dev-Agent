/**
 * UpdateSetHelper API Setup Utility
 *
 * Deploys the UpdateSetHelper Scripted REST API to the instance.
 * The API replicates the OOTB "Make This My Current Set" UI Action
 * using GlideUpdateSet().set() to enable artifact capture via REST API.
 *
 * IMPORTANT: After deployment, you must:
 * 1. Note the full API path shown in the output
 * 2. Add it to your .env: SN_UPDATE_SET_API_PATH=<full_path>
 * 3. Configure Default ACL on the API if you get 403 errors
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE_PATH = path.join(__dirname, '../../.env');

export class UpdateSetHelperSetup {
    constructor(client) {
        this.client = client;
        this.apiName = 'UpdateSetHelper';
        this.serviceId = 'update_set_helper';
        this.resourceName = 'setCurrentUpdateSet';
        this.relativePath = '/set_current';
    }

    /**
     * Check if the UpdateSetHelper API exists
     */
    async checkApiExists() {
        console.log('🔍 Checking for UpdateSetHelper API...');

        try {
            const result = await this.client.queryRecords(
                'sys_ws_definition',
                `name=${this.apiName}^active=true`,
                ['sys_id', 'name', 'service_id']
            );

            if (result.result && result.result.length > 0) {
                console.log('   ✅ API Definition found');
                return { exists: true, sysId: result.result[0].sys_id };
            }
        } catch (e) {
            // API doesn't exist
        }

        console.log('   ⚠️  UpdateSetHelper API not found');
        return { exists: false, sysId: null };
    }

    /**
     * Deploy the UpdateSetHelper API to the instance
     */
    async deployApi() {
        console.log('\n📦 Deploying UpdateSetHelper API...');

        // Create the Scripted REST API Definition
        console.log('   Creating API Definition...');
        const apiDef = await this.client.createRecord('sys_ws_definition', {
            name: this.apiName,
            service_id: this.serviceId,
            active: true,
            short_description: 'Helper API to set current update set programmatically (for REST API artifact capture)'
        });

        const apiId = apiDef.result.sys_id;
        const namespace = apiDef.result.api_namespace || this.serviceId;
        console.log(`   ✅ Created API Definition (namespace: ${namespace})`);

        // Create the Resource/Operation
        console.log('   Creating Resource...');
        const script = this.getOperationScript();
        
        await this.client.createRecord('sys_ws_operation', {
            web_service_definition: apiId,
            name: this.resourceName,
            http_method: 'POST',
            relative_path: this.relativePath,
            active: true,
            operation_script: script,
            short_description: 'Set the current update set for artifact capture'
        });
        console.log('   ✅ Created Resource');

        const fullPath = `/api/${namespace}/${this.serviceId}${this.relativePath}`;
        return { path: fullPath, sysId: apiId, namespace };
    }

    /**
     * Get the operation script that replicates "Make This My Current Set"
     */
    getOperationScript() {
        return `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var updateSetId = request.body.data ? request.body.data.sys_id : null;
    
    if (!updateSetId) {
        response.setStatus(400);
        return { error: 'sys_id parameter required in request body' };
    }
    
    // Verify update set exists and is in progress
    var gr = new GlideRecord('sys_update_set');
    if (!gr.get(updateSetId)) {
        response.setStatus(404);
        return { error: 'Update set not found' };
    }
    
    if (gr.state != 'in progress') {
        response.setStatus(400);
        return { error: 'Update set must be in progress state' };
    }
    
    // Set as current update set (same as "Make This My Current Set" UI Action)
    var us = new GlideUpdateSet();
    us.set(updateSetId);
    
    return {
        success: true,
        message: 'Update set set as current',
        update_set: {
            sys_id: gr.sys_id.toString(),
            name: gr.name.toString()
        }
    };
})(request, response);`;
    }

    /**
     * Save the API path to .env file
     */
    saveApiPathToEnv(apiPath) {
        console.log(`\n💾 Saving API path to .env...`);
        
        try {
            let envContent = '';
            if (fs.existsSync(ENV_FILE_PATH)) {
                envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
            }

            // Check if SN_UPDATE_SET_API_PATH already exists
            if (envContent.includes('SN_UPDATE_SET_API_PATH=')) {
                // Update existing
                envContent = envContent.replace(
                    /SN_UPDATE_SET_API_PATH=.*/,
                    `SN_UPDATE_SET_API_PATH=${apiPath}`
                );
            } else {
                // Add new
                envContent += `\n# UpdateSetHelper API path (auto-configured)\nSN_UPDATE_SET_API_PATH=${apiPath}\n`;
            }

            fs.writeFileSync(ENV_FILE_PATH, envContent);
            console.log(`   ✅ Saved: SN_UPDATE_SET_API_PATH=${apiPath}`);
            return true;
        } catch (e) {
            console.log(`   ⚠️  Could not save to .env: ${e.message}`);
            console.log(`   Please manually add: SN_UPDATE_SET_API_PATH=${apiPath}`);
            return false;
        }
    }

    /**
     * Check ACL configuration for the API
     */
    async checkAcl(apiSysId) {
        console.log('\n🔐 Checking ACL configuration...');

        try {
            // Check if there's a default ACL or explicit ACL for the API
            const result = await this.client.queryRecords(
                'sys_ws_definition',
                `sys_id=${apiSysId}`,
                ['default_acl']
            );

            if (result.result && result.result.length > 0) {
                const api = result.result[0];
                if (api.default_acl) {
                    console.log('   ✅ Default ACL is configured');
                    return { configured: true };
                }
            }
        } catch (e) {
            // Continue
        }

        console.log('   ⚠️  No Default ACL found - API may return 403 Forbidden');
        console.log('   📝 To fix: Go to the API definition → Security tab → Set Default ACLs');
        return { configured: false };
    }

    /**
     * Main setup function - deploys API if not exists
     */
    async setup() {
        console.log('═══════════════════════════════════════════════════════');
        console.log('  UpdateSetHelper API Setup');
        console.log('═══════════════════════════════════════════════════════\n');

        // Step 1: Check if API already exists
        const existing = await this.checkApiExists();

        if (existing.exists) {
            console.log('\n   API already exists on instance.');
            console.log('   📝 Get the full API path from ServiceNow:');
            console.log(`      Go to: ${this.client.instanceUrl}/sys_ws_definition_list.do`);
            console.log('      Find "UpdateSetHelper" → Note the "Base API path"');
            console.log('      Full path = Base API path + /set_current');
            console.log('\n   Then add to .env:');
            console.log('      SN_UPDATE_SET_API_PATH=<full_path>');
            return { exists: true, deployed: false };
        }

        // Step 2: Deploy the API
        const apiInfo = await this.deployApi();

        // Step 3: Check ACL
        await this.checkAcl(apiInfo.sysId);

        // Step 4: Save to .env
        this.saveApiPathToEnv(apiInfo.path);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  ✅ UpdateSetHelper API Deployed');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Full API Path: ${apiInfo.path}`);
        console.log(`Endpoint: POST ${this.client.instanceUrl}${apiInfo.path}`);
        console.log('Body: { "sys_id": "<update_set_sys_id>" }');

        return { exists: true, deployed: true, path: apiInfo.path };
    }
}

export default UpdateSetHelperSetup;

