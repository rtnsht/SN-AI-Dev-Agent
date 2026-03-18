"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import type { Credentials, ConnectionResult, UsageInfo, TrialStatus, AIProvider, ModelOption } from "@/lib/types";
import { ANTHROPIC_MODELS } from "@/lib/types";
import { APP_LOGO } from "@/lib/branding";

interface Props {
  credentials: Credentials;
  setCredentials: (c: Credentials) => void;
  connected: boolean;
  connInfo: ConnectionResult | null;
  isConnecting: boolean;
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
}

const INPUT_CLS = "w-full px-3 py-2.5 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-info)] focus:border-transparent";

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
  credentials, setCredentials, connected, connInfo, isConnecting, onConnect, onReconnect,
  serverApiKeyConfigured, serverOpenRouterKeyConfigured, serverSnCredsConfigured,
  usage, rateLimitHit, onApiKeyProvided,
  aiProvider, setAiProvider, selectedModel, setSelectedModel, modelOptions, modelsLoading = false,
  modelLocked, allowUserApiKeys = true, trialStatus, onRefreshUsage, onBack
}: Props) {
  const update = (field: keyof Credentials, value: string) =>
    setCredentials({ ...credentials, [field]: value });

  const canConnect = !!(credentials.instanceUrl && credentials.username && (credentials.password || serverSnCredsConfigured)) && !isConnecting;

  // Display models based on provider
  const displayModels = aiProvider === "openrouter" ? modelOptions : ANTHROPIC_MODELS;

  // All inputs disabled when connected or mid-connecting
  const fieldsDisabled = connected || isConnecting;

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
        <Image src={APP_LOGO} alt="App Logo" width={32} height={32} className="rounded-md" unoptimized />
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Settings</h2>
          <p className="text-[10px]" style={{ color: "var(--text-disabled)", padding: 0 }}>Configure your connection</p>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* ── Section 1: ServiceNow Instance ── */}
        <div style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "12px" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(76,125,255,0.1)", color: "var(--color-info)", border: "1px solid rgba(76,125,255,0.2)" }}>1</span>
            <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>ServiceNow Instance</span>
            <svg className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--text-disabled)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          </div>
          <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Instance URL</label>
          {serverSnCredsConfigured ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
              <span className="text-[11px] truncate" style={{ color: "var(--color-success)" }}>{credentials.instanceUrl}</span>
            </div>
          ) : (
            <input type="url" placeholder="https://dev12345.service-now.com" value={credentials.instanceUrl} onChange={(e) => update("instanceUrl", e.target.value)} className={INPUT_CLS} style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }} disabled={fieldsDisabled} />
          )}
        </div>
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Username</label>
          {serverSnCredsConfigured ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
              <span className="text-[11px]" style={{ color: "var(--color-success)" }}>{credentials.username}</span>
            </div>
          ) : (
            <input type="text" placeholder="admin" value={credentials.username} onChange={(e) => update("username", e.target.value)} className={INPUT_CLS} style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }} disabled={fieldsDisabled} />
          )}
        </div>
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
          {serverSnCredsConfigured ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
              <span className="text-[11px]" style={{ color: "var(--color-success)" }}>Provided by server</span>
            </div>
          ) : (
            <input type="password" placeholder="••••••••" value={credentials.password} onChange={(e) => update("password", e.target.value)} className={INPUT_CLS} style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }} disabled={fieldsDisabled} />
          )}
        </div>
          </div>{/* end space-y-3 */}
        </div>{/* end Section 1 card */}

        {/* ── Section 2: AI Configuration ── */}
        <div style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "12px" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}>2</span>
            <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>AI Configuration</span>
            <svg className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--text-disabled)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>AI Provider</label>
          <div className="flex gap-2">
            <button
              onClick={() => !modelLocked && !fieldsDisabled && setAiProvider("anthropic")}
              disabled={modelLocked || fieldsDisabled}
              className={`flex-1 px-3 py-2 rounded-md text-[11px] font-medium transition-colors ${(modelLocked || fieldsDisabled) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              style={{
                background: aiProvider === "anthropic" ? "rgba(76,125,255,0.1)" : "var(--surface-elevated)",
                border: `1px solid ${aiProvider === "anthropic" ? "rgba(76,125,255,0.3)" : "var(--border-emphasis)"}`,
                color: aiProvider === "anthropic" ? "var(--color-info)" : "var(--text-secondary)",
              }}
            >
              Anthropic
            </button>
            <button
              onClick={() => !modelLocked && !fieldsDisabled && setAiProvider("openrouter")}
              disabled={modelLocked || fieldsDisabled}
              className={`flex-1 px-3 py-2 rounded-md text-[11px] font-medium transition-colors ${(modelLocked || fieldsDisabled) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              style={{
                background: aiProvider === "openrouter" ? "rgba(168,85,247,0.1)" : "var(--surface-elevated)",
                border: `1px solid ${aiProvider === "openrouter" ? "rgba(168,85,247,0.3)" : "var(--border-emphasis)"}`,
                color: aiProvider === "openrouter" ? "#a855f7" : "var(--text-secondary)",
              }}
            >
              OpenRouter
            </button>
          </div>
          {(modelLocked || connected) && (
            <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: "var(--text-disabled)" }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Locked — click Reconnect to change
            </p>
          )}
        </div>

        {/* API Key Section */}
        <div className="pt-3" style={{ borderTop: "1px solid var(--border-default)" }} >
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            {aiProvider === "openrouter" ? "OpenRouter API Key" : "Claude API Key"}
          </label>

          {aiProvider === "anthropic" ? (
            <>
              {!allowUserApiKeys && serverApiKeyConfigured ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
                  <span className="text-[11px]" style={{ color: "var(--color-success)" }}>Managed by server</span>
                  <svg className="w-3 h-3 ml-auto" style={{ color: "var(--text-disabled)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
              ) : serverApiKeyConfigured && !rateLimitHit && !credentials.claudeApiKey ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
                  <span className="text-[11px]" style={{ color: "var(--color-success)" }}>Provided by server</span>
                </div>
              ) : allowUserApiKeys ? (
                <>
                  {rateLimitHit && (
                    <div className="mb-2 px-3 py-2 rounded-md" style={{ background: "rgba(245,196,81,0.06)", border: "1px solid rgba(245,196,81,0.15)" }}>
                      <p className="text-[11px] font-medium" style={{ color: "var(--color-warning)" }}>⚡ Free tier limit reached</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-disabled)" }}>Enter your own API key below to continue.</p>
                    </div>
                  )}
                  <input
                    type="password"
                    placeholder="sk-ant-..."
                    value={credentials.claudeApiKey}
                    onChange={(e) => {
                      update("claudeApiKey", e.target.value);
                      if (e.target.value && rateLimitHit) onApiKeyProvided();
                    }}
                    className={INPUT_CLS}
                    style={{
                      background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)",
                      border: rateLimitHit ? "1px solid rgba(245,196,81,0.3)" : "1px solid var(--border-emphasis)",
                      color: "var(--text-primary)",
                      opacity: fieldsDisabled ? 0.7 : 1,
                      ...(rateLimitHit ? { boxShadow: "0 0 0 2px rgba(245,196,81,0.15)" } : {}),
                    }}
                    disabled={fieldsDisabled}
                  />
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(249,115,115,0.06)", border: "1px solid rgba(249,115,115,0.15)" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-failed)" }} />
                  <span className="text-[11px]" style={{ color: "var(--color-danger)" }}>No API key configured. Contact admin.</span>
                </div>
              )}
            </>
          ) : (
            <>
              {serverOpenRouterKeyConfigured && !credentials.openRouterApiKey ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
                  <span className="text-[11px]" style={{ color: "var(--color-success)" }}>Provided by server</span>
                </div>
              ) : (
                <input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={credentials.openRouterApiKey}
                  onChange={(e) => update("openRouterApiKey", e.target.value)}
                  className={INPUT_CLS}
                  style={{ background: fieldsDisabled ? "var(--surface-app)" : "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)", opacity: fieldsDisabled ? 0.7 : 1 }}
                  disabled={fieldsDisabled}
                />
              )}
              <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: "var(--text-disabled)" }}>
                Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "#a855f7" }}>openrouter.ai/keys</a>
              </p>
            </>
          )}

          {/* Usage info */}
          {usage && ((aiProvider === "anthropic" && serverApiKeyConfigured && !credentials.claudeApiKey) || (aiProvider === "openrouter" && serverOpenRouterKeyConfigured && !credentials.openRouterApiKey)) && (
            <UsageDisplay usage={usage} onRefresh={onRefreshUsage} />
          )}

          {/* Trial status */}
          {trialStatus?.isConfigured && (
            <div className="mt-2 space-y-1.5" style={{ padding: "8px", borderRadius: "8px", background: "var(--surface-secondary)" }}>
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
                  Connect your own API key to continue
                </p>
              )}
            </div>
          )}
        </div>

        {/* Model selection */}
        <div className="pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
          <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>AI Model</label>

          {modelsLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 rounded-md" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-emphasis)" }}>
              <svg className="w-4 h-4 animate-spin" style={{ color: "var(--text-disabled)" }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-[11px]" style={{ color: "var(--text-disabled)" }}>Loading models...</span>
            </div>
          ) : aiProvider === "openrouter" && displayModels.length > 10 ? (
            <>
              <select
                value={selectedModel}
                onChange={(e) => !modelLocked && !fieldsDisabled && setSelectedModel(e.target.value)}
                disabled={modelLocked || fieldsDisabled}
                className={`${INPUT_CLS} ${(modelLocked || fieldsDisabled) ? "opacity-60 cursor-not-allowed" : ""}`}
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)" }}
              >
                {displayModels.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              {selectedModel && (
                <p className="text-[10px] mt-1" style={{ color: "var(--text-disabled)" }}>
                  {displayModels.find(m => m.key === selectedModel)?.description || ""}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {displayModels.map((opt) => {
                const isSelected = selectedModel === opt.key;
                const accentColor = aiProvider === "openrouter" ? "#a855f7" : "var(--color-info)";
                return (
                  <button
                    key={opt.key}
                    onClick={() => !modelLocked && !fieldsDisabled && setSelectedModel(opt.key)}
                    disabled={modelLocked || fieldsDisabled}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${(modelLocked || fieldsDisabled) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    style={{
                      background: isSelected ? `color-mix(in srgb, ${accentColor} 8%, transparent)` : "var(--surface-elevated)",
                      border: `1px solid ${isSelected ? `color-mix(in srgb, ${accentColor} 30%, transparent)` : "var(--border-emphasis)"}`,
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ border: `2px solid ${isSelected ? accentColor : "var(--text-disabled)"}` }}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium" style={{ color: isSelected ? accentColor : "var(--text-primary)" }}>{opt.label}</p>
                      <p className="text-[10px] truncate" style={{ color: "var(--text-disabled)" }}>{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {(modelLocked || connected) && (
            <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: "var(--text-disabled)" }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Locked — click Reconnect to change
            </p>
          )}

          {aiProvider === "openrouter" && displayModels.length > 0 && (
            <div
              className="mt-2 px-3 py-2 rounded-md text-[10px] leading-relaxed"
              style={{
                background: "rgba(168,85,247,0.06)",
                border: "1px solid rgba(168,85,247,0.2)",
                color: "var(--text-secondary)",
              }}
            >
              <span className="font-semibold" style={{ color: "#a855f7" }}>Tested with</span>{" "}
              Claude, Gemini, ChatGPT, and Qwen. Other models in the list may also work — all listed models support tool calling and coding.
              <span className="block mt-1" style={{ color: "var(--text-disabled)" }}>
                {displayModels.length} models available
              </span>
            </div>
          )}
        </div>
          </div>{/* end space-y-3 */}
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
      </div>

      <div className="mt-4">
        {connected ? (
          <button
            onClick={onReconnect}
            className="w-full py-2.5 px-4 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            style={{ background: "var(--color-warning)", color: "#0A0A0B" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Reconnect
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
                Connecting...
              </>
            ) : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

