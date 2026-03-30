import assert from "node:assert/strict";
import test from "node:test";

let modelPlatformPromise: Promise<typeof import("../src/lib/model-platform.ts")> | null = null;

function loadModelPlatform() {
  process.env.CLAUDE_API_KEY = "server-claude-key";
  delete process.env.CLAUDE_API_KEYS;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEYS;

  modelPlatformPromise ??= import("../src/lib/model-platform.ts");
  return modelPlatformPromise;
}

test("loadModelCatalog exposes fallback provider coverage and availability states", async () => {
  const { loadModelCatalog } = await loadModelPlatform();
  const catalog = await loadModelCatalog(undefined, false);

  assert.ok(catalog.providers.includes("mimo"));
  assert.ok(catalog.providers.includes("glm"));

  const anthropicDefault = catalog.models.find((model) => model.key === "claude-sonnet-4-6");
  assert.ok(anthropicDefault);
  assert.equal(anthropicDefault?.available, true);
  assert.equal(anthropicDefault?.accessSource, "server_key");

  const openrouterModel = catalog.models.find((model) => model.key === "openrouter-free");
  assert.ok(openrouterModel);
  assert.equal(openrouterModel?.available, false);
  assert.match(openrouterModel?.disabledReason ?? "", /OpenRouter/i);
});

test("resolveModelExecution allows anthropic server-key models without user keys", async () => {
  const { resolveModelExecution } = await loadModelPlatform();
  const resolution = await resolveModelExecution({
    sessionId: "session-1",
    modelIdentifier: "claude-sonnet-4-6",
    allowUserKeys: false,
  });

  assert.equal(resolution.allowed, true);
  assert.equal(resolution.accessSource, "server_key");
  assert.equal(resolution.apiKey, "server-claude-key");
  assert.equal(resolution.userSuppliedKey, false);
});

test("resolveModelExecution blocks transports with no executable key", async () => {
  const { resolveModelExecution } = await loadModelPlatform();
  const resolution = await resolveModelExecution({
    sessionId: "session-2",
    modelIdentifier: "gemini-2.5-flash",
    allowUserKeys: false,
  });

  assert.equal(resolution.allowed, false);
  assert.equal(resolution.status, 400);
  assert.match(resolution.error ?? "", /OpenRouter/i);
});
