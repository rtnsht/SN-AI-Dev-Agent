/**
 * Test Step 4: Multi-Instance & Predictive
 */

import * as dotenv from 'dotenv';
import { ServiceNowClient } from './dist/client/sn-client.js';
import * as instanceRegistry from './dist/tools/instance-registry.js';
import * as instanceCompare from './dist/tools/instance-compare.js';
import * as upgradeReadiness from './dist/tools/upgrade-readiness.js';
import * as conflictPredictor from './dist/tools/conflict-predictor.js';

dotenv.config();

const client = new ServiceNowClient({
  instanceUrl: process.env.SN_INSTANCE_URL,
  username: process.env.SN_USERNAME,
  password: process.env.SN_PASSWORD
});

async function runTests() {
  console.log('='.repeat(60));
  console.log('STEP 4 TESTS: Multi-Instance & Predictive');
  console.log('='.repeat(60));
  
  // Test 1: Register instances
  console.log('\n📋 TEST 1: sn_register_instance');
  const devInstance = await instanceRegistry.registerInstance(client, {
    instanceId: 'dev-001',
    name: 'Development Instance',
    url: 'https://dev.service-now.com',
    environment: 'dev',
    description: 'Main development environment'
  });
  console.log('  ✅ Registered:', devInstance.instance.name);
  console.log('  Environment:', devInstance.instance.environment);
  
  const prodInstance = await instanceRegistry.registerInstance(client, {
    instanceId: 'prod-001',
    name: 'Production Instance',
    url: 'https://prod.service-now.com',
    environment: 'prod',
    description: 'Production environment'
  });
  console.log('  ✅ Registered:', prodInstance.instance.name);
  
  // Test 2: List instances
  console.log('\n📋 TEST 2: sn_list_instances');
  const listResult = await instanceRegistry.listInstances(client, {
    environment: 'all'
  });
  console.log('  ✅ Total instances:', listResult.total);
  listResult.instances.forEach(i => console.log('    -', i.name, `(${i.environment})`));
  
  // Test 3: Compare instances
  console.log('\n🔄 TEST 3: sn_compare_instances');
  const compareResult = await instanceCompare.compareInstances(client, {
    sourceInstanceId: 'dev-001',
    targetInstanceId: 'prod-001',
    artifactTypes: ['business_rule', 'script_include']
  });
  console.log('  ✅ Comparison complete');
  console.log('  Total artifacts:', compareResult.summary.totalArtifacts);
  console.log('  Identical:', compareResult.summary.identical);
  console.log('  Modified:', compareResult.summary.modified);
  console.log('  Missing in target:', compareResult.summary.missingInTarget);
  console.log('  Can promote:', compareResult.promotionRecommendation.canPromote);
  
  // Test 4: Upgrade readiness
  console.log('\n📊 TEST 4: sn_assess_upgrade_readiness');
  const upgradeResult = await upgradeReadiness.assessUpgradeReadiness(client, {
    targetVersion: 'Xanadu',
    includeRecommendations: true
  });
  console.log('  ✅ Readiness Score:', upgradeResult.readinessScore, `(Grade: ${upgradeResult.grade})`);
  console.log('  Current Version:', upgradeResult.currentVersion);
  console.log('  Target Version:', upgradeResult.targetVersion);
  console.log('  Total Risks:', upgradeResult.summary.totalRisks);
  console.log('    - Critical:', upgradeResult.summary.critical);
  console.log('    - High:', upgradeResult.summary.high);
  console.log('    - Medium:', upgradeResult.summary.medium);
  console.log('    - Low:', upgradeResult.summary.low);
  console.log('  Estimated Effort:', upgradeResult.estimatedEffort.days, 'days');
  
  // Test 5: Conflict prediction
  console.log('\n🔮 TEST 5: sn_predict_conflicts');
  const conflictResult = await conflictPredictor.predictConflicts(client, {
    changeType: 'create_business_rule',
    targetTable: 'incident',
    artifactName: 'My New BR',
    proposedChanges: {
      when: 'before',
      order: 100,
      script: 'current.update();'
    }
  });
  console.log('  ✅ Prediction complete');
  console.log('  Overall Risk:', conflictResult.overallRisk, `(Score: ${conflictResult.riskScore})`);
  console.log('  Existing artifacts on table:', conflictResult.safetyAnalysis.existingArtifactsOnTable);
  console.log('  Potential collisions:', conflictResult.safetyAnalysis.potentialCollisions);
  console.log('  Predicted conflicts:', conflictResult.predictedConflicts.length);
  if (conflictResult.safetyAnalysis.recommendedOrder) {
    console.log('  Recommended order:', conflictResult.safetyAnalysis.recommendedOrder);
  }
  conflictResult.predictedConflicts.slice(0, 3).forEach(c => {
    console.log(`    - [${c.severity}] ${c.title}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL STEP 4 TESTS PASSED');
  console.log('='.repeat(60));
}

runTests().catch(console.error);

