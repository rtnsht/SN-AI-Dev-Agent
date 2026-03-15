-- Feedback & Issue Reporting table
CREATE TABLE public.feedback_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN ('feedback', 'bug_report')),
  description     text NOT NULL,
  email           text,
  attachment_urls  text[] DEFAULT '{}',
  attachment_data  jsonb[] DEFAULT '{}',   -- file byte data: [{name, mime_type, size, data_base64}]
  page_url        text,
  user_agent      text,
  ip_address      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_feedback_reports_created_at ON feedback_reports(created_at DESC);
CREATE INDEX idx_feedback_reports_type ON feedback_reports(type);

-- NOTE: Create Supabase Storage bucket "feedback-attachments" via dashboard:
--   - Public access: OFF
--   - File size limit: 10MB
--   - Allowed MIME types: image/png, application/pdf,
--     application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document,
--     application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
