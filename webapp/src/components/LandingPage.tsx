"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import AppLogo from "@/components/AppLogo";
import ThemeToggle from "@/components/ThemeToggle";
import ConnectModal from "@/components/ConnectModal";
import Footer from "@/components/Footer";
import {
  APP_NAME, APP_LOGO, HERO_VIDEO_URL,
} from "@/lib/branding";

/* ── Types matching API response ── */
interface LandingSection {
  id: string;
  section_key: string;
  section_type: string;
  title: string | null;
  subtitle: string | null;
  layout_config: Record<string, unknown>;
  display_order: number;
  is_visible: boolean;
}

interface LandingHero {
  id: string;
  headline: string;
  tagline: string | null;
  badge_text: string | null;
  primary_cta_text: string;
  primary_cta_link: string;
  secondary_cta_text: string | null;
  secondary_cta_link: string | null;
  background_type: string;
  background_value: string;
  visual_type: string | null;
  visual_url: string | null;
  visual_alt: string | null;
  layout_split: Record<string, unknown>;
  is_active: boolean;
}

interface LandingValueProp {
  id: string;
  section_id: string;
  headline: string;
  description: string;
  quote_text: string | null;
  quote_author: string | null;
  quote_role: string | null;
  visual_type: string | null;
  visual_url: string | null;
  visual_icon: string | null;
  visual_position: string;
  display_order: number;
  is_visible: boolean;
}

interface LandingFeature {
  id: string;
  section_id: string;
  title: string;
  description: string;
  icon_name: string | null;
  icon_color: string;
  card_style: string;
  link_url: string | null;
  link_text: string | null;
  display_order: number;
  is_visible: boolean;
}

interface LandingStat {
  id: string;
  section_id: string;
  value: string;
  label: string;
  description: string | null;
  icon_name: string | null;
  display_order: number;
  is_visible: boolean;
}

interface LandingCta {
  id: string;
  section_id: string;
  headline: string;
  description: string | null;
  button_text: string;
  button_link: string;
  button_style: string;
  background_type: string;
  background_value: string;
  display_order: number;
  is_visible: boolean;
}

interface LandingNavLink {
  id: string;
  label: string;
  url: string;
  is_button: boolean;
  button_style: string | null;
  display_order: number;
  is_visible: boolean;
}

interface LandingContent {
  sections: LandingSection[];
  hero: LandingHero | null;
  value_props: LandingValueProp[];
  features: LandingFeature[];
  stats: LandingStat[];
  ctas: LandingCta[];
  nav_links: LandingNavLink[];
}

/** Normalise video URL for embedding - exported for backward compatibility */
export function getVideoEmbedUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  const ytShort = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const ytWatch = trimmed.match(/youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{11})/);
  const ytEmbed = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  const ytLive  = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  const ytId = (ytShort || ytWatch || ytEmbed || ytLive)?.[1];
  if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&rel=0`;
  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1`;
  return trimmed;
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

/* ── Icon map for feature cards ── */
const FeatureIconMap: Record<string, React.ReactNode> = {
  "file-text": <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  "users": <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  "shield-check": <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  "zap": <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  "refresh": <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
};

/* ── Section Renderers ── */

