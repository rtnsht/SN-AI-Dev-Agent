#!/usr/bin/env node
/**
 * Discover all available scopes on the ServiceNow instance
 */

import * as dotenv from 'dotenv';
import { ScopeManager } from './lib/scope-manager.js';

dotenv.config();

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  ServiceNow Scope Discovery                                ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const instanceUrl = process.env.SN_INSTANCE_URL;
    const auth = { 
        username: process.env.SN_USERNAME, 
        password: process.env.SN_PASSWORD 
    };

    const scopeManager = new ScopeManager(instanceUrl, auth);
    const scopes = await scopeManager.discoverScopes();

    // Filter to show relevant scopes (global, custom apps, ITSM/ITOM)
    const relevantScopes = scopes.filter(s =>
        s.scope === 'global' ||
        s.scope.startsWith('x_') ||  // Custom apps
        s.scope.startsWith('sn_itsm') ||
        s.scope.startsWith('sn_incident') ||
        s.scope.startsWith('com.snc') ||
        s.name.toLowerCase().includes('itsm') ||
        s.name.toLowerCase().includes('incident')
    );

    console.log(`Found ${scopes.length} total scopes, ${relevantScopes.length} relevant:\n`);

    // Always show Global first
    console.log('━━━ Key Scopes for Development ━━━\n');
    console.log('| Scope ID | Name | Description |');
    console.log('|----------|------|-------------|');
    console.log('| global | Global | Default scope for platform customizations |');

    for (const scope of relevantScopes.filter(s => s.scope !== 'global')) {
        const desc = (scope.description || '').substring(0, 40);
        console.log(`| ${scope.scope} | ${scope.name} | ${desc} |`);
    }

    // Show custom apps if any
    const customApps = scopes.filter(s => s.scope.startsWith('x_'));
    if (customApps.length > 0) {
        console.log('\n━━━ Custom Scoped Apps ━━━\n');
        for (const scope of customApps) {
            console.log(`  ${scope.scope}: ${scope.name}`);
        }
    } else {
        console.log('\n━━━ No Custom Scoped Apps Found ━━━\n');
        console.log('  All deployments will use Global scope by default.');
    }

    // Output for REQUIREMENTS.md
    console.log('\n━━━ Copy to REQUIREMENTS.md ━━━\n');
    console.log('| Scope ID | Name | Update Set |');
    console.log('|----------|------|------------|');
    console.log('| global | Global | (Default or create new) |');
    for (const scope of customApps) {
        console.log(`| ${scope.scope} | ${scope.name} | (create as needed) |`);
    }

    // Check current user's update set preference
    console.log('\n━━━ Current User Update Set ━━━\n');
    const userPrefs = await scopeManager.query('sys_user_preference', {
        sysparm_query: 'user=' + process.env.SN_USERNAME + '^name=sys_update_set',
        sysparm_fields: 'value',
        sysparm_limit: 1
    });
    
    if (userPrefs.length > 0) {
        const currentUS = await scopeManager.query('sys_update_set', {
            sysparm_query: 'sys_id=' + userPrefs[0].value,
            sysparm_fields: 'name,application',
            sysparm_display_value: 'all',
            sysparm_limit: 1
        });
        if (currentUS.length > 0) {
            console.log(`Current Update Set: ${currentUS[0].name}`);
            console.log(`Application: ${currentUS[0].application?.display_value || 'Global'}`);
        }
    } else {
        console.log('No update set preference found (using Default)');
    }
}

main().catch(err => {
    console.error('Error:', err.response?.data || err.message);
});

