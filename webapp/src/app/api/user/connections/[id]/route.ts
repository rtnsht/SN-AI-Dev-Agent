import { NextRequest, NextResponse } from "next/server";
import { encryptJson } from "@/lib/crypto-vault";
import { requireUserSession } from "@/lib/session-auth";
import { getSupabase } from "@/lib/supabase";
import { projectBelongsToUser } from "@/lib/workspace";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const db = getSupabase();

  const { data, error } = await db
    .from("user_system_connections")
    .select(
      "id, system_type, label, instance_url, project_id, is_default, is_active, last_verified_at, last_used_at, metadata, created_at"
    )
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ connection: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const allowed = ["label", "instance_url", "credentials", "project_id", "is_default", "is_active"];
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) {
      if (key === "credentials") {
        updates.credentials_enc = JSON.stringify(encryptJson(body[key]));
      } else if (key === "project_id") {
        if (body[key] === null) {
          updates.project_id = null;
        } else if (typeof body[key] !== "string" || !body[key]) {
          return NextResponse.json({ error: "project_id must be a string or null" }, { status: 400 });
        } else {
          const allowedProject = await projectBelongsToUser(auth.session.user.id, body[key]);
          if (!allowedProject) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
          }
          updates.project_id = body[key];
        }
      } else {
        updates[key] = body[key];
      }
    }
  }
  updates.updated_at = new Date().toISOString();

  const db = getSupabase();

  if (updates.is_default === true) {
    const { data: current } = await db
      .from("user_system_connections")
      .select("project_id, system_type")
      .eq("id", id)
      .eq("user_id", auth.session.user.id)
      .single();

    if (current) {
      await db
        .from("user_system_connections")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("user_id", auth.session.user.id)
        .eq("project_id", updates.project_id ?? current.project_id)
        .eq("system_type", current.system_type);
    }
  }

  const { data, error } = await db
    .from("user_system_connections")
    .update(updates)
    .eq("id", id)
    .eq("user_id", auth.session.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connection: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const db = getSupabase();

  const { error } = await db
    .from("user_system_connections")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
