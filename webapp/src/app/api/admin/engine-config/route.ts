import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { parseEngineConfigBody } from "@/lib/request-validation";
import { invalidateEngineConfigCache } from "@/lib/sn-engine";

/**
 * GET /api/admin/engine-config — return all engine config key-value pairs
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const db = getSupabase();
    const { data, error } = await db.from("engine_config").select("key, value, description, updated_at");
    if (error) throw error;

    const configs: Record<string, unknown> = {};
    for (const row of data || []) configs[row.key] = row.value;

    return NextResponse.json({ configs, rows: data || [] });
  } catch (err) {
    console.error("[admin/engine-config] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch engine config" }, { status: 500 });
  }
}

/**
 * POST /api/admin/engine-config — upsert a single config key
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const parsed = parseEngineConfigBody(await request.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { key, value } = parsed.data;

    const db = getSupabase();

    const { data: existing } = await db.from("engine_config").select("value").eq("key", key).single();
    const oldValue = existing?.value;

    const { data, error } = await db
      .from("engine_config")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
      .select("key, value, updated_at")
      .single();
    if (error) throw error;

    invalidateEngineConfigCache();

    console.log(JSON.stringify({
      audit: "engine_config_change",
      user: auth.session.user.email,
      key,
      oldValue,
      newValue: value,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ config: data });
  } catch (err) {
    console.error("[admin/engine-config] POST error:", err);
    return NextResponse.json({ error: "Failed to update engine config" }, { status: 500 });
  }
}
