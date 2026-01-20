#!/usr/bin/env node
/**
 * Deployment Script for REQ-003: High Impact Incident Justification
 * 
 * Uses DeploymentHelper for:
 * - Update set creation and setting as current
 * - Idempotent artifact deployment
 * - Clean naming (noun+verb, no requirement IDs)
 * 
 * Run: node deploy/deploy-req-003.js
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DeploymentHelper } from '../src/deployer/DeploymentHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const config = {
    instanceUrl: process.env.SN_INSTANCE_URL,
    username: process.env.SN_USERNAME,
    password: process.env.SN_PASSWORD
};

const IMPL_PATH = path.join(__dirname, '../../requirements/REQ-003/3-implementation');

async function deploy() {
    const deployer = new DeploymentHelper(config);
    const results = {};

    try {
        // Initialize with update set (sets as current BEFORE any artifact creation)
        await deployer.initialize(
            'High Impact Justification Feature',
            'REQ-003: Captures justification for high impact incidents'
        );

        // 1. Custom Field
        console.log('1️⃣  Custom Field...');
        const field = await deployer.deploy('sys_dictionary',
            'u_high_impact_justification',
            {
                name: 'incident',
                element: 'u_high_impact_justification',
                column_label: 'High Impact Justification',
                internal_type: 'string',
                max_length: 1000,
                active: true,
                comments: 'Captures justification when incident impact is set to High'
            },
            { queryField: 'element', displayName: 'u_high_impact_justification' }
        );
        results.field = field.sys_id;

        // 2. Script Include
        console.log('2️⃣  Script Include...');
        const siCode = fs.readFileSync(
            path.join(IMPL_PATH, 'script-includes/HighImpactJustificationUtil.js'), 'utf8'
        );
        const si = await deployer.deploy('sys_script_include', 'HighImpactJustificationUtil', {
            name: 'HighImpactJustificationUtil',
            api_name: 'global.HighImpactJustificationUtil',
            script: siCode,
            client_callable: false,
            active: true,
            access: 'public',
            description: 'Utility for high impact justification validation'
        });
        results.scriptInclude = si.sys_id;

        // 3. Business Rule
        console.log('3️⃣  Business Rule...');
        const brCode = fs.readFileSync(
            path.join(IMPL_PATH, 'business-rules/ValidateHighImpactJustification.js'), 'utf8'
        );
        const br = await deployer.deploy('sys_script', 'ValidateHighImpactJustification', {
            name: 'ValidateHighImpactJustification',
            collection: 'incident',
            script: brCode,
            when: 'before',
            action_insert: true,
            action_update: true,
            active: true,
            order: 100,
            description: 'Validates high impact justification'
        });
        results.businessRule = br.sys_id;

        // 4. Client Script
        console.log('4️⃣  Client Script...');
        const csCode = fs.readFileSync(
            path.join(IMPL_PATH, 'client-scripts/HandleHighImpactChange.js'), 'utf8'
        );
        const cs = await deployer.deploy('sys_script_client', 'HandleHighImpactChange', {
            name: 'HandleHighImpactChange',
            table: 'incident',
            script: csCode,
            type: 'onChange',
            field_name: 'impact',
            active: true,
            ui_type: '0',
            description: 'Shows justification field and warning when impact is High'
        });
        results.clientScript = cs.sys_id;

        // 5. UI Policy
        console.log('5️⃣  UI Policy...');
        const up = await deployer.deploy('sys_ui_policy', 'HighImpactFieldBehavior', {
            short_description: 'HighImpactFieldBehavior',
            table: 'incident',
            conditions: 'impact=1',
            reverse_if_false: true,
            on_load: true,
            active: true,
            order: 100,
            global: true
        }, { queryField: 'short_description' });
        results.uiPolicy = up.sys_id;

        // 6. UI Policy Actions (if UI Policy created)
        if (up.sys_id) {
            console.log('6️⃣  UI Policy Actions...');
            const action1 = await deployer.deploy('sys_ui_policy_action', 
                `${up.sys_id}-justification`,
                {
                    ui_policy: up.sys_id,
                    field: 'u_high_impact_justification',
                    visible: 'true',
                    mandatory: 'true',
                    disabled: 'false'
                },
                { queryField: 'ui_policy', displayName: 'Action: justification visible/mandatory' }
            );
            results.uiPolicyAction1 = action1.sys_id;

            const action2 = await deployer.deploy('sys_ui_policy_action',
                `${up.sys_id}-urgency`,
                {
                    ui_policy: up.sys_id,
                    field: 'urgency',
                    visible: 'true',
                    mandatory: 'false',
                    disabled: 'true'
                },
                { queryField: 'ui_policy', displayName: 'Action: urgency read-only' }
            );
            results.uiPolicyAction2 = action2.sys_id;
        }

        // 7. Event
        console.log('7️⃣  Event...');
        const event = await deployer.deploy('sysevent_register', 'incident.high_impact.notify', {
            event_name: 'incident.high_impact.notify',
            table: 'incident',
            suffix: 'high_impact_notify',
            description: 'Triggered when incident is saved with High Impact',
            queue: 'event.queue'
        }, { queryField: 'event_name' });
        results.event = event.sys_id;

        // 8. Notification
        console.log('8️⃣  Notification...');
        const notif = await deployer.deploy('sysevent_email_action', 'NotifyHighImpactIncident', {
            name: 'NotifyHighImpactIncident',
            event_name: 'incident.high_impact.notify',
            collection: 'incident',
            subject: 'HIGH IMPACT Incident: ${number} - ${short_description}',
            message_html: fs.readFileSync(
                path.join(IMPL_PATH, 'notifications/NotifyHighImpactIncident.json'), 'utf8'
            ).match(/"message_html":\s*"([^"]+)"/)?.[1] || '',
            send_self: false,
            active: true,
            recipient_fields: 'assignment_group',
            content_type: 'text/html',
            description: 'Sends email to assignment group for high impact incidents'
        });
        results.notification = notif.sys_id;

        // Summary
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('✅ DEPLOYMENT COMPLETE');
        console.log('═══════════════════════════════════════════════════════════════\n');
        console.log('📝 Deployed Artifacts:');
        Object.entries(results).forEach(([key, val]) => {
            console.log(`   • ${key}: ${val || 'SKIPPED'}`);
        });
        console.log('\n🎉 No manual steps required!\n');

        // Save results
        const resultsPath = path.join(IMPL_PATH, 'deployment-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify({
            ...deployer.getResults(),
            ...results,
            deployedAt: new Date().toISOString()
        }, null, 2));
        console.log(`📄 Results saved to ${resultsPath}\n`);

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        if (error.response?.data) {
            console.error('   Details:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

deploy();

