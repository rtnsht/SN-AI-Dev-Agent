-- AUTH-GATE: Invite-only access gate tables
-- Run this in Supabase SQL Editor to create all required tables.

-- ── users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  name          text NOT NULL,
  password_hash text,
  role          text NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended')),
  must_set_password boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login    timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));

-- ── access_requests ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  name            text NOT NULL,
  company         text,
  use_case        text NOT NULL,
  status          text NOT NULL DEFAULT 'pending_verification'
                    CHECK (status IN ('pending_verification', 'pending', 'approved', 'rejected')),
  email_verified  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,
  reviewed_by     text
);

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_email_idx ON access_requests (lower(email));
CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests (status);

-- ── sessions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         text NOT NULL,
  is_temporary  boolean NOT NULL DEFAULT false,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  ip_address    text,
  user_agent    text
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- ── auth_tokens ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  token       text NOT NULL,
  type        text NOT NULL
                CHECK (type IN ('magic_link', 'email_verify', 'password_reset')),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_tokens_token_idx ON auth_tokens (token);
CREATE INDEX IF NOT EXISTS auth_tokens_email_type_idx ON auth_tokens (email, type);

-- ── invite_codes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  created_by  uuid NOT NULL REFERENCES users(id),
  label       text,
  max_uses    int,
  times_used  int NOT NULL DEFAULT 0,
  expires_at  timestamptz,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_code_idx ON invite_codes (code);

