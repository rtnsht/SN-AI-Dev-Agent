/**
 * Centralized branding configuration.
 * All values are configurable via NEXT_PUBLIC_ environment variables.
 * Defaults match the original branding.
 */

// ── App Identity ────────────────────────────────────────────────────────────
export const APP_NAME        = process.env.NEXT_PUBLIC_APP_NAME        || "";
export const APP_TAGLINE     = process.env.NEXT_PUBLIC_APP_TAGLINE     || "";
export const APP_SUBTITLE    = process.env.NEXT_PUBLIC_APP_SUBTITLE    || "";
export const APP_DESCRIPTION = process.env.NEXT_PUBLIC_APP_DESCRIPTION || "";
export const APP_LOGO        = process.env.NEXT_PUBLIC_APP_LOGO        || "";
export const APP_HERO_TAGLINE = process.env.NEXT_PUBLIC_HERO_TAGLINE   || "";
export const HERO_VIDEO_URL   = process.env.NEXT_PUBLIC_HERO_VIDEO_URL  || "";
export const CREATOR_NAME     = process.env.NEXT_PUBLIC_CREATOR_NAME     || "Ratnesh";
export const CREATOR_LINKEDIN = process.env.NEXT_PUBLIC_CREATOR_LINKEDIN || "https://www.linkedin.com/in/ratnesh-tiwari";
export const SHOW_INFO_BUTTON = process.env.NEXT_PUBLIC_SHOW_INFO_BUTTON !== "false"; // default: true

// ── Landing Mode ─────────────────────────────────────────────────────────────
// "home"    → new minimal home page with welcome intro modal
// "landing" → classic detailed marketing landing page (default)
export const LANDING_MODE = process.env.NEXT_PUBLIC_LANDING_MODE || "landing";

// ── Welcome Modal (shown on the home page) ───────────────────────────────────
export const WELCOME_TITLE    = process.env.NEXT_PUBLIC_WELCOME_TITLE    || "";
export const WELCOME_LINE_1   = process.env.NEXT_PUBLIC_WELCOME_LINE_1   || "Yantra is an AI-powered agent that builds ServiceNow solutions from plain-English descriptions — specs, designs, and deployable code, generated automatically.";
export const WELCOME_LINE_2   = process.env.NEXT_PUBLIC_WELCOME_LINE_2   || "You stay in full control — review and approve every spec, design, and code artifact at each phase before anything moves forward.";
export const WELCOME_LINE_3   = process.env.NEXT_PUBLIC_WELCOME_LINE_3   || "Every artifact is captured in a tracked update set with a full audit trail and rollback support — safe, transparent, production-ready development.";
// Falls back to HERO_VIDEO_URL if not set
export const WELCOME_VIDEO_URL = process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL || process.env.NEXT_PUBLIC_HERO_VIDEO_URL || "";

// ── Landing Page Section Text (all configurable via env vars) ────────────────
export const FEATURES_EYEBROW = process.env.NEXT_PUBLIC_FEATURES_EYEBROW || "Capabilities";
export const FEATURES_TITLE   = process.env.NEXT_PUBLIC_FEATURES_TITLE   || "Everything you need to ship on ServiceNow";
export const STEPS_EYEBROW    = process.env.NEXT_PUBLIC_STEPS_EYEBROW    || "Workflow";
export const STEPS_TITLE      = process.env.NEXT_PUBLIC_STEPS_TITLE      || "Three steps from idea to development";
export const HIGHLIGHT_TITLE  = process.env.NEXT_PUBLIC_HIGHLIGHT_TITLE  || "Built for ServiceNow teams. Phase-gated by design.";
export const HIGHLIGHT_DESC   = process.env.NEXT_PUBLIC_HIGHLIGHT_DESC   || "Full audit trail. Update set capture. Rollback support. Every artifact is traceable, every decision is documented, every deployment is reversible.";
export const CTA_HEADLINE     = process.env.NEXT_PUBLIC_CTA_HEADLINE     || "Your next build starts here.";
export const CTA_SUBTEXT      = process.env.NEXT_PUBLIC_CTA_SUBTEXT      || "Go from idea to a working ServiceNow solution — in minutes, not sprints.";

