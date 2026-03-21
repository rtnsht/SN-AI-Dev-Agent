/**
 * Negative Test Generator
 * Generates failure-scenario test cases: invalid inputs, error conditions,
 * security violations, edge cases, and boundary violations.
 */

import { logger } from '../utils/logger.js';
import { NEGATIVE_PATTERNS } from './test-patterns.js';

export class NegativeTestGenerator {
  constructor(artifacts, security) {
    this.artifacts = artifacts || [];
    this.security = security || {};
    this.testCases = [];
    this.counter = 0;
  }

  generate() {
    logger.info('Generating negative test cases...');

    this.generateFromPatterns();
    this.generateArtifactSpecific();

    logger.info(`Generated ${this.testCases.length} negative test cases`);
    return this.testCases;
  }

  generateFromPatterns() {
    this.artifacts.forEach(artifact => {
      NEGATIVE_PATTERNS.forEach(pattern => {
        if (pattern.appliesTo(artifact)) {
          this.testCases.push(this.createCase({
            name: `${pattern.name}: ${artifact.name}`,
            type: pattern.type || 'error_handling',
            priority: pattern.priority || 'medium',
            preconditions: pattern.generatePreconditions({ artifact }),
            steps: pattern.generateSteps({ artifact }),
            expectedResults: pattern.generateExpectedResults({ artifact })
          }));
        }
      });
    });
  }

  generateArtifactSpecific() {
    this.artifacts.forEach(artifact => {
      switch (artifact.type) {
        case 'business_rule':
          this.generateBusinessRuleNegatives(artifact);
          break;
        case 'script_include':
          this.generateScriptIncludeNegatives(artifact);
          break;
        case 'client_script':
          this.generateClientScriptNegatives(artifact);
          break;
        case 'ui_policy':
          this.generateUIPolicyNegatives(artifact);
          break;
      }
    });
  }

  generateBusinessRuleNegatives(artifact) {
    this.testCases.push(this.createCase({
      name: `BR abort scenario: ${artifact.name}`,
      type: 'error_handling',
      priority: 'high',
      preconditions: [`${artifact.name} is active`, 'Record fails business rule condition'],
      steps: [
        { action: `Submit record that should be rejected by ${artifact.name}`, expected: 'Operation aborted with message' },
        { action: 'Verify abort message is user-friendly', expected: 'Clear error displayed' }
      ],
      expectedResults: ['Record is not saved', 'User sees descriptive error message']
    }));
  }

  generateScriptIncludeNegatives(artifact) {
    this.testCases.push(this.createCase({
      name: `SI exception path: ${artifact.name}`,
      type: 'error_handling',
      priority: 'medium',
      preconditions: [`${artifact.name} is deployed`],
      steps: [
        { action: `Call ${artifact.name} with undefined parameters`, expected: 'Returns error/default value' },
        { action: 'Check for unhandled exceptions in logs', expected: 'No unhandled exceptions' }
      ],
      expectedResults: ['Script returns gracefully', 'No stack trace in system logs']
    }));
  }

  generateClientScriptNegatives(artifact) {
    this.testCases.push(this.createCase({
      name: `CS empty form: ${artifact.name}`,
      type: 'error_handling',
      priority: 'medium',
      preconditions: [`${artifact.name} is active`, 'Form is loaded with no data'],
      steps: [
        { action: 'Open a new record form (all fields empty)', expected: 'No JS console errors' },
        { action: `Verify ${artifact.name} handles empty form state`, expected: 'No crashes or infinite loops' }
      ],
      expectedResults: ['Client script handles empty form gracefully', 'No JavaScript errors in console']
    }));
  }

  generateUIPolicyNegatives(artifact) {
    this.testCases.push(this.createCase({
      name: `UI Policy conflict: ${artifact.name}`,
      type: 'error_handling',
      priority: 'medium',
      preconditions: [`${artifact.name} is active`, 'Another UI policy targets the same fields'],
      steps: [
        { action: 'Set field values that trigger conflicting UI policies', expected: 'No flickering or contradictions' },
        { action: 'Verify final field state is deterministic', expected: 'Higher-order policy wins' }
      ],
      expectedResults: ['UI policies resolve without visual glitches', 'Field state is consistent']
    }));
  }

  createCase(data) {
    this.counter++;
    return {
      id: `TC-N${String(this.counter).padStart(3, '0')}`,
      name: data.name,
      category: 'negative',
      type: data.type,
      priority: this.normalizePriority(data.priority),
      requirementId: 'N/A',
      preconditions: data.preconditions || [],
      steps: data.steps || [],
      expectedResults: data.expectedResults || [],
      automation: 'Manual',
      status: 'Not Executed'
    };
  }

  normalizePriority(p) {
    const val = (p || 'medium').toLowerCase();
    if (['high', 'critical', 'p1'].includes(val)) return 'High';
    if (['low', 'p3', 'p4'].includes(val)) return 'Low';
    return 'Medium';
  }
}

export default NegativeTestGenerator;
