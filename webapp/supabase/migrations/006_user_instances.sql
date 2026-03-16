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

-- ── Anonymous request tracking (DB-backed, replaces in-memory IP buckets) ──

CREATE TABLE IF NOT EXISTS anon_request_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address    text NOT NULL,
  instance_url  text,              -- ServiceNow instance being accessed
  request_date  date NOT NULL DEFAULT CURRENT_DATE,
  request_count int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per IP per instance per day (upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS anon_request_log_ip_instance_date_idx
  ON anon_request_log(ip_address, COALESCE(instance_url, ''), request_date);

-- Fast lookup for instance-level abuse detection
CREATE INDEX IF NOT EXISTS anon_request_log_instance_date_idx
  ON anon_request_log(instance_url, request_date);