function HeroSection({ hero, onCta }: { hero: LandingHero | null; onCta: () => void }) {
  const leftPercent = (hero?.layout_split as Record<string, number>)?.left ?? 60;
  const rightPercent = 100 - leftPercent;

  return (
    <section className="landing-hero landing-hero-palantir">
      {/* Animated background grid */}
      <div className="landing-hero-grid" />
      <div className="landing-hero-glow" />

      <div className="landing-hero-columns" style={{ gridTemplateColumns: `${leftPercent}% ${rightPercent}%` }}>
        {/* Left column - Text content */}
        <div className="landing-hero-text">
          {/* Badge */}
          {hero?.badge_text && (
            <div className="landing-badge landing-badge-palantir">
              <span className="landing-badge-dot" />
              {hero.badge_text}
            </div>
          )}

          {/* Big headline - Palantir style */}
          <h1 className="landing-headline-palantir">
            {hero?.headline || "SHIP SERVICENOW FEATURES WITH AI"}
          </h1>

          {/* Tagline */}
          {hero?.tagline && (
            <p className="landing-tagline-palantir">{hero.tagline}</p>
          )}

          {/* CTA buttons */}
          <div className="landing-cta-group landing-cta-palantir">
            <button onClick={onCta} className="landing-cta-button landing-cta-primary-palantir">
              {hero?.primary_cta_text || "Get Started"}
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            {hero?.secondary_cta_text && (
              <button onClick={onCta} className="landing-cta-secondary landing-cta-secondary-palantir">
                {hero.secondary_cta_text}
              </button>
            )}
          </div>
        </div>

        {/* Right column - Visual placeholder */}
        <div className="landing-hero-visual">
          <div className="landing-hero-visual-placeholder">
            {APP_LOGO && (
              <div className="landing-hero-logo-wrapper">
                <AppLogo idPrefix="landing-hero" animated className="hero-logo" title={APP_NAME || undefined} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TwoColumnSection({ 
  section, 
  valueProps, 
  index 
}: { 
  section: LandingSection; 
  valueProps: LandingValueProp[]; 
  index: number; 
}) {
  const prop = valueProps.find(p => p.section_id === section.id);
  if (!prop) return null;

  const isReversed = prop.visual_position === "left" || index % 2 === 1;

  return (
    <section className="landing-section landing-two-column-section">
      <div className={`landing-two-column-grid ${isReversed ? "reversed" : ""}`}>
        {/* Text column */}
        <div className="landing-two-column-text">
          <h2 className="landing-section-headline-palantir">{prop.headline}</h2>
          <p className="landing-section-description">{prop.description}</p>
          {prop.quote_text && (
            <blockquote className="landing-quote">
              <p>"{prop.quote_text}"</p>
              {prop.quote_author && (
                <cite>
                  — {prop.quote_author}
                  {prop.quote_role && <>, {prop.quote_role}</>}
                </cite>
              )}
            </blockquote>
          )}
        </div>

        {/* Visual column */}
        <div className="landing-two-column-visual">
          {prop.visual_type === "image" && prop.visual_url ? (
            <img src={prop.visual_url} alt="" className="landing-two-column-image" />
          ) : (
            <div className="landing-two-column-placeholder">
              <div className="landing-placeholder-pattern" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection({ section, features }: { section: LandingSection; features: LandingFeature[] }) {
  const sectionFeatures = features.filter(f => f.section_id === section.id);

  return (
    <section className="landing-section landing-features-section">
      {section.title && <div className="landing-section-eyebrow">{section.title}</div>}
      {section.subtitle && <h2 className="landing-section-title">{section.subtitle}</h2>}
      <div className="landing-features-grid landing-features-palantir">
        {sectionFeatures.map((feature) => (
          <div key={feature.id} className={`landing-feature-card ${feature.card_style === "highlighted" ? "highlighted" : ""}`}>
            <div className="landing-feature-icon" style={{ color: feature.icon_color || "var(--color-primary)" }}>
              {FeatureIconMap[feature.icon_name || "file-text"] || FeatureIconMap["file-text"]}
            </div>
            <h3 className="landing-feature-title">{feature.title}</h3>
            <p className="landing-feature-desc">{feature.description}</p>
            {feature.link_url && (
              <a href={feature.link_url} className="landing-feature-link">
                {feature.link_text || "Learn more"} →
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsSection({ section, stats }: { section: LandingSection; stats: LandingStat[] }) {
  const sectionStats = stats.filter(s => s.section_id === section.id);

  return (
    <section className="landing-section landing-stats-section">
      {section.title && <div className="landing-section-eyebrow">{section.title}</div>}
      {section.subtitle && <h2 className="landing-section-title">{section.subtitle}</h2>}
      <div className="landing-stats-grid landing-stats-palantir">
        {sectionStats.map((stat) => (
          <div key={stat.id} className="landing-stat-item">
            <div className="landing-stat-value">{stat.value}</div>
            <div className="landing-stat-label">{stat.label}</div>
            {stat.description && <p className="landing-stat-description">{stat.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaSection({ cta, onCta }: { cta: LandingCta; onCta: () => void }) {
  const bgStyle = cta.background_type === "gradient"
    ? { background: cta.background_value }
    : cta.background_type === "solid"
    ? { backgroundColor: cta.background_value }
    : {};

  return (
    <section className="landing-section landing-footer-cta landing-cta-palantir-section" style={bgStyle}>
      <h2 className="landing-cta-headline landing-cta-headline-palantir">{cta.headline}</h2>
      {cta.description && <p className="landing-cta-subtext">{cta.description}</p>}
      <button onClick={onCta} className={`landing-cta-button landing-cta-${cta.button_style}-palantir`}>
        {cta.button_text}
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </section>
  );
}

/* ── Main Component ── */
export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch CMS content on mount
  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch("/api/landing-content");
        if (!res.ok) throw new Error("Failed to fetch landing content");
        const data = await res.json();
        setContent(data);
      } catch (err) {
        console.error("[LandingPage] Failed to fetch content:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const openModal = useCallback(() => setShowModal(true), []);

  // Navigation links from CMS or fallback
  const navLinks = content?.nav_links || [];
  const sections = content?.sections || [];
  const hero = content?.hero;
  const valueProps = content?.value_props || [];
  const features = content?.features || [];
  const stats = content?.stats || [];
  const ctas = content?.ctas || [];

  // Loading state
  if (loading) {
    return (
      <div className="landing-page" style={{ background: "var(--surface-app)", color: "var(--text-primary)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="landing-loading">
          <div className="landing-loading-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Error state with fallback
  if (error && !content) {
    return (
      <div className="landing-page" style={{ background: "var(--surface-app)", color: "var(--text-primary)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="landing-error">
          <p>Unable to load content. Please refresh the page.</p>
          <button onClick={() => window.location.reload()} className="landing-cta-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-page landing-palantir" style={{ background: "var(--surface-app)", color: "var(--text-primary)" }}>

      {/* ═══ Sticky Header ═══ */}
      <header className={`landing-header${scrolled ? " scrolled" : ""}`}>
        <div className="landing-header-left">
          {APP_LOGO && (
            <Image src={APP_LOGO} alt={APP_NAME || "Logo"} width={32} height={32} className="landing-header-logo" unoptimized />
          )}
          <span className="landing-header-name">{APP_NAME}</span>
        </div>
        <div className="landing-header-right">
          {/* Dynamic nav links */}
          {navLinks.filter(l => !l.is_button).map((link) => (
            <a key={link.id} href={link.url} className="landing-header-link">
              {link.label}
            </a>
          ))}
          <ThemeToggle />
          {/* CTA buttons from nav */}
          {navLinks.filter(l => l.is_button).map((link) => (
            <button
              key={link.id}
              onClick={openModal}
              className={`landing-header-cta ${link.button_style === "primary" ? "primary" : "secondary"}`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </header>

      {/* ═══ Hero Section ═══ */}
      <HeroSection hero={hero ?? null} onCta={openModal} />

      {/* ═══ Video (optional) ═══ */}
      {HERO_VIDEO_URL && (
        <section className="landing-section landing-video-section reveal-section">
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

      {/* ═══ Dynamic Sections ═══ */}
      {sections.map((section, index) => {
        switch (section.section_type) {
          case "hero":
            return null; // Hero rendered separately
          case "two_column":
            return (
              <TwoColumnSection
                key={section.id}
                section={section}
                valueProps={valueProps}
                index={index}
              />
            );
          case "cards":
            return (
              <FeaturesSection
                key={section.id}
                section={section}
                features={features}
              />
            );
          case "stats":
            return (
              <StatsSection
                key={section.id}
                section={section}
                stats={stats}
              />
            );
          case "cta":
            const cta = ctas.find(c => c.section_id === section.id);
            return cta ? (
              <CtaSection key={section.id} cta={cta} onCta={openModal} />
            ) : null;
          default:
            return null;
        }
      })}

      {/* ═══ Site Footer ═══ */}
      <Footer />

      {/* Smart login modal */}
      <ConnectModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
