#!/usr/bin/env node
/**
 * Phase 0 Validation: Test scope switching via concoursepicker API
 *
 * Run: node tests/test-scope-switching.js
 *
 * This script validates the five-tier scope switching mechanism
 * against a live ServiceNow instance before production rollout.
 *
 * Tests:
 * 1. Concoursepicker GET — list available scopes
 * 2. Concoursepicker PUT — switch to a custom scope
 * 3. CSRF requirement — does PUT need X-UserToken / sysparm_ck?
 * 4. Preference key name — what is the exact sys_user_preference key?
 * 5. End-to-end — switch scope → create update set → verify application field
 */

import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../.env') });

const INSTANCE_URL = (process.env.SN_INSTANCE_URL || '').replace(/\/$/, '');
const USERNAME = process.env.SN_USERNAME || '';
const PASSWORD = process.env.SN_PASSWORD || '';

if (!INSTANCE_URL || !USERNAME || !PASSWORD) {
  console.error('Missing env vars: SN_INSTANCE_URL, SN_USERNAME, SN_PASSWORD');
  process.exit(1);
}

const jar = new CookieJar();
const client = wrapper(axios.create({
  baseURL: INSTANCE_URL,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  auth: { username: USERNAME, password: PASSWORD },
  timeout: 30000,
  jar,
  withCredentials: true,
}));

let passed = 0;
let failed = 0;

function ok(name, detail) {
  passed++;
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, detail) {
  failed++;
  console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
}

async function test1_getConcoursePickerApps() {
  console.log('\n── Test 1: GET /api/now/ui/concoursepicker/application ──');
  try {
    const resp = await client.get('/api/now/ui/concoursepicker/application');
    const result = resp.data?.result;
    if (result?.list && result.list.length > 0) {
      ok('Concoursepicker GET works', `${result.list.length} scopes, current: ${result.current}`);
      return result;
    }
    fail('Concoursepicker GET returned empty list');
    return null;
  } catch (e) {
    fail('Concoursepicker GET failed', e.response?.status || e.message);
    return null;
  }
}

async function test2_putConcoursePickerScope(scopeId, scopeName) {
  console.log(`\n── Test 2: PUT concoursepicker → switch to "${scopeName}" (${scopeId}) ──`);
  try {
    const resp = await client.put('/api/now/ui/concoursepicker/application', { app_id: scopeId });
    const result = resp.data?.result;
    ok('PUT accepted', `Response: ${JSON.stringify(result)}`);

    // Verify via GET
    const verify = await client.get('/api/now/ui/concoursepicker/application');
    const current = verify.data?.result?.current;
    if (current === scopeId) {
      ok('Scope verified via GET', `current = ${current}`);
    } else {
      fail('Scope mismatch after PUT', `expected ${scopeId}, got ${current}`);
    }
    return true;
  } catch (e) {
    fail('PUT concoursepicker failed', `${e.response?.status}: ${e.response?.data?.error?.message || e.message}`);
    return false;
  }
}

async function test3_csrfCheck(scopeId) {
  console.log(`\n── Test 3: CSRF requirement check ──`);
  try {
    // Try PUT without X-UserToken (should still work from external client)
    const resp = await client.put('/api/now/ui/concoursepicker/application', { app_id: scopeId });
    ok('PUT works without X-UserToken', `Status: ${resp.status}`);
  } catch (e) {
    if (e.response?.status === 403 || e.response?.status === 401) {
      fail('PUT requires CSRF token (X-UserToken)', 'Need to fetch sysparm_ck first');
    } else {
      fail('PUT failed for unknown reason', e.message);
    }
  }
}

async function test4_preferenceKeyName() {
  console.log('\n── Test 4: sys_user_preference key name ──');
  try {
    // Try both possible key names
    for (const key of ['apps.current.app', 'apps.current_app']) {
      const resp = await client.get('/api/now/table/sys_user_preference', {
        params: {
          sysparm_query: `name=${key}^user.user_name=${USERNAME}`,
          sysparm_fields: 'sys_id,name,value',
          sysparm_limit: 1,
        },
      });
      if (resp.data?.result?.length > 0) {
        ok(`Preference key found: "${key}"`, `value = ${resp.data.result[0].value}`);
      } else {
        console.log(`  ℹ️  No preference found for key "${key}"`);
      }
    }
  } catch (e) {
    fail('sys_user_preference query failed', e.message);
  }
}

async function test5_endToEnd(scopeId, scopeName) {
  console.log(`\n── Test 5: End-to-end scope → update set ──`);
  try {
    // 1. Switch scope
    await client.put('/api/now/ui/concoursepicker/application', { app_id: scopeId });

    // 2. Create update set in that scope
    const usName = `Scope-Test-${Date.now()}`;
    const usResp = await client.post('/api/now/table/sys_update_set', {
      name: usName,
      description: 'Phase 0 validation test — safe to delete',
      state: 'in progress',
      application: scopeId,
    });
    const us = usResp.data?.result;
    if (!us?.sys_id) {
      fail('Update set creation failed');
      return;
    }
    ok('Update set created', `${us.sys_id} / "${usName}"`);

    // 3. Verify application field
    const verifyResp = await client.get(`/api/now/table/sys_update_set/${us.sys_id}`, {
      params: { sysparm_fields: 'sys_id,name,application' },
    });
    const app = verifyResp.data?.result?.application;
    const appId = typeof app === 'object' ? app.value : app;
    if (appId === scopeId) {
      ok('Update set application matches scope', `application = ${appId}`);
    } else {
      fail('Update set application mismatch', `expected ${scopeId}, got ${appId}`);
    }

    // Cleanup: delete the test update set
    try {
      await client.delete(`/api/now/table/sys_update_set/${us.sys_id}`);
      console.log('  🧹 Cleaned up test update set');
    } catch { /* best effort */ }
  } catch (e) {
    fail('End-to-end test failed', e.response?.data?.error?.message || e.message);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Phase 0: Scope Switching Validation                ║');
  console.log(`║  Instance: ${INSTANCE_URL.substring(0, 42).padEnd(42)}║`);
  console.log('╚══════════════════════════════════════════════════════╝');

  // Test 1: List scopes
  const apps = await test1_getConcoursePickerApps();
  if (!apps) {
    console.log('\n⚠️  Cannot proceed without concoursepicker. Aborting.');
    process.exit(1);
  }

  // Find a non-global scope to test with
  const customScope = apps.list.find(a => a.sysId !== 'global' && a.scope !== 'global');
  if (!customScope) {
    console.log('\n⚠️  No custom scopes found. Create a scoped app first to test.');
    console.log('Available scopes:', apps.list.map(a => `${a.name} (${a.sysId})`).join(', '));
    process.exit(0);
  }

  console.log(`\nUsing custom scope: "${customScope.name}" (${customScope.sysId})`);

  // Test 2: Switch scope
  const switched = await test2_putConcoursePickerScope(customScope.sysId, customScope.name);

  // Test 3: CSRF check
  await test3_csrfCheck(customScope.sysId);

  // Test 4: Preference key
  await test4_preferenceKeyName();

  // Test 5: End-to-end
  if (switched) {
    await test5_endToEnd(customScope.sysId, customScope.name);
  }

  // Switch back to Global
  try {
    const globalScope = apps.list.find(a => a.scope === 'global' || a.sysId === 'global');
    if (globalScope) {
      await client.put('/api/now/ui/concoursepicker/application', { app_id: globalScope.sysId });
      console.log('\n  ↩️  Switched back to Global scope');
    }
  } catch { /* best effort */ }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════════`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
