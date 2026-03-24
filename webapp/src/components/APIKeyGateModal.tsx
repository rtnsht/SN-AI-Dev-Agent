"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/branding";

interface Props {
  open: boolean;
  onClose: () => void;
  onKeyProvided: (provider: "anthropic" | "openrouter", key: string) => void;
  dailyUsed: number;
  dailyLimit: number;
  /** When set, the panel was opened because a server key hit a provider error */
  providerError?: string | null;
}

/**
 * Slide-in side panel for entering BYOK API keys.
 * Triggered by:
 *  - Rate-limit / billing errors on the server pool key
 *  - Daily quota exhaustion
 *  - User clicking "BYOK" in Settings when not connected
 */
export default function APIKeyGateModal({ open, onClose, onKeyProvided, dailyUsed, dailyLimit, providerError }: Props) {
  const [provider, setProvider] = useState<"anthropic" | "openrouter">("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) { setApiKey(""); setError(""); }
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    const key = apiKey.trim();
    if (!key) { setError("API key is required"); return; }
    if (provider === "anthropic" && !key.startsWith("sk-ant-")) {
      setError("Anthropic keys start with sk-ant-");
      return;
    }
    onKeyProvided(provider, key);
  }

  const heading = providerError
    ? providerError === "provider_auth"
      ? "API key error"
      : providerError === "provider_billing"
        ? "Credits exhausted"
        : "Shared key hit a limit"
    : dailyUsed >= dailyLimit
      ? `You\u2019ve used ${dailyUsed}/${dailyLimit} requests today`
      : "BYOK \u2014 Bring Your Own Key";

  const subtext = providerError
    ? providerError === "provider_auth"
      ? "The server API key failed authentication. Enter your own key to continue."
      : providerError === "provider_billing"
        ? "The API key\u2019s credits are exhausted. Enter a key with available balance, or add credits at openrouter.ai/credits."
        : "The app\u2019s shared AI key is temporarily rate-limited. Enter your own key to continue this conversation."
    : dailyUsed >= dailyLimit
      ? "Add your own API key to continue with unlimited access."
      : `Use your own ${APP_NAME === "SN AI Agent" ? "Anthropic or OpenRouter" : ""} API key.`;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-in panel from right */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="BYOK — Bring Your Own Key"
        className="fixed top-0 right-0 z-50 h-full w-full max-w-sm shadow-2xl flex flex-col animate-slide-in-right"
        style={{ background: "var(--surface-primary)", borderLeft: "1px solid var(--border-emphasis)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{heading}</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{subtext}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-md" style={{ color: "var(--text-disabled)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-secondary)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Provider toggle */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Provider</label>
            <div className="flex gap-2">
              {(["anthropic", "openrouter"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => { setProvider(p); setApiKey(""); setError(""); }}
                  className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: provider === p ? "var(--color-primary)" : "var(--surface-secondary)",
                    color: provider === p ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${provider === p ? "var(--color-primary)" : "var(--border-default)"}`,
                  }}
                >
                  {p === "anthropic" ? "Anthropic (Claude)" : "OpenRouter"}
                </button>
              ))}
            </div>
          </div>

          {/* Key input */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {provider === "anthropic" ? "Claude API Key" : "OpenRouter API Key"}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-or-..."}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-mono"
              style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
              autoFocus
            />
          </div>

          {error && <p className="text-xs" style={{ color: "var(--color-error, #ef4444)" }}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!apiKey.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            {providerError ? "Save & retry" : "Continue with my key"}
          </button>

          {/* BYOK Security Disclosure */}
          <details className="pt-2 group">
            <summary
              className="flex items-center gap-1.5 cursor-pointer text-[10px] font-medium select-none"
              style={{ color: "var(--text-disabled)" }}
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Key Security
              <svg className="w-2.5 h-2.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </summary>
            <div
              className="mt-1.5 px-2.5 py-2 rounded-md text-[10px] leading-relaxed space-y-1.5"
              style={{ background: "color-mix(in srgb, var(--color-primary) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--color-primary) 12%, transparent)" }}
            >
              <ul className="space-y-1 pl-3" style={{ color: "var(--text-disabled)", listStyleType: "disc" }}>
                <li>Stored in <strong style={{ color: "var(--text-secondary)" }}>browser memory only</strong> &mdash; cleared on tab close</li>
                <li>Sent over <strong style={{ color: "var(--text-secondary)" }}>HTTPS</strong>, used transiently per-request, never persisted</li>
                <li><strong style={{ color: "var(--text-secondary)" }}>Redacted from all logs</strong></li>
                <li>This app sends chat requests to the backend, which calls {provider === "openrouter" ? "OpenRouter" : "Anthropic"} with the API key for that request. Your BYOK key stays in the browser until you use it; it isn&apos;t saved on the server or written to disk. That keeps LLM access together with ServiceNow tooling and access controls on the backend.</li>
              </ul>
              <p className="pt-1" style={{ color: "var(--text-secondary)", borderTop: "1px solid color-mix(in srgb, var(--color-primary) 10%, transparent)" }}>
                <strong>Tip:</strong> Use a dedicated key with spend limits rather than your primary key.
              </p>
            </div>
          </details>

          <div className="space-y-1 pt-1">
            <a
              href={provider === "anthropic" ? "https://console.anthropic.com/settings/keys" : "https://openrouter.ai/keys"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] underline"
              style={{ color: "var(--color-primary)" }}
            >
              Get an API key
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
