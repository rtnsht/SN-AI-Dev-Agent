"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRotatingText } from "@/hooks/useRotatingText";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import ConnectModal from "@/components/ConnectModal";
import Footer from "@/components/Footer";
import {
  APP_NAME, APP_LOGO, APP_HERO_TAGLINE, APP_SUBTITLE, APP_TAGLINE,
  HERO_FEATURES, HERO_VIDEO_URL, TRUST_ITEMS, WELCOME_BADGE,
  FEATURES_EYEBROW, FEATURES_TITLE, STEPS_EYEBROW, STEPS_TITLE,
  HIGHLIGHT_TITLE, HIGHLIGHT_DESC, CTA_HEADLINE, CTA_SUBTEXT,
} from "@/lib/branding";

/** Normalise any YouTube/Vimeo URL to a proper embed URL with autoplay */
export function getVideoEmbedUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  // YouTube: short links, watch pages (with extra params like &si=), embeds
  const ytShort = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const ytWatch = trimmed.match(/youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{11})/);
  const ytEmbed = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  const ytLive  = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  const ytId = (ytShort || ytWatch || ytEmbed || ytLive)?.[1];
  if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&rel=0`;
  // Vimeo
  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1`;
  return trimmed;
}

/* ── Hero rotating text — auto-toggles between multiple strings ── */
function LandingRotatingText({ texts, interval = 12000 }: { texts: string[]; interval?: number }) {
  const { activeIdx, phase } = useRotatingText(texts.length, interval);

  if (texts.length === 0) return null;
  if (texts.length === 1) {
    return <p className="landing-subtitle">{texts[0]}</p>;
  }

  const isHeroTagline = activeIdx === 0;
  return (
    <div className="hero-rotating-text landing-rotating-text">
      <div className={`hero-rotating-text-item ${phase === "active" ? "active" : "exiting"}`}>
        <p
          className={isHeroTagline ? "landing-rotating-headline" : "landing-subtitle"}
          style={{ marginBottom: 0 }}
        >
          {texts[activeIdx]}
        </p>
      </div>
    </div>
  );
}

/* ── Scroll-reveal hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("revealed"); io.unobserve(el); } },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ── Inline SVG icons for feature cards ── */
const FeatureIcons = [
  /* Describe — chat/speech bubble */
  <svg key="f1" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  /* Guided — route/workflow */
  <svg key="f2" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  /* Control — shield/check */
  <svg key="f3" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
];