// ── Trust Bar Items (pipe-delimited: "Value|Label") ─────────────────────────
function parseTrustItem(raw: string | undefined, fallback: { value: string; label: string }): { value: string; label: string } {
  if (!raw) return fallback;
  const [value, ...rest] = raw.split("|");
  const label = rest.join("|");
  if (!value?.trim() || !label?.trim()) return fallback;
  return { value: value.trim(), label: label.trim() };
}

export const TRUST_ITEMS: { value: string; label: string }[] = [
  parseTrustItem(process.env.NEXT_PUBLIC_TRUST_ITEM_1, { value: "100%", label: "Auditable" }),
  parseTrustItem(process.env.NEXT_PUBLIC_TRUST_ITEM_2, { value: "Zero", label: "Black-box decisions" }),
  parseTrustItem(process.env.NEXT_PUBLIC_TRUST_ITEM_3, { value: "Safe", label: "Rollback ready" }),
  parseTrustItem(process.env.NEXT_PUBLIC_TRUST_ITEM_4, { value: "SDLC", label: "Phase-gated" }),
];

// ── Landing Page Feature Pills ──────────────────────────────────────────────
// Format: "Title|Description" — parsed into { title, desc }
function parseFeaturePill(raw: string | undefined): { title: string; desc: string } | null {
  if (!raw) return null;
  const [title, ...rest] = raw.split("|");
  const desc = rest.join("|"); // rejoin in case desc contains |
  if (!title?.trim() || !desc?.trim()) return null;
  return { title: title.trim(), desc: desc.trim() };
}

export const HERO_FEATURES: { title: string; desc: string }[] = [
  parseFeaturePill(process.env.NEXT_PUBLIC_HERO_FEATURE_1),
  parseFeaturePill(process.env.NEXT_PUBLIC_HERO_FEATURE_2),
  parseFeaturePill(process.env.NEXT_PUBLIC_HERO_FEATURE_3),
].filter((f): f is { title: string; desc: string } => f !== null);

// ── Color Presets ───────────────────────────────────────────────────────────
// Env vars accept a preset name (blue, purple, green, teal, red, orange, indigo)
// or a raw hex color (e.g. "#2563eb"). If hex, a lighter hover variant is auto-derived.

interface ColorSet {
  primary: string;      // solid button / avatar background
  primaryHover: string; // hover state
  accentFrom: string;   // AI avatar gradient start
  accentTo: string;     // AI avatar gradient end
}

// Dark-mode presets (desaturated, bright on dark backgrounds)
const COLOR_PRESETS_DARK: Record<string, ColorSet> = {
  blue:   { primary: "#4C7DFF", primaryHover: "#6B93FF", accentFrom: "#a855f7", accentTo: "#4C7DFF" },
  purple: { primary: "#9333ea", primaryHover: "#a855f7", accentFrom: "#ec4899", accentTo: "#9333ea" },
  green:  { primary: "#38C976", primaryHover: "#4ADE80", accentFrom: "#14b8a6", accentTo: "#38C976" },
  teal:   { primary: "#0d9488", primaryHover: "#14b8a6", accentFrom: "#06b6d4", accentTo: "#0d9488" },
  red:    { primary: "#F97373", primaryHover: "#FCA5A5", accentFrom: "#f97316", accentTo: "#F97373" },
  orange: { primary: "#ea580c", primaryHover: "#f97316", accentFrom: "#eab308", accentTo: "#ea580c" },
  indigo: { primary: "#4f46e5", primaryHover: "#6366f1", accentFrom: "#a855f7", accentTo: "#4f46e5" },
};

