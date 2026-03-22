#!/usr/bin/env node
/**
 * SDD Load Test Runner — Zero-dependency Node.js concurrent load tester.
 *
 * Usage:
 *   node tests/load-test.mjs                          # Run all scenarios against localhost
 *   node tests/load-test.mjs --base-url https://snaiagent.rapps.ai  # Against production
 *   node tests/load-test.mjs --scenario 1             # Run specific scenario
 *   node tests/load-test.mjs --scenario 1 --base-url https://snaiagent.rapps.ai
 */

import { performance } from "perf_hooks";
import http from "http";
import https from "https";

/* ── Configuration ── */
const args = process.argv.slice(2);
const DEFAULT_PORT = "3000";
const BASE_URL = getArg("--base-url") || process.env.LOAD_TEST_BASE_URL || `http://localhost:${DEFAULT_PORT}`;
const SCENARIO_FILTER = getArg("--scenario") ? parseInt(getArg("--scenario")) : null;
const SN_CREDS = {
  instanceUrl: process.env.SN_INSTANCE_URL || "https://your-instance.service-now.com",
  username: process.env.SN_USERNAME || "admin",
  password: process.env.SN_PASSWORD || "your-password",
  snAuthType: "basic",
};

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

/* ── HTTP Request Helper ── */
function makeRequest(url, options = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SDD-LoadTest/1.0",
        ...(options.headers || {}),
      },
      timeout: options.timeout || 30000,
    };

    const req = lib.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          latency: performance.now() - start,
          size: Buffer.byteLength(data),
          ok: res.statusCode >= 200 && res.statusCode < 400,
          body: data,
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        status: 0,
        latency: performance.now() - start,
        size: 0,
        ok: false,
        error: err.message,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        status: 0,
        latency: performance.now() - start,
        size: 0,
        ok: false,
        error: "timeout",
      });
    });

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

/* ── Statistics Calculator ── */
function computeStats(results) {
  const latencies = results.map((r) => r.latency).sort((a, b) => a - b);
  const successes = results.filter((r) => r.ok).length;
  const errors = results.filter((r) => !r.ok);
  const statusCodes = {};
  results.forEach((r) => {
    statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
  });

  const percentile = (arr, p) => {
    const idx = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, idx)];
  };

  return {
    total: results.length,
    successes,
    errorCount: errors.length,
    errorRate: ((errors.length / results.length) * 100).toFixed(1) + "%",
    p50: percentile(latencies, 50).toFixed(0) + "ms",
    p95: percentile(latencies, 95).toFixed(0) + "ms",
    p99: percentile(latencies, 99).toFixed(0) + "ms",
    min: Math.min(...latencies).toFixed(0) + "ms",
    max: Math.max(...latencies).toFixed(0) + "ms",
    avg: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0) + "ms",
    statusCodes,
    errors: errors.slice(0, 5).map((e) => ({ status: e.status, error: e.error })),
  };
}

/* ── Concurrent Runner ── */
async function runConcurrent(label, concurrency, requestFn) {
  console.log(`\n  ⏳ ${label} (${concurrency} concurrent)...`);
  const start = performance.now();

  // Fire all requests simultaneously
  const promises = Array.from({ length: concurrency }, (_, i) => requestFn(i));
  const results = await Promise.all(promises);

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  const stats = computeStats(results);
  const rps = (results.length / (parseFloat(elapsed) || 1)).toFixed(0);

  console.log(
    `  ✅ ${stats.successes}/${stats.total} OK | p50=${stats.p50} p95=${stats.p95} p99=${stats.p99} | ${rps} req/s | ${elapsed}s`
  );
  if (stats.errorCount > 0) {
    console.log(`  ❌ ${stats.errorCount} errors (${stats.errorRate}): ${JSON.stringify(stats.statusCodes)}`);
  }

  return { label, concurrency, ...stats, elapsed: elapsed + "s", rps: rps + " req/s" };
}

