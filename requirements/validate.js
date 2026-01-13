#!/usr/bin/env node
/**
 * Spec-Driven Development Validator
 * 
 * Validates requirement folder structure, phase gates, and sign-offs
 * based on configuration in config.properties
 * 
 * Usage:
 *   node validate.js                    # Validate all requirements
 *   node validate.js REQ-001            # Validate specific requirement
 *   node validate.js --pre-deploy REQ-001  # Validate before deployment
 */

const fs = require('fs');
const path = require('path');

const REQUIREMENTS_DIR = __dirname;
const CONFIG_FILE = path.join(REQUIREMENTS_DIR, 'config.properties');
const MANIFEST_FILE = path.join(REQUIREMENTS_DIR, 'manifest.json');

// ANSI colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

class ValidationReport {
    constructor() {
        this.violations = [];
        this.warnings = [];
        this.passed = [];
    }

    addViolation(reqId, phase, message) {
        this.violations.push({ reqId, phase, message, type: 'ERROR' });
    }

    addWarning(reqId, phase, message) {
        this.warnings.push({ reqId, phase, message, type: 'WARN' });
    }

    addPassed(reqId, phase, message) {
        this.passed.push({ reqId, phase, message, type: 'PASS' });
    }

    hasViolations() {
        return this.violations.length > 0;
    }

    print() {
        console.log('\n' + colors.bold + '═══════════════════════════════════════════════════════════════' + colors.reset);
        console.log(colors.bold + '                    VALIDATION REPORT' + colors.reset);
        console.log(colors.bold + '═══════════════════════════════════════════════════════════════' + colors.reset + '\n');

        // Summary
        console.log(colors.cyan + 'Summary:' + colors.reset);
        console.log(`  ${colors.green}✓ Passed:${colors.reset}     ${this.passed.length}`);
        console.log(`  ${colors.yellow}⚠ Warnings:${colors.reset}   ${this.warnings.length}`);
        console.log(`  ${colors.red}✗ Violations:${colors.reset} ${this.violations.length}`);
        console.log('');

        // Violations
        if (this.violations.length > 0) {
            console.log(colors.red + colors.bold + '┌─ VIOLATIONS ─────────────────────────────────────────────────┐' + colors.reset);
            this.violations.forEach(v => {
                console.log(colors.red + `│ [${v.reqId}] ${v.phase}: ${v.message}` + colors.reset);
            });
            console.log(colors.red + '└──────────────────────────────────────────────────────────────┘' + colors.reset + '\n');
        }

        // Warnings
        if (this.warnings.length > 0) {
            console.log(colors.yellow + '┌─ WARNINGS ───────────────────────────────────────────────────┐' + colors.reset);
            this.warnings.forEach(w => {
                console.log(colors.yellow + `│ [${w.reqId}] ${w.phase}: ${w.message}` + colors.reset);
            });
            console.log(colors.yellow + '└──────────────────────────────────────────────────────────────┘' + colors.reset + '\n');
        }

        // Status
        if (this.hasViolations()) {
            console.log(colors.red + colors.bold + '❌ VALIDATION FAILED' + colors.reset + '\n');
        } else {
            console.log(colors.green + colors.bold + '✅ VALIDATION PASSED' + colors.reset + '\n');
        }
    }

    toJSON() {
        return {
            timestamp: new Date().toISOString(),
            summary: {
                passed: this.passed.length,
                warnings: this.warnings.length,
                violations: this.violations.length,
                status: this.hasViolations() ? 'FAILED' : 'PASSED'
            },
            violations: this.violations,
            warnings: this.warnings,
            passed: this.passed
        };
    }
}

// Load configuration
function loadConfig() {
    const config = {};
    if (!fs.existsSync(CONFIG_FILE)) {
        console.warn('Warning: config.properties not found, using defaults');
        return getDefaultConfig();
    }
    
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, value] = line.split('=').map(s => s.trim());
            if (key && value !== undefined) {
                config[key] = value === 'true' ? true : value === 'false' ? false : value;
            }
        }
    });
    return config;
}

function getDefaultConfig() {
    return {
        'enforce.spec.before.design': true,
        'enforce.design.before.implementation': true,
        'enforce.implementation.before.testing': true,
        'enforce.testing.before.deployment': true,
        'require.signoff.spec': true,
        'require.signoff.design': true,
        'validation.on.failure': 'warn',
        'validation.always.show.report': true
    };
}

// Load manifest
function loadManifest() {
    if (!fs.existsSync(MANIFEST_FILE)) {
        return { requirements: {} };
    }
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
}

// Check if file exists
function fileExists(reqPath, file) {
    return fs.existsSync(path.join(reqPath, file));
}

// Check sign-off in markdown file
function checkSignOff(filePath) {
    if (!fs.existsSync(filePath)) return { exists: false, signedOff: false };

    const content = fs.readFileSync(filePath, 'utf8');
    const hasSignOffSection = content.includes('## Sign-Off') || content.includes('## Sign-off');
    const isApproved = content.includes('✅ Approved') || content.includes('[x] Approved') ||
                       content.includes('Approved') && content.includes('☑');

    return { exists: true, signedOff: isApproved, hasSection: hasSignOffSection };
}

