import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/session-auth";
import { getSupabase } from "@/lib/supabase";
import { ensureWorkspaceProvisioned, resolveHierarchySettings } from "@/lib/workspace";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  const auth = await requireUserSession(request);
  if (!auth.ok) return auth.response;

  const context = await ensureWorkspaceProvisioned(auth.session.user.id);
  return NextResponse.json({
    workspace: context.workspace,
    space: context.space,
    project: context.project,
    effectiveSettings: resolveHierarchySettings(context),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUserSession(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const context = await ensureWorkspaceProvisioned(auth.session.user.id);
  if (!context.workspace.id || !context.space.id || !context.project.id) {
    return NextResponse.json(
      { error: "Workspace persistence is unavailable until the workspace migrations are applied." },
      { status: 503 }
    );
  }
  const db = getSupabase();
  const now = new Date().toISOString();

  if ("workspace" in body && body.workspace !== undefined) {
    if (!isPlainObject(body.workspace)) {
      return NextResponse.json({ error: "workspace must be an object" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: now };
    if ("name" in body.workspace) {
      if (typeof body.workspace.name !== "string" || !body.workspace.name.trim()) {
        return NextResponse.json({ error: "workspace.name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.workspace.name.trim();
    }
    if ("settings" in body.workspace) {
      if (!isPlainObject(body.workspace.settings)) {
        return NextResponse.json({ error: "workspace.settings must be an object" }, { status: 400 });
      }
      updates.settings = body.workspace.settings;
    }

    const { error } = await db.from("workspaces").update(updates).eq("id", context.workspace.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if ("space" in body && body.space !== undefined) {
    if (!isPlainObject(body.space)) {
      return NextResponse.json({ error: "space must be an object" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: now };
    if ("name" in body.space) {
      if (typeof body.space.name !== "string" || !body.space.name.trim()) {
        return NextResponse.json({ error: "space.name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.space.name.trim();
    }
    if ("settings" in body.space) {
      if (!isPlainObject(body.space.settings)) {
        return NextResponse.json({ error: "space.settings must be an object" }, { status: 400 });
      }
      updates.settings = body.space.settings;
    }

    const { error } = await db.from("spaces").update(updates).eq("id", context.space.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if ("project" in body && body.project !== undefined) {
    if (!isPlainObject(body.project)) {
      return NextResponse.json({ error: "project must be an object" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: now };
    if ("name" in body.project) {
      if (typeof body.project.name !== "string" || !body.project.name.trim()) {
        return NextResponse.json({ error: "project.name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.project.name.trim();
    }
    if ("description" in body.project) {
      if (body.project.description !== null && typeof body.project.description !== "string") {
        return NextResponse.json({ error: "project.description must be a string or null" }, { status: 400 });
      }
      updates.description = body.project.description;
    }
    if ("settings" in body.project) {
      if (!isPlainObject(body.project.settings)) {
        return NextResponse.json({ error: "project.settings must be an object" }, { status: 400 });
      }
      updates.settings = body.project.settings;
    }

    const { error } = await db.from("projects").update(updates).eq("id", context.project.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const refreshed = await ensureWorkspaceProvisioned(auth.session.user.id);
  return NextResponse.json({
    workspace: refreshed.workspace,
    space: refreshed.space,
    project: refreshed.project,
    effectiveSettings: resolveHierarchySettings(refreshed),
  });
}
