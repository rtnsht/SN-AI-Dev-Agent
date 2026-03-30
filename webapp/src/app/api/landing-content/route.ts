/**
 * Landing Page Content API
 * Fetches all landing page content from the database in a single optimized request.
 * 
 * GET /api/landing-content
 * Returns: sections, hero, value_props, features, stats, ctas, nav links, footer links, theme config
 * 
 * Security: Public read access (no auth required) - matches RLS policies on landing tables
 * Caching: Edge-cached for 60 seconds
 */

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60; // Cache for 60 seconds

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

interface LandingFooterLink {
  id: string;
  category: string;
  label: string;
  url: string;
  display_order: number;
  is_visible: boolean;
}

interface LandingThemeConfig {
  id: string;
  theme_mode: string;
  bg_primary: string;
  bg_secondary: string;
  bg_elevated: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  accent_primary: string;
  accent_primary_hover: string | null;
  accent_secondary: string | null;
  border_color: string | null;
  shadow_value: string | null;
  font_family: string;
  headline_hero: string;
  headline_section: string;
  body_large: string;
  body: string;
  is_active: boolean;
}

interface LandingMedia {
  id: string;
  media_key: string;
  media_type: string;
  storage_source: string | null;
  storage_path: string | null;
  external_url: string | null;
  alt_text: string;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  file_size: number | null;
  variants: Record<string, string>;
  title: string | null;
  description: string | null;
  is_active: boolean;
}

interface LandingContentResponse {
  sections: LandingSection[];
  hero: LandingHero | null;
  value_props: LandingValueProp[];
  features: LandingFeature[];
  stats: LandingStat[];
  ctas: LandingCta[];
  nav_links: LandingNavLink[];
  footer_links: LandingFooterLink[];
  theme_config: {
    dark: LandingThemeConfig | null;
    light: LandingThemeConfig | null;
  };
  media: LandingMedia[];
}

export async function GET() {
  try {
    const supabase = getSupabase();

    // Fetch all content in parallel for optimal performance
    const [
      sectionsResult,
      heroResult,
      valuePropsResult,
      featuresResult,
      statsResult,
      ctasResult,
      navLinksResult,
      footerLinksResult,
      themeConfigResult,
      mediaResult,
    ] = await Promise.all([
      // Sections - ordered by display_order
      supabase
        .from("landing_sections")
        .select("*")
        .eq("is_visible", true)
        .order("display_order", { ascending: true }),

      // Hero - only active one
      supabase
        .from("landing_hero")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single(),

      // Value Props - ordered by display_order
      supabase
        .from("landing_value_props")
        .select("*")
        .eq("is_visible", true)
        .order("display_order", { ascending: true }),

      // Features - ordered by display_order
      supabase
        .from("landing_features")
        .select("*")
        .eq("is_visible", true)
        .order("display_order", { ascending: true }),

      // Stats - ordered by display_order
      supabase
        .from("landing_stats")
        .select("*")
        .eq("is_visible", true)
        .order("display_order", { ascending: true }),

      // CTAs - ordered by display_order
      supabase
        .from("landing_ctas")
        .select("*")
        .eq("is_visible", true)
        .order("display_order", { ascending: true }),

      // Nav Links - ordered by display_order
      supabase
        .from("landing_nav_links")
        .select("*")
        .eq("is_visible", true)
        .order("display_order", { ascending: true }),

      // Footer Links - ordered by category, then display_order
      supabase
        .from("landing_footer_links")
        .select("*")
        .eq("is_visible", true)
        .order("category", { ascending: true })
        .order("display_order", { ascending: true }),

      // Theme Config - both light and dark
      supabase.from("landing_theme_config").select("*").eq("is_active", true),

      // Media - active items only
      supabase
        .from("landing_media")
        .select("*")
        .eq("is_active", true),
    ]);

    // Check for errors (but allow empty results for optional content)
    const errors: string[] = [];
    if (sectionsResult.error && sectionsResult.error.code !== "PGRST116") {
      errors.push(`Sections: ${sectionsResult.error.message}`);
    }
    if (heroResult.error && heroResult.error.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine for optional content
      errors.push(`Hero: ${heroResult.error.message}`);
    }
    if (valuePropsResult.error && valuePropsResult.error.code !== "PGRST116") {
      errors.push(`Value Props: ${valuePropsResult.error.message}`);
    }
    if (featuresResult.error && featuresResult.error.code !== "PGRST116") {
      errors.push(`Features: ${featuresResult.error.message}`);
    }
    if (statsResult.error && statsResult.error.code !== "PGRST116") {
      errors.push(`Stats: ${statsResult.error.message}`);
    }
    if (ctasResult.error && ctasResult.error.code !== "PGRST116") {
      errors.push(`CTAs: ${ctasResult.error.message}`);
    }
    if (navLinksResult.error && navLinksResult.error.code !== "PGRST116") {
      errors.push(`Nav Links: ${navLinksResult.error.message}`);
    }
    if (footerLinksResult.error && footerLinksResult.error.code !== "PGRST116") {
      errors.push(`Footer Links: ${footerLinksResult.error.message}`);
    }
    if (themeConfigResult.error && themeConfigResult.error.code !== "PGRST116") {
      errors.push(`Theme Config: ${themeConfigResult.error.message}`);
    }
    if (mediaResult.error && mediaResult.error.code !== "PGRST116") {
      errors.push(`Media: ${mediaResult.error.message}`);
    }

    if (errors.length > 0) {
      console.error("[landing-content] Database errors:", errors);
      return NextResponse.json(
        { error: "Failed to fetch some content", details: errors },
        { status: 500 }
      );
    }

    // Organize theme config by mode
    const themeConfigs = (themeConfigResult.data || []) as LandingThemeConfig[];
    const darkTheme = themeConfigs.find((t: LandingThemeConfig) => t.theme_mode === "dark") || null;
    const lightTheme = themeConfigs.find((t: LandingThemeConfig) => t.theme_mode === "light") || null;

    const response: LandingContentResponse = {
      sections: sectionsResult.data || [],
      hero: heroResult.data || null,
      value_props: valuePropsResult.data || [],
      features: featuresResult.data || [],
      stats: statsResult.data || [],
      ctas: ctasResult.data || [],
      nav_links: navLinksResult.data || [],
      footer_links: footerLinksResult.data || [],
      theme_config: {
        dark: darkTheme,
        light: lightTheme,
      },
      media: mediaResult.data || [],
    };

    return NextResponse.json(response, {
      headers: {
        // Cache at edge for 60 seconds
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[landing-content] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
