/**
 * Browser-based scope switcher and browser-assisted connect helper.
 *
 * Modes:
 * - `headless` (legacy default when ENABLE_BROWSER_SCOPE_SWITCH=true)
 * - `headed` (manual MFA/SSO completion in a visible browser)
 * - `cdp` (attach to an existing Chrome/Chromium session)
 */

import type { BrowserSessionCookie } from "./types";
import type { Browser, BrowserContext, Page } from "playwright-core";

const SERVICE_NOW_DOMAINS = [".service-now.com", ".servicenow.com"];
const IDP_SUFFIXES = [
  ".okta.com",
  ".microsoftonline.com",
  ".auth0.com",
  ".b2clogin.com",
];
const IDP_EXACT_HOSTS = ["accounts.google.com"];

const DEFAULT_HEADLESS_TIMEOUT_MS = 30_000;
const DEFAULT_INTERACTIVE_TIMEOUT_MS = 180_000;
const ONE_HOUR_MS = 3600_000;

export interface BrowserValidationResult {
  success: boolean;
  message: string;
  authType?: string;
  userInfo?: {
    name: string;
    username: string;
    sysId?: string;
    email?: string;
    assignmentGroups?: { sysId: string; name: string }[];
  };
  roles?: string[];
  hasAdmin?: boolean;
  hasSecurityAdmin?: boolean;
  noRoles?: boolean;
}

export interface BrowserScopeSwitchResult {
  success: boolean;
  error?: string;
  failureCategory?: "mfa_sso_redirect" | "mfa_challenge" | "generic";
  cookies?: BrowserSessionCookie[];
  sessionToken?: string;
  validationResult?: BrowserValidationResult;
}

export interface BrowserScopeCredentials {
  instanceUrl: string;
  username?: string;
  password?: string;
  sessionCookies?: BrowserSessionCookie[];
  forceMode?: "headless" | "headed" | "cdp"; // Override browser mode
  manualTimeoutMs?: number; // Request-scoped timeout override for interactive flows
  successMode?: BrowserAuthSuccessMode; // Internal: connect vs scope-switch success criteria
}

type BrowserMode = "headless" | "headed" | "cdp";
type BrowserAuthSuccessMode = "session" | "shell";
type BrowserWaitResult = BrowserScopeSwitchResult & { page?: Page };

// NOTE: In-memory rate limits assume a persistent server process (e.g., DigitalOcean App Platform).
// In serverless/Lambda deployments these reset on cold start and offer no protection.
const scopeRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const connectRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getBrowserMode(): BrowserMode | null {
  const configured = process.env.BROWSER_SCOPE_SWITCH_MODE;
  if (configured === "headless" || configured === "headed" || configured === "cdp") {
    return configured;
  }
  return process.env.ENABLE_BROWSER_SCOPE_SWITCH === "true" ? "headless" : null;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function consumeRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  maxPerHour: number,
): boolean {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || now > existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + ONE_HOUR_MS });
    return true;
  }
  if (existing.count >= maxPerHour) {
    return false;
  }
  existing.count += 1;
  return true;
}

