#!/usr/bin/env node
/**
 * Tier 4 Browser Automation Test
 * 
 * Run from webapp directory: ENABLE_BROWSER_SCOPE_SWITCH=true node test-tier4-browser.js
 * 
 * This tests the browser-scope-switcher directly from the webapp context.
 */

import { switchScopeViaBrowser } from './src/lib/browser-scope-switcher.ts';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

// Enable debug logging
process.env.SN_DEBUG_SCOPE = 'true';
process.env.ENABLE_BROWSER_SCOPE_SWITCH = 'true';

const logger = {
  info: (msg) => console.log(`  ℹ️  ${msg}`),
  success: (msg) => console.log(`  ✅ ${msg}`),
  error: (msg) => console.log(`  ❌ ${msg}`),
  warn: (msg) => console.log(`  ⚠️  ${msg}`),
  step: (msg) => console.log(`\n📋 ${msg}`),
};

async function testTier4() {
  console.log('\n' + '═'.repeat(70));
  console.log('  Tier 4 Browser Automation Test');
  console.log('═'.repeat(70) + '\n');

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

  // Get a test scope
  logger.step('Step 1: Getting test scope');
  // For this test, we'll use a known scope ID - you can modify this
  const testScopeId = process.env.TEST_SCOPE_ID || '00349185770223005d7b3882a910619d'; // NLU Studio
  const testScopeName = process.env.TEST_SCOPE_NAME || 'NLU Studio';
  
  logger.info(`Using test scope: ${testScopeName} (${testScopeId})`);
  logger.info('You can override with TEST_SCOPE_ID and TEST_SCOPE_NAME env vars');

  // Test browser automation
  logger.step('Step 2: Testing browser automation');
  logger.info('This will launch a headless browser, log in, and switch scope...');
  logger.info('Note: This may take 10-30 seconds.');
  logger.warn('This test requires:');
  logger.warn('  - No MFA/SSO on the instance');
  logger.warn('  - playwright-core installed');
  logger.warn('  - Network access to the instance');

  try {
    const startTime = Date.now();
    const result = await switchScopeViaBrowser(
      { instanceUrl, username, password },
      testScopeId,
      testScopeName
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (result.success) {
      logger.success(`Browser automation succeeded in ${duration}s`);
      logger.success(`Scope switched to: ${testScopeName}`);
    } else {
      logger.error(`Browser automation failed: ${result.error}`);
      logger.warn('Common reasons:');
      logger.warn('  - MFA/SSO detected (browser automation cannot handle this)');
      logger.warn('  - playwright-core not installed');
      logger.warn('  - Network/connectivity issues');
      logger.warn('  - Instance URL not in allowlist');
      process.exit(1);
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    logger.success('Tier 4 Browser Test PASSED');
    console.log('═'.repeat(70));
    console.log(`\n  Duration: ${duration}s`);
    console.log(`  Scope: ${testScopeName} (${testScopeId})`);
    console.log(`\n  Note: This test only verifies browser automation works.`);
    console.log(`        To test full Tier 4 integration, use the mcp-servicenow test script.`);
    console.log('');

  } catch (error) {
    logger.error('Test failed with exception:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testTier4().catch(console.error);