// Validate a single requirement
function validateRequirement(reqId, config, report) {
    const reqPath = path.join(REQUIREMENTS_DIR, reqId);

    if (!fs.existsSync(reqPath)) {
        report.addViolation(reqId, 'Structure', `Requirement folder does not exist: ${reqPath}`);
        return;
    }

    // Check spec
    const specFile = path.join(reqPath, '1-spec.md');
    const specCheck = checkSignOff(specFile);
    if (!specCheck.exists) {
        report.addViolation(reqId, 'Spec', 'Missing 1-spec.md file');
    } else {
        report.addPassed(reqId, 'Spec', '1-spec.md exists');
        if (config['require.signoff.spec'] && !specCheck.signedOff) {
            report.addWarning(reqId, 'Spec', 'Spec not signed off (require.signoff.spec=true)');
        }
    }

    // Check design
    const designFile = path.join(reqPath, '2-design.md');
    const designCheck = checkSignOff(designFile);
    if (!designCheck.exists) {
        if (config['enforce.spec.before.design'] && specCheck.exists) {
            report.addViolation(reqId, 'Design', 'Missing 2-design.md file');
        }
    } else {
        report.addPassed(reqId, 'Design', '2-design.md exists');
        if (config['require.signoff.design'] && !designCheck.signedOff) {
            report.addWarning(reqId, 'Design', 'Design not signed off (require.signoff.design=true)');
        }
    }

    // Check implementation
    const implPath = path.join(reqPath, '3-implementation');
    if (!fs.existsSync(implPath)) {
        if (designCheck.exists && config['enforce.design.before.implementation']) {
            report.addWarning(reqId, 'Implementation', 'Missing 3-implementation folder');
        }
    } else {
        const implFiles = fs.readdirSync(implPath, { recursive: true });
        if (implFiles.length === 0) {
            report.addWarning(reqId, 'Implementation', '3-implementation folder is empty');
        } else {
            report.addPassed(reqId, 'Implementation', `3-implementation contains ${implFiles.length} items`);
        }
    }

    // Check testing
    const testPath = path.join(reqPath, '4-testing');
    if (!fs.existsSync(testPath)) {
        if (fs.existsSync(implPath) && config['enforce.implementation.before.testing']) {
            report.addWarning(reqId, 'Testing', 'Missing 4-testing folder');
        }
    } else {
        const testPlan = path.join(testPath, 'test-plan.md');
        const testResults = path.join(testPath, 'test-results.md');

        if (!fs.existsSync(testPlan)) {
            report.addWarning(reqId, 'Testing', 'Missing test-plan.md');
        } else {
            report.addPassed(reqId, 'Testing', 'test-plan.md exists');
        }

        if (!fs.existsSync(testResults)) {
            report.addWarning(reqId, 'Testing', 'Missing test-results.md');
        } else {
            report.addPassed(reqId, 'Testing', 'test-results.md exists');
        }

        // Check evidence folder
        const evidencePath = path.join(testPath, 'evidence');
        if (!fs.existsSync(evidencePath)) {
            report.addWarning(reqId, 'Testing', 'Missing evidence folder');
        }
    }

    // Check deployment
    const deployFile = path.join(reqPath, '5-deployment.md');
    if (!fs.existsSync(deployFile)) {
        report.addWarning(reqId, 'Deployment', 'Missing 5-deployment.md');
    } else {
        report.addPassed(reqId, 'Deployment', '5-deployment.md exists');
    }
}

// Get all requirement folders
function getRequirementIds() {
    return fs.readdirSync(REQUIREMENTS_DIR)
        .filter(f => f.startsWith('REQ-') && fs.statSync(path.join(REQUIREMENTS_DIR, f)).isDirectory());
}

// Main execution
function main() {
    const args = process.argv.slice(2);
    const isPreDeploy = args.includes('--pre-deploy');
    const specificReq = args.find(a => a.startsWith('REQ-'));

    console.log(colors.cyan + '\n🔍 Spec-Driven Development Validator\n' + colors.reset);

    const config = loadConfig();
    const manifest = loadManifest();
    const report = new ValidationReport();

    // Determine which requirements to validate
    let reqIds;
    if (specificReq) {
        reqIds = [specificReq];
        console.log(`Validating: ${specificReq}`);
    } else {
        reqIds = getRequirementIds();
        console.log(`Found ${reqIds.length} requirements to validate`);
    }

    // Validate each requirement
    reqIds.forEach(reqId => {
        validateRequirement(reqId, config, report);
    });

    // Always show report
    if (config['validation.always.show.report'] || report.hasViolations()) {
        report.print();
    }

    // Save report
    const reportPath = path.join(REQUIREMENTS_DIR, 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report.toJSON(), null, 2));
    console.log(`Report saved to: ${reportPath}\n`);

    // Exit based on config
    if (report.hasViolations() && config['validation.on.failure'] === 'block') {
        console.log(colors.red + 'Blocking due to violations (validation.on.failure=block)' + colors.reset);
        process.exit(1);
    }

    process.exit(0);
}

main();

