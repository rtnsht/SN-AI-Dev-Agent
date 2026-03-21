#!/usr/bin/env node
/**
 * Test: Customer Service Case Types Scope → Update Set → Flow Designer + Email Notification → Verify Capture
 * 
 * This script:
 * 1. Finds "Customer Service Case Types" scope
 * 2. Switches to that scope
 * 3. Creates/reuses an update set in that scope
 * 4. Creates a Flow Designer flow (draft) with lookup record and notify assignment group manager
 * 5. Creates an email notification record
 * 6. Verifies both artifacts are captured in the update set
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
  console.log('║  Customer Service Case Types Scope Test                    ║');
  console.log(`║  Instance: ${INSTANCE_URL.padEnd(52)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const client = new ServiceNowClient({
    instanceUrl: INSTANCE_URL,
    username: USERNAME,
    password: PASSWORD
  });

  try {
    // Step 1: Find Customer Service Case Types scope
    log('STEP', 'Step 1: Finding Customer Service Case Types scope...');
    const scopes = await client.callScriptedRestApi('/api/now/ui/concoursepicker/application', 'GET');
    const caseTypesScope = scopes.list?.find(s => 
      s.name === 'Customer Service Case Types' || 
      s.scopeName === 'sn_csm_case_types' ||
      s.name?.toLowerCase().includes('customer service case types')
    );

    if (!caseTypesScope) {
      console.error('❌ Customer Service Case Types scope not found');
      console.log('Available scopes:', scopes.list?.slice(0, 10).map(s => s.name).join(', '), '...');
      process.exit(1);
    }

    log('SUCCESS', `Found scope: "${caseTypesScope.name}" (${caseTypesScope.sysId})`);

    // Step 2: Switch to Customer Service Case Types scope
    log('STEP', 'Step 2: Switching to Customer Service Case Types scope...');
    const scopeResult = await client.ensureScopeActive(caseTypesScope.sysId, caseTypesScope.name);
    
    if (!scopeResult.success) {
      console.error('❌ Failed to switch scope:', scopeResult.error);
      if (scopeResult.userActionRequired) {
        console.log('\nManual action required:');
        scopeResult.checklist?.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
      }
      process.exit(1);
    }

    log('SUCCESS', `Scope switched via ${scopeResult.method}`);

    // Step 3: Create or reuse update set
    log('STEP', 'Step 3: Checking for existing test update sets...');
    
    const existingUpdateSets = await client.getRecords('sys_update_set', {
      sysparm_query: `nameSTARTSWITHCS-CaseTypes-Test^application=${caseTypesScope.sysId}^state=in progress`,
      sysparm_fields: 'sys_id,name,state,application,sys_created_on',
      sysparm_orderby: 'sys_created_onDESC',
      sysparm_limit: 10
    });

    let updateSet;
    let updateSetName;
    
    if (existingUpdateSets.length > 0) {
      updateSet = existingUpdateSets[0];
      updateSetName = updateSet.name;
      log('INFO', `Found existing test update set, reusing: "${updateSetName}" (${updateSet.sys_id})`);
      
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
      log('STEP', 'No existing test update set found, creating new one...');
      updateSetName = `CS-CaseTypes-Test-${Date.now()}`;
      updateSet = await client.createRecord('sys_update_set', {
        name: updateSetName,
        description: 'Test update set for Customer Service Case Types scope - safe to delete',
        state: 'in progress',
        application: caseTypesScope.sysId
      });
      log('SUCCESS', `Update set created: ${updateSet.sys_id} / "${updateSetName}"`);
    }

    // Verify application field
    log('STEP', 'Verifying update set application field...');
    const verifyUs = await client.getRecord('sys_update_set', updateSet.sys_id, ['sys_id', 'name', 'application']);
    const appId = typeof verifyUs.application === 'object' ? verifyUs.application.value : verifyUs.application;
    if (appId === caseTypesScope.sysId) {
      log('SUCCESS', `Update set application field verified: ${appId}`);
    } else {
      log('ERROR', `Update set application mismatch: expected ${caseTypesScope.sysId}, got ${appId}`);
    }

    // Step 4: Set as current update set
    log('STEP', 'Step 4: Setting update set as current...');
    const setCurrentResult = await client.callSetCurrentUpdateSetApi(updateSet.sys_id);
    if (setCurrentResult.success) {
      client.setActiveUpdateSet(updateSet.sys_id);
      log('SUCCESS', 'Update set set as current');
    } else {
      log('WARN', `Failed to set as current via API: ${setCurrentResult.error}`);
      client.setActiveUpdateSet(updateSet.sys_id);
    }

    // Step 5: Create Flow Designer flow
    log('STEP', 'Step 5: Creating Flow Designer flow...');
    const flowName = `LookupRecordNotifyManager_${Date.now()}`;
    const flow = await client.createRecord('sys_hub_flow', {
      name: flowName,
      internal_name: flowName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      description: 'Test flow: Lookup record and notify assignment group manager',
      status: 'draft',
      sys_scope: caseTypesScope.sysId,
      table: 'sn_customerservice_case' // Customer Service Case table
    });

    log('SUCCESS', `Flow created: ${flow.sys_id} / "${flowName}"`);
    log('INFO', 'Note: Flow is in draft status. Open in Flow Designer UI to add triggers and actions, then activate.');

    // Step 6: Create email notification
    log('STEP', 'Step 6: Creating email notification...');
    const notificationName = `NotifyAssignmentGroupManager_${Date.now()}`;
    const notification = await client.createRecord('sysevent_email_action', {
      name: notificationName,
      collection: 'sn_customerservice_case',
      subject: 'Case Assignment - Manager Notification',
      message_html: `<p>Hello,</p>
<p>A case has been assigned to your group.</p>
<p><strong>Case Number:</strong> {{number}}<br>
<strong>Short Description:</strong> {{short_description}}<br>
<strong>Assigned To:</strong> {{assigned_to}}<br>
<strong>Assignment Group:</strong> {{assignment_group}}</p>
<p>Please review the case and take appropriate action.</p>
<p>Thank you,<br>
ServiceNow System</p>`,
      recipient_fields: 'assignment_group.manager',
      send_self: false,
      condition: 'assignment_group.managerISNOTEMPTY',
      action_insert: false,
      action_update: true,
      active: true,
      content_type: 'text/html',
      sys_scope: caseTypesScope.sysId
    });

    log('SUCCESS', `Email notification created: ${notification.sys_id} / "${notificationName}"`);

    // Step 7: Verify artifact capture
    log('STEP', 'Step 7: Verifying artifact capture in update set...');
    
    // Wait a moment for sys_update_xml to populate
    await new Promise(resolve => setTimeout(resolve, 2000));

    const captureResult = await client.verifyAllArtifactsCaptured([
      { 
        table: 'sys_hub_flow', 
        sys_id: flow.sys_id, 
        name: flowName 
      },
      { 
        table: 'sysevent_email_action', 
        sys_id: notification.sys_id, 
        name: notificationName 
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

    // Get update set contents
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
    console.log(`  Scope: ${caseTypesScope.name} (${caseTypesScope.sysId})`);
    console.log(`  Update Set: ${updateSetName} (${updateSet.sys_id})`);
    console.log(`  Flow Designer: ${flowName} (${flow.sys_id})`);
    console.log(`  Email Notification: ${notificationName} (${notification.sys_id})`);
    console.log(`  Capture Status: ${captureResult.allCaptured ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`  Update Set URL: ${INSTANCE_URL}/sys_update_set.do?sys_id=${updateSet.sys_id}`);
    console.log(`  Flow URL: ${INSTANCE_URL}/sys_hub_flow.do?sys_id=${flow.sys_id}`);
    console.log(`  Notification URL: ${INSTANCE_URL}/sysevent_email_action.do?sys_id=${notification.sys_id}`);
    console.log('═'.repeat(60) + '\n');

    console.log('💡 Note: Test artifacts created. You can delete them manually:');
    console.log(`   - Update Set: ${updateSetName}`);
    console.log(`   - Flow: ${flowName}`);
    console.log(`   - Email Notification: ${notificationName}\n`);

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
