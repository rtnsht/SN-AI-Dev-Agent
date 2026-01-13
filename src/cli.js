#!/usr/bin/env node

/**
 * SN AI Dev - CLI Interface
 * Command-line interface for AI-powered ServiceNow development
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { Orchestrator } from './core/orchestrator.js';
import { SNClient } from './core/sn-client.js';
import { ContextGatherer } from './core/context-gatherer.js';

const program = new Command();

program
  .name('sn-ai')
  .description('AI-powered ServiceNow development automation')
  .version('1.0.0');

// Main develop command - full pipeline
program
  .command('develop')
  .alias('dev')
  .description('Run the full AI development pipeline for a requirement')
  .option('-r, --requirement <text>', 'Requirement description')
  .option('-f, --file <path>', 'Path to requirement file')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('--auto-deploy', 'Automatically deploy to instance', false)
  .option('--priority <level>', 'Requirement priority (low, medium, high)', 'medium')
  .action(async (options) => {
    try {
      let requirement = options.requirement;
      
      // Read from file if provided
      if (options.file) {
        requirement = fs.readFileSync(options.file, 'utf8');
      }
      
      // Interactive prompt if no requirement provided
      if (!requirement) {
        const answers = await inquirer.prompt([
          {
            type: 'editor',
            name: 'requirement',
            message: 'Enter your requirement (opens editor):',
          }
        ]);
        requirement = answers.requirement;
      }

      if (!requirement || requirement.trim().length === 0) {
        console.log(chalk.red('No requirement provided. Exiting.'));
        process.exit(1);
      }

      console.log(chalk.cyan('\n🚀 Starting SN AI Dev Pipeline\n'));
      
      const orchestrator = new Orchestrator({
        outputDir: options.output,
        priority: options.priority,
        autoDeploy: options.autoDeploy
      });

      const summary = await orchestrator.execute(requirement);
      
      console.log(chalk.green('\n✅ Pipeline completed successfully!\n'));
      console.log(chalk.white('Summary:'));
      console.log(chalk.gray(JSON.stringify(summary, null, 2)));
      
    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Connect and test instance
program
  .command('connect')
  .description('Test connection to ServiceNow instance')
  .action(async () => {
    const spinner = ora('Connecting to ServiceNow...').start();
    try {
      config.load();
      const client = new SNClient();
      await client.initialize();
      const connected = await client.testConnection();
      
      if (connected) {
        spinner.succeed(`Connected to ${client.baseUrl}`);
      } else {
        spinner.fail('Connection failed');
      }
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
    }
  });

// Gather context from instance
program
  .command('context')
  .description('Gather context from ServiceNow instance')
  .option('-t, --tables <tables>', 'Comma-separated list of tables to analyze')
  .option('-o, --output <file>', 'Output file path', './output/context/context.json')
  .action(async (options) => {
    const spinner = ora('Gathering context...').start();
    try {
      config.load();
      const client = new SNClient();
      await client.initialize();
      
      const gatherer = new ContextGatherer(client);
      const tables = options.tables ? options.tables.split(',') : [];
      
      await gatherer.gatherContext({ tables, depth: 'full' });
      await gatherer.exportContext(options.output);
      
      const summary = gatherer.getSummary();
      spinner.succeed('Context gathered');
      console.log(chalk.gray(JSON.stringify(summary, null, 2)));
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
    }
  });

// Initialize project
program
  .command('init')
  .description('Initialize a new SN AI Dev project')
  .action(async () => {
    console.log(chalk.cyan('\n🔧 Initializing SN AI Dev project...\n'));
    
    const answers = await inquirer.prompt([
      { type: 'input', name: 'instanceUrl', message: 'ServiceNow instance URL:', 
        validate: (v) => v.includes('service-now.com') || 'Enter a valid ServiceNow URL' },
      { type: 'input', name: 'username', message: 'Username:' },
      { type: 'password', name: 'password', message: 'Password:' },
      { type: 'input', name: 'scope', message: 'Application scope:', default: 'global' }
    ]);

    // Create .env file
    const envContent = `SN_INSTANCE_URL=${answers.instanceUrl}
SN_USERNAME=${answers.username}
SN_PASSWORD=${answers.password}
SN_SCOPE=${answers.scope}
LOG_LEVEL=info`;

    fs.writeFileSync('.env', envContent);
    
    // Create output directories
    ['output/artifacts', 'output/docs', 'output/tasks', 'output/update_sets', 'output/context', 'logs']
      .forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

    console.log(chalk.green('\n✅ Project initialized! Run `sn-ai connect` to test connection.\n'));
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive development session')
  .action(async () => {
    console.log(chalk.cyan('\n🤖 SN AI Dev - Interactive Mode\n'));
    console.log(chalk.gray('Type your requirement and press Enter. Type "exit" to quit.\n'));
    
    const rl = await import('readline');
    const readline = rl.createInterface({ input: process.stdin, output: process.stdout });
    
    const prompt = () => {
      readline.question(chalk.cyan('Requirement > '), async (input) => {
        if (input.toLowerCase() === 'exit') { readline.close(); return; }
        if (input.trim()) {
          try {
            const orchestrator = new Orchestrator({ outputDir: './output' });
            await orchestrator.execute(input);
          } catch (e) { console.log(chalk.red(`Error: ${e.message}`)); }
        }
        prompt();
      });
    };
    prompt();
  });

program.parse();

