-- Migration 009: Add IP address + user-agent to session_logs
-- Captures client identity at connection time for all users (including anonymous).
-- Previously, IP was only recorded in anon_request_log when a chat message was sent.

ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS ip_address  text;
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS user_agent  text;

CREATE INDEX IF NOT EXISTS idx_session_logs_ip ON session_logs(ip_address);
