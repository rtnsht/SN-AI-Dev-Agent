#!/usr/bin/env node
/**
 * Production Load Test — Uses Playwright to bypass Cloudflare JS challenge.
 * Tests the actual production endpoint https://snaiagent.rapps.ai
 *
 * Usage:
 *   node tests/prod-load-test.mjs
 *   node tests/prod-load-test.mjs --scenario 1
 *
 * Requires: playwright-core (optional dependency in package.json)
 */

import { performance } from "perf_hooks";

const PROD_URL = process.env.PROD_URL || "https://snaiagent.rapps.ai";
const args = process.argv.slice(2);
const SCENARIO_FILTER = (() => { const idx = args.indexOf("--scenario"); return idx !== -1 ? parseInt(args[idx + 1]) : null; })();

const SN_CREDS = {
  instanceUrl: process.env.SN_INSTANCE_URL || "https://your-instance.service-now.com",
  username: process.env.SN_USERNAME || "admin",
  password: process.env.SN_PASSWORD || "your-password",
  snAuthType: "basic",
};

let browser, context;

async function setup() {
  const { chromium } = await import("playwright-core");
  browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  context = await browser.newContext({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  // Warm up — solve CF challenge once
  console.log("🔐 Solving Cloudflare challenge...");
  const page = await context.newPage();
  const resp = await page.goto(`${PROD_URL}/api/config`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(3000);
  const body = await page.evaluate(() => document.body?.innerText);
  try {
    const data = JSON.parse(body);
    console.log(`✅ Production endpoint reachable (allowUserApiKeys: ${data.allowUserApiKeys})\n`);
  } catch {
    console.log("⚠️  CF challenge response, waiting longer...");
    await page.waitForTimeout(5000);
    const body2 = await page.evaluate(() => document.body?.innerText);
    console.log("Body:", body2?.slice(0, 200));
  }
  await page.close();
}

async function fetchViaContext(path, options = {}) {
  const page = await context.newPage();
  const start = performance.now();
  try {
    if (options.method === "POST") {
      // Use page.evaluate to make fetch from within the browser context
      const result = await page.evaluate(async ({ url, body, timeout }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout || 30000);
        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          clearTimeout(timer);
          const text = await resp.text();
          return { status: resp.status, size: text.length, ok: resp.ok, body: text.slice(0, 500) };
        } catch (e) {
          clearTimeout(timer);
          return { status: 0, size: 0, ok: false, error: e.message };
        }
      }, { url: `${PROD_URL}${path}`, body: options.body, timeout: options.timeout || 30000 });

      return { ...result, latency: performance.now() - start };
    } else {
      const resp = await page.goto(`${PROD_URL}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: options.timeout || 30000,
      });
      const body = await page.evaluate(() => document.body?.innerText || "");
      return {
        status: resp?.status() || 0,
        latency: performance.now() - start,
        size: body.length,
        ok: (resp?.status() || 0) >= 200 && (resp?.status() || 0) < 400,
        body: body.slice(0, 200),
      };
    }
  } catch (e) {
    return { status: 0, latency: performance.now() - start, size: 0, ok: false, error: e.message?.slice(0, 100) };
  } finally {
    await page.close().catch(() => {});
  }
}

function computeStats(results) {
  const lats = results.map(r => r.latency).sort((a, b) => a - b);
  const p = (arr, pct) => arr[Math.max(0, Math.ceil(pct / 100 * arr.length) - 1)];
  const errors = results.filter(r => !r.ok);
  return {
    total: results.length,
    successes: results.filter(r => r.ok).length,
    errorCount: errors.length,
    errorRate: ((errors.length / results.length) * 100).toFixed(1) + "%",
    p50: p(lats, 50).toFixed(0) + "ms",
    p95: p(lats, 95).toFixed(0) + "ms",
    p99: p(lats, 99).toFixed(0) + "ms",
    avg: (lats.reduce((a, b) => a + b, 0) / lats.length).toFixed(0) + "ms",
  };
}

async function runConcurrent(label, concurrency, requestFn) {
  console.log(`  ⏳ ${label} (${concurrency} concurrent)...`);
  const start = performance.now();
  const promises = Array.from({ length: concurrency }, (_, i) => requestFn(i));
  const results = await Promise.all(promises);
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  const stats = computeStats(results);
  console.log(`  ✅ ${stats.successes}/${stats.total} OK | p50=${stats.p50} p95=${stats.p95} | ${elapsed}s`);
  if (stats.errorCount > 0) {
    const errSample = results.filter(r => !r.ok).slice(0, 2).map(r => `${r.status}:${r.error||""}`).join(", ");
    console.log(`  ❌ ${stats.errorCount} errors (${stats.errorRate}): ${errSample}`);
  }
  return { label, concurrency, ...stats, elapsed: elapsed + "s" };
}

const allResults = [];

async function scenario1() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  PROD S1: API Endpoint Stress (via Cloudflare)         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  const results = [];
  for (const n of [5, 10, 25, 50]) {
    results.push(await runConcurrent("GET /api/config", n, () => fetchViaContext("/api/config")));
  }
  for (const n of [5, 10, 25, 50]) {
    results.push(await runConcurrent("GET /api/changelog", n, () => fetchViaContext("/api/changelog")));
  }
  allResults.push({ scenario: "PROD S1: API Endpoint Stress", results });
}

async function scenario2() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  PROD S2: SN Connection via Production                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  const results = [];
  for (const n of [3, 5, 10]) {
    results.push(await runConcurrent("POST /api/test-connection (valid)", n, () =>
      fetchViaContext("/api/test-connection", { method: "POST", body: SN_CREDS, timeout: 30000 })
    ));
  }
  for (const n of [5, 10, 25]) {
    results.push(await runConcurrent("POST /api/test-connection (invalid)", n, () =>
      fetchViaContext("/api/test-connection", { method: "POST", body: { instanceUrl: "https://nonexistent.service-now.com", username: "x", password: "x", snAuthType: "basic" }, timeout: 15000 })
    ));
  }
  allResults.push({ scenario: "PROD S2: SN Connection Burst", results });
}

async function scenario3() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  PROD S3: Chat Stream via Production (Anthropic)       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  const results = [];
  for (const n of [3, 5]) {
    results.push(await runConcurrent("POST /api/chat-stream", n, (i) =>
      fetchViaContext("/api/chat-stream", {
        method: "POST",
        body: {
          credentials: SN_CREDS,
          messages: [{ role: "user", content: "Hello, briefly introduce yourself.", timestamp: new Date().toISOString() }],
          model: "claude-sonnet-4-6",
          aiProvider: "anthropic",
          phase: null,
          sddMode: false,
          sessionId: `sess_${Date.now()}_prodlt${String(i).padStart(4, "0")}`,
        },
        timeout: 60000,
      })
    ));
  }
  allResults.push({ scenario: "PROD S3: Chat Stream", results });
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  PRODUCTION Load Test (via Cloudflare)                 ║");
  console.log(`║  Target: ${PROD_URL.padEnd(46)}║`);
  console.log(`║  Time:   ${new Date().toISOString().padEnd(46)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  await setup();

  const scenarios = [scenario1, scenario2, scenario3];
  for (let i = 0; i < scenarios.length; i++) {
    if (SCENARIO_FILTER !== null && SCENARIO_FILTER !== i + 1) continue;
    await scenarios[i]();
  }

  console.log("\n\n" + "═".repeat(60));
  console.log("PRODUCTION RESULTS SUMMARY");
  console.log("═".repeat(60));
  for (const group of allResults) {
    console.log(`\n### ${group.scenario}\n`);
    console.log("| Test | Concurrency | Total | Success | Errors | p50 | p95 | Duration |");
    console.log("|------|-------------|-------|---------|--------|-----|-----|----------|");
    for (const r of group.results) {
      console.log(`| ${r.label} | ${r.concurrency} | ${r.total} | ${r.successes} | ${r.errorCount} (${r.errorRate}) | ${r.p50} | ${r.p95} | ${r.elapsed} |`);
    }
  }
  console.log("\n✅ Production load test complete.");
  await browser?.close();
}

main().catch(async (e) => { console.error("Fatal:", e); await browser?.close(); process.exit(1); });
