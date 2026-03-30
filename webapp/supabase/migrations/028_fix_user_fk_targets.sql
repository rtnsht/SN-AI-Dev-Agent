-- ============================================
-- FIX: Repoint user_id FKs from auth.users to public.users
-- Migrations 021-024 incorrectly reference auth.users(id)
-- but the app uses public.users for its custom auth system.
-- Migration: 028
-- Created: 2026-03-29
-- ============================================

ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_user_id_fkey;
ALTER TABLE public.chats ADD CONSTRAINT chats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.session_artifacts DROP CONSTRAINT IF EXISTS session_artifacts_user_id_fkey;
ALTER TABLE public.session_artifacts ADD CONSTRAINT session_artifacts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_api_keys DROP CONSTRAINT IF EXISTS user_api_keys_user_id_fkey;
ALTER TABLE public.user_api_keys ADD CONSTRAINT user_api_keys_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_system_connections DROP CONSTRAINT IF EXISTS user_system_connections_user_id_fkey;
ALTER TABLE public.user_system_connections ADD CONSTRAINT user_system_connections_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
