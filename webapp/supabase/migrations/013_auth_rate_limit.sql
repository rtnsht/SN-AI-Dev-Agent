-- Auth endpoint rate-limit events (shared, DB-backed)

CREATE TABLE IF NOT EXISTS auth_rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  rate_key TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_rate_limit_events_key_time_idx
  ON auth_rate_limit_events (rate_key, event_at DESC);

CREATE OR REPLACE FUNCTION check_auth_rate_limit(
  p_key TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_seconds INTEGER
) AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ := NOW() - make_interval(secs => p_window_seconds);
  v_attempt_count INTEGER;
  v_oldest TIMESTAMPTZ;
BEGIN
  -- Best-effort cleanup for this key to control growth.
  DELETE FROM auth_rate_limit_events
  WHERE rate_key = p_key
    AND event_at <= v_now - INTERVAL '24 hours';

  SELECT COUNT(*), MIN(event_at)
  INTO v_attempt_count, v_oldest
  FROM auth_rate_limit_events
  WHERE rate_key = p_key
    AND event_at > v_window_start;

  IF v_attempt_count >= p_max_attempts THEN
    RETURN QUERY
    SELECT
      FALSE,
      0,
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM ((v_oldest + make_interval(secs => p_window_seconds)) - v_now)))::INTEGER);
    RETURN;
  END IF;

  INSERT INTO auth_rate_limit_events (rate_key, event_at)
  VALUES (p_key, v_now);

  RETURN QUERY
  SELECT
    TRUE,
    GREATEST(0, p_max_attempts - (v_attempt_count + 1)),
    0;
END;
$$ LANGUAGE plpgsql;
