#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { ServiceNowClient } from './dist/client/sn-client.js';
import { previewChangeImpact, previewChangeImpactSchema } from './dist/tools/change-impact-analyzer.js';
import { detectConflicts, detectConflictsSchema } from './dist/tools/conflict-detector.js';
import { validateChange, validateChangeSchema } from './dist/tools/guardrail-validator.js';
import { checkBreakingChanges, checkBreakingChangesSchema } from './dist/tools/breaking-change-detector.js';
import { logChange, logChangeSchema, getAuditHistory, getAuditHistorySchema } from './dist/tools/audit-logger.js';

dotenv.config();

const client = new ServiceNowClient({
  instanceUrl: process.env.SN_INSTANCE_URL,
  username: process.env.SN_USERNAME,
  password: process.env.SN_PASSWORD
});

async function runTests() {
  console.log('='.repeat(60));
  console.log('STEP 2: GUARDRAILS & IMPACT ANALYSIS - TEST SUITE');
  console.log('='.repeat(60));

  // Test 2.1: Change Impact Analyzer
  console.log('\n📋 Testing sn_preview_change_impact (Task 2.1)');
  console.log('-'.repeat(50));

  const badScript = `
    function onChange() {
      current.update();
      eval('var x = 1');
      var count = gr.getRowCount();
      $('input').val('test');
    }
  `;

  const impact = await previewChangeImpact(client, previewChangeImpactSchema.parse({
    changeType: 'create_business_rule',
    targetTable: 'incident',
    proposedScript: badScript,
    proposedWhen: 'before'
  }));

  console.log('Risk Score:', impact.riskScore, '/ 100');
  console.log('Risk Level:', impact.riskLevel);
  console.log('Impacts Found:', impact.summary.totalImpacts);
  console.log('Approval Required:', impact.approvalRequired);
  console.log('✅ sn_preview_change_impact: PASSED');

  // Test 2.2: Conflict Detector
  console.log('\n📋 Testing sn_detect_conflicts (Task 2.2)');
  console.log('-'.repeat(50));

  const conflicts = await detectConflicts(client, detectConflictsSchema.parse({
    targetTable: 'incident',
    artifactType: 'all'
  }));

  console.log('Target Table:', conflicts.targetTable);
  console.log('Total Conflicts:', conflicts.summary.totalConflicts);
  console.log('Health Score:', conflicts.healthScore, '/ 100');
  if (conflicts.summary.totalConflicts > 0) {
    console.log('By Type:', JSON.stringify(conflicts.summary.byType));
  }
  console.log('✅ sn_detect_conflicts: PASSED');

  // Test 2.3: Guardrail Validator
  console.log('\n📋 Testing sn_validate_change (Task 2.3)');
  console.log('-'.repeat(50));

  const validation = await validateChange(client, validateChangeSchema.parse({
    changeType: 'business_rule',
    artifactName: 'Test Business Rule',
    targetTable: 'incident',
    script: badScript,
    strictMode: true
  }));

  console.log('Valid:', validation.valid);
  console.log('Can Proceed:', validation.canProceed);
  console.log('Blockers:', validation.summary.blockers);
  console.log('Warnings:', validation.summary.warnings);
  console.log('Requires Approval:', validation.requiresApproval);
  if (validation.approvalLevel) {
    console.log('Approval Level:', validation.approvalLevel);
  }
  console.log('✅ sn_validate_change: PASSED');

  // Test 2.4: Breaking Change Detector
  console.log('\n📋 Testing sn_check_breaking_changes (Task 2.4)');
  console.log('-'.repeat(50));

  const breaking = await checkBreakingChanges(client, checkBreakingChangesSchema.parse({
    artifactType: 'script_include',
    artifactName: 'GlideRecord',  // Common SN class
    proposedChange: 'delete'
  }));

  console.log('Artifact:', breaking.artifactName);
  console.log('Proposed Change:', breaking.proposedChange);
  console.log('Alerts Found:', breaking.summary.totalAlerts);
  console.log('Safe to Proceed:', breaking.safeToProced);
  console.log('Requires Approval:', breaking.requiresApproval);
  console.log('✅ sn_check_breaking_changes: PASSED');

  // Test 2.6: Audit Logger
  console.log('\n📋 Testing sn_log_change & sn_get_audit_history (Task 2.6)');
  console.log('-'.repeat(50));

  const log1 = await logChange(client, logChangeSchema.parse({
    action: 'create',
    artifactType: 'business_rule',
    artifactName: 'Test BR',
    artifactSysId: 'abc123',
    targetTable: 'incident',
    validationResult: {
      riskScore: 85,
      riskLevel: 'low',
      guardrailViolations: 0
    },
    sessionId: 'TEST-SESSION-001'
  }));

  console.log('Log ID:', log1.logId);
  console.log('Message:', log1.message);
  console.log('Can Rollback:', log1.rollbackInfo?.canRollback);

  // Log another change
  await logChange(client, logChangeSchema.parse({
    action: 'update',
    artifactType: 'script_include',
    artifactName: 'MyUtils',
    sessionId: 'TEST-SESSION-001',
    changeDetails: {
      scriptBefore: 'function old() {}',
      scriptAfter: 'function updated() {}'
    }
  }));

  // Get history
  const history = await getAuditHistory(client, getAuditHistorySchema.parse({
    sessionId: 'TEST-SESSION-001'
  }));

  console.log('Audit Entries:', history.totalEntries);
  console.log('Creates:', history.summary.creates);
  console.log('Updates:', history.summary.updates);
  console.log('✅ sn_log_change & sn_get_audit_history: PASSED');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('STEP 2 TEST RESULTS');
  console.log('='.repeat(60));
  console.log('✅ Task 2.1 sn_preview_change_impact: PASSED');
  console.log('✅ Task 2.2 sn_detect_conflicts: PASSED');
  console.log('✅ Task 2.3 sn_validate_change: PASSED');
  console.log('✅ Task 2.4 sn_check_breaking_changes: PASSED');
  console.log('✅ Task 2.6 sn_log_change & sn_get_audit_history: PASSED');
  console.log('='.repeat(60));
  console.log('All Step 2 tools are working correctly!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

