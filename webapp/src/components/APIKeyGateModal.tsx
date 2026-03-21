"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { APP_NAME, APP_LOGO } from "@/lib/branding";

interface Props {
  open: boolean;
  onClose: () => void;
  onKeyProvided: (provider: "anthropic" | "openrouter", key: string) => void;
  dailyUsed: number;
  dailyLimit: number;
}

/**
 * Shown when an authenticated user exhausts their daily requests.
 * Prompts them to enter their own API key for unlimited access.
 */
export default function APIKeyGateModal({ open, onClose, onKeyProvided, dailyUsed, dailyLimit }: Props) {
  const [provider, setProvider] = useState<"anthropic" | "openrouter">("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--border-emphasis)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center px-6 pt-6 pb-4 text-center" style={{ borderBottom: "1px solid var(--border-default)" }}>
          {APP_LOGO && (
            <Image src={APP_LOGO} alt={APP_NAME} width={48} height={48} className="rounded-full mb-3" unoptimized />
          )}
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            You&apos;ve used {dailyUsed}/{dailyLimit} requests today
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Add your own API key for unlimited access.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Provider toggle */}
          <div className="flex gap-2">
            {(["anthropic", "openrouter"] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setProvider(p); setApiKey(""); setError(""); }}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
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
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
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
            Continue with my key
          </button>

          <div className="text-center space-y-1">
            <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
              Your key is sent per-request over HTTPS and never stored on our servers.
            </p>
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
    </div>
  );
}
