/**
 * Test Case Categorizer
 * Categorizes test cases by type, priority, automation status, and requirement coverage.
 */

import { logger } from '../utils/logger.js';

export class TestCategorizer {
  constructor() {
    this.categories = {};
  }

  categorize(testCases) {
    logger.info(`Categorizing ${testCases.length} test cases...`);

    const result = {
      byType: this.groupBy(testCases, 'type'),
      byPriority: this.groupBy(testCases, 'priority'),
      byCategory: this.groupBy(testCases, 'category'),
      byAutomation: this.groupBy(testCases, 'automation'),
      coverageMatrix: this.buildCoverageMatrix(testCases),
      summary: this.buildSummary(testCases)
    };

    logger.success(`Categorization complete: ${Object.keys(result.byType).length} types, ` +
      `${Object.keys(result.coverageMatrix).length} requirements covered`);

    return result;
  }

  groupBy(testCases, field) {
    const groups = {};
    testCases.forEach(tc => {
      const key = tc[field] || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(tc);
    });
    return groups;
  }

  buildCoverageMatrix(testCases) {
    const matrix = {};
    testCases.forEach(tc => {
      const reqId = tc.requirementId;
      if (reqId && reqId !== 'N/A') {
        if (!matrix[reqId]) matrix[reqId] = [];
        matrix[reqId].push(tc.id);
      }
    });
    return matrix;
  }

  buildSummary(testCases) {
    const total = testCases.length;
    const positive = testCases.filter(tc => tc.category === 'positive').length;
    const negative = testCases.filter(tc => tc.category === 'negative').length;
    const integration = testCases.filter(tc => tc.category === 'integration').length;
    const security = testCases.filter(tc => tc.category === 'security').length;

    const highPriority = testCases.filter(tc => tc.priority === 'High').length;
    const automated = testCases.filter(tc => tc.automation === 'ATF').length;

    const negativeRatio = total > 0 ? Math.round((negative / total) * 100) : 0;
    const meetsNegativeThreshold = negativeRatio >= 40;

    const coveredReqs = new Set(
      testCases.filter(tc => tc.requirementId && tc.requirementId !== 'N/A')
        .map(tc => tc.requirementId)
    );

    return {
      total,
      positive,
      negative,
      integration,
      security,
      highPriority,
      automated,
      manual: total - automated,
      negativeRatio,
      meetsNegativeThreshold,
      coveredRequirements: coveredReqs.size,
      uncoveredRequirements: []
    };
  }

  validateCoverage(testCases, requirementIds) {
    const covered = new Set(
      testCases.filter(tc => tc.requirementId && tc.requirementId !== 'N/A')
        .map(tc => tc.requirementId)
    );

    const uncovered = requirementIds.filter(id => !covered.has(id));
    const issues = [];

    if (uncovered.length > 0) {
      issues.push(`${uncovered.length} requirement(s) have no test cases: ${uncovered.join(', ')}`);
    }

    const total = testCases.length;
    const negative = testCases.filter(tc => tc.category === 'negative').length;
    const negativeRatio = total > 0 ? (negative / total) * 100 : 0;

    if (negativeRatio < 40) {
      issues.push(`Negative test ratio is ${Math.round(negativeRatio)}% (minimum 40% required)`);
    }

    requirementIds.forEach(reqId => {
      const casesForReq = testCases.filter(tc => tc.requirementId === reqId);
      if (casesForReq.length > 0 && casesForReq.length < 5) {
        issues.push(`${reqId} has only ${casesForReq.length} test case(s) (minimum 5 recommended)`);
      }
    });

    return {
      valid: issues.length === 0,
      issues,
      covered: covered.size,
      total: requirementIds.length,
      uncovered
    };
  }

  toMarkdownSummary(categorization) {
    const s = categorization.summary;
    let md = '## Test Coverage Summary\n\n';
    md += '| Metric | Value |\n|--------|-------|\n';
    md += `| Total Test Cases | ${s.total} |\n`;
    md += `| Positive | ${s.positive} |\n`;
    md += `| Negative | ${s.negative} (${s.negativeRatio}%) |\n`;
    md += `| Integration | ${s.integration} |\n`;
    md += `| Security | ${s.security} |\n`;
    md += `| High Priority | ${s.highPriority} |\n`;
    md += `| Automated (ATF) | ${s.automated} |\n`;
    md += `| Manual | ${s.manual} |\n`;
    md += `| Negative Threshold (>=40%) | ${s.meetsNegativeThreshold ? '✅ Met' : '❌ Not met'} |\n`;
    md += `| Requirements Covered | ${s.coveredRequirements} |\n\n`;

    if (Object.keys(categorization.coverageMatrix).length > 0) {
      md += '## Coverage Matrix\n\n';
      md += '| Requirement | Test Cases |\n|-------------|------------|\n';
      Object.entries(categorization.coverageMatrix).forEach(([reqId, tcIds]) => {
        md += `| ${reqId} | ${tcIds.join(', ')} |\n`;
      });
      md += '\n';
    }

    return md;
  }
}

export default TestCategorizer;