function isHostAllowed(hostname: string, allowIdp: boolean): boolean {
  const normalized = hostname.toLowerCase();
  if (SERVICE_NOW_DOMAINS.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }
  return allowIdp && (
    IDP_EXACT_HOSTS.includes(normalized) ||
    IDP_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

function isAllowedUrl(url: string, allowIdp: boolean = false): boolean {
  try {
    return isHostAllowed(new URL(url).hostname, allowIdp);
  } catch {
    return false;
  }
}

function detectMfaSso(url: string): {
  detected: boolean;
  failureCategory?: "mfa_sso_redirect" | "mfa_challenge";
  reasonCode?: string;
} {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();
    const onServiceNowHost = SERVICE_NOW_DOMAINS.some((suffix) => hostname.endsWith(suffix));

    if (IDP_EXACT_HOSTS.includes(hostname) || IDP_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
      return {
        detected: true,
        failureCategory: "mfa_sso_redirect",
        reasonCode: `idp_host:${hostname}`,
      };
    }

    if (pathAndQuery.includes("/mfa") || pathAndQuery.includes("/otp") || pathAndQuery.includes("multifactor")) {
      return {
        detected: true,
        failureCategory: "mfa_challenge",
        reasonCode: "mfa_path",
      };
    }

    if (pathAndQuery.includes("/adfs/") || pathAndQuery.includes("/saml")) {
      return {
        detected: true,
        failureCategory: "mfa_sso_redirect",
        reasonCode: "federated_path",
      };
    }

    if (!onServiceNowHost && pathAndQuery.includes("/oauth")) {
      return {
        detected: true,
        failureCategory: "mfa_sso_redirect",
        reasonCode: "oauth_redirect",
      };
    }
  } catch {
    // Ignore malformed URLs — caller will handle generic failure.
  }

  return { detected: false };
}

function sanitizeErrorMessage(message: string, password?: string): string {
  if (!password) {
    return message;
  }
  return message.replace(new RegExp(password.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "***");
}

function toPlaywrightCookies(cookies: BrowserSessionCookie[]): BrowserSessionCookie[] {
  return cookies.filter((cookie) => Boolean(cookie.name && cookie.value && cookie.domain));
}

async function injectSessionCookies(context: BrowserContext, cookies: BrowserSessionCookie[]): Promise<void> {
  if (!cookies.length) {
    return;
  }

  await context.addCookies(
    cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || "/",
      expires: cookie.expires,
      httpOnly: cookie.httpOnly ?? false,
      secure: cookie.secure ?? false,
      sameSite: cookie.sameSite ?? "Lax",
    })),
  );
}

async function extractServiceNowCookies(context: BrowserContext, instanceUrl: string): Promise<BrowserSessionCookie[]> {
  const instanceHostname = new URL(instanceUrl).hostname.toLowerCase();
  const cookies = await context.cookies();
  return cookies
    .filter((cookie: { domain: string }) => {
      const domain = cookie.domain.toLowerCase();
      return (
        isHostAllowed(domain.replace(/^\./, ""), false) ||
        instanceHostname.endsWith(domain.replace(/^\./, "")) ||
        domain.endsWith(instanceHostname)
      );
    })
    .map((cookie: {
      name: string;
      value: string;
      domain: string;
      path?: string;
      expires?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "Strict" | "Lax" | "None";
    }) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || "/",
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    }));
}

function buildCookieHeader(cookies: BrowserSessionCookie[]): string {
  return cookies
    .map((c) => `${c.name}=${c.value.replace(/[;\r\n]/g, "")}`)
    .join("; ");
}

function looksLikeAuthenticatedServiceNowPage(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    isAllowedUrl(url, false) &&
    !detectMfaSso(url).detected &&
    !lower.includes("/login.do") &&
    !lower.includes("logout.do")
  );
}

async function probeServiceNowUiSession(
  instanceUrl: string,
  cookies: BrowserSessionCookie[],
): Promise<boolean> {
  const cookieHeader = buildCookieHeader(cookies);
  if (!cookieHeader) {
    return false;
  }

  try {
    const response = await fetch(`${instanceUrl}/api/now/ui/user/me`, {
      headers: {
        Accept: "application/json",
        Cookie: cookieHeader,
      },
      redirect: "manual",
      cache: "no-store",
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      return false;
    }

    const data = await response.json().catch(() => null);
    return Boolean(data);
  } catch {
    return false;
  }
}

function getPageUrl(page: Page): string | undefined {
  try {
    return page.url();
  } catch {
    return undefined;
  }
}

function isTargetClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /target page, context or browser has been closed|target closed|browser has disconnected/i.test(message);
}

function chooseActivePage(context: BrowserContext, currentPage?: Page): Page | undefined {
  const openPages = context.pages().filter((candidate) => !candidate.isClosed());
  if (openPages.length === 0) {
    return undefined;
  }

  const preferredPages = openPages.filter((candidate) => {
    const url = getPageUrl(candidate);
    return Boolean(
      url &&
      isAllowedUrl(url, true) &&
      !detectMfaSso(url).detected &&
      !url.toLowerCase().includes("/login.do"),
    );
  });

  if (currentPage && !currentPage.isClosed()) {
    const currentUrl = getPageUrl(currentPage);
    const currentIsPreferred = Boolean(
      currentUrl &&
      isAllowedUrl(currentUrl, true) &&
      !detectMfaSso(currentUrl).detected &&
      !currentUrl.toLowerCase().includes("/login.do"),
    );

    if (!currentIsPreferred && preferredPages.length > 0) {
      return preferredPages[preferredPages.length - 1];
    }

    return currentPage;
  }

  return preferredPages[preferredPages.length - 1] || openPages[openPages.length - 1];
}

