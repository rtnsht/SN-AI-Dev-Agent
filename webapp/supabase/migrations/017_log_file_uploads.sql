-- ============================================================================
-- Migration 014: Log File Uploads metadata table
--
-- Tracks which log files have been uploaded to which storage providers.
-- Supports multi-provider uploads (one row per filename+provider).
-- Used by the LogStorageSync cron to avoid re-uploading unchanged files.
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_file_uploads (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename        TEXT NOT NULL,
  provider        TEXT NOT NULL,
  remote_key      TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  file_mtime      TIMESTAMPTZ NOT NULL,
  etag            TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  upload_duration_ms INTEGER NOT NULL DEFAULT 0,
  bucket          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('uploaded', 'failed', 'pending')),
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Composite unique: one record per file per provider
  UNIQUE (filename, provider)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_log_file_uploads_status
  ON log_file_uploads (status);
CREATE INDEX IF NOT EXISTS idx_log_file_uploads_provider
  ON log_file_uploads (provider);
CREATE INDEX IF NOT EXISTS idx_log_file_uploads_uploaded_at
  ON log_file_uploads (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_file_uploads_filename
  ON log_file_uploads (filename);

-- RLS: disable for server-side-only access (service_role key)
ALTER TABLE log_file_uploads ENABLE ROW LEVEL SECURITY;
