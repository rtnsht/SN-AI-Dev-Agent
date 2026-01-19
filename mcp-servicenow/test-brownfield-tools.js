#!/usr/bin/env node
/**
 * Test script for Step 1 Brownfield Enhancement Tools
 * Tests all 6 MCP tools for Deep Instance Intelligence
 */

import * as dotenv from 'dotenv';
import { ServiceNowClient } from './dist/client/sn-client.js';

// Import brownfield tools
import * as instanceAnalyzer from './dist/tools/instance-analyzer.js';
import * as ootbOverrideDetector from './dist/tools/ootb-override-detector.js';
import * as dependencyGraph from './dist/tools/dependency-graph.js';
import * as antiPatternDetector from './dist/tools/anti-pattern-detector.js';
import * as codeQualityAnalyzer from './dist/tools/code-quality-analyzer.js';
import * as deadCodeFinder from './dist/tools/dead-code-finder.js';

dotenv.config();

const config = {
  instanceUrl: process.env.SN_INSTANCE_URL,
  username: process.env.SN_USERNAME,
  password: process.env.SN_PASSWORD
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 Testing Step 1: Deep Instance Intelligence Tools');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Instance: ${config.instanceUrl}`);
console.log('');

const client = new ServiceNowClient(config);

// Track results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

async function runTest(name, testFn) {
  console.log(`\n▶️  Testing: ${name}`);
  console.log('─'.repeat(60));
  
  const startTime = Date.now();
  try {
    const result = await testFn();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.success) {
      console.log(`   ✅ PASSED (${elapsed}s)`);
      results.passed++;
      results.tests.push({ name, status: 'PASSED', elapsed, summary: result.summary || {} });
    } else {
      console.log(`   ❌ FAILED: ${result.error || 'Unknown error'}`);
      results.failed++;
      results.tests.push({ name, status: 'FAILED', error: result.error });
    }
    
    // Show summary info
    if (result.summary) {
      console.log('   Summary:', JSON.stringify(result.summary, null, 2).split('\n').slice(0, 10).join('\n   '));
    }
    
    return result;
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   ❌ ERROR (${elapsed}s): ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'ERROR', error: error.message });
    return { success: false, error: error.message };
  }
}

async function main() {
  // First test connection
  console.log('🔌 Testing connection...');
  const connResult = await client.testConnection();
  if (!connResult.success) {
    console.log(`❌ Connection failed: ${connResult.message}`);
    process.exit(1);
  }
  console.log('✅ Connected successfully\n');

  // Test 1: sn_analyze_instance
  await runTest('sn_analyze_instance', async () => {
    return await instanceAnalyzer.analyzeInstance(client, {
      categories: ['scripts', 'integrations'],
      includeHealth: true,
      limit: 20
    });
  });

  // Test 2: sn_detect_ootb_overrides  
  await runTest('sn_detect_ootb_overrides', async () => {
    return await ootbOverrideDetector.detectOotbOverrides(client, {
      includeSkippedUpdates: false,
      limit: 20
    });
  });

  // Test 3: sn_get_dependency_graph
  await runTest('sn_get_dependency_graph', async () => {
    return await dependencyGraph.getDependencyGraph(client, {
      includeTableDependencies: true,
      limit: 20
    });
  });

  // Test 4: sn_find_anti_patterns
  await runTest('sn_find_anti_patterns', async () => {
    return await antiPatternDetector.findAntiPatterns(client, {
      categories: ['performance', 'security'],
      limit: 20
    });
  });

  // Test 5: sn_code_quality_score
  await runTest('sn_code_quality_score', async () => {
    return await codeQualityAnalyzer.getCodeQualityScore(client, {
      artifactType: 'script_include',
      includeDetails: false,
      limit: 20
    });
  });

  // Test 6: sn_find_dead_code
  await runTest('sn_find_dead_code', async () => {
    return await deadCodeFinder.findDeadCode(client, {
      artifactTypes: ['script_includes'],
      includeInactive: true,
      checkReferences: false, // Faster for testing
      limit: 20
    });
  });

  // Print final summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   ✅ Passed: ${results.passed}/6`);
  console.log(`   ❌ Failed: ${results.failed}/6`);
  console.log('');
  
  for (const test of results.tests) {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`   ${icon} ${test.name}: ${test.status}${test.elapsed ? ` (${test.elapsed}s)` : ''}`);
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

