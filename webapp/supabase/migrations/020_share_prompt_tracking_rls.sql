-- Hardening: enable RLS with no policies so PostgREST anon/authenticated cannot read/write this table.
-- Server routes use service_role and bypass RLS.

alter table if exists public.share_prompt_tracking enable row level security;
