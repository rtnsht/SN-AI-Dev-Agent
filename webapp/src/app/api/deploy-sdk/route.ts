import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "fs";
import path from "path";

export const maxDuration = 120;

interface DeploySDKRequest {
  /** The .now.ts flow code to deploy */
  code: string;
  /** Filename for the flow (e.g., "my-flow.now.ts") */
  fileName: string;
  /** ServiceNow scope string (e.g., "x_snc_yantra") */
  scope: string;
  /** sys_id of the scoped application */
  scopeId: string;
  /** ServiceNow credentials */
  credentials: {
    instanceUrl: string;
    username: string;
    password: string;
  };
  /** Whether to use --reinstall flag (first-time deploy) */
  reinstall?: boolean;
}

/**
 * POST /api/deploy-sdk
 * 
 * Deploys SDK fluent code (.now.ts) to a ServiceNow instance.
 * Steps:
 * 1. Write the .now.ts file to sdk-flows/src/fluent/
 * 2. Update sdk-flows/now.config.json with scope/scopeId
 * 3. Run `npx now-sdk build` 
 * 4. Run `npx now-sdk install` using CI env vars for auth
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeploySDKRequest;
    const { code, fileName, scope, scopeId, credentials } = body;
    // Coerce reinstall: AI agents may send string "true" instead of boolean true
    const reinstall = body.reinstall === true || body.reinstall === ("true" as unknown as boolean);

    // Validate required fields
    if (!code || !fileName || !scope || !scopeId) {
      return NextResponse.json(
        { error: "Missing required fields: code, fileName, scope, scopeId" },
        { status: 400 }
      );
    }

    // Resolve SN credentials (request body or env vars)
    const instanceUrl = credentials?.instanceUrl || process.env.SN_INSTANCE_URL || "";
    const username = credentials?.username || process.env.SN_USERNAME || "";
    const password = credentials?.password || process.env.SN_PASSWORD || "";

    if (!instanceUrl || !username || !password) {
      return NextResponse.json(
        { error: "Missing ServiceNow credentials" },
        { status: 400 }
      );
    }

    // Normalize instance URL to full https URL
    const normalizedUrl = instanceUrl.startsWith("https://")
      ? instanceUrl
      : instanceUrl.startsWith("http://")
        ? instanceUrl
        : `https://${instanceUrl}`;

    // Resolve sdk-flows directory (sibling to webapp)
    const sdkFlowsDir = path.resolve(process.cwd(), "..", "sdk-flows");
    if (!existsSync(sdkFlowsDir)) {
      return NextResponse.json(
        { error: `sdk-flows directory not found at ${sdkFlowsDir}` },
        { status: 500 }
      );
    }

    // Ensure filename ends with .now.ts
    const safeFileName = fileName.endsWith(".now.ts")
      ? fileName
      : `${fileName.replace(/\.ts$/, "")}.now.ts`;

    // Step 1: Write .now.ts file
    const fluentDir = path.join(sdkFlowsDir, "src", "fluent");
    mkdirSync(fluentDir, { recursive: true });
    const filePath = path.join(fluentDir, safeFileName);
    writeFileSync(filePath, code, "utf-8");

    // Step 2: Update now.config.json with scope
    const configPath = path.join(sdkFlowsDir, "now.config.json");
    const config = { scope, scopeId };
    writeFileSync(configPath, JSON.stringify(config, null, 4) + "\n", "utf-8");

    // CI env vars for non-interactive auth
    const ciEnv = {
      ...process.env,
      SN_SDK_NODE_ENV: "SN_SDK_CI_INSTALL",
      SN_SDK_INSTANCE_URL: normalizedUrl,
      SN_SDK_USER: username,
      SN_SDK_USER_PWD: password,
    };

    const execOpts = { cwd: sdkFlowsDir, env: ciEnv, timeout: 90_000, encoding: "utf-8" as const };

    // Step 3: Build
    let buildOutput: string;
    try {
      buildOutput = execSync("npx now-sdk build 2>&1", execOpts);
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return NextResponse.json({
        error: "SDK build failed",
        phase: "build",
        details: e.stdout || e.stderr || e.message || String(err),
      }, { status: 500 });
    }

    // Step 4: Validate build output — check for flow artifacts with INSERT_OR_UPDATE
    const distUpdateDir = path.join(sdkFlowsDir, "dist", "app", "update");
    const validationErrors: string[] = [];
    let flowArtifactFound = false;

    if (!existsSync(distUpdateDir)) {
      validationErrors.push("dist/app/update/ directory not found after build.");
    } else {
      const xmlFiles = readdirSync(distUpdateDir).filter((f: string) => f.endsWith(".xml"));
      const flowXmlFiles = xmlFiles.filter((f: string) => f.startsWith("sys_hub_flow_"));

      if (flowXmlFiles.length === 0) {
        validationErrors.push("No sys_hub_flow XML files found in build output.");
      }

      for (const xmlFile of flowXmlFiles) {
        const xmlContent = readFileSync(path.join(distUpdateDir, xmlFile), "utf-8");
        if (xmlContent.includes('action="DELETE"')) {
          validationErrors.push(`CRITICAL: ${xmlFile} contains action="DELETE" — destructive artifact.`);
        } else if (xmlContent.includes('action="INSERT_OR_UPDATE"')) {
          flowArtifactFound = true;
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: "Build output validation failed",
        phase: "validation",
        validationErrors,
        buildOutput,
        hint: "The .now.ts code compiled but produced invalid artifacts. Check syntax.",
      }, { status: 500 });
    }

    if (!flowArtifactFound) {
      return NextResponse.json({
        error: "No valid flow artifacts in build output",
        phase: "validation",
        buildOutput,
      }, { status: 500 });
    }

    // Step 5: Install
    let installOutput: string;
    const installCmd = reinstall
      ? "npx now-sdk install --reinstall 2>&1"
      : "npx now-sdk install 2>&1";
    try {
      installOutput = execSync(installCmd, execOpts);
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return NextResponse.json({
        error: "SDK install failed",
        phase: "install",
        details: e.stdout || e.stderr || e.message || String(err),
        buildOutput,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Flow deployed to ${scope} on ${normalizedUrl}`,
      fileName: safeFileName,
      scope,
      scopeId,
      buildOutput,
      installOutput,
      artifactValidation: "PASSED",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(err) },
      { status: 500 }
    );
  }
}

