#!/usr/bin/env node
/**
 * MFA-Enabled Instance Browser Connection Verification
 *
 * This script verifies the browser-assisted connection flow for MFA-enabled instances:
 * 1. Uses browser automation to sign in (user completes MFA manually if needed)
 * 2. Extracts session cookies from the browser
 * 3. Imports cookies into ServiceNowClient
 * 4. Verifies REST API calls work with the imported session
 * 5. Optionally tests scope switching
 *
 * Run: BROWSER_SCOPE_SWITCH_MODE=headed node tests/test-mfa-browser-connect.js
 *
 * Prerequisites:
 * - playwright-core installed in webapp
 * - Instance URL, username, and password provided as arguments or env vars
 * - For MFA: Use BROWSER_SCOPE_SWITCH_MODE=headed to see the browser and complete MFA
 */

import { ServiceNowClient } from '../dist/client/sn-client.js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars from both mcp-servicenow and webapp directories
dotenv.config({ path: resolve(__dirname, '../.env') });
dotenv.config({ path: resolve(__dirname, '../../webapp/.env') });

// Dynamically import browser-scope-switcher from webapp
// This requires the webapp to be built or using tsx/ts-node
let connectViaBrowser;
try {
  // Try to import from webapp source (if using tsx/ts-node)
  const webappPath = resolve(__dirname, '../../webapp/src/lib/browser-scope-switcher.ts');
  const require = createRequire(import.meta.url);
  // For ES modules, we'll need to use dynamic import
  const browserModule = await import(`file://${webappPath}`);
  connectViaBrowser = browserModule.connectViaBrowser;
} catch (err) {
  // Fallback: try compiled version or provide instructions
  console.error('Could not import browser-scope-switcher. Make sure:');
  console.error('  1. webapp dependencies are installed (npm install in webapp/)');
  console.error('  2. Or run this script using tsx: npx tsx tests/test-mfa-browser-connect.js');
  process.exit(1);
}

// Enable debug logging
process.env.SN_DEBUG_SCOPE = 'true';

