/**
 * Requirement Analyzer
 * Analyzes requirements and generates functional specifications
 * Works with AI to understand and clarify requirements
 */

import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export class RequirementAnalyzer {
  constructor(context = null) {
    this.context = context;
    this.requirement = null;
    this.analysis = null;
    this.spec = null;
  }

  /**
   * Analyze a requirement and generate structured analysis
   */
  async analyze(requirement) {
    this.requirement = requirement;
    
    logger.step(1, 3, 'Parsing requirement...');
    this.analysis = this.parseRequirement(requirement);
    
    logger.step(2, 3, 'Identifying affected components...');
    this.analysis.affectedComponents = this.identifyComponents();
    
    logger.step(3, 3, 'Generating questions for clarification...');
    this.analysis.clarificationQuestions = this.generateQuestions();
    
    return this.analysis;
  }

  parseRequirement(requirement) {
    return {
      id: `REQ-${Date.now()}`,
      originalText: requirement.description || requirement,
      title: requirement.title || this.extractTitle(requirement),
      type: this.classifyRequirement(requirement),
      priority: requirement.priority || 'medium',
      isGreenfield: this.determineIfGreenfield(),
      parsedAt: new Date().toISOString(),
      
      // Extracted entities
      entities: {
        tables: this.extractTables(requirement),
        fields: this.extractFields(requirement),
        roles: this.extractRoles(requirement),
        integrations: this.extractIntegrations(requirement),
        workflows: this.extractWorkflows(requirement)
      }
    };
  }

  extractTitle(requirement) {
    const text = typeof requirement === 'string' ? requirement : requirement.description;
    // Extract first sentence or first 50 chars as title
    const firstSentence = text.split(/[.!?]/)[0];
    return firstSentence.length > 50 ? firstSentence.substring(0, 50) + '...' : firstSentence;
  }

  classifyRequirement(requirement) {
    const text = (typeof requirement === 'string' ? requirement : requirement.description).toLowerCase();
    
    if (text.includes('integration') || text.includes('api') || text.includes('connect')) {
      return 'integration';
    }
    if (text.includes('report') || text.includes('dashboard') || text.includes('analytics')) {
      return 'reporting';
    }
    if (text.includes('workflow') || text.includes('approval') || text.includes('automat')) {
      return 'automation';
    }
    if (text.includes('form') || text.includes('field') || text.includes('ui') || text.includes('portal')) {
      return 'ui_enhancement';
    }
    if (text.includes('security') || text.includes('access') || text.includes('permission')) {
      return 'security';
    }
    if (text.includes('notification') || text.includes('email') || text.includes('alert')) {
      return 'notification';
    }
    return 'custom_development';
  }

  determineIfGreenfield() {
    // Check if context has existing artifacts for the mentioned tables
    if (!this.context || !this.context.tables || this.context.tables.length === 0) {
      return true;
    }
    return false;
  }

  extractTables(requirement) {
    const text = typeof requirement === 'string' ? requirement : requirement.description;
    const tables = [];
    
    // Common ServiceNow table keywords
    const tablePatterns = [
      /incident/gi, /problem/gi, /change/gi, /request/gi,
      /task/gi, /user/gi, /group/gi, /cmdb/gi, /asset/gi,
      /catalog/gi, /knowledge/gi, /case/gi
    ];
    
    tablePatterns.forEach(pattern => {
      if (pattern.test(text)) {
        tables.push(pattern.source.toLowerCase());
      }
    });
    
    return [...new Set(tables)];
  }

  extractFields(requirement) {
    const text = typeof requirement === 'string' ? requirement : requirement.description;
    const fields = [];
    
    // Look for field-like patterns: "field_name", state, status, etc.
    const fieldPatterns = [
      /state/gi, /status/gi, /priority/gi, /category/gi,
      /assignment/gi, /description/gi, /short_description/gi
    ];
    
    fieldPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        fields.push(pattern.source.toLowerCase());
      }
    });
    
    return [...new Set(fields)];
  }

  extractRoles(requirement) {
    const text = typeof requirement === 'string' ? requirement : requirement.description;
    const roles = [];
    
    const rolePatterns = [/admin/gi, /manager/gi, /user/gi, /approver/gi, /technician/gi];
    rolePatterns.forEach(pattern => {
      if (pattern.test(text)) {
        roles.push(pattern.source.toLowerCase());
      }
    });
    
    return [...new Set(roles)];
  }

  extractIntegrations(requirement) {
    const text = typeof requirement === 'string' ? requirement : requirement.description;
    const integrations = [];
    
    if (/rest|api|web.*service|soap/gi.test(text)) {
      integrations.push('rest_api');
    }
    if (/email|smtp/gi.test(text)) {
      integrations.push('email');
    }
    if (/ldap|active.*directory/gi.test(text)) {
      integrations.push('ldap');
    }
    
    return integrations;
  }

  extractWorkflows(requirement) {
    const text = typeof requirement === 'string' ? requirement : requirement.description;
    const workflows = [];
    
    if (/approval/gi.test(text)) workflows.push('approval');
    if (/notification|notify|alert/gi.test(text)) workflows.push('notification');
    if (/escalat/gi.test(text)) workflows.push('escalation');
    if (/automat|trigger/gi.test(text)) workflows.push('automation');
    
    return workflows;
  }

  identifyComponents() {
    const components = [];
    const { entities } = this.analysis;
    
    // Determine which ServiceNow components are needed
    if (entities.tables.length > 0) {
      components.push({ type: 'table', items: entities.tables });
    }
    if (entities.workflows.includes('automation')) {
      components.push({ type: 'business_rule', reason: 'Automation requirement detected' });
    }
    if (entities.workflows.includes('approval')) {
      components.push({ type: 'flow', reason: 'Approval workflow needed' });
    }
    if (entities.integrations.includes('rest_api')) {
      components.push({ type: 'rest_message', reason: 'External integration needed' });
    }
    
    return components;
  }

  generateQuestions() {
    const questions = [];
    const { entities, type } = this.analysis;
    
    if (entities.tables.length === 0) {
      questions.push('Which table(s) should this requirement be implemented on?');
    }
    if (type === 'automation') {
      questions.push('What triggers this automation? (insert, update, specific field change)');
      questions.push('Should this run synchronously or asynchronously?');
    }
    if (type === 'integration') {
      questions.push('What is the endpoint URL for the external system?');
      questions.push('What authentication method should be used?');
    }
    
    return questions;
  }
}

export default RequirementAnalyzer;

