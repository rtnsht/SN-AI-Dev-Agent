/**
 * ATF (Automated Test Framework) Tools
 *
 * Tools for creating, executing, and polling ATF test suites on ServiceNow.
 * Supports server-side test steps (Record Query, Record Validation, Run Server-Side Script)
 * and execution via CI/CD API with browser automation (Playwright) fallback.
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ── Type coercion helpers ──
const coerceOptBool = (def: boolean) =>
  z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v === undefined ? undefined : v),
    z.boolean().optional().default(def)
  );

// ============ SCHEMAS ============

export const enableAtfPropertySchema = z.object({});

export const createAtfSuiteSchema = z.object({
  name: z.string().describe('Test suite name'),
  description: z.string().optional().describe('Description of the test suite'),
  tests: z.array(z.object({
    name: z.string().describe('Test name'),
    description: z.string().optional().describe('Test description'),
    steps: z.array(z.object({
      step_config_name: z.enum([
        'Run Server Side Script',
        'Record Query',
        'Record Validation',
        'Record Insert',
        'Record Update'
      ]).describe('ATF step type name — must match sys_atf_step_config.name on the instance'),
      description: z.string().optional().describe('Step description'),
      inputs: z.record(z.string()).optional().describe('Step input parameters as key-value pairs (JSON string values)'),
    })).describe('Test steps in execution order')
  })).describe('Tests to create in the suite')
});

export const runAtfSuiteSchema = z.object({
  suite_sys_id: z.string().describe('sys_id of the ATF test suite to run'),
  suite_name: z.string().optional().describe('Display name of the suite (for logging)'),
  use_browser: coerceOptBool(false).describe('If true, attempt Playwright browser automation to trigger the suite when CI/CD API fails')
});

export const getAtfResultsSchema = z.object({
  suite_sys_id: z.string().describe('sys_id of the ATF test suite'),
  include_test_details: coerceOptBool(true).describe('Include individual test pass/fail details')
});

// ============ IMPLEMENTATIONS ============

/**
 * sn_enable_atf_property — Enable the sn_atf.runner.enabled system property.
 * Required before ATF tests can be executed on the instance.
 */
