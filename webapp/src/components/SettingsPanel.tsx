"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { KeyRound } from "lucide-react";
import type {
  Credentials,
  ConnectionResult,
  UsageInfo,
  TrialStatus,
  AIProvider,
  AITransport,
  ModelOption,
  SavedSystemConnectionSummary,
} from "@/lib/types";
import { APP_LOGO } from "@/lib/branding";
import { ModelSelector } from "@/components/fde/ModelSelector";
import { hasConnectableServiceNowAuth, normalizeServiceNowAuthMethod } from "@/lib/servicenow-auth";

type KeyMode = "server" | "byok";

interface SavedApiKeySummary {
  id: string;
  provider: string;
  label: string;
  key_hint: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface Props {
  credentials: Credentials;
  setCredentials: (c: Credentials) => void;
  connected: boolean;
  connInfo: ConnectionResult | null;
  isConnecting: boolean;
  connectingLabel?: string | null;
  connectionError?: string | null;
  onConnect: () => void;
  onReconnect?: () => void;
  serverApiKeyConfigured: boolean;
  serverOpenRouterKeyConfigured: boolean;
  serverSnCredsConfigured: boolean;
  usage: UsageInfo | null;
  rateLimitHit: boolean;
  onApiKeyProvided: () => void;
  /** Current AI provider */
  aiProvider: AIProvider;
  setAiProvider: (p: AIProvider) => void;
  /** Currently selected model key/id */
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  /** Available model options (dynamic for OpenRouter) */
  modelOptions: ModelOption[];
  /** Whether models are being loaded */
  modelsLoading?: boolean;
  modelLocked: boolean;
  /** When false, the user API key input is hidden entirely (server-only mode) */
  allowUserApiKeys?: boolean;
  /** Trial status for per-user daily limits */
  trialStatus?: TrialStatus | null;
  /** Refresh usage counts from the server */
  onRefreshUsage?: () => Promise<void>;
  /** Mobile full-screen mode: back button callback */
  onBack?: () => void;
  /** Error message for the BYOK API key field (e.g., invalid key) */
  byokError?: string | null;
  projectId?: string | null;
  isAuthenticated?: boolean;
  activeConnectionId?: string | null;
  onUseSavedConnection?: (connectionId: string) => Promise<void>;
  onConnectionSaved?: (connectionId: string) => void;
}

const INPUT_CLS = "w-full px-3 py-2.5 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-info)] focus:border-transparent";
const OPENROUTER_COLOR = "#a855f7";

function UsageDisplay({ usage, onRefresh }: { usage: UsageInfo; onRefresh?: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh, refreshing]);

