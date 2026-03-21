/**
 * Test Case Generator
 * Generates comprehensive test cases from requirements spec and design documents.
 */

import { logger } from '../utils/logger.js';
import { POSITIVE_PATTERNS, NEGATIVE_PATTERNS, INTEGRATION_PATTERNS, SECURITY_PATTERNS } from './test-patterns.js';

/**
 * Builds structured test cases from parsed spec and design objects.
 */
export class TestCaseGenerator {
  /**
   * @param {object} spec - Parsed specification (e.g. requirements list)
   * @param {object} design - Parsed design (artifacts, integrations, security)
   */
  constructor(spec, design) {
    this.spec = spec;
    this.design = design;
    this.testCases = [];
    this.counter = 0;
  }

  /**
   * Run all generators and return the collected test cases.
   * @returns {object[]}
   */
  generate() {
    logger.info('Generating test cases...');

    this.generatePositiveTests();
    this.generateNegativeTests();
    this.generateIntegrationTests();
    this.generateSecurityTests();

    logger.success(`Generated ${this.testCases.length} test cases ` +
      `(${this.testCases.filter(t => t.category === 'positive').length} positive, ` +
      `${this.testCases.filter(t => t.category === 'negative').length} negative, ` +
      `${this.testCases.filter(t => t.category === 'integration').length} integration, ` +
      `${this.testCases.filter(t => t.category === 'security').length} security)`);

    return this.testCases;
  }

  generatePositiveTests() {
    const artifacts = this.design?.artifacts || [];
    const requirements = this.spec?.requirements || [];

    requirements.forEach(req => {
      const reqId = req.id || req.ID || `REQ-${this.counter}`;
      POSITIVE_PATTERNS.forEach(pattern => {
        if (pattern.appliesTo(req, artifacts)) {
          this.testCases.push(this.createTestCase({
            name: `${pattern.name}: ${req.description || req.Requirement || reqId}`,
            category: 'positive',
            type: 'functional',
            priority: req.priority || req.Priority || 'medium',
            requirementId: reqId,
            preconditions: pattern.generatePreconditions({ requirement: req, artifacts }),
            steps: pattern.generateSteps({ requirement: req, artifacts }),
            expectedResults: pattern.generateExpectedResults({ requirement: req, artifacts }),
            automation: this.determineAutomation(pattern, artifacts)
          }));
        }
      });
    });

    if (requirements.length === 0) {
      artifacts.forEach(artifact => {
        this.testCases.push(this.createTestCase({
          name: `Verify ${artifact.name} basic functionality`,
          category: 'positive',
          type: 'functional',
          priority: 'high',
          requirementId: 'N/A',
          preconditions: [`${artifact.name} is deployed and active`],
          steps: [
            { action: `Trigger ${artifact.type}: ${artifact.name}`, expected: 'Artifact executes without errors' },
            { action: 'Verify expected behavior', expected: 'Output matches design specification' }
          ],
          expectedResults: [`${artifact.name} functions as designed`],
          automation: 'ATF'
        }));
      });
    }
  }

  generateNegativeTests() {
    const artifacts = this.design?.artifacts || [];

    artifacts.forEach(artifact => {
      NEGATIVE_PATTERNS.forEach(pattern => {
        if (pattern.appliesTo(artifact)) {
          this.testCases.push(this.createTestCase({
            name: `${pattern.name}: ${artifact.name}`,
            category: 'negative',
            type: pattern.type || 'error_handling',
            priority: pattern.priority || 'medium',
            requirementId: 'N/A',
            preconditions: pattern.generatePreconditions({ artifact }),
            steps: pattern.generateSteps({ artifact }),
            expectedResults: pattern.generateExpectedResults({ artifact }),
            automation: this.determineAutomation(pattern, [artifact])
          }));
        }
      });
    });
  }

  generateIntegrationTests() {
    const integrations = [
      ...(this.design?.integrations?.internal || []),
      ...(this.design?.integrations?.external || [])
    ];

    if (integrations.length === 0) return;

    INTEGRATION_PATTERNS.forEach(pattern => {
      integrations.forEach(integration => {
        if (pattern.appliesTo(integration)) {
          this.testCases.push(this.createTestCase({
            name: `${pattern.name}: ${integration.system || integration.System}`,
            category: 'integration',
            type: 'integration',
            priority: 'high',
            requirementId: 'N/A',
            preconditions: pattern.generatePreconditions({ integration }),
            steps: pattern.generateSteps({ integration }),
            expectedResults: pattern.generateExpectedResults({ integration }),
            automation: 'Manual'
          }));
        }
      });
    });
  }

  generateSecurityTests() {
    const security = this.design?.security || {};
    const roles = security.roles || [];
    const acls = security.acls || [];
    const artifacts = this.design?.artifacts || [];

    SECURITY_PATTERNS.forEach(pattern => {
      if (pattern.appliesTo({ roles, acls, artifacts })) {
        this.testCases.push(this.createTestCase({
          name: pattern.name,
          category: 'security',
          type: 'security',
          priority: 'high',
          requirementId: 'N/A',
          preconditions: pattern.generatePreconditions({ roles, acls, artifacts }),
          steps: pattern.generateSteps({ roles, acls, artifacts }),
          expectedResults: pattern.generateExpectedResults({ roles, acls, artifacts }),
          automation: 'ATF'
        }));
      }
    });
  }

  /**
   * @param {object} data - Test case fields
   * @returns {object}
   */
  createTestCase(data) {
    this.counter++;
    return {
      id: `TC-${String(this.counter).padStart(3, '0')}`,
      name: data.name,
      category: data.category,
      type: data.type,
      priority: this.normalizePriority(data.priority),
      requirementId: data.requirementId,
      preconditions: data.preconditions || [],
      steps: data.steps || [],
      expectedResults: data.expectedResults || [],
      automation: data.automation || 'Manual',
      status: 'Not Executed'
    };
  }

  /**
   * @param {string} priority
   * @returns {'High'|'Medium'|'Low'}
   */
  normalizePriority(priority) {
    const p = (priority || 'medium').toLowerCase();
    if (['high', 'critical', 'p1'].includes(p)) return 'High';
    if (['low', 'p3', 'p4'].includes(p)) return 'Low';
    return 'Medium';
  }

  /**
   * @param {object} pattern
   * @param {object[]} artifacts
   * @returns {'ATF'|'Manual'}
   */
  determineAutomation(pattern, artifacts) {
    const serverSide = artifacts.some(a =>
      ['business_rule', 'script_include', 'scheduled_job'].includes(a.type));
    if (serverSide) return 'ATF';
    return 'Manual';
  }

  /**
   * @returns {string} Markdown document for all generated cases
   */
  toMarkdown() {
    let md = '## Test Cases\n\n';
    const categories = ['positive', 'negative', 'integration', 'security'];

    categories.forEach(cat => {
      const cases = this.testCases.filter(tc => tc.category === cat);
      if (cases.length === 0) return;

      md += `### ${cat.charAt(0).toUpperCase() + cat.slice(1)} Test Cases\n\n`;
      cases.forEach(tc => {
        md += `#### ${tc.id}: ${tc.name}\n\n`;
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
          const action = typeof s === 'string' ? s : s.action;
          const expected = typeof s === 'string' ? 'Verify behavior' : s.expected;
          md += `| ${i + 1} | ${action} | ${expected} |\n`;
        });
        md += '\n';
      });
    });

    return md;
  }
}

export default TestCaseGenerator;
