#!/usr/bin/env node
/**
 * Test: CSM Workspace Scope → Update Set → Script Include → Verify Capture
 * 
 * This script:
 * 1. Finds CSM Workspace scope
 * 2. Switches to that scope
 * 3. Creates an update set in that scope
 * 4. Creates a test script include
 * 5. Verifies the script include is captured in the update set
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

// Logger helper
function log(level, message, data = null) {
  const icon = {
    INFO: 'ℹ️',
    SUCCESS: '✅',
    ERROR: '❌',
    WARN: '⚠️',
    STEP: '📋'
  }[level] || '•';
  console.log(`${icon} ${message}`);
  if (data && process.env.SN_DEBUG_SCOPE === 'true') {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  CSM Workspace Scope Test                                  ║');
  console.log(`║  Instance: ${INSTANCE_URL.padEnd(52)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const client = new ServiceNowClient({
    instanceUrl: INSTANCE_URL,
    username: USERNAME,
    password: PASSWORD
  });

  try {
    // Step 1: Find CSM Workspace scope
    log('STEP', 'Step 1: Finding CSM Workspace scope...');
    const scopes = await client.callScriptedRestApi('/api/now/ui/concoursepicker/application', 'GET');
    const csmWorkspace = scopes.list?.find(s => 
      s.name === 'CSM Workspace' || 
      s.scopeName === 'sn_csm_workspace' ||
      s.name?.toLowerCase().includes('csm workspace')
    );

    if (!csmWorkspace) {
      console.error('❌ CSM Workspace scope not found');
      console.log('Available scopes:', scopes.list?.slice(0, 10).map(s => s.name).join(', '), '...');
      process.exit(1);
    }

    log('SUCCESS', `Found CSM Workspace scope: "${csmWorkspace.name}" (${csmWorkspace.sysId})`);

    // Step 2: Switch to CSM Workspace scope
    log('STEP', 'Step 2: Switching to CSM Workspace scope...');
    const scopeResult = await client.ensureScopeActive(csmWorkspace.sysId, csmWorkspace.name);
    
    if (!scopeResult.success) {
      console.error('❌ Failed to switch scope:', scopeResult.error);
      if (scopeResult.userActionRequired) {
        console.log('\nManual action required:');
        scopeResult.checklist?.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
      }
      process.exit(1);
    }

    log('SUCCESS', `Scope switched via ${scopeResult.method}`);

    // Step 3: Create or reuse update set in CSM Workspace scope
    log('STEP', 'Step 3: Checking for existing test update sets...');
    
    // Check for existing test update sets in CSM Workspace scope
    const existingUpdateSets = await client.getRecords('sys_update_set', {
      sysparm_query: `nameSTARTSWITHCSM-Workspace-Test^application=${csmWorkspace.sysId}^state=in progress`,
      sysparm_fields: 'sys_id,name,state,application,sys_created_on',
      sysparm_orderby: 'sys_created_onDESC',
      sysparm_limit: 10
    });

    let updateSet;
    let updateSetName;
    
    if (existingUpdateSets.length > 0) {
      // Reuse the most recent one
      updateSet = existingUpdateSets[0];
      updateSetName = updateSet.name;
      log('INFO', `Found existing test update set, reusing: "${updateSetName}" (${updateSet.sys_id})`);
      
      // Clean up older test update sets (keep only the most recent one)
      if (existingUpdateSets.length > 1) {
        log('STEP', `Cleaning up ${existingUpdateSets.length - 1} older test update set(s)...`);
        for (let i = 1; i < existingUpdateSets.length; i++) {
          try {
            await client.deleteRecord('sys_update_set', existingUpdateSets[i].sys_id);
            log('INFO', `Deleted old update set: ${existingUpdateSets[i].name}`);
          } catch (e) {
            log('WARN', `Failed to delete old update set ${existingUpdateSets[i].name}: ${e.message}`);
          }
        }
      }
    } else {
      // Create a new one
      log('STEP', 'No existing test update set found, creating new one...');
      updateSetName = `CSM-Workspace-Test-${Date.now()}`;
      updateSet = await client.createRecord('sys_update_set', {
        name: updateSetName,
        description: 'Test update set for CSM Workspace scope - safe to delete',
        state: 'in progress',
        application: csmWorkspace.sysId
      });
      log('SUCCESS', `Update set created: ${updateSet.sys_id} / "${updateSetName}"`);
    }

    // Verify application field (for both new and reused update sets)
    log('STEP', 'Verifying update set application field...');
    const verifyUs = await client.getRecord('sys_update_set', updateSet.sys_id, ['sys_id', 'name', 'application']);
    const appId = typeof verifyUs.application === 'object' ? verifyUs.application.value : verifyUs.application;
    if (appId === csmWorkspace.sysId) {
      log('SUCCESS', `Update set application field verified: ${appId}`);
    } else {
      log('ERROR', `Update set application mismatch: expected ${csmWorkspace.sysId}, got ${appId}`);
    }

    // Step 4: Set as current update set
    log('STEP', 'Step 4: Setting update set as current...');
    const setCurrentResult = await client.callSetCurrentUpdateSetApi(updateSet.sys_id);
    if (setCurrentResult.success) {
      client.setActiveUpdateSet(updateSet.sys_id);
      log('SUCCESS', 'Update set set as current');
    } else {
      log('WARN', `Failed to set as current via API: ${setCurrentResult.error}`);
      // Still set it locally so artifact moves work
      client.setActiveUpdateSet(updateSet.sys_id);
    }

    // Step 5: Create test script include
    log('STEP', 'Step 5: Creating test script include...');
    const scriptIncludeName = `CSMWorkspaceTestUtil_${Date.now()}`;
    const scriptInclude = await client.createRecord('sys_script_include', {
      name: scriptIncludeName,
      api_name: scriptIncludeName,
      script: `// Test Script Include for CSM Workspace
var CSMWorkspaceTestUtil = Class.create();
CSMWorkspaceTestUtil.prototype = {
    initialize: function() {
    },
    
    testMethod: function() {
        return 'CSM Workspace Test - ' + new GlideDateTime().getDisplayValue();
    },
    
    type: 'CSMWorkspaceTestUtil'
};`,
      client_callable: false,
      active: false, // Inactive for safety
      access: 'public',
      sys_scope: csmWorkspace.sysId
    });

    log('SUCCESS', `Script include created: ${scriptInclude.sys_id} / "${scriptIncludeName}"`);

    // Step 6: Verify artifact capture
    log('STEP', 'Step 6: Verifying artifact capture in update set...');
    
    // Wait a moment for sys_update_xml to populate
    await new Promise(resolve => setTimeout(resolve, 2000));

    const captureResult = await client.verifyAllArtifactsCaptured([
      { 
        table: 'sys_script_include', 
        sys_id: scriptInclude.sys_id, 
        name: scriptIncludeName 
      }
    ]);

    console.log('\n' + '═'.repeat(60));
    console.log('  Capture Verification Results');
    console.log('═'.repeat(60));
    console.log(`  All Captured: ${captureResult.allCaptured ? '✅ YES' : '❌ NO'}`);
    console.log(`  Captured: ${captureResult.captured}`);
    console.log(`  Moved Now: ${captureResult.movedNow}`);
    console.log(`  Missing: ${captureResult.missing}`);
    
    if (captureResult.details.length > 0) {
      console.log('\n  Details:');
      captureResult.details.forEach(detail => {
        const statusIcon = detail.status === 'captured' ? '✅' : 
                          detail.status === 'moved' ? '🔄' : '❌';
        console.log(`    ${statusIcon} ${detail.table} / ${detail.sys_id} - ${detail.status}`);
        if (detail.error) {
          console.log(`      Error: ${detail.error}`);
        }
      });
    }

    if (captureResult.allCaptured) {
      log('SUCCESS', '✅ All artifacts successfully captured in update set!');
    } else {
      log('ERROR', '❌ Some artifacts were not captured');
    }

    // Get update set contents for verification
    const contents = await client.getRecords('sys_update_xml', {
      sysparm_query: `update_set=${updateSet.sys_id}`,
      sysparm_fields: 'sys_id,name,type,target_name,action',
      sysparm_limit: 100
    });

    console.log(`\n  Update Set Contents: ${contents.length} item(s)`);
    contents.forEach((item, i) => {
      console.log(`    ${i + 1}. ${item.name || item.target_name} [${item.type}] - ${item.action || 'insert'}`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('  Summary');
    console.log('═'.repeat(60));
    console.log(`  Scope: ${csmWorkspace.name} (${csmWorkspace.sysId})`);
    console.log(`  Update Set: ${updateSetName} (${updateSet.sys_id})`);
    console.log(`  Script Include: ${scriptIncludeName} (${scriptInclude.sys_id})`);
    console.log(`  Capture Status: ${captureResult.allCaptured ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`  Update Set URL: ${INSTANCE_URL}/sys_update_set.do?sys_id=${updateSet.sys_id}`);
    console.log(`  Script Include URL: ${INSTANCE_URL}/sys_script_include.do?sys_id=${scriptInclude.sys_id}`);
    console.log('═'.repeat(60) + '\n');

    // Cleanup option
    console.log('💡 Note: Test artifacts created. You can delete them manually:');
    console.log(`   - Update Set: ${updateSetName}`);
    console.log(`   - Script Include: ${scriptIncludeName}\n`);

    process.exit(captureResult.allCaptured ? 0 : 1);

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
