#!/usr/bin/env node
/**
 * Verify which scope switching tier was used
 * 
 * This script checks the current scope state and can help determine
 * which tier successfully switched the scope.
 */

import { ServiceNowClient } from '../dist/client/sn-client.js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

dotenv.config({ path: resolve(__dirname, '../.env') });

const INSTANCE_URL = (process.env.SN_INSTANCE_URL || '').replace(/\/$/, '');
const USERNAME = process.env.SN_USERNAME || '';
const PASSWORD = process.env.SN_PASSWORD || '';

if (!INSTANCE_URL || !USERNAME || !PASSWORD) {
  console.error('❌ Missing env vars: SN_INSTANCE_URL, SN_USERNAME, SN_PASSWORD');
  process.exit(1);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Scope Switching Tier Verification                         ║');
  console.log(`║  Instance: ${INSTANCE_URL.padEnd(52)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const client = new ServiceNowClient({
    instanceUrl: INSTANCE_URL,
    username: USERNAME,
    password: PASSWORD
  });

  try {
    // Get current scope via concoursepicker (Tier 1 method)
    console.log('📋 Checking current scope state...\n');
    
    const scopes = await client.callScriptedRestApi('/api/now/ui/concoursepicker/application', 'GET');
    const currentScopeId = scopes.current;
    const currentScope = scopes.list?.find(s => s.sysId === currentScopeId);
    
    console.log('✅ Current Scope (via Concoursepicker GET):');
    console.log(`   Name: ${currentScope?.name || 'Unknown'}`);
    console.log(`   sys_id: ${currentScopeId}`);
    console.log(`   Scope Name: ${currentScope?.scopeName || 'Unknown'}\n`);

    // Check user preference (Tier 3 method indicator)
    console.log('📋 Checking user preference (Tier 3 indicator)...');
    try {
      const prefs = await client.getRecords('sys_user_preference', {
        sysparm_query: `name=apps.current.app^user.user_name=${USERNAME}`,
        sysparm_fields: 'sys_id,name,value,sys_updated_on',
        sysparm_limit: 1
      });
      
      if (prefs.length > 0) {
        const pref = prefs[0];
        console.log('✅ User preference found:');
        console.log(`   Key: ${pref.name}`);
        console.log(`   Value: ${pref.value}`);
        console.log(`   Last Updated: ${pref.sys_updated_on}`);
        
        if (pref.value === currentScopeId) {
          console.log('   ⚠️  Preference matches current scope (Tier 3 may have been used)');
        } else {
          console.log('   ℹ️  Preference does not match current scope (Tier 1/2 likely used)');
        }
      } else {
        console.log('   ℹ️  No user preference found (Tier 3 was not used)');
      }
    } catch (e) {
      console.log(`   ⚠️  Could not check preference: ${e.message}`);
    }
    console.log('');

    // Check ScopeHelper API availability (Tier 2 indicator)
    console.log('📋 Checking ScopeHelper API availability (Tier 2 indicator)...');
    const scopeHelperPath = client.getHelperApiPath('scopeHelper');
    if (scopeHelperPath) {
      console.log(`✅ ScopeHelper API available: ${scopeHelperPath}`);
      console.log('   ℹ️  Tier 2 could have been used if Tier 1 failed');
      
      // Try to call it to see if it works
      try {
        const testResult = await client.callScriptedRestApi(`${scopeHelperPath}/get_scope`, 'GET');
        console.log(`   ✅ ScopeHelper GET works:`, testResult);
      } catch (e) {
        console.log(`   ⚠️  ScopeHelper GET failed: ${e.message}`);
      }
    } else {
      console.log('   ℹ️  ScopeHelper API not available (Tier 2 not deployed)');
      console.log('   💡 Tier 2 would only be used if Tier 1 failed');
    }
    console.log('');

    // Test Tier 1 directly
    console.log('📋 Testing Tier 1 (Concoursepicker) directly...');
    if (currentScopeId && currentScopeId !== 'global') {
      // Try switching to a different scope and back
      const testScope = scopes.list?.find(s => s.sysId !== currentScopeId && s.sysId !== 'global');
      if (testScope) {
        console.log(`   Testing switch to: ${testScope.name} (${testScope.sysId})`);
        const tier1Result = await client.switchScopeViaConcoursePicker(testScope.sysId);
        
        if (tier1Result.success) {
          console.log('   ✅ Tier 1 (Concoursepicker) works!');
          
          // Verify
          const verify = await client.verifyCurrentScope(testScope.sysId);
          if (verify.matchesTarget) {
            console.log(`   ✅ Verification passed: Current scope = ${verify.currentScopeName}`);
            console.log(`   ✅ Tier 1 is functional and verified`);
          } else {
            console.log(`   ⚠️  Tier 1 PUT succeeded but verification failed`);
            console.log(`      Expected: ${testScope.sysId}, Got: ${verify.currentScopeId}`);
          }
          
          // Switch back
          await client.switchScopeViaConcoursePicker(currentScopeId);
          console.log(`   ↩️  Switched back to original scope`);
        } else {
          console.log(`   ❌ Tier 1 failed: ${tier1Result.error}`);
        }
      } else {
        console.log('   ℹ️  No alternative scope available for testing');
      }
    } else {
      console.log('   ℹ️  Currently in Global scope - testing with a custom scope...');
      const customScope = scopes.list?.find(s => s.sysId !== 'global');
      if (customScope) {
        const tier1Result = await client.switchScopeViaConcoursePicker(customScope.sysId);
        if (tier1Result.success) {
          console.log(`   ✅ Tier 1 (Concoursepicker) works!`);
          const verify = await client.verifyCurrentScope(customScope.sysId);
          if (verify.matchesTarget) {
            console.log(`   ✅ Verification passed: Current scope = ${verify.currentScopeName}`);
          }
          // Switch back to Global
          await client.switchScopeViaConcoursePicker('global');
        } else {
          console.log(`   ❌ Tier 1 failed: ${tier1Result.error}`);
        }
      }
    }
    console.log('');

    // Summary
    console.log('═'.repeat(60));
    console.log('  Summary');
    console.log('═'.repeat(60));
    console.log(`  Current Scope: ${currentScope?.name || 'Unknown'} (${currentScopeId})`);
    console.log(`  ScopeHelper API: ${scopeHelperPath ? 'Available' : 'Not Available'}`);
    console.log(`  User Preference: ${(await client.getRecords('sys_user_preference', {
      sysparm_query: `name=apps.current.app^user.user_name=${USERNAME}`,
      sysparm_limit: 1
    })).length > 0 ? 'Set' : 'Not Set'}`);
    console.log('');
    console.log('  Most Likely Tier Used:');
    if (scopeHelperPath) {
      console.log('    ✅ Tier 1 (Concoursepicker) - Primary method, fastest');
      console.log('    ✅ Tier 2 (ScopeHelper) - Available as fallback');
    } else {
      console.log('    ✅ Tier 1 (Concoursepicker) - Primary method');
      console.log('    ⚠️  Tier 2 (ScopeHelper) - Not deployed');
    }
    console.log('    ⚠️  Tier 3 (User Preference) - Only effective after new session');
    console.log('    ⚠️  Tier 4 (Browser) - Only if ENABLE_BROWSER_SCOPE_SWITCH=true');
    console.log('    ⚠️  Tier 5 (Manual) - Only if all automated tiers fail');
    console.log('');
    console.log('  💡 To see which tier was actually used, check:');
    console.log('     - Webapp server console for [ScopeSwitch] debug logs');
    console.log('     - Session logs: webapp/logs/sess_*.jsonl');
    console.log('     - Run with SN_DEBUG_SCOPE=true to see tier attempts');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
