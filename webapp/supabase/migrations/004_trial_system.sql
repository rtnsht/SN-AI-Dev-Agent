-- TRIAL SYSTEM: Configurable trial limits with per-user/instance overrides
-- Run this in Supabase SQL Editor to create the required tables.

-- ── trial_config ────────────────────────────────────────────────
-- Stores global defaults and per-user/instance overrides for trial limits.
-- One row with scope='global' for defaults; additional rows for overrides.
CREATE TABLE IF NOT EXISTS trial_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       text NOT NULL DEFAULT 'global'
                CHECK (scope IN ('global', 'user', 'instance')),
  scope_value text,           -- null for global, user_id for user, instance_url for instance
  daily_limit int NOT NULL DEFAULT 10,
  trial_days  int NOT NULL DEFAULT 10,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Only one global config row allowed
CREATE UNIQUE INDEX IF NOT EXISTS trial_config_global_idx
  ON trial_config (scope) WHERE scope = 'global';

-- One override per user or instance
CREATE UNIQUE INDEX IF NOT EXISTS trial_config_scope_value_idx
  ON trial_config (scope, scope_value) WHERE scope != 'global';

-- Seed the default global config
INSERT INTO trial_config (scope, scope_value, daily_limit, trial_days, is_active)
VALUES ('global', NULL, 10, 10, true)
ON CONFLICT DO NOTHING;

-- ── request_log ──────────────────────────────────────────────────
-- Tracks per-user daily request counts for trial enforcement.
CREATE TABLE IF NOT EXISTS request_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_url    text,
  request_date    date NOT NULL DEFAULT CURRENT_DATE,
  request_count   int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per user per day (upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS request_log_user_date_idx
  ON request_log (user_id, request_date);

CREATE INDEX IF NOT EXISTS request_log_user_id_idx
  ON request_log (user_id);

-- ── trial_start ──────────────────────────────────────────────────
-- Tracks when each user's trial period started.
CREATE TABLE IF NOT EXISTS trial_start (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_url    text,
  started_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trial_start_user_idx
  ON trial_start (user_id);
