/**
 * ServiceNow REST API Client
 * Handles all HTTP communication with ServiceNow instances
 *
 * Features:
 * - Cookie-jar session persistence (so GlideUpdateSet().set() persists across calls)
 * - Active update set tracking with post-creation artifact move
 * - Auto-initialization of helper APIs on first connection
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { Cookie, CookieJar } from 'tough-cookie';
import {
  SNAuthType,
  SNBrowserCookie,
  SNConfig,
  SNRecord,
  SNQueryParams,
  SNApiResponse,
  SNErrorResponse,
} from '../types/index.js';

// Helper API key type
type HelperApiKey = 'uiPolicyActionHelper' | 'updateSetHelper' | 'addToUpdateSetHelper' | 'scopeHelper' | 'catalogVariableHelper';

/** Result of a scope-switching attempt */
export interface ScopeSwitchResult {
  success: boolean;
  method?: string;
  scopeId?: string;
  scopeName?: string;
  error?: string;
  failureCategory?: 'mfa_sso_redirect' | 'mfa_challenge' | 'generic';
  userActionRequired?: boolean;
  checklist?: string[];
}

export interface BrowserFallbackResult {
  success: boolean;
  error?: string;
  failureCategory?: 'mfa_sso_redirect' | 'mfa_challenge' | 'generic';
  cookies?: SNBrowserCookie[];
}

/** Options for ensureScopeActive — allows webapp to inject browser fallback */
export interface EnsureScopeOptions {
  browserFallback?: (scopeId: string, scopeName: string) => Promise<BrowserFallbackResult>;
}

// Cache for helper API paths per instance
const helperApiPaths = new Map<string, Partial<Record<HelperApiKey, string>>>();

export class ServiceNowClient {
  private client: AxiosInstance;
  private config: SNConfig;
  private jar: CookieJar;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  /** The sys_id of the currently active update set (set via sn_set_current_update_set) */
  private _activeUpdateSetId: string | null = null;

  /** Whether helper APIs have been initialized for this instance */
  private _helperApisInitialized: boolean = false;

