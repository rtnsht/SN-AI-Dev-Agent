/**
 * Solution Designer
 * Creates technical solution design based on analyzed requirements
 * Determines which ServiceNow artifacts need to be created
 */

import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export class SolutionDesigner {
  constructor(analysis, context = null) {
    this.analysis = analysis;
    this.context = context;
    this.solution = null;
  }

  /**
   * Design the technical solution
   */
  design() {
    logger.info('Designing technical solution...');
    
    this.solution = {
      id: `SOL-${Date.now()}`,
      requirementId: this.analysis.id,
      createdAt: new Date().toISOString(),
      
      // Architecture decisions
      architecture: this.designArchitecture(),
      
      // Artifacts to create
      artifacts: this.determineArtifacts(),
      
      // Data model changes
      dataModel: this.designDataModel(),
      
      // Integration design
      integrations: this.designIntegrations(),
      
      // Security design
      security: this.designSecurity(),
      
      // Testing strategy
      testing: this.designTestingStrategy()
    };

    logger.success('Solution design complete');
    return this.solution;
  }

  designArchitecture() {
    const { type, entities } = this.analysis;
    
    return {
      pattern: this.determinePattern(type),
      layers: this.determineLayers(),
      components: this.determineComponentArchitecture()
    };
  }

  determinePattern(type) {
    const patterns = {
      'integration': 'Integration Hub Pattern with REST/SOAP messaging',
      'automation': 'Event-Driven Pattern with Business Rules and Flows',
      'reporting': 'Analytics Pattern with Performance Analytics',
      'ui_enhancement': 'UI Component Pattern with Service Portal/Workspace',
      'security': 'Security-First Pattern with Role-Based Access',
      'notification': 'Notification Pattern with Events and Email',
      'custom_development': 'Standard SDLC Pattern'
    };
    
    return patterns[type] || patterns['custom_development'];
  }

  determineLayers() {
    return {
      presentation: {
        needed: this.analysis.type === 'ui_enhancement',
        components: ['Forms', 'UI Policies', 'Client Scripts', 'Widgets']
      },
      businessLogic: {
        needed: true,
        components: ['Business Rules', 'Script Includes', 'Flows']
      },
      dataAccess: {
        needed: true,
        components: ['GlideRecord', 'GlideAggregate', 'Table APIs']
      },
      integration: {
        needed: this.analysis.type === 'integration',
        components: ['REST Messages', 'Scripted REST APIs', 'Import Sets']
      }
    };
  }

  determineComponentArchitecture() {
    const components = [];
    const { type, entities } = this.analysis;

    // Always need script includes for reusable logic
    components.push({
      layer: 'businessLogic',
      type: 'script_include',
      name: `${this.toPascalCase(this.analysis.title)}Utils`,
      purpose: 'Centralized business logic'
    });

    // Add business rules for data-driven requirements
    if (type === 'automation' || entities.workflows.includes('automation')) {
      entities.tables.forEach(table => {
        components.push({
          layer: 'businessLogic',
          type: 'business_rule',
          table: table,
          purpose: 'Automated processing'
        });
      });
    }

    // Add flows for workflow requirements
    if (entities.workflows.includes('approval') || entities.workflows.includes('notification')) {
      components.push({
        layer: 'businessLogic',
        type: 'flow',
        purpose: 'Workflow automation'
      });
    }

    return components;
  }

  determineArtifacts() {
    const artifacts = [];
    const { type, entities, affectedComponents } = this.analysis;

    // Script Include for centralized logic
    artifacts.push({
      type: 'script_include',
      name: `${this.toPascalCase(this.analysis.title)}Utils`,
      description: 'Utility class for ' + this.analysis.title,
      priority: 1
    });

    // Business Rules based on requirements
    if (type === 'automation' || entities.workflows.length > 0) {
      entities.tables.forEach(table => {
        artifacts.push({
          type: 'business_rule',
          table: table,
          name: `${this.toPascalCase(this.analysis.title)} - ${table}`,
          when: this.determineWhen(type),
          operations: this.determineOperations(type),
          priority: 2
        });
      });
    }

    // Client Scripts for UI requirements
    if (type === 'ui_enhancement') {
      entities.tables.forEach(table => {
        artifacts.push({
          type: 'client_script',
          table: table,
          name: `${this.toPascalCase(this.analysis.title)} - ${table}`,
          scriptType: 'onLoad',
          priority: 3
        });
      });
    }

    // Flows for workflow
    if (entities.workflows.includes('approval')) {
      artifacts.push({
        type: 'flow',
        name: `${this.analysis.title} Approval Flow`,
        trigger: 'record_update',
        priority: 2
      });
    }

    // REST API for integration
    if (type === 'integration') {
      artifacts.push({
        type: 'scripted_rest_api',
        name: `${this.toPascalCase(this.analysis.title)}API`,
        priority: 2
      });
    }

    return artifacts.sort((a, b) => a.priority - b.priority);
  }

  determineWhen(type) {
    if (type === 'automation') return 'after';
    if (type === 'security') return 'before';
    return 'after';
  }

  determineOperations(type) {
    return ['insert', 'update'];
  }

  designDataModel() {
    const { entities } = this.analysis;
    
    return {
      tables: entities.tables.map(table => ({
        name: table,
        action: this.context?.tables?.find(t => t.name === table) ? 'extend' : 'use_existing',
        newFields: [],
        relationships: []
      })),
      newTables: [],
      choiceLists: []
    };
  }

  designIntegrations() {
    if (this.analysis.type !== 'integration') return [];
    
    return this.analysis.entities.integrations.map(int => ({
      type: int,
      direction: 'outbound',
      authentication: 'basic',
      errorHandling: 'retry_with_backoff'
    }));
  }

  designSecurity() {
    return {
      roles: this.analysis.entities.roles,
      acls: this.analysis.entities.tables.map(table => ({
        table: table,
        operations: ['read', 'write'],
        roles: this.analysis.entities.roles
      }))
    };
  }

  designTestingStrategy() {
    return {
      unitTests: this.solution?.artifacts?.filter(a => a.type === 'script_include').length || 1,
      integrationTests: this.analysis.type === 'integration' ? 2 : 0,
      atfTests: this.solution?.artifacts?.length || 3,
      testCases: this.generateTestCases()
    };
  }

  generateTestCases() {
    return [
      { id: 'TC-001', description: 'Verify basic functionality', type: 'functional' },
      { id: 'TC-002', description: 'Verify error handling', type: 'negative' },
      { id: 'TC-003', description: 'Verify security/access control', type: 'security' }
    ];
  }

  toPascalCase(str) {
    return str.replace(/(?:^|\s)\w/g, m => m.toUpperCase()).replace(/\s+/g, '');
  }

  exportToMarkdown(outputPath) {
    const md = this.toMarkdown();
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, md);
    logger.success(`Solution design exported to ${outputPath}`);
  }

  toMarkdown() {
    let md = `# Technical Solution Design\n\n`;
    md += `**Solution ID:** ${this.solution.id}\n\n`;
    md += `## Architecture\n\nPattern: ${this.solution.architecture.pattern}\n\n`;
    md += `## Artifacts to Create\n\n`;
    this.solution.artifacts.forEach((a, i) => {
      md += `${i + 1}. **${a.type}**: ${a.name}\n`;
    });
    return md;
  }
}

export default SolutionDesigner;

