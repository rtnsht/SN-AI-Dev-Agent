-- Migration 010: Fix session logs RPC bugs
--
-- BUG-13: phases array_length([], 1) returns NULL causing comparison to always
--         fall to ELSE. Fix: union both arrays with DISTINCT.
-- BUG-15: cleanup_old_session_logs deletes active sessions. Fix: exclude active.
-- Counters now use GREATEST which works correctly with cumulative values from
-- the application layer (BUG-3/4 fixed in log-persistence.ts).

-- Replace the append_session_log_entries function with fixed phases logic
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
    phases = (SELECT COALESCE(array_agg(DISTINCT x), '{}') FROM unnest(session_logs.phases || p_phases) x),
    entries_overflow = session_logs.entries_overflow OR p_overflow,
    updated_at = now();
END;
$$;

-- Replace cleanup function to exclude active sessions (BUG-15)
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
  WHERE started_at < now() - make_interval(days => retention_days)
    AND status != 'active';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