/* ── Sustained Load Runner ── */
async function runSustained(label, concurrency, durationSec, requestFn) {
  console.log(`\n  ⏳ ${label} (${concurrency} concurrent, ${durationSec}s)...`);
  const allResults = [];
  const endTime = performance.now() + durationSec * 1000;
  let wave = 0;

  while (performance.now() < endTime) {
    wave++;
    const promises = Array.from({ length: concurrency }, (_, i) => requestFn(wave * concurrency + i));
    const results = await Promise.all(promises);
    allResults.push(...results);
  }

  const stats = computeStats(allResults);
  const rps = (allResults.length / durationSec).toFixed(0);
  console.log(
    `  ✅ ${stats.successes}/${stats.total} OK | p50=${stats.p50} p95=${stats.p95} | ${rps} req/s over ${durationSec}s | ${allResults.length} total requests`
  );
  if (stats.errorCount > 0) {
    console.log(`  ❌ ${stats.errorCount} errors (${stats.errorRate})`);
  }

  return { label, concurrency, duration: durationSec + "s", totalRequests: allResults.length, ...stats, rps: rps + " req/s" };
}

/* ── Format results as markdown table ── */
function toMarkdownTable(results) {
  const headers = "| Test | Concurrency | Total | Success | Errors | p50 | p95 | p99 | Throughput | Duration |";
  const sep = "|------|-------------|-------|---------|--------|-----|-----|-----|-----------|----------|";
  const rows = results.map(
    (r) =>
      `| ${r.label} | ${r.concurrency} | ${r.totalRequests || r.total} | ${r.successes} | ${r.errorCount} (${r.errorRate}) | ${r.p50} | ${r.p95} | ${r.p99} | ${r.rps} | ${r.elapsed || r.duration || "-"} |`
  );
  return [headers, sep, ...rows].join("\n");
}

/* ══════════════════════════════════════════════════════════
   SCENARIOS
   ══════════════════════════════════════════════════════════ */

const allResults = [];

async function scenario1() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO 1: API Endpoint Stress                       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const results = [];

  // /api/config — lightweight, no DB
  for (const n of [10, 50, 100, 500, 1000]) {
    results.push(
      await runConcurrent(`GET /api/config`, n, () =>
        makeRequest(`${BASE_URL}/api/config`)
      )
    );
  }

  // /api/changelog — Supabase query
  for (const n of [10, 50, 100, 500, 1000]) {
    results.push(
      await runConcurrent(`GET /api/changelog`, n, () =>
        makeRequest(`${BASE_URL}/api/changelog`)
      )
    );
  }

  // /api/openrouter-models — external API
  for (const n of [10, 50, 100]) {
    results.push(
      await runConcurrent(`GET /api/openrouter-models`, n, () =>
        makeRequest(`${BASE_URL}/api/openrouter-models`)
      )
    );
  }

  allResults.push({ scenario: "Scenario 1: API Endpoint Stress", results });
  return results;
}

async function scenario2() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO 2: ServiceNow Connection Burst               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const results = [];

  // Valid connection
  for (const n of [10, 25, 50]) {
    results.push(
      await runConcurrent(`POST /api/test-connection (valid)`, n, () =>
        makeRequest(`${BASE_URL}/api/test-connection`, {
          method: "POST",
          body: SN_CREDS,
          timeout: 30000,
        })
      )
    );
  }

  // Invalid connection (fast failure expected)
  for (const n of [50, 100, 200]) {
    results.push(
      await runConcurrent(`POST /api/test-connection (invalid)`, n, () =>
        makeRequest(`${BASE_URL}/api/test-connection`, {
          method: "POST",
          body: { instanceUrl: "https://nonexistent-test.service-now.com", username: "x", password: "x", snAuthType: "basic" },
          timeout: 15000,
        })
      )
    );
  }

  allResults.push({ scenario: "Scenario 2: ServiceNow Connection Burst", results });
  return results;
}

async function scenario3() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO 3: Chat Request Load                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const results = [];
  const chatBody = {
    credentials: SN_CREDS,
    messages: [{ role: "user", content: "Hello, what can you help me with?", timestamp: new Date().toISOString() }],
    model: "claude-sonnet-4-6",
    aiProvider: "anthropic",
    phase: null,
    sddMode: false,
  };

  // Light chat (greeting) — SSE stream, 200 = success even with tool errors
  for (const n of [5, 10, 25]) {
    results.push(
      await runConcurrent(`POST /api/chat-stream (greeting)`, n, (i) => {
        const sid = `sess_${Date.now()}_loadtest${String(i).padStart(4, "0")}`;
        return makeRequest(`${BASE_URL}/api/chat-stream`, {
          method: "POST",
          body: { ...chatBody, sessionId: sid },
          timeout: 60000,
        });
      })
    );
  }

  allResults.push({ scenario: "Scenario 3: Chat Request Load", results });
  return results;
}