async function hasAuthenticatedShell(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => Boolean(
      document.querySelector("#sysparm_ck, .navpage-header, #gsft_nav"),
    ));
  } catch {
    return false;
  }
}

async function hasAuthenticatedServiceNowSession(
  page: Page,
  context: BrowserContext,
  instanceUrl: string,
): Promise<boolean> {
  const currentUrl = getPageUrl(page);
  if (!currentUrl || !looksLikeAuthenticatedServiceNowPage(currentUrl)) {
    return false;
  }

  if (await hasPasswordForm(page)) {
    return false;
  }

  const cookies = await extractServiceNowCookies(context, instanceUrl);
  if (!cookies.some((cookie) => cookie.name === "JSESSIONID")) {
    return false;
  }

  if (await probeServiceNowUiSession(instanceUrl, cookies)) {
    return true;
  }

  // Classic / Studio pages can be valid authenticated landings even when the
  // main-frame UI probe does not expose the shell selectors we use elsewhere.
  return true;
}

async function hasAuthenticatedBrowserSession(
  page: Page,
  context: BrowserContext,
  instanceUrl: string,
  successMode: BrowserAuthSuccessMode,
): Promise<boolean> {
  if (await hasAuthenticatedShell(page)) {
    return true;
  }

  if (successMode === "session") {
    return hasAuthenticatedServiceNowSession(page, context, instanceUrl);
  }

  return false;
}

async function hasPasswordForm(page: Page): Promise<boolean> {
  try {
    const usernameField = page.locator("#user_name").first();
    const passwordField = page.locator("#user_password").first();
    const loginButton = page.locator("#sysverb_login").first();

    return (
      await usernameField.isVisible().catch(() => false)
    ) && (
      await passwordField.isVisible().catch(() => false)
    ) && (
      await loginButton.isVisible().catch(() => false)
    );
  } catch {
    return false;
  }
}

async function waitForAuthenticatedShell(
  context: BrowserContext,
  initialPage: Page,
  timeoutMs: number,
  successMode: BrowserAuthSuccessMode,
): Promise<BrowserWaitResult> {
  const startedAt = Date.now();
  let activePage: Page | undefined = initialPage;
  let lastUrl = getPageUrl(initialPage) || "";
  let checkCount = 0;
  
  while (Date.now() - startedAt < timeoutMs) {
    try {
      activePage = chooseActivePage(context, activePage);
      if (!activePage) {
        return {
          success: false,
          error: "The browser sign-in window was closed before authentication completed.",
          failureCategory: "generic",
        };
      }

      const currentUrl = getPageUrl(activePage);
      if (!currentUrl) {
        checkCount++;
        await activePage.waitForTimeout(500);
        continue;
      }
      
      // Log URL changes for debugging
      if (currentUrl !== lastUrl && checkCount % 10 === 0) {
        console.log(`[Browser] Waiting for authentication... Current URL: ${currentUrl}`);
        lastUrl = currentUrl;
      }
      
      // Check if we're on an IdP (this is expected during MFA/SSO)
      const detection = detectMfaSso(currentUrl);
      if (detection.detected) {
        // We're on an IdP or MFA page - this is expected, keep waiting
        // Don't fail - user is completing MFA/SSO
        checkCount++;
        await activePage.waitForTimeout(2000); // Check every 2 seconds when on IdP/MFA
        continue;
      }
      
      // If we're not on a ServiceNow domain or allowed IdP, that's a problem
      if (!isAllowedUrl(currentUrl, true)) {
        return {
          success: false,
          error: `Browser navigated to unsupported host: ${currentUrl}. Please complete sign-in on a ServiceNow domain.`,
          failureCategory: "generic",
        };
      }

      // Check if we've reached an authenticated ServiceNow page
      if (await hasAuthenticatedBrowserSession(activePage, context, new URL(currentUrl).origin, successMode)) {
        console.log(`[Browser] Authentication successful!`);
        return { success: true, page: activePage };
      }

      checkCount++;
      await activePage.waitForTimeout(1000);
    } catch (error) {
      if (isTargetClosedError(error)) {
        const replacementPage = chooseActivePage(context, undefined);
        if (replacementPage) {
          activePage = replacementPage;
          lastUrl = getPageUrl(replacementPage) || lastUrl;
          console.log("[Browser] Tracked page changed during sign-in, continuing with the latest browser page.");
          continue;
        }

        return {
          success: false,
          error: "The browser sign-in window was closed before authentication completed.",
          failureCategory: "generic",
        };
      }

      throw error;
    }
  }

  // Final check - what URL are we on?
  const finalPage = chooseActivePage(context, activePage);
  const finalUrl = finalPage ? getPageUrl(finalPage) : undefined;
  if (!finalUrl) {
    return {
      success: false,
      error: "The browser sign-in window was closed before authentication completed.",
      failureCategory: "generic",
    };
  }
  const finalDetection = detectMfaSso(finalUrl);
  
  return {
    success: false,
    error: finalDetection.detected
      ? `Timed out after ${Math.round(timeoutMs / 1000)}s. Please complete MFA/SSO sign-in in the browser window. Current URL: ${finalUrl}`
      : successMode === "session"
        ? `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for an authenticated ServiceNow browser session. Current URL: ${finalUrl}.`
        : `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for ServiceNow UI. Current URL: ${finalUrl}. Make sure you completed login and MFA.`,
    failureCategory: finalDetection.failureCategory || "generic",
  };
}

