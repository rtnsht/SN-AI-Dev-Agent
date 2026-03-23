-- Engine configuration table for AI round limits and planner settings.
-- Replaces hardcoded constants in sn-engine.ts with runtime-tunable values.

CREATE TABLE IF NOT EXISTS public.engine_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with defaults matching PHASE_ROUND_LIMITS in tool-definitions.ts
INSERT INTO public.engine_config (key, value, description) VALUES
  ('phase_round_limits', '{"spec":15,"design":25,"scope_selection":5,"implementation":40,"testing":40,"deployment":15}', 'Max tool rounds per SDLC phase'),
  ('default_round_limit', '30', 'Fallback round limit when no phase is set'),
  ('planner_budget_factor', '0.75', 'Fraction of round budget retained after planner runs (0.01-1.0)'),
  ('planner_budget_minimum', '10', 'Minimum rounds after planner reduction (1-50)')
ON CONFLICT (key) DO NOTHING;
