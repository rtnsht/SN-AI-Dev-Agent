/**
 * Landing Page CMS Admin API
 * Handles saving/updating all landing page content
 * 
 * POST /api/admin/landing-cms
 * 
 * Security: Admin role required
 * 
 * Expected payload:
 * {
 *   sections: LandingSection[],
 *   hero: LandingHero | null,
 *   features: LandingFeature[],
 *   stats: LandingStat[],
 *   ctas: LandingCta[],
 *   nav_links: LandingNavLink[],
 *   footer_links: LandingFooterLink[],
 *   theme_config: { dark: LandingThemeConfig | null, light: LandingThemeConfig | null },
 *   media: LandingMedia[]
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LandingContent {
  sections: any[];
  hero: any | null;
  features: any[];
  stats: any[];
  ctas: any[];
  nav_links: any[];
  footer_links: any[];
  theme_config: {
    dark: any | null;
    light: any | null;
  };
  media: any[];
}

export async function POST(request: Request) {
  try {
    // Verify admin role
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse the Bearer token
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const content: LandingContent = await request.json();

    // Helper function to upsert records
    const upsertRecords = async (table: string, records: any[]) => {
      if (records.length === 0) return { error: null };
      return await supabase.from(table).upsert(records, { onConflict: "id" });
    };

    // Save all content in parallel
    const results = await Promise.all([
      // Sections
      upsertRecords("landing_sections", content.sections),
      
      // Hero (only if exists)
      content.hero ? supabase.from("landing_hero").upsert(content.hero, { onConflict: "id" }) : Promise.resolve({ error: null }),
      
      // Features
      upsertRecords("landing_features", content.features),
      
      // Stats
      upsertRecords("landing_stats", content.stats),
      
      // CTAs
      upsertRecords("landing_ctas", content.ctas),
      
      // Nav Links
      upsertRecords("landing_nav_links", content.nav_links),
      
      // Footer Links
      upsertRecords("landing_footer_links", content.footer_links),
      
      // Theme Config
      ...(content.theme_config.dark ? [supabase.from("landing_theme_config").upsert(content.theme_config.dark, { onConflict: "theme_mode" })] : []),
      ...(content.theme_config.light ? [supabase.from("landing_theme_config").upsert(content.theme_config.light, { onConflict: "theme_mode" })] : []),
      
      // Media
      upsertRecords("landing_media", content.media),
    ]);

    // Check for errors
    const errors = results.map((r) => r.error).filter((e): e is NonNullable<typeof e> => e != null);
    if (errors.length > 0) {
      console.error("[landing-cms] Save errors:", errors);
      return NextResponse.json(
        { error: "Failed to save some content", details: errors.map((e) => e.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Content saved successfully",
    });

  } catch (error) {
    console.error("[landing-cms] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
