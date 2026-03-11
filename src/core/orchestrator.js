/**
 * Orchestrator
 * Main workflow controller that coordinates all components
 * Implements the end-to-end AI development pipeline
 */

import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { SNClient } from './sn-client.js';
import { ContextGatherer } from './context-gatherer.js';
import { RequirementAnalyzer } from './requirement-analyzer.js';
import { SpecWriter } from './spec-writer.js';
import { SolutionDesigner } from './solution-designer.js';
import { TaskPlanner } from './task-planner.js';
import { CodeGenerator } from './code-generator.js';
import { UpdateSetManager } from './update-set-manager.js';
import { Deployer } from './deployer.js';
import { ScopeSelector } from './scope-selector.js';
import fs from 'fs';
import path from 'path';

export class Orchestrator {
  constructor(options = {}) {
    this.options = options;
    this.client = null;
    this.context = null;
    this.analysis = null;
    this.spec = null;
    this.solution = null;
    this.tasks = null;
    this.artifacts = null;
    this.updateSet = null;
    this.selectedScope = null;
    this.outputDir = options.outputDir || './output';
  }

  /**
   * Execute the full development pipeline
   */
  async execute(requirement) {
    const totalSteps = 10;

    try {
      logger.box('SN AI Dev Pipeline', `Processing requirement:\n${requirement.substring(0, 100)}...`);

      // Step 1: Initialize and connect
      logger.step(1, totalSteps, 'Connecting to ServiceNow instance...');
      await this.initialize();

      // Step 2: Gather context (for brownfield)
      logger.step(2, totalSteps, 'Gathering instance context...');
      await this.gatherContext();

      // Step 3: Analyze requirement
      logger.step(3, totalSteps, 'Analyzing requirement...');
      await this.analyzeRequirement(requirement);

      // Step 4: Generate specification
      logger.step(4, totalSteps, 'Generating functional specification...');
      await this.generateSpec();

      // Step 5: Design solution
      logger.step(5, totalSteps, 'Designing technical solution...');
      await this.designSolution();

      // Step 6: Select application scope (MANDATORY before implementation)
      logger.step(6, totalSteps, 'Selecting application scope...');
      await this.selectScope();

      // Step 7: Plan tasks
      logger.step(7, totalSteps, 'Planning development tasks...');
      await this.planTasks();

      // Step 8: Generate code
      logger.step(8, totalSteps, 'Generating ServiceNow artifacts...');
      await this.generateCode();

      // Step 9: Create update set and deploy
      logger.step(9, totalSteps, 'Creating and deploying update set...');
      await this.createAndDeploy();

      // Step 10: Generate summary
      logger.step(10, totalSteps, 'Generating summary...');
      const summary = await this.generateSummary();

      logger.box('Pipeline Complete', `Artifacts: ${this.artifacts.length}\nUpdate Set: ${this.updateSet?.name || 'N/A'}\nScope: ${this.selectedScope?.name || 'Global'}`);

      return summary;
    } catch (error) {
      logger.error('Pipeline failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async initialize() {
    config.load();
    this.client = new SNClient();
    await this.client.initialize();
    
    const connected = await this.client.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to ServiceNow instance');
    }
  }

  async gatherContext() {
    const gatherer = new ContextGatherer(this.client);
    this.context = await gatherer.gatherContext({
      depth: this.options.contextDepth || 'standard',
      includeOOTB: false
    });
    
    // Export context for reference
    const contextPath = path.join(this.outputDir, 'context', 'instance-context.json');
    await gatherer.exportContext(contextPath);
    
    logger.info(`Context gathered: ${gatherer.getSummary().tables} tables, ${gatherer.getSummary().businessRules} rules`);
  }

  async analyzeRequirement(requirement) {
    const analyzer = new RequirementAnalyzer(this.context);
    this.analysis = await analyzer.analyze({
      description: requirement,
      priority: this.options.priority || 'medium'
    });
    
    logger.info(`Requirement type: ${this.analysis.type}`);
    logger.info(`Greenfield: ${this.analysis.isGreenfield}`);
    logger.info(`Tables: ${this.analysis.entities.tables.join(', ') || 'None identified'}`);
  }

  async generateSpec() {
    const specWriter = new SpecWriter(this.analysis, this.context);
    this.spec = specWriter.generateSpec();
    
    // Export spec
    const specPath = path.join(this.outputDir, 'docs', `spec-${this.analysis.id}.md`);
    specWriter.exportToMarkdown(specPath);
  }

  async designSolution() {
    const designer = new SolutionDesigner(this.analysis, this.context);
    this.solution = designer.design();

    // Export solution design
    const solutionPath = path.join(this.outputDir, 'docs', `solution-${this.solution.id}.md`);
    designer.exportToMarkdown(solutionPath);

    logger.info(`Solution artifacts: ${this.solution.artifacts.length}`);
  }

  /**
   * Select application scope for deployment
   * CRITICAL: Must be called before implementation
   */
  async selectScope() {
    const scopeSelector = new ScopeSelector(this.client);

    // Prompt user to select scope based on solution artifacts
    this.selectedScope = await scopeSelector.promptForScope(this.solution);

    // Get deployment recommendations
    const recommendations = scopeSelector.getDeploymentRecommendations(this.solution);

    logger.info(`Selected scope: ${this.selectedScope.name} (${this.selectedScope.scope})`);

    // Store recommendations for later use in deployment
    this.deploymentRecommendations = recommendations;
  }

  async planTasks() {
    const planner = new TaskPlanner(this.solution, this.analysis);
    this.tasks = planner.plan();
    
    // Export task plan
    const taskPath = path.join(this.outputDir, 'tasks', `tasks-${this.analysis.id}.md`);
    planner.exportToMarkdown(taskPath);
    
    const jsonPath = path.join(this.outputDir, 'tasks', `tasks-${this.analysis.id}.json`);
    planner.exportToJSON(jsonPath);
    
    logger.info(`Planned ${this.tasks.length} tasks, ~${Math.round(planner.getTotalEstimate() / 60)}h effort`);
  }

  async generateCode() {
    const generator = new CodeGenerator(this.solution, this.analysis, this.context);
    this.artifacts = await generator.generateAll();
    
    // Export artifacts
    const artifactsDir = path.join(this.outputDir, 'artifacts');
    generator.exportArtifacts(artifactsDir);
  }

  async createAndDeploy() {
    const usManager = new UpdateSetManager(this.client);

    // Create update set with selected scope
    const scopeId = this.selectedScope?.type === 'custom' ? this.selectedScope.sys_id : null;
    this.updateSet = await usManager.createUpdateSet(
      null, // Auto-generate name
      `AI-generated for: ${this.analysis.title}`,
      scopeId // Pass scope for scoped update set
    );

    logger.info(`Update set created in scope: ${this.selectedScope?.name || 'Global'}`);

    // Deploy artifacts
    if (this.artifacts.length > 0) {
      const deployResults = await usManager.deployArtifacts(this.artifacts);
      logger.info(`Deployed ${deployResults.filter(r => r.success).length}/${this.artifacts.length} artifacts`);
    }

    // Complete update set
    if (this.options.autoComplete !== false) {
      await usManager.complete();
    }

    // Export update set XML
    const xmlPath = path.join(this.outputDir, 'update_sets', `${this.updateSet.name}.xml`);
    await usManager.exportToXML(xmlPath);
  }

  async generateSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      requirement: { id: this.analysis.id, title: this.analysis.title, type: this.analysis.type },
      solution: { id: this.solution.id, artifactCount: this.solution.artifacts.length },
      tasks: { total: this.tasks.length, estimatedHours: Math.round(new TaskPlanner(this.solution, this.analysis).getTotalEstimate() / 60) },
      scope: {
        name: this.selectedScope?.name || 'Global',
        scope: this.selectedScope?.scope || 'global',
        type: this.selectedScope?.type || 'global'
      },
      deployment: {
        updateSet: this.updateSet?.name,
        artifactsDeployed: this.artifacts.length,
      },
      outputs: {
        spec: path.join(this.outputDir, 'docs', `spec-${this.analysis.id}.md`),
        solution: path.join(this.outputDir, 'docs', `solution-${this.solution.id}.md`),
        tasks: path.join(this.outputDir, 'tasks', `tasks-${this.analysis.id}.md`),
        updateSet: path.join(this.outputDir, 'update_sets', `${this.updateSet?.name}.xml`)
      }
    };
    
    // Save summary
    const summaryPath = path.join(this.outputDir, 'summary.json');
    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    return summary;
  }
}

export default Orchestrator;

