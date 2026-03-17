-- Migration 011: Fix access_tier_config duplicate rows (BUG-14)
--
-- The original ON CONFLICT DO NOTHING in 005 was a no-op because there's no
-- UNIQUE constraint on the non-PK columns. Each migration re-run would insert
-- a duplicate row. Fix: keep only one row and prevent future duplicates.

-- Delete all but the most recently created config row
DELETE FROM access_tier_config
WHERE id NOT IN (
  SELECT id FROM access_tier_config ORDER BY created_at DESC LIMIT 1
);

-- Add a check constraint to ensure at most one row exists.
-- This uses a function + trigger approach since Postgres doesn't have a
-- native "max rows" constraint.
CREATE OR REPLACE FUNCTION check_single_access_tier_config()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM access_tier_config) >= 1 THEN
    RAISE EXCEPTION 'access_tier_config may only contain one row';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_access_tier_config ON access_tier_config;
CREATE TRIGGER enforce_single_access_tier_config
  BEFORE INSERT ON access_tier_config
  FOR EACH ROW
  EXECUTE FUNCTION check_single_access_tier_config();
