"use client";

import Image from "next/image";
import type { Credentials, ConnectionResult, UsageInfo, AIProvider, ModelOption } from "@/lib/types";
import { ANTHROPIC_MODELS } from "@/lib/types";

interface Props {
  credentials: Credentials;
  setCredentials: (c: Credentials) => void;
  connected: boolean;
  connInfo: ConnectionResult | null;
  isConnecting: boolean;
  onConnect: () => void;
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

const INPUT_CLS = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors";

export default function SettingsPanel({
  credentials, setCredentials, connected, connInfo, isConnecting, onConnect,
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
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-5">
        <Image src="/yantra-logo.png" alt="Yantra" width={36} height={36} className="rounded-full" unoptimized />
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Connection</h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">ServiceNow Instance</p>
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Instance URL</label>
          {serverSnCredsConfigured ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
              <span className="text-xs text-green-300 truncate">{credentials.instanceUrl}</span>
            </div>
          ) : (
            <input type="url" placeholder="https://dev12345.service-now.com" value={credentials.instanceUrl} onChange={(e) => update("instanceUrl", e.target.value)} className={INPUT_CLS} disabled={isConnecting} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
          {serverSnCredsConfigured ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
              <span className="text-xs text-green-300">{credentials.username}</span>
            </div>
          ) : (
            <input type="text" placeholder="admin" value={credentials.username} onChange={(e) => update("username", e.target.value)} className={INPUT_CLS} disabled={isConnecting} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
          {serverSnCredsConfigured ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
              <span className="text-xs text-green-300">Provided by server</span>
            </div>
          ) : (
            <input type="password" placeholder="••••••••" value={credentials.password} onChange={(e) => update("password", e.target.value)} className={INPUT_CLS} disabled={isConnecting} />
          )}
        </div>

        {/* AI Provider Selection */}
        <div className="pt-3 border-t border-gray-800">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">AI Provider</label>
          <div className="flex gap-2">
            <button
              onClick={() => !modelLocked && setAiProvider("anthropic")}
              disabled={modelLocked}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                aiProvider === "anthropic"
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
              } ${modelLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              Anthropic
            </button>
            <button
              onClick={() => !modelLocked && setAiProvider("openrouter")}
              disabled={modelLocked}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                aiProvider === "openrouter"
                  ? "border-purple-500 bg-purple-500/10 text-purple-300"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
              } ${modelLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              OpenRouter
            </button>
          </div>
          {modelLocked && (
            <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Provider locked for this session
            </p>
          )}
        </div>

        {/* API Key Section - differs by provider */}
        <div className="pt-3 border-t border-gray-800">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            {aiProvider === "openrouter" ? "OpenRouter API Key" : "Claude API Key"}
          </label>

          {aiProvider === "anthropic" ? (
            /* Anthropic API Key logic */
            <>
              {!allowUserApiKeys && serverApiKeyConfigured ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
                  <span className="text-xs text-green-300">Managed by server</span>
                  <svg className="w-3 h-3 text-gray-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
              ) : serverApiKeyConfigured && !rateLimitHit && !credentials.claudeApiKey ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
                  <span className="text-xs text-green-300">Provided by server</span>
                </div>
              ) : allowUserApiKeys ? (
                <>
                  {rateLimitHit && (
                    <div className="mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-[11px] text-amber-300 font-medium">⚡ Free tier limit reached</p>
                      <p className="text-[10px] text-amber-400/80 mt-0.5">Enter your own API key below to continue.</p>
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
                    className={`${INPUT_CLS} ${rateLimitHit ? "ring-2 ring-amber-500/50 border-amber-500/50" : ""}`}
                    disabled={isConnecting}
                  />
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <span className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0" />
                  <span className="text-xs text-red-300">No API key configured. Contact admin.</span>
                </div>
              )}
            </>
          ) : (
            /* OpenRouter API Key logic */
            <>
              {serverOpenRouterKeyConfigured && !credentials.openRouterApiKey ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
                  <span className="text-xs text-green-300">Provided by server</span>
                </div>
              ) : (
                <input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={credentials.openRouterApiKey}
                  onChange={(e) => update("openRouterApiKey", e.target.value)}
                  className={INPUT_CLS}
                  disabled={isConnecting}
                />
              )}
              <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">openrouter.ai/keys</a>
              </p>
            </>
          )}

          {/* Usage info for Anthropic with server key */}
          {aiProvider === "anthropic" && usage && serverApiKeyConfigured && !credentials.claudeApiKey && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">{usage.used}/{usage.max} requests used</span>
                <span className={`font-medium ${usage.remaining <= 2 ? "text-amber-400" : "text-gray-500"}`}>
                  {usage.remaining} left
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usage.remaining === 0 ? "bg-red-500" : usage.remaining <= 2 ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${(usage.used / usage.max) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Model selection */}
        <div className="pt-3 border-t border-gray-800">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">AI Model</label>

          {modelsLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg">
              <svg className="w-4 h-4 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-gray-500">Loading models...</span>
            </div>
          ) : aiProvider === "openrouter" && displayModels.length > 10 ? (
            /* OpenRouter: Use dropdown for many models */
            <>
              <select
                value={selectedModel}
                onChange={(e) => !modelLocked && setSelectedModel(e.target.value)}
                disabled={modelLocked}
                className={`${INPUT_CLS} ${modelLocked ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {displayModels.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {selectedModel && (
                <p className="text-[10px] text-gray-500 mt-1">
                  {displayModels.find(m => m.key === selectedModel)?.description || ""}
                </p>
              )}
            </>
          ) : (
            /* Anthropic or few models: Radio-button style */
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {displayModels.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => !modelLocked && setSelectedModel(opt.key)}
                  disabled={modelLocked}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                    selectedModel === opt.key
                      ? aiProvider === "openrouter" ? "border-purple-500 bg-purple-500/10" : "border-blue-500 bg-blue-500/10"
                      : "border-gray-700 bg-gray-800 hover:border-gray-600"
                  } ${modelLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    selectedModel === opt.key
                      ? aiProvider === "openrouter" ? "border-purple-500" : "border-blue-500"
                      : "border-gray-600"
                  }`}>
                    {selectedModel === opt.key && (
                      <div className={`w-1.5 h-1.5 rounded-full ${aiProvider === "openrouter" ? "bg-purple-500" : "bg-blue-500"}`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium ${
                      selectedModel === opt.key
                        ? aiProvider === "openrouter" ? "text-purple-300" : "text-blue-300"
                        : "text-gray-300"
                    }`}>{opt.label}</p>
                    <p className="text-[10px] text-gray-500 truncate">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {modelLocked && (
            <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Locked for this session. Start a new chat to change.
            </p>
          )}

          {aiProvider === "openrouter" && displayModels.length > 0 && (
            <p className="text-[10px] text-gray-600 mt-1.5">
              {displayModels.length} models available
            </p>
          )}
        </div>

        {/* Connection status card */}
        {connected && connInfo && (
          <div className="mt-2 p-3 bg-gray-800/70 rounded-lg border border-gray-700 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-xs font-medium text-green-400">Connected</span>
            </div>
            <div className="text-[11px] text-gray-400 space-y-0.5">
              <p>👤 {connInfo.userInfo?.name || credentials.username}</p>
              <p>🌐 {credentials.instanceUrl.replace(/https?:\/\//, "").replace(/\/$/, "")}</p>
              {connInfo.roles && (
                <p className="truncate" title={connInfo.roles.join(", ")}>
                  🔑 {connInfo.roles.length} role{connInfo.roles.length !== 1 ? "s" : ""}: {connInfo.hasAdmin ? "admin" : ""}{connInfo.hasAdmin && connInfo.hasSecurityAdmin ? ", " : ""}{connInfo.hasSecurityAdmin ? "security_admin" : ""}{!connInfo.hasAdmin && !connInfo.hasSecurityAdmin ? "limited" : ""}
                </p>
              )}
            </div>

            {/* Helper APIs Status */}
            {connInfo.helperApis && (
              <div className="pt-2 mt-2 border-t border-gray-700">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-[10px] font-medium text-cyan-400 uppercase tracking-wider">Helper APIs</span>
                </div>
                <div className="space-y-1">
                  {connInfo.helperApis.uiPolicyActionHelper && (
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${connInfo.helperApis.uiPolicyActionHelper.deployed ? "bg-green-400" : "bg-amber-400"}`} />
                      <span className="text-[10px] text-gray-400">
                        UI Policy Helper: <span className={connInfo.helperApis.uiPolicyActionHelper.deployed ? "text-green-400" : "text-amber-400"}>
                          {connInfo.helperApis.uiPolicyActionHelper.deployed ? "Ready" : "Not deployed"}
                        </span>
                      </span>
                    </div>
                  )}
                  {connInfo.helperApis.updateSetHelper && (
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${connInfo.helperApis.updateSetHelper.deployed ? "bg-green-400" : "bg-amber-400"}`} />
                      <span className="text-[10px] text-gray-400">
                        Update Set Helper: <span className={connInfo.helperApis.updateSetHelper.deployed ? "text-green-400" : "text-amber-400"}>
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
        <button
          onClick={onConnect}
          disabled={!canConnect}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isConnecting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Connecting...
            </>
          ) : connected ? "Reconnect" : "Connect"}
        </button>
      </div>
    </div>
  );
}

