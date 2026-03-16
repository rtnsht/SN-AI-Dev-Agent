import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** GET /api/admin/trials — list global config, all overrides, and usage stats */
export async function GET() {
  try {
    const db = getSupabase();

    // Global config
    const { data: globalConfig } = await db
      .from("trial_config")
      .select("*")
      .eq("scope", "global")
      .single();

    // All overrides
    const { data: overrides } = await db
      .from("trial_config")
      .select("*")
      .neq("scope", "global")
      .order("created_at", { ascending: false });

    // Usage stats: join request_log with users + trial_start
    const { data: usageData } = await db
      .from("request_log")
      .select("user_id, request_date, request_count");

    const { data: trialStarts } = await db
      .from("trial_start")
      .select("user_id, started_at");

    const { data: users } = await db
      .from("users")
      .select("id, email, name");

    // Build per-user stats
    const userMap = new Map<string, { email: string; name: string }>();
    for (const u of users || []) {
      userMap.set(u.id, { email: u.email, name: u.name });
    }

    const trialStartMap = new Map<string, string>();
    for (const ts of trialStarts || []) {
      trialStartMap.set(ts.user_id, ts.started_at);
    }

    const today = new Date().toISOString().split("T")[0];
    const usageByUser = new Map<string, { todayUsed: number; totalUsed: number }>();
    for (const row of usageData || []) {
      const existing = usageByUser.get(row.user_id) || { todayUsed: 0, totalUsed: 0 };
      existing.totalUsed += row.request_count || 0;
      if (row.request_date === today) {
        existing.todayUsed = row.request_count || 0;
      }
      usageByUser.set(row.user_id, existing);
    }

    const trialDays = globalConfig?.trial_days || 10;
    const now = new Date();

    const usageStats = Array.from(usageByUser.entries()).map(([userId, usage]) => {
      const user = userMap.get(userId);
      const startedAt = trialStartMap.get(userId);
      const daysSinceStart = startedAt
        ? Math.floor((now.getTime() - new Date(startedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        userId,
        email: user?.email || "unknown",
        name: user?.name || "unknown",
        trialStartDate: startedAt || null,
        daysRemaining: Math.max(0, trialDays - daysSinceStart),
        todayUsed: usage.todayUsed,
        totalUsed: usage.totalUsed,
      };
    });

    return NextResponse.json({
      globalConfig: globalConfig || null,
      overrides: overrides || [],
      usageStats,
    });
  } catch (err) {
    console.error("[admin/trials] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch trial config" }, { status: 500 });
  }
}

/** POST /api/admin/trials — create/update global config or add override */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scope, scope_value, daily_limit, trial_days, is_active } = body;

    if (!scope || !["global", "user", "instance"].includes(scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }
    if (scope !== "global" && !scope_value) {
      return NextResponse.json({ error: "scope_value required for non-global scope" }, { status: 400 });
    }
    if (typeof daily_limit !== "number" || daily_limit < 1) {
      return NextResponse.json({ error: "daily_limit must be a positive number" }, { status: 400 });
    }
    if (typeof trial_days !== "number" || trial_days < 1) {
      return NextResponse.json({ error: "trial_days must be a positive number" }, { status: 400 });
    }

    const db = getSupabase();

    if (scope === "global") {
      // Upsert global config
      const { data: existing } = await db
        .from("trial_config")
        .select("id")
        .eq("scope", "global")
        .single();

      if (existing) {
        const { data, error } = await db
          .from("trial_config")
          .update({
            daily_limit,
            trial_days,
            is_active: is_active !== false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ config: data });
      } else {
        const { data, error } = await db
          .from("trial_config")
          .insert({
            scope: "global",
            scope_value: null,
            daily_limit,
            trial_days,
            is_active: is_active !== false,
          })
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ config: data }, { status: 201 });
      }
    } else {
      // Insert/update override
      const { data: existing } = await db
        .from("trial_config")
        .select("id")
        .eq("scope", scope)
        .eq("scope_value", scope_value)
        .single();

      if (existing) {
        const { data, error } = await db
          .from("trial_config")
          .update({
            daily_limit,
            trial_days,
            is_active: is_active !== false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ config: data });
      } else {
        const { data, error } = await db
          .from("trial_config")
          .insert({
            scope,
            scope_value,
            daily_limit,
            trial_days,
            is_active: is_active !== false,
          })
          .select("*")
          .single();

        if (error) throw error;
        return NextResponse.json({ config: data }, { status: 201 });
      }
    }
  } catch (err) {
    console.error("[admin/trials] POST error:", err);
    return NextResponse.json({ error: "Failed to save trial config" }, { status: 500 });
  }
}

/** DELETE /api/admin/trials — remove an override by id */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    const db = getSupabase();

    // Don't allow deleting the global config
    const { data: config } = await db
      .from("trial_config")
      .select("scope")
      .eq("id", id)
      .single();

    if (config?.scope === "global") {
      return NextResponse.json({ error: "Cannot delete global config. Disable it instead." }, { status: 400 });
    }

    const { error } = await db
      .from("trial_config")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/trials] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete trial config" }, { status: 500 });
  }
}
