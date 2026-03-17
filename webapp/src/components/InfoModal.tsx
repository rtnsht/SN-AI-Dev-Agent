"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { APP_NAME, APP_LOGO, APP_SUBTITLE, HERO_VIDEO_URL, INFO_MODAL_FEATURES } from "@/lib/branding";
import { getVideoEmbedUrl } from "@/components/LandingPage";
import type { InfoModalFeature } from "@/lib/branding";

interface Props {
  open: boolean;
  onClose: () => void;
  onTryPrompt?: (text: string) => void;
}

export default function InfoModal({ open, onClose, onTryPrompt }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const { primary, compact } = useMemo(() => {
    const p: InfoModalFeature[] = [];
    const c: InfoModalFeature[] = [];
    for (const f of INFO_MODAL_FEATURES) {
      if (f.tier === "compact") c.push(f);
      else p.push(f);
    }
    return { primary: p, compact: c };
  }, []);

  if (!open) return null;

  const handleTry = (example: string) => {
    const cleaned = example.replace(/^[""]|[""]$/g, "").trim();
    onTryPrompt?.(cleaned);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] sm:max-h-[80vh] mx-0 sm:mx-4 rounded-t-lg sm:rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--border-emphasis)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Image src={APP_LOGO} alt={APP_NAME} width={36} height={36} className="rounded-md flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9" unoptimized />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>{APP_NAME}</h2>
              <p className="text-[10px] sm:text-xs mt-0.5" style={{ color: "var(--text-disabled)" }}>{APP_SUBTITLE || "What you can do with this app"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors flex-shrink-0"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">

          {/* Video showcase */}
          {HERO_VIDEO_URL && (
            <div className="mb-4">
              <p className="info-section-label">See it in action</p>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "var(--surface-secondary)" }}>
                  <iframe
                    src={getVideoEmbedUrl(HERO_VIDEO_URL)}
                    title="Product demo"
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                    frameBorder={0}
                    referrerPolicy="no-referrer-when-downgrade"
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tier 1: Primary features — full cards */}
          {primary.length > 0 && (
            <div>
              <p className="info-section-label">How it works</p>
              <div className="space-y-1.5">
                {primary.map((f, i) => (
                  <div key={i} className="info-primary-card" style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="text-lg sm:text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                      <div className="flex items-start gap-1.5 mt-1.5">
                        <p className="info-example-text" title={f.example}>
                          {f.example}
                        </p>
                        {onTryPrompt && f.example.startsWith('"') && (
                          <button
                            className="info-try-btn"
                            onClick={(e) => { e.stopPropagation(); handleTry(f.example); }}
                          >
                            Try it
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tier 2: Compact features — 2-col grid */}
          {compact.length > 0 && (
            <div className="mt-4">
              <p className="info-section-label">Tools &amp; controls</p>
              <div className="info-compact-grid">
                {compact.map((f, i) => (
                  <div key={i} className="info-compact-card" style={{ animationDelay: `${(primary.length + i) * 60}ms` }}>
                    <span className="text-base flex-shrink-0">{f.icon}</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{f.title}</h4>
                      <p className="text-[10px] sm:text-[11px] leading-snug mt-0.5" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 text-center" style={{ borderTop: "1px solid var(--border-default)" }}>
          <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
            <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}>Esc</kbd> or click outside to close</span>
            <span className="sm:hidden">Tap outside to close</span>
          </p>
        </div>
      </div>
    </div>
  );
}
