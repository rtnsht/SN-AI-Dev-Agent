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

  const scenarios = [scenario1, scenario2, scenario3, scenario4, scenario5, scenario6];

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
