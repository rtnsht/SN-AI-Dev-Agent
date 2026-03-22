import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sanitizeBannerHtml } from "@/lib/sanitize-html";
import { requireAdmin } from "@/lib/admin-auth";
import { parseBannerPatchBody } from "@/lib/request-validation";

/** PATCH /api/admin/banners/:id — update banner (toggle active, edit, etc.) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const parsed = parseBannerPatchBody(await request.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const body = parsed.data;
    const db = getSupabase();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.action === "toggle") {
      // Toggle is_active
      const { data: existing } = await db.from("banners").select("is_active").eq("id", id).single();
      if (!existing) return NextResponse.json({ error: "Banner not found" }, { status: 404 });
      updates.is_active = !existing.is_active;
    } else {
      // Full update
      if (body.title !== undefined) updates.title = body.title;
      if (body.content_html !== undefined) updates.content_html = sanitizeBannerHtml(body.content_html);
      if (body.pages !== undefined) updates.pages = body.pages;
      if (body.bg_color !== undefined) updates.bg_color = body.bg_color;
      if (body.text_color !== undefined) updates.text_color = body.text_color;
      if (body.variant !== undefined) updates.variant = body.variant;
      if (body.dismissible !== undefined) updates.dismissible = body.dismissible;
      if (body.start_at !== undefined) updates.start_at = body.start_at || null;
      if (body.end_at !== undefined) updates.end_at = body.end_at || null;
      if (body.is_active !== undefined) updates.is_active = body.is_active;
    }

    const { error } = await db.from("banners").update(updates).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/banners] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update banner" }, { status: 500 });
  }
}

/** DELETE /api/admin/banners/:id — delete banner */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const db = getSupabase();

    const { error } = await db.from("banners").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/banners] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete banner" }, { status: 500 });
  }
}
