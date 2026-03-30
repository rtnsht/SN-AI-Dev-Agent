import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";

interface ModelConfigRow {
  id: string;
  label: string;
  model_key: string;
  display_provider: string | null;
  transport: string | null;
  enabled: boolean | null;
  is_default: boolean | null;
  is_server_free: boolean | null;
  is_free: boolean | null;
  context_window: number | null;
  input_cost_per_1m: number | null;
  output_cost_per_1m: number | null;
  model_class: string | null;
  speed_tier: string | null;
  cost_tier: string | null;
  thinking_mode_supported: boolean | null;
}

interface RuleRow {
  id: string;
  model_config_id: string;
  scope: "all_users" | "specific_users";
  daily_request_limit: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RuleUserRow {
  rule_id: string;
  user_id: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  status: string;
}

function parseBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function parseNullableInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return undefined;
}

function parseUserIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const db = getSupabase();
    const [{ data: modelsData }, { data: rulesData }, { data: ruleUsersData }, { data: usersData }] = await Promise.all([
      db
        .from("model_config")
        .select("id, label, model_key, display_provider, transport, enabled, is_default, is_server_free, is_free, context_window, input_cost_per_1m, output_cost_per_1m, model_class, speed_tier, cost_tier, thinking_mode_supported")
        .order("display_order", { ascending: true }),
      db
        .from("admin_free_model_rules")
        .select("id, model_config_id, scope, daily_request_limit, is_active, created_at, updated_at")
        .order("created_at", { ascending: false }),
      db
        .from("admin_free_model_rule_users")
        .select("rule_id, user_id"),
      db
        .from("users")
        .select("id, email, name, status")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

    const models = (modelsData as ModelConfigRow[] | null) ?? [];
    const rules = (rulesData as RuleRow[] | null) ?? [];
    const ruleUsers = (ruleUsersData as RuleUserRow[] | null) ?? [];
    const users = (usersData as UserRow[] | null) ?? [];

    const modelMap = new Map(models.map((model) => [model.id, model]));
    const userMap = new Map(users.map((user) => [user.id, user]));
    const assignedUsersByRule = new Map<string, UserRow[]>();

    for (const row of ruleUsers) {
      const existing = assignedUsersByRule.get(row.rule_id) || [];
      const user = userMap.get(row.user_id);
      if (user) existing.push(user);
      assignedUsersByRule.set(row.rule_id, existing);
    }

    return NextResponse.json({
      models,
      rules: rules.map((rule) => ({
        ...rule,
        model_label: modelMap.get(rule.model_config_id)?.label || "Unknown model",
        model_key: modelMap.get(rule.model_config_id)?.model_key || "",
        assigned_users: assignedUsersByRule.get(rule.id) || [],
      })),
      availableUsers: users,
    });
  } catch (error) {
    console.error("[admin/model-platform] GET error:", error);
    return NextResponse.json({ error: "Failed to load model platform settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const db = getSupabase();
    const timestamp = new Date().toISOString();

    if (action === "update_model") {
      const modelId = typeof body.modelId === "string" ? body.modelId : "";
      if (!modelId) {
        return NextResponse.json({ error: "modelId is required" }, { status: 400 });
      }

      const enabled = parseBoolean(body.enabled);
      const isServerFree = parseBoolean(body.isServerFree);
      const isDefault = parseBoolean(body.isDefault);

      if (enabled === undefined && isServerFree === undefined && isDefault === undefined) {
        return NextResponse.json({ error: "At least one model setting is required" }, { status: 400 });
      }

      if (isDefault === true) {
        await db
          .from("model_config")
          .update({ is_default: false, updated_at: timestamp })
          .neq("id", modelId);
      }

      const updates: Record<string, unknown> = { updated_at: timestamp };
      if (enabled !== undefined) updates.enabled = enabled;
      if (isServerFree !== undefined) updates.is_server_free = isServerFree;
      if (isDefault !== undefined) updates.is_default = isDefault;

      const { data, error } = await db
        .from("model_config")
        .update(updates)
        .eq("id", modelId)
        .select("id, label, model_key, display_provider, transport, enabled, is_default, is_server_free, is_free, context_window, input_cost_per_1m, output_cost_per_1m, model_class, speed_tier, cost_tier, thinking_mode_supported")
        .single();

      if (error) throw error;
      return NextResponse.json({ model: data });
    }

    if (action === "create_rule") {
      const modelConfigId = typeof body.modelConfigId === "string" ? body.modelConfigId : "";
      const scope =
        body.scope === "all_users" || body.scope === "specific_users"
          ? body.scope
          : null;
      const dailyRequestLimit = parseNullableInteger(body.dailyRequestLimit);
      const isActive = parseBoolean(body.isActive);
      const userIds = parseUserIds(body.userIds) || [];

      if (!modelConfigId || !scope || dailyRequestLimit === undefined) {
        return NextResponse.json({ error: "modelConfigId, scope, and a valid dailyRequestLimit are required" }, { status: 400 });
      }

      if (scope === "specific_users" && userIds.length === 0) {
        return NextResponse.json({ error: "Select at least one user for a specific-user rule" }, { status: 400 });
      }

      const { data: rule, error: ruleError } = await db
        .from("admin_free_model_rules")
        .insert({
          model_config_id: modelConfigId,
          scope,
          daily_request_limit: dailyRequestLimit,
          is_active: isActive ?? true,
          updated_at: timestamp,
        })
        .select("id, model_config_id, scope, daily_request_limit, is_active, created_at, updated_at")
        .single();

      if (ruleError || !rule) throw ruleError;

      if (scope === "specific_users" && userIds.length > 0) {
        const inserts = userIds.map((userId) => ({ rule_id: rule.id, user_id: userId }));
        const { error: assignmentError } = await db
          .from("admin_free_model_rule_users")
          .insert(inserts);

        if (assignmentError) throw assignmentError;
      }

      return NextResponse.json({ rule }, { status: 201 });
    }

    if (action === "update_rule") {
      const ruleId = typeof body.ruleId === "string" ? body.ruleId : "";
      if (!ruleId) {
        return NextResponse.json({ error: "ruleId is required" }, { status: 400 });
      }

      const scope =
        body.scope === undefined
          ? undefined
          : body.scope === "all_users" || body.scope === "specific_users"
            ? body.scope
            : null;
      const dailyLimitProvided = body.dailyRequestLimit !== undefined;
      const dailyRequestLimit = body.dailyRequestLimit === undefined
        ? undefined
        : parseNullableInteger(body.dailyRequestLimit);
      const isActive = parseBoolean(body.isActive);
      const userIds = parseUserIds(body.userIds);

      if (scope === null || (dailyLimitProvided && dailyRequestLimit === undefined)) {
        return NextResponse.json({ error: "Invalid rule update payload" }, { status: 400 });
      }

      const updates: Record<string, unknown> = { updated_at: timestamp };
      if (scope !== undefined) updates.scope = scope;
      if (dailyRequestLimit !== undefined) updates.daily_request_limit = dailyRequestLimit;
      if (isActive !== undefined) updates.is_active = isActive;

      const { data: rule, error: ruleError } = await db
        .from("admin_free_model_rules")
        .update(updates)
        .eq("id", ruleId)
        .select("id, model_config_id, scope, daily_request_limit, is_active, created_at, updated_at")
        .single();

      if (ruleError || !rule) throw ruleError;

      if (scope === "specific_users" || userIds !== undefined) {
        await db
          .from("admin_free_model_rule_users")
          .delete()
          .eq("rule_id", ruleId);

        const effectiveScope = scope ?? rule.scope;
        const effectiveUserIds = userIds || [];
        if (effectiveScope === "specific_users" && effectiveUserIds.length > 0) {
          const inserts = effectiveUserIds.map((userId) => ({ rule_id: ruleId, user_id: userId }));
          const { error: assignmentError } = await db
            .from("admin_free_model_rule_users")
            .insert(inserts);

          if (assignmentError) throw assignmentError;
        }
      }

      return NextResponse.json({ rule });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("[admin/model-platform] POST error:", error);
    return NextResponse.json({ error: "Failed to save model platform settings" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get("ruleId");
    if (!ruleId) {
      return NextResponse.json({ error: "ruleId is required" }, { status: 400 });
    }

    const db = getSupabase();
    const { error } = await db
      .from("admin_free_model_rules")
      .delete()
      .eq("id", ruleId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/model-platform] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete model rule" }, { status: 500 });
  }
}
