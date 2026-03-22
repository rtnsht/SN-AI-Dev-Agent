-- ============================================================
-- Releases table: stores versioned release records
-- ============================================================
CREATE TABLE IF NOT EXISTS releases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  release_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'draft', 'upcoming')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to releases"
  ON releases FOR SELECT USING (true);

-- ============================================================
-- Enhance existing changelog table with release association
-- ============================================================
ALTER TABLE changelog
  ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES releases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'added'
    CHECK (category IN ('added', 'improved', 'fixed', 'security', 'removed', 'deprecated')),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
