#!/usr/bin/env node
/**
 * ServiceNow Deployer CLI
 * 
 * Usage:
 *   node src/deployer/cli.js --config path/to/manifest.json
 *   node src/deployer/cli.js -c deployments/inc-simple-002.json
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ServiceNowDeployer } from './ServiceNowDeployer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--config' || args[i] === '-c') {
            config.manifestPath = args[++i];
        } else if (args[i] === '--instance' || args[i] === '-i') {
            config.instanceUrl = args[++i];
        } else if (args[i] === '--help' || args[i] === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    return config;
}

function printHelp() {
    console.log(`
ServiceNow Deployer CLI

Usage:
  node src/deployer/cli.js --config <manifest.json>

Options:
  -c, --config <path>    Path to deployment manifest JSON (required)
  -i, --instance <url>   ServiceNow instance URL (overrides .env)
  -h, --help             Show this help message

Environment Variables:
  SN_INSTANCE_URL        ServiceNow instance URL
  SN_USERNAME            ServiceNow username
  SN_PASSWORD            ServiceNow password

Examples:
  node src/deployer/cli.js -c deployments/inc-simple-002.json
  node src/deployer/cli.js --config ./my-feature/manifest.json
`);
}

async function main() {
    const args = parseArgs();

    if (!args.manifestPath) {
        console.error('Error: --config <manifest.json> is required');
        console.error('Run with --help for usage information');
        process.exit(1);
    }

    // Validate environment
    const instanceUrl = args.instanceUrl || process.env.SN_INSTANCE_URL;
    const username = process.env.SN_USERNAME;
    const password = process.env.SN_PASSWORD;

    if (!instanceUrl || !username || !password) {
        console.error('Error: Missing ServiceNow credentials');
        console.error('Set SN_INSTANCE_URL, SN_USERNAME, and SN_PASSWORD environment variables');
        process.exit(1);
    }

    // Resolve manifest path
    const manifestPath = path.resolve(process.cwd(), args.manifestPath);

    // Create deployer and run
    const deployer = new ServiceNowDeployer({
        instanceUrl,
        username,
        password
    });

    try {
        const results = await deployer.deployFromManifest(manifestPath);
        process.exit(results.success && results.errors.length === 0 ? 0 : 1);
    } catch (error) {
        console.error('Deployment failed:', error.message);
        process.exit(1);
    }
}

main();

