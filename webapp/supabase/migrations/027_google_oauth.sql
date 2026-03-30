-- ============================================
-- GOOGLE OAUTH SUPPORT
-- Adds auth_provider and google_id columns
-- Migration: 027
-- Created: 2026-03-28
-- ============================================

-- Add auth_provider column with check constraint
ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email'
  CHECK (auth_provider IN ('email', 'google'));

-- Add google_id column (nullable, unique for OAuth users)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- Create index on google_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Add oauth_state to auth_tokens type constraint
-- First drop the existing constraint, then add the new one
ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_type_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_type_check
  CHECK (type IN ('magic_link', 'email_verify', 'password_reset', 'oauth_state'));

-- ============================================
-- DONE! Verify with:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name IN ('auth_provider', 'google_id');
-- ============================================
