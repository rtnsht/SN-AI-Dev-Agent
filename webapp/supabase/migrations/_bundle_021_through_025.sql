-- Bundle: Migrations 021-025 for Platform Redesign v2
-- Run this in Supabase Dashboard → SQL Editor
-- Created: 2026-03-28

-- ============================================================================
-- 021: Chats and Messages Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Chat',
  mode TEXT NOT NULL DEFAULT 'agent' CHECK (mode IN ('agent', 'quick')),
  active_tab_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chats_user_id_idx ON chats(user_id);
CREATE INDEX IF NOT EXISTS chats_created_at_idx ON chats(created_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content TEXT,
  model_used TEXT,
  provider TEXT,
  token_count INTEGER,
  context_items JSONB DEFAULT '[]',
  artifacts JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  sort_key BIGINT NOT NULL DEFAULT (extract(epoch_ms from now()))::bigint,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_chat_id_idx ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS chat_messages_sort_key_idx ON chat_messages(sort_key);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chats" ON chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own messages" ON chat_messages FOR ALL USING (EXISTS (SELECT 1 FROM chats WHERE id = chat_id AND user_id = auth.uid()));

-- ============================================================================
-- 022: Session Artifacts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('code', 'diagram', 'document', 'spec', 'test', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  content TEXT,
  mime_type TEXT,
  tool_name TEXT,
  vapt_evaluated BOOLEAN DEFAULT FALSE,
  vapt_severity TEXT CHECK (vapt_severity IN ('critical', 'high', 'medium', 'low', 'none')),
  vapt_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_artifacts_user_id_idx ON session_artifacts(user_id);
CREATE INDEX IF NOT EXISTS session_artifacts_chat_id_idx ON session_artifacts(chat_id);

ALTER TABLE session_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own artifacts" ON session_artifacts FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 023: User API Keys Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'google', 'openai', 'anthropic', 'minimax', 'other')),
  label TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hint TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_api_keys_user_id_idx ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS user_api_keys_provider_idx ON user_api_keys(provider);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own api keys" ON user_api_keys FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 024: User System Connections Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_system_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL CHECK (system_type IN ('servicenow', 'jira', 'salesforce', 'github', 'other')),
  label TEXT NOT NULL,
  instance_url TEXT NOT NULL,
  credentials_enc TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_system_connections_user_id_idx ON user_system_connections(user_id);
CREATE INDEX IF NOT EXISTS user_system_connections_system_type_idx ON user_system_connections(system_type);

ALTER TABLE user_system_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own connections" ON user_system_connections FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 025: Model Config Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'google', 'openai', 'anthropic', 'minimax', 'free')),
  model_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  model_id TEXT NOT NULL,
  context_window INTEGER NOT NULL,
  max_output INTEGER NOT NULL DEFAULT 8192,
  input_cost_per_1m NUMERIC(10,4) DEFAULT 0,
  output_cost_per_1m NUMERIC(10,4) DEFAULT 0,
  is_free BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  is_server_free BOOLEAN DEFAULT FALSE,
  capabilities JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE model_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read model_config" ON model_config FOR SELECT USING (true);
CREATE POLICY "Server can manage model_config" ON model_config FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Insert default models
INSERT INTO model_config (provider, model_key, label, model_id, context_window, max_output, input_cost_per_1m, output_cost_per_1m, is_free, is_default, is_server_free, capabilities, display_order) VALUES
('minimax', 'minimax-m2.7', 'MiniMax-M2.7', 'MiniMax-M2.7', 1000000, 8192, 0, 0, TRUE, TRUE, TRUE, '["chat", "streaming"]', 1),
('anthropic', 'claude-sonnet-4.6', 'Claude Sonnet 4.6', 'anthropic/claude-sonnet-4.6', 200000, 8192, 3, 15, FALSE, FALSE, FALSE, '["chat", "streaming", "tools"]', 2),
('openrouter', 'openrouter-free', 'OpenRouter Free', 'openrouter/free', 128000, 8192, 0, 0, TRUE, FALSE, FALSE, '["chat", "streaming"]', 3),
('google', 'gemini-3.1-flash', 'Gemini 3.1 Flash', 'google/gemini-3.1-flash', 1000000, 8192, 0, 0, TRUE, FALSE, FALSE, '["chat", "streaming", "tools", "image-generation"]', 4),
('openai', 'gpt-5.4', 'GPT-5.4', 'openai/gpt-5.4', 200000, 16384, 1.5, 6, FALSE, FALSE, FALSE, '["chat", "streaming", "tools"]', 5)
ON CONFLICT (model_key) DO NOTHING;

-- ============================================================================
-- Done! Verify with:
-- SELECT * FROM model_config;
-- ============================================================================
