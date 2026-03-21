/**
 * Positive Test Generator
 * Maps functional requirements to positive test cases covering happy paths,
 * valid boundary inputs, data variations, and role-based success scenarios.
 */

import { logger } from '../utils/logger.js';
import { POSITIVE_PATTERNS } from './test-patterns.js';

export class PositiveTestGenerator {
  constructor(requirements, artifacts) {
    this.requirements = requirements || [];
    this.artifacts = artifacts || [];
    this.testCases = [];
    this.counter = 0;
  }

  generate() {
    logger.info('Generating positive test cases...');

    this.generateFromRequirements();
    this.generateFromArtifacts();

    logger.info(`Generated ${this.testCases.length} positive test cases`);
    return this.testCases;
  }

  generateFromRequirements() {
    this.requirements.forEach(req => {
      const reqId = req.id || req.ID || 'N/A';

      POSITIVE_PATTERNS.forEach(pattern => {
        if (pattern.appliesTo(req, this.artifacts)) {
          this.testCases.push(this.createCase({
            name: `${pattern.name}: ${req.description || req.Requirement || reqId}`,
            type: 'functional',
            priority: req.priority || req.Priority || 'medium',
            requirementId: reqId,
            preconditions: pattern.generatePreconditions({ requirement: req, artifacts: this.artifacts }),
            steps: pattern.generateSteps({ requirement: req, artifacts: this.artifacts }),
            expectedResults: pattern.generateExpectedResults({ requirement: req, artifacts: this.artifacts })
          }));
        }
      });
    });
  }

  generateFromArtifacts() {
    const crudArtifacts = this.artifacts.filter(a =>
      ['business_rule', 'script_include', 'ui_policy', 'client_script'].includes(a.type));

    crudArtifacts.forEach(artifact => {
      const hasTest = this.testCases.some(tc =>
        tc.name.includes(artifact.name));

      if (!hasTest) {
        this.testCases.push(this.createCase({
          name: `Verify ${artifact.name} executes correctly`,
          type: 'functional',
          priority: 'high',
          requirementId: 'N/A',
          preconditions: [
            `${artifact.name} is deployed and active`,
            `User has appropriate role for ${artifact.table || 'target table'}`
          ],
          steps: [
            { action: `Trigger ${artifact.type}: ${artifact.name}`, expected: 'Executes without errors' },
            { action: 'Verify expected outcome', expected: 'Behavior matches design specification' }
          ],
          expectedResults: [`${artifact.name} produces correct output`]
        }));
      }
    });
  }

  createCase(data) {
    this.counter++;
    return {
      id: `TC-P${String(this.counter).padStart(3, '0')}`,
      name: data.name,
      category: 'positive',
      type: data.type,
      priority: this.normalizePriority(data.priority),
      requirementId: data.requirementId,
      preconditions: data.preconditions || [],
      steps: data.steps || [],
      expectedResults: data.expectedResults || [],
      automation: this.artifacts.some(a => ['business_rule', 'script_include'].includes(a.type)) ? 'ATF' : 'Manual',
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

export default PositiveTestGenerator;
