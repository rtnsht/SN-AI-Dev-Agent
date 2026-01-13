/**
 * Spec Writer
 * Generates functional specifications from analyzed requirements
 */

import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export class SpecWriter {
  constructor(analysis, context = null) {
    this.analysis = analysis;
    this.context = context;
  }

  /**
   * Generate a complete functional specification
   */
  generateSpec() {
    const spec = {
      metadata: this.generateMetadata(),
      overview: this.generateOverview(),
      scope: this.generateScope(),
      functionalRequirements: this.generateFunctionalRequirements(),
      nonFunctionalRequirements: this.generateNonFunctionalRequirements(),
      assumptions: this.generateAssumptions(),
      constraints: this.generateConstraints(),
      dependencies: this.generateDependencies(),
      acceptanceCriteria: this.generateAcceptanceCriteria(),
      outOfScope: this.generateOutOfScope()
    };

    return spec;
  }

  generateMetadata() {
    return {
      specId: `SPEC-${Date.now()}`,
      requirementId: this.analysis.id,
      title: this.analysis.title,
      version: '1.0',
      status: 'Draft',
      createdDate: new Date().toISOString(),
      author: 'AI Development Assistant'
    };
  }

  generateOverview() {
    return {
      purpose: `This specification describes the implementation of: ${this.analysis.title}`,
      background: this.analysis.isGreenfield 
        ? 'This is a greenfield implementation with no existing artifacts.'
        : 'This is a brownfield implementation building on existing functionality.',
      businessValue: 'To be confirmed with stakeholders',
      originalRequirement: this.analysis.originalText
    };
  }

  generateScope() {
    const inScope = [];
    const { entities, affectedComponents } = this.analysis;

    if (entities.tables.length > 0) {
      inScope.push(`Table modifications/extensions: ${entities.tables.join(', ')}`);
    }
    if (affectedComponents) {
      affectedComponents.forEach(comp => {
        inScope.push(`${comp.type}: ${comp.reason || comp.items?.join(', ') || 'As needed'}`);
      });
    }

    return {
      inScope,
      targetTables: entities.tables,
      targetRoles: entities.roles,
      affectedModules: this.determineAffectedModules()
    };
  }

  determineAffectedModules() {
    const modules = [];
    const { entities, type } = this.analysis;

    if (entities.tables.some(t => ['incident', 'problem', 'change'].includes(t))) {
      modules.push('ITSM');
    }
    if (entities.tables.some(t => ['case', 'customer'].includes(t))) {
      modules.push('CSM');
    }
    if (entities.tables.some(t => ['cmdb', 'asset'].includes(t))) {
      modules.push('ITOM/CMDB');
    }

    return modules.length > 0 ? modules : ['Custom Application'];
  }

  generateFunctionalRequirements() {
    const requirements = [];
    const { type, entities, affectedComponents } = this.analysis;

    // Generate FRs based on requirement type
    requirements.push({
      id: 'FR-001',
      description: this.analysis.originalText,
      priority: this.analysis.priority || 'High',
      source: 'Original Requirement'
    });

    // Add component-specific requirements
    if (affectedComponents) {
      affectedComponents.forEach((comp, idx) => {
        requirements.push({
          id: `FR-${String(idx + 2).padStart(3, '0')}`,
          description: `Implement ${comp.type} for ${comp.reason || 'requirement fulfillment'}`,
          priority: 'Medium',
          source: 'Derived'
        });
      });
    }

    return requirements;
  }

  generateNonFunctionalRequirements() {
    return [
      {
        id: 'NFR-001',
        category: 'Performance',
        description: 'All business rules should execute within 1 second',
        priority: 'High'
      },
      {
        id: 'NFR-002',
        category: 'Security',
        description: 'Solution must comply with existing ACL patterns',
        priority: 'High'
      },
      {
        id: 'NFR-003',
        category: 'Maintainability',
        description: 'Code must follow ServiceNow best practices and naming conventions',
        priority: 'Medium'
      }
    ];
  }

  generateAssumptions() {
    return [
      'Required ServiceNow plugins are already activated',
      'User roles mentioned in requirements already exist',
      'Integration endpoints (if any) are accessible from the instance',
      'Necessary licenses are available for all features'
    ];
  }

  generateConstraints() {
    return [
      'Solution must be scoped to the designated application scope',
      'No modification to out-of-box ServiceNow artifacts',
      'Must be compatible with current instance version'
    ];
  }

  generateDependencies() {
    const deps = [];
    
    if (this.context?.scriptIncludes?.length > 0) {
      deps.push({
        type: 'Script Include',
        items: this.context.scriptIncludes.slice(0, 5).map(si => si.name)
      });
    }

    return deps;
  }

  generateAcceptanceCriteria() {
    const criteria = [];
    const { type, entities } = this.analysis;

    criteria.push({
      id: 'AC-001',
      description: 'All functionality works as described in the requirement',
      testable: true
    });

    if (entities.workflows.includes('automation')) {
      criteria.push({
        id: 'AC-002',
        description: 'Automation triggers correctly based on specified conditions',
        testable: true
      });
    }

    return criteria;
  }

  generateOutOfScope() {
    return [
      'Changes to existing business processes not mentioned in requirements',
      'User training and documentation (unless specified)',
      'Data migration from external systems'
    ];
  }

  /**
   * Export spec to markdown file
   */
  exportToMarkdown(outputPath) {
    const spec = this.generateSpec();
    const md = this.toMarkdown(spec);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, md);
    logger.success(`Specification exported to ${outputPath}`);
    return outputPath;
  }

  toMarkdown(spec) {
    let md = `# Functional Specification: ${spec.metadata.title}\n\n`;
    md += `**Spec ID:** ${spec.metadata.specId}\n`;
    md += `**Version:** ${spec.metadata.version}\n`;
    md += `**Status:** ${spec.metadata.status}\n`;
    md += `**Created:** ${spec.metadata.createdDate}\n\n`;
    md += `## 1. Overview\n\n${spec.overview.purpose}\n\n`;
    md += `### Background\n${spec.overview.background}\n\n`;
    md += `### Original Requirement\n> ${spec.overview.originalRequirement}\n\n`;
    md += `## 2. Scope\n\n### In Scope\n`;
    spec.scope.inScope.forEach(item => { md += `- ${item}\n`; });
    md += `\n## 3. Functional Requirements\n\n`;
    spec.functionalRequirements.forEach(fr => {
      md += `### ${fr.id}: ${fr.description}\n- Priority: ${fr.priority}\n\n`;
    });
    md += `## 4. Acceptance Criteria\n\n`;
    spec.acceptanceCriteria.forEach(ac => { md += `- [ ] ${ac.id}: ${ac.description}\n`; });
    return md;
  }
}

export default SpecWriter;

