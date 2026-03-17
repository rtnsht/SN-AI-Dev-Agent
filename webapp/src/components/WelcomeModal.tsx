"use client";

import { useEffect } from "react";
import Image from "next/image";
import { APP_NAME, APP_LOGO, APP_SUBTITLE, HERO_VIDEO_URL, WELCOME_BADGE, WELCOME_CTA, WELCOME_FOOTER } from "@/lib/branding";
import { getVideoEmbedUrl } from "@/components/LandingPage";

interface Props {
  open: boolean;
  onClose: () => void;
  heroVideoUrl?: string;
}

export default function WelcomeModal({ open, onClose, heroVideoUrl }: Props) {
  const videoUrl = heroVideoUrl || HERO_VIDEO_URL;
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
          {/* Badge (from env: NEXT_PUBLIC_WELCOME_BADGE) */}
          <div className="landing-badge mb-4">
            <span className="landing-badge-dot" />
            {WELCOME_BADGE}
          </div>
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
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Demo video */}
          {videoUrl && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "var(--surface-secondary)" }}>
                <iframe
                  src={getVideoEmbedUrl(videoUrl)}
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
            {WELCOME_CTA}
          </button>
          <p className="text-center text-[10px] mt-2" style={{ color: "var(--text-disabled)" }}>
            {WELCOME_FOOTER}
          </p>
        </div>
      </div>
    </div>
  );
}