export async function enableAtfProperty(client: ServiceNowClient) {
  try {
    const props = await client.getRecords('sys_properties', {
      sysparm_query: 'name=sn_atf.runner.enabled',
      sysparm_fields: 'sys_id,name,value',
      sysparm_limit: 1
    });

    if (props.length > 0 && String(props[0].value) === 'true') {
      return {
        success: true,
        message: 'ATF runner property is already enabled',
        alreadyEnabled: true,
        sys_id: String(props[0].sys_id)
      };
    }

    if (props.length > 0) {
      await client.updateRecord('sys_properties', String(props[0].sys_id), { value: 'true' });
      return {
        success: true,
        message: 'ATF runner property enabled successfully',
        sys_id: String(props[0].sys_id)
      };
    }

    // Property doesn't exist — create it
    const created = await client.createRecord('sys_properties', {
      name: 'sn_atf.runner.enabled',
      value: 'true',
      type: 'boolean',
      description: 'Enable ATF test runner — set by SN AI Agent'
    });

    return {
      success: true,
      message: 'ATF runner property created and enabled',
      sys_id: String(created.sys_id)
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to enable ATF property: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * sn_create_atf_suite — Create a complete ATF test suite with tests and server-side steps.
 * Discovers step_config sys_ids from the instance, then creates suite → tests → steps → links.
 */
export async function createAtfSuite(client: ServiceNowClient, input: z.infer<typeof createAtfSuiteSchema>) {
  try {
    // 1. Discover step_config sys_ids from instance
    const stepConfigs = await client.getRecords('sys_atf_step_config', {
      sysparm_query: 'nameINRun Server Side Script,Record Query,Record Validation,Record Insert,Record Update',
      sysparm_fields: 'sys_id,name',
      sysparm_limit: 10
    });

    if (stepConfigs.length === 0) {
      return {
        success: false,
        error: 'Could not find ATF step configurations on this instance. The ATF plugin may not be activated.'
      };
    }

    const configMap: Record<string, string> = {};
    for (const c of stepConfigs) {
      configMap[String(c.name)] = String(c.sys_id);
    }

    // 2. Create test suite
    const suite = await client.createRecord('sys_atf_test_suite', {
      name: input.name,
      description: input.description || `Auto-generated ATF test suite by SN AI Agent`,
      active: true
    });
    const suiteId = String(suite.sys_id);

    // 3. Create tests + steps + link to suite
    const createdTests: Array<{ name: string; sys_id: string; stepCount: number }> = [];
    const errors: string[] = [];

    for (let i = 0; i < input.tests.length; i++) {
      const testDef = input.tests[i];

      try {
        const test = await client.createRecord('sys_atf_test', {
          name: testDef.name,
          description: testDef.description || '',
          active: true
        });
        const testId = String(test.sys_id);

        // Create steps
        let stepsCreated = 0;
        for (let j = 0; j < testDef.steps.length; j++) {
          const stepDef = testDef.steps[j];
          const stepConfigId = configMap[stepDef.step_config_name];

          if (!stepConfigId) {
            errors.push(`Step config "${stepDef.step_config_name}" not found on instance — skipped for test "${testDef.name}"`);
            continue;
          }

          try {
            const stepData: Record<string, unknown> = {
              test: testId,
              step_config: stepConfigId,
              description: stepDef.description || stepDef.step_config_name,
              order: (j + 1) * 100,
            };

            // Map inputs to step fields if provided
            if (stepDef.inputs) {
              for (const [key, value] of Object.entries(stepDef.inputs)) {
                stepData[key] = value;
              }
            }

            await client.createRecord('sys_atf_step', stepData);
            stepsCreated++;
          } catch (stepErr) {
            errors.push(`Failed to create step ${j + 1} in test "${testDef.name}": ${stepErr instanceof Error ? stepErr.message : String(stepErr)}`);
          }
        }

        // Link test to suite
        await client.createRecord('sys_atf_test_suite_test', {
          test_suite: suiteId,
          test: testId,
          order: (i + 1) * 100
        });

        createdTests.push({ name: testDef.name, sys_id: testId, stepCount: stepsCreated });
      } catch (testErr) {
        errors.push(`Failed to create test "${testDef.name}": ${testErr instanceof Error ? testErr.message : String(testErr)}`);
      }
    }

    const hasErrors = errors.length > 0;
    const hasTests = createdTests.length > 0;

    return {
      success: hasTests,
      partialSuccess: hasTests && hasErrors ? true : undefined,
      message: hasTests
        ? `ATF Test Suite "${input.name}" created with ${createdTests.length} test(s)${hasErrors ? ` (${errors.length} error(s) during creation)` : ''}`
        : `Failed to create any tests for suite "${input.name}"`,
      suite: { sys_id: suiteId, name: input.name },
      tests: createdTests,
      stepConfigsFound: Object.keys(configMap),
      errors: hasErrors ? errors : undefined,
      note: hasTests ? 'Use sn_run_atf_suite to trigger execution, or run manually from the ServiceNow UI.' : 'Review the errors above and try again.'
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to create ATF suite: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * sn_run_atf_suite — Trigger ATF test suite execution.
 * Tier 1: CI/CD API (POST /api/sn_cicd/testsuite/run)
 * Tier 2: Browser automation via Playwright (if use_browser=true)
 * Tier 3: Manual fallback with user instructions
 */
export async function runAtfSuite(client: ServiceNowClient, input: z.infer<typeof runAtfSuiteSchema>) {
  const suiteName = input.suite_name || input.suite_sys_id;

  // ── Tier 1: CI/CD API ──
  try {
    // Use the public callScriptedRestApi method — avoids unsafe private client access
    const response = await client.callScriptedRestApi(
      `/api/sn_cicd/testsuite/run?test_suite_sys_id=${input.suite_sys_id}`,
      'POST'
    );

    return {
      success: true,
      method: 'cicd_api',
      message: `ATF suite "${suiteName}" execution triggered via CI/CD API`,
      response,
      note: 'Use sn_get_atf_results to poll for completion and results.'
    };
  } catch (cicdErr) {
    const cicdError = cicdErr instanceof Error ? cicdErr.message : String(cicdErr);

    // ── Tier 2: Browser automation via Playwright ──
    if (input.use_browser) {
      try {
        const browserResult = await runAtfViaBrowser(client, input.suite_sys_id, suiteName);
        if (browserResult.success) return browserResult;
      } catch (browserErr) {
        // Fall through to manual instructions
      }
    }

    // ── Tier 3: Manual fallback ──
    return {
      success: false,
      method: 'manual_required',
      message: `Could not trigger ATF execution automatically for "${suiteName}".`,
      cicdError,
      manualSteps: [
        'To run the tests manually:',
        `1. Open the test suite in your browser: sys_atf_test_suite.do?sys_id=${input.suite_sys_id}`,
        '2. Click "Run Test Suite" in the upper right',
        '3. If prompted, select "Use my browser as the client test runner"',
        '4. Wait for execution to complete (typically 15-60 seconds)',
        '5. Come back here and tell me "done" — I will pull the results immediately',
      ],
      note: 'The CI/CD API may require the sn_cicd plugin or Cloud Runners to be configured. Browser automation can be enabled with use_browser=true.'
    };
  }
}

/**
 * Attempt to run ATF suite via Playwright browser automation.
 * Uses dynamic import to avoid hard dependency on playwright-core
 * (which lives in the webapp, not the MCP package).
 */
async function runAtfViaBrowser(
  client: ServiceNowClient,
  suiteSysId: string,
  suiteName: string
): Promise<{ success: boolean; method?: string; message?: string; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chromium: any;
  try {
    // @ts-ignore — playwright-core is an optional peer dependency (lives in webapp, not MCP)
    const pw = await import(/* webpackIgnore: true */ 'playwright-core');
    chromium = pw.chromium;
  } catch {
    return {
      success: false,
      error: 'playwright-core is not available. Browser automation for ATF requires playwright-core to be installed.'
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let context: any = null;

  try {
    const instanceUrl = client.instanceUrl?.replace(/\/+$/, '') || '';
    if (!instanceUrl) {
      return { success: false, error: 'Instance URL not available for browser navigation' };
    }

    // Determine headless mode from env (matches browser-scope-switcher.ts pattern)
    const browserMode = process.env.BROWSER_SCOPE_SWITCH_MODE || 'headless';
    const headless = browserMode !== 'headed';

    browser = await chromium.launch({ headless });

    // Build context options with auth credentials
    const creds = client.credentials;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contextOptions: Record<string, any> = { ignoreHTTPSErrors: true };
    if (creds.username && creds.password) {
      contextOptions.httpCredentials = { username: creds.username, password: creds.password };
    }

    context = await browser.newContext(contextOptions);

    // Inject session cookies if available (mirrors browser-scope-switcher.ts pattern)
    if (creds.sessionCookies?.length) {
      const playwrightCookies = creds.sessionCookies
        .filter((c: { name?: string; value?: string; domain?: string }) => c.name && c.value && c.domain)
        .map((c: { name: string; value: string; domain: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string }) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path || '/',
          ...(c.expires ? { expires: c.expires } : {}),
          httpOnly: c.httpOnly ?? false,
          secure: c.secure ?? true,
          sameSite: (c.sameSite || 'Lax') as 'Strict' | 'Lax' | 'None',
        }));
      if (playwrightCookies.length > 0) {
        await context.addCookies(playwrightCookies);
      }
    }

    const page = await context.newPage();

    // Navigate to the test suite
    await page.goto(`${instanceUrl}/sys_atf_test_suite.do?sys_id=${suiteSysId}`, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    // Wait for page to be fully loaded (no more network activity)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      // networkidle may not fire on complex SN pages — proceed anyway
    });

    // Look for the "Run Test Suite" button using explicit selector wait
    const runButtonSelector = 'button:has-text("Run Test Suite"), [id*="run_suite"], [data-action="runSuite"]';
    try {
      await page.waitForSelector(runButtonSelector, { timeout: 10000 });
    } catch {
      return {
        success: false,
        error: 'Could not find the Run Test Suite button. The page may require authentication or the suite may not exist.'
      };
    }

    const runButton = page.locator(runButtonSelector);
    await runButton.first().click();

    // Wait for SN to process the execution request (watch for network activity to settle)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      // Best effort — execution may have been triggered even if networkidle doesn't fire
    });

    return {
      success: true,
      method: 'browser_playwright',
      message: `ATF suite "${suiteName}" triggered via browser automation. Use sn_get_atf_results to poll for results.`
    };
  } catch (err) {
    return {
      success: false,
      error: `Browser automation failed: ${err instanceof Error ? err.message : String(err)}`
    };
  } finally {
    // Safe cleanup — null-guarded to prevent ReferenceError if newContext() or launch() threw
    try { if (context) await context.close(); } catch { /* best effort */ }
    try { if (browser) await browser.close(); } catch { /* best effort */ }
  }
}

/**
 * sn_get_atf_results — Poll for ATF test suite execution results.
 * Queries sys_atf_test_suite_result for suite-level status and
 * sys_atf_test_result for individual test pass/fail details.
 */
export async function getAtfResults(client: ServiceNowClient, input: z.infer<typeof getAtfResultsSchema>) {
  try {
    // Get suite-level results
    const suiteResults = await client.getRecords('sys_atf_test_suite_result', {
      sysparm_query: `test_suite=${input.suite_sys_id}^ORDERBYDESCsys_created_on`,
      sysparm_fields: 'sys_id,status,start_time,end_time,duration,output,passed_tests,failed_tests,skipped_tests',
      sysparm_limit: 5
    });

    if (suiteResults.length === 0) {
      return {
        success: true,
        message: 'No results found. The suite may still be executing or has not been run yet.',
        results: [],
        suggestion: 'If you just triggered execution, wait 15-30 seconds and try again.'
      };
    }

    const latest = suiteResults[0];
    let testDetails: Array<Record<string, unknown>> = [];

    if (input.include_test_details && latest.sys_id) {
      testDetails = await client.getRecords('sys_atf_test_result', {
        sysparm_query: `parent=${latest.sys_id}^ORDERBYorder`,
        sysparm_fields: 'sys_id,test,status,start_time,end_time,duration,output,error',
        sysparm_limit: 50
      });
    }

    return {
      success: true,
      latestRun: {
        sys_id: String(latest.sys_id),
        status: String(latest.status),
        startTime: latest.start_time,
        endTime: latest.end_time,
        duration: latest.duration,
        passed: latest.passed_tests,
        failed: latest.failed_tests,
        skipped: latest.skipped_tests,
      },
      testDetails: testDetails.map(t => ({
        test: t.test,
        status: String(t.status),
        duration: t.duration,
        output: t.output,
        error: t.error || undefined
      })),
      totalRuns: suiteResults.length,
      note: String(latest.status) === 'success'
        ? 'All tests passed.'
        : String(latest.status) === 'failure'
          ? 'Some tests failed. Review the testDetails for specifics.'
          : `Suite status: ${latest.status}. Results may still be processing.`
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to get ATF results: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
