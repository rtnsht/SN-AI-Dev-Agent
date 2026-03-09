import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, symlinkSync } from "fs";
import path from "path";

export const maxDuration = 120;

interface DeploySDKRequest {
  code: string;
  keysTs: string;
  fileName: string;
  scope: string;
  scopeId: string;
  credentials: {
    instanceUrl: string;
    username: string;
    password: string;
  };
  reinstall?: boolean;
}

interface RegistryEntry {
  flowSysId: string;
  fileName: string;
  flowDisplayName?: string;
  scope: string;
  scopeId: string;
  instanceUrl: string;
  deployedAt: string;
  status: "deployed" | "undeployed";
  artifactIds: { flow: string; triggers: string[]; actions: string[] };
}

interface Registry {
  version: number;
  description: string;
  flows: Record<string, RegistryEntry>;
}

interface ParsedKeyEntry {
  key: string;
  table: string;
  id: string;
}

function readRegistry(sdkFlowsDir: string): Registry {
  const regPath = path.join(sdkFlowsDir, "registry.json");
  if (!existsSync(regPath)) {
    return { version: 1, description: "Tracks all SDK-deployed flows.", flows: {} };
  }
  return JSON.parse(readFileSync(regPath, "utf-8"));
}

function writeRegistry(sdkFlowsDir: string, registry: Registry): void {
  writeFileSync(path.join(sdkFlowsDir, "registry.json"), JSON.stringify(registry, null, 2) + "\n");
}

function getAppWorkspaceDir(sdkFlowsDir: string, scope: string): string {
  return path.join(sdkFlowsDir, "apps", scope);
}

function getFlowSourcePath(appDir: string, safeFileName: string): string {
  return path.join(appDir, "src", "fluent", safeFileName);
}

function getKeysFragmentsDir(appDir: string): string {
  return path.join(appDir, "keys");
}

function getKeysFragmentPath(appDir: string, flowName: string): string {
  return path.join(getKeysFragmentsDir(appDir), `${flowName}.keys.ts`);
}

function getMergedKeysPath(appDir: string): string {
  return path.join(appDir, "src", "fluent", "generated", "keys.ts");
}

function parseKeyEntries(keysTs: string): ParsedKeyEntry[] {
  const entries: ParsedKeyEntry[] = [];
  const entryRegex = /([A-Za-z0-9_]+)\s*:\s*\{\s*table:\s*['"]([^'"]+)['"]\s*;\s*id:\s*['"]([^'"]+)['"]\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(keysTs)) !== null) {
    entries.push({ key: match[1], table: match[2], id: match[3] });
  }
  return entries;
}

function extractArtifactIdsFromKeysTs(keysTs: string) {
  const result = { flow: "", triggers: [] as string[], actions: [] as string[] };
  for (const entry of parseKeyEntries(keysTs)) {
    if (entry.table === "sys_hub_flow") result.flow = entry.id;
    else if (entry.table === "sys_hub_trigger_instance_v2") result.triggers.push(entry.id);
    else if (entry.table === "sys_hub_action_instance_v2") result.actions.push(entry.id);
  }
  return result;
}

