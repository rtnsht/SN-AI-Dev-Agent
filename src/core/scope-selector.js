/**
 * Scope Selector
 * Handles application scope selection for ServiceNow deployment
 * CRITICAL: Flow Designer artifacts (flows, subflows, flow actions) require a custom scoped application
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';

export class ScopeSelector {
  constructor(snClient) {
    this.client = snClient;
    this.selectedScope = null;
    this.hasFlowArtifacts = false;
  }

  /**
   * Get available scoped applications from the instance
   */
  async getCustomApps() {
    try {
      const response = await this.client.getRecords('sys_app', {
        query: 'active=true',
        fields: ['sys_id', 'name', 'scope', 'short_description', 'version']
      });
      return response || [];
    } catch (error) {
      logger.warn('Failed to fetch custom apps', { error: error.message });
      return [];
    }
  }

  /**
   * Analyze solution artifacts to determine if Flow Designer artifacts are involved
   */
  analyzeArtifacts(solution) {
    const flowTypes = ['flow', 'subflow', 'flow_action', 'sys_hub_flow', 'sys_hub_action_type_definition'];
    const artifacts = solution?.artifacts || [];
    
    const flowArtifacts = artifacts.filter(a => 
      flowTypes.includes(a.type?.toLowerCase()) ||
      flowTypes.some(ft => a.table?.includes(ft))
    );
    
    this.hasFlowArtifacts = flowArtifacts.length > 0;
    
    return {
      hasFlowArtifacts: this.hasFlowArtifacts,
      flowArtifacts: flowArtifacts.map(a => ({ name: a.name, type: a.type })),
      totalArtifacts: artifacts.length,
      artifactTypes: [...new Set(artifacts.map(a => a.type))]
    };
  }

  /**
   * Prompt user for scope selection
   */
  async promptForScope(solution) {
    const analysis = this.analyzeArtifacts(solution);
    const customApps = await this.getCustomApps();

    // Build choices
    const choices = [];
    
    // Only add Global if no flow artifacts
    if (!analysis.hasFlowArtifacts) {
      choices.push({
        name: `${chalk.cyan('Global')} - Default ServiceNow scope`,
        value: { sys_id: 'global', name: 'Global', scope: 'global', type: 'global' }
      });
    }

    // Add custom apps
    for (const app of customApps) {
      choices.push({
        name: `${chalk.green(app.name)} (${app.scope}) - ${app.short_description || 'Custom application'}`,
        value: { sys_id: app.sys_id, name: app.name, scope: app.scope, type: 'custom' }
      });
    }

    // Add create new option
    choices.push({
      name: chalk.yellow('[Create New Application]'),
      value: { type: 'create_new' }
    });

    // Display warnings if flow artifacts detected
    if (analysis.hasFlowArtifacts) {
      console.log(chalk.yellow('\n⚠️  This solution includes Flow Designer artifacts:'));
      analysis.flowArtifacts.forEach(a => console.log(chalk.gray(`   - ${a.name} (${a.type})`)));
      console.log(chalk.yellow('\nFlow Designer artifacts REQUIRE a custom scoped application.'));
      console.log(chalk.yellow('They will be deployed using the ServiceNow Fluent SDK.\n'));
    }

    // Prompt for selection
    const { selectedApp } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedApp',
        message: 'Select the application scope for deployment:',
        choices
      }
    ]);

    // Handle create new app
    if (selectedApp.type === 'create_new') {
      return this.promptCreateApp();
    }

    this.selectedScope = selectedApp;
    return selectedApp;
  }

  /**
   * Prompt to create a new custom application
   */
  async promptCreateApp() {
    const { appName, appScope } = await inquirer.prompt([
      {
        type: 'input',
        name: 'appName',
        message: 'Enter the application name:',
        validate: (v) => v.length > 0 || 'Application name is required'
      },
      {
        type: 'input',
        name: 'appScope',
        message: 'Enter the application scope (leave blank to auto-generate):',
        default: (answers) => `x_snc_${answers.appName.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)}`
      }
    ]);

    // Create the app via REST API
    try {
      const result = await this.client.createRecord('sys_app', {
        name: appName,
        scope: appScope,
        active: true,
        version: '1.0.0'
      });

      console.log(chalk.green(`\n✅ Created application: ${appName} (${appScope})`));
      
      this.selectedScope = {
        sys_id: result.sys_id,
        name: appName,
        scope: appScope,
        type: 'custom'
      };

      return this.selectedScope;
    } catch (error) {
      console.log(chalk.red(`Failed to create application: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get deployment recommendations based on selected scope and artifacts
   */
  getDeploymentRecommendations(solution) {
    const analysis = this.analyzeArtifacts(solution);
    
    return {
      scope: this.selectedScope,
      hasFlowArtifacts: analysis.hasFlowArtifacts,
      deploymentMethods: {
        restApi: analysis.artifactTypes.filter(t => 
          !['flow', 'subflow', 'flow_action'].includes(t?.toLowerCase())
        ),
        sdk: analysis.hasFlowArtifacts ? analysis.flowArtifacts : []
      },
      notes: analysis.hasFlowArtifacts ? [
        'Flow artifacts will be deployed via ServiceNow Fluent SDK',
        'Run: npx now-sdk install --auth <profile> --reinstall'
      ] : []
    };
  }
}

export default ScopeSelector;

