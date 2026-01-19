#!/usr/bin/env node
/**
 * Test remaining brownfield tools
 */

import * as dotenv from 'dotenv';
import { ServiceNowClient } from './dist/client/sn-client.js';

import * as ootbOverrideDetector from './dist/tools/ootb-override-detector.js';
import * as dependencyGraph from './dist/tools/dependency-graph.js';

dotenv.config();

const config = {
  instanceUrl: process.env.SN_INSTANCE_URL,
  username: process.env.SN_USERNAME,
  password: process.env.SN_PASSWORD
};

const client = new ServiceNowClient(config);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔬 TESTING OOTB OVERRIDES & DEPENDENCY GRAPH');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Test 1: OOTB Override Detection with all options
  console.log('1️⃣  sn_detect_ootb_overrides (with skipped updates)');
  console.log('─'.repeat(60));
  const overrideResult = await ootbOverrideDetector.detectOotbOverrides(client, {
    includeSkippedUpdates: true,
    includeReplaceOnUpgrade: true,
    limit: 100
  });
  console.log(`   Total Overrides: ${overrideResult.summary.totalOverrides}`);
  console.log(`   Upgrade Risk Score: ${overrideResult.summary.upgradeRiskScore}/100`);
  console.log(`   Skipped Updates: ${overrideResult.summary.skippedUpdatesCount}`);
  console.log(`   By Severity:`);
  console.log(`      Critical: ${overrideResult.summary.criticalCount}`);
  console.log(`      High: ${overrideResult.summary.highCount}`);
  console.log(`      Medium: ${overrideResult.summary.mediumCount}`);
  console.log(`      Low: ${overrideResult.summary.lowCount}`);
  
  if (Object.keys(overrideResult.summary.overridesByType || {}).length > 0) {
    console.log(`   By Type:`);
    for (const [type, count] of Object.entries(overrideResult.summary.overridesByType)) {
      if (count > 0) console.log(`      - ${type}: ${count}`);
    }
  }
  
  if (overrideResult.recommendations && overrideResult.recommendations.length > 0) {
    console.log(`\n   Recommendations:`);
    for (const rec of overrideResult.recommendations.slice(0, 3)) {
      console.log(`      • ${rec}`);
    }
  }

  // Test 2: Dependency Graph with table dependencies
  console.log('\n2️⃣  sn_get_dependency_graph (with table dependencies)');
  console.log('─'.repeat(60));
  const graphResult = await dependencyGraph.getDependencyGraph(client, {
    includeTableDependencies: true,
    limit: 100
  });
  console.log(`   Total Nodes: ${graphResult.summary.totalNodes}`);
  console.log(`   Total Edges: ${graphResult.summary.totalEdges}`);
  
  if (Object.keys(graphResult.summary.nodesByType || {}).length > 0) {
    console.log(`   Nodes by Type:`);
    for (const [type, count] of Object.entries(graphResult.summary.nodesByType)) {
      console.log(`      - ${type}: ${count}`);
    }
  }
  
  if (Object.keys(graphResult.summary.edgesByType || {}).length > 0) {
    console.log(`   Edges by Type:`);
    for (const [type, count] of Object.entries(graphResult.summary.edgesByType)) {
      console.log(`      - ${type}: ${count}`);
    }
  }
  
  if (graphResult.summary.highlyConnected && graphResult.summary.highlyConnected.length > 0) {
    console.log(`\n   Highly Connected Artifacts:`);
    for (const item of graphResult.summary.highlyConnected.slice(0, 5)) {
      console.log(`      • ${item.name} (${item.type}): ${item.connectionCount} connections`);
    }
  }
  
  if (graphResult.summary.orphanedArtifacts && graphResult.summary.orphanedArtifacts.length > 0) {
    console.log(`\n   Orphaned Artifacts (no dependencies): ${graphResult.summary.orphanedArtifacts.length}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ OOTB Override & Dependency Graph tests completed!');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

