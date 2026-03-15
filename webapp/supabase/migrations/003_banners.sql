-- Admin-configurable banners
CREATE TABLE public.banners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,                          -- internal label for admin reference
  content_html text NOT NULL,                         -- rich HTML content (colors, bold, etc.)
  pages       text[] NOT NULL DEFAULT '{all}',        -- target pages: 'all', '/', '/app', '/admin', '/login', etc.
  bg_color    text NOT NULL DEFAULT '#1e40af',        -- banner background color (hex)
  text_color  text NOT NULL DEFAULT '#ffffff',        -- banner text color (hex)
  is_active   boolean NOT NULL DEFAULT true,
  start_at    timestamptz,                            -- schedule: show from (null = immediately)
  end_at      timestamptz,                            -- schedule: show until (null = forever)
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_banners_active ON banners(is_active, start_at, end_at);
