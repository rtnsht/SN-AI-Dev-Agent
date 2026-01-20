/**
 * Test Step 3: Persona & 4G Framework
 */

import * as dotenv from 'dotenv';
import { ServiceNowClient } from './dist/client/sn-client.js';
import * as personaEngine from './dist/tools/persona-engine.js';
import * as fourGFramework from './dist/tools/four-g-framework.js';
import * as approvalGate from './dist/tools/approval-gate.js';

dotenv.config();

const client = new ServiceNowClient({
  instanceUrl: process.env.SN_INSTANCE_URL,
  username: process.env.SN_USERNAME,
  password: process.env.SN_PASSWORD
});

async function runTests() {
  console.log('='.repeat(60));
  console.log('STEP 3 TESTS: Persona & 4G Framework');
  console.log('='.repeat(60));
  
  // Test 1: Detect Persona (junior developer)
  console.log('\n📋 TEST 1: sn_detect_persona (junior_developer)');
  const personaResult = await personaEngine.detectPersona(client, {
    selfDeclared: 'junior_developer'
  });
  console.log('  ✅ Detected:', personaResult.detectedPersona.displayName);
  console.log('  Skill Level:', personaResult.detectedPersona.skillLevel);
  console.log('  Guardrail Strictness:', personaResult.adaptiveSettings.guardrailStrictness);
  console.log('  Verbosity:', personaResult.adaptiveSettings.verbosity);
  
  // Test 2: Detect Persona (architect)
  console.log('\n📋 TEST 2: sn_detect_persona (architect)');
  const archResult = await personaEngine.detectPersona(client, {
    selfDeclared: 'architect'
  });
  console.log('  ✅ Detected:', archResult.detectedPersona.displayName);
  console.log('  Skill Level:', archResult.detectedPersona.skillLevel);
  console.log('  Guardrail Strictness:', archResult.adaptiveSettings.guardrailStrictness);
  
  // Test 3: 4G Framework - Good script
  console.log('\n🛡️ TEST 3: sn_apply_4g_framework (good script)');
  const goodScript = `
    var gr = new GlideRecord('incident');
    gr.addQuery('active', true);
    gr.query();
    while (gr.next()) {
      gs.info('Found: ' + gr.number);
    }
  `;
  const good4G = await fourGFramework.apply4GFramework(client, {
    action: 'create_business_rule',
    artifactName: 'My Good BR',
    targetTable: 'incident',
    script: goodScript,
    persona: 'senior_developer'
  });
  console.log('  ✅ Guardrails Passed:', good4G.guardrails.allPassed);
  console.log('  Errors:', good4G.guardrails.errors.length);
  console.log('  Guidance Items:', good4G.guidance.length);
  console.log('  Recommendation:', good4G.recommendation.message);
  
  // Test 4: 4G Framework - Bad script (with anti-patterns)
  console.log('\n🛡️ TEST 4: sn_apply_4g_framework (bad script)');
  const badScript = `
    var gr = new GlideRecord('incident');
    gr.query();
    while (gr.next()) {
      current.update();  // BAD!
      eval('some code'); // BAD!
    }
  `;
  const bad4G = await fourGFramework.apply4GFramework(client, {
    action: 'create_business_rule',
    artifactName: 'My Bad BR',
    script: badScript,
    persona: 'junior_developer'
  });
  console.log('  ✅ Guardrails Passed:', bad4G.guardrails.allPassed);
  console.log('  Errors:', bad4G.guardrails.errors.length);
  bad4G.guardrails.errors.forEach(e => console.log('    -', e.name, ':', e.message));
  console.log('  Requires Approval:', bad4G.governance.requiresApproval);
  console.log('  Recommendation:', bad4G.recommendation.message);
  
  // Test 5: Request Approval
  console.log('\n📝 TEST 5: sn_request_approval');
  const approvalReq = await approvalGate.requestApproval(client, {
    changeId: 'CHG-TEST-001',
    changeType: 'create_artifact',
    artifactType: 'Business Rule',
    artifactName: 'Test BR',
    requester: { persona: 'junior_developer', name: 'Test User' },
    approvalLevel: 'team_lead',
    justification: 'Needed for incident automation'
  });
  console.log('  ✅ Status:', approvalReq.status);
  console.log('  Approval Level:', approvalReq.approvalLevel);
  console.log('  Estimated Wait:', approvalReq.estimatedWaitTime);
  
  // Test 6: Get Approval Status
  console.log('\n📊 TEST 6: sn_get_approval_status');
  const statusResult = await approvalGate.getApprovalStatus(client, {
    status: 'pending'
  });
  console.log('  ✅ Total Pending:', statusResult.totalPending);
  console.log('  Requests:', statusResult.requests.length);
  
  // Test 7: Process Approval
  console.log('\n✅ TEST 7: sn_process_approval');
  const processResult = await approvalGate.processApproval(client, {
    changeId: 'CHG-TEST-001',
    decision: 'approved',
    approver: { role: 'team_lead', name: 'Approver' },
    comments: 'Looks good!'
  });
  console.log('  ✅ Decision:', processResult.decision);
  console.log('  Can Proceed:', processResult.canProceed);
  console.log('  Message:', processResult.message);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL STEP 3 TESTS PASSED');
  console.log('='.repeat(60));
}

runTests().catch(console.error);

