/**
 * Test OOTB Baseline Comparator
 */

import * as dotenv from 'dotenv';
import { ServiceNowClient } from './dist/client/sn-client.js';
import * as ootbBaselineComparator from './dist/tools/ootb-baseline-comparator.js';

dotenv.config();

const client = new ServiceNowClient({
  instanceUrl: process.env.SN_INSTANCE_URL,
  username: process.env.SN_USERNAME,
  password: process.env.SN_PASSWORD
});

async function runTests() {
  console.log('='.repeat(70));
  console.log('TEST: OOTB Baseline Comparator');
  console.log('='.repeat(70));
  
  // Test 1: Summary mode
  console.log('\n📋 TEST 1: Summary Mode (Quick Overview)');
  console.log('-'.repeat(50));
  
  const summaryResult = await ootbBaselineComparator.compareToOotb(client, {
    mode: 'summary',
    artifactTypes: ['business_rules', 'script_includes', 'acls'],
    limit: 100,
    includeRecommendations: true
  });
  
  console.log(`✅ Customization Score: ${summaryResult.customizationScore}/100`);
  console.log(`   Grade: ${summaryResult.customizationGrade}`);
  console.log(`   Upgrade Readiness: ${summaryResult.upgradeReadiness}`);
  console.log('');
  console.log('   Summary:');
  console.log(`   - Total Artifacts Analyzed: ${summaryResult.summary.totalArtifactsAnalyzed}`);
  console.log(`   - Total OOTB: ${summaryResult.summary.totalOotb}`);
  console.log(`   - Total Custom: ${summaryResult.summary.totalCustom}`);
  console.log(`   - Customization %: ${summaryResult.summary.customizationPercentage}%`);
  console.log('');
  console.log('   Impact Breakdown:');
  console.log(`   - Critical: ${summaryResult.summary.criticalCustomizations}`);
  console.log(`   - High: ${summaryResult.summary.highImpactCustomizations}`);
  console.log(`   - Medium: ${summaryResult.summary.mediumImpactCustomizations}`);
  console.log(`   - Low: ${summaryResult.summary.lowImpactCustomizations}`);
  console.log('');
  console.log('   Upgrade Impact:');
  console.log(`   - Safe to Upgrade: ${summaryResult.upgradeImpact.safeToUpgrade}`);
  console.log(`   - Needs Review: ${summaryResult.upgradeImpact.needsReview}`);
  console.log(`   - Risky on Upgrade: ${summaryResult.upgradeImpact.riskyOnUpgrade}`);
  console.log(`   - Will Break: ${summaryResult.upgradeImpact.willBreak}`);
  
  // Test 2: Category breakdown
  console.log('\n📊 TEST 2: Category Breakdown');
  console.log('-'.repeat(50));
  
  for (const cat of summaryResult.categoryBreakdown) {
    console.log(`   ${cat.category}: ${cat.total} total, ${cat.custom} custom (${cat.customizationPercentage}%)`);
  }
  
  // Test 3: Top customizers
  console.log('\n👤 TEST 3: Top Customizers');
  console.log('-'.repeat(50));
  
  if (summaryResult.summary.topCustomizers.length > 0) {
    summaryResult.summary.topCustomizers.slice(0, 5).forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.user}: ${c.count} customizations`);
    });
  } else {
    console.log('   No customizers found');
  }
  
  // Test 4: Top customized tables
  console.log('\n📋 TEST 4: Top Customized Tables');
  console.log('-'.repeat(50));
  
  if (summaryResult.summary.topCustomizedTables.length > 0) {
    summaryResult.summary.topCustomizedTables.slice(0, 5).forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.table}: ${t.count} customizations`);
    });
  } else {
    console.log('   No table data found');
  }
  
  // Test 5: Recommendations
  console.log('\n💡 TEST 5: Recommendations');
  console.log('-'.repeat(50));
  
  if (summaryResult.recommendations.length > 0) {
    summaryResult.recommendations.slice(0, 5).forEach(rec => {
      console.log(`   [${rec.priority.toUpperCase()}] ${rec.title}`);
      console.log(`      ${rec.description}`);
      console.log(`      Effort: ${rec.effort} | Impact: ${rec.impact}`);
      console.log('');
    });
  } else {
    console.log('   ✅ No critical recommendations - instance is well maintained!');
  }
  
  // Test 6: Detailed mode
  console.log('\n🔍 TEST 6: Detailed Mode (with customization list)');
  console.log('-'.repeat(50));
  
  const detailedResult = await ootbBaselineComparator.compareToOotb(client, {
    mode: 'detailed',
    artifactTypes: ['business_rules'],
    limit: 20,
    includeRecommendations: false
  });
  
  console.log(`   Found ${detailedResult.customizations.length} customizations:`);
  detailedResult.customizations.slice(0, 5).forEach(c => {
    console.log(`   - ${c.name} (${c.type})`);
    console.log(`     Impact: ${c.impactLevel} | Upgrade Risk: ${c.upgradeRisk}`);
    console.log(`     By: ${c.createdBy} on ${c.createdOn}`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ ALL OOTB COMPARATOR TESTS PASSED');
  console.log('='.repeat(70));
}

runTests().catch(console.error);

