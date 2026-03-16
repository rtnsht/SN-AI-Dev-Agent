-- Migration 006: User Instances
-- Tracks ServiceNow instances that users have connected to.
-- Auto-populated on each successful connection via /api/session-start.

CREATE TABLE IF NOT EXISTS user_instances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  instance_url      text NOT NULL,
  instance_name     text,              -- short label derived from URL (e.g. "dev181312")
  sn_username       text,              -- ServiceNow username used to connect
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_connected_at timestamptz NOT NULL DEFAULT now()
);

-- One record per user per instance URL
CREATE UNIQUE INDEX IF NOT EXISTS user_instances_user_url_idx
  ON user_instances(user_id, instance_url);

-- Fast lookup by instance URL (for admin dropdown dedup)
CREATE INDEX IF NOT EXISTS user_instances_url_idx
  ON user_instances(instance_url);
