CREATE TABLE model_config (
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

INSERT INTO model_config (provider, model_key, label, model_id, context_window, max_output, input_cost_per_1m, output_cost_per_1m, is_free, is_default, is_server_free, capabilities, display_order) VALUES
('minimax', 'minimax-m2.7', 'MiniMax-M2.7', 'MiniMax-M2.7', 1000000, 8192, 0, 0, TRUE, TRUE, TRUE, '["chat", "streaming"]', 1),
('anthropic', 'claude-sonnet-4.6', 'Claude Sonnet 4.6', 'anthropic/claude-sonnet-4.6', 200000, 8192, 3, 15, FALSE, FALSE, FALSE, '["chat", "streaming", "tools"]', 2),
('openrouter', 'openrouter-free', 'OpenRouter Free', 'openrouter/free', 128000, 8192, 0, 0, TRUE, FALSE, FALSE, '["chat", "streaming"]', 3),
('google', 'gemini-3.1-flash', 'Gemini 3.1 Flash', 'google/gemini-3.1-flash', 1000000, 8192, 0, 0, TRUE, FALSE, FALSE, '["chat", "streaming", "tools", "image-generation"]', 4),
('openai', 'gpt-5.4', 'GPT-5.4', 'openai/gpt-5.4', 200000, 16384, 1.5, 6, FALSE, FALSE, FALSE, '["chat", "streaming", "tools"]', 5);