-- ============================================
-- Phase 4: Transport-aware model platform
-- Adds display-provider metadata, admin free-model rules,
-- and per-user daily usage tracking.
-- ============================================

BEGIN;

ALTER TABLE public.model_config
  DROP CONSTRAINT IF EXISTS model_config_provider_check;

ALTER TABLE public.model_config
  ADD CONSTRAINT model_config_provider_check
  CHECK (provider IN ('openrouter', 'google', 'openai', 'anthropic', 'minimax', 'mimo', 'glm', 'free'));

ALTER TABLE public.model_config
  ADD COLUMN IF NOT EXISTS display_provider TEXT,
  ADD COLUMN IF NOT EXISTS transport TEXT NOT NULL DEFAULT 'openrouter',
  ADD COLUMN IF NOT EXISTS api_model_id TEXT,
  ADD COLUMN IF NOT EXISTS model_class TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS speed_tier TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS cost_tier TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS training_data TEXT,
  ADD COLUMN IF NOT EXISTS thinking_mode_supported BOOLEAN DEFAULT FALSE;

ALTER TABLE public.model_config
  DROP CONSTRAINT IF EXISTS model_config_transport_check;

ALTER TABLE public.model_config
  ADD CONSTRAINT model_config_transport_check
  CHECK (transport IN ('anthropic', 'openrouter'));

ALTER TABLE public.model_config
  DROP CONSTRAINT IF EXISTS model_config_display_provider_check;

ALTER TABLE public.model_config
  ADD CONSTRAINT model_config_display_provider_check
  CHECK (display_provider IS NULL OR display_provider IN ('openrouter', 'google', 'openai', 'anthropic', 'minimax', 'mimo', 'glm', 'free'));

CREATE INDEX IF NOT EXISTS model_config_display_provider_idx ON public.model_config(display_provider);
CREATE INDEX IF NOT EXISTS model_config_transport_idx ON public.model_config(transport);
CREATE INDEX IF NOT EXISTS model_config_enabled_transport_idx ON public.model_config(enabled, transport);

UPDATE public.model_config
SET
  display_provider = COALESCE(display_provider, provider),
  transport = CASE
    WHEN transport IN ('anthropic', 'openrouter') THEN transport
    WHEN provider = 'anthropic' THEN 'anthropic'
    ELSE 'openrouter'
  END,
  api_model_id = COALESCE(api_model_id, model_id),
  model_class = COALESCE(model_class, 'standard'),
  speed_tier = COALESCE(speed_tier, 'medium'),
  cost_tier = COALESCE(cost_tier, 'medium'),
  thinking_mode_supported = COALESCE(thinking_mode_supported, FALSE);

UPDATE public.model_config
SET
  model_key = 'claude-sonnet-4-6',
  model_id = 'claude-sonnet-4-6',
  api_model_id = 'claude-sonnet-4-6',
  label = 'Claude Sonnet 4.6',
  transport = 'anthropic',
  display_provider = 'anthropic',
  is_server_free = TRUE,
  model_class = 'balanced',
  speed_tier = 'medium',
  cost_tier = 'medium',
  training_data = COALESCE(training_data, 'Provider managed'),
  thinking_mode_supported = TRUE
WHERE model_key = 'claude-sonnet-4.6';

UPDATE public.model_config
SET
  model_key = 'claude-opus-4-6',
  model_id = 'claude-opus-4-6',
  api_model_id = 'claude-opus-4-6',
  label = 'Claude Opus 4.6',
  transport = 'anthropic',
  display_provider = 'anthropic',
  is_server_free = TRUE,
  model_class = 'frontier',
  speed_tier = 'slow',
  cost_tier = 'high',
  training_data = COALESCE(training_data, 'Provider managed'),
  thinking_mode_supported = TRUE
WHERE model_key = 'claude-opus-4.0';

