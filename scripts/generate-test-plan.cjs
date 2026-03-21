#!/usr/bin/env node
/**
 * Test Plan Generator
 * Reads spec + design docs, generates comprehensive test cases,
 * and populates the test plan with categorized positive/negative tests.
 *
 * Usage:
 *   node scripts/generate-test-plan.cjs --req REQ-001
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let reqId = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--req' && args[i + 1]) {
    reqId = args[i + 1];
    i++;
  }
}

if (!reqId) {
  console.error('Usage: node scripts/generate-test-plan.cjs --req REQ-XXX');
  process.exit(1);
}

const specsDir = path.join(__dirname, '..', 'specs', reqId);
const specPath = path.join(specsDir, '1-spec.md');
const designPath = path.join(specsDir, '2-design.md');
const testingDir = path.join(specsDir, '4-testing');
const testPlanPath = path.join(testingDir, 'test-plan.md');

// Ensure testing directory exists
if (!fs.existsSync(testingDir)) {
  fs.mkdirSync(testingDir, { recursive: true });
  console.log(`Created: ${testingDir}`);
}

// Parse requirements from spec
function parseRequirements(content) {
  const requirements = [];
  const lines = content.split('\n');
  let inTable = false;
  let headers = [];

  for (const line of lines) {
    if (line.trim().startsWith('|') && !inTable) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.some(c => c.toLowerCase().includes('requirement') || c.toLowerCase() === 'id')) {
        headers = cells;
        inTable = true;
        continue;
      }
    }

    if (inTable && line.trim().match(/^\|[\s-:|]+\|$/)) continue;

    if (inTable && line.trim().startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i] || ''; });
        const id = row['ID'] || row['id'] || row['#'] || `REQ-${requirements.length + 1}`;
        const desc = row['Requirement'] || row['requirement'] || row['Description'] || row['description'] || '';
        const priority = row['Priority'] || row['priority'] || 'Medium';
        if (desc) {
          requirements.push({ id: id.trim(), description: desc.trim(), priority: priority.trim() });
        }
      }
    }

    if (inTable && !line.trim().startsWith('|') && line.trim() !== '') {
      inTable = false;
    }
  }

  return requirements;
}

// Parse artifacts from design
function parseArtifacts(content) {
  const artifacts = [];
  const lines = content.split('\n');
  let inSection = false;
  let headerDone = false;

  for (const line of lines) {
    if (/^#{1,4}\s/.test(line)) {
      if (line.includes('4.2') || line.includes('Summary Table')) {
        inSection = true;
        headerDone = false;
        continue;
      }
      if (inSection && (line.includes('4.3') || line.includes('Deployment'))) break;
    }
    if (!inSection) continue;

    if (line.trim().startsWith('|') && !headerDone) {
      headerDone = true;
      continue;
    }
    if (headerDone && line.trim().match(/^\|[\s-:|]+\|$/)) continue;

    if (headerDone && line.trim().startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2 && cells[0]) {
        const typeMap = {
          'Script Include': 'script_include', 'Business Rule': 'business_rule',
          'Client Script': 'client_script', 'UI Policy': 'ui_policy',
          'Flow': 'flow', 'Custom Field': 'field', 'Custom Table': 'table'
        };
        artifacts.push({
          name: cells[0],
          type: typeMap[cells[1]] || cells[1].toLowerCase().replace(/\s+/g, '_'),
          table: cells[2] || '',
          description: cells[cells.length - 1] || ''
        });
      }
    }
  }
  return artifacts;
}

// Generate test cases
function generateTestCases(requirements, artifacts) {
  const testCases = [];
  let counter = 0;

  // Positive: one per requirement
  requirements.forEach(req => {
    counter++;
    testCases.push({
      id: `TC-P${String(counter).padStart(3, '0')}`,
      name: `Happy path: ${req.description.substring(0, 60)}`,
      category: 'positive', type: 'Functional',
      priority: req.priority, automation: 'ATF',
      requirementId: req.id,
      preconditions: ['User logged in with appropriate role', 'Target record exists'],
      steps: [
        { action: `Execute: ${req.description.substring(0, 80)}`, expected: 'Completes without errors' },
        { action: 'Verify expected outcome', expected: 'Matches acceptance criteria' }
      ]
    });
  });

  // Positive: boundary per artifact with scripts
  artifacts.filter(a => ['business_rule', 'client_script', 'script_include'].includes(a.type)).forEach(a => {
    counter++;
    testCases.push({
      id: `TC-P${String(counter).padStart(3, '0')}`,
      name: `Boundary valid input: ${a.name}`,
      category: 'positive', type: 'Functional',
      priority: 'Medium', automation: 'ATF',
      requirementId: 'N/A',
      preconditions: [`${a.name} is active`],
      steps: [
        { action: `Trigger ${a.name} with min valid input`, expected: 'Accepted' },
        { action: `Trigger ${a.name} with max valid input`, expected: 'Accepted' }
      ]
    });
  });

  // Negative: null/empty per scripted artifact
  artifacts.filter(a => ['business_rule', 'script_include', 'client_script'].includes(a.type)).forEach(a => {
    counter++;
    testCases.push({
      id: `TC-N${String(counter).padStart(3, '0')}`,
      name: `Null/empty input: ${a.name}`,
      category: 'negative', type: 'Error Handling',
      priority: 'High', automation: 'Manual',
      requirementId: 'N/A',
      preconditions: [`${a.name} is deployed and active`],
      steps: [
        { action: `Trigger ${a.name} with null/empty fields`, expected: 'Handles gracefully' },
        { action: 'Check logs for unhandled exceptions', expected: 'No stack traces' }
      ]
    });
  });

  // Negative: unauthorized access per artifact
  artifacts.forEach(a => {
    counter++;
    testCases.push({
      id: `TC-N${String(counter).padStart(3, '0')}`,
      name: `Unauthorized access: ${a.name}`,
      category: 'negative', type: 'Security',
      priority: 'High', automation: 'Manual',
      requirementId: 'N/A',
      preconditions: [`${a.name} is active`, 'User lacks required role'],
      steps: [
        { action: `Attempt to trigger ${a.name} as unauthorized user`, expected: 'Access denied' }
      ]
    });
  });

  // Security: BLOCK-tier check
  const scripted = artifacts.filter(a => ['business_rule', 'script_include', 'client_script'].includes(a.type));
  if (scripted.length > 0) {
    counter++;
    testCases.push({
      id: `TC-S${String(counter).padStart(3, '0')}`,
      name: 'BLOCK-tier pattern validation',
      category: 'security', type: 'Security',
      priority: 'High', automation: 'ATF',
      requirementId: 'N/A',
      preconditions: ['All scripts deployed'],
      steps: [
        { action: 'Scan scripts for eval()/new Function()', expected: 'None found' },
        { action: 'Check for Packages.java.* usage', expected: 'None found' },
        { action: 'Check for hardcoded credentials', expected: 'None found' },
        { action: 'Check for GlideRecord in client scripts', expected: 'Uses GlideAjax' }
      ]
    });
  }

  // Security: PII check
  counter++;
  testCases.push({
    id: `TC-S${String(counter).padStart(3, '0')}`,
    name: 'PII/sensitive data exposure check',
    category: 'security', type: 'Security',
    priority: 'High', automation: 'Manual',
    requirementId: 'N/A',
    preconditions: ['All artifacts deployed'],
    steps: [
      { action: 'Review system logs for PII', expected: 'No sensitive data' },
      { action: 'Check g_scratchpad for secrets', expected: 'No credentials leaked' },
      { action: 'Review REST responses', expected: 'Only expected fields' }
    ]
  });

  return testCases;
}

// Build markdown
function buildTestPlanMarkdown(reqId, requirements, artifacts, testCases) {
  const today = new Date().toISOString().split('T')[0];
  const positive = testCases.filter(tc => tc.category === 'positive');
  const negative = testCases.filter(tc => tc.category === 'negative');
  const security = testCases.filter(tc => tc.category === 'security');
  const total = testCases.length;
  const negRatio = total > 0 ? Math.round((negative.length / total) * 100) : 0;

  let md = `# ${reqId}: Test Plan\n\n`;
  md += `## Document Control\n\n`;
  md += `| Field | Value |\n|-------|-------|\n`;
  md += `| **Requirement ID** | ${reqId} |\n`;
  md += `| **Author** | AI Agent |\n`;
  md += `| **Created** | ${today} |\n`;
  md += `| **Version** | 1.0 |\n\n---\n\n`;

  md += `## Test Coverage Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Test Cases | ${total} |\n`;
  md += `| Positive | ${positive.length} |\n`;
  md += `| Negative | ${negative.length} (${negRatio}%) |\n`;
  md += `| Security | ${security.length} |\n`;
  md += `| Negative Threshold (>=40%) | ${negRatio >= 40 ? '✅ Met' : '❌ Not met'} |\n\n---\n\n`;

  // Coverage matrix
  md += `## Coverage Matrix\n\n`;
  md += `| Requirement | Test Cases | Covered |\n|-------------|------------|--------|\n`;
  requirements.forEach(req => {
    const cases = testCases.filter(tc => tc.requirementId === req.id);
    md += `| ${req.id} | ${cases.map(c => c.id).join(', ') || 'None'} | ${cases.length > 0 ? '✅' : '❌'} |\n`;
  });
  md += '\n---\n\n';

  // Test cases by category
  const categories = [
    { key: 'positive', label: 'Positive Test Cases', cases: positive },
    { key: 'negative', label: 'Negative Test Cases', cases: negative },
    { key: 'security', label: 'Security Test Cases', cases: security }
  ];

  categories.forEach(({ label, cases }) => {
    if (cases.length === 0) return;
    md += `## ${label}\n\n`;
    cases.forEach(tc => {
      md += `### ${tc.id}: ${tc.name}\n\n`;
      md += `| Field | Value |\n|-------|-------|\n`;
      md += `| **Priority** | ${tc.priority} |\n`;
      md += `| **Type** | ${tc.type} |\n`;
      md += `| **Automation** | ${tc.automation} |\n`;
      md += `| **Requirement** | ${tc.requirementId} |\n\n`;

      if (tc.preconditions.length > 0) {
        md += '**Preconditions:**\n';
        tc.preconditions.forEach(p => md += `- ${p}\n`);
        md += '\n';
      }

      md += '**Test Steps:**\n';
      md += '| Step | Action | Expected Result |\n|------|--------|----------------|\n';
      tc.steps.forEach((s, i) => {
        md += `| ${i + 1} | ${s.action} | ${s.expected} |\n`;
      });
      md += '\n---\n\n';
    });
  });

  return md;
}

// Main execution
console.log(`\nGenerating test plan for ${reqId}...`);

let requirements = [];
if (fs.existsSync(specPath)) {
  const specContent = fs.readFileSync(specPath, 'utf-8');
  requirements = parseRequirements(specContent);
  console.log(`Parsed ${requirements.length} requirements from spec`);
} else {
  console.log(`Spec not found: ${specPath} (will generate artifact-based tests only)`);
}

let artifacts = [];
if (fs.existsSync(designPath)) {
  const designContent = fs.readFileSync(designPath, 'utf-8');
  artifacts = parseArtifacts(designContent);
  console.log(`Parsed ${artifacts.length} artifacts from design`);
} else {
  console.log(`Design not found: ${designPath} (will generate requirement-based tests only)`);
}

if (requirements.length === 0 && artifacts.length === 0) {
  console.error('No requirements or artifacts found. Cannot generate test plan.');
  process.exit(1);
}

const testCases = generateTestCases(requirements, artifacts);
console.log(`Generated ${testCases.length} test cases`);

const total = testCases.length;
const neg = testCases.filter(tc => tc.category === 'negative').length;
console.log(`  Positive: ${testCases.filter(tc => tc.category === 'positive').length}`);
console.log(`  Negative: ${neg} (${total > 0 ? Math.round((neg / total) * 100) : 0}%)`);
console.log(`  Security: ${testCases.filter(tc => tc.category === 'security').length}`);

const markdown = buildTestPlanMarkdown(reqId, requirements, artifacts, testCases);
fs.writeFileSync(testPlanPath, markdown, 'utf-8');
console.log(`\nTest plan written to: ${testPlanPath}`);
console.log('Done.');