async function scenario4() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO 4: Access Tier Enforcement                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const results = [];

  // Rapid changelog requests (testing access check path)
  results.push(
    await runConcurrent(`GET /api/config (access check)`, 100, () =>
      makeRequest(`${BASE_URL}/api/config`)
    )
  );

  // Rapid trial-status checks
  results.push(
    await runConcurrent(`GET /api/trial-status`, 50, () =>
      makeRequest(`${BASE_URL}/api/trial-status`)
    )
  );

  allResults.push({ scenario: "Scenario 4: Access Tier Enforcement", results });
  return results;
}

async function scenario5() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO 5: Supabase Under Load                       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const results = [];

  // Changelog reads — pure Supabase stress
  for (const n of [100, 500, 1000]) {
    results.push(
      await runConcurrent(`GET /api/changelog (Supabase read)`, n, () =>
        makeRequest(`${BASE_URL}/api/changelog`)
      )
    );
  }

  // Banners endpoint — also Supabase
  for (const n of [100, 500]) {
    results.push(
      await runConcurrent(`GET /api/banners (Supabase read)`, n, () =>
        makeRequest(`${BASE_URL}/api/banners`)
      )
    );
  }

  allResults.push({ scenario: "Scenario 5: Supabase Under Load", results });
  return results;
}

async function scenario6() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO 6: Sustained Load Stability                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const results = [];

  // Sustained /api/config polling (simulates 100 users refreshing)
  results.push(
    await runSustained(`Sustained GET /api/config`, 100, 30, () =>
      makeRequest(`${BASE_URL}/api/config`)
    )
  );

  // Sustained /api/changelog reads
  results.push(
    await runSustained(`Sustained GET /api/changelog`, 50, 30, () =>
      makeRequest(`${BASE_URL}/api/changelog`)
    )
  );

  // Rapid connect/disconnect burst
  results.push(
    await runSustained(`Sustained POST /test-connection (invalid)`, 20, 15, () =>
      makeRequest(`${BASE_URL}/api/test-connection`, {
        method: "POST",
        body: { instanceUrl: "https://nonexistent-burst.service-now.com", username: "x", password: "x", snAuthType: "basic" },
        timeout: 10000,
      })
    )
  );

  allResults.push({ scenario: "Scenario 6: Sustained Load Stability", results });
  return results;
}

