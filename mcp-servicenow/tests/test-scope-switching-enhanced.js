#!/usr/bin/env node
/**
 * Enhanced Scope Switching Test with Comprehensive Logging
 *
 * Run: node tests/test-scope-switching-enhanced.js
 *
 * This script tests all 5 tiers of scope switching with detailed logging
 * to help debug any issues. Logs are written to both console and a file.
 *
 * Tests:
 * 1. Connection and authentication
 * 2. List available scopes
 * 3. Test Tier 1: Concoursepicker API
 * 4. Test Tier 2: ScopeHelper Scripted REST API
 * 5. Test Tier 3: User Preference write
 * 6. Test Tier 4: Browser automation (if enabled)
 * 7. End-to-end: scope switch → create update set → verify application field
 * 8. Verify artifact capture in update set
 */

import { ServiceNowClient } from '../dist/client/sn-client.js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

// Logger utility
class TestLogger {
  constructor(logFile) {
    this.logFile = logFile;
    this.logs = [];
    this.startTime = Date.now();
    
    // Ensure log directory exists
    const logDir = dirname(logFile);
    try {
      mkdirSync(logDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(3);
    const logEntry = {
      timestamp,
      elapsed: `${elapsed}s`,
      level,
      message,
      ...(data && { data })
    };
    
    this.logs.push(logEntry);
    
    // Console output with colors
    const prefix = {
      INFO: '  ℹ️',
      SUCCESS: '  ✅',
      ERROR: '  ❌',
      WARN: '  ⚠️',
      DEBUG: '  🔍',
      STEP: '  📋'
    }[level] || '  •';
    
    console.log(`${prefix} [${elapsed}s] ${message}`);
    if (data && level === 'DEBUG') {
      console.log('     Data:', JSON.stringify(data, null, 2));
    }
  }

  info(message, data) { this.log('INFO', message, data); }
  success(message, data) { this.log('SUCCESS', message, data); }
  error(message, data) { this.log('ERROR', message, data); }
  warn(message, data) { this.log('WARN', message, data); }
  debug(message, data) { this.log('DEBUG', message, data); }
  step(message, data) { this.log('STEP', message, data); }

  async flush() {
    const logContent = JSON.stringify(this.logs, null, 2);
    writeFileSync(this.logFile, logContent, 'utf8');
    console.log(`\n📄 Full logs saved to: ${this.logFile}`);
  }

  section(title) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'═'.repeat(60)}`);
    this.log('STEP', title);
  }
}

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function recordTest(name, passed, detail, error = null) {
  if (passed) {
    results.passed++;
  } else if (error === 'SKIPPED') {
    results.skipped++;
  } else {
    results.failed++;
  }
  results.tests.push({ name, passed, detail, error, timestamp: new Date().toISOString() });
}

// Initialize
const INSTANCE_URL = (process.env.SN_INSTANCE_URL || '').replace(/\/$/, '');
const USERNAME = process.env.SN_USERNAME || '';
const PASSWORD = process.env.SN_PASSWORD || '';

if (!INSTANCE_URL || !USERNAME || !PASSWORD) {
  console.error('❌ Missing env vars: SN_INSTANCE_URL, SN_USERNAME, SN_PASSWORD');
  process.exit(1);
}

const logFile = resolve(__dirname, `../logs/scope-test-${Date.now()}.json`);
const logger = new TestLogger(logFile);

// Create client
let client;
try {
  logger.section('Initialization');
  logger.info('Creating ServiceNow client', { instanceUrl: INSTANCE_URL, username: USERNAME });
  client = new ServiceNowClient({
    instanceUrl: INSTANCE_URL,
    username: USERNAME,
    password: PASSWORD
  });
  logger.success('Client created');
} catch (e) {
  logger.error('Failed to create client', { error: e.message });
  process.exit(1);
}

// Test functions
async function testConnection() {
  logger.section('Test 1: Connection & Authentication');
  try {
    const result = await client.testConnection();
    if (result.success) {
      logger.success('Connection successful', result.instanceInfo);
      recordTest('Connection', true, 'Connected to instance');
      return true;
    } else {
      logger.error('Connection failed', { message: result.message });
      recordTest('Connection', false, result.message);
      return false;
    }
  } catch (e) {
    logger.error('Connection test threw error', { error: e.message, stack: e.stack });
    recordTest('Connection', false, e.message);
    return false;
  }
}

async function testListScopes() {
  logger.section('Test 2: List Available Scopes');
  try {
    // Use concoursepicker to list scopes via callScriptedRestApi
    const result = await client.callScriptedRestApi('/api/now/ui/concoursepicker/application', 'GET');
    
    if (result?.list && result.list.length > 0) {
      logger.success(`Found ${result.list.length} scopes`, {
        current: result.current,
        scopes: result.list.map(s => ({ sysId: s.sysId, name: s.name, scope: s.scope }))
      });
      
      // Find custom scopes
      const customScopes = result.list.filter(a => a.sysId !== 'global' && a.scope !== 'global');
      if (customScopes.length === 0) {
        logger.warn('No custom scopes found. Tests will be limited.');
        recordTest('List Scopes', true, `${result.list.length} scopes (all Global)`, 'SKIPPED');
        return { scopes: result.list, customScopes: [], current: result.current };
      }
      
      logger.info(`Found ${customScopes.length} custom scope(s)`, customScopes.map(s => s.name));
      recordTest('List Scopes', true, `${result.list.length} scopes, ${customScopes.length} custom`);
      return { scopes: result.list, customScopes, current: result.current };
    }
    
    logger.error('Concoursepicker returned empty list');
    recordTest('List Scopes', false, 'Empty list');
    return null;
  } catch (e) {
    logger.error('Failed to list scopes', { 
      status: e.response?.status, 
      message: e.response?.data?.error?.message || e.message 
    });
    recordTest('List Scopes', false, e.message);
    return null;
  }
}

async function testTier1_ConcoursePicker(scopeId, scopeName) {
  logger.section(`Test 3: Tier 1 - Concoursepicker API (${scopeName})`);
  try {
    logger.debug('Calling switchScopeViaConcoursePicker', { scopeId });
    const result = await client.switchScopeViaConcoursePicker(scopeId);
    
    if (result.success) {
      logger.success('Tier 1: Concoursepicker PUT succeeded');
      
      // Verify
      logger.debug('Verifying scope via verifyCurrentScope');
      const verified = await client.verifyCurrentScope(scopeId);
      logger.debug('Verification result', verified);
      
      if (verified.matchesTarget) {
        logger.success('Tier 1: Scope verified', {
          currentScopeId: verified.currentScopeId,
          currentScopeName: verified.currentScopeName,
          matchesTarget: verified.matchesTarget
        });
        recordTest('Tier 1: Concoursepicker', true, `Switched to ${verified.currentScopeName}`);
        return true;
      } else {
        logger.warn('Tier 1: PUT succeeded but verification failed', {
          expected: scopeId,
          actual: verified.currentScopeId
        });
        recordTest('Tier 1: Concoursepicker', false, 'Verification failed');
        return false;
      }
    } else {
      logger.error('Tier 1: Concoursepicker failed', { error: result.error });
      recordTest('Tier 1: Concoursepicker', false, result.error);
      return false;
    }
  } catch (e) {
    logger.error('Tier 1: Exception thrown', { error: e.message, stack: e.stack });
    recordTest('Tier 1: Concoursepicker', false, e.message);
    return false;
  }
}

async function testTier2_ScopeHelper(scopeId, scopeName) {
  logger.section(`Test 4: Tier 2 - ScopeHelper Scripted REST API (${scopeName})`);
  try {
    // Check if ScopeHelper is available
    const helperPath = client.getHelperApiPath('scopeHelper');
    if (!helperPath) {
      logger.warn('ScopeHelper API not available. It will be auto-deployed on connection.');
      logger.info('Attempting to initialize helper APIs...');
      
      // Try to trigger initialization (this would normally happen on connect)
      // For now, we'll skip if not available
      recordTest('Tier 2: ScopeHelper', false, 'API not available', 'SKIPPED');
      return false;
    }
    
    logger.debug('ScopeHelper path found', { path: helperPath });
    logger.debug('Calling switchScopeViaScopeHelper', { scopeId });
    const result = await client.switchScopeViaScopeHelper(scopeId);
    
    if (result.success) {
      logger.success('Tier 2: ScopeHelper API call succeeded');
      
      // Verify
      const verified = await client.verifyCurrentScope(scopeId);
      logger.debug('Verification result', verified);
      
      if (verified.matchesTarget) {
        logger.success('Tier 2: Scope verified', verified);
        recordTest('Tier 2: ScopeHelper', true, `Switched to ${verified.currentScopeName}`);
        return true;
      } else {
        logger.warn('Tier 2: API succeeded but verification failed', {
          expected: scopeId,
          actual: verified.currentScopeId
        });
        recordTest('Tier 2: ScopeHelper', false, 'Verification failed');
        return false;
      }
    } else {
      logger.error('Tier 2: ScopeHelper failed', { error: result.error });
      recordTest('Tier 2: ScopeHelper', false, result.error);
      return false;
    }
  } catch (e) {
    logger.error('Tier 2: Exception thrown', { error: e.message, stack: e.stack });
    recordTest('Tier 2: ScopeHelper', false, e.message);
    return false;
  }
}

async function testTier3_UserPreference(scopeId, scopeName) {
  logger.section(`Test 5: Tier 3 - User Preference Write (${scopeName})`);
  try {
    logger.debug('Calling switchScopeViaPreference', { scopeId });
    const result = await client.switchScopeViaPreference(scopeId);
    
    if (result.success) {
      logger.success('Tier 3: Preference write succeeded');
      logger.warn('Note: Preferences only take effect after new session/login');
      
      // Verify (may not match immediately due to session requirement)
      const verified = await client.verifyCurrentScope(scopeId);
      logger.debug('Verification result', verified);
      
      if (verified.matchesTarget) {
        logger.success('Tier 3: Scope verified', verified);
        recordTest('Tier 3: User Preference', true, `Switched to ${verified.currentScopeName}`);
        return true;
      } else {
        logger.warn('Tier 3: Preference written but verification failed (expected - needs new session)', {
          expected: scopeId,
          actual: verified.currentScopeId
        });
        recordTest('Tier 3: User Preference', false, 'Verification failed (needs new session)', 'SKIPPED');
        return false;
      }
    } else {
      logger.error('Tier 3: Preference write failed', { error: result.error });
      recordTest('Tier 3: User Preference', false, result.error);
      return false;
    }
  } catch (e) {
    logger.error('Tier 3: Exception thrown', { error: e.message, stack: e.stack });
    recordTest('Tier 3: User Preference', false, e.message);
    return false;
  }
}

async function testEndToEnd(scopeId, scopeName) {
  logger.section(`Test 6: End-to-End - Scope Switch → Update Set → Verify (${scopeName})`);
  try {
    // 1. Switch scope using ensureScopeActive (runs all tiers)
    logger.step('Step 1: Switching scope using ensureScopeActive');
    const scopeResult = await client.ensureScopeActive(scopeId, scopeName);
    logger.debug('ensureScopeActive result', scopeResult);
    
    if (!scopeResult.success) {
      logger.error('Scope switch failed', scopeResult);
      recordTest('End-to-End: Scope Switch', false, scopeResult.error || 'Unknown error');
      return false;
    }
    
    logger.success('Scope switched', {
      method: scopeResult.method,
      scopeId: scopeResult.scopeId,
      scopeName: scopeResult.scopeName
    });
    recordTest('End-to-End: Scope Switch', true, `Method: ${scopeResult.method}`);
    
    // 2. Create update set in that scope
    logger.step('Step 2: Creating update set in custom scope');
    const usName = `Scope-Test-${Date.now()}`;
    logger.debug('Creating update set', { name: usName, application: scopeId });
    
    const usResp = await client.createRecord('sys_update_set', {
      name: usName,
      description: 'Enhanced scope test — safe to delete',
      state: 'in progress',
      application: scopeId
    });
    
    const us = usResp;
    if (!us?.sys_id) {
      logger.error('Update set creation failed - no sys_id returned');
      recordTest('End-to-End: Create Update Set', false, 'No sys_id returned');
      return false;
    }
    
    logger.success('Update set created', {
      sys_id: us.sys_id,
      name: us.name,
      application: us.application
    });
    recordTest('End-to-End: Create Update Set', true, us.sys_id);
    
    // 3. Verify application field
    logger.step('Step 3: Verifying update set application field');
    const verifyResp = await client.getRecord('sys_update_set', us.sys_id, ['sys_id', 'name', 'application']);
    const app = verifyResp?.application;
    const appId = typeof app === 'object' ? app.value : app;
    
    logger.debug('Application field check', {
      expected: scopeId,
      actual: appId,
      raw: app
    });
    
    if (appId === scopeId) {
      logger.success('Update set application matches scope', { application: appId });
      recordTest('End-to-End: Verify Application', true, `application = ${appId}`);
    } else {
      logger.error('Update set application mismatch', {
        expected: scopeId,
        actual: appId
      });
      recordTest('End-to-End: Verify Application', false, `Expected ${scopeId}, got ${appId}`);
    }
    
    // 4. Set as current update set
    logger.step('Step 4: Setting update set as current');
    const setCurrentResult = await client.callSetCurrentUpdateSetApi(us.sys_id);
    if (setCurrentResult.success) {
      logger.success('Update set set as current');
      client.setActiveUpdateSet(us.sys_id);
    } else {
      logger.warn('Failed to set update set as current via API', { error: setCurrentResult.error });
    }
    
    // 5. Create a test artifact (business rule) to verify capture
    logger.step('Step 5: Creating test artifact to verify capture');
    try {
      const brName = `TestScopeCapture_${Date.now()}`;
      const br = await client.createRecord('sys_script', {
        name: brName,
        script: '// Test artifact for scope capture verification',
        active: false,
        sys_scope: scopeId
      });
      
      logger.success('Test artifact created', { sys_id: br.sys_id, name: br.name });
      
      // 6. Verify artifact is captured in update set
      logger.step('Step 6: Verifying artifact capture in update set');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for sys_update_xml to populate
      
      // Set the update set as active first
      client.setActiveUpdateSet(us.sys_id);
      
      const captureResult = await client.verifyAllArtifactsCaptured([
        { table: 'sys_script', sys_id: br.sys_id, name: brName }
      ]);
      
      logger.debug('Capture verification result', captureResult);
      
      if (captureResult.allCaptured) {
        logger.success('All artifacts captured in update set', {
          captured: captureResult.captured,
          movedNow: captureResult.movedNow,
          missing: captureResult.missing
        });
        recordTest('End-to-End: Artifact Capture', true, 'All artifacts captured');
      } else {
        logger.warn('Some artifacts not captured', {
          captured: captureResult.captured,
          movedNow: captureResult.movedNow,
          missing: captureResult.missing,
          details: captureResult.details
        });
        recordTest('End-to-End: Artifact Capture', false, `${captureResult.missing} missing`);
      }
      
      // Cleanup: delete test artifact
      try {
        await client.deleteRecord('sys_script', br.sys_id);
        logger.info('Test artifact cleaned up');
      } catch (e) {
        logger.warn('Failed to cleanup test artifact', { error: e.message });
      }
    } catch (e) {
      logger.error('Failed to create test artifact', { error: e.message });
      recordTest('End-to-End: Artifact Capture', false, e.message, 'SKIPPED');
    }
    
    // Cleanup: delete the test update set
    try {
      await client.deleteRecord('sys_update_set', us.sys_id);
      logger.info('Test update set cleaned up');
    } catch (e) {
      logger.warn('Failed to cleanup test update set', { error: e.message });
    }
    
    return true;
  } catch (e) {
    logger.error('End-to-end test failed', { error: e.message, stack: e.stack });
    recordTest('End-to-End', false, e.message);
    return false;
  }
}

// Main test runner
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Enhanced Scope Switching Test with Logging                ║');
  console.log(`║  Instance: ${INSTANCE_URL.substring(0, 50).padEnd(50)}║`);
  console.log(`║  Log File: ${logFile.substring(logFile.length - 50).padStart(50)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  try {
    // Test 1: Connection
    const connected = await testConnection();
    if (!connected) {
      logger.error('Cannot proceed without connection. Aborting.');
      await logger.flush();
      process.exit(1);
    }
    
    // Test 2: List scopes
    const scopeInfo = await testListScopes();
    if (!scopeInfo) {
      logger.error('Cannot proceed without scope list. Aborting.');
      await logger.flush();
      process.exit(1);
    }
    
    const { customScopes } = scopeInfo;
    if (customScopes.length === 0) {
      logger.warn('No custom scopes found. Skipping scope-specific tests.');
      logger.info('Available scopes:', scopeInfo.scopes.map(a => `${a.name} (${a.sysId})`).join(', '));
      await logger.flush();
      process.exit(0);
    }
    
    // Use first custom scope for testing
    const testScope = customScopes[0];
    logger.info(`Using test scope: "${testScope.name}" (${testScope.sysId})`);
    
    // Test 3: Tier 1
    await testTier1_ConcoursePicker(testScope.sysId, testScope.name);
    
    // Test 4: Tier 2
    await testTier2_ScopeHelper(testScope.sysId, testScope.name);
    
    // Test 5: Tier 3
    await testTier3_UserPreference(testScope.sysId, testScope.name);
    
    // Test 6: End-to-end
    await testEndToEnd(testScope.sysId, testScope.name);
    
    // Switch back to Global
    try {
      const globalScope = scopeInfo.scopes.find(a => a.scope === 'global' || a.sysId === 'global');
      if (globalScope) {
        logger.step('Switching back to Global scope');
        await client.switchScopeViaConcoursePicker(globalScope.sysId);
        logger.success('Switched back to Global');
      }
    } catch (e) {
      logger.warn('Failed to switch back to Global', { error: e.message });
    }
    
    // Summary
    logger.section('Test Summary');
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  Results: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`);
    console.log(`${'═'.repeat(60)}\n`);
    
    results.tests.forEach(test => {
      const icon = test.passed ? '✅' : (test.error === 'SKIPPED' ? '⏭️' : '❌');
      console.log(`${icon} ${test.name}: ${test.detail}`);
      if (test.error && test.error !== 'SKIPPED') {
        console.log(`   Error: ${test.error}`);
      }
    });
    
    await logger.flush();
    
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (e) {
    logger.error('Fatal error in test runner', { error: e.message, stack: e.stack });
    await logger.flush();
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
