-- Migration to add atomic increment RPCs for request logs to prevent race conditions

-- RPC to atomically increment anon_request_log
CREATE OR REPLACE FUNCTION increment_anon_request_count(
  p_ip_address TEXT,
  p_instance_url TEXT,
  p_request_date DATE
) RETURNS VOID AS $$
BEGIN
  INSERT INTO anon_request_log (ip_address, instance_url, request_date, request_count)
  VALUES (p_ip_address, p_instance_url, p_request_date, 1)
  ON CONFLICT (ip_address, instance_url, request_date)
  DO UPDATE SET request_count = anon_request_log.request_count + 1;
END;
$$ LANGUAGE plpgsql;

-- RPC to atomically increment request_log (authenticated users)
CREATE OR REPLACE FUNCTION increment_auth_request_count(
  p_user_id UUID,
  p_request_date DATE
) RETURNS VOID AS $$
BEGIN
  INSERT INTO request_log (user_id, request_date, request_count)
  VALUES (p_user_id, p_request_date, 1)
  ON CONFLICT (user_id, request_date)
  DO UPDATE SET request_count = request_log.request_count + 1;
END;
$$ LANGUAGE plpgsql;

-- RPC to atomically increment trial_request_log
CREATE OR REPLACE FUNCTION increment_trial_request_count(
  p_user_id UUID,
  p_request_date DATE
) RETURNS VOID AS $$
BEGIN
  INSERT INTO trial_request_log (user_id, request_date, request_count)
  VALUES (p_user_id, p_request_date, 1)
  ON CONFLICT (user_id, request_date)
  DO UPDATE SET request_count = trial_request_log.request_count + 1;
END;
$$ LANGUAGE plpgsql;

-- RPC to get total usage for a user
CREATE OR REPLACE FUNCTION get_total_usage(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT SUM(request_count) INTO total
  FROM request_log
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;
