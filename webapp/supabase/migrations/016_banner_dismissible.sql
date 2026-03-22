-- Add dismissible flag to banners table
-- false = non-dismissible (pinned, no X button), true = user can dismiss
ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS dismissible boolean NOT NULL DEFAULT true;