UPDATE public.model_config
SET
  model_id = 'minimax/minimax-m2.7',
  api_model_id = 'minimax/minimax-m2.7',
  label = 'MiniMax M2.7',
  transport = 'openrouter',
  display_provider = 'minimax',
  is_server_free = TRUE,
  model_class = 'automation',
  speed_tier = 'medium',
  cost_tier = 'low',
  context_window = 204800,
  training_data = COALESCE(training_data, 'Provider managed'),
  thinking_mode_supported = TRUE
WHERE model_key = 'minimax-m2.7';

INSERT INTO public.model_config (
  provider,
  display_provider,
  transport,
  model_key,
  label,
  model_id,
  api_model_id,
  context_window,
  max_output,
  input_cost_per_1m,
  output_cost_per_1m,
  is_free,
  is_default,
  is_server_free,
  capabilities,
  enabled,
  display_order,
  model_class,
  speed_tier,
  cost_tier,
  training_data,
  thinking_mode_supported
)
VALUES
  ('anthropic', 'anthropic', 'anthropic', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 'claude-sonnet-4-6', 'claude-sonnet-4-6', 200000, 8192, 3, 15, FALSE, TRUE, TRUE, '["chat","streaming","tools"]', TRUE, 10, 'balanced', 'medium', 'medium', 'Provider managed', TRUE),
  ('anthropic', 'anthropic', 'anthropic', 'claude-opus-4-6', 'Claude Opus 4.6', 'claude-opus-4-6', 'claude-opus-4-6', 200000, 8192, 15, 75, FALSE, FALSE, TRUE, '["chat","streaming","tools"]', TRUE, 20, 'frontier', 'slow', 'high', 'Provider managed', TRUE),
  ('anthropic', 'anthropic', 'anthropic', 'claude-haiku-4-5', 'Claude Haiku 4.5', 'claude-haiku-4-5', 'claude-haiku-4-5', 200000, 8192, 0.8, 4, FALSE, FALSE, TRUE, '["chat","streaming","tools"]', TRUE, 30, 'fast', 'fast', 'low', 'Provider managed', FALSE),
  ('openai', 'openai', 'openrouter', 'gpt-5.4', 'GPT-5.4', 'openai/gpt-5.4', 'openai/gpt-5.4', 1050000, 131072, 2.5, 15, FALSE, FALSE, FALSE, '["chat","streaming","tools","vision"]', TRUE, 40, 'frontier', 'medium', 'high', 'Dec 2024', TRUE),
  ('google', 'google', 'openrouter', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash', 1048576, 8192, 0.3, 2.5, FALSE, FALSE, FALSE, '["chat","streaming","tools","vision"]', TRUE, 50, 'fast', 'fast', 'medium', 'Jan 2025', TRUE),
  ('mimo', 'mimo', 'openrouter', 'mimo-v2-pro', 'MiMo V2 Pro', 'xiaomi/mimo-v2-pro', 'xiaomi/mimo-v2-pro', 1048576, 8192, 1, 3, FALSE, FALSE, FALSE, '["chat","streaming","tools"]', TRUE, 60, 'agentic', 'medium', 'medium', 'Provider managed', TRUE),
  ('minimax', 'minimax', 'openrouter', 'minimax-m2.7', 'MiniMax M2.7', 'minimax/minimax-m2.7', 'minimax/minimax-m2.7', 204800, 8192, 0.3, 1.2, FALSE, FALSE, TRUE, '["chat","streaming","tools"]', TRUE, 70, 'automation', 'medium', 'low', 'Provider managed', TRUE),
  ('glm', 'glm', 'openrouter', 'glm-4.5', 'GLM 4.5', 'z-ai/glm-4.5', 'z-ai/glm-4.5', 131072, 98304, 0.6, 2.2, FALSE, FALSE, FALSE, '["chat","streaming","tools"]', TRUE, 80, 'reasoning', 'medium', 'medium', 'Dec 2024', TRUE),
  ('openrouter', 'openrouter', 'openrouter', 'openrouter-free', 'OpenRouter Free', 'openrouter/free', 'openrouter/free', 128000, 8192, 0, 0, TRUE, FALSE, TRUE, '["chat","streaming"]', TRUE, 90, 'economy', 'medium', 'low', 'Provider managed', FALSE)
ON CONFLICT (model_key) DO UPDATE
SET
  provider = EXCLUDED.provider,
  display_provider = EXCLUDED.display_provider,
  transport = EXCLUDED.transport,
  label = EXCLUDED.label,
  model_id = EXCLUDED.model_id,
  api_model_id = EXCLUDED.api_model_id,
  context_window = EXCLUDED.context_window,
  max_output = EXCLUDED.max_output,
  input_cost_per_1m = EXCLUDED.input_cost_per_1m,
  output_cost_per_1m = EXCLUDED.output_cost_per_1m,
  is_free = EXCLUDED.is_free,
  is_default = EXCLUDED.is_default,
  is_server_free = EXCLUDED.is_server_free,
  capabilities = EXCLUDED.capabilities,
  enabled = EXCLUDED.enabled,
  display_order = EXCLUDED.display_order,
  model_class = EXCLUDED.model_class,
  speed_tier = EXCLUDED.speed_tier,
  cost_tier = EXCLUDED.cost_tier,
  training_data = EXCLUDED.training_data,
  thinking_mode_supported = EXCLUDED.thinking_mode_supported,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.admin_free_model_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_config_id UUID NOT NULL REFERENCES public.model_config(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('all_users', 'specific_users')),
  daily_request_limit INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_free_model_rule_users (
  rule_id UUID NOT NULL REFERENCES public.admin_free_model_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.model_access_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.admin_free_model_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  model_config_id UUID NOT NULL REFERENCES public.model_config(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(rule_id, user_id, model_config_id, usage_date)
);

CREATE INDEX IF NOT EXISTS admin_free_model_rules_model_config_idx
  ON public.admin_free_model_rules(model_config_id);
CREATE INDEX IF NOT EXISTS admin_free_model_rules_active_idx
  ON public.admin_free_model_rules(is_active, scope);
CREATE INDEX IF NOT EXISTS admin_free_model_rule_users_user_idx
  ON public.admin_free_model_rule_users(user_id);
CREATE INDEX IF NOT EXISTS model_access_usage_daily_lookup_idx
  ON public.model_access_usage_daily(user_id, usage_date, model_config_id);
CREATE INDEX IF NOT EXISTS model_access_usage_daily_rule_idx
  ON public.model_access_usage_daily(rule_id, usage_date);

ALTER TABLE public.admin_free_model_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_free_model_rule_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_access_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage admin_free_model_rules" ON public.admin_free_model_rules;
CREATE POLICY "Service role can manage admin_free_model_rules"
  ON public.admin_free_model_rules
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "Service role can manage admin_free_model_rule_users" ON public.admin_free_model_rule_users;
CREATE POLICY "Service role can manage admin_free_model_rule_users"
  ON public.admin_free_model_rule_users
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "Service role can manage model_access_usage_daily" ON public.model_access_usage_daily;
CREATE POLICY "Service role can manage model_access_usage_daily"
  ON public.model_access_usage_daily
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

INSERT INTO public.admin_free_model_rules (model_config_id, scope, daily_request_limit, is_active)
SELECT mc.id, 'all_users', 50, TRUE
FROM public.model_config mc
WHERE mc.model_key = 'openrouter-free'
  AND NOT EXISTS (
    SELECT 1
    FROM public.admin_free_model_rules r
    WHERE r.model_config_id = mc.id
      AND r.scope = 'all_users'
  );

INSERT INTO public.admin_free_model_rules (model_config_id, scope, daily_request_limit, is_active)
SELECT mc.id, 'all_users', 25, TRUE
FROM public.model_config mc
WHERE mc.model_key = 'minimax-m2.7'
  AND NOT EXISTS (
    SELECT 1
    FROM public.admin_free_model_rules r
    WHERE r.model_config_id = mc.id
      AND r.scope = 'all_users'
  );

COMMIT;