async function scenario7() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO 7: OpenRouter Multi-Model Chat (3000 users)  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const results = [];

  // 3000 concurrent on stateless endpoints first
  console.log("\n  📊 Phase A: Stateless endpoint burst at 3000 concurrent\n");

  for (const endpoint of ["/api/config", "/api/changelog"]) {
    results.push(
      await runConcurrent(`GET ${endpoint} @3000`, 3000, () =>
        makeRequest(`${BASE_URL}${endpoint}`, { timeout: 30000 })
      )
    );
  }

  // OpenRouter chat — server-allowed models (cost-protected, no user key needed)
  const ALLOWED_MODELS = [
    { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (OR)" },
    { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash (OR)" },
    { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B (OR)" },
  ];

  // Premium models — require user-supplied key (tests cost-protection guard)
  const PREMIUM_MODELS = [
    { id: "qwen/qwen3.5-plus-02-15", label: "Qwen 3.5 Plus" },
    { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
    { id: "anthropic/claude-opus-4", label: "Claude Opus 4" },
    { id: "openai/gpt-5.4-pro", label: "GPT-5.4 Pro" },
  ];

  // Phase B: Verify cost-protection blocks premium models (should return 403)
  console.log("\n  📊 Phase B: Cost-protection guard — premium models (expect 403)\n");

  for (const model of PREMIUM_MODELS) {
    results.push(
      await runConcurrent(`Guard: ${model.label} (expect 403)`, 5, (i) => {
        const sid = `sess_${Date.now()}_grd${String(i).padStart(4, "0")}`;
        return makeRequest(`${BASE_URL}/api/chat-stream`, {
          method: "POST",
          body: {
            credentials: SN_CREDS,
            messages: [{ role: "user", content: "Hello", timestamp: new Date().toISOString() }],
            model: model.id,
            aiProvider: "openrouter",
            phase: null,
            sddMode: false,
            sessionId: sid,
          },
          timeout: 15000,
        });
      })
    );
  }

  // Phase C: Actual OpenRouter chat with server-allowed models
  console.log("\n  📊 Phase C: OpenRouter chat — server-allowed models\n");

  for (const model of ALLOWED_MODELS) {
    const chatBody = {
      credentials: SN_CREDS,
      messages: [{ role: "user", content: "Hello, briefly introduce yourself in one sentence.", timestamp: new Date().toISOString() }],
      model: model.id,
      aiProvider: "openrouter",
      phase: null,
      sddMode: false,
    };

    for (const n of [3, 5]) {
      results.push(
        await runConcurrent(`Chat: ${model.label}`, n, (i) => {
          const sid = `sess_${Date.now()}_or${String(i).padStart(4, "0")}`;
          return makeRequest(`${BASE_URL}/api/chat-stream`, {
            method: "POST",
            body: { ...chatBody, sessionId: sid },
            timeout: 120000,
          });
        })
      );
    }
  }

  // Phase D: Mixed model burst — all 3 allowed models simultaneous
  console.log("\n  📊 Phase D: Mixed allowed-model burst\n");

  results.push(
    await runConcurrent("Mixed allowed-model burst (3 models × 5)", 15, (i) => {
      const model = ALLOWED_MODELS[i % ALLOWED_MODELS.length];
      const sid = `sess_${Date.now()}_mix${String(i).padStart(4, "0")}`;
      return makeRequest(`${BASE_URL}/api/chat-stream`, {
        method: "POST",
        body: {
          credentials: SN_CREDS,
          messages: [{ role: "user", content: "Say hello in one word.", timestamp: new Date().toISOString() }],
          model: model.id,
          aiProvider: "openrouter",
          phase: null,
          sddMode: false,
          sessionId: sid,
        },
        timeout: 120000,
      });
    })
  );

  // Phase E: Sustained OpenRouter load — 30 seconds
  console.log("\n  📊 Phase E: Sustained OpenRouter chat (30s, mixed allowed models)\n");

  results.push(
    await runSustained("Sustained OpenRouter chat (allowed models)", 3, 30, (i) => {
      const model = ALLOWED_MODELS[i % ALLOWED_MODELS.length];
      const sid = `sess_${Date.now()}_sus${String(i).padStart(4, "0")}`;
      return makeRequest(`${BASE_URL}/api/chat-stream`, {
        method: "POST",
        body: {
          credentials: SN_CREDS,
          messages: [{ role: "user", content: "Reply with just OK.", timestamp: new Date().toISOString() }],
          model: model.id,
          aiProvider: "openrouter",
          phase: null,
          sddMode: false,
          sessionId: sid,
        },
        timeout: 120000,
      });
    })
  );

  allResults.push({ scenario: "Scenario 7: OpenRouter Multi-Model Chat (3000 users)", results });
  return results;
}

async function scenario8() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO 8: BYOK Premium Models (User-Supplied Keys)  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const userKeys = [
    process.env.OPENROUTER_USER_KEY_1,
    process.env.OPENROUTER_USER_KEY_2,
  ].filter(Boolean);

  if (userKeys.length === 0) {
    console.log("\n  ⚠️  Skipped: Set OPENROUTER_USER_KEY_1 and OPENROUTER_USER_KEY_2 env vars");
    console.log("     Example: OPENROUTER_USER_KEY_1=sk-or-v1-xxx node tests/load-test.mjs --scenario 8\n");
    return;
  }

  console.log(`  🔑 ${userKeys.length} user-supplied OpenRouter key(s) available\n`);

  const results = [];

  const PREMIUM_MODELS = [
    { id: "qwen/qwen3.5-plus-02-15", label: "Qwen 3.5 Plus" },
    { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
    { id: "anthropic/claude-opus-4", label: "Claude Opus 4" },
    { id: "openai/gpt-5.4-pro", label: "GPT-5.4 Pro" },
  ];

  // Phase A: Individual premium model tests (BYOK — bypasses cost guard)
  console.log("  📊 Phase A: Premium model chat with user-supplied keys\n");

  for (const model of PREMIUM_MODELS) {
    for (const n of [3, 5]) {
      results.push(
        await runConcurrent(`BYOK: ${model.label}`, n, (i) => {
          const key = userKeys[i % userKeys.length];
          const sid = `sess_${Date.now()}_byok${String(i).padStart(4, "0")}`;
          return makeRequest(`${BASE_URL}/api/chat-stream`, {
            method: "POST",
            body: {
              credentials: {
                ...SN_CREDS,
                openRouterApiKey: key,
                aiProvider: "openrouter",
              },
              messages: [{ role: "user", content: "Hello, briefly introduce yourself in one sentence.", timestamp: new Date().toISOString() }],
              model: model.id,
              aiProvider: "openrouter",
              phase: null,
              sddMode: false,
              sessionId: sid,
            },
            timeout: 120000,
          });
        })
      );
    }
  }

  // Phase B: Mixed premium model burst — all 4 models, 2 keys, simultaneous
  console.log("\n  📊 Phase B: Mixed premium model burst (4 models × 2 keys)\n");

  results.push(
    await runConcurrent("BYOK mixed premium burst", 20, (i) => {
      const model = PREMIUM_MODELS[i % PREMIUM_MODELS.length];
      const key = userKeys[i % userKeys.length];
      const sid = `sess_${Date.now()}_pmix${String(i).padStart(4, "0")}`;
      return makeRequest(`${BASE_URL}/api/chat-stream`, {
        method: "POST",
        body: {
          credentials: {
            ...SN_CREDS,
            openRouterApiKey: key,
            aiProvider: "openrouter",
          },
          messages: [{ role: "user", content: "Say hello in one word.", timestamp: new Date().toISOString() }],
          model: model.id,
          aiProvider: "openrouter",
          phase: null,
          sddMode: false,
          sessionId: sid,
        },
        timeout: 120000,
      });
    })
  );

  // Phase C: Sustained BYOK premium chat — 30 seconds
  console.log("\n  📊 Phase C: Sustained BYOK premium chat (30s)\n");

  results.push(
    await runSustained("BYOK sustained premium chat", 4, 30, (i) => {
      const model = PREMIUM_MODELS[i % PREMIUM_MODELS.length];
      const key = userKeys[i % userKeys.length];
      const sid = `sess_${Date.now()}_bsus${String(i).padStart(4, "0")}`;
      return makeRequest(`${BASE_URL}/api/chat-stream`, {
        method: "POST",
        body: {
          credentials: {
            ...SN_CREDS,
            openRouterApiKey: key,
            aiProvider: "openrouter",
          },
          messages: [{ role: "user", content: "Reply with just OK.", timestamp: new Date().toISOString() }],
          model: model.id,
          aiProvider: "openrouter",
          phase: null,
          sddMode: false,
          sessionId: sid,
        },
        timeout: 120000,
      });
    })
  );

  allResults.push({ scenario: "Scenario 8: BYOK Premium Models (User-Supplied Keys)", results });
  return results;
}

/* ── Main ── */
async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  SDD Load Test Runner v1.0                             ║");
  console.log(`║  Target: ${BASE_URL.padEnd(46)}║`);
  console.log(`║  Time:   ${new Date().toISOString().padEnd(46)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  // Quick health check
  console.log("\n🔍 Health check...");
  const health = await makeRequest(`${BASE_URL}/api/config`);
  if (!health.ok) {
    console.error(`❌ Server not reachable at ${BASE_URL} (status: ${health.status}, error: ${health.error})`);
    process.exit(1);
  }
  console.log(`✅ Server healthy (${health.latency.toFixed(0)}ms)`);

  const scenarios = [scenario1, scenario2, scenario3, scenario4, scenario5, scenario6, scenario7, scenario8];

  for (let i = 0; i < scenarios.length; i++) {
    if (SCENARIO_FILTER !== null && SCENARIO_FILTER !== i + 1) continue;
    await scenarios[i]();
  }

  // Output summary
  console.log("\n\n" + "═".repeat(60));
  console.log("FULL RESULTS SUMMARY");
  console.log("═".repeat(60));

  for (const group of allResults) {
    console.log(`\n### ${group.scenario}\n`);
    console.log(toMarkdownTable(group.results));
  }

  console.log("\n✅ Load test complete.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
