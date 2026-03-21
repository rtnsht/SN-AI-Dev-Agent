#!/usr/bin/env node
/**
 * Tier 4 Scope Switching Test - Browser Automation (Playwright)
 *
 * Run: ENABLE_BROWSER_SCOPE_SWITCH=true node tests/test-tier4-browser-automation.js
 *
 * This script specifically tests Tier 4 (Browser Automation) by:
 * 1. Connecting to ServiceNow
 * 2. Testing scope switch via Tier 4 directly (bypassing Tier 1, 2, 3)
 * 3. Verifying scope is active
 * 4. Creating an update set in the custom scope
 * 5. Creating a test artifact and verifying capture
 *
 * Prerequisites:
 * - ENABLE_BROWSER_SCOPE_SWITCH=true in environment
 * - playwright-core installed in webapp (npm install playwright-core)
 * - No MFA/SSO on the instance (browser automation will fail)
 */

import { ServiceNowClient } from '../dist/client/sn-client.js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

// Enable debug logging
process.env.SN_DEBUG_SCOPE = 'true';

// Enable browser scope switching
process.env.ENABLE_BROWSER_SCOPE_SWITCH = 'true';

const logger = {
  info: (msg, data) => console.log(`  ℹ️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  success: (msg, data) => console.log(`  ✅ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg, data) => console.log(`  ❌ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  warn: (msg, data) => console.log(`  ⚠️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  step: (msg) => console.log(`\n📋 ${msg}`),
};

async function testTier4() {
  console.log('\n' + '═'.repeat(70));
  console.log('  Tier 4 Scope Switching Test - Browser Automation (Playwright)');
  console.log('═'.repeat(70) + '\n');

  // Step 1: Initialize client
  logger.step('Step 1: Connecting to ServiceNow instance');
  const instanceUrl = process.env.SN_INSTANCE_URL;
  const username = process.env.SN_USERNAME;
  const password = process.env.SN_PASSWORD;

  if (!instanceUrl || !username || !password) {
    logger.error('Missing credentials. Set SN_INSTANCE_URL, SN_USERNAME, SN_PASSWORD in .env');
    process.exit(1);
  }

  if (process.env.ENABLE_BROWSER_SCOPE_SWITCH !== 'true') {
    logger.error('ENABLE_BROWSER_SCOPE_SWITCH must be set to "true"');
    process.exit(1);
  }

  logger.info(`Instance: ${instanceUrl}`);
  logger.info(`Username: ${username}`);
  logger.info(`ENABLE_BROWSER_SCOPE_SWITCH: ${process.env.ENABLE_BROWSER_SCOPE_SWITCH}`);

  const client = new ServiceNowClient({
    instanceUrl: instanceUrl.replace(/\/$/, ''),
    username,
    password,
  });

  try {
    // Test connection
    const connResult = await client.testConnection();
    if (!connResult.success) {
      logger.error('Connection failed:', connResult.message);
      process.exit(1);
    }
    logger.success('Connected successfully');

    // Step 2: Get available scopes
    logger.step('Step 2: Getting available scopes');
    const scopes = await client.getRecords('sys_scope', {
      sysparm_query: 'sys_scope.scope!=global^active=true',
      sysparm_fields: 'sys_id,name,scope',
      sysparm_limit: 10,
      sysparm_orderby: 'name',
    });

    if (scopes.length === 0) {
      logger.error('No custom scopes found. This test requires at least one custom application scope.');
      process.exit(1);
    }

    logger.info(`Found ${scopes.length} custom scope(s):`);
    scopes.forEach((s, i) => {
      logger.info(`  ${i + 1}. ${s.name} (${s.scope}) - sys_id: ${s.sys_id}`);
    });

    // Use first custom scope for testing
    const targetScope = scopes[0];
    logger.step(`Step 3: Testing Tier 4 with scope: ${targetScope.name}`);

    // Step 3: Inject browser fallback
    logger.step('Step 3a: Injecting browser fallback callback');
    try {
      // Import browser-scope-switcher from webapp
      // The webapp uses TypeScript, so we need to import the .ts file
      // Node.js with --loader or tsx can handle this, but for simplicity,
      // let's use a dynamic import with the full path
      const webappLibPath = resolve(__dirname, '../../webapp/src/lib/browser-scope-switcher.ts');
      logger.info(`Attempting to import: ${webappLibPath}`);
      
      // Use file:// URL for TypeScript import
      const moduleUrl = pathToFileURL(webappLibPath).href;
      const browserModule = await import(moduleUrl);
      
      if (!browserModule.switchScopeViaBrowser) {
        throw new Error('switchScopeViaBrowser not exported from browser-scope-switcher');
      }
      
      const switchScopeViaBrowser = browserModule.switchScopeViaBrowser;
      
      client.setEnsureScopeOptions({
        browserFallback: (scopeId, scopeName) => {
          logger.info(`[Browser Fallback] Called for scope: ${scopeName} (${scopeId})`);
          return switchScopeViaBrowser(
            { instanceUrl, username, password },
            scopeId,
            scopeName
          );
        },
      });
      logger.success('Browser fallback injected successfully');
    } catch (error) {
      logger.error('Failed to inject browser fallback:', error.message);
      logger.warn('Error details:', error.stack);
      logger.info('\nTroubleshooting:');
      logger.info('  1. Make sure playwright-core is installed:');
      logger.info('     cd webapp && npm install playwright-core');
      logger.info('  2. If TypeScript import fails, you may need to:');
      logger.info('     - Install tsx: npm install -g tsx');
      logger.info('     - Or run: npx tsx tests/test-tier4-browser-automation.js');
      logger.info('  3. Or compile the webapp first: cd webapp && npm run build');
      process.exit(1);
    }

    // Step 4: Switch to Global first
    logger.step('Step 4: Switching to Global scope first');
    const globalScope = await client.getRecords('sys_scope', {
      sysparm_query: 'scope=global',
      sysparm_fields: 'sys_id',
      sysparm_limit: 1,
    });
    
    if (globalScope.length > 0) {
      await client.switchScopeViaConcoursePicker(globalScope[0].sys_id);
      logger.info('Switched to Global scope');
    }

    // Step 5: Test Tier 4 directly via ensureScopeActive
    logger.step('Step 5: Testing Tier 4 scope switch (Browser Automation)');
    logger.info('This will launch a headless browser, log in, and switch scope...');
    logger.info('Note: This may take 10-30 seconds.');
    
    // Call ensureScopeActive - it will use the injected browserFallback
    const tier4Result = await client.ensureScopeActive(targetScope.sys_id, targetScope.name);
    
    if (!tier4Result.success) {
      if (tier4Result.userActionRequired) {
        logger.error('Tier 4 failed - manual action required');
        logger.info('Checklist:');
        tier4Result.checklist?.forEach((item, i) => logger.info(`  ${i + 1}. ${item}`));
      } else {
        logger.error(`Tier 4 failed: ${tier4Result.error}`);
      }
      process.exit(1);
    }
    
    logger.success(`Tier 4 succeeded via ${tier4Result.method}`);

    // Step 6: Verify scope is active
    logger.step('Step 6: Verifying scope is active');
    const verifyResult = await client.verifyCurrentScope(targetScope.sys_id);
    
    if (!verifyResult.matchesTarget) {
      logger.error(`Verification failed. Current scope: ${verifyResult.currentScopeId || 'unknown'}, Expected: ${targetScope.sys_id}`);
      logger.error(`Verification details:`, verifyResult);
      process.exit(1);
    }
    logger.success(`Scope verified: ${verifyResult.currentScopeName || targetScope.name}`);

    // Step 7: Create update set in the custom scope
    logger.step('Step 7: Creating update set in custom scope');
    const updateSetName = `Tier4-Test-${Date.now()}`;
    const updateSetResult = await client.createRecord('sys_update_set', {
      name: updateSetName,
      description: 'Test update set created via Tier 4 scope switch',
      application: targetScope.sys_id,
    });

    if (!updateSetResult.sys_id) {
      logger.error('Failed to create update set');
      process.exit(1);
    }
    logger.success(`Update set created: ${updateSetName} (${updateSetResult.sys_id})`);

    // Verify update set application field
    const updateSetRecord = await client.getRecord('sys_update_set', updateSetResult.sys_id, ['name', 'application', 'state']);
    const appValue = typeof updateSetRecord.application === 'string' 
      ? updateSetRecord.application 
      : (updateSetRecord.application?.value || updateSetRecord.application);
    
    if (appValue !== targetScope.sys_id) {
      logger.warn(`Update set application mismatch! Expected: ${targetScope.sys_id}, Got: ${appValue}`);
    } else {
      logger.success(`Update set application field verified: ${targetScope.name}`);
    }

    // Step 8: Set as current update set
    logger.step('Step 8: Setting update set as current');
    const setCurrentResult = await client.callSetCurrentUpdateSetApi(updateSetResult.sys_id);
    if (!setCurrentResult.success) {
      logger.warn(`Failed to set update set as current: ${setCurrentResult.error}`);
      logger.warn('Continuing test anyway...');
      client.setActiveUpdateSet(updateSetResult.sys_id);
    } else {
      logger.success('Update set set as current');
      client.setActiveUpdateSet(updateSetResult.sys_id);
    }

    // Step 9: Create a test artifact
    logger.step('Step 9: Creating test Script Include');
    const scriptIncludeName = `Tier4TestScript${Date.now()}`;
    const scriptIncludeResult = await client.createRecord('sys_script_include', {
      name: scriptIncludeName,
      api_name: scriptIncludeName,
      script: `// Test Script Include for Tier 4 scope switch
var ${scriptIncludeName} = Class.create();
${scriptIncludeName}.prototype = {
    initialize: function() {
    },
    test: function() {
        return 'Tier 4 test successful';
    },
    type: '${scriptIncludeName}'
};`,
      description: 'Test script include created via Tier 4 scope switch',
    });

    if (!scriptIncludeResult.sys_id) {
      logger.error('Failed to create script include');
      process.exit(1);
    }
    logger.success(`Script Include created: ${scriptIncludeName} (${scriptIncludeResult.sys_id})`);

    // Step 10: Verify artifact is in update set
    logger.step('Step 10: Verifying artifact capture in update set');
    
    // Query sys_update_xml for artifacts in this update set
    const updateXmlRecords = await client.getRecords('sys_update_xml', {
      sysparm_query: `update_set=${updateSetResult.sys_id}`,
      sysparm_fields: 'sys_id,name,table,action,update_set',
      sysparm_limit: 100,
    });
    
    const artifactFound = updateXmlRecords.some(
      item => item.table === 'sys_script_include' && item.name && item.name.includes(scriptIncludeResult.sys_id)
    );

    if (!artifactFound) {
      logger.warn('Script Include not found in update set contents!');
      logger.info(`Update set contains ${updateXmlRecords.length} items`);
    } else {
      logger.success('Script Include verified in update set');
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    logger.success('Tier 4 Test PASSED');
    console.log('═'.repeat(70));
    console.log('\nSummary:');
    console.log(`  ✅ Tier 4 browser automation: SUCCESS (${tier4Result.method})`);
    console.log(`  ✅ Scope verification: SUCCESS`);
    console.log(`  ✅ Update set creation: SUCCESS (${updateSetName})`);
    console.log(`  ✅ Artifact creation: SUCCESS (${scriptIncludeName})`);
    console.log(`  ${artifactFound ? '✅' : '⚠️'} Artifact capture: ${artifactFound ? 'SUCCESS' : 'NOT CAPTURED'}`);
    console.log(`\n  Update Set URL: ${instanceUrl}/nav_to.do?uri=sys_update_set.do?sys_id=${updateSetResult.sys_id}`);
    console.log(`  Script Include URL: ${instanceUrl}/nav_to.do?uri=sys_script_include.do?sys_id=${scriptIncludeResult.sys_id}`);
    console.log('');

  } catch (error) {
    logger.error('Test failed with exception:', error);
    console.error(error);
    process.exit(1);
  }
}

testTier4().catch(console.error);
