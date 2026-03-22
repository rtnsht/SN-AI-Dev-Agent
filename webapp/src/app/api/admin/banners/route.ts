import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sanitizeBannerHtml } from "@/lib/sanitize-html";
import { requireAdmin } from "@/lib/admin-auth";
import { parseBannerCreateBody } from "@/lib/request-validation";

/** GET /api/admin/banners — list all banners */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("banners")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ banners: data || [] });
  } catch (err) {
    console.error("[admin/banners] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch banners" }, { status: 500 });
  }
}

/** POST /api/admin/banners — create a new banner */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const parsed = parseBannerCreateBody(await request.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { title, content_html, pages, bg_color, text_color, variant, start_at, end_at } = parsed.data;

    const db = getSupabase();
    const sanitizedHtml = sanitizeBannerHtml(content_html.trim());

    // Build the insert payload; only include variant if the column exists
    const payload: Record<string, unknown> = {
      title: title.trim(),
      content_html: sanitizedHtml,
      pages: pages && pages.length > 0 ? pages : ["all"],
      bg_color: bg_color || "#1e40af",
      text_color: text_color || "#ffffff",
      start_at: start_at || null,
      end_at: end_at || null,
      created_by: auth.session.user.id,
    };
    if (variant) payload.variant = variant;

    const { data, error } = await db
      .from("banners")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ banner: data });
  } catch (err) {
    console.error("[admin/banners] POST error:", err);
    return NextResponse.json({ error: "Failed to create banner" }, { status: 500 });
  }
}
