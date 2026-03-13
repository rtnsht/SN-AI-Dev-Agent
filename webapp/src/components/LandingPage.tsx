"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import ConnectModal from "@/components/ConnectModal";
import Footer from "@/components/Footer";
import {
  APP_NAME, APP_LOGO, APP_HERO_TAGLINE, APP_SUBTITLE,
  HERO_FEATURES, HERO_VIDEO_URL,
} from "@/lib/branding";

/** Normalise any YouTube/Vimeo URL to a proper embed URL with autoplay */
function getVideoEmbedUrl(url: string): string {
  if (!url) return url;
  const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const ytWatch = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
  const ytEmbed = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  const ytId = (ytShort || ytWatch || ytEmbed)?.[1];
  if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&rel=0`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1`;
  return url;
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
          <button onClick={openModal} className="landing-header-cta">Get Started</button>
        </div>
      </header>

      {/* ═══ Hero ═══ */}
      <section className="landing-hero">
        {/* Animated background grid */}
        <div className="landing-hero-grid" />
        <div className="landing-hero-glow" />

        {/* Badge */}
        <div className="landing-badge">
          <span className="landing-badge-dot" />
          Spec-driven &middot; Human-approved &middot; AI-powered
        </div>

        {/* Logo — smaller, accent role */}
        {APP_LOGO && (
          <div className="hero-logo-container landing-logo-container">
            <Image src={APP_LOGO} alt={APP_NAME} width={72} height={72} className="hero-logo" unoptimized priority />
          </div>
        )}

        {/* Headline — gradient text */}
        <h1 className="landing-title">
          {APP_HERO_TAGLINE || <>Build on ServiceNow<br/>at the speed of thought.</>}
        </h1>

        {/* Subtitle */}
        <p className="landing-subtitle">
          {APP_SUBTITLE || "Describe what you need in plain English. The AI creates specs, designs, code, and deploys — you approve every step."}
        </p>

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
                className="landing-video-iframe"
              />
            </div>
          </div>
        </section>
      )}

      {/* ═══ Trust Bar ═══ */}
      <section ref={trustRef} className="landing-trust reveal-section">
        <div className="landing-trust-grid">
          {[
            { value: "100%", label: "Auditable" },
            { value: "Zero", label: "Black-box decisions" },
            { value: "Full", label: "Rollback support" },
            { value: "SDLC", label: "Phase-gated" },
          ].map((t) => (
            <div key={t.label} className="landing-trust-item">
              <span className="landing-trust-value">{t.value}</span>
              <span className="landing-trust-label">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section ref={featuresRef} className="landing-section landing-features-section reveal-section">
        <div className="landing-section-eyebrow">Capabilities</div>
        <h2 className="landing-section-title">Everything you need to ship on ServiceNow</h2>
        <div className="landing-features-grid">
          {(HERO_FEATURES.length > 0 ? HERO_FEATURES : [
            { title: "Describe what you need. We'll build it.", desc: "Tell the AI what you want in plain English — forms, automations, workflows, or custom features — and it handles the rest." },
            { title: "A guided workflow, not a black box.", desc: "Every feature follows a structured path: spec > design > build > test > deploy. You review and approve each step before moving on." },
            { title: "You're always in control.", desc: "Nothing gets deployed without your sign-off. The AI checks what already exists, reuses what it can, and tracks every change." },
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
        <div className="landing-section-eyebrow">Workflow</div>
        <h2 className="landing-section-title">Three steps from idea to production</h2>
        <div className="landing-steps-grid">
          {[
            { step: "01", title: "Describe your requirement", desc: "Type what you need in natural language. The AI understands ServiceNow tables, fields, workflows, and best practices.", icon: StepIcons[0] },
            { step: "02", title: "Review and approve", desc: "Watch the AI create specs, designs, and code. You approve each phase before it moves forward — nothing is a surprise.", icon: StepIcons[1] },
            { step: "03", title: "Deploy with confidence", desc: "Ship directly to your ServiceNow instance with a full audit trail, update set capture, and rollback support.", icon: StepIcons[2] },
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
            <h3 className="landing-highlight-title">Built for enterprise. Open for everyone.</h3>
            <p className="landing-highlight-desc">
              Phase-gated SDLC. Full audit trail. Update set management. Brownfield-safe deployments.
              Every artifact is traceable, every decision is documented, every deployment is reversible.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ Footer CTA ═══ */}
      <section ref={ctaRef} className="landing-section landing-footer-cta reveal-section">
        <h2 className="landing-cta-headline">Stop clicking. Start building.</h2>
        <p className="landing-cta-subtext">
          Go from idea to deployed ServiceNow solution in minutes, not weeks.
        </p>
        <button onClick={openModal} className="landing-cta-button">
          Get Started Free
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
