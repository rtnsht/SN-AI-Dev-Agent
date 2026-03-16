-- Migration 007: Session Logs Persistence
-- Stores AI agent session logs in Supabase for persistence across Render deployments.
-- Designed for 2000+ concurrent users with safeguards against OOM, thundering herd,
-- and JSONB write amplification (see docs/log-persistence-architecture.md).

CREATE TABLE IF NOT EXISTS session_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          text NOT NULL UNIQUE,
  user_id             uuid REFERENCES users(id) ON DELETE SET NULL,
  instance_url        text,
  username            text,
  user_full_name      text,
  ai_provider         text,
  model               text,
  current_phase       text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  total_rounds        integer DEFAULT 0,
  total_tool_calls    integer DEFAULT 0,
  total_errors        integer DEFAULT 0,
  total_input_tokens  integer DEFAULT 0,
  total_output_tokens integer DEFAULT 0,
  phases              text[] DEFAULT '{}',
  status              text DEFAULT 'active',
  log_entries         jsonb DEFAULT '[]'::jsonb,
  entries_overflow    boolean DEFAULT false,
  telemetry_summary   jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_logs_started_at ON session_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_logs_username   ON session_logs(username);
CREATE INDEX IF NOT EXISTS idx_session_logs_status     ON session_logs(status);
CREATE INDEX IF NOT EXISTS idx_session_logs_user_id    ON session_logs(user_id);

-- Append entries to log_entries JSONB array + update counters in one atomic operation.
-- Uses ON CONFLICT for self-healing when initSession INSERT was missed.
CREATE OR REPLACE FUNCTION append_session_log_entries(
  p_session_id text,
  p_entries jsonb,
  p_total_rounds integer,
  p_total_tool_calls integer,
  p_total_errors integer,
  p_total_input_tokens integer,
  p_total_output_tokens integer,
  p_current_phase text,
  p_phases text[],
  p_overflow boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO session_logs (
    session_id, log_entries, total_rounds, total_tool_calls, total_errors,
    total_input_tokens, total_output_tokens, current_phase, phases,
    entries_overflow, updated_at
  ) VALUES (
    p_session_id, p_entries, p_total_rounds, p_total_tool_calls, p_total_errors,
    p_total_input_tokens, p_total_output_tokens, p_current_phase, p_phases,
    p_overflow, now()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    log_entries = session_logs.log_entries || p_entries,
    total_rounds = GREATEST(session_logs.total_rounds, p_total_rounds),
    total_tool_calls = GREATEST(session_logs.total_tool_calls, p_total_tool_calls),
    total_errors = GREATEST(session_logs.total_errors, p_total_errors),
    total_input_tokens = GREATEST(session_logs.total_input_tokens, p_total_input_tokens),
    total_output_tokens = GREATEST(session_logs.total_output_tokens, p_total_output_tokens),
    current_phase = p_current_phase,
    phases = CASE
      WHEN array_length(p_phases, 1) > array_length(session_logs.phases, 1)
      THEN p_phases
      ELSE session_logs.phases
    END,
    entries_overflow = session_logs.entries_overflow OR p_overflow,
    updated_at = now();
END;
$$;

-- Retention cleanup function — callable from admin API or pg_cron.
-- Pass 0 to skip cleanup (keep everything).
CREATE OR REPLACE FUNCTION cleanup_old_session_logs(retention_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF retention_days <= 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM session_logs
  WHERE started_at < now() - make_interval(days => retention_days);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
