import { NextRequest, NextResponse } from "next/server";
import { encryptJson } from "@/lib/crypto-vault";
import { requireUserSession } from "@/lib/session-auth";
import { getSupabase } from "@/lib/supabase";
import { ensureWorkspaceProvisioned, projectBelongsToUser } from "@/lib/workspace";

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
    .from("user_system_connections")
    .select(
      "id, system_type, label, instance_url, project_id, is_default, is_active, last_verified_at, last_used_at, metadata, created_at"
    )
    .eq("user_id", auth.session.user.id)
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connections: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { system_type, label, instance_url, credentials, is_default, project_id } = body;

  if (!system_type || !label || !instance_url) {
    return NextResponse.json(
      { error: "system_type, label, and instance_url are required" },
      { status: 400 }
    );
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

  const encrypted = encryptJson(credentials || {});

  const db = getSupabase();
  if (is_default) {
    await db
      .from("user_system_connections")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("user_id", auth.session.user.id)
      .eq("project_id", resolvedProjectId)
      .eq("system_type", system_type);
  }

  const { data, error } = await db
    .from("user_system_connections")
    .insert({
      user_id: auth.session.user.id,
      system_type,
      label,
      instance_url,
      project_id: resolvedProjectId,
      credentials_enc: JSON.stringify(encrypted),
      is_default: is_default || false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    {
      connection: {
        id: data.id,
        system_type,
        label,
        instance_url,
        project_id: data.project_id,
        is_default: data.is_default,
        created_at: data.created_at,
      },
    },
    { status: 201 }
  );
}
