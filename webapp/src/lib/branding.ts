/**
 * Centralized branding configuration.
 * All values are configurable via NEXT_PUBLIC_ environment variables.
 * Defaults match the original Yantra branding.
 */

// ── App Identity ────────────────────────────────────────────────────────────
export const APP_NAME        = process.env.NEXT_PUBLIC_APP_NAME        || "Yantra - AI Dev Agent - SN";
export const APP_TAGLINE     = process.env.NEXT_PUBLIC_APP_TAGLINE     || "Say it. Ship it.";
export const APP_SUBTITLE    = process.env.NEXT_PUBLIC_APP_SUBTITLE    || "Spec-driven \u00b7 Human-approved \u00b7 AI-powered";
export const APP_DESCRIPTION = process.env.NEXT_PUBLIC_APP_DESCRIPTION || "Say it. Ship it. — Spec-driven. Human-approved. AI-powered ServiceNow development.";
export const APP_LOGO        = process.env.NEXT_PUBLIC_APP_LOGO        || "/yantra-logo.png";
export const SHOW_INFO_BUTTON = process.env.NEXT_PUBLIC_SHOW_INFO_BUTTON !== "false"; // default: true

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

