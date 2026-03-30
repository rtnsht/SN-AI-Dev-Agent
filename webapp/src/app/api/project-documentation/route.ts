import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/session-auth";
import { getSupabase } from "@/lib/supabase";
import {
  ensureWorkspaceProvisioned,
  getProjectDocumentation,
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

function parseBooleanParam(value: string | null): boolean {
  return value === "true" || value === "1";
}

export async function GET(request: NextRequest) {
  const auth = await requireUserSession(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const requestedProjectId = searchParams.get("projectId");
  const includeInactive = parseBooleanParam(searchParams.get("includeInactive"));

  let projectId = requestedProjectId;
  if (!projectId) {
    const context = await ensureWorkspaceProvisioned(auth.session.user.id);
    projectId = context.project.id;
  } else {
    const allowed = await projectBelongsToUser(auth.session.user.id, projectId);
    if (!allowed) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  const documentation = await getProjectDocumentation(projectId, { includeInactive });
  return NextResponse.json({ documentation });
}

export async function POST(request: NextRequest) {
  const auth = await requireUserSession(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { doc_type, title, content, is_active = true, display_order = 0 } = body;

  if (!VALID_DOC_TYPES.includes(doc_type)) {
    return NextResponse.json({ error: "Invalid doc_type" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }
  if (typeof is_active !== "boolean") {
    return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
  }
  if (!Number.isInteger(display_order)) {
    return NextResponse.json({ error: "display_order must be an integer" }, { status: 400 });
  }

  let projectId = typeof body.project_id === "string" ? body.project_id : "";
  if (!projectId) {
    const context = await ensureWorkspaceProvisioned(auth.session.user.id);
    projectId = context.project.id;
  } else {
    const allowed = await projectBelongsToUser(auth.session.user.id, projectId);
    if (!allowed) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  const db = getSupabase();
  const { data, error } = await db
    .from("project_documentation")
    .insert({
      project_id: projectId,
      doc_type,
      title: title.trim(),
      content,
      is_active,
      display_order,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documentation: data }, { status: 201 });
}
