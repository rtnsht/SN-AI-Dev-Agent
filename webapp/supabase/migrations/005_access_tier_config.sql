-- 005_access_tier_config.sql
-- 3-Tier Access System: configurable daily limits for anonymous and authenticated users.
-- Tier 1 (Anonymous/IP): anon_daily_limit requests/day
-- Tier 2 (Authenticated): auth_daily_limit requests/day
-- Tier 3 (BYOK):          unlimited

CREATE TABLE IF NOT EXISTS access_tier_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_daily_limit INTEGER NOT NULL DEFAULT 10,
  auth_daily_limit INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the single config row with defaults
INSERT INTO access_tier_config (anon_daily_limit, auth_daily_limit)
VALUES (10, 20)
ON CONFLICT DO NOTHING;

-- Note: Authenticated usage is tracked via the existing `request_log` table
-- (created in 004_trial_system.sql). Anonymous usage is tracked in server memory.