async function createBrowserSession(credentials: BrowserScopeCredentials): Promise<{
  success: boolean;
  error?: string;
  failureCategory?: "mfa_sso_redirect" | "mfa_challenge" | "generic";
  browser?: Browser;
  shouldCloseBrowser?: boolean;
  context?: BrowserContext;
  page?: Page;
  instanceUrl?: string;
}> {
  // Use forced mode if provided, otherwise check env vars
  const mode = credentials.forceMode || getBrowserMode();
  if (!mode) {
    return {
      success: false,
      error: "Browser-assisted ServiceNow sign-in is disabled on this server. Set BROWSER_SCOPE_SWITCH_MODE=headed or ENABLE_BROWSER_SCOPE_SWITCH=true",
      failureCategory: "generic",
    };
  }

  const successMode: BrowserAuthSuccessMode = credentials.successMode || "session";
  const instanceUrl = credentials.instanceUrl.replace(/\/$/, "");
  const shouldCloseBrowser = mode !== "cdp";
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  const fail = (
    error: string,
    failureCategory: BrowserScopeSwitchResult["failureCategory"] = "generic",
  ) => ({
    success: false as const,
    error,
    failureCategory,
    browser,
    shouldCloseBrowser,
    context,
    page,
    instanceUrl,
  });

  if (!isAllowedUrl(credentials.instanceUrl)) {
    return fail(`Instance URL not in allowlist: ${credentials.instanceUrl}`);
  }

  let chromium: typeof import("playwright-core").chromium;
  try {
    const playwright = await import("playwright-core");
    chromium = playwright.chromium;
  } catch {
    return {
      success: false,
      error: "playwright-core is not installed. Install it to enable browser-assisted ServiceNow sign-in.",
      failureCategory: "generic",
    };
  }

  const interactiveTimeoutMs = parsePositiveInt(
    credentials.manualTimeoutMs !== undefined
      ? String(credentials.manualTimeoutMs)
      : process.env.BROWSER_SCOPE_SWITCH_MANUAL_TIMEOUT_MS,
    DEFAULT_INTERACTIVE_TIMEOUT_MS,
  );
  const headlessTimeoutMs = parsePositiveInt(
    process.env.BROWSER_SCOPE_SWITCH_TIMEOUT_MS,
    DEFAULT_HEADLESS_TIMEOUT_MS,
  );

  try {
    if (mode === "cdp") {
      const cdpUrl = process.env.BROWSER_SCOPE_SWITCH_CDP_URL;
      if (!cdpUrl) {
        return fail("BROWSER_SCOPE_SWITCH_CDP_URL must be set when BROWSER_SCOPE_SWITCH_MODE=cdp");
      }

      browser = await chromium.connectOverCDP(cdpUrl, { timeout: interactiveTimeoutMs });
      context = browser.contexts()[0] || await browser.newContext({ ignoreHTTPSErrors: true });
      page = context.pages()[0] || await context.newPage();
    } else {
      browser = await chromium.launch({
        headless: mode === "headless",
        timeout: mode === "headless" ? headlessTimeoutMs : interactiveTimeoutMs,
      });
      context = await browser.newContext({ ignoreHTTPSErrors: true });
      page = await context.newPage();
    }

    if (credentials.sessionCookies?.length) {
      await injectSessionCookies(context, toPlaywrightCookies(credentials.sessionCookies));
      await page.goto(`${instanceUrl}/nav_to.do`, {
        timeout: mode === "headless" ? headlessTimeoutMs : interactiveTimeoutMs,
        waitUntil: "domcontentloaded",
      });
      if (await hasAuthenticatedBrowserSession(page, context, instanceUrl, successMode)) {
        return { success: true, browser, shouldCloseBrowser, context, page, instanceUrl };
      }
    }

    await page.goto(`${instanceUrl}/login.do`, {
      timeout: mode === "headless" ? headlessTimeoutMs : interactiveTimeoutMs,
      waitUntil: "domcontentloaded",
    });

    const initialDetection = detectMfaSso(page.url());
    if (initialDetection.detected && mode === "headless") {
      return fail(
        "MFA or SSO redirect detected. Headless browser mode cannot complete this sign-in flow.",
        initialDetection.failureCategory || "generic",
      );
    }

    const passwordFormVisible = await hasPasswordForm(page);
    if (passwordFormVisible && credentials.password) {
      if (credentials.username) {
        await page.fill("#user_name", credentials.username);
      }
      await page.fill("#user_password", credentials.password);
      await page.click("#sysverb_login");
    } else if (passwordFormVisible && mode === "headless") {
      return fail("Headless browser mode requires a password when the ServiceNow login form is shown.");
    }

    // For headed mode with MFA, give more time and provide better feedback
    const timeout = mode === "headless"
      ? 15_000
      : Math.max(interactiveTimeoutMs, 300_000); // At least 5 minutes for MFA
    
    if (mode === "headed") {
      console.log(`[Browser] Waiting up to ${Math.round(timeout / 1000)}s for you to complete sign-in and MFA...`);
    }
    
    const waitResult = await waitForAuthenticatedShell(context, page, timeout, successMode);

    if (!waitResult.success) {
      // Provide more helpful error message
      if (mode === "headed" && waitResult.failureCategory) {
        return fail(
          `${waitResult.error}\n\nTip: Make sure you complete all MFA steps and land on an authenticated ServiceNow page before retrying.`,
          waitResult.failureCategory,
        );
      }
      return fail(waitResult.error || "Browser authentication failed.", waitResult.failureCategory || "generic");
    }

    page = waitResult.page || page;

    return { success: true, browser, shouldCloseBrowser, context, page, instanceUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[Browser Session] createBrowserSession error:", message, stack);
    return fail(`Browser authentication failed: ${sanitizeErrorMessage(message, credentials.password)}`);
  }
}

/**
 * Connect to ServiceNow through a real browser session and export ServiceNow cookies.
 * This is intended for local/manual MFA or SSO flows.
 */
export async function connectViaBrowser(
  credentials: BrowserScopeCredentials,
): Promise<BrowserScopeSwitchResult> {
  const instanceHost = credentials.instanceUrl.replace(/https?:\/\//, "").replace(/\/.*$/, "");
  const rateLimitKey = `${credentials.username || "anonymous"}:${instanceHost}:connect`;
  const maxAttempts = parsePositiveInt(process.env.BROWSER_CONNECT_MAX_ATTEMPTS_PER_HOUR, 2);

  if (!consumeRateLimit(connectRateLimitMap, rateLimitKey, maxAttempts)) {
    return {
      success: false,
      error: "Rate limit exceeded: max 2 browser-assisted connect attempts per hour",
      failureCategory: "generic",
    };
  }

  let session: Awaited<ReturnType<typeof createBrowserSession>> | undefined;
  try {
    session = await createBrowserSession({ ...credentials, successMode: "session" });
    if (!session.success) {
      return {
        success: false,
        error: session.error,
        failureCategory: session.failureCategory,
      };
    }

    if (!session.context || !session.instanceUrl) {
      return {
        success: false,
        error: "Browser-assisted sign-in succeeded without a browser context to export cookies from.",
        failureCategory: "generic",
      };
    }

    // Navigate to the classic ServiceNow nav page before extracting g_ck
    // or running validation. The Next Experience shell (/now/nav/ui/classic/...)
    // runs content in iframes where the top frame does NOT have g_ck or API access.
    let sessionToken: string | undefined;
    let validationResult: BrowserValidationResult | undefined;
    const activePage = session.page && !session.page.isClosed() ? session.page : session.context.pages().find((p) => !p.isClosed());

    if (activePage && !activePage.isClosed()) {
      try {
        const classicNavUrl = `${session.instanceUrl}/nav_to.do`;
        console.log("[Browser] Navigating to classic nav for g_ck extraction and validation:", classicNavUrl);
        await activePage.goto(classicNavUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        await activePage.waitForTimeout(2000);
      } catch (navErr) {
        console.warn("[Browser] Failed to navigate to classic nav:", navErr instanceof Error ? navErr.message : String(navErr));
      }
    }

    // Extract g_ck from the classic nav page
    if (activePage && !activePage.isClosed()) {
      try {
        sessionToken = await activePage.evaluate(() =>
          (window as unknown as Record<string, string>).g_ck || "",
        ) || undefined;
      } catch {
        // Page may have navigated or closed; token is optional.
      }
    }

    console.log("[Browser] g_ck extracted:", sessionToken ? "present" : "missing");

    // Run validation queries inside the browser context (browser-proxied).
    // ServiceNow sessions are bound to the browser process; exported cookies
    // often fail from Node.js.
    const targetUsername = credentials.username || "";
    console.log("[Browser] Running browser-proxied validation...", { hasActivePage: !!activePage, isClosed: activePage?.isClosed(), targetUsername });
    if (activePage && !activePage.isClosed()) {
      try {
        validationResult = await activePage.evaluate(async (username: string) => {
          const gck = (window as unknown as Record<string, string>).g_ck || "";
          const headers: Record<string, string> = {
            Accept: "application/json",
          };
          if (gck) headers["X-UserToken"] = gck;

          let userSysId = "";
          let userName = "";
          let userUsername = "";
          let userEmail = "";

          // Look up the specific user by the username entered in the form.
          // /api/now/ui/user/me can return a different user on some pages,
          // so we query the sys_user table directly for the target user.
          if (username) {
            try {
              const userResp = await fetch(
                `/api/now/table/sys_user?sysparm_query=user_name=${encodeURIComponent(username)}&sysparm_fields=sys_id,user_name,name,email&sysparm_limit=1`,
                { credentials: "include", headers },
              );
              if (userResp.ok) {
                const userData = await userResp.json().catch(() => null);
                const u = userData?.result?.[0];
                if (u) {
                  userSysId = u.sys_id || "";
                  userName = u.name || u.user_name || "";
                  userUsername = u.user_name || "";
                  userEmail = u.email || "";
                }
              }
            } catch { /* non-fatal */ }
          }

          // Fallback: try /api/now/ui/user/me if username lookup failed
          if (!userSysId) {
            try {
              const meResp = await fetch("/api/now/ui/user/me", {
                credentials: "include",
                headers,
              });
              if (meResp.ok) {
                const meData = await meResp.json().catch(() => null);
                const u = meData?.result || meData;
                if (u) {
                  userSysId = u.sys_id || u.user_sys_id || "";
                  userName = u.name || u.user_name || "";
                  userUsername = u.user_name || u.userName || "";
                  userEmail = u.email || "";
                }
              }
            } catch { /* non-fatal */ }
          }

          // If we still have no user identity, the session is not usable
          if (!userSysId && !userUsername && !userName) {
            return {
              success: false,
              message: "Could not retrieve user information from the ServiceNow session.",
            };
          }

          // Fetch roles (non-fatal if it fails)
          let roles: string[] = [];
          if (userSysId) {
            try {
              const rolesResp = await fetch(
                `/api/now/table/sys_user_has_role?sysparm_query=user=${userSysId}&sysparm_display_value=true&sysparm_fields=role&sysparm_limit=300`,
                { credentials: "include", headers },
              );
              if (rolesResp.ok) {
                const rolesData = await rolesResp.json().catch(() => ({}));
                roles = (rolesData?.result || [])
                  .map((r: Record<string, unknown>) => {
                    const role = r.role;
                    if (role && typeof role === "object" && "display_value" in (role as Record<string, unknown>)) {
                      return String((role as Record<string, unknown>).display_value || "");
                    }
                    return String(role || "");
                  })
                  .filter(Boolean);
              }
            } catch { /* non-fatal */ }
          }

          // Fetch assignment groups (non-fatal if it fails)
          let assignmentGroups: { sysId: string; name: string }[] = [];
          if (userSysId) {
            try {
              const grpResp = await fetch(
                `/api/now/table/sys_user_grmember?sysparm_query=user=${userSysId}&sysparm_display_value=true&sysparm_fields=group&sysparm_limit=50`,
                { credentials: "include", headers },
              );
              if (grpResp.ok) {
                const grpData = await grpResp.json().catch(() => ({}));
                assignmentGroups = (grpData?.result || [])
                  .map((gm: Record<string, unknown>) => {
                    const g = gm.group as Record<string, unknown> | undefined;
                    if (g && (g.display_value || g.value)) {
                      return { sysId: String(g.value || ""), name: String(g.display_value || g.value || "") };
                    }
                    return null;
                  })
                  .filter(Boolean) as { sysId: string; name: string }[];
              }
            } catch { /* non-fatal */ }
          }

          return {
            success: true,
            message: "Connected via browser session",
            authType: "session",
            userInfo: {
              name: userName,
              username: userUsername,
              sysId: userSysId || undefined,
              email: userEmail || undefined,
              assignmentGroups,
            },
            roles,
            hasAdmin: roles.includes("admin"),
            hasSecurityAdmin: roles.includes("security_admin"),
            noRoles: !!userSysId && roles.length === 0,
          };
        }, targetUsername);
      } catch (err) {
        console.warn("[Browser] Browser-proxied validation failed:", err instanceof Error ? err.message : String(err));
      }
    }

    console.log("[Browser] Validation result:", JSON.stringify(validationResult || "none"));
    if (activePage && !activePage.isClosed()) {
      console.log("[Browser] Active page URL during validation:", getPageUrl(activePage));
    }

    const cookies = await extractServiceNowCookies(session.context, session.instanceUrl);
    return { success: true, cookies, sessionToken, validationResult };
  } finally {
    if (session?.browser && session.shouldCloseBrowser) {
      await session.browser.close().catch(() => {});
    }
  }
}

/**
 * Switch ServiceNow scope via browser automation.
 * Supports legacy headless mode plus optional headed/CDP interactive modes.
 */
export async function switchScopeViaBrowser(
  credentials: BrowserScopeCredentials,
  scopeId: string,
  scopeName: string
): Promise<BrowserScopeSwitchResult> {
  const rateLimitKey = `${credentials.username || "anonymous"}:${scopeId}:scope`;
  const maxAttempts = parsePositiveInt(process.env.BROWSER_SCOPE_SWITCH_MAX_ATTEMPTS_PER_HOUR, 2);

  if (!consumeRateLimit(scopeRateLimitMap, rateLimitKey, maxAttempts)) {
    return {
      success: false,
      error: "Rate limit exceeded: max 2 browser scope switch attempts per scope per hour",
      failureCategory: "generic",
    };
  }

  let session: Awaited<ReturnType<typeof createBrowserSession>> | undefined;
  try {
    session = await createBrowserSession({ ...credentials, successMode: "shell" });
    if (!session.success) {
      return {
        success: false,
        error: session.error,
        failureCategory: session.failureCategory,
      };
    }

    if (!session.page || !session.context || !session.instanceUrl) {
      return {
        success: false,
        error: "Browser scope switch could not continue because the browser session was not fully initialized.",
        failureCategory: "generic",
      };
    }

    const switchResult = await session.page.evaluate(async (appId: string) => {
      try {
        const resp = await fetch("/api/now/ui/concoursepicker/application", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-UserToken": (window as unknown as Record<string, string>).g_ck || "",
          },
          body: JSON.stringify({ app_id: appId }),
        });
        const data = await resp.json().catch(() => ({}));
        return { ok: resp.ok, data };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    }, scopeId);

    if (!switchResult.ok) {
      return {
        success: false,
        error: `Browser-side scope switch failed for "${scopeName}": ${switchResult.error || JSON.stringify(switchResult.data)}`,
        failureCategory: "generic",
      };
    }

    const cookies = await extractServiceNowCookies(session.context, session.instanceUrl);
    return { success: true, cookies };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Browser scope switch failed: ${sanitizeErrorMessage(message, credentials.password)}`,
      failureCategory: "generic",
    };
  } finally {
    if (session?.browser && session.shouldCloseBrowser) {
      await session.browser.close().catch(() => {});
    }
  }
}
