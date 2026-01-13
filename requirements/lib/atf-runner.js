#!/usr/bin/env node
/**
 * ServiceNow ATF (Automated Test Framework) Integration
 * 
 * This script provides utilities to:
 * 1. Create ATF test suites for requirements
 * 2. Run ATF tests via REST API
 * 3. Capture test results and screenshots
 * 
 * Usage:
 *   node atf-runner.js create REQ-001    # Create ATF suite for requirement
 *   node atf-runner.js run REQ-001       # Run ATF suite
 *   node atf-runner.js results REQ-001   # Get latest results
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../mcp-servicenow/.env') });
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const INSTANCE = process.env.SERVICENOW_INSTANCE || 'dev300943';
const USERNAME = process.env.SERVICENOW_USERNAME;
const PASSWORD = process.env.SERVICENOW_PASSWORD;

const BASE_URL = `https://${INSTANCE}.service-now.com`;

const api = axios.create({
    baseURL: BASE_URL,
    auth: { username: USERNAME, password: PASSWORD },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
});

/**
 * Create an ATF Test Suite for a requirement
 */
async function createTestSuite(reqId) {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
    const req = manifest.requirements[reqId];
    
    if (!req) {
        console.error(`Requirement ${reqId} not found in manifest`);
        return null;
    }

    console.log(`Creating ATF Test Suite for ${reqId}: ${req.shortTitle}`);

    // Create test suite
    const suiteResponse = await api.post('/api/now/table/sys_atf_test_suite', {
        name: `${reqId} - ${req.shortTitle}`,
        description: `Automated tests for ${reqId}`,
        active: true
    });

    const suiteId = suiteResponse.data.result.sys_id;
    console.log(`Created test suite: ${suiteId}`);

    // Update manifest with suite ID
    req.phases.testing.atfSuiteId = suiteId;
    fs.writeFileSync(path.join(__dirname, '../manifest.json'), JSON.stringify(manifest, null, 2));

    return suiteId;
}

/**
 * Create a server-side ATF test
 */
async function createServerTest(suiteId, testName, scriptBody) {
    console.log(`Creating server test: ${testName}`);

    const response = await api.post('/api/now/table/sys_atf_test', {
        name: testName,
        type: 'server_side_script',
        active: true,
        script: scriptBody
    });

    const testId = response.data.result.sys_id;

    // Add test to suite
    await api.post('/api/now/table/sys_atf_test_suite_test', {
        test_suite: suiteId,
        test: testId,
        order: 100
    });

    return testId;
}

/**
 * Run an ATF Test Suite
 */
async function runTestSuite(reqId) {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
    const req = manifest.requirements[reqId];
    
    if (!req || !req.phases.testing.atfSuiteId) {
        console.error(`No ATF suite found for ${reqId}. Run 'create' first.`);
        return null;
    }

    const suiteId = req.phases.testing.atfSuiteId;
    console.log(`Running ATF Test Suite: ${suiteId}`);

    // Trigger suite execution
    const response = await api.post(`/api/now/atf/suite/${suiteId}/run`);
    const executionId = response.data.result.execution_id;

    console.log(`Execution started: ${executionId}`);
    console.log(`Monitor at: ${BASE_URL}/sys_atf_test_suite_result.do?sys_id=${executionId}`);

    return executionId;
}

/**
 * Get ATF test results
 */
async function getTestResults(reqId) {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
    const req = manifest.requirements[reqId];
    
    if (!req || !req.phases.testing.atfSuiteId) {
        console.error(`No ATF suite found for ${reqId}`);
        return null;
    }

    const suiteId = req.phases.testing.atfSuiteId;

    // Get latest execution result
    const response = await api.get('/api/now/table/sys_atf_test_suite_result', {
        params: {
            sysparm_query: `test_suite=${suiteId}^ORDERBYDESCsys_created_on`,
            sysparm_limit: 1
        }
    });

    if (response.data.result.length === 0) {
        console.log('No test results found');
        return null;
    }

    const result = response.data.result[0];
    console.log('\n=== ATF Test Results ===');
    console.log(`Suite: ${result.test_suite.display_value}`);
    console.log(`Status: ${result.status}`);
    console.log(`Passed: ${result.passed_tests}`);
    console.log(`Failed: ${result.failed_tests}`);
    console.log(`Duration: ${result.run_time}ms`);

    // Save results to evidence folder
    const evidencePath = path.join(__dirname, `../${reqId}/4-testing/evidence/atf-results.json`);
    fs.writeFileSync(evidencePath, JSON.stringify(result, null, 2));
    console.log(`\nResults saved to: ${evidencePath}`);

    return result;
}

// Main execution
const command = process.argv[2];
const reqId = process.argv[3];

if (!command || !reqId) {
    console.log('Usage: node atf-runner.js <create|run|results> <REQ-XXX>');
    process.exit(1);
}

(async () => {
    try {
        switch (command) {
            case 'create': await createTestSuite(reqId); break;
            case 'run': await runTestSuite(reqId); break;
            case 'results': await getTestResults(reqId); break;
            default: console.error(`Unknown command: ${command}`);
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
})();

