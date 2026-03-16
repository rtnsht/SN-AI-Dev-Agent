-- OTP support: add otp_code column to auth_tokens for 6-digit verification codes
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS otp_code TEXT;

CREATE INDEX IF NOT EXISTS auth_tokens_email_otp_idx
  ON auth_tokens (email, otp_code, type) WHERE used_at IS NULL;
