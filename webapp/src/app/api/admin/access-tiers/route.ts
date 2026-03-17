import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { invalidateTierCache } from "@/lib/access-tier";

/**
 * GET /api/admin/access-tiers — return current tier limits and usage stats
 */
export async function GET() {
  try {
    const db = getSupabase();

    // Get tier config
    const { data: config } = await db
      .from("access_tier_config")
      .select("*")
      .single();

    const today = new Date().toISOString().split("T")[0];

    // Authenticated usage (from request_log)
    const { data: usageData } = await db
      .from("request_log")
      .select("user_id, request_date, request_count")
      .eq("request_date", today);

    // Anonymous usage (from anon_request_log)
    const { data: anonData } = await db
      .from("anon_request_log")
      .select("ip_address, instance_url, request_date, request_count")
      .eq("request_date", today);

    // Get users for enrichment
    const { data: users } = await db.from("users").select("id, email, name");
    const userMap = new Map<string, { email: string; name: string }>();
    for (const u of users || []) userMap.set(u.id, { email: u.email, name: u.name });

    const todayUsage = (usageData || []).map((row) => ({
      userId: row.user_id,
      email: userMap.get(row.user_id)?.email || "unknown",
      name: userMap.get(row.user_id)?.name || "unknown",
      requestCount: row.request_count || 0,
    }));

    const todayAnonUsage = (anonData || []).map((row) => ({
      ipAddress: row.ip_address,
      instanceUrl: row.instance_url,
      requestCount: row.request_count || 0,
    }));

    return NextResponse.json({
      config: config || { anon_daily_limit: 10, auth_daily_limit: 20 },
      todayUsage,
      todayAnonUsage,
    });
  } catch (err) {
    console.error("[admin/access-tiers] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch access tier config" }, { status: 500 });
  }
}

/**
 * POST /api/admin/access-tiers — update tier limits
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anon_daily_limit, auth_daily_limit } = body;

    if (typeof anon_daily_limit !== "number" || anon_daily_limit < 1) {
      return NextResponse.json({ error: "anon_daily_limit must be a positive number" }, { status: 400 });
    }
    if (typeof auth_daily_limit !== "number" || auth_daily_limit < 1) {
      return NextResponse.json({ error: "auth_daily_limit must be a positive number" }, { status: 400 });
    }

    const db = getSupabase();

    // Upsert the single row
    const { data: existing } = await db
      .from("access_tier_config")
      .select("id")
      .single();

    let result;
    if (existing) {
      const { data, error } = await db
        .from("access_tier_config")
        .update({
          anon_daily_limit,
          auth_daily_limit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await db
        .from("access_tier_config")
        .insert({ anon_daily_limit, auth_daily_limit })
        .select("*")
        .single();
      if (error) throw error;
      result = data;
    }

    // Invalidate cache so next request picks up new limits
    invalidateTierCache();

    return NextResponse.json({ config: result });
  } catch (err) {
    console.error("[admin/access-tiers] POST error:", err);
    return NextResponse.json({ error: "Failed to update access tier config" }, { status: 500 });
  }
}
