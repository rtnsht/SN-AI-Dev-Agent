CREATE TABLE user_system_connections (
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
CREATE INDEX user_system_connections_user_id_idx ON user_system_connections(user_id);
CREATE INDEX user_system_connections_system_type_idx ON user_system_connections(system_type);
ALTER TABLE user_system_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own connections" ON user_system_connections FOR ALL USING (auth.uid() = user_id);