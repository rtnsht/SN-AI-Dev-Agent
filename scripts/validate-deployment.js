#!/usr/bin/env node
/**
 * Design → Deployment Validation Script
 * 
 * Parses the design document (2-design.md) and validates that all artifacts
 * listed are covered in the deployment script/results.
 * 
 * Usage:
 *   node validate-deployment.js REQ-003
 * 
 * Exit Codes:
 *   0 = All artifacts covered
 *   1 = Missing artifacts or errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const SPECS_DIR = path.join(PROJECT_ROOT, 'specs');

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

// Known ServiceNow artifact tables that can be automated via REST API
const AUTOMATABLE_TABLES = {
    'sys_dictionary': 'Custom Field',
    'sys_script': 'Business Rule',
    'sys_script_include': 'Script Include',
    'sys_script_client': 'Client Script',
    'sys_ui_policy': 'UI Policy',
    'sys_ui_policy_action': 'UI Policy Action',
    'sys_ui_action': 'UI Action',
    'sysevent_register': 'Event Registry',
    'sysevent_email_action': 'Email Notification',
    'sys_security_acl': 'ACL',
    'sc_cat_item': 'Catalog Item',
    'item_option_new': 'Catalog Variable',
    'sys_ws_definition': 'Scripted REST API',
    'sys_update_set': 'Update Set',
    'sysauto_script': 'Scheduled Job',
    'sys_script_fix': 'Fix Script'
};

function parseDesignArtifacts(designPath) {
    if (!fs.existsSync(designPath)) {
        return { error: `Design file not found: ${designPath}` };
    }

    const content = fs.readFileSync(designPath, 'utf8');
    const artifacts = [];

    // Look for artifact table pattern: | Artifact | REST API Table | ... or | Artifact | Type | Table |
    const lines = content.split('\n');
    let inArtifactTable = false;
    let headerParsed = false;
    let restTableColumnIndex = -1;

    for (const line of lines) {
        // Detect start of artifact table (look for Artifact header)
        if (line.includes('Artifact') && (line.includes('Table') || line.includes('REST'))) {
            inArtifactTable = true;
            headerParsed = false;
            // Find which column has the REST API table
            const headerCells = line.split('|').map(c => c.trim());
            restTableColumnIndex = headerCells.findIndex(c =>
                c.toLowerCase().includes('rest') ||
                (c.toLowerCase() === 'type' && headerCells.some(h => h.toLowerCase().includes('sys_')))
            );
            // Fallback: if "REST API Table" column exists, use it; otherwise use column index 1 (Type)
            const restIdx = headerCells.findIndex(c => c.toLowerCase().includes('rest api table'));
            if (restIdx > 0) restTableColumnIndex = restIdx;
            else restTableColumnIndex = 1; // Default to second column (Type or REST Table)
            continue;
        }

        // Skip separator line
        if (inArtifactTable && line.match(/^\|[-\s|]+\|$/)) {
            headerParsed = true;
            continue;
        }

        // Parse table rows
        if (inArtifactTable && headerParsed && line.startsWith('|')) {
            const cells = line.split('|').map(c => c.trim()).filter(c => c);
            if (cells.length >= 2 && cells[0] !== '') {
                const restTable = cells[restTableColumnIndex - 1] || cells[1]; // Adjust for filtered array
                artifacts.push({
                    name: cells[0],
                    restTable: restTable,
                    automatable: Object.keys(AUTOMATABLE_TABLES).includes(restTable)
                });
            }
        }

        // End of table
        if (inArtifactTable && headerParsed && !line.startsWith('|') && line.trim() !== '') {
            inArtifactTable = false;
        }
    }

    return { artifacts };
}

function loadDeploymentResults(reqPath) {
    const resultsPath = path.join(reqPath, '3-implementation', 'deployment-results.json');
    if (!fs.existsSync(resultsPath)) {
        return { error: `Deployment results not found: ${resultsPath}` };
    }

    try {
        const content = fs.readFileSync(resultsPath, 'utf8');
        return { results: JSON.parse(content) };
    } catch (e) {
        return { error: `Failed to parse deployment results: ${e.message}` };
    }
}

function validateCoverage(designArtifacts, deploymentResults) {
    const issues = [];
    const covered = [];
    const resultKeys = Object.keys(deploymentResults);

    // Map REST tables to deployment result keys
    const tableToKeyMap = {
        'sys_dictionary': ['field'],
        'sys_script': ['businessRule', 'businessrule'],
        'sys_script_include': ['scriptInclude', 'scriptinclude'],
        'sys_script_client': ['clientScript', 'clientscript'],
        'sys_ui_policy': ['uiPolicy', 'uipolicy'],
        'sys_ui_policy_action': ['uiPolicyAction', 'uipolicyaction'],
        'sysevent_register': ['event'],
        'sysevent_email_action': ['notification']
    };

    for (const artifact of designArtifacts) {
        const restTable = artifact.restTable;
        const expectedKeys = tableToKeyMap[restTable] || [];

        // Check if any matching key exists in deployment results
        const found = resultKeys.some(key => {
            const keyLower = key.toLowerCase();
            return expectedKeys.some(ek => keyLower.includes(ek.toLowerCase()));
        });

        if (found) {
            covered.push(artifact);
        } else if (!artifact.automatable) {
            issues.push({
                artifact,
                severity: 'ERROR',
                message: `NOT AUTOMATABLE: ${artifact.name} - table ${restTable} not in known list`
            });
        } else {
            issues.push({
                artifact,
                severity: 'ERROR',
                message: `MISSING: ${artifact.name} (${restTable}) not found in deployment results`
            });
        }
    }

    return { issues, covered };
}

function main() {
    const reqId = process.argv[2];
    
    if (!reqId) {
        console.log('Usage: node validate-deployment.js REQ-XXX');
        process.exit(1);
    }

    console.log(`${colors.cyan}\n🔍 Design → Deployment Validation: ${reqId}\n${colors.reset}`);

    const reqPath = path.join(SPECS_DIR, reqId);
    const designPath = path.join(reqPath, '2-design.md');

    // Parse design artifacts
    console.log('📄 Parsing design document...');
    const { artifacts, error: designError } = parseDesignArtifacts(designPath);
    if (designError) {
        console.log(`${colors.red}❌ ${designError}${colors.reset}`);
        process.exit(1);
    }
    console.log(`   Found ${artifacts.length} artifacts in design\n`);

    // Load deployment results
    console.log('📦 Loading deployment results...');
    const { results, error: deployError } = loadDeploymentResults(reqPath);
    if (deployError) {
        console.log(`${colors.red}❌ ${deployError}${colors.reset}`);
        process.exit(1);
    }
    console.log(`   Found ${Object.keys(results).length} deployed artifacts\n`);

    // Validate coverage
    console.log('✅ Validating coverage...\n');
    const { issues, covered } = validateCoverage(artifacts, results);

    // Report
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    VALIDATION REPORT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`${colors.green}✅ COVERED (${covered.length}/${artifacts.length}):${colors.reset}`);
    covered.forEach(a => console.log(`   • ${a.name} (${a.restTable})`));

    if (issues.length > 0) {
        console.log(`\n${colors.red}❌ ISSUES (${issues.length}):${colors.reset}`);
        issues.forEach(i => console.log(`   • ${i.message}`));
        console.log(`\n${colors.red}VALIDATION FAILED${colors.reset}`);
        process.exit(1);
    }

    console.log(`\n${colors.green}✅ ALL ARTIFACTS COVERED - VALIDATION PASSED${colors.reset}\n`);
    process.exit(0);
}

main();