function buildMergedKeysTs(fragmentPaths: string[]) {
  const merged = new Map<string, ParsedKeyEntry>();
  const conflicts: string[] = [];
  for (const fragmentPath of fragmentPaths.sort()) {
    const fragment = readFileSync(fragmentPath, "utf-8");
    for (const entry of parseKeyEntries(fragment)) {
      const existing = merged.get(entry.key);
      if (!existing) {
        merged.set(entry.key, entry);
        continue;
      }
      if (existing.table !== entry.table || existing.id !== entry.id) {
        conflicts.push(`Key "${entry.key}" conflicts between fragments: ${existing.table}/${existing.id} vs ${entry.table}/${entry.id} (${path.basename(fragmentPath)})`);
      }
    }
  }

  const bodyLines = Array.from(merged.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(entry => `          ${entry.key}: { table: '${entry.table}'; id: '${entry.id}' }`);

  return {
    conflicts,
    content: [
      `import '@servicenow/sdk/global'`,
      "",
      "declare global {",
      "  namespace Now {",
      "    namespace Internal {",
      "      interface Keys extends KeysRegistry {",
      "        explicit: {",
      ...bodyLines,
      "        }",
      "      }",
      "    }",
      "  }",
      "}",
      "",
    ].join("\n"),
  };
}

function refreshMergedKeysFile(appDir: string) {
  const keysDir = getKeysFragmentsDir(appDir);
  const generatedKeysPath = getMergedKeysPath(appDir);
  const fragmentPaths = existsSync(keysDir)
    ? readdirSync(keysDir).filter(name => name.endsWith(".keys.ts")).map(name => path.join(keysDir, name))
    : [];

  if (fragmentPaths.length === 0) {
    if (existsSync(generatedKeysPath)) execSync(`rm -f "${generatedKeysPath}"`);
    return { generatedKeysPath, fragmentCount: 0, conflicts: [] as string[] };
  }

  const merged = buildMergedKeysTs(fragmentPaths);
  mkdirSync(path.dirname(generatedKeysPath), { recursive: true });
  writeFileSync(generatedKeysPath, merged.content, "utf-8");
  return { generatedKeysPath, fragmentCount: fragmentPaths.length, conflicts: merged.conflicts };
}

function restorePreviousFlowSource(appDir: string, flowSourcePath: string, previousCode: string | null, keysFragmentPath: string, previousKeysTs: string | null) {
  if (previousCode === null) execSync(`rm -f "${flowSourcePath}"`);
  else writeFileSync(flowSourcePath, previousCode, "utf-8");
  if (previousKeysTs === null) execSync(`rm -f "${keysFragmentPath}"`);
  else writeFileSync(keysFragmentPath, previousKeysTs, "utf-8");
  refreshMergedKeysFile(appDir);
}

function extractFlowDisplayName(code: string, fallbackFlowName: string): string {
  const nameMatch = code.match(/\bname\s*:\s*['"]([^'"]+)['"]/);
  return nameMatch?.[1] || fallbackFlowName;
}

async function fetchInstalledFlowArtifacts(normalizedUrl: string, username: string, password: string, flowDisplayName: string, scopeId: string) {
  const headers = {
    "Authorization": "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
    "Accept": "application/json",
  };

  const flowUrl = `${normalizedUrl}/api/now/table/sys_hub_flow?sysparm_query=${encodeURIComponent(`name=${flowDisplayName}^sys_scope=${scopeId}^ORDERBYDESCsys_updated_on`)}&sysparm_fields=sys_id,name&sysparm_limit=1`;
  const flowResp = await fetch(flowUrl, { headers });
  if (!flowResp.ok) return { flow: "", triggers: [] as string[], actions: [] as string[] };

  const flowData = (await flowResp.json()) as { result?: Array<{ sys_id?: string }> };
  const flowSysId = flowData.result?.[0]?.sys_id || "";
  if (!flowSysId) return { flow: "", triggers: [] as string[], actions: [] as string[] };

  const triggerUrl = `${normalizedUrl}/api/now/table/sys_hub_trigger_instance_v2?sysparm_query=${encodeURIComponent(`flow=${flowSysId}`)}&sysparm_fields=sys_id&sysparm_limit=200`;
  const actionUrl = `${normalizedUrl}/api/now/table/sys_hub_action_instance_v2?sysparm_query=${encodeURIComponent(`flow=${flowSysId}`)}&sysparm_fields=sys_id&sysparm_limit=200`;
  const [triggerResp, actionResp] = await Promise.all([fetch(triggerUrl, { headers }), fetch(actionUrl, { headers })]);
  const triggerData = triggerResp.ok ? await triggerResp.json() as { result?: Array<{ sys_id?: string }> } : { result: [] };
  const actionData = actionResp.ok ? await actionResp.json() as { result?: Array<{ sys_id?: string }> } : { result: [] };

  return {
    flow: flowSysId,
    triggers: (triggerData.result || []).flatMap(row => row.sys_id ? [String(row.sys_id)] : []),
    actions: (actionData.result || []).flatMap(row => row.sys_id ? [String(row.sys_id)] : []),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeploySDKRequest;
    const { code, keysTs, fileName, scope, scopeId, credentials } = body;
    const reinstall = body.reinstall === true || (body.reinstall as unknown) === "true";

    if (reinstall) {
      return NextResponse.json({
        error: "reinstall=true is disabled for SDK flow deployment.",
        phase: "input",
        hint: "This route only supports safe incremental installs. If you need a baseline for an existing app, run now-sdk init --from <scopeId> outside this deploy route first.",
      }, { status: 400 });
    }
    if (!code || !fileName || !scope || !scopeId) {
      return NextResponse.json({ error: "Missing required fields: code, fileName, scope, scopeId" }, { status: 400 });
    }
    if (!keysTs) {
      return NextResponse.json({ error: "Missing keysTs — provide generated/keys.ts content" }, { status: 400 });
    }

    const instanceUrl = credentials?.instanceUrl || process.env.SN_INSTANCE_URL || "";
    const username = credentials?.username || process.env.SN_USERNAME || "";
    const password = credentials?.password || process.env.SN_PASSWORD || "";
    if (!instanceUrl || !username || !password) {
      return NextResponse.json({ error: "Missing ServiceNow credentials" }, { status: 400 });
    }

    const normalizedUrl = instanceUrl.startsWith("https://") ? instanceUrl : instanceUrl.startsWith("http://") ? instanceUrl : `https://${instanceUrl}`;
    const sdkFlowsDir = path.resolve(process.cwd(), "..", "sdk-flows");
    if (!existsSync(sdkFlowsDir)) {
      return NextResponse.json({ error: `sdk-flows directory not found at ${sdkFlowsDir}` }, { status: 500 });
    }

    const safeFileName = fileName.endsWith(".now.ts") ? fileName : `${fileName.replace(/\.ts$/, "")}.now.ts`;
    const flowName = safeFileName.replace(/\.now\.ts$/, "");
    const flowDisplayName = extractFlowDisplayName(code, flowName);

    let appName: string;
    let appVersion = "1.0.0";
    try {
      const appUrl = `${normalizedUrl}/api/now/table/sys_app/${scopeId}?sysparm_fields=name,version,scope`;
      const appResp = await fetch(appUrl, {
        headers: {
          "Authorization": "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
          "Accept": "application/json",
        },
      });
      if (appResp.ok) {
        const appData = (await appResp.json()) as { result?: { name?: string; version?: string } };
        if (appData.result?.name) {
          appName = String(appData.result.name).toLowerCase().replace(/[^a-z0-9-]/g, "-");
          if (appData.result.version) appVersion = String(appData.result.version);
        } else appName = scope.replace(/_/g, "-");
      } else appName = scope.replace(/_/g, "-");
    } catch {
      appName = scope.replace(/_/g, "-");
    }

    const appDir = getAppWorkspaceDir(sdkFlowsDir, scope);
    const flowSourcePath = getFlowSourcePath(appDir, safeFileName);
    const keysFragmentPath = getKeysFragmentPath(appDir, flowName);
    const previousCode = existsSync(flowSourcePath) ? readFileSync(flowSourcePath, "utf-8") : null;
    const previousKeysTs = existsSync(keysFragmentPath) ? readFileSync(keysFragmentPath, "utf-8") : null;

    mkdirSync(path.dirname(flowSourcePath), { recursive: true });
    mkdirSync(getKeysFragmentsDir(appDir), { recursive: true });
    const nmLink = path.join(appDir, "node_modules");
    const nmTarget = path.join(sdkFlowsDir, "node_modules");
    if (!existsSync(nmLink)) symlinkSync(nmTarget, nmLink);

    const pkgJson = {
      name: appName,
      version: appVersion,
      private: true,
      description: `SDK app workspace for ${scope}`,
      scripts: { build: "now-sdk build", clean: "rm -rf dist .now-sdk-cache .now" },
    };
    writeFileSync(path.join(appDir, "package.json"), JSON.stringify(pkgJson, null, 2) + "\n");
    writeFileSync(path.join(appDir, "now.config.json"), JSON.stringify({ scope, scopeId }, null, 2) + "\n");

    writeFileSync(flowSourcePath, code, "utf-8");
    writeFileSync(keysFragmentPath, keysTs, "utf-8");

    const mergedKeys = refreshMergedKeysFile(appDir);
    if (mergedKeys.conflicts.length > 0) {
      restorePreviousFlowSource(appDir, flowSourcePath, previousCode, keysFragmentPath, previousKeysTs);
      return NextResponse.json({ error: "keys.ts merge conflict across app workspace", phase: "keys_merge", details: mergedKeys.conflicts }, { status: 500 });
    }

    const expectedArtifactIds = extractArtifactIdsFromKeysTs(keysTs);
    const distDir = path.join(appDir, "dist");
    const cacheDir = path.join(appDir, ".now-sdk-cache");
    if (existsSync(distDir)) execSync(`rm -rf "${distDir}"`);
    if (existsSync(cacheDir)) execSync(`rm -rf "${cacheDir}"`);

    const ciEnv = {
      ...process.env,
      SN_SDK_NODE_ENV: "SN_SDK_CI_INSTALL",
      SN_SDK_INSTANCE_URL: normalizedUrl,
      SN_SDK_USER: username,
      SN_SDK_USER_PWD: password,
    };
    const execOpts = { cwd: appDir, env: ciEnv, timeout: 90_000, encoding: "utf-8" as const };

    let buildOutput: string;
    try {
      buildOutput = execSync("npx now-sdk build 2>&1", execOpts);
    } catch (err: unknown) {
      restorePreviousFlowSource(appDir, flowSourcePath, previousCode, keysFragmentPath, previousKeysTs);
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return NextResponse.json({ error: "SDK build failed", phase: "build", details: e.stdout || e.stderr || e.message || String(err) }, { status: 500 });
    }

    const distUpdateDir = path.join(appDir, "dist", "app", "update");
    const validationErrors: string[] = [];
    let targetFlowArtifactFound = false;
    if (!existsSync(distUpdateDir)) {
      validationErrors.push("dist/app/update/ not found after build.");
    } else {
      const xmlFiles = readdirSync(distUpdateDir).filter(f => f.endsWith(".xml"));
      for (const xmlFile of xmlFiles) {
        const content = readFileSync(path.join(distUpdateDir, xmlFile), "utf-8");
        if (content.includes('action="DELETE"')) validationErrors.push(`CRITICAL: ${xmlFile} has action="DELETE".`);
      }
      if (expectedArtifactIds.flow) {
        const targetXml = path.join(distUpdateDir, `sys_hub_flow_${expectedArtifactIds.flow}.xml`);
        if (!existsSync(targetXml)) validationErrors.push(`Expected target flow artifact sys_hub_flow_${expectedArtifactIds.flow}.xml not found.`);
        else targetFlowArtifactFound = readFileSync(targetXml, "utf-8").includes('action="INSERT_OR_UPDATE"');
      } else {
        targetFlowArtifactFound = xmlFiles.some(f => f.startsWith("sys_hub_flow_") && f.endsWith(".xml"));
        if (!targetFlowArtifactFound) validationErrors.push("No sys_hub_flow XML found.");
      }
    }

    if (validationErrors.length > 0) {
      restorePreviousFlowSource(appDir, flowSourcePath, previousCode, keysFragmentPath, previousKeysTs);
      return NextResponse.json({ error: "Validation failed", phase: "validation", validationErrors, buildOutput }, { status: 500 });
    }
    if (!targetFlowArtifactFound) {
      restorePreviousFlowSource(appDir, flowSourcePath, previousCode, keysFragmentPath, previousKeysTs);
      return NextResponse.json({ error: "No valid target flow artifacts", phase: "validation", buildOutput }, { status: 500 });
    }

    let installOutput: string;
    try {
      installOutput = execSync("npx now-sdk install 2>&1", execOpts);
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const installError = e.stdout || e.stderr || e.message || String(err);
      return NextResponse.json({
        error: "SDK install failed",
        phase: "install",
        details: installError,
        buildOutput,
        hint: "Normal install failed. Keep reinstall disabled. If this scoped app needs a full SDK baseline, run 'now-sdk init --from <scopeId>' first and then retry the incremental install.",
      }, { status: 500 });
    }

    let artifactIds = expectedArtifactIds;
    if (!artifactIds.flow) artifactIds = await fetchInstalledFlowArtifacts(normalizedUrl, username, password, flowDisplayName, scopeId);

    const registry = readRegistry(sdkFlowsDir);
    registry.flows[flowName] = {
      flowSysId: artifactIds.flow,
      fileName: safeFileName,
      flowDisplayName,
      scope,
      scopeId,
      instanceUrl: normalizedUrl,
      deployedAt: new Date().toISOString(),
      status: "deployed",
      artifactIds,
    };
    writeRegistry(sdkFlowsDir, registry);

    return NextResponse.json({
      success: true,
      message: `Flow "${flowName}" deployed to ${scope} on ${normalizedUrl}`,
      flowName,
      flowDisplayName,
      fileName: safeFileName,
      scope,
      scopeId,
      flowSysId: artifactIds.flow,
      artifactIds,
      buildOutput,
      installOutput,
      workspace: appDir,
      filePath: flowSourcePath,
      keysFragmentPath,
      mergedKeysPath: mergedKeys.generatedKeysPath,
      workspaceMode: "app-scoped-persistent",
      artifactValidation: "PASSED",
    });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error", details: String(err) }, { status: 500 });
  }
}
