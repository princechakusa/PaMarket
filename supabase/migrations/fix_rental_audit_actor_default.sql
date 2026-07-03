-- ============================================================
-- PaMarket — record WHO performed each rental admin action (Module 9)
--
-- rental_audit_logs.actor_id had no default, and the admin client inserts audit
-- rows without setting it, so every entry showed actor_id = NULL ("system") —
-- the audit trail could not answer "which admin did this". Add a server-side
-- default of auth.uid() so the acting admin is recorded automatically and
-- tamper-proof (the client cannot forge a different actor; if it omits the
-- column the DB fills in the real caller). Also default actor_role sensibly.
--
-- This does NOT change RLS or who may write — only who is recorded. Idempotent.
-- Run once in the Supabase SQL Editor.
-- ============================================================

alter table public.rental_audit_logs
  alter column actor_id set default auth.uid();

-- Backfill role marker for future rows where an authenticated admin acted.
-- (Existing NULL rows are left as-is — historically unknown actor.)
alter table public.rental_audit_logs
  alter column actor_role set default 'admin';