  const showBreakdown = usage.isAuthenticated && (usage.anonUsed !== undefined || usage.authUsed !== undefined);
  const barPct = usage.max > 0 ? (usage.used / usage.max) * 100 : 0;
  const barColor = usage.remaining === 0 ? "var(--color-danger)" : usage.remaining <= 2 ? "var(--color-warning)" : "var(--color-info)";

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <span style={{ color: "var(--text-secondary)" }}>{usage.used}/{usage.max} requests used</span>
        <span className="flex items-center gap-1.5">
          <span className="font-medium" style={{ color: usage.remaining <= 2 ? "var(--color-warning)" : "var(--text-disabled)" }}>
            {usage.remaining} left
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-0.5 rounded transition-colors"
              style={{ color: "var(--text-disabled)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-disabled)")}
              title="Refresh usage"
              aria-label="Refresh usage count"
            >
              <svg
                className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </span>
      </div>
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-secondary)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${barPct}%`, background: barColor }}
        />
      </div>
      {showBreakdown && (
        <div className="flex items-center gap-3 text-[9px] pt-0.5" style={{ color: "var(--text-disabled)" }}>
          <span>{usage.anonUsed ?? 0} anon</span>
          <span style={{ opacity: 0.4 }}>+</span>
          <span>{usage.authUsed ?? 0} auth</span>
          <span style={{ opacity: 0.4 }}>=</span>
          <span>{usage.used} total</span>
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel({
  credentials, setCredentials, connected, connInfo, isConnecting, connectingLabel, connectionError, onConnect, onReconnect,
  serverApiKeyConfigured, serverOpenRouterKeyConfigured, serverSnCredsConfigured,
  usage, rateLimitHit, onApiKeyProvided,
  aiProvider, setAiProvider, selectedModel, setSelectedModel,
  modelLocked, allowUserApiKeys = true, trialStatus, onRefreshUsage, onBack, byokError,
  projectId = null, isAuthenticated = false, activeConnectionId = null, onUseSavedConnection, onConnectionSaved,
}: Props) {
  const update = useCallback((field: keyof Credentials, value: string) => {
    const nextCredentials: Credentials = { ...credentials, [field]: value };

    if (field === "instanceUrl") {
      nextCredentials.accessToken = "";
      nextCredentials.refreshToken = "";
      nextCredentials.sessionCookies = [];
    }

    if (field === "clientId") {
      nextCredentials.accessToken = "";
      nextCredentials.refreshToken = "";
    }

    setCredentials(nextCredentials);
  }, [credentials, setCredentials]);

  const snAuthType = normalizeServiceNowAuthMethod(credentials.snAuthType);
  const canConnect = hasConnectableServiceNowAuth(credentials, {
    serverBasicConfigured: serverSnCredsConfigured,
    requireUsernameForBasic: true,
    allowInteractiveBootstrap: true,
  }) && !isConnecting;
  const usingServerBasicCreds = serverSnCredsConfigured && snAuthType === "basic";
  const connectLabel = isConnecting
    ? (connectingLabel || "Connecting...")
    : snAuthType === "oauth_authorization_code"
      ? (credentials.accessToken ? "Connect" : "Sign In with ServiceNow")
      : snAuthType === "session"
        ? ((credentials.sessionCookies?.length || 0) > 0 ? "Connect" : "Connect in Browser")
        : "Connect";

  // Key mode: "server" uses pool/env keys, "byok" lets user enter their own
  const [keyMode, setKeyMode] = useState<KeyMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("keyMode") as KeyMode) || "server";
    }
    return "server";
  });

  useEffect(() => {
    localStorage.setItem("keyMode", keyMode);
    if (keyMode === "server") {
      if (credentials.claudeApiKey) update("claudeApiKey", "");
      if (credentials.openRouterApiKey) update("openRouterApiKey", "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyMode]);

  const serverKeyAvailable = aiProvider === "anthropic" ? serverApiKeyConfigured : serverOpenRouterKeyConfigured;

  // All inputs disabled when connected or mid-connecting
  const fieldsDisabled = connected || isConnecting;
  const [savedApiKeys, setSavedApiKeys] = useState<SavedApiKeySummary[]>([]);
  const [apiKeyNotice, setApiKeyNotice] = useState<string | null>(null);
  const [apiKeyAction, setApiKeyAction] = useState<"save" | "delete" | null>(null);
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const [savedConnections, setSavedConnections] = useState<SavedSystemConnectionSummary[]>([]);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [connectionAction, setConnectionAction] = useState<string | null>(null);

  const transportLabel = aiProvider === "openrouter" ? "OpenRouter" : "Anthropic";
  const currentKeyField = aiProvider === "openrouter" ? "openRouterApiKey" : "claudeApiKey";
  const currentKeyValue = aiProvider === "openrouter" ? credentials.openRouterApiKey || "" : credentials.claudeApiKey || "";
  const savedTransportKey = savedApiKeys.find((apiKey) => apiKey.provider === aiProvider && apiKey.is_active) || null;
  const automaticKeyAvailable = Boolean(savedTransportKey) || serverKeyAvailable;
  const canUseSavedConnections = isAuthenticated && Boolean(projectId);
  const canSaveCurrentConnection = canUseSavedConnections && Boolean(credentials.instanceUrl.trim());
  const temporaryTransportAccess: Partial<Record<AITransport, boolean>> = {
    anthropic: Boolean(credentials.claudeApiKey),
    openrouter: Boolean(credentials.openRouterApiKey),
  };

  const refreshSavedApiKeys = useCallback(async () => {
    if (!allowUserApiKeys) {
      setSavedApiKeys([]);
      return;
    }

    try {
      const response = await fetch("/api/user/api-keys", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        setSavedApiKeys([]);
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to load saved API keys");
      }

      const payload = (await response.json()) as { apiKeys?: SavedApiKeySummary[] };
      setSavedApiKeys(payload.apiKeys || []);
    } catch {
      setSavedApiKeys([]);
    }
  }, [allowUserApiKeys]);

  useEffect(() => {
    void refreshSavedApiKeys();
  }, [refreshSavedApiKeys]);

  const refreshSavedConnections = useCallback(async () => {
    if (!canUseSavedConnections || !projectId) {
      setSavedConnections([]);
      return;
    }

    try {
      const response = await fetch(`/api/user/connections?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        setSavedConnections([]);
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to load saved instances");
      }

      const payload = (await response.json()) as { connections?: SavedSystemConnectionSummary[] };
      setSavedConnections(payload.connections || []);
    } catch {
      setSavedConnections([]);
    }
  }, [canUseSavedConnections, projectId]);

  useEffect(() => {
    void refreshSavedConnections();
  }, [refreshSavedConnections]);

  const handleSaveCurrentKey = useCallback(async () => {
    const trimmedKey = currentKeyValue.trim();
    if (!trimmedKey || fieldsDisabled || !allowUserApiKeys) return;

    setApiKeyAction("save");
    setApiKeyNotice(null);

    try {
      const response = await fetch("/api/user/api-keys", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          provider: aiProvider,
          label: `${transportLabel} default`,
          api_key: trimmedKey,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save API key");
      }

      update(currentKeyField, "");
      setKeyMode("server");
      setApiKeyNotice(`${transportLabel} key saved to your profile.`);
      setCatalogReloadKey((value) => value + 1);
      await refreshSavedApiKeys();
    } catch (error) {
      setApiKeyNotice(error instanceof Error ? error.message : "Failed to save API key");
    } finally {
      setApiKeyAction(null);
    }
  }, [aiProvider, allowUserApiKeys, currentKeyField, currentKeyValue, fieldsDisabled, refreshSavedApiKeys, transportLabel, update]);

  const handleDeleteSavedKey = useCallback(async () => {
    if (!savedTransportKey || fieldsDisabled) return;

    setApiKeyAction("delete");
    setApiKeyNotice(null);

    try {
      const response = await fetch(`/api/user/api-keys/${savedTransportKey.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete saved API key");
      }

      setApiKeyNotice(`Removed saved ${transportLabel} key.`);
      setCatalogReloadKey((value) => value + 1);
      await refreshSavedApiKeys();
    } catch (error) {
      setApiKeyNotice(error instanceof Error ? error.message : "Failed to delete saved API key");
    } finally {
      setApiKeyAction(null);
    }
  }, [fieldsDisabled, refreshSavedApiKeys, savedTransportKey, transportLabel]);

  const handleSaveCurrentConnection = useCallback(async () => {
    if (!canUseSavedConnections || !projectId || !credentials.instanceUrl.trim()) return;

    setConnectionAction("save-current");
    setConnectionNotice(null);

    const instanceLabel = credentials.instanceUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const label = credentials.username
      ? `${instanceLabel} (${credentials.username})`
      : instanceLabel;

    try {
      const response = await fetch("/api/user/connections", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          system_type: "servicenow",
          label,
          instance_url: credentials.instanceUrl,
          project_id: projectId,
          is_default: savedConnections.length === 0,
          credentials: {
            instanceUrl: credentials.instanceUrl,
            username: credentials.username,
            password: credentials.password,
            snAuthType: credentials.snAuthType,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
            sessionCookies: credentials.sessionCookies,
            sessionToken: credentials.sessionToken,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; connection?: SavedSystemConnectionSummary }
        | null;

      if (!response.ok || !payload?.connection) {
        throw new Error(payload?.error || "Failed to save connection");
      }

      setConnectionNotice("Current ServiceNow instance saved to this project.");
      onConnectionSaved?.(payload.connection.id);
      await refreshSavedConnections();
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "Failed to save connection");
    } finally {
      setConnectionAction(null);
    }
  }, [canUseSavedConnections, credentials, onConnectionSaved, projectId, refreshSavedConnections, savedConnections.length]);

  const handleDeleteSavedConnection = useCallback(async (connectionId: string) => {
    setConnectionAction(`delete:${connectionId}`);
    setConnectionNotice(null);
    try {
      const response = await fetch(`/api/user/connections/${connectionId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete saved instance");
      }

      setConnectionNotice("Saved instance removed.");
      await refreshSavedConnections();
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "Failed to delete saved instance");
    } finally {
      setConnectionAction(null);
    }
  }, [refreshSavedConnections]);

  const handleUseConnection = useCallback(async (connectionId: string) => {
    if (!onUseSavedConnection) return;
    setConnectionAction(`connect:${connectionId}`);
    setConnectionNotice(null);
    try {
      await onUseSavedConnection(connectionId);
      setConnectionNotice("Connected using saved instance.");
      await refreshSavedConnections();
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "Failed to connect using saved instance");
    } finally {
      setConnectionAction(null);
    }
  }, [onUseSavedConnection, refreshSavedConnections]);

  const setSnAuthType = (nextAuthType: Credentials["snAuthType"]) => {
    setCredentials({
      ...credentials,
      snAuthType: nextAuthType,
      accessToken: nextAuthType === "oauth_authorization_code" ? credentials.accessToken : "",
      refreshToken: nextAuthType === "oauth_authorization_code" ? credentials.refreshToken : "",
      sessionCookies: nextAuthType === "session" ? credentials.sessionCookies : [],
    });
  };

  return (
    <div className="p-4 h-full flex flex-col" style={{ background: "var(--surface-sidebar)" }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-md transition-colors flex-shrink-0 -ml-1"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-elevated)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {APP_LOGO && <Image src={APP_LOGO} alt="App Logo" width={32} height={32} className="rounded-full" unoptimized priority />}
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Settings</h2>
          <p className="text-[10px]" style={{ color: "var(--text-disabled)", padding: 0 }}>Configure your connection</p>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* ── Section 1: ServiceNow Instance ── */}
        <div style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "12px" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold" style={{ background: "color-mix(in srgb, var(--color-primary) 10%, transparent)", color: "var(--color-primary)", border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)" }}>1</span>
            <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>ServiceNow Instance</span>
            <svg className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--text-disabled)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Instance URL</label>
              {usingServerBasicCreds ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
                  <span className="text-[11px] truncate" style={{ color: "var(--color-success)" }}>{credentials.instanceUrl}</span>
                </div>
              ) : (
                <input type="url" placeholder="https://dev12345.service-now.com" value={credentials.instanceUrl} onChange={(e) => update("instanceUrl", e.target.value)} className={INPUT_CLS} style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }} disabled={fieldsDisabled} />
              )}
            </div>
            <details className="group">
              <summary className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium" style={{ color: "var(--text-disabled)" }}>
                <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                Advanced Settings
              </summary>
              <div className="mt-2">
                <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Auth Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "basic", label: "Basic", desc: "Username + password" },
                    { key: "session", label: "Browser Session", desc: "Manual browser/MFA session" },
                  ].map((option) => {
                    const selected = snAuthType === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => !fieldsDisabled && setSnAuthType(option.key as Credentials["snAuthType"])}
                        disabled={fieldsDisabled}
                        className={`px-3 py-2 rounded-md text-left transition-colors ${fieldsDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        style={{
                          background: selected ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "var(--surface-elevated)",
                          border: `1px solid ${selected ? "color-mix(in srgb, var(--color-primary) 30%, transparent)" : "var(--border-emphasis)"}`,
                        }}
                      >
                        <div className="text-[11px] font-medium" style={{ color: selected ? "var(--color-primary)" : "var(--text-primary)" }}>{option.label}</div>
                        <div className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{option.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Username
              </label>
              {usingServerBasicCreds ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
                  <span className="text-[11px]" style={{ color: "var(--color-success)" }}>{credentials.username}</span>
                </div>
              ) : (
                <input type="text" placeholder="admin" value={credentials.username} onChange={(e) => update("username", e.target.value)} className={INPUT_CLS} style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }} disabled={fieldsDisabled} />
              )}
            </div>
            {snAuthType === "basic" && (
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
                {usingServerBasicCreds ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
                    <span className="text-[11px]" style={{ color: "var(--color-success)" }}>Provided by server</span>
                  </div>
                ) : (
                  <input type="password" placeholder="••••••••" value={credentials.password} onChange={(e) => update("password", e.target.value)} className={INPUT_CLS} style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }} disabled={fieldsDisabled} />
                )}
              </div>
            )}
            {(snAuthType === "oauth_client_credentials" || snAuthType === "oauth_authorization_code") && (
              <>
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>OAuth Client ID</label>
                  <input type="text" placeholder="OAuth client ID" value={credentials.clientId || ""} onChange={(e) => update("clientId", e.target.value)} className={INPUT_CLS} style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }} disabled={fieldsDisabled} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    OAuth Client Secret {snAuthType === "oauth_authorization_code" ? "(optional)" : ""}
                  </label>
                  <input type="password" placeholder="OAuth client secret" value={credentials.clientSecret || ""} onChange={(e) => update("clientSecret", e.target.value)} className={INPUT_CLS} style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }} disabled={fieldsDisabled} />
                </div>
              </>
            )}
            {snAuthType === "session" && (
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
                <input type="password" placeholder="Enter your ServiceNow password" value={credentials.password} onChange={(e) => update("password", e.target.value)} className={INPUT_CLS} style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }} disabled={fieldsDisabled} />
              </div>
            )}
            {snAuthType === "oauth_authorization_code" && (
              <div className="px-3 py-2 rounded-md text-[10px]" style={{ background: "color-mix(in srgb, var(--color-primary) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)", color: "var(--text-secondary)" }}>
                {credentials.accessToken
                  ? "OAuth sign-in completed in this browser session. Click Connect to validate the ServiceNow API session."
                  : "OAuth Authorization Code opens a ServiceNow sign-in popup. Complete SSO/MFA there, then the app will exchange the code for an API token."}
              </div>
            )}
            {snAuthType === "session" && (
              <div className="px-3 py-2 rounded-md text-[10px]" style={{ background: "color-mix(in srgb, var(--color-primary) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)", color: "var(--text-secondary)" }}>
                {(credentials.sessionCookies?.length || 0) > 0
                  ? "A browser-backed ServiceNow session is ready. Click Connect to validate it."
                  : "Browser Session opens a real browser using your ServiceNow username and password so you can finish SSO/MFA manually. The resulting ServiceNow session cookies stay in memory for this chat session only."}
              </div>
            )}

            <div className="pt-3 space-y-2" style={{ borderTop: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="block text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Saved Instances</label>
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-disabled)" }}>
                    Project-bound ServiceNow profiles let you reconnect without re-entering credentials.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveCurrentConnection}
                  disabled={!canSaveCurrentConnection || isConnecting || connectionAction === "save-current"}
                  className="px-3 py-2 rounded-md text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "color-mix(in srgb, var(--color-primary) 10%, transparent)", color: "var(--color-primary)", border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)" }}
                >
                  {connectionAction === "save-current" ? "Saving..." : "Save Current"}
                </button>
              </div>

              {!isAuthenticated ? (
                <div className="px-3 py-2 rounded-md text-[10px]" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-disabled)" }}>
                  Sign in to store project-bound ServiceNow instances.
                </div>
              ) : !projectId ? (
                <div className="px-3 py-2 rounded-md text-[10px]" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-disabled)" }}>
                  Workspace context is still loading. Saved instances will appear when the current project is ready.
                </div>
              ) : savedConnections.length === 0 ? (
                <div className="px-3 py-2 rounded-md text-[10px]" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-disabled)" }}>
                  No saved instances for this project yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {savedConnections.map((connection) => {
                    const isActive = activeConnectionId === connection.id;
                    const actionKey = connectionAction || "";
                    return (
                      <div
                        key={connection.id}
                        className="rounded-md px-3 py-2"
                        style={{
                          background: isActive ? "color-mix(in srgb, var(--color-primary) 8%, transparent)" : "var(--surface-elevated)",
                          border: `1px solid ${isActive ? "color-mix(in srgb, var(--color-primary) 22%, transparent)" : "var(--border-emphasis)"}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {connection.label}
                            </div>
                            <div className="text-[10px] truncate" style={{ color: "var(--text-disabled)" }}>
                              {connection.instance_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </div>
                            <div className="text-[10px] mt-1" style={{ color: "var(--text-disabled)" }}>
                              {connection.last_verified_at
                                ? `Verified ${new Date(connection.last_verified_at).toLocaleString()}`
                                : "Not yet verified"}
                              {connection.is_default ? " • Default" : ""}
                              {isActive ? " • Active" : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleUseConnection(connection.id)}
                              disabled={connected || isConnecting || actionKey === `connect:${connection.id}`}
                              className="px-2.5 py-1.5 rounded text-[10px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ background: "rgba(56,201,118,0.12)", color: "var(--color-success)", border: "1px solid rgba(56,201,118,0.2)" }}
                            >
                              {actionKey === `connect:${connection.id}` ? "Connecting..." : isActive ? "Active" : "Connect"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteSavedConnection(connection.id)}
                              disabled={actionKey === `delete:${connection.id}`}
                              className="px-2.5 py-1.5 rounded text-[10px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ background: "rgba(249,115,115,0.12)", color: "var(--color-danger)", border: "1px solid rgba(249,115,115,0.18)" }}
                            >
                              {actionKey === `delete:${connection.id}` ? "Removing..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {connectionNotice && (
                <div
                  className="px-3 py-2 rounded-md text-[10px]"
                  style={{
                    background: connectionNotice.toLowerCase().includes("failed") || connectionNotice.toLowerCase().includes("error")
                      ? "rgba(249,115,115,0.08)"
                      : "rgba(56,201,118,0.08)",
                    border: connectionNotice.toLowerCase().includes("failed") || connectionNotice.toLowerCase().includes("error")
                      ? "1px solid rgba(249,115,115,0.22)"
                      : "1px solid rgba(56,201,118,0.18)",
                    color: connectionNotice.toLowerCase().includes("failed") || connectionNotice.toLowerCase().includes("error")
                      ? "var(--color-danger)"
                      : "var(--color-success)",
                  }}
                >
                  {connectionNotice}
                </div>
              )}
            </div>
          </div>
        </div>{/* end Section 1 card */}

        {/* ── Section 2: AI Configuration ── */}
        <div style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "12px" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(168,85,247,0.1)", color: OPENROUTER_COLOR, border: "1px solid rgba(168,85,247,0.2)" }}>2</span>
            <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>AI Configuration</span>
            <svg className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--text-disabled)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Model Catalog</label>
              <ModelSelector
                selectedModel={selectedModel}
                onSelectModel={(modelId, transport) => {
                  if (modelLocked || fieldsDisabled) return;
                  setSelectedModel(modelId);
                  setAiProvider(transport);
                }}
                disabled={fieldsDisabled}
                modelLocked={modelLocked}
                temporaryTransportAccess={temporaryTransportAccess}
                reloadKey={catalogReloadKey}
              />
              <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: "var(--text-disabled)" }}>
                Provider groups are independent from execution transports right now. Claude models stay on Anthropic, while OpenAI, Gemini, MiMo, MiniMax, GLM, and OpenRouter models route through OpenRouter.
              </p>
              {(modelLocked || connected) && (
                <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: "var(--text-disabled)" }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Locked — disconnect to change
                </p>
              )}
            </div>

            {/* Key Source Toggle */}
            <div className="pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
              <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Credential Source</label>
              <div className="flex gap-2">
                <button
                  onClick={() => !fieldsDisabled && setKeyMode("server")}
                  disabled={fieldsDisabled}
                  className={`flex-1 px-3 py-2 rounded-md text-[11px] font-medium transition-colors ${fieldsDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{
                    background: keyMode === "server" ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "var(--surface-elevated)",
                    border: `1px solid ${keyMode === "server" ? "color-mix(in srgb, var(--color-primary) 30%, transparent)" : "var(--border-emphasis)"}`,
                    color: keyMode === "server" ? "var(--color-primary)" : "var(--text-secondary)",
                  }}
                >
                  Automatic
                </button>
                <button
                  onClick={() => !fieldsDisabled && allowUserApiKeys && setKeyMode("byok")}
                  disabled={fieldsDisabled || !allowUserApiKeys}
                  className={`flex-1 px-3 py-2 rounded-md text-[11px] font-medium transition-colors ${(fieldsDisabled || !allowUserApiKeys) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{
                    background: keyMode === "byok" ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "var(--surface-elevated)",
                    border: `1px solid ${keyMode === "byok" ? "color-mix(in srgb, var(--color-primary) 30%, transparent)" : "var(--border-emphasis)"}`,
                    color: keyMode === "byok" ? "var(--color-primary)" : "var(--text-secondary)",
                  }}
                >
                  Session Override
                </button>
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: "var(--text-disabled)" }}>
                {keyMode === "server"
                  ? "Automatic mode uses your saved profile key for this transport when present, then falls back to shared system capacity."
                  : "Session override keeps a key in browser memory for this tab only unless you explicitly save it to your profile."}
              </p>
            </div>

            {/* API Key Section */}
            <div className="pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
              {keyMode === "server" ? (
                <div className="space-y-2">
                  {savedTransportKey && (
                    <div className="px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-medium" style={{ color: "var(--color-success)" }}>
                            Saved {transportLabel} key active
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {savedTransportKey.key_hint || savedTransportKey.label} will be used before shared system capacity for this transport.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDeleteSavedKey}
                          disabled={fieldsDisabled || apiKeyAction === "delete"}
                          className="px-2 py-1 rounded text-[10px] font-medium"
                          style={{ background: "rgba(249,115,115,0.12)", color: "var(--color-danger)", border: "1px solid rgba(249,115,115,0.18)" }}
                        >
                          {apiKeyAction === "delete" ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  )}

                  {serverKeyAvailable && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.18)" }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: OPENROUTER_COLOR }} />
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        Shared {transportLabel} capacity is configured for this workspace.
                      </span>
                    </div>
                  )}

                  {!automaticKeyAvailable && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(249,115,115,0.06)", border: "1px solid rgba(249,115,115,0.15)" }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-failed)" }} />
                      <span className="text-[11px]" style={{ color: "var(--color-danger)" }}>
                        No saved {transportLabel} key or shared system access is available right now.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Session override — {transportLabel} API Key
                  </label>
                  {rateLimitHit && (
                    <div className="mb-2 px-3 py-2 rounded-md" style={{ background: "rgba(245,196,81,0.06)", border: "1px solid rgba(245,196,81,0.15)" }}>
                      <p className="text-[11px] font-medium" style={{ color: "var(--color-warning)" }}>Shared capacity hit a limit</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-disabled)" }}>Enter your own API key below to continue.</p>
                    </div>
                  )}
                  <input
                    type="password"
                    placeholder={aiProvider === "openrouter" ? "sk-or-v1-..." : "sk-ant-..."}
                    value={currentKeyValue}
                    onChange={(e) => {
                      update(currentKeyField, e.target.value);
                      if (e.target.value && rateLimitHit) onApiKeyProvided();
                    }}
                    className={INPUT_CLS}
                    style={{
                      background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)",
                      border: byokError ? "1px solid rgba(249,115,115,0.5)" : rateLimitHit ? "1px solid rgba(245,196,81,0.3)" : "1px solid var(--border-emphasis)",
                      color: "var(--text-primary)",
                      opacity: fieldsDisabled ? 0.7 : 1,
                    }}
                    disabled={fieldsDisabled}
                  />
                  {byokError && (
                    <div
                      className="mt-1.5 px-3 py-2 rounded-md"
                      style={{ background: "rgba(249,115,115,0.08)", border: "1px solid rgba(249,115,115,0.25)" }}
                      role="alert"
                    >
                      <p className="text-[11px] font-medium" style={{ color: "var(--color-danger)" }}>API Key Error</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{byokError}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveCurrentKey}
                      disabled={fieldsDisabled || !allowUserApiKeys || !currentKeyValue.trim() || apiKeyAction === "save"}
                      className="px-3 py-2 rounded-md text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: "color-mix(in srgb, var(--color-primary) 10%, transparent)", color: "var(--color-primary)", border: "1px solid color-mix(in srgb, var(--color-primary) 28%, transparent)" }}
                    >
                      {apiKeyAction === "save" ? "Saving..." : "Save To Profile"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setKeyMode("server")}
                      disabled={fieldsDisabled}
                      className="px-3 py-2 rounded-md text-[11px] font-medium"
                      style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-emphasis)" }}
                    >
                      Use Automatic Mode
                    </button>
                  </div>
                  <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: "var(--text-disabled)" }}>
                    Get your key at{" "}
                    <a
                      href={aiProvider === "openrouter" ? "https://openrouter.ai/keys" : "https://console.anthropic.com/settings/keys"}
                      target="_blank" rel="noopener noreferrer" className="hover:underline"
                      style={{ color: aiProvider === "openrouter" ? OPENROUTER_COLOR : "var(--color-primary)" }}
                    >
                      {aiProvider === "openrouter" ? "openrouter.ai/keys" : "console.anthropic.com"}
                    </a>
                    . Saved profile keys are encrypted at rest; unsaved session overrides remain in browser memory only.
                  </p>

                  {/* BYOK Security Disclosure */}
                  <details className="mt-2 group">
                    <summary
                      className="flex items-center gap-1.5 cursor-pointer text-[10px] font-medium select-none"
                      style={{ color: "var(--text-disabled)" }}
                    >
                      <KeyRound className="w-3 h-3 flex-shrink-0" />
                      Key Security
                      <svg className="w-2.5 h-2.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </summary>
                    <div
                      className="mt-1.5 px-2.5 py-2 rounded-md text-[10px] leading-relaxed space-y-1.5"
                      style={{ background: "color-mix(in srgb, var(--color-primary) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--color-primary) 12%, transparent)" }}
                    >
                      <p style={{ color: "var(--text-secondary)" }}>How your key is handled:</p>
                      <ul className="space-y-1 pl-3" style={{ color: "var(--text-disabled)", listStyleType: "disc" }}>
                        <li>Session override keys stay in <strong style={{ color: "var(--text-secondary)" }}>browser memory only</strong> unless you explicitly save them.</li>
                        <li>Saved profile keys are <strong style={{ color: "var(--text-secondary)" }}>encrypted before storage</strong> in the database.</li>
                        <li>All keys travel over <strong style={{ color: "var(--text-secondary)" }}>HTTPS</strong> to the backend when a request executes.</li>
                        <li><strong style={{ color: "var(--text-secondary)" }}>Key values are redacted from logs</strong> and never returned in config responses.</li>
                        <li>The backend still proxies model calls so ServiceNow tooling, guardrails, and app access controls stay enforced.</li>
                      </ul>
                      <div className="pt-1" style={{ borderTop: "1px solid color-mix(in srgb, var(--color-primary) 10%, transparent)" }}>
                        <p style={{ color: "var(--text-secondary)" }}>
                          <strong>Recommendation:</strong> Create a <strong>dedicated API key with spend limits</strong> on your provider dashboard rather than using your primary key.
                        </p>
                      </div>
                    </div>
                  </details>
                </div>
              )}

              {apiKeyNotice && (
                <div
                  className="px-3 py-2 rounded-md text-[10px]"
                  style={{
                    background: apiKeyNotice.toLowerCase().includes("failed") || apiKeyNotice.toLowerCase().includes("error")
                      ? "rgba(249,115,115,0.08)"
                      : "rgba(56,201,118,0.08)",
                    border: apiKeyNotice.toLowerCase().includes("failed") || apiKeyNotice.toLowerCase().includes("error")
                      ? "1px solid rgba(249,115,115,0.22)"
                      : "1px solid rgba(56,201,118,0.18)",
                    color: apiKeyNotice.toLowerCase().includes("failed") || apiKeyNotice.toLowerCase().includes("error")
                      ? "var(--color-danger)"
                      : "var(--color-success)",
                  }}
                >
                  {apiKeyNotice}
                </div>
              )}

              {/* Usage info */}
              {keyMode === "server" && usage && serverKeyAvailable && !savedTransportKey && (
                <UsageDisplay usage={usage} onRefresh={onRefreshUsage} />
              )}

              {/* Trial status */}
              {trialStatus?.isConfigured && (
                <div className="mt-2 space-y-1.5" style={{ padding: "8px", borderRadius: "8px", background: "var(--surface-elevated)" }}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span style={{ color: "var(--text-secondary)" }}>
                      {trialStatus.dailyUsed}/{trialStatus.dailyLimit} daily requests
                    </span>
                    <span className="font-medium" style={{
                      color: trialStatus.trialExpired ? "var(--color-danger)" : trialStatus.daysLeft <= 2 ? "var(--color-warning)" : "var(--text-disabled)"
                    }}>
                      {trialStatus.trialExpired ? "Trial ended" : `${trialStatus.daysLeft}d left`}
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-app)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (trialStatus.dailyUsed / trialStatus.dailyLimit) * 100)}%`,
                        background: trialStatus.dailyUsed >= trialStatus.dailyLimit ? "var(--color-danger)" : "var(--color-info)",
                      }}
                    />
                  </div>
                  {(trialStatus.trialExpired || trialStatus.dailyUsed >= trialStatus.dailyLimit) && allowUserApiKeys && (
                    <p className="text-[10px] mt-1" style={{ color: "var(--color-warning)" }}>
                      Switch to a saved key or session override to continue.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Transport summary */}
            <div className="pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
              <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Execution Transport</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "anthropic", label: "Anthropic", desc: "Direct Claude transport" },
                  { key: "openrouter", label: "OpenRouter", desc: "Routed multi-provider transport" },
                ].map((transport) => {
                  const active = aiProvider === transport.key;
                  return (
                    <div
                      key={transport.key}
                      className="rounded-md px-3 py-2"
                      style={{
                        background: active ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "var(--surface-elevated)",
                        border: `1px solid ${active ? "color-mix(in srgb, var(--color-primary) 28%, transparent)" : "var(--border-emphasis)"}`,
                      }}
                    >
                      <div className="text-[11px] font-medium" style={{ color: active ? "var(--color-primary)" : "var(--text-primary)" }}>
                        {transport.label}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{transport.desc}</div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: "var(--text-disabled)" }}>
                Current selection uses <strong style={{ color: "var(--text-secondary)" }}>{transportLabel}</strong>.
                {" "}
                {aiProvider === "openrouter"
                  ? "This lets the app expose OpenAI, Gemini, MiMo, MiniMax, GLM, and OpenRouter groups while execution still stays on the existing OpenRouter backend path."
                  : "Claude models stay on the direct Anthropic execution path for the current implementation phase."}
              </p>
            </div>
          </div>
        </div>{/* end Section 2 card */}

        {/* Connection status card */}
        {connected && connInfo && (
          <div className="mt-2 p-3 rounded-md space-y-2" style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--status-success)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--color-success)" }}>Connected</span>
            </div>
            <div className="text-[11px] space-y-0.5" style={{ color: "var(--text-secondary)" }}>
              <p>👤 {connInfo.userInfo?.name || credentials.username}</p>
              <p className="font-mono text-[10px]" style={{ color: "var(--text-disabled)" }}>🌐 {credentials.instanceUrl.replace(/https?:\/\//, "").replace(/\/$/, "")}</p>
              {connInfo.roles && (
                <p className="truncate" title={connInfo.roles.join(", ")}>
                  🔑 {connInfo.roles.length} role{connInfo.roles.length !== 1 ? "s" : ""}: {connInfo.hasAdmin ? "admin" : ""}{connInfo.hasAdmin && connInfo.hasSecurityAdmin ? ", " : ""}{connInfo.hasSecurityAdmin ? "security_admin" : ""}{!connInfo.hasAdmin && !connInfo.hasSecurityAdmin ? "limited" : ""}
                </p>
              )}
            </div>

            {/* Helper APIs Status */}
            {connInfo.helperApis && (
              <div className="pt-2 mt-2" style={{ borderTop: "1px solid var(--border-default)" }}>
                <div className="sidebar-group-label" style={{ padding: "0 0 4px 0" }}>Helper APIs</div>
                <div className="space-y-1">
                  {connInfo.helperApis.uiPolicyActionHelper && (
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: connInfo.helperApis.uiPolicyActionHelper.deployed ? "var(--status-success)" : "var(--status-progress)" }} />
                      <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                        UI Policy: <span style={{ color: connInfo.helperApis.uiPolicyActionHelper.deployed ? "var(--color-success)" : "var(--color-warning)" }}>
                          {connInfo.helperApis.uiPolicyActionHelper.deployed ? "Ready" : "Not deployed"}
                        </span>
                      </span>
                    </div>
                  )}
                  {connInfo.helperApis.updateSetHelper && (
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: connInfo.helperApis.updateSetHelper.deployed ? "var(--status-success)" : "var(--status-progress)" }} />
                      <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                        Update Set: <span style={{ color: connInfo.helperApis.updateSetHelper.deployed ? "var(--color-success)" : "var(--color-warning)" }}>
                          {connInfo.helperApis.updateSetHelper.deployed ? "Ready" : "Not deployed"}
                        </span>
                      </span>
                    </div>
                  )}
                  {connInfo.helperApis.addToUpdateSetHelper && (
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: connInfo.helperApis.addToUpdateSetHelper.deployed ? "var(--status-success)" : "var(--status-progress)" }} />
                      <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                        Add to Update Set: <span style={{ color: connInfo.helperApis.addToUpdateSetHelper.deployed ? "var(--color-success)" : "var(--color-warning)" }}>
                          {connInfo.helperApis.addToUpdateSetHelper.deployed ? "Ready" : "Not deployed"}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {connectionError && !connected && (
          <div
            className="p-3 rounded-md text-[11px]"
            style={{
              background: "rgba(249,115,115,0.08)",
              border: "1px solid rgba(249,115,115,0.25)",
            }}
            role="alert"
            aria-live="assertive"
          >
            <div className="font-medium mb-1" style={{ color: "var(--color-danger)" }}>
              Connection Failed
            </div>
            <div className="text-[10px] whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{connectionError}</div>
          </div>
        )}

        <div className="pb-2">
          {connected ? (
            <button
              onClick={onReconnect}
              className="w-full py-2.5 px-4 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
              style={{ background: "var(--color-warning)", color: "#0A0A0B" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" /></svg>
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={!canConnect}
              className="w-full py-2.5 px-4 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canConnect ? "var(--color-primary)" : "var(--surface-elevated)", color: canConnect ? "white" : "var(--text-disabled)" }}
              onMouseEnter={e => canConnect && (e.currentTarget.style.background = "var(--color-primary-hover)")}
              onMouseLeave={e => canConnect && (e.currentTarget.style.background = "var(--color-primary)")}
            >
              {isConnecting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  {connectLabel}
                </>
              ) : connectLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

