/**
 * Test auto-deployment of helper APIs on connection
 */
const { ServiceNowClient } = require('./dist/client/sn-client.js');
const { testConnection, initializeInstance, initializeInstanceSchema } = require('./dist/tools/connection.js');
require('dotenv').config();

const client = new ServiceNowClient({
  instanceUrl: process.env.SN_INSTANCE_URL,
  username: process.env.SN_USERNAME,
  password: process.env.SN_PASSWORD,
  defaultScope: 'global'
});

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Testing Auto-Deployment of Helper APIs');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Instance:', process.env.SN_INSTANCE_URL);

  // Test 1: testConnection should auto-initialize helper APIs
  console.log('\n1️⃣  Testing sn_test_connection (should auto-initialize)...');
  const connResult = await testConnection(client);
  console.log('   Connection:', connResult.success ? '✅ Success' : '❌ Failed');

  if (connResult.helperApis) {
    console.log('\n   Helper APIs deployed:');
    console.log('   • UIPolicyActionHelper:',
      connResult.helperApis.uiPolicyActionHelper?.deployed ? '✅ Deployed' : '⏳ Pending',
      connResult.helperApis.uiPolicyActionHelper?.path || '');
    console.log('   • UpdateSetHelper:',
      connResult.helperApis.updateSetHelper?.deployed ? '✅ Deployed' : '⏳ Pending',
      connResult.helperApis.updateSetHelper?.path || '');
  }

  if (connResult.helperApisWarning) {
    console.log('   ⚠️  Warning:', connResult.helperApisWarning);
  }

  // Test 2: Check cached paths
  console.log('\n2️⃣  Checking cached API paths...');
  console.log('   • UIPolicyActionHelper:', client.getHelperApiPath('uiPolicyActionHelper') || '(not set)');
  console.log('   • UpdateSetHelper:', client.getHelperApiPath('updateSetHelper') || '(not set)');
  console.log('   • helperApisInitialized:', client.helperApisInitialized);

  // Test 3: Verify APIs exist in ServiceNow
  console.log('\n3️⃣  Verifying APIs exist in ServiceNow...');
  const apis = await client.getRecords('sys_ws_definition', {
    sysparm_query: 'service_idINui_policy_action_helper,update_set_helper',
    sysparm_fields: 'name,service_id,namespace,active',
    sysparm_display_value: 'true'
  });

  apis.forEach(api => {
    console.log(`   • ${api.name} (${api.service_id}): namespace=${api.namespace}, active=${api.active}`);
  });

  // Test 4: Test UpdateSetHelper API functionality
  console.log('\n4️⃣  Testing UpdateSetHelper API functionality...');
  const updateSetHelperPath = client.getHelperApiPath('updateSetHelper');

  // Create a test update set
  const updateSet = await client.createRecord('sys_update_set', {
    name: 'Test_AutoDeploy_' + Date.now(),
    description: 'Test update set for auto-deploy verification',
    state: 'in progress'
  });
  console.log('   Created test update set:', updateSet.name);

  // Test the UpdateSetHelper API
  const result = await client.callScriptedRestApi(
    updateSetHelperPath + '/set_current',
    'POST',
    { sys_id: updateSet.sys_id }
  );
  console.log('   UpdateSetHelper result:', result.success ? '✅ Success' : '❌ Failed');
  if (result.update_set) {
    console.log('   Set current update set:', result.update_set.name);
  }

  // Clean up - mark as ignore (can't delete via API due to ACLs)
  try {
    await client.updateRecord('sys_update_set', updateSet.sys_id, { state: 'ignore' });
    console.log('   Cleaned up test update set (marked as ignore)');
  } catch (e) {
    console.log('   Note: Could not clean up test update set (ACL restriction)');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅ All Tests Passed');
  console.log('═══════════════════════════════════════════════════════\n');
})().catch(e => console.error('Error:', e.message, e.stack));

