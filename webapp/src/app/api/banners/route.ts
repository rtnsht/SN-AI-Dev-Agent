import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isMissingColumnError } from "@/lib/db-errors";

/** GET /api/banners — fetch currently active banners (public, no auth) */
export async function GET() {
  try {
    const db = getSupabase();
    const now = new Date().toISOString();

    let data;
    const result = await db
      .from("banners")
      .select("id, content_html, pages, bg_color, text_color, variant, dismissible")
      .eq("is_active", true)
      .or(`start_at.is.null,start_at.lte.${now}`)
      .or(`end_at.is.null,end_at.gte.${now}`)
      .order("created_at", { ascending: false });

    if (result.error) {
      if (!isMissingColumnError(result.error)) {
        console.error("[banners] GET error:", result.error);
        throw result.error;
      }
      const fallback = await db
        .from("banners")
        .select("id, content_html, pages, bg_color, text_color")
        .eq("is_active", true)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`)
        .order("created_at", { ascending: false });
      if (fallback.error) throw fallback.error;
      data = fallback.data;
    } else {
      data = result.data;
    }

    return NextResponse.json({ banners: data || [] });
  } catch (err) {
    console.error("[banners] GET error:", err);
    return NextResponse.json({ banners: [] });
  }
}