/* ── Step icons for "How It Works" ── */
const StepIcons = [
  /* 1. Describe */
  <svg key="s1" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>,
  /* 2. Build */
  <svg key="s2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/></svg>,
  /* 3. Ship */
  <svg key="s3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
];

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const openModal = useCallback(() => setShowModal(true), []);

  /* Scroll-reveal refs */
  const trustRef    = useReveal();
  const featuresRef = useReveal();
  const stepsRef    = useReveal();
  const highlightRef = useReveal();
  const ctaRef      = useReveal();
  const videoRef    = useReveal();

  return (
    <div className="landing-page" style={{ background: "var(--surface-app)", color: "var(--text-primary)" }}>

      {/* ═══ Sticky Header ═══ */}
      <header className={`landing-header${scrolled ? " scrolled" : ""}`}>
        <div className="landing-header-left">
          {APP_LOGO && (
            <Image src={APP_LOGO} alt={APP_NAME || "Logo"} width={32} height={32} className="landing-header-logo" unoptimized />
          )}
          <span className="landing-header-name">{APP_NAME}</span>
        </div>
        <div className="landing-header-right">
          <ThemeToggle />
          <button onClick={openModal} className="landing-header-signin">Sign In</button>
          <button onClick={openModal} className="landing-header-cta">Get Started</button>
        </div>
      </header>

      {/* ═══ Hero ═══ */}
      <section className="landing-hero">
        {/* Animated background grid */}
        <div className="landing-hero-grid" />
        <div className="landing-hero-glow" />

        {/* 1. Logo — focal point, bigger */}
        {APP_LOGO && (
          <div className="hero-logo-container landing-logo-container" style={{ width: 120, height: 120, marginBottom: 24 }}>
            <Image src={APP_LOGO} alt={APP_NAME} width={120} height={120} className="hero-logo" style={{ width: 120, height: 120 }} unoptimized priority />
          </div>
        )}

        {/* 2. App name */}
        <h1 className="landing-title" style={{ fontSize: "clamp(28px, 4vw, 42px)", marginBottom: 16 }}>
          {APP_NAME || "SN AI Agent"}
        </h1>

        {/* 3. Badge pill */}
        <div className="landing-badge" style={{ marginBottom: 28 }}>
          <span className="landing-badge-dot" />
          {WELCOME_BADGE || <>Spec-driven &middot; Human-approved &middot; AI-powered</>}
        </div>

        {/* 4. Auto-toggling animated text */}
        <LandingRotatingText
          texts={[
            APP_HERO_TAGLINE || APP_TAGLINE || "Ship ServiceNow Features with AI.",
            APP_SUBTITLE || "Describe what you need in plain English. The AI generates specs, code, and deployments — you review and approve every step.",
          ].filter(Boolean)}
        />

        {/* CTA group */}
        <div className="landing-cta-group">
          <button onClick={openModal} className="landing-cta-button">
            Start Building
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </button>
          <button onClick={openModal} className="landing-cta-secondary">
            Sign In
          </button>
        </div>
      </section>

      {/* ═══ Video (optional) ═══ */}
      {HERO_VIDEO_URL && (
        <section ref={videoRef} className="landing-section landing-video-section reveal-section">
          <div className="landing-video-container">
            <div className="landing-video-wrapper">
              <iframe
                src={getVideoEmbedUrl(HERO_VIDEO_URL)}
                title="See it in action"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                frameBorder={0}
                referrerPolicy="no-referrer-when-downgrade"
                loading="lazy"
                className="landing-video-iframe"
              />
            </div>
          </div>
        </section>
      )}

      {/* ═══ Trust Bar ═══ */}
      <section ref={trustRef} className="landing-trust reveal-section">
        <div className="landing-trust-grid">
          {TRUST_ITEMS.map((t) => (
            <div key={t.label} className="landing-trust-item">
              <span className="landing-trust-value">{t.value}</span>
              <span className="landing-trust-label">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section ref={featuresRef} className="landing-section landing-features-section reveal-section">
        <div className="landing-section-eyebrow">{FEATURES_EYEBROW}</div>
        <h2 className="landing-section-title">{FEATURES_TITLE}</h2>
        <div className="landing-features-grid">
          {(HERO_FEATURES.length > 0 ? HERO_FEATURES : [
            { title: "Business Rules to Client Scripts — generated.", desc: "Describe what you need. The AI creates Script Includes, Business Rules, Client Scripts, UI Policies, and custom fields — deployed directly to your instance." },
            { title: "A guided workflow, not a black box.", desc: "Every feature follows a structured path: spec, design, build, test, deploy. You review and approve each phase before it moves forward." },
            { title: "Update sets, rollbacks, and full audit trail.", desc: "Every artifact is captured in an update set. Nothing gets deployed without your sign-off. Every change is traceable and reversible." },
          ]).map((f, i) => (
            <div key={i} className="landing-feature-card">
              <div className="landing-feature-icon">{FeatureIcons[i] || FeatureIcons[0]}</div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section ref={stepsRef} className="landing-section landing-steps-section reveal-section">
        <div className="landing-section-eyebrow">{STEPS_EYEBROW}</div>
        <h2 className="landing-section-title">{STEPS_TITLE}</h2>
        <div className="landing-steps-grid">
          {[
            { step: "01", title: "Describe your requirement", desc: "Type what you need in plain English. The AI understands ServiceNow tables, fields, and best practices.", icon: StepIcons[0] },
            { step: "02", title: "Review and approve", desc: "The AI generates specs, designs, and code. You approve each phase before it moves forward.", icon: StepIcons[1] },
            { step: "03", title: "Deploy with confidence", desc: "Ship to your ServiceNow instance with update set capture, audit trail, and rollback support.", icon: StepIcons[2] },
          ].map((item, i) => (
            <div key={item.step} className="landing-step-card">
              <div className="landing-step-header">
                <span className="landing-step-number">{item.step}</span>
                <div className="landing-step-icon">{item.icon}</div>
              </div>
              <h3 className="landing-step-title">{item.title}</h3>
              <p className="landing-step-desc">{item.desc}</p>
              {i < 2 && <div className="landing-step-connector" />}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Highlight Banner ═══ */}
      <section ref={highlightRef} className="landing-section reveal-section">
        <div className="landing-highlight">
          <div className="landing-highlight-content">
            <h3 className="landing-highlight-title">{HIGHLIGHT_TITLE}</h3>
            <p className="landing-highlight-desc">{HIGHLIGHT_DESC}</p>
          </div>
        </div>
      </section>

      {/* ═══ Footer CTA ═══ */}
      <section ref={ctaRef} className="landing-section landing-footer-cta reveal-section">
        <h2 className="landing-cta-headline">{CTA_HEADLINE}</h2>
        <p className="landing-cta-subtext">{CTA_SUBTEXT}</p>
        <button onClick={openModal} className="landing-cta-button">
          Request Early Access
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        </button>
      </section>

      {/* ═══ Site Footer ═══ */}
      <Footer />

      {/* Smart login modal */}
      <ConnectModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
