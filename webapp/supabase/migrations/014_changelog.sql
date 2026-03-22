-- Changelog table for in-app release notes
-- Used by GET /api/changelog to populate the Release dropdown
-- Status values: 'released', 'upcoming', 'planned'

CREATE TABLE IF NOT EXISTS changelog (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'released',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS (consistent with all other tables in this project)
ALTER TABLE changelog ENABLE ROW LEVEL SECURITY;

-- Allow public read access — changelog is non-sensitive public data
-- This enables both service_role and anon key to read entries
CREATE POLICY "Allow public read access to changelog"
  ON changelog FOR SELECT
  USING (true);
