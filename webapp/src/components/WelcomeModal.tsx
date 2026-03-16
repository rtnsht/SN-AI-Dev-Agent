"use client";

import { useEffect } from "react";
import Image from "next/image";
import { APP_NAME, APP_LOGO, APP_SUBTITLE, HERO_VIDEO_URL } from "@/lib/branding";
import { getVideoEmbedUrl } from "@/components/LandingPage";

const HIGHLIGHTS = [
  {
    title: "Spec-Driven",
    desc: "The AI drafts the spec and design — you approve before a single line of code is written.",
  },
  {
    title: "Human-in-the-Loop",
    desc: "Phase gates enforce your sign-off at every stage. Nothing skips review.",
  },
  {
    title: "Instance-Safe",
    desc: "Every artifact lands in an update set with full audit trail and rollback support.",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--border-emphasis)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center px-6 pt-6 pb-4 text-center" style={{ borderBottom: "1px solid var(--border-default)" }}>
          {APP_LOGO && (
            <Image src={APP_LOGO} alt={APP_NAME} width={56} height={56} className="rounded-xl mb-3" unoptimized />
          )}
          <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Welcome to {APP_NAME || "SN AI Agent"}
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {APP_SUBTITLE || "Describe what you need. The AI builds it on your ServiceNow instance."}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Demo video */}
          {HERO_VIDEO_URL && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "var(--surface-secondary)" }}>
                <iframe
                  src={getVideoEmbedUrl(HERO_VIDEO_URL)}
                  title="App demo"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  frameBorder={0}
                  referrerPolicy="no-referrer-when-downgrade"
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                />
              </div>
            </div>
          )}

          {/* Key highlights */}
          <div className="space-y-3">
            {HIGHLIGHTS.map((h, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 rounded-lg"
                style={{ background: "var(--surface-secondary)" }}
              >
                <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full" style={{ background: i === 0 ? "var(--color-primary)" : i === 1 ? "var(--color-warning, #F5C451)" : "var(--text-disabled)" }} />
                <div>
                  <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{h.title}</h3>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer with CTA */}
        <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border-default)" }}>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: "var(--color-primary)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--color-primary-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--color-primary)"; }}
          >
            I understand — let&apos;s go
          </button>
          <p className="text-center text-[10px] mt-2" style={{ color: "var(--text-disabled)" }}>
            This won&apos;t show again
          </p>
        </div>
      </div>
    </div>
  );
}