// Light-mode presets (deeper/richer for contrast on white backgrounds)
const COLOR_PRESETS_LIGHT: Record<string, ColorSet> = {
  blue:   { primary: "#2E5FE0", primaryHover: "#4A78F0", accentFrom: "#7C3AED", accentTo: "#2E5FE0" },
  purple: { primary: "#7C3AED", primaryHover: "#8B5CF6", accentFrom: "#DB2777", accentTo: "#7C3AED" },
  green:  { primary: "#1A9B50", primaryHover: "#22C55E", accentFrom: "#0D9488", accentTo: "#1A9B50" },
  teal:   { primary: "#0F766E", primaryHover: "#0D9488", accentFrom: "#0891B2", accentTo: "#0F766E" },
  red:    { primary: "#D93636", primaryHover: "#EF4444", accentFrom: "#EA580C", accentTo: "#D93636" },
  orange: { primary: "#C2410C", primaryHover: "#EA580C", accentFrom: "#CA8A04", accentTo: "#C2410C" },
  indigo: { primary: "#4338CA", primaryHover: "#4F46E5", accentFrom: "#7C3AED", accentTo: "#4338CA" },
};

/** Lighten a hex color by ~20% for hover states */
function lightenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lighten = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.2));
  return `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
}

/** Darken a hex color by ~15% for light-mode variants */
function darkenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (v: number) => Math.max(0, Math.round(v * 0.85));
  return `#${darken(r).toString(16).padStart(2, "0")}${darken(g).toString(16).padStart(2, "0")}${darken(b).toString(16).padStart(2, "0")}`;
}

function resolveColor(envVar: string | undefined, defaultPreset: string, presets: Record<string, ColorSet>): ColorSet {
  const val = envVar?.trim();
  if (!val) return presets[defaultPreset];
  if (presets[val.toLowerCase()]) return presets[val.toLowerCase()];
  // Treat as hex — for dark presets lighten hover, for light presets darken
  if (val.startsWith("#") && (val.length === 7 || val.length === 4)) {
    const isLight = presets === COLOR_PRESETS_LIGHT;
    return {
      primary: isLight ? darkenHex(val) : val,
      primaryHover: isLight ? val : lightenHex(val),
      accentFrom: isLight ? darkenHex(val) : val,
      accentTo: isLight ? darkenHex(val) : val,
    };
  }
  return presets[defaultPreset];
}

const primaryEnv = process.env.NEXT_PUBLIC_PRIMARY_COLOR;
const accentEnv  = process.env.NEXT_PUBLIC_ACCENT_COLOR;

// Resolve for both themes
const darkPrimary  = resolveColor(primaryEnv, "blue", COLOR_PRESETS_DARK);
const darkAccent   = resolveColor(accentEnv, "purple", COLOR_PRESETS_DARK);
const lightPrimary = resolveColor(primaryEnv, "blue", COLOR_PRESETS_LIGHT);
const lightAccent  = resolveColor(accentEnv, "purple", COLOR_PRESETS_LIGHT);

/** Branding color vars for dark mode */
export const BRAND_COLORS_DARK: Record<string, string> = {
  "--color-primary":       darkPrimary.primary,
  "--color-primary-hover":  darkPrimary.primaryHover,
  "--color-accent-from":   darkAccent.accentFrom || darkAccent.primary,
  "--color-accent-to":     darkPrimary.primary,
};

/** Branding color vars for light mode */
export const BRAND_COLORS_LIGHT: Record<string, string> = {
  "--color-primary":       lightPrimary.primary,
  "--color-primary-hover":  lightPrimary.primaryHover,
  "--color-accent-from":   lightAccent.accentFrom || lightAccent.primary,
  "--color-accent-to":     lightPrimary.primary,
};

/**
 * CSS custom property values to inject on <html>.
 * No longer includes branding colors — those are managed by ThemeProvider
 * to avoid inline style specificity conflicts between dark/light modes.
 */
export const CSS_VARS: Record<string, string> = {};