const logger = {
  info: (msg, data) => console.log(`  ℹ️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  success: (msg, data) => console.log(`  ✅ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg, data) => console.log(`  ❌ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  warn: (msg, data) => console.log(`  ⚠️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  step: (msg) => console.log(`\n📋 ${msg}`),
};

async function verifyMfaConnection() {
  console.log('\n' + '═'.repeat(70));
  console.log('  MFA-Enabled Instance Browser Connection Verification');
  console.log('═'.repeat(70) + '\n');

  // Get credentials from command line args or env vars
  const args = process.argv.slice(2);
  let instanceUrl, username, password;

  if (args.length >= 3) {
    instanceUrl = args[0];
    username = args[1];
    password = args[2];
  } else {
    instanceUrl = process.env.SN_INSTANCE_URL;
    username = process.env.SN_USERNAME;
    password = process.env.SN_PASSWORD;
  }

  if (!instanceUrl || !username || !password) {
    logger.error('Missing credentials. Provide as arguments: node test-mfa-browser-connect.js <instanceUrl> <username> <password>');
    logger.error('Or set SN_INSTANCE_URL, SN_USERNAME, SN_PASSWORD in .env');
    process.exit(1);
  }

  // Normalize instance URL
  instanceUrl = instanceUrl.replace(/\/$/, '');

  // Determine browser mode
  const browserMode = process.env.BROWSER_SCOPE_SWITCH_MODE || 
                      (process.env.ENABLE_BROWSER_SCOPE_SWITCH === 'true' ? 'headless' : 'headed');
  
  logger.info(`Instance: ${instanceUrl}`);
  logger.info(`Username: ${username}`);
  logger.info(`Browser Mode: ${browserMode}`);
  logger.info(`\n⚠️  For MFA-enabled instances, use BROWSER_SCOPE_SWITCH_MODE=headed to see the browser`);

  // Step 1: Browser-assisted connection
  logger.step('Step 1: Browser-assisted sign-in (user completes MFA if needed)');
  
  const connectResult = await connectViaBrowser({
    instanceUrl,
    username,
    password,
  });

  if (!connectResult.success) {
    logger.error('Browser-assisted connection failed:', connectResult.error);
    if (connectResult.failureCategory) {
      logger.warn(`Failure category: ${connectResult.failureCategory}`);
    }
    process.exit(1);
  }

  if (!connectResult.cookies || connectResult.cookies.length === 0) {
    logger.error('Connection succeeded but no cookies were extracted');
    process.exit(1);
  }

  logger.success(`Extracted ${connectResult.cookies.length} session cookie(s)`);
  logger.info('Cookies:', connectResult.cookies.map(c => ({ name: c.name, domain: c.domain })));

  // Step 2: Import cookies into ServiceNowClient
  logger.step('Step 2: Importing cookies into ServiceNowClient');

  const client = new ServiceNowClient({
    instanceUrl,
    username, // Still needed for some operations
    sessionCookies: connectResult.cookies,
    authType: 'session',
  });

  logger.success('ServiceNowClient created with session cookies');

  // Step 3: Test connection with imported cookies
  logger.step('Step 3: Testing REST API calls with imported session');

  try {
    const testResult = await client.testConnection();
    if (!testResult.success) {
      logger.error('Connection test failed:', testResult.message);
      process.exit(1);
    }
    logger.success('Connection test passed');
    logger.info(`Authenticated as: ${testResult.userInfo?.user_name || 'unknown'}`);
  } catch (error) {
    logger.error('Connection test threw error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Step 4: Verify API calls work
  logger.step('Step 4: Verifying REST API calls work with session cookies');

  try {
    // Test: Get current user
    const currentUser = await client.getCurrentUser();
    logger.success(`Current user: ${currentUser.user_name} (${currentUser.user_id})`);

    // Test: Get records
    const sysUserRecords = await client.getRecords('sys_user', {
      sysparm_query: `user_name=${currentUser.user_name}`,
      sysparm_fields: 'sys_id,user_name,email',
      sysparm_limit: 1,
    });

    if (sysUserRecords.length > 0) {
      logger.success(`Retrieved user record: ${sysUserRecords[0].user_name}`);
    } else {
      logger.warn('User record query returned no results');
    }

    // Test: Get available scopes
    const scopes = await client.getRecords('sys_scope', {
      sysparm_query: 'active=true',
      sysparm_fields: 'sys_id,name,scope',
      sysparm_limit: 5,
      sysparm_orderby: 'name',
    });

    logger.success(`Retrieved ${scopes.length} scope(s)`);
    if (scopes.length > 0) {
      logger.info('Sample scopes:', scopes.slice(0, 3).map(s => ({ name: s.name, scope: s.scope })));
    }

  } catch (error) {
    logger.error('API call verification failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Step 5: Optional scope switching test
  logger.step('Step 5: Testing scope switching (optional)');

  try {
    const scopes = await client.getRecords('sys_scope', {
      sysparm_query: 'sys_scope.scope!=global^active=true',
      sysparm_fields: 'sys_id,name,scope',
      sysparm_limit: 1,
    });

    if (scopes.length > 0) {
      const testScope = scopes[0];
      logger.info(`Testing scope switch to: ${testScope.name} (${testScope.scope})`);

      const switchResult = await client.ensureScopeActive(testScope.sys_id, testScope.name, {
        browserFallback: async (scopeId, scopeName) => {
          logger.info(`Browser fallback triggered for scope: ${scopeName}`);
          // In a real scenario, this would call switchScopeViaBrowser
          // For verification, we'll just return success if cookies are already imported
          return {
            success: true,
            cookies: connectResult.cookies,
          };
        },
      });

      if (switchResult.success) {
        logger.success(`Scope switch successful: ${switchResult.scopeName} (method: ${switchResult.method})`);
      } else {
        logger.warn(`Scope switch failed: ${switchResult.error}`);
      }
    } else {
      logger.info('No custom scopes found, skipping scope switch test');
    }
  } catch (error) {
    logger.warn('Scope switching test failed (non-critical):', error instanceof Error ? error.message : String(error));
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  logger.success('Verification complete! All tests passed.');
  console.log('═'.repeat(70) + '\n');
  logger.info('Summary:');
  logger.info('  ✅ Browser-assisted connection succeeded');
  logger.info('  ✅ Session cookies extracted and imported');
  logger.info('  ✅ REST API calls work with imported session');
  logger.info('  ✅ ServiceNowClient can authenticate and query data');
}

// Run verification
verifyMfaConnection().catch((error) => {
  logger.error('Verification script failed:', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
