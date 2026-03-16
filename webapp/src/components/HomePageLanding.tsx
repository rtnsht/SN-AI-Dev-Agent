"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import ConnectModal from "@/components/ConnectModal";
import WelcomeModal from "@/components/WelcomeModal";
import Footer from "@/components/Footer";
import { APP_NAME, APP_LOGO, APP_HERO_TAGLINE, APP_SUBTITLE } from "@/lib/branding";

const WELCOME_SEEN_KEY = "yantra_welcome_seen";

export default function HomePageLanding() {
  const [showConnect, setShowConnect] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /* Auto-open welcome modal on first visit */
  useEffect(() => {
    const seen = localStorage.getItem(WELCOME_SEEN_KEY);
    if (!seen) {
      const t = setTimeout(() => setShowWelcome(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  /* Glass effect on header scroll */
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const handleWelcomeClose = useCallback((dontShowAgain?: boolean) => {
    if (dontShowAgain) localStorage.setItem(WELCOME_SEEN_KEY, "true");
    setShowWelcome(false);
  }, []);

  const openGetStarted = useCallback(() => {
    setShowWelcome(false);
    setShowConnect(true);
  }, []);

  return (
    <div className="home-page" style={{ background: "var(--surface-app)", color: "var(--text-primary)" }}>

      {/* ═══ Header ═══ */}
      <header className={`home-header${scrolled ? " scrolled" : ""}`}>
        <div className="home-header-left">
          {APP_LOGO && (
            <Image src={APP_LOGO} alt={APP_NAME || "Logo"} width={28} height={28} className="home-header-logo" unoptimized />
          )}
          <span className="home-header-name">{APP_NAME}</span>
        </div>
        <div className="home-header-right">
          <ThemeToggle />
          <button
            onClick={() => setShowWelcome(true)}
            className="home-header-demo"
            aria-label="Watch demo"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
            </svg>
            Watch Demo
          </button>
          <button onClick={() => setShowConnect(true)} className="home-header-cta">
            Get Started
          </button>
        </div>
      </header>

      {/* ═══ Hero ═══ */}
      <main className="home-hero">
        {/* Animated background */}
        <div className="home-hero-glow home-hero-glow-1" />
        <div className="home-hero-glow home-hero-glow-2" />
        <div className="home-hero-grid" />

        <div className="home-hero-content">
          {/* Badge */}
          <div className="home-badge">
            <span className="home-badge-dot" />
            AI-powered &middot; Phase-gated &middot; Human-approved
          </div>

          {/* Logo */}
          {APP_LOGO && (
            <div className="home-logo-wrap">
              <Image
                src={APP_LOGO}
                alt={APP_NAME || "Logo"}
                width={80}
                height={80}
                className="home-logo"
                unoptimized
                priority
              />
            </div>
          )}

          {/* Headline */}
          <h1 className="home-hero-title">
            {APP_HERO_TAGLINE || (
              <>Ship ServiceNow Features<br />with AI.</>
            )}
          </h1>

          {/* Subtitle */}
          <p className="home-hero-subtitle">
            {APP_SUBTITLE ||
              "Describe what you need in plain English. Yantra generates specs, code, and deployments — you review and approve every step."}
          </p>

          {/* CTAs */}
          <div className="home-cta-group">
            <button onClick={() => setShowConnect(true)} className="home-cta-primary">
              Get Started
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button onClick={() => setShowWelcome(true)} className="home-cta-secondary">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={1.5} />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              Watch Demo
            </button>
          </div>

          {/* Feature pills */}
          <div className="home-feature-pills">
            {[
              { icon: "📋", label: "Spec-driven workflow" },
              { icon: "🔒", label: "Update set capture" },
              { icon: "✅", label: "Full audit trail" },
            ].map((pill) => (
              <span key={pill.label} className="home-pill">
                <span>{pill.icon}</span>
                {pill.label}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* ═══ Footer ═══ */}
      <Footer />

      {/* ═══ Modals ═══ */}
      <WelcomeModal
        open={showWelcome}
        onClose={handleWelcomeClose}
        onGetStarted={openGetStarted}
      />
      <ConnectModal open={showConnect} onClose={() => setShowConnect(false)} />
    </div>
  );
}
