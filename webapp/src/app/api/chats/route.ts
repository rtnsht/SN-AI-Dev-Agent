import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/session-auth";
import { getSupabase } from "@/lib/supabase";
import {
  connectionBelongsToUser,
  ensureWorkspaceProvisioned,
  projectBelongsToUser,
} from "@/lib/workspace";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(req: NextRequest) {
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  await ensureWorkspaceProvisioned(auth.session.user.id);

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (projectId) {
    const allowed = await projectBelongsToUser(auth.session.user.id, projectId);
    if (!allowed) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  const db = getSupabase();
  let query = db
    .from("chats")
    .select("id, title, mode, active_tab_id, project_id, connection_id, settings, created_at, updated_at")
    .eq("user_id", auth.session.user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chats: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { title = "Untitled Chat", mode = "agent", project_id, connection_id, settings } = body;

  if (mode !== "agent" && mode !== "quick") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
  }

  if (settings !== undefined && !isPlainObject(settings)) {
    return NextResponse.json({ error: "settings must be an object" }, { status: 400 });
  }

  const context = await ensureWorkspaceProvisioned(auth.session.user.id);
  let resolvedProjectId = context.project.id;

  if (typeof project_id === "string" && project_id) {
    const allowed = await projectBelongsToUser(auth.session.user.id, project_id);
    if (!allowed) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    resolvedProjectId = project_id;
  }

  let resolvedConnectionId: string | null = null;
  if (typeof connection_id === "string" && connection_id) {
    const connection = await connectionBelongsToUser(auth.session.user.id, connection_id);
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    if (connection.project_id && connection.project_id !== resolvedProjectId) {
      return NextResponse.json(
        { error: "Connection belongs to a different project" },
        { status: 400 }
      );
    }

    if (!project_id && connection.project_id) {
      resolvedProjectId = connection.project_id;
    }

    resolvedConnectionId = connection.id;
  }

  const db = getSupabase();

  const { data, error } = await db
    .from("chats")
    .insert({
      user_id: auth.session.user.id,
      title: title.trim(),
      mode,
      project_id: resolvedProjectId,
      connection_id: resolvedConnectionId,
      settings: settings || {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chat: data }, { status: 201 });
}
