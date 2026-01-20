#!/usr/bin/env node
/**
 * Detailed test script for Brownfield tools - checks actual data returned
 */

import * as dotenv from 'dotenv';
import { ServiceNowClient } from './dist/client/sn-client.js';

import * as instanceAnalyzer from './dist/tools/instance-analyzer.js';
import * as antiPatternDetector from './dist/tools/anti-pattern-detector.js';
import * as codeQualityAnalyzer from './dist/tools/code-quality-analyzer.js';
import * as deadCodeFinder from './dist/tools/dead-code-finder.js';

dotenv.config();

const config = {
  instanceUrl: process.env.SN_INSTANCE_URL,
  username: process.env.SN_USERNAME,
  password: process.env.SN_PASSWORD
};

const client = new ServiceNowClient(config);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔬 DETAILED BROWNFIELD TOOLS TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Test 1: Instance Analyzer with ALL categories
  console.log('1️⃣  sn_analyze_instance (all categories)');
  console.log('─'.repeat(60));
  const instanceResult = await instanceAnalyzer.analyzeInstance(client, {
    categories: ['all'],
    includeHealth: true,
    limit: 50
  });
  console.log(`   Total Artifacts: ${instanceResult.summary.totalArtifacts}`);
  console.log(`   Custom: ${instanceResult.summary.totalCustom}`);
  console.log(`   OOTB Modified: ${instanceResult.summary.totalOotbModified}`);
  console.log(`   Health Score: ${instanceResult.health?.score || 'N/A'}`);
  console.log(`   By Category:`);
  for (const [cat, count] of Object.entries(instanceResult.summary.artifactsByCategory || {})) {
    if (count > 0) console.log(`      - ${cat}: ${count}`);
  }

  // Test 2: Anti-Pattern with details
  console.log('\n2️⃣  sn_find_anti_patterns (all categories, with details)');
  console.log('─'.repeat(60));
  const antiPatternResult = await antiPatternDetector.findAntiPatterns(client, {
    categories: ['all'],
    limit: 30
  });
  console.log(`   Total Issues: ${antiPatternResult.summary.totalIssues}`);
  console.log(`   Critical: ${antiPatternResult.summary.criticalCount}`);
  console.log(`   High: ${antiPatternResult.summary.highCount}`);
  console.log(`   By Category:`);
  for (const [cat, count] of Object.entries(antiPatternResult.summary.byCategory || {})) {
    console.log(`      - ${cat}: ${count}`);
  }
  if (antiPatternResult.issues && antiPatternResult.issues.length > 0) {
    console.log(`\n   Sample Issues (first 3):`);
    for (const issue of antiPatternResult.issues.slice(0, 3)) {
      console.log(`      • [${issue.severity}] ${issue.pattern} in ${issue.artifactName}`);
    }
  }

  // Test 3: Code Quality with details
  console.log('\n3️⃣  sn_code_quality_score (with artifact details)');
  console.log('─'.repeat(60));
  const qualityResult = await codeQualityAnalyzer.getCodeQualityScore(client, {
    artifactType: 'all',
    includeDetails: true,
    limit: 30
  });
  console.log(`   Total Analyzed: ${qualityResult.summary.totalArtifacts}`);
  console.log(`   Average Score: ${qualityResult.summary.averageScore}`);
  console.log(`   Overall Grade: ${qualityResult.summary.overallGrade}`);
  console.log(`   Distribution:`);
  const dist = qualityResult.summary.scoreDistribution;
  console.log(`      A (90-100): ${dist.excellent}`);
  console.log(`      B (80-89): ${dist.good}`);
  console.log(`      C (70-79): ${dist.fair}`);
  console.log(`      D (60-69): ${dist.poor}`);
  console.log(`      F (<60): ${dist.failing}`);
  if (qualityResult.artifacts && qualityResult.artifacts.length > 0) {
    console.log(`\n   Lowest Quality Scripts:`);
    for (const artifact of qualityResult.artifacts.slice(0, 3)) {
      console.log(`      • ${artifact.name} (${artifact.type}): ${artifact.score} (${artifact.grade})`);
    }
  }

  // Test 4: Dead Code with details  
  console.log('\n4️⃣  sn_find_dead_code (all types, with references)');
  console.log('─'.repeat(60));
  const deadCodeResult = await deadCodeFinder.findDeadCode(client, {
    artifactTypes: ['all'],
    includeInactive: true,
    checkReferences: true,
    limit: 30
  });
  console.log(`   Total Found: ${deadCodeResult.summary.totalFound}`);
  console.log(`   Cleanup Effort: ${deadCodeResult.summary.estimatedCleanupEffort}`);
  console.log(`   By Confidence:`);
  console.log(`      High: ${deadCodeResult.summary.byConfidence.high}`);
  console.log(`      Medium: ${deadCodeResult.summary.byConfidence.medium}`);
  console.log(`      Low: ${deadCodeResult.summary.byConfidence.low}`);
  console.log(`   By Reason:`);
  for (const [reason, count] of Object.entries(deadCodeResult.summary.byReason || {})) {
    console.log(`      - ${reason}: ${count}`);
  }
  if (deadCodeResult.recommendations && deadCodeResult.recommendations.length > 0) {
    console.log(`\n   Recommendations:`);
    for (const rec of deadCodeResult.recommendations) {
      console.log(`      • ${rec}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ All detailed tests completed successfully!');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

