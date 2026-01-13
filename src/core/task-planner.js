/**
 * Task Planner
 * Breaks down solution design into discrete development tasks
 */

import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class TaskPlanner {
  constructor(solution, analysis) {
    this.solution = solution;
    this.analysis = analysis;
    this.tasks = [];
  }

  /**
   * Generate task breakdown from solution design
   */
  plan() {
    logger.info('Planning development tasks...');
    
    this.tasks = [];
    let order = 1;

    // Phase 1: Setup tasks
    this.addPhase('Setup', [
      this.createTask(order++, 'setup', 'Create Update Set', 
        'Create and set current update set for development', 'high'),
      this.createTask(order++, 'setup', 'Validate Context', 
        'Verify all required tables and dependencies exist', 'high')
    ]);

    // Phase 2: Data Model tasks
    if (this.solution.dataModel?.newTables?.length > 0) {
      const dmTasks = this.solution.dataModel.newTables.map(table => 
        this.createTask(order++, 'data_model', `Create Table: ${table.name}`,
          `Create new table ${table.name} with required fields`, 'high')
      );
      this.addPhase('Data Model', dmTasks);
    }

    // Phase 3: Core Development tasks
    const devTasks = this.solution.artifacts.map(artifact => 
      this.createTask(
        order++,
        'development',
        `Create ${this.formatArtifactType(artifact.type)}: ${artifact.name}`,
        this.getArtifactDescription(artifact),
        artifact.priority === 1 ? 'high' : 'medium',
        artifact
      )
    );
    this.addPhase('Development', devTasks);

    // Phase 4: Security tasks
    if (this.solution.security?.acls?.length > 0) {
      const secTasks = this.solution.security.acls.map(acl =>
        this.createTask(order++, 'security', `Create ACL: ${acl.table}`,
          `Create ${acl.operations.join(', ')} ACL for ${acl.table}`, 'high')
      );
      this.addPhase('Security', secTasks);
    }

    // Phase 5: Testing tasks
    this.addPhase('Testing', [
      this.createTask(order++, 'testing', 'Create ATF Tests',
        'Create automated test framework tests for all artifacts', 'medium'),
      this.createTask(order++, 'testing', 'Execute Test Suite',
        'Run all ATF tests and validate results', 'medium'),
      this.createTask(order++, 'testing', 'Manual Testing',
        'Perform manual testing for edge cases', 'medium')
    ]);

    // Phase 6: Deployment tasks
    this.addPhase('Deployment', [
      this.createTask(order++, 'deployment', 'Code Review',
        'Review all created artifacts for best practices', 'high'),
      this.createTask(order++, 'deployment', 'Complete Update Set',
        'Mark update set as complete', 'high'),
      this.createTask(order++, 'deployment', 'Deploy to Target Instance',
        'Retrieve and commit update set to target instance', 'high')
    ]);

    logger.success(`Generated ${this.tasks.length} tasks across ${this.getPhases().length} phases`);
    return this.tasks;
  }

  createTask(order, phase, name, description, priority, artifact = null) {
    return {
      id: uuidv4(),
      order,
      phase,
      name,
      description,
      priority,
      status: 'pending',
      artifact: artifact ? {
        type: artifact.type,
        name: artifact.name,
        table: artifact.table
      } : null,
      dependencies: order > 1 ? [order - 1] : [],
      estimatedMinutes: this.estimateEffort(phase, artifact),
      createdAt: new Date().toISOString()
    };
  }

  addPhase(phaseName, tasks) {
    tasks.forEach(task => {
      task.phaseName = phaseName;
      this.tasks.push(task);
    });
  }

  formatArtifactType(type) {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  getArtifactDescription(artifact) {
    const descriptions = {
      'script_include': `Create Script Include ${artifact.name} with required methods`,
      'business_rule': `Create Business Rule on ${artifact.table} table (${artifact.when || 'after'})`,
      'client_script': `Create Client Script on ${artifact.table} (${artifact.scriptType || 'onChange'})`,
      'flow': `Create Flow Designer flow: ${artifact.name}`,
      'ui_policy': `Create UI Policy for ${artifact.table}`,
      'ui_action': `Create UI Action for ${artifact.table}`,
      'scheduled_job': `Create Scheduled Job: ${artifact.name}`,
      'scripted_rest_api': `Create Scripted REST API: ${artifact.name}`,
      'acl': `Create ACL for ${artifact.table}`
    };
    return descriptions[artifact.type] || `Create ${artifact.type}: ${artifact.name}`;
  }

  estimateEffort(phase, artifact) {
    const phaseEstimates = {
      'setup': 5,
      'data_model': 30,
      'development': 45,
      'security': 15,
      'testing': 30,
      'deployment': 15
    };
    
    const artifactEstimates = {
      'script_include': 60,
      'business_rule': 30,
      'client_script': 30,
      'flow': 45,
      'scripted_rest_api': 60
    };

    if (artifact?.type) {
      return artifactEstimates[artifact.type] || 30;
    }
    return phaseEstimates[phase] || 30;
  }

  getPhases() {
    const phases = [...new Set(this.tasks.map(t => t.phaseName))];
    return phases.map(name => ({
      name,
      tasks: this.tasks.filter(t => t.phaseName === name)
    }));
  }

  getTotalEstimate() {
    return this.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  }

  exportToMarkdown(outputPath) {
    const md = this.toMarkdown();
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, md);
    logger.success(`Task plan exported to ${outputPath}`);
  }

  toMarkdown() {
    let md = `# Development Task Plan\n\n`;
    md += `**Requirement:** ${this.analysis.title}\n`;
    md += `**Total Tasks:** ${this.tasks.length}\n`;
    md += `**Estimated Effort:** ${Math.round(this.getTotalEstimate() / 60)} hours\n\n`;
    
    this.getPhases().forEach(phase => {
      md += `## ${phase.name}\n\n`;
      phase.tasks.forEach(task => {
        md += `- [ ] **${task.name}** (~${task.estimatedMinutes} min)\n`;
        md += `  - ${task.description}\n`;
        if (task.artifact) {
          md += `  - Artifact: ${task.artifact.type}\n`;
        }
        md += `\n`;
      });
    });
    
    return md;
  }

  exportToJSON(outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
      summary: {
        totalTasks: this.tasks.length,
        phases: this.getPhases().length,
        estimatedMinutes: this.getTotalEstimate()
      },
      phases: this.getPhases(),
      tasks: this.tasks
    }, null, 2));
    logger.success(`Task plan exported to ${outputPath}`);
  }
}

export default TaskPlanner;

