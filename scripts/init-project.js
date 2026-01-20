#!/usr/bin/env node
/**
 * Initialize a Fresh Project
 * 
 * Resets specs/manifest.json to a clean state using the template.
 * Optionally clears existing requirement folders.
 * 
 * Usage:
 *   node scripts/init-project.js                    # Interactive mode
 *   node scripts/init-project.js --reset            # Reset manifest only
 *   node scripts/init-project.js --reset --clean    # Reset and remove all REQ folders
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.join(__dirname, '../templates/manifest.json');
const MANIFEST_PATH = path.join(__dirname, '../specs/manifest.json');
const SPECS_DIR = path.join(__dirname, '../specs');

// Default values
const DEFAULTS = {
    name: 'ServiceNow AI Development',
    description: 'AI-powered ServiceNow development with spec-driven methodology',
    repository: 'SN AI Dev',
    instance: 'dev300943'
};

async function prompt(rl, question, defaultValue) {
    return new Promise((resolve) => {
        const displayDefault = defaultValue ? ` (${defaultValue})` : '';
        rl.question(`${question}${displayDefault}: `, (answer) => {
            resolve(answer.trim() || defaultValue);
        });
    });
}

async function confirm(rl, question) {
    return new Promise((resolve) => {
        rl.question(`${question} (y/N): `, (answer) => {
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

function getExistingReqFolders() {
    if (!fs.existsSync(SPECS_DIR)) return [];
    return fs.readdirSync(SPECS_DIR)
        .filter(f => f.startsWith('REQ-') && fs.statSync(path.join(SPECS_DIR, f)).isDirectory());
}

function removeReqFolders(folders) {
    folders.forEach(folder => {
        const folderPath = path.join(SPECS_DIR, folder);
        fs.rmSync(folderPath, { recursive: true, force: true });
        console.log(`   🗑️  Removed ${folder}`);
    });
}

async function main() {
    const args = process.argv.slice(2);
    const resetOnly = args.includes('--reset');
    const cleanFolders = args.includes('--clean');

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           PROJECT INITIALIZATION                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Check for existing requirements
    const existingReqs = getExistingReqFolders();
    if (existingReqs.length > 0) {
        console.log(`⚠️  Found ${existingReqs.length} existing requirement(s):`);
        existingReqs.forEach(r => console.log(`   • ${r}`));
        console.log('');
    }

    let projectName = DEFAULTS.name;
    let projectDesc = DEFAULTS.description;
    let repoName = DEFAULTS.repository;
    let instanceName = DEFAULTS.instance;
    let shouldClean = cleanFolders;

    if (!resetOnly) {
        // Interactive mode
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        try {
            projectName = await prompt(rl, 'Project name', DEFAULTS.name);
            projectDesc = await prompt(rl, 'Description', DEFAULTS.description);
            repoName = await prompt(rl, 'Repository name', DEFAULTS.repository);
            instanceName = await prompt(rl, 'ServiceNow instance', DEFAULTS.instance);

            if (existingReqs.length > 0 && !cleanFolders) {
                shouldClean = await confirm(rl, '\nRemove existing requirement folders?');
            }
        } finally {
            rl.close();
        }
    }

    console.log('\n📋 Configuration:');
    console.log(`   Project: ${projectName}`);
    console.log(`   Description: ${projectDesc}`);
    console.log(`   Repository: ${repoName}`);
    console.log(`   Instance: ${instanceName}`);
    console.log(`   Clean folders: ${shouldClean ? 'Yes' : 'No'}\n`);

    // Clean folders if requested
    if (shouldClean && existingReqs.length > 0) {
        console.log('🗑️  Removing requirement folders...');
        removeReqFolders(existingReqs);
        console.log('');
    }

    // Read template
    if (!fs.existsSync(TEMPLATE_PATH)) {
        console.error('❌ Template not found:', TEMPLATE_PATH);
        process.exit(1);
    }

    let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    // Replace placeholders
    template = template
        .replace('{{PROJECT_NAME}}', projectName)
        .replace('{{PROJECT_DESCRIPTION}}', projectDesc)
        .replace('{{REPOSITORY_NAME}}', repoName)
        .replace('{{INSTANCE_NAME}}', instanceName);

    // Ensure specs directory exists
    if (!fs.existsSync(SPECS_DIR)) {
        fs.mkdirSync(SPECS_DIR, { recursive: true });
    }

    // Write manifest
    fs.writeFileSync(MANIFEST_PATH, template);
    console.log('✅ Created specs/manifest.json\n');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ PROJECT INITIALIZED');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Next steps:');
    console.log('  1. Start a new requirement: "Build a feature for X"');
    console.log('  2. AI will create specs/REQ-001/ folder');
    console.log('  3. Follow the phase gate process\n');
}

main().catch(console.error);

