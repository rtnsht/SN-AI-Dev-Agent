import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/session-auth";
import { getSupabase } from "@/lib/supabase";
import { connectionBelongsToUser, projectBelongsToUser } from "@/lib/workspace";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const db = getSupabase();

  const { data, error } = await db
    .from("chats")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ chat: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const db = getSupabase();

  const { data: existing, error: existingError } = await db
    .from("chats")
    .select("id, user_id, project_id, connection_id")
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .maybeSingle();

  if (existingError || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    updates.title = body.title.trim();
  }

  if ("mode" in body) {
    if (body.mode !== "agent" && body.mode !== "quick") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    updates.mode = body.mode;
  }

  if ("active_tab_id" in body) {
    if (body.active_tab_id !== null && typeof body.active_tab_id !== "string") {
      return NextResponse.json({ error: "active_tab_id must be a string or null" }, { status: 400 });
    }
    updates.active_tab_id = body.active_tab_id;
  }

  let resolvedProjectId = existing.project_id;
  if ("project_id" in body && body.project_id !== undefined && body.project_id !== null) {
    if (typeof body.project_id !== "string" || !body.project_id) {
      return NextResponse.json({ error: "project_id must be a non-empty string" }, { status: 400 });
    }
    const allowed = await projectBelongsToUser(auth.session.user.id, body.project_id);
    if (!allowed) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    resolvedProjectId = body.project_id;
    updates.project_id = body.project_id;
  }

  if ("settings" in body) {
    if (!isPlainObject(body.settings)) {
      return NextResponse.json({ error: "settings must be an object" }, { status: 400 });
    }
    updates.settings = body.settings;
  }

  if ("connection_id" in body) {
    if (body.connection_id === null) {
      updates.connection_id = null;
    } else if (typeof body.connection_id !== "string" || !body.connection_id) {
      return NextResponse.json({ error: "connection_id must be a string or null" }, { status: 400 });
    } else {
      const connection = await connectionBelongsToUser(auth.session.user.id, body.connection_id);
      if (!connection) {
        return NextResponse.json({ error: "Connection not found" }, { status: 404 });
      }
      if (connection.project_id && resolvedProjectId && connection.project_id !== resolvedProjectId) {
        return NextResponse.json(
          { error: "Connection belongs to a different project" },
          { status: 400 }
        );
      }
      updates.connection_id = connection.id;
    }
  }

  const { data, error } = await db
    .from("chats")
    .update(updates)
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chat: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const db = getSupabase();

  const { error } = await db
    .from("chats")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