  constructor(config: SNConfig) {
    this.config = {
      ...config,
      instanceUrl: config.instanceUrl.replace(/\/$/, '')
    };
    
    // Defense in depth: validate instance URL
    try {
      const hostname = new URL(this.config.instanceUrl).hostname.toLowerCase();
      if (!hostname.endsWith('.service-now.com') && !hostname.endsWith('.servicenow.com')) {
        throw new Error('Invalid ServiceNow instance URL domain');
      }
    } catch (e) {
      throw new Error(`Invalid ServiceNow instance URL: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    this.jar = new CookieJar();
    this.accessToken = config.accessToken || null;
    this.refreshToken = config.refreshToken || null;
    this.client = this.createHttpClient();

    if (config.sessionCookies?.length) {
      this.importCookies(config.sessionCookies, config.sessionToken);
    }
  }

  private getAuthType(): SNAuthType {
    if (this.config.authType) {
      return this.config.authType;
    }
    if (this.config.accessToken) {
      return 'bearer';
    }
    if (this.config.sessionCookies && this.config.sessionCookies.length > 0) {
      return 'session';
    }
    return 'basic';
  }

  private createHttpClient(): AxiosInstance {
    const client = wrapper(axios.create({
      baseURL: this.config.instanceUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000,
      jar: this.jar,
      withCredentials: true
    }));

    client.interceptors.request.use(async (requestConfig) => this.applyAuthToRequest(requestConfig));
    return client;
  }

  private async applyAuthToRequest(
    requestConfig: InternalAxiosRequestConfig
  ): Promise<InternalAxiosRequestConfig> {
    const authType = this.getAuthType();
    const headerBag = (requestConfig.headers ?? {}) as Record<string, unknown>;

    delete headerBag.Authorization;
    requestConfig.auth = undefined;

    if (authType === 'basic') {
      if (!this.config.username || !this.config.password) {
        throw new Error('Basic auth requires username and password');
      }
      requestConfig.auth = {
        username: this.config.username,
        password: this.config.password
      };
    } else if (authType === 'bearer' || authType === 'oauth_client_credentials' || authType === 'oauth_authorization_code') {
      const token = await this.ensureAccessToken();
      headerBag.Authorization = `Bearer ${token}`;
    } else if (authType === 'session') {
      if (this.config.sessionToken) {
        headerBag['X-UserToken'] = this.config.sessionToken;
      }
    }

    requestConfig.headers = headerBag as InternalAxiosRequestConfig['headers'];
    return requestConfig;
  }

  private getTokenEndpoint(): string {
    return this.config.tokenEndpoint || `${this.config.instanceUrl}/oauth_token.do`;
  }

  private isTokenFresh(): boolean {
    return Boolean(
      this.accessToken &&
      (!this.tokenExpiresAt || Date.now() < this.tokenExpiresAt - 60_000)
    );
  }

  private async exchangeToken(params: URLSearchParams): Promise<string> {
    const response = await axios.post<Record<string, unknown>>(
      this.getTokenEndpoint(),
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    const accessToken = typeof response.data.access_token === 'string'
      ? response.data.access_token
      : '';

    if (!accessToken) {
      throw new Error('OAuth token exchange did not return an access token');
    }

    this.accessToken = accessToken;
    this.refreshToken = typeof response.data.refresh_token === 'string'
      ? response.data.refresh_token
      : this.refreshToken;

    const expiresIn = Number(response.data.expires_in ?? 0);
    this.tokenExpiresAt = Number.isFinite(expiresIn) && expiresIn > 0
      ? Date.now() + (expiresIn * 1000)
      : null;

    return accessToken;
  }

  private async fetchClientCredentialsToken(): Promise<string> {
    if (this.isTokenFresh()) {
      return this.accessToken!;
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('OAuth client credentials auth requires clientId and clientSecret');
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    if (this.config.scope) {
      params.set('scope', this.config.scope);
    }

    return this.exchangeToken(params);
  }

  private async refreshAuthorizationCodeToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available for OAuth authorization-code auth');
    }

    if (!this.config.clientId) {
      throw new Error('OAuth authorization-code refresh requires clientId');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.config.clientId
    });

    if (this.config.clientSecret) {
      params.set('client_secret', this.config.clientSecret);
    }

    return this.exchangeToken(params);
  }

  private async exchangeAuthorizationCodeForToken(): Promise<string> {
    if (!this.config.authorizationCode || !this.config.clientId || !this.config.codeVerifier || !this.config.redirectUri) {
      throw new Error('OAuth authorization-code auth requires authorizationCode, clientId, codeVerifier, and redirectUri');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: this.config.authorizationCode,
      client_id: this.config.clientId,
      code_verifier: this.config.codeVerifier,
      redirect_uri: this.config.redirectUri
    });

    if (this.config.clientSecret) {
      params.set('client_secret', this.config.clientSecret);
    }

    return this.exchangeToken(params);
  }

  private async ensureAccessToken(): Promise<string> {
    const authType = this.getAuthType();

    if (authType === 'bearer') {
      if (this.accessToken) {
        return this.accessToken;
      }
      throw new Error('Bearer auth requires an access token');
    }

    if (authType === 'oauth_client_credentials') {
      return this.fetchClientCredentialsToken();
    }

    if (authType === 'oauth_authorization_code') {
      if (this.isTokenFresh()) {
        return this.accessToken!;
      }
      if (this.refreshToken) {
        return this.refreshAuthorizationCodeToken();
      }
      return this.exchangeAuthorizationCodeForToken();
    }

    throw new Error(`Auth type ${authType} does not use bearer tokens`);
  }

  private getCurrentUsername(): string | undefined {
    return this.config.username?.trim() || undefined;
  }

  importCookies(cookies: SNBrowserCookie[], sessionToken?: string): void {
    this.config.authType = 'session';
    this.config.sessionCookies = cookies;
    if (sessionToken) {
      this.config.sessionToken = sessionToken;
    }

    for (const cookie of cookies) {
      if (!cookie.name || !cookie.value || !cookie.domain) {
        continue;
      }

      try {
        const parsedCookie = new Cookie({
          key: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly ?? false,
          secure: cookie.secure ?? false,
          expires: typeof cookie.expires === 'number' && cookie.expires > 0
            ? new Date(cookie.expires * 1000)
            : 'Infinity'
        });

        this.jar.setCookieSync(parsedCookie, this.config.instanceUrl);
      } catch {
        // Ignore malformed cookies from imported browser sessions.
      }
    }
  }

  /**
   * Get the cached helper API path for a specific helper
   */
  getHelperApiPath(apiKey: HelperApiKey): string | undefined {
    const paths = helperApiPaths.get(this.config.instanceUrl);
    return paths?.[apiKey];
  }

  /**
   * Set a helper API path (called after initialization)
   */
  setHelperApiPath(apiKey: HelperApiKey, path: string): void {
    let paths = helperApiPaths.get(this.config.instanceUrl);
    if (!paths) {
      paths = {};
      helperApiPaths.set(this.config.instanceUrl, paths);
    }
    paths[apiKey] = path;
  }

  /**
   * Check if helper APIs have been initialized
   */
  get helperApisInitialized(): boolean {
    return this._helperApisInitialized;
  }

  /**
   * Mark helper APIs as initialized
   */
  set helperApisInitialized(value: boolean) {
    this._helperApisInitialized = value;
  }

  // ─── Active Scope Tracking ───────────────────────────────────

  /** The sys_id of the currently active application scope */
  private _activeScopeId: string | null = null;

  /** Optional browser-based scope fallback injected by webapp */
  private _ensureScopeOptions: EnsureScopeOptions = {};

  /** Get the currently active scope ID */
  getActiveScope(): string | null {
    return this._activeScopeId;
  }

  /** Set the active scope ID */
  setActiveScope(scopeId: string | null): void {
    this._activeScopeId = scopeId;
  }

  /** Inject options for ensureScopeActive (e.g. browser fallback from webapp) */
  setEnsureScopeOptions(options: EnsureScopeOptions): void {
    this._ensureScopeOptions = options;
  }

  // ─── Active Update Set Tracking ──────────────────────────────

  /** Get the currently active update set ID */
  get activeUpdateSetId(): string | null {
    return this._activeUpdateSetId;
  }

  /** Set the active update set ID (called by sn_set_current_update_set) */
  setActiveUpdateSet(sysId: string | null): void {
    this._activeUpdateSetId = sysId;
  }

  /**
   * Call the UpdateSetHelper Scripted REST API to set the current update set
   * for this session (uses GlideUpdateSet().set() on the server side).
   *
   * Resolution order for API path:
   * 1. Dynamically discovered path from HelperApisSetup (stored via setHelperApiPath)
   * 2. SN_UPDATE_SET_API_PATH environment variable (legacy/CLI fallback)
   *
   * Previously only checked the env var, which is NOT set in webapp deployments
   * (DigitalOcean). This caused Layer 1 session-based capture to silently fail
   * in production, falling through to Layer 2 (post-creation move) which itself
   * failed due to scope context issues.
   */
  async callSetCurrentUpdateSetApi(updateSetId: string): Promise<{ success: boolean; error?: string }> {
    // Check dynamically discovered path first (set during initializeHelperApis on connection),
    // then fall back to env var for CLI/standalone usage
    const dynamicPath = this.getHelperApiPath('updateSetHelper');
    const apiPath = dynamicPath
      ? `${dynamicPath}/set_current`
      : process.env.SN_UPDATE_SET_API_PATH;

    if (!apiPath) {
      return {
        success: false,
        error: 'UpdateSetHelper API path not available. Helper APIs may not be initialized yet. ' +
          'Ensure sn_test_connection or sn_initialize_instance was called first.'
      };
    }

    try {
      const response = await this.client.post<SNApiResponse<{ success: boolean; message: string }>>(
        apiPath,
        { sys_id: updateSetId }
      );
      const result = response.data?.result;
      if (result && result.success === false) {
        return { success: false, error: result.message || 'Server rejected update set activation' };
      }
      this._activeUpdateSetId = updateSetId;
      return { success: true };
    } catch (error) {
      const axiosError = error as AxiosError<SNErrorResponse>;
      const msg = axiosError.response?.data?.error?.message || axiosError.message;
      return { success: false, error: msg };
    }
  }

  /**
   * Call the AddToUpdateSetHelper Scripted REST API to explicitly add a record
   * to an update set using GlideUpdateManager2().saveRecord() on the server side.
   * This is the Layer 3 fallback for artifact capture — works for any table type
   * including sys_dictionary, sysauto_script, sysevent_register, etc.
   */
  async callAddToUpdateSetApi(
    table: string,
    recordSysId: string,
    updateSetId?: string
  ): Promise<{ success: boolean; captured?: boolean; updateXmlSysId?: string; error?: string }> {
    const helperPath = this.getHelperApiPath('addToUpdateSetHelper');
    if (!helperPath) {
      return {
        success: false,
        error: 'AddToUpdateSetHelper API not available. It will be auto-deployed on next connection.'
      };
    }

    const apiEndpoint = `${helperPath}/add_record`;

    try {
      const response = await this.client.post<SNApiResponse<{
        success: boolean;
        captured: boolean;
        update_xml_sys_id: string;
        message: string;
      }>>(
        apiEndpoint,
        {
          table,
          sys_id: recordSysId,
          update_set_id: updateSetId || this._activeUpdateSetId || ''
        }
      );

      const result = response.data.result;
      return {
        success: true,
        captured: result?.captured ?? false,
        updateXmlSysId: result?.update_xml_sys_id || undefined
      };
    } catch (error) {
      const axiosError = error as AxiosError<SNErrorResponse>;
      const msg = axiosError.response?.data?.error?.message || axiosError.message;
      return { success: false, error: msg };
    }
  }

  /**
   * Extract the sys_id value from a ServiceNow reference field.
   * Reference fields can be returned as plain strings or as objects {link, value}.
   */
  private resolveRefValue(field: unknown): string {
    if (typeof field === 'string') return field;
    if (field && typeof field === 'object' && 'value' in (field as Record<string, unknown>)) {
      return String((field as Record<string, unknown>).value);
    }
    return String(field ?? '');
  }

  /**
   * Tables that are metadata/dictionary tables where sys_update_xml records
   * may take longer to appear and may use non-standard naming patterns.
   */
  private static readonly METADATA_TABLES = new Set([
    'sys_dictionary', 'sys_db_object', 'sys_documentation',
    'sys_choice', 'sys_ui_policy', 'sys_ui_policy_action',
    'sys_ui_section', 'sys_ui_element', 'sys_ui_form',
    'sys_ui_list', 'sys_ui_related_list', 'sys_ui_view'
  ]);

  /**
   * Move a record's sys_update_xml entry to the active update set.
   * This is the reliable fallback for when session-based update set capture fails.
   *
   * Uses a multi-strategy search with retry logic:
   * 1. Exact name match: <table>_<sys_id>
   * 2. LIKE search on sys_id
   * 3. LIKE search on table name with recent creation time
   *
   * @param table - The table the record was created/updated in (e.g. 'sys_script')
   * @param recordSysId - The sys_id of the created/updated record
   * @returns Object with moved count and any errors
   */
  async moveArtifactToUpdateSet(table: string, recordSysId: string): Promise<{ moved: number; errors: string[] }> {
    if (!this._activeUpdateSetId) {
      return { moved: 0, errors: [] }; // No active update set, nothing to do
    }

    const errors: string[] = [];
    let moved = 0;
    const isMetadataTable = ServiceNowClient.METADATA_TABLES.has(table);

    // Metadata tables (sys_dictionary etc.) need more time for sys_update_xml generation
    const initialDelay = isMetadataTable ? 1500 : 500;
    const maxRetries = isMetadataTable ? 3 : 2;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const delay = attempt === 0 ? initialDelay : initialDelay * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      let foundRecords: SNRecord[] = [];

      try {
        // Strategy 1: Exact name match (<table>_<sys_id>)
        const updateName = `${table}_${recordSysId}`;
        foundRecords = await this.getRecords('sys_update_xml', {
          sysparm_query: `name=${updateName}^ORDERBYDESCsys_created_on`,
          sysparm_fields: 'sys_id,name,update_set,action',
          sysparm_exclude_reference_link: true,
          sysparm_limit: 5
        });

        // Strategy 2: LIKE search on sys_id (covers variant naming patterns)
        if (foundRecords.length === 0) {
          foundRecords = await this.getRecords('sys_update_xml', {
            sysparm_query: `nameLIKE${recordSysId}^ORDERBYDESCsys_created_on`,
            sysparm_fields: 'sys_id,name,update_set,action',
            sysparm_exclude_reference_link: true,
            sysparm_limit: 5
          });
        }

        // Strategy 3: For metadata tables, search by table type + recent creation
        // sys_dictionary records may use naming like sys_dictionary_<table>.<element>
        if (foundRecords.length === 0 && isMetadataTable) {
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
          foundRecords = await this.getRecords('sys_update_xml', {
            sysparm_query: `nameSTARTSWITH${table}_^sys_created_on>=${fiveMinAgo}^ORDERBYDESCsys_created_on`,
            sysparm_fields: 'sys_id,name,update_set,action,payload',
            sysparm_exclude_reference_link: true,
            sysparm_limit: 20
          });
          // Filter to only records whose payload contains the sys_id
          if (foundRecords.length > 0) {
            foundRecords = foundRecords.filter(r =>
              String(r.payload || '').includes(recordSysId) ||
              String(r.name || '').includes(recordSysId)
            );
          }
        }

        if (foundRecords.length > 0) {
          for (const record of foundRecords) {
            const currentUpdateSet = this.resolveRefValue(record.update_set);
            if (currentUpdateSet !== this._activeUpdateSetId) {
              try {
                await this.updateRecord('sys_update_xml', record.sys_id, {
                  update_set: this._activeUpdateSetId
                });
                moved++;
              } catch (e) {
                const err = e as Error;
                errors.push(`Failed to move ${record.name}: ${err.message}`);
              }
            } else {
              // Already in correct update set (session-based capture worked)
              moved++;
            }
          }
          break; // Success — stop retrying
        }
      } catch (e) {
        const err = e as Error;
        if (attempt === maxRetries - 1) {
          errors.push(`Failed to query sys_update_xml: ${err.message}`);
        }
        // Otherwise retry
      }
    }

    // Layer 3 fallback: Use AddToUpdateSetHelper API (GlideUpdateManager2.saveRecord)
    // This works for ANY table type, including those that don't reliably generate sys_update_xml
    if (moved === 0) {
      const layer3Result = await this.callAddToUpdateSetApi(table, recordSysId, this._activeUpdateSetId || undefined);
      if (layer3Result.success && layer3Result.captured) {
        moved = 1;
        // Clear any previous errors since Layer 3 succeeded
        errors.length = 0;
      } else if (layer3Result.error && !layer3Result.error.includes('not available')) {
        errors.push(`Layer 3 (GlideUpdateManager2) also failed: ${layer3Result.error}`);
      }
    }

    // Final fallback: if still nothing found after all 3 layers, log a warning
    if (moved === 0 && errors.length === 0) {
      errors.push(
        `No sys_update_xml entry found for ${table} record ${recordSysId} after ${maxRetries} attempts ` +
        `and Layer 3 fallback. The record may need manual capture via sn_move_to_update_set.`
      );
    }

    return { moved, errors };
  }

  /**
   * Verify that a list of artifacts are all captured in the active update set.
   * Returns a detailed report of which artifacts are captured, missing, or need moving.
   *
   * @param artifacts - Array of {table, sys_id, name} for each artifact to verify
   * @returns Verification result with captured/missing/moved counts
   */
  async verifyAllArtifactsCaptured(
    artifacts: Array<{ table: string; sys_id: string; name?: string }>
  ): Promise<{
    allCaptured: boolean;
    captured: number;
    missing: number;
    movedNow: number;
    details: Array<{ table: string; sys_id: string; name?: string; status: 'captured' | 'moved' | 'missing'; error?: string }>;
  }> {
    if (!this._activeUpdateSetId) {
      return {
        allCaptured: false,
        captured: 0,
        missing: artifacts.length,
        movedNow: 0,
        details: artifacts.map(a => ({ ...a, status: 'missing' as const, error: 'No active update set' }))
      };
    }

    const VERIFY_LIMIT = 2000;
    const updateSetContents = await this.getRecords('sys_update_xml', {
      sysparm_query: `update_set=${this._activeUpdateSetId}`,
      sysparm_fields: 'sys_id,name,type,target_name,action',
      sysparm_exclude_reference_link: true,
      sysparm_limit: VERIFY_LIMIT
    });
    if (updateSetContents.length >= VERIFY_LIMIT) {
      console.warn(`[UpdateSet] Warning: update set has >= ${VERIFY_LIMIT} items; verification may be incomplete`);
    }

    // Build a Set of all sys_ids mentioned in the update set names/payloads
    const capturedNames = new Set(updateSetContents.map(r => String(r.name || '')));

    const details: Array<{ table: string; sys_id: string; name?: string; status: 'captured' | 'moved' | 'missing'; error?: string }> = [];
    let captured = 0;
    let missing = 0;
    let movedNow = 0;

    for (const artifact of artifacts) {
      const expectedName = `${artifact.table}_${artifact.sys_id}`;
      // Check if any captured record name contains this artifact's sys_id or matches the expected name
      const found = capturedNames.has(expectedName) ||
        [...capturedNames].some(name => name.includes(artifact.sys_id));

      if (found) {
        captured++;
        details.push({ ...artifact, status: 'captured' });
      } else {
        // Attempt to move it now
        const moveResult = await this.moveArtifactToUpdateSet(artifact.table, artifact.sys_id);
        if (moveResult.moved > 0) {
          movedNow++;
          details.push({ ...artifact, status: 'moved' });
        } else {
          missing++;
          details.push({
            ...artifact,
            status: 'missing',
            error: moveResult.errors.length > 0 ? moveResult.errors.join('; ') : 'Not found in sys_update_xml'
          });
        }
      }
    }

    return {
      allCaptured: missing === 0,
      captured,
      missing,
      movedNow,
      details
    };
  }


  // ─── Scope Switching (Five-Tier Fallback) ─────────────────────

  /**
   * Tier 1: Switch scope via ServiceNow's built-in concoursepicker API.
   * This is the same mechanism the ServiceNow UI uses for the scope dropdown.
   * Uses the existing cookie-jar session so the switch persists across calls.
   */
  async switchScopeViaConcoursePicker(scopeId: string): Promise<{ success: boolean; error?: string }> {
    const debugLog = process.env.SN_DEBUG_SCOPE === 'true';
    if (debugLog) console.log(`[ScopeSwitch] Tier 1: Attempting concoursepicker switch to ${scopeId}`);
    
    try {
      const response = await this.client.put<SNApiResponse<{ app_id?: string }>>(
        '/api/now/ui/concoursepicker/application',
        { app_id: scopeId }
      );
      const result = response.data?.result;
      if (debugLog) console.log(`[ScopeSwitch] Tier 1: Response:`, JSON.stringify(result, null, 2));
      
      if (result && result.app_id === scopeId) {
        if (debugLog) console.log(`[ScopeSwitch] Tier 1: Success`);
        return { success: true };
      }
      const error = 'Concoursepicker response did not confirm target scope';
      if (debugLog) console.log(`[ScopeSwitch] Tier 1: Failed - ${error}`);
      return { success: false, error };
    } catch (error) {
      const axiosError = error as AxiosError<SNErrorResponse>;
      const status = axiosError.response?.status;
      const msg = axiosError.response?.data?.error?.message || axiosError.message;
      const errorMsg = `Concoursepicker API failed (${status || 'unknown'}): ${msg}`;
      if (debugLog) console.log(`[ScopeSwitch] Tier 1: Exception - ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Verify the current scope via GET concoursepicker or sys_user_preference fallback.
   * Does NOT use gs.getCurrentApplicationId() (always returns 'global' in REST context).
   */
  async verifyCurrentScope(targetScopeId?: string): Promise<{
    currentScopeId: string;
    currentScopeName: string;
    matchesTarget: boolean;
  }> {
    const debugLog = process.env.SN_DEBUG_SCOPE === 'true';
    if (debugLog) console.log(`[ScopeSwitch] Verifying scope, target: ${targetScopeId || 'none'}`);
    
    let currentScopeId = 'global';
    let currentScopeName = 'Global';

    try {
      const response = await this.client.get<SNApiResponse<{
        current?: string;
        list?: Array<{ sysId: string; name: string }>;
      }>>('/api/now/ui/concoursepicker/application');
      const result = response.data?.result;
      if (debugLog) console.log(`[ScopeSwitch] Concoursepicker GET result:`, JSON.stringify(result, null, 2));
      
      if (result?.current) {
        currentScopeId = result.current;
        const match = result.list?.find(a => a.sysId === currentScopeId);
        if (match) currentScopeName = match.name;
      }
    } catch (e) {
      const error = e as Error;
      if (debugLog) console.log(`[ScopeSwitch] Concoursepicker GET failed, using fallback:`, error.message);
      // Fallback: read from sys_user_preference
      try {
        const currentUsername = this.getCurrentUsername();
        if (!currentUsername) {
          throw new Error('Current username unavailable for scope verification fallback');
        }
        const prefs = await this.getRecords('sys_user_preference', {
          sysparm_query: `name=apps.current.app^user.user_name=${currentUsername}`,
          sysparm_fields: 'sys_id,value',
          sysparm_limit: 1
        });
        if (prefs.length > 0 && prefs[0].value) {
          currentScopeId = String(prefs[0].value);
          if (debugLog) console.log(`[ScopeSwitch] Found scope in preference: ${currentScopeId}`);
        }
      } catch { /* best effort */ }
    }

    const matches = targetScopeId ? currentScopeId === targetScopeId : true;
    if (debugLog) console.log(`[ScopeSwitch] Verification result: current=${currentScopeId} (${currentScopeName}), matches=${matches}`);
    
    return {
      currentScopeId,
      currentScopeName,
      matchesTarget: matches
    };
  }

  /**
   * Tier 2: Switch scope via the custom ScopeHelper Scripted REST API.
   * Falls back to this when concoursepicker is unavailable.
   */
  async switchScopeViaScopeHelper(scopeId: string, updateSetId?: string): Promise<{ success: boolean; error?: string }> {
    const debugLog = process.env.SN_DEBUG_SCOPE === 'true';
    if (debugLog) console.log(`[ScopeSwitch] Tier 2: Attempting ScopeHelper switch to ${scopeId}`);
    
    const helperPath = this.getHelperApiPath('scopeHelper');
    if (!helperPath) {
      const error = 'ScopeHelper API not available. It will be auto-deployed on next connection.';
      if (debugLog) console.log(`[ScopeSwitch] Tier 2: ${error}`);
      return { success: false, error };
    }

    if (debugLog) console.log(`[ScopeSwitch] Tier 2: Using helper path: ${helperPath}`);
    
    try {
      const response = await this.client.post<SNApiResponse<{
        success: boolean;
        currentScope?: string;
        scopeName?: string;
      }>>(
        `${helperPath}/set_scope`,
        { scope_id: scopeId, update_set_id: updateSetId || '' }
      );
      if (debugLog) console.log(`[ScopeSwitch] Tier 2: Response:`, JSON.stringify(response.data, null, 2));
      return { success: true };
    } catch (error) {
      const axiosError = error as AxiosError<SNErrorResponse>;
      const msg = axiosError.response?.data?.error?.message || axiosError.message;
      const errorMsg = `ScopeHelper API failed: ${msg}`;
      if (debugLog) console.log(`[ScopeSwitch] Tier 2: Exception - ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Tier 3: Write user preference, clear cookies, and re-authenticate.
   * Preferences only take effect after a new session, so we destroy the current
   * JSESSIONID by recreating the axios client with a fresh CookieJar, then make
   * an authenticated request to establish a new session that reads the preference.
   */
  async switchScopeViaPreference(scopeId: string): Promise<{ success: boolean; error?: string }> {
    const debugLog = process.env.SN_DEBUG_SCOPE === 'true';
    if (debugLog) console.log(`[ScopeSwitch] Tier 3: Attempting preference write for ${scopeId}`);
    
    try {
      const currentUsername = this.getCurrentUsername();
      if (!currentUsername) {
        return { success: false, error: 'User preference scope switch requires a username' };
      }

      // Step 1: Write the preference
      const existing = await this.getRecords('sys_user_preference', {
        sysparm_query: `name=apps.current.app^user.user_name=${currentUsername}`,
        sysparm_fields: 'sys_id,value',
        sysparm_limit: 1
      });

      if (existing.length > 0) {
        if (debugLog) console.log(`[ScopeSwitch] Tier 3: Updating existing preference ${existing[0].sys_id}`);
        await this.updateRecord('sys_user_preference', String(existing[0].sys_id), { value: scopeId });
      } else {
        if (debugLog) console.log(`[ScopeSwitch] Tier 3: Creating new preference`);
        const currentUser = await this.getCurrentUser();
        if (!currentUser) {
          const error = 'Could not determine current user for preference write';
          if (debugLog) console.log(`[ScopeSwitch] Tier 3: ${error}`);
          return { success: false, error };
        }
        await this.createRecord('sys_user_preference', {
          name: 'apps.current.app',
          user: currentUser.sys_id,
          value: scopeId
        });
      }
      if (debugLog) console.log(`[ScopeSwitch] Tier 3: Preference written successfully`);

      // Step 2: Clear cookies and re-authenticate to start a new session
      // ServiceNow reads apps.current.app on session creation, so we need a fresh session.
      if (debugLog) console.log(`[ScopeSwitch] Tier 3: Clearing cookies and re-authenticating...`);
      this.resetSession();

      // Step 3: Trigger a new session by making an authenticated request
      // This forces ServiceNow to create a new JSESSIONID and read the preference.
      await this.client.get('/api/now/table/sys_properties', {
        params: { sysparm_query: 'name=glide.product.name', sysparm_fields: 'name', sysparm_limit: 1 }
      });
      if (debugLog) console.log(`[ScopeSwitch] Tier 3: Re-authenticated with new session`);

      return { success: true };
    } catch (error) {
      const errorMsg = `User preference write failed: ${error}`;
      if (debugLog) console.log(`[ScopeSwitch] Tier 3: Exception - ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Destroy the current session by replacing the cookie jar and axios client.
   * The next request will authenticate fresh and get a new JSESSIONID.
   */
  private resetSession(): void {
    helperApiPaths.delete(this.config.instanceUrl);
    this.jar = new CookieJar();
    this.client = this.createHttpClient();

    if (this.getAuthType() === 'session' && this.config.sessionCookies?.length) {
      this.importCookies(this.config.sessionCookies, this.config.sessionToken);
    }
  }

  /**
   * Switch the ServiceNow session back to Global scope.
   * Looks up the Global scope sys_id from sys_scope, then uses concoursepicker
   * (Tier 1) and ScopeHelper (Tier 2) to switch the session.
   *
   * This is needed because setScope('global') previously only set an in-memory
   * flag without actually switching the ServiceNow HTTP session back. Once a
   * concoursepicker PUT switched to a custom scope, the session stayed there
   * permanently, causing 403/404 errors on all Global-scope operations.
   */
  async switchToGlobalScope(): Promise<{ success: boolean; error?: string }> {
    const debugLog = process.env.SN_DEBUG_SCOPE === 'true';
    if (debugLog) console.log(`[ScopeSwitch] Switching back to Global scope`);

    try {
      // Look up Global scope sys_id from sys_scope table
      const globalScopes = await this.getRecords('sys_scope', {
        sysparm_query: 'scope=global',
        sysparm_fields: 'sys_id',
        sysparm_limit: 1
      });

      if (globalScopes.length === 0) {
        const error = 'Could not find Global scope record in sys_scope';
        if (debugLog) console.log(`[ScopeSwitch] ${error}`);
        return { success: false, error };
      }

      const globalSysId = globalScopes[0].sys_id as string;
      if (debugLog) console.log(`[ScopeSwitch] Global scope sys_id: ${globalSysId}`);

      // Tier 1: Use concoursepicker to switch back to Global
      const tier1 = await this.switchScopeViaConcoursePicker(globalSysId);
      if (tier1.success) {
        // Verify the switch worked
        const verified = await this.verifyCurrentScope(globalSysId);
        if (verified.matchesTarget) {
          this._activeScopeId = 'global';
          if (debugLog) console.log(`[ScopeSwitch] Successfully switched back to Global scope via concoursepicker`);
          return { success: true };
        }
        if (debugLog) console.log(`[ScopeSwitch] Concoursepicker reported success but verification failed`);
      } else {
        if (debugLog) console.log(`[ScopeSwitch] Tier 1 (concoursepicker) failed: ${tier1.error}`);
      }

      // Tier 2: Fallback to ScopeHelper API
      const tier2 = await this.switchScopeViaScopeHelper(globalSysId);
      if (tier2.success) {
        const verified = await this.verifyCurrentScope(globalSysId);
        if (verified.matchesTarget) {
          this._activeScopeId = 'global';
          if (debugLog) console.log(`[ScopeSwitch] Successfully switched back to Global scope via ScopeHelper`);
          return { success: true };
        }
        if (debugLog) console.log(`[ScopeSwitch] ScopeHelper reported success but verification failed`);
      } else {
        if (debugLog) console.log(`[ScopeSwitch] Tier 2 (ScopeHelper) failed: ${tier2.error}`);
      }

      // Tier 3: User preference write
      const tier3 = await this.switchScopeViaPreference(globalSysId);
      if (tier3.success) {
        const verified = await this.verifyCurrentScope(globalSysId);
        if (verified.matchesTarget) {
          this._activeScopeId = 'global';
          if (debugLog) console.log(`[ScopeSwitch] Successfully switched back to Global scope via preference`);
          return { success: true };
        }
      }

      return {
        success: false,
        error: tier1.error || tier2.error || 'All methods failed to switch back to Global scope'
      };
    } catch (error) {
      const msg = `Global scope switch failed: ${error instanceof Error ? error.message : String(error)}`;
      if (debugLog) console.log(`[ScopeSwitch] ${msg}`);
      return { success: false, error: msg };
    }
  }

  /**
   * Five-tier fallback to ensure the session is in the correct application scope.
   * Tiers 1-3 are REST-only (run in mcp-servicenow). Tier 4 uses an optional
   * browser callback injected by the webapp. Tier 5 returns userActionRequired.
   */
  async ensureScopeActive(
    scopeId: string,
    scopeName?: string,
    options?: EnsureScopeOptions
  ): Promise<ScopeSwitchResult> {
    const debugLog = process.env.SN_DEBUG_SCOPE === 'true';
    if (debugLog) console.log(`[ScopeSwitch] ensureScopeActive called: scopeId=${scopeId}, scopeName=${scopeName || 'none'}`);
    
    const opts = options || this._ensureScopeOptions;
    const displayName = scopeName || scopeId;
    let lastFailureCategory: ScopeSwitchResult['failureCategory'] = 'generic';
    let lastFailureError: string | undefined;

    // Skip if already in the right scope
    if (this._activeScopeId === scopeId) {
      if (debugLog) console.log(`[ScopeSwitch] Already in target scope, skipping`);
      return { success: true, method: 'already_active', scopeId, scopeName: displayName };
    }

    // Validate scopeId against sys_scope before attempting any switch
    try {
      const scopeRecord = await this.getRecord('sys_scope', scopeId, ['sys_id', 'name']);
      if (!scopeRecord) {
        return { success: false, error: `Scope not found in sys_scope: ${scopeId}` };
      }
      if (!scopeName) scopeName = String(scopeRecord.name);
    } catch {
      // Non-fatal; proceed with the switch attempts
    }

    // --- Tier 1: Concoursepicker (built-in, zero deployment) ---
    if (debugLog) console.log(`[ScopeSwitch] Trying Tier 1: Concoursepicker`);
    const tier1 = await this.switchScopeViaConcoursePicker(scopeId);
    if (tier1.success) {
      const verified = await this.verifyCurrentScope(scopeId);
      if (verified.matchesTarget) {
        this._activeScopeId = scopeId;
        if (debugLog) console.log(`[ScopeSwitch] Tier 1 succeeded and verified`);
        return { success: true, method: 'concoursepicker', scopeId, scopeName: verified.currentScopeName || displayName };
      } else {
        if (debugLog) console.log(`[ScopeSwitch] Tier 1 succeeded but verification failed`);
        lastFailureError = 'Tier 1 verification failed';
      }
    } else {
      if (debugLog) console.log(`[ScopeSwitch] Tier 1 failed: ${tier1.error}`);
      lastFailureError = tier1.error;
    }

    // --- Tier 2: ScopeHelper Scripted REST API ---
    if (debugLog) console.log(`[ScopeSwitch] Trying Tier 2: ScopeHelper API`);
    const tier2 = await this.switchScopeViaScopeHelper(scopeId);
    if (tier2.success) {
      const verified = await this.verifyCurrentScope(scopeId);
      if (verified.matchesTarget) {
        this._activeScopeId = scopeId;
        if (debugLog) console.log(`[ScopeSwitch] Tier 2 succeeded and verified`);
        return { success: true, method: 'scope_helper_api', scopeId, scopeName: verified.currentScopeName || displayName };
      } else {
        if (debugLog) console.log(`[ScopeSwitch] Tier 2 succeeded but verification failed`);
        lastFailureError = 'Tier 2 verification failed';
      }
    } else {
      if (debugLog) console.log(`[ScopeSwitch] Tier 2 failed: ${tier2.error}`);
      lastFailureError = tier2.error;
    }

    // --- Tier 3: User preference write ---
    if (debugLog) console.log(`[ScopeSwitch] Trying Tier 3: User Preference`);
    const tier3 = await this.switchScopeViaPreference(scopeId);
    if (tier3.success) {
      // Preference needs new session — verify after write
      const verified = await this.verifyCurrentScope(scopeId);
      if (verified.matchesTarget) {
        this._activeScopeId = scopeId;
        if (debugLog) console.log(`[ScopeSwitch] Tier 3 succeeded and verified`);
        return { success: true, method: 'user_preference', scopeId, scopeName: displayName };
      } else {
        if (debugLog) console.log(`[ScopeSwitch] Tier 3 succeeded but verification failed (expected - needs new session)`);
        lastFailureError = 'Tier 3 verification failed after session reset';
      }
    } else {
      if (debugLog) console.log(`[ScopeSwitch] Tier 3 failed: ${tier3.error}`);
      lastFailureError = tier3.error;
    }

    // --- Tier 4: Browser fallback (optional, injected by webapp) ---
    if (opts.browserFallback) {
      if (debugLog) console.log(`[ScopeSwitch] Trying Tier 4: Browser Automation`);
      const tier4 = await opts.browserFallback(scopeId, displayName);
      if (tier4.success) {
        if (tier4.cookies?.length) {
          this.importCookies(tier4.cookies);
        }
        const verified = await this.verifyCurrentScope(scopeId);
        if (verified.matchesTarget) {
          this._activeScopeId = scopeId;
          if (debugLog) console.log(`[ScopeSwitch] Tier 4 succeeded and verified`);
          return { success: true, method: 'browser_automation', scopeId, scopeName: displayName };
        } else {
          if (debugLog) console.log(`[ScopeSwitch] Tier 4 succeeded but verification failed`);
          lastFailureError = 'Tier 4 verification failed after browser login';
        }
      } else {
        if (debugLog) console.log(`[ScopeSwitch] Tier 4 failed: ${tier4.error}`);
        lastFailureCategory = tier4.failureCategory || 'generic';
        lastFailureError = tier4.error;
      }
    } else {
      if (debugLog) console.log(`[ScopeSwitch] Tier 4 skipped (no browser fallback provided)`);
    }

    // --- Tier 5: Manual user action required ---
    const instanceUrl = this.config.instanceUrl.replace(/\/$/, '');
    const manualChecklist = lastFailureCategory === 'mfa_sso_redirect' || lastFailureCategory === 'mfa_challenge'
      ? [
          `Open your instance: ${instanceUrl}/nav_to.do`,
          'Complete your ServiceNow or IdP sign-in flow, including any MFA prompts, in the browser.',
          `After sign-in completes, use the scope picker (globe icon) and select "${displayName}"`,
          `If you don't see the scope picker, go to Settings (gear) > Developer > enable "Show application picker in header"`,
          'Once the scope is switched, come back here and click "Scope switched" to continue.'
        ]
      : [
          `Open your instance: ${instanceUrl}/nav_to.do`,
          `In the header, click the scope picker (globe icon) and select "${displayName}"`,
          `If you don't see the scope picker, go to Settings (gear) > Developer > enable "Show application picker in header"`,
          'Once switched, come back here and click "Scope switched" to continue.'
        ];

    return {
      success: false,
      userActionRequired: true,
      scopeId,
      scopeName: displayName,
      failureCategory: lastFailureCategory,
      error: lastFailureError || 'All automated scope-switching methods failed. Manual action required.',
      checklist: manualChecklist
    };
  }

  /**
   * Test connection to ServiceNow instance
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    instanceInfo?: unknown;
    authType?: SNAuthType;
    failureCategory?: 'sso_redirect' | 'mfa_required' | 'generic';
    suggestedAuthMethods?: Array<'oauth_authorization_code' | 'session'>;
  }> {
    try {
      const response = await this.client.get('/api/now/table/sys_user', {
        params: { sysparm_limit: 1 },
        maxRedirects: 0 // Don't follow redirects — a redirect means auth failed (e.g., SSO login page)
      });

      // Validate response is actual JSON API data, not an HTML login page
      const contentType = String(response.headers['content-type'] || '');
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          authType: this.getAuthType(),
          failureCategory: 'sso_redirect',
          suggestedAuthMethods: ['oauth_authorization_code', 'session'],
          message: 'Authentication failed. The instance returned a login page instead of API data. This usually means SSO or MFA is intercepting the request. Try OAuth Authorization Code or Browser Session sign-in.'
        };
      }

      // Validate response has expected ServiceNow API structure
      if (!response.data || !response.data.result) {
        return {
          success: false,
          message: 'Authentication failed. The server did not return a valid API response. Please check your credentials.'
        };
      }

      return {
        success: true,
        message: `Connected to ${this.config.instanceUrl}`,
        authType: this.getAuthType(),
        instanceInfo: {
          url: this.config.instanceUrl,
          authenticated: true
        }
      };
    } catch (error) {
      const axiosError = error as AxiosError<SNErrorResponse>;
      const status = axiosError.response?.status;
      const serverMsg = axiosError.response?.data?.error?.message;

      // Handle redirect responses (3xx) — indicates SSO/login redirect
      if (status && status >= 300 && status < 400) {
        return {
          success: false,
          authType: this.getAuthType(),
          failureCategory: 'sso_redirect',
          suggestedAuthMethods: ['oauth_authorization_code', 'session'],
          message: 'Authentication failed. The instance redirected to a login page. This usually indicates SSO or MFA. Try OAuth Authorization Code or Browser Session sign-in.'
        };
      }

      // Build a descriptive message that includes status code for pattern matching
      let message = serverMsg || axiosError.message;
      if (status) {
        message = `${status}: ${message}`;
      }
      return {
        success: false,
        authType: this.getAuthType(),
        failureCategory: status === 401 || status === 403 ? 'generic' : 'generic',
        message
      };
    }
  }

  /**
   * Query records from a table
   */
  async getRecords(table: string, params: SNQueryParams = {}): Promise<SNRecord[]> {
    const response = await this.client.get<SNApiResponse<SNRecord[]>>(
      `/api/now/table/${table}`,
      { params }
    );
    return response.data.result;
  }

  /**
   * Get a single record by sys_id
   */
  async getRecord(table: string, sysId: string, fields?: string[]): Promise<SNRecord | null> {
    const params: SNQueryParams = {};
    if (fields?.length) {
      params.sysparm_fields = fields.join(',');
    }

    const response = await this.client.get<SNApiResponse<SNRecord>>(
      `/api/now/table/${table}/${sysId}`,
      { params }
    );
    return response.data.result;
  }

  /**
   * Create a new record
   */
  async createRecord(table: string, data: Record<string, unknown>): Promise<SNRecord> {
    const response = await this.client.post<SNApiResponse<SNRecord>>(
      `/api/now/table/${table}`,
      data
    );
    return response.data.result;
  }

  /**
   * Update an existing record
   */
  async updateRecord(table: string, sysId: string, data: Record<string, unknown>): Promise<SNRecord> {
    const response = await this.client.patch<SNApiResponse<SNRecord>>(
      `/api/now/table/${table}/${sysId}`,
      data
    );
    return response.data.result;
  }

  /**
   * Delete a record
   */
  async deleteRecord(table: string, sysId: string): Promise<void> {
    await this.client.delete(`/api/now/table/${table}/${sysId}`);
  }

  /**
   * Get table schema (fields/columns)
   */
  async getTableSchema(tableName: string): Promise<SNRecord[]> {
    const response = await this.client.get<SNApiResponse<SNRecord[]>>(
      '/api/now/table/sys_dictionary',
      {
        params: {
          sysparm_query: `name=${tableName}^elementISNOTEMPTY`,
          sysparm_fields: 'element,column_label,internal_type,max_length,mandatory,reference,default_value,choice'
        }
      }
    );
    return response.data.result;
  }

  /**
   * Get list of tables
   */
  async getTables(query?: string): Promise<SNRecord[]> {
    const params: SNQueryParams = {
      sysparm_fields: 'name,label,super_class,sys_scope,is_extendable',
      sysparm_limit: 100
    };
    if (query) {
      params.sysparm_query = query;
    }

    const response = await this.client.get<SNApiResponse<SNRecord[]>>(
      '/api/now/table/sys_db_object',
      { params }
    );
    return response.data.result;
  }

  /**
   * Execute a background script (requires elevated privileges)
   */
  async executeScript(script: string): Promise<unknown> {
    // Note: This requires the Scripted REST API or sys_script_execution
    // This is a simplified version - real implementation would need proper endpoint
    const response = await this.client.post('/api/now/table/sys_script_execution', {
      script
    });
    return response.data.result;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<SNRecord | null> {
    const currentUsername = this.getCurrentUsername();
    if (currentUsername) {
      const response = await this.client.get<SNApiResponse<SNRecord[]>>(
        '/api/now/table/sys_user',
        {
          params: {
            sysparm_query: `user_name=${currentUsername}`,
            sysparm_limit: 1
          }
        }
      );
      const users = response.data.result;
      return users && users.length > 0 ? users[0] : null;
    }

    try {
      const response = await this.client.get<SNApiResponse<Record<string, unknown>>>('/api/now/ui/user/me');
      const result = response.data?.result ?? {};
      const user = (result.user && typeof result.user === 'object'
        ? result.user
        : result) as Record<string, unknown>;

      if (user && Object.keys(user).length > 0) {
        return {
          sys_id: String(user.sys_id || user.id || ''),
          user_name: user.user_name || user.userName || user.name || '',
          name: user.name || user.display_name || user.user_name || '',
          email: user.email || ''
        };
      }
    } catch {
      // Best effort only — not all instances expose this endpoint.
    }

    return null;
  }

  get instanceUrl(): string {
    return this.config.instanceUrl;
  }

  /** Expose credentials for SDK CI mode (used by sn_deploy_sdk_flow tool) */
  get credentials(): {
    instanceUrl: string;
    username?: string;
    password?: string;
    authType: SNAuthType;
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    sessionCookies?: SNBrowserCookie[];
  } {
    return {
      instanceUrl: this.config.instanceUrl,
      username: this.config.username,
      password: this.config.password,
      authType: this.getAuthType(),
      accessToken: this.accessToken || undefined,
      refreshToken: this.refreshToken || undefined,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      sessionCookies: this.config.sessionCookies,
    };
  }

  /**
   * Call a custom Scripted REST API endpoint
   * @param path API path (e.g., '/api/37610/ui_policy_action_helper/create')
   * @param method HTTP method
   * @param data Request body
   * @returns API response
   */
  async callScriptedRestApi<T = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    data?: Record<string, unknown>
  ): Promise<T> {
    const config = {
      method,
      url: path,
      ...(data && method !== 'GET' ? { data } : {}),
      ...(data && method === 'GET' ? { params: data } : {})
    };

    const response = await this.client.request<{ result: T }>(config);
    return response.data.result;
  }
}

export default ServiceNowClient;

