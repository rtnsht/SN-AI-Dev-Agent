import { getSupabase } from "@/lib/supabase";

type JsonObject = Record<string, unknown>;

const DEFAULT_WORKSPACE_NAME = "My Workspace";
const DEFAULT_SPACE_NAME = "Default Space";
const DEFAULT_PROJECT_NAME = "Default Project";

export interface WorkspaceRecord {
  id: string;
  user_id: string;
  name: string;
  settings: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface SpaceRecord {
  id: string;
  workspace_id: string;
  name: string;
  settings: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface ProjectRecord {
  id: string;
  space_id: string;
  name: string;
  description: string | null;
  settings: JsonObject;
  created_at: string;
  updated_at: string;
}

export type ProjectDocumentationType =
  | "guideline"
  | "guardrail"
  | "reference"
  | "eval_criteria"
  | "runbook";

export interface ProjectDocumentationRecord {
  id: string;
  project_id: string;
  doc_type: ProjectDocumentationType;
  title: string;
  content: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceContext {
  workspace: WorkspaceRecord;
  space: SpaceRecord;
  project: ProjectRecord;
}

function asJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function isMissingWorkspaceTablesError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("could not find the table") &&
    (message.includes("workspaces") || message.includes("spaces") || message.includes("projects"))
  );
}

function buildFallbackWorkspaceContext(userId: string): WorkspaceContext {
  const now = new Date().toISOString();
  return {
    workspace: {
      id: "",
      user_id: userId,
      name: DEFAULT_WORKSPACE_NAME,
      settings: {},
      created_at: now,
      updated_at: now,
    },
    space: {
      id: "",
      workspace_id: "",
      name: DEFAULT_SPACE_NAME,
      settings: {},
      created_at: now,
      updated_at: now,
    },
    project: {
      id: "",
      space_id: "",
      name: DEFAULT_PROJECT_NAME,
      description: "Workspace tables are not available in the connected database yet.",
      settings: {},
      created_at: now,
      updated_at: now,
    },
  };
}

async function getOrCreateWorkspace(userId: string): Promise<WorkspaceRecord> {
  const db = getSupabase();
  const existing = await db.from("workspaces").select("*").eq("user_id", userId).maybeSingle();
  if (existing.error) throw new Error(`Failed to load workspace: ${existing.error.message}`);
  if (existing.data) {
    return {
      ...existing.data,
      settings: asJsonObject(existing.data.settings),
    } as WorkspaceRecord;
  }

  const created = await db
    .from("workspaces")
    .insert({ user_id: userId, name: DEFAULT_WORKSPACE_NAME, settings: {} })
    .select("*")
    .single();

  if (!created.error && created.data) {
    return {
      ...created.data,
      settings: asJsonObject(created.data.settings),
    } as WorkspaceRecord;
  }

  const fallback = await db.from("workspaces").select("*").eq("user_id", userId).single();
  if (fallback.error || !fallback.data) {
    throw new Error(`Failed to provision workspace: ${created.error?.message || fallback.error?.message}`);
  }

  return {
    ...fallback.data,
    settings: asJsonObject(fallback.data.settings),
  } as WorkspaceRecord;
}

async function getOrCreateSpace(workspaceId: string): Promise<SpaceRecord> {
  const db = getSupabase();
  const existing = await db.from("spaces").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (existing.error) throw new Error(`Failed to load space: ${existing.error.message}`);
  if (existing.data) {
    return {
      ...existing.data,
      settings: asJsonObject(existing.data.settings),
    } as SpaceRecord;
  }

  const created = await db
    .from("spaces")
    .insert({ workspace_id: workspaceId, name: DEFAULT_SPACE_NAME, settings: {} })
    .select("*")
    .single();

  if (!created.error && created.data) {
    return {
      ...created.data,
      settings: asJsonObject(created.data.settings),
    } as SpaceRecord;
  }

  const fallback = await db.from("spaces").select("*").eq("workspace_id", workspaceId).single();
  if (fallback.error || !fallback.data) {
    throw new Error(`Failed to provision space: ${created.error?.message || fallback.error?.message}`);
  }

  return {
    ...fallback.data,
    settings: asJsonObject(fallback.data.settings),
  } as SpaceRecord;
}

async function getOrCreateProject(spaceId: string): Promise<ProjectRecord> {
  const db = getSupabase();
  const existing = await db.from("projects").select("*").eq("space_id", spaceId).maybeSingle();
  if (existing.error) throw new Error(`Failed to load project: ${existing.error.message}`);
  if (existing.data) {
    return {
      ...existing.data,
      settings: asJsonObject(existing.data.settings),
    } as ProjectRecord;
  }

  const created = await db
    .from("projects")
    .insert({ space_id: spaceId, name: DEFAULT_PROJECT_NAME, settings: {} })
    .select("*")
    .single();

  if (!created.error && created.data) {
    return {
      ...created.data,
      settings: asJsonObject(created.data.settings),
    } as ProjectRecord;
  }

  const fallback = await db.from("projects").select("*").eq("space_id", spaceId).single();
  if (fallback.error || !fallback.data) {
    throw new Error(`Failed to provision project: ${created.error?.message || fallback.error?.message}`);
  }

  return {
    ...fallback.data,
    settings: asJsonObject(fallback.data.settings),
  } as ProjectRecord;
}

export async function ensureWorkspaceProvisioned(userId: string): Promise<WorkspaceContext> {
  try {
    const workspace = await getOrCreateWorkspace(userId);
    const space = await getOrCreateSpace(workspace.id);
    const project = await getOrCreateProject(space.id);

    return { workspace, space, project };
  } catch (error) {
    if (isMissingWorkspaceTablesError(error)) {
      return buildFallbackWorkspaceContext(userId);
    }
    throw error;
  }
}

export function mergeHierarchicalSettings(
  ...layers: Array<JsonObject | null | undefined>
): JsonObject {
  // Intentional shallow merge: lower levels replace top-level keys whole.
  return layers.reduce<JsonObject>((acc, layer) => {
    if (!layer) return acc;
    return { ...acc, ...layer };
  }, {});
}

export function resolveHierarchySettings(context: WorkspaceContext, chatSettings?: JsonObject | null): JsonObject {
  return mergeHierarchicalSettings(
    context.workspace.settings,
    context.space.settings,
    context.project.settings,
    chatSettings || undefined
  );
}

export async function projectBelongsToUser(userId: string, projectId: string): Promise<boolean> {
  const db = getSupabase();
  const project = await db.from("projects").select("id, space_id").eq("id", projectId).maybeSingle();
  if (project.error || !project.data) return false;

  const space = await db.from("spaces").select("id, workspace_id").eq("id", project.data.space_id).maybeSingle();
  if (space.error || !space.data) return false;

  const workspace = await db
    .from("workspaces")
    .select("id")
    .eq("id", space.data.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  return !!workspace.data && !workspace.error;
}

export async function getProjectDocumentation(
  projectId: string,
  options: { includeInactive?: boolean } = {}
): Promise<ProjectDocumentationRecord[]> {
  const db = getSupabase();
  let query = db
    .from("project_documentation")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!options.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load project documentation: ${error.message}`);

  return (data || []) as ProjectDocumentationRecord[];
}

export async function documentationEntryBelongsToUser(
  userId: string,
  documentationId: string
): Promise<ProjectDocumentationRecord | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from("project_documentation")
    .select("*")
    .eq("id", documentationId)
    .maybeSingle();

  if (error || !data) return null;
  const allowed = await projectBelongsToUser(userId, data.project_id);
  if (!allowed) return null;

  return data as ProjectDocumentationRecord;
}

export async function connectionBelongsToUser(
  userId: string,
  connectionId: string
): Promise<{ id: string; project_id: string | null } | null> {
  const db = getSupabase();
  const { data, error } = await db
    .from("user_system_connections")
    .select("id, project_id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as { id: string; project_id: string | null };
}
