-- ============================================
-- BUNDLED MIGRATIONS: 026 + 027
-- Landing Page CMS + Google OAuth Support
-- Created: 2026-03-28
-- ============================================

-- ============================================
-- LANDING PAGE CMS TABLES
-- Fully configurable content via database
-- Migration: 026
-- ============================================

-- 1. LANDING PAGE SECTIONS
-- Controls the order and visibility of sections
CREATE TABLE IF NOT EXISTS landing_sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key     TEXT NOT NULL UNIQUE,
  section_type    TEXT NOT NULL,
  title           TEXT,
  subtitle        TEXT,
  layout_config   JSONB DEFAULT '{}',
  display_order   INT NOT NULL DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. HERO CONTENT
CREATE TABLE IF NOT EXISTS landing_hero (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline        TEXT NOT NULL,
  tagline         TEXT,
  badge_text      TEXT,
  primary_cta_text  TEXT DEFAULT 'Get Started',
  primary_cta_link  TEXT DEFAULT '/signup',
  secondary_cta_text TEXT,
  secondary_cta_link TEXT,
  background_type   TEXT DEFAULT 'solid',
  background_value  TEXT DEFAULT '#0B0D12',
  visual_type       TEXT,
  visual_url        TEXT,
  visual_alt        TEXT,
  layout_split      JSONB DEFAULT '{"left": 60, "right": 40}',
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- 3. VALUE PROPOSITIONS
CREATE TABLE IF NOT EXISTS landing_value_props (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      UUID REFERENCES landing_sections(id) ON DELETE CASCADE,
  headline        TEXT NOT NULL,
  description     TEXT NOT NULL,
  quote_text      TEXT,
  quote_author    TEXT,
  quote_role      TEXT,
  visual_type     TEXT,
  visual_url      TEXT,
  visual_icon     TEXT,
  visual_position TEXT DEFAULT 'right',
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. FEATURE CARDS
CREATE TABLE IF NOT EXISTS landing_features (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      UUID REFERENCES landing_sections(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  icon_name       TEXT,
  icon_color      TEXT DEFAULT '#4C7DFF',
  card_style      TEXT DEFAULT 'default',
  link_url        TEXT,
  link_text       TEXT,
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 5. STATISTICS
CREATE TABLE IF NOT EXISTS landing_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      UUID REFERENCES landing_sections(id) ON DELETE CASCADE,
  value           TEXT NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  icon_name       TEXT,
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 6. CTA SECTIONS
CREATE TABLE IF NOT EXISTS landing_ctas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      UUID REFERENCES landing_sections(id) ON DELETE CASCADE,
  headline        TEXT NOT NULL,
  description     TEXT,
  button_text     TEXT NOT NULL DEFAULT 'Get Started',
  button_link     TEXT NOT NULL DEFAULT '/signup',
  button_style    TEXT DEFAULT 'primary',
  background_type TEXT DEFAULT 'gradient',
  background_value TEXT DEFAULT 'linear-gradient(135deg, #4C7DFF, #7C3AED)',
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 7. NAVIGATION LINKS
CREATE TABLE IF NOT EXISTS landing_nav_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label           TEXT NOT NULL,
  url             TEXT NOT NULL,
  is_button       BOOLEAN DEFAULT false,
  button_style    TEXT,
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 8. FOOTER LINKS
CREATE TABLE IF NOT EXISTS landing_footer_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        TEXT NOT NULL,
  label           TEXT NOT NULL,
  url             TEXT NOT NULL,
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 9. THEME CONFIG
CREATE TABLE IF NOT EXISTS landing_theme_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_mode      TEXT NOT NULL UNIQUE,
  bg_primary      TEXT NOT NULL,
  bg_secondary    TEXT NOT NULL,
  bg_elevated     TEXT NOT NULL,
  text_primary    TEXT NOT NULL,
  text_secondary  TEXT NOT NULL,
  text_muted      TEXT NOT NULL,
  accent_primary    TEXT NOT NULL,
  accent_primary_hover TEXT,
  accent_secondary  TEXT,
  border_color      TEXT,
  shadow_value      TEXT,
  font_family       TEXT DEFAULT 'Inter, sans-serif',
  headline_hero     TEXT DEFAULT 'clamp(48px, 8vw, 80px)',
  headline_section  TEXT DEFAULT 'clamp(32px, 4vw, 48px)',
  body_large        TEXT DEFAULT '20px',
  body              TEXT DEFAULT '16px',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 10. LANDING PAGE MEDIA
CREATE TABLE IF NOT EXISTS landing_media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_key       TEXT NOT NULL UNIQUE,
  media_type      TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'icon', 'illustration')),
  storage_source  TEXT,
  storage_path    TEXT,
  external_url    TEXT,
  alt_text        TEXT NOT NULL,
  width           INT,
  height          INT,
  mime_type       TEXT,
  file_size       INT,
  variants        JSONB DEFAULT '{}',
  title           TEXT,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_landing_sections_order ON landing_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_landing_value_props_section ON landing_value_props(section_id);
CREATE INDEX IF NOT EXISTS idx_landing_features_section ON landing_features(section_id);
CREATE INDEX IF NOT EXISTS idx_landing_stats_section ON landing_stats(section_id);
CREATE INDEX IF NOT EXISTS idx_landing_ctas_section ON landing_ctas(section_id);
CREATE INDEX IF NOT EXISTS idx_landing_nav_order ON landing_nav_links(display_order);
CREATE INDEX IF NOT EXISTS idx_landing_footer_category ON landing_footer_links(category);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE landing_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_hero ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_value_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_ctas ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_nav_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_footer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_theme_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_media ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PUBLIC Read Policies
-- ============================================
CREATE POLICY "Public can read landing sections" ON landing_sections FOR SELECT USING (true);
CREATE POLICY "Public can read landing hero" ON landing_hero FOR SELECT USING (true);
CREATE POLICY "Public can read landing value props" ON landing_value_props FOR SELECT USING (true);
CREATE POLICY "Public can read landing features" ON landing_features FOR SELECT USING (true);
CREATE POLICY "Public can read landing stats" ON landing_stats FOR SELECT USING (true);
CREATE POLICY "Public can read landing ctas" ON landing_ctas FOR SELECT USING (true);
CREATE POLICY "Public can read landing nav" ON landing_nav_links FOR SELECT USING (true);
CREATE POLICY "Public can read landing footer" ON landing_footer_links FOR SELECT USING (true);
CREATE POLICY "Public can read landing theme" ON landing_theme_config FOR SELECT USING (true);
CREATE POLICY "Public can read landing media" ON landing_media FOR SELECT USING (true);

-- ============================================
-- Admin Write Policies
-- ============================================
CREATE POLICY "Admins manage landing sections" ON landing_sections FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage landing hero" ON landing_hero FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage landing value props" ON landing_value_props FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage landing features" ON landing_features FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage landing stats" ON landing_stats FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage landing ctas" ON landing_ctas FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage landing nav" ON landing_nav_links FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage landing footer" ON landing_footer_links FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage landing theme" ON landing_theme_config FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage landing media" ON landing_media FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- SEED DATA
-- ============================================

-- Theme configs
INSERT INTO landing_theme_config (theme_mode, bg_primary, bg_secondary, bg_elevated, text_primary, text_secondary, text_muted, accent_primary, accent_primary_hover, accent_secondary, border_color, shadow_value) VALUES
('dark', '#0B0D12', '#161A22', '#1C2029', '#E6EDF3', '#8B949E', '#6B7280', '#4C7DFF', '#6B93FF', '#7C3AED', 'rgba(255,255,255,0.08)', '0 4px 24px rgba(0,0,0,0.4)'),
('light', '#FFFFFF', '#F9FAFB', '#F3F4F6', '#111827', '#6B7280', '#9CA3AF', '#2563EB', '#1D4ED8', '#7C3AED', '#E5E7EB', '0 4px 24px rgba(0,0,0,0.08)');

-- Sections
INSERT INTO landing_sections (section_key, section_type, title, display_order) VALUES
('hero', 'hero', 'Hero Section', 0),
('value_1', 'two_column', 'Spec-Driven Development', 10),
('value_2', 'two_column', 'Multi-Agent Orchestration', 20),
('features', 'cards', 'Features', 30),
('stats', 'stats', 'By the Numbers', 40),
('cta', 'cta', 'Get Started', 50);

-- Hero content
INSERT INTO landing_hero (headline, tagline, badge_text, primary_cta_text, primary_cta_link, background_type, background_value, layout_split) VALUES
('SHIP SERVICENOW FEATURES WITH AI', 'Ship features 10x faster with AI-powered development. Spec-driven, secure, and validated by design.', 'AI-first · Human-governed', 'Get Started', '/signup', 'solid', '#0B0D12', '{"left": 60, "right": 40}');

-- Value propositions
INSERT INTO landing_value_props (section_id, headline, description, quote_author, quote_role, visual_position, display_order) VALUES
((SELECT id FROM landing_sections WHERE section_key = 'value_1'), 'SPEC-DRIVEN DEVELOPMENT', 'Define requirements before writing code. Every feature follows a structured spec-design-implement-test-deploy cycle with full audit trails.', 'Development Lead', 'Enterprise SaaS Company', 'right', 0),
((SELECT id FROM landing_sections WHERE section_key = 'value_2'), 'MULTI-AGENT ORCHESTRATION', 'Eight specialized AI agents working together. Explorer, Builder, SDD, Analyzer, and more handle every phase of development automatically.', 'Platform Architect', 'Fortune 500', 'left', 0);

-- Features
INSERT INTO landing_features (section_id, title, description, icon_name, icon_color, display_order) VALUES
((SELECT id FROM landing_sections WHERE section_key = 'features'), 'Spec-Driven', 'Define specs before code. Structured requirements with approval gates.', 'file-text', '#4C7DFF', 0),
((SELECT id FROM landing_sections WHERE section_key = 'features'), 'Multi-Agent', '8 specialized AI agents working in concert for complete development lifecycle.', 'users', '#7C3AED', 10),
((SELECT id FROM landing_sections WHERE section_key = 'features'), 'VAPT Secured', 'Every artifact reviewed for security vulnerabilities before deployment.', 'shield-check', '#22C55E', 20);

-- Stats
INSERT INTO landing_stats (section_id, value, label, display_order) VALUES
((SELECT id FROM landing_sections WHERE section_key = 'stats'), '500+', 'Artifacts Deployed', 0),
((SELECT id FROM landing_sections WHERE section_key = 'stats'), '10x', 'Faster Development', 10),
((SELECT id FROM landing_sections WHERE section_key = 'stats'), '99%', 'Secure Deployments', 20);

-- CTA
INSERT INTO landing_ctas (section_id, headline, button_text, button_link, background_type, background_value) VALUES
((SELECT id FROM landing_sections WHERE section_key = 'cta'), 'Ready to transform your ServiceNow development?', 'Get Started Free', '/signup', 'gradient', 'linear-gradient(135deg, #4C7DFF, #7C3AED)');

-- Navigation
INSERT INTO landing_nav_links (label, url, is_button, button_style, display_order) VALUES
('Features', '#features', false, null, 0),
('Documentation', '/docs', false, null, 10),
('Sign In', '/login', false, null, 20),
('Get Started', '/signup', true, 'primary', 30);

-- Footer
INSERT INTO landing_footer_links (category, label, url, display_order) VALUES
('Product', 'Features', '#features', 0),
('Product', 'Pricing', '/pricing', 10),
('Product', 'Security', '/security', 20),
('Resources', 'Documentation', '/docs', 0),
('Resources', 'API Reference', '/api-docs', 10),
('Resources', 'Changelog', '/changelog', 20),
('Legal', 'Privacy', '/privacy', 0),
('Legal', 'Terms', '/terms', 10),
('Legal', 'Cookies', '/cookies', 20);

-- ============================================
-- GOOGLE OAUTH SUPPORT
-- Migration: 027
-- ============================================

-- Add auth_provider column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email'
  CHECK (auth_provider IN ('email', 'google'));

-- Add google_id column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- Create index on google_id
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Update auth_tokens type constraint
ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_type_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_type_check
  CHECK (type IN ('magic_link', 'email_verify', 'password_reset', 'oauth_state'));

-- ============================================
-- DONE!
-- ============================================
