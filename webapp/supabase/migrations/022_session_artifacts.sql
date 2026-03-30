CREATE TABLE session_artifacts (
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
CREATE INDEX session_artifacts_user_id_idx ON session_artifacts(user_id);
CREATE INDEX session_artifacts_chat_id_idx ON session_artifacts(chat_id);
ALTER TABLE session_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own artifacts" ON session_artifacts FOR ALL USING (auth.uid() = user_id);