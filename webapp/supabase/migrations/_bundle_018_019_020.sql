-- =============================================================================
-- Bundle: 018 + 019 + 020 — run once in Supabase SQL Editor (or via apply script)
-- Idempotent where possible. See ../APPLY_018_THROUGH_020.md
-- =============================================================================

BEGIN;

-- ── 018_engine_config.sql ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.engine_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.engine_config (key, value, description) VALUES
  ('phase_round_limits', '{"spec":15,"design":25,"scope_selection":5,"implementation":40,"testing":40,"deployment":15}', 'Max tool rounds per SDLC phase'),
  ('default_round_limit', '30', 'Fallback round limit when no phase is set'),
  ('planner_budget_factor', '0.75', 'Fraction of round budget retained after planner runs (0.01-1.0)'),
  ('planner_budget_minimum', '10', 'Minimum rounds after planner reduction (1-50)')
ON CONFLICT (key) DO NOTHING;

-- ── 019_share_prompt_tracking.sql ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.share_prompt_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  shown_count integer NOT NULL DEFAULT 0 CHECK (shown_count >= 0 AND shown_count <= 10),
  last_shown_at timestamptz,
  shared_at timestamptz,
  platform text CHECK (platform IS NULL OR platform IN ('linkedin', 'x')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_share_prompt_tracking_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_share_prompt_tracking_updated_at ON public.share_prompt_tracking;

CREATE TRIGGER trg_share_prompt_tracking_updated_at
BEFORE UPDATE ON public.share_prompt_tracking
FOR EACH ROW
EXECUTE FUNCTION public.touch_share_prompt_tracking_updated_at();

-- ── 020_share_prompt_tracking_rls.sql ───────────────────────────────────────
ALTER TABLE IF EXISTS public.share_prompt_tracking ENABLE ROW LEVEL SECURITY;

COMMIT;
