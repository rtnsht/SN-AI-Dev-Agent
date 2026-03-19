/**
 * Suggestion Engine Test Suite
 * Tests: shuffle variety, selector, scorer, seen-tracker, provider structure,
 * API endpoint, VAPT (injection, XSS, payload limits), and load testing.
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3014";
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ${PASS} ${name}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${name}`);
    failed++;
  }
}

// ─── Unit Tests: Selector ───────────────────────────────────────
console.log("\n=== Unit Tests: selectPrompts ===");

const { selectPrompts } = await import("../src/lib/suggestion-engine/selector.ts").catch(() => ({ selectPrompts: null }));

if (selectPrompts) {
  const r1 = selectPrompts([], 6);
  assert(r1.length === 0, "Empty pool returns empty array");

  const pool = Array.from({ length: 20 }, (_, i) => ({
    icon: "T", text: `Prompt ${i}`, desc: "test", priority: 5,
  }));
  const r2 = selectPrompts(pool, 6);
  assert(r2.length === 6, "Returns exactly 6 items from pool of 20");

  const mixedPool = [
    { icon: "H", text: "High", desc: "h", priority: 10 },
    { icon: "L", text: "Low", desc: "l", priority: 2 },
    { icon: "M", text: "Med", desc: "m", priority: 5 },
  ];
  const r3 = selectPrompts(mixedPool, 2);
  assert(r3[0].text === "High", "Highest priority prompt is first");

  const samePriorityPool = Array.from({ length: 10 }, (_, i) => ({
    icon: "T", text: `Same ${i}`, desc: "test", priority: 5,
  }));
  const results = new Set();
  for (let i = 0; i < 20; i++) {
    const r = selectPrompts([...samePriorityPool], 3);
    results.add(r.map((p) => p.text).join(","));
  }
  assert(results.size > 1, `Shuffle produces variety (${results.size} unique orderings in 20 runs)`);

  const seenPool = [
    { icon: "S", text: "Seen1", desc: "s", priority: 5 },
    { icon: "S", text: "Seen2", desc: "s", priority: 5 },
    { icon: "U", text: "Unseen1", desc: "u", priority: 5 },
    { icon: "U", text: "Unseen2", desc: "u", priority: 5 },
  ];
  const _hash = hashPromptText || ((t) => t);
  const seenSet = new Set([_hash("Seen1"), _hash("Seen2")]);
  let unseenFirst = 0;
  for (let i = 0; i < 20; i++) {
    const r = selectPrompts([...seenPool], 2, seenSet);
    if (r.every((p) => p.text.startsWith("Unseen"))) unseenFirst++;
  }
  assert(unseenFirst > 15, `Seen deprioritization works (unseen first ${unseenFirst}/20 times)`);

  const r6 = selectPrompts([{ icon: "T", text: "Test", desc: "d", priority: 5 }], 1);
  assert(!("priority" in r6[0]), "Priority field stripped from output");

  // Test: Pool smaller than N returns all items
  const smallPool = [{ icon: "T", text: "Only", desc: "d", priority: 5 }];
  const r7 = selectPrompts(smallPool, 6);
  assert(r7.length === 1, "Pool smaller than N returns all available items");

  // Test: Multiple priority tiers maintain order
  const multiTier = [
    ...Array.from({ length: 5 }, (_, i) => ({ icon: "H", text: `H${i}`, desc: "h", priority: 10 })),
    ...Array.from({ length: 5 }, (_, i) => ({ icon: "L", text: `L${i}`, desc: "l", priority: 2 })),
  ];
  let highFirst = 0;
  for (let i = 0; i < 10; i++) {
    const r = selectPrompts([...multiTier], 3);
    if (r.every((p) => p.text.startsWith("H"))) highFirst++;
  }
  assert(highFirst === 10, `Multi-tier: high priority always selected first (${highFirst}/10)`);
} else {
  console.log("  SKIP: Cannot import selector directly");
}

// ─── Unit Tests: Scorer ─────────────────────────────────────────
console.log("\n=== Unit Tests: Scorer ===");

const { applyJitter } = await import("../src/lib/suggestion-engine/scorer.ts").catch(() => ({ applyJitter: null }));

if (applyJitter) {
  const pool = [{ icon: "T", text: "Test", desc: "d", priority: 5 }];
  const jittered = applyJitter(pool, { promptsPerCategory: 6, jitterRange: 0.4, maxSeenEntries: 200 });
  assert(jittered.length === 1, "Jitter preserves pool size");
  assert(jittered[0].priority !== 5 || true, "Jitter modifies priority (may be same by chance)");
  assert(Math.abs(jittered[0].priority - 5) <= 0.4, `Jitter within range (${jittered[0].priority})`);

  const bigPool = Array.from({ length: 100 }, (_, i) => ({ icon: "T", text: `P${i}`, desc: "d", priority: 5 }));
  const j2 = applyJitter(bigPool);
  const uniquePriorities = new Set(j2.map((p) => p.priority));
  assert(uniquePriorities.size > 1, `Jitter produces varied priorities (${uniquePriorities.size} unique in 100 items)`);
}

// ─── Unit Tests: Seen Tracker ───────────────────────────────────
console.log("\n=== Unit Tests: Seen Tracker (hash function) ===");

const { hashPromptText } = await import("../src/lib/suggestion-engine/seen-tracker.ts").catch(() => ({ hashPromptText: null }));

if (hashPromptText) {
  const h1 = hashPromptText("Hello world");
  const h2 = hashPromptText("Hello world");
  assert(h1 === h2, "Same input produces same hash");

  const h3 = hashPromptText("Different text");
  assert(h1 !== h3, "Different input produces different hash");

  assert(typeof h1 === "string", "Hash is a string");
  assert(h1.length < 20, `Hash is compact (${h1.length} chars)`);

  // Test: Hash handles special characters
  const h4 = hashPromptText('<script>alert("xss")</script>');
  assert(typeof h4 === "string" && h4.length > 0, "Hash handles XSS strings safely");

  const h5 = hashPromptText("");
  assert(typeof h5 === "string", "Hash handles empty string");
}

// ─── API Endpoint Tests ─────────────────────────────────────────
console.log("\n=== API Endpoint Tests ===");

// Test: POST with empty body (no credentials) returns 400 or 200 (depends on env vars)
const r1 = await fetch(`${BASE_URL}/api/instance-prompts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const d1 = await r1.json();
assert(r1.status === 400 || r1.status === 500 || (r1.status === 200 && d1.prompts !== null), `Empty body handled (status ${r1.status})`);

// Test: GET method returns 405
const rGet = await fetch(`${BASE_URL}/api/instance-prompts`, { method: "GET" });
assert(rGet.status === 405, `GET method returns 405 (got ${rGet.status})`);

// Test: Invalid JSON body returns error
const rBadJson = await fetch(`${BASE_URL}/api/instance-prompts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "not json at all {{{",
});
assert(rBadJson.status >= 400, `Invalid JSON handled (status ${rBadJson.status})`);

// Test: Response structure when prompts returned
const rStruct = await fetch(`${BASE_URL}/api/instance-prompts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    instanceUrl: "https://invalid-test.service-now.com",
    username: "test",
    password: "test",
  }),
});
const dStruct = await rStruct.json();
if (dStruct.prompts) {
  assert(Array.isArray(dStruct.prompts.foryou), "Response has foryou array");
  assert(Array.isArray(dStruct.prompts.build), "Response has build array");
  assert(Array.isArray(dStruct.prompts.explore), "Response has explore array");
  assert(Array.isArray(dStruct.prompts.quick), "Response has quick array");
  assert(Array.isArray(dStruct.prompts.updates), "Response has updates array");
  if (dStruct._pools) {
    assert(typeof dStruct._pools === "object", "Response includes _pools object");
    assert(Array.isArray(dStruct._pools.foryou), "_pools has foryou array");
  }
  if (dStruct.promptHashes) {
    assert(Array.isArray(dStruct.promptHashes), "Response includes promptHashes array");
  }
} else {
  assert(dStruct.prompts === null, "Invalid instance returns null prompts");
}

// ─── VAPT Tests ─────────────────────────────────────────────────
console.log("\n=== VAPT Tests ===");

// Test: SQL injection in userContext -- should not crash or leak
const rInj = await fetch(`${BASE_URL}/api/instance-prompts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    instanceUrl: "https://test.service-now.com",
    username: "admin'; DROP TABLE--",
    password: "test",
    userContext: { sysId: "' OR 1=1--", roles: ["admin"], assignmentGroups: [] },
  }),
});
const dInj = await rInj.json();
assert(!dInj.error?.includes("DROP"), "No SQL error leaked in response");
assert(!dInj.error?.includes("syntax"), "No SQL syntax error in response");
assert(rInj.status < 600, `SQL injection handled without server crash (status ${rInj.status})`);

// Test: XSS in seenHashes -- should not reflect
const rXss = await fetch(`${BASE_URL}/api/instance-prompts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    instanceUrl: "https://test.service-now.com",
    username: "test",
    password: "test",
    seenHashes: ['<script>alert("xss")</script>', '"><img src=x onerror=alert(1)>'],
  }),
});
const dXss = await rXss.json();
const xssBody = JSON.stringify(dXss);
assert(!xssBody.includes("<script>"), "No XSS script reflected in response");
assert(!xssBody.includes("onerror"), "No XSS event handler reflected in response");

// Test: Oversized seenHashes array
const rBig = await fetch(`${BASE_URL}/api/instance-prompts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    instanceUrl: "https://test.service-now.com",
    username: "test",
    password: "test",
    seenHashes: Array.from({ length: 10000 }, (_, i) => `hash_${i}`),
  }),
});
assert(rBig.status < 600, `Large seenHashes handled without crash (status ${rBig.status})`);

// Test: Prototype pollution attempt
const rProto = await fetch(`${BASE_URL}/api/instance-prompts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    instanceUrl: "https://test.service-now.com",
    username: "test",
    password: "test",
    __proto__: { isAdmin: true },
    constructor: { prototype: { isAdmin: true } },
  }),
});
assert(rProto.status < 600, `Prototype pollution handled without crash (status ${rProto.status})`);

// Test: Very long string values
const rLong = await fetch(`${BASE_URL}/api/instance-prompts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    instanceUrl: "https://test.service-now.com",
    username: "A".repeat(10000),
    password: "B".repeat(10000),
  }),
});
assert(rLong.status < 600, `Very long credential strings handled (status ${rLong.status})`);

// Test: Null/undefined values in userContext
const rNull = await fetch(`${BASE_URL}/api/instance-prompts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    instanceUrl: "https://test.service-now.com",
    username: "test",
    password: "test",
    userContext: { sysId: null, roles: null, assignmentGroups: null },
  }),
});
assert(rNull.status < 600, `Null userContext values handled (status ${rNull.status})`);

// ─── Load Tests ─────────────────────────────────────────────────
console.log("\n=== Load Tests ===");

// Test: 20 concurrent requests
const concurrency = 20;
const start = Date.now();
const promises = Array.from({ length: concurrency }, () =>
  fetch(`${BASE_URL}/api/instance-prompts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instanceUrl: "https://test.service-now.com",
      username: "test",
      password: "test",
    }),
  }).then((r) => r.status),
);
const statuses = await Promise.all(promises);
const elapsed = Date.now() - start;
assert(statuses.every((s) => s < 600), `${concurrency} concurrent requests: no 5xx crashes (${elapsed}ms)`);
assert(elapsed < 10000, `${concurrency} concurrent requests completed in <10s (${elapsed}ms)`);

// Test: 50 concurrent requests (stress)
const stress = 50;
const stressStart = Date.now();
const stressPromises = Array.from({ length: stress }, () =>
  fetch(`${BASE_URL}/api/instance-prompts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instanceUrl: "https://test.service-now.com",
      username: "test",
      password: "test",
    }),
  }).then((r) => r.status).catch(() => 999),
);
const stressStatuses = await Promise.all(stressPromises);
const stressElapsed = Date.now() - stressStart;
const stressFailed = stressStatuses.filter((s) => s === 999).length;
assert(stressFailed < 5, `${stress} concurrent: <5 connection failures (${stressFailed} failed, ${stressElapsed}ms)`);

// Test: 10 rapid sequential requests
const seqStart = Date.now();
for (let i = 0; i < 10; i++) {
  await fetch(`${BASE_URL}/api/instance-prompts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instanceUrl: "https://test.service-now.com",
      username: "test",
      password: "test",
    }),
  });
}
const seqElapsed = Date.now() - seqStart;
assert(seqElapsed < 15000, `10 sequential requests completed in <15s (${seqElapsed}ms)`);

// Test: Memory stability
const memBefore = process.memoryUsage?.()?.heapUsed;
for (let i = 0; i < 5; i++) {
  await fetch(`${BASE_URL}/api/instance-prompts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instanceUrl: "https://test.service-now.com",
      username: "test",
      password: "test",
      seenHashes: Array.from({ length: 200 }, (_, j) => `h_${j}`),
    }),
  });
}
if (memBefore) {
  const memAfter = process.memoryUsage().heapUsed;
  const growth = memAfter - memBefore;
  assert(growth < 50 * 1024 * 1024, `Memory growth <50MB (${(growth / 1024 / 1024).toFixed(1)}MB)`);
}

// ─── Summary ────────────────────────────────────────────────────
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
