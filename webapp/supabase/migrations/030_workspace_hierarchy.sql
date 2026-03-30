-- Migration 030: Workspace / Space / Project hierarchy
-- Adds one workspace, one space, and one default project per user for the MVP.
-- Also binds chats and saved connections to projects and adds project documentation storage.

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Workspace',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Space',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Project',
  description TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(space_id)
);

CREATE TABLE IF NOT EXISTS public.project_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('guideline', 'guardrail', 'reference', 'eval_criteria', 'runbook')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_system_connections
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES public.user_system_connections(id) ON DELETE SET NULL;

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS spaces_workspace_id_idx ON public.spaces(workspace_id);
CREATE INDEX IF NOT EXISTS projects_space_id_idx ON public.projects(space_id);
CREATE INDEX IF NOT EXISTS project_documentation_project_id_idx ON public.project_documentation(project_id);
CREATE INDEX IF NOT EXISTS project_documentation_project_active_idx ON public.project_documentation(project_id, is_active);
CREATE INDEX IF NOT EXISTS user_system_connections_project_id_idx ON public.user_system_connections(project_id);
CREATE INDEX IF NOT EXISTS chats_project_id_idx ON public.chats(project_id);
CREATE INDEX IF NOT EXISTS chats_connection_id_idx ON public.chats(connection_id);

INSERT INTO public.workspaces (user_id, name, settings)
SELECT u.id, 'My Workspace', '{}'::jsonb
FROM public.users u
LEFT JOIN public.workspaces w ON w.user_id = u.id
WHERE w.id IS NULL;

INSERT INTO public.spaces (workspace_id, name, settings)
SELECT w.id, 'Default Space', COALESCE(w.settings, '{}'::jsonb)
FROM public.workspaces w
LEFT JOIN public.spaces s ON s.workspace_id = w.id
WHERE s.id IS NULL;

INSERT INTO public.projects (space_id, name, settings)
SELECT s.id, 'Default Project', COALESCE(s.settings, '{}'::jsonb)
FROM public.spaces s
LEFT JOIN public.projects p ON p.space_id = s.id
WHERE p.id IS NULL;

UPDATE public.user_system_connections usc
SET project_id = p.id
FROM public.workspaces w
JOIN public.spaces s ON s.workspace_id = w.id
JOIN public.projects p ON p.space_id = s.id
WHERE w.user_id = usc.user_id
  AND usc.project_id IS NULL;

UPDATE public.chats c
SET project_id = p.id
FROM public.workspaces w
JOIN public.spaces s ON s.workspace_id = w.id
JOIN public.projects p ON p.space_id = s.id
WHERE w.user_id = c.user_id
  AND c.project_id IS NULL;
