"use client";

import { useState } from "react";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import ConnectModal from "@/components/ConnectModal";
import { APP_NAME, APP_LOGO, APP_HERO_TAGLINE, APP_SUBTITLE, HERO_FEATURES, HERO_VIDEO_URL } from "@/lib/branding";

/** Normalise any YouTube/Vimeo URL to a proper embed URL with autoplay */
function getVideoEmbedUrl(url: string): string {
  if (!url) return url;

  // ── YouTube ──────────────────────────────────────────────
  // Handles: youtu.be/<id>, youtube.com/watch?v=<id>, youtube.com/embed/<id>
  const ytShort  = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const ytWatch  = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
  const ytEmbed  = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  const ytId = (ytShort || ytWatch || ytEmbed)?.[1];
  if (ytId) {
    return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&rel=0`;
  }

  // ── Vimeo ────────────────────────────────────────────────
  // Handles: vimeo.com/<id>, player.vimeo.com/video/<id>
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeo) {
    return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1`;
  }

  // Fallback — return as-is with no extra params
  return url;
}

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="landing-page" style={{ background: "var(--surface-app)", color: "var(--text-primary)" }}>
      {/* Theme toggle — top right */}
      <div className="landing-theme-toggle">
        <ThemeToggle />
      </div>

      {/* ═══ Section 1: Hero ═══ */}
      <section className="landing-hero">
        {/* Ambient background glow */}
        <div className="landing-hero-glow" />

        {/* Logo */}
        {APP_LOGO && (
          <div className="hero-logo-container landing-logo-container">
            <Image
              src={APP_LOGO}
              alt={APP_NAME}
              width={180}
              height={180}
              className="hero-logo"
              unoptimized
              priority
            />
          </div>
        )}

        {/* Title */}
        {APP_NAME && (
          <h1 className="landing-title">{APP_NAME}</h1>
        )}

        {/* Hero tagline */}
        {APP_HERO_TAGLINE && (
          <p className="hero-tagline landing-hero-tagline">{APP_HERO_TAGLINE}</p>
        )}

        {/* Subtitle */}
        {APP_SUBTITLE && (
          <p className="landing-subtitle">{APP_SUBTITLE}</p>
        )}

        {/* Primary CTA */}
        <button
          onClick={() => setShowModal(true)}
          className="landing-cta-button"
        >
          Connect Now
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </section>

      {/* ═══ Section 2: Video (optional) ═══ */}
      {HERO_VIDEO_URL && (
        <section className="landing-section landing-video-section">
          <div className="landing-video-container">
            <div className="landing-video-wrapper">
              <iframe
                src={getVideoEmbedUrl(HERO_VIDEO_URL)}
                title="See it in action"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                className="landing-video-iframe"
              />
            </div>
          </div>
        </section>
      )}

      {/* ═══ Section 3: Feature Pills ═══ */}
      {HERO_FEATURES.length > 0 && (
        <section className="landing-section">
          <div className="hero-features-block landing-features-block rounded-2xl p-6 sm:p-8">
            <div className="relative z-10 space-y-5">
              {HERO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="hero-feature-dot w-2 h-2 rounded-full mt-2 flex-shrink-0"
                    style={{
                      background: i === 0
                        ? "var(--color-primary)"
                        : i === 1
                        ? "var(--color-accent-from)"
                        : "var(--text-disabled)",
                    }}
                  />
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {f.title}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      {f.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ Section 4: How It Works ═══ */}
      <section className="landing-section">
        <h2 className="landing-section-title">How It Works</h2>
        <div className="landing-steps-grid">
          {[
            { step: "1", title: "Say what you need", desc: "Describe your requirement in plain English — the AI understands ServiceNow." },
            { step: "2", title: "Watch AI build it", desc: "Follow along as it creates specs, designs, and code — you approve each step." },
            { step: "3", title: "Ship to your instance", desc: "Deploy directly to ServiceNow with full audit trail and rollback support." },
          ].map((item) => (
            <div key={item.step} className="landing-step-card">
              <span className="landing-step-number">{item.step}</span>
              <h3 className="landing-step-title">{item.title}</h3>
              <p className="landing-step-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Section 5: Footer CTA ═══ */}
      <section className="landing-section landing-footer-cta">
        <h2 className="landing-section-title">Ready to build something?</h2>
        <button
          onClick={() => setShowModal(true)}
          className="landing-cta-button"
        >
          Connect Now
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
        <p className="landing-signin-link">
          Already have access?{" "}
          <button onClick={() => setShowModal(true)} className="auth-link">
            Sign in
          </button>
        </p>
      </section>

      {/* Smart login modal */}
      <ConnectModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}

