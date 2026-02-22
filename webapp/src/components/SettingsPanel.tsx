"use client";

import type { Credentials, ConnectionResult, UsageInfo, ModelChoice } from "@/lib/types";
import { MODEL_OPTIONS } from "@/lib/types";

interface Props {
  credentials: Credentials;
  setCredentials: (c: Credentials) => void;
  connected: boolean;
  connInfo: ConnectionResult | null;
  isConnecting: boolean;
  onConnect: () => void;
  serverApiKeyConfigured: boolean;
  serverSnCredsConfigured: boolean;
  usage: UsageInfo | null;
  rateLimitHit: boolean;
  onApiKeyProvided: () => void;
  selectedModel: ModelChoice;
  setSelectedModel: (m: ModelChoice) => void;
  modelLocked: boolean;
}

const INPUT_CLS = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors";

export default function SettingsPanel({ credentials, setCredentials, connected, connInfo, isConnecting, onConnect, serverApiKeyConfigured, serverSnCredsConfigured, usage, rateLimitHit, onApiKeyProvided, selectedModel, setSelectedModel, modelLocked }: Props) {
  const update = (field: keyof Credentials, value: string) =>
    setCredentials({ ...credentials, [field]: value });

  const canConnect = !!(credentials.instanceUrl && credentials.username && (credentials.password || serverSnCredsConfigured)) && !isConnecting;

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-sm">⚡</div>
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

        <div className="pt-3 border-t border-gray-800">
          <label className="block text-xs font-medium text-gray-400 mb-1">Claude API Key</label>
          {serverApiKeyConfigured && !rateLimitHit && !credentials.claudeApiKey ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
                <span className="text-xs text-green-300">Provided by server</span>
              </div>
              {/* Usage counter */}
              {usage && (
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
                  {usage.resetsAt && (
                    <p className="text-[10px] text-gray-600">
                      Resets {new Date(usage.resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {rateLimitHit && (
                <div className="mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-[11px] text-amber-300 font-medium">⚡ Free tier limit reached</p>
                  <p className="text-[10px] text-amber-400/80 mt-0.5">Enter your own API key below to continue with unlimited access.</p>
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
                autoFocus={rateLimitHit}
              />
              <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                🔒 Your API key is sent per-request over HTTPS and never stored.
              </p>
            </>
          )}
        </div>

        {/* Model selection */}
        <div className="pt-3 border-t border-gray-800">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">AI Model</label>
          <div className="space-y-1.5">
            {MODEL_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => !modelLocked && setSelectedModel(opt.key)}
                disabled={modelLocked}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                  selectedModel === opt.key
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                } ${modelLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  selectedModel === opt.key ? "border-blue-500" : "border-gray-600"
                }`}>
                  {selectedModel === opt.key && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${selectedModel === opt.key ? "text-blue-300" : "text-gray-300"}`}>{opt.label}</p>
                  <p className="text-[10px] text-gray-500">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
          {modelLocked && (
            <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Locked for this session. Start a new chat to change.
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

