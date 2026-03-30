CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Chat',
  mode TEXT NOT NULL DEFAULT 'agent' CHECK (mode IN ('agent', 'quick')),
  active_tab_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chats_user_id_idx ON chats(user_id);
CREATE INDEX chats_created_at_idx ON chats(created_at DESC);

CREATE TABLE chat_messages (
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
CREATE INDEX chat_messages_chat_id_idx ON chat_messages(chat_id);
CREATE INDEX chat_messages_sort_key_idx ON chat_messages(sort_key);
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chats" ON chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own messages" ON chat_messages FOR ALL USING (EXISTS (SELECT 1 FROM chats WHERE id = chat_id AND user_id = auth.uid()));