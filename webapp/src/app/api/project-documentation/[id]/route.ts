import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/session-auth";
import { getSupabase } from "@/lib/supabase";
import {
  documentationEntryBelongsToUser,
  projectBelongsToUser,
  type ProjectDocumentationType,
} from "@/lib/workspace";

const VALID_DOC_TYPES: ProjectDocumentationType[] = [
  "guideline",
  "guardrail",
  "reference",
  "eval_criteria",
  "runbook",
];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const documentation = await documentationEntryBelongsToUser(auth.session.user.id, id);
  if (!documentation) {
    return NextResponse.json({ error: "Documentation not found" }, { status: 404 });
  }

  return NextResponse.json({ documentation });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await documentationEntryBelongsToUser(auth.session.user.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Documentation not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("doc_type" in body) {
    if (!VALID_DOC_TYPES.includes(body.doc_type)) {
      return NextResponse.json({ error: "Invalid doc_type" }, { status: 400 });
    }
    updates.doc_type = body.doc_type;
  }

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    updates.title = body.title.trim();
  }

  if ("content" in body) {
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "content must be a string" }, { status: 400 });
    }
    updates.content = body.content;
  }

  if ("is_active" in body) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
    }
    updates.is_active = body.is_active;
  }

  if ("display_order" in body) {
    if (!Number.isInteger(body.display_order)) {
      return NextResponse.json({ error: "display_order must be an integer" }, { status: 400 });
    }
    updates.display_order = body.display_order;
  }

  if ("project_id" in body && body.project_id !== undefined) {
    if (typeof body.project_id !== "string" || !body.project_id) {
      return NextResponse.json({ error: "project_id must be a string" }, { status: 400 });
    }
    const allowed = await projectBelongsToUser(auth.session.user.id, body.project_id);
    if (!allowed) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    updates.project_id = body.project_id;
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("project_documentation")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documentation: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await documentationEntryBelongsToUser(auth.session.user.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Documentation not found" }, { status: 404 });
  }

  const db = getSupabase();
  const { error } = await db.from("project_documentation").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
