"use client";

import Image from "next/image";
import type { Credentials, ConnectionResult, UsageInfo, AIProvider, ModelOption } from "@/lib/types";
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
}

const INPUT_CLS = "w-full px-3 py-2.5 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-info)] focus:border-transparent";

export default function SettingsPanel({
  credentials, setCredentials, connected, connInfo, isConnecting, onConnect, onReconnect,
  serverApiKeyConfigured, serverOpenRouterKeyConfigured, serverSnCredsConfigured,
  usage, rateLimitHit, onApiKeyProvided,
  aiProvider, setAiProvider, selectedModel, setSelectedModel, modelOptions, modelsLoading = false,
  modelLocked, allowUserApiKeys = true
}: Props) {
  const update = (field: keyof Credentials, value: string) =>
    setCredentials({ ...credentials, [field]: value });

  const canConnect = !!(credentials.instanceUrl && credentials.username && (credentials.password || serverSnCredsConfigured)) && !isConnecting;

  // Display models based on provider
  const displayModels = aiProvider === "openrouter" ? modelOptions : ANTHROPIC_MODELS;

  return (
    <div className="p-4 h-full flex flex-col" style={{ background: "var(--surface-sidebar)" }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-6">
        <Image src={APP_LOGO} alt="App Logo" width={32} height={32} className="rounded-md" unoptimized />
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Connection</h2>
          <p className="sidebar-group-label" style={{ padding: 0, fontSize: "10px" }}>ServiceNow Instance</p>
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Instance URL</label>
          {serverSnCredsConfigured ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} />
              <span className="text-[11px] truncate" style={{ color: "var(--color-success)" }}>{credentials.instanceUrl}</span>
            </div>
          ) : (
            <input type="url" placeholder="https://dev12345.service-now.com" value={credentials.instanceUrl} onChange={(e) => update("instanceUrl", e.target.value)} className={INPUT_CLS} style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)" }} disabled={isConnecting} />
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
            <input type="text" placeholder="admin" value={credentials.username} onChange={(e) => update("username", e.target.value)} className={INPUT_CLS} style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)" }} disabled={isConnecting} />
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
            <input type="password" placeholder="••••••••" value={credentials.password} onChange={(e) => update("password", e.target.value)} className={INPUT_CLS} style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)" }} disabled={isConnecting} />
          )}
        </div>

        {/* AI Provider Selection */}
        <div className="pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
          <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>AI Provider</label>
          <div className="flex gap-2">
            <button
              onClick={() => !modelLocked && setAiProvider("anthropic")}
              disabled={modelLocked}
              className={`flex-1 px-3 py-2 rounded-md text-[11px] font-medium transition-colors ${modelLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              style={{
                background: aiProvider === "anthropic" ? "rgba(76,125,255,0.1)" : "var(--surface-secondary)",
                border: `1px solid ${aiProvider === "anthropic" ? "rgba(76,125,255,0.3)" : "var(--border-emphasis)"}`,
                color: aiProvider === "anthropic" ? "var(--color-info)" : "var(--text-secondary)",
              }}
            >
              Anthropic
            </button>
            <button
              onClick={() => !modelLocked && setAiProvider("openrouter")}
              disabled={modelLocked}
              className={`flex-1 px-3 py-2 rounded-md text-[11px] font-medium transition-colors ${modelLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              style={{
                background: aiProvider === "openrouter" ? "rgba(168,85,247,0.1)" : "var(--surface-secondary)",
                border: `1px solid ${aiProvider === "openrouter" ? "rgba(168,85,247,0.3)" : "var(--border-emphasis)"}`,
                color: aiProvider === "openrouter" ? "#a855f7" : "var(--text-secondary)",
              }}
            >
              OpenRouter
            </button>
          </div>
          {modelLocked && (
            <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: "var(--text-disabled)" }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Provider locked for this session
            </p>
          )}
        </div>

        {/* API Key Section */}
        <div className="pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
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
                      background: "var(--surface-secondary)",
                      border: rateLimitHit ? "1px solid rgba(245,196,81,0.3)" : "1px solid var(--border-emphasis)",
                      color: "var(--text-primary)",
                      ...(rateLimitHit ? { boxShadow: "0 0 0 2px rgba(245,196,81,0.15)" } : {}),
                    }}
                    disabled={isConnecting}
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
                  style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)" }}
                  disabled={isConnecting}
                />
              )}
              <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: "var(--text-disabled)" }}>
                Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "#a855f7" }}>openrouter.ai/keys</a>
              </p>
            </>
          )}

          {/* Usage info */}
          {usage && ((aiProvider === "anthropic" && serverApiKeyConfigured && !credentials.claudeApiKey) || (aiProvider === "openrouter" && serverOpenRouterKeyConfigured && !credentials.openRouterApiKey)) && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span style={{ color: "var(--text-secondary)" }}>{usage.used}/{usage.max} requests used</span>
                <span className="font-medium" style={{ color: usage.remaining <= 2 ? "var(--color-warning)" : "var(--text-disabled)" }}>
                  {usage.remaining} left
                </span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-secondary)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(usage.used / usage.max) * 100}%`,
                    background: usage.remaining === 0 ? "var(--color-danger)" : usage.remaining <= 2 ? "var(--color-warning)" : "var(--color-info)",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Model selection */}
        <div className="pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
          <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>AI Model</label>

          {modelsLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 rounded-md" style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-emphasis)" }}>
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
                onChange={(e) => !modelLocked && setSelectedModel(e.target.value)}
                disabled={modelLocked}
                className={`${INPUT_CLS} ${modelLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)" }}
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
                    onClick={() => !modelLocked && setSelectedModel(opt.key)}
                    disabled={modelLocked}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${modelLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    style={{
                      background: isSelected ? `color-mix(in srgb, ${accentColor} 8%, transparent)` : "var(--surface-secondary)",
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

          {modelLocked && (
            <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: "var(--text-disabled)" }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Locked for this session. Start a new chat to change.
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

