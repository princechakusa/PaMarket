-- ============================================================
-- fix_notifications_rls_missing.sql
--
-- SECURITY — found during the rental notification-isolation audit
-- (2026-07-03), NOT a rental-specific bug.
--
-- The correct RLS policies for `notifications` exist in
-- supabase/schema/notifications.sql, but a live check against production
-- confirmed they are NOT enforced: the anon key can currently read every
-- user's notifications in full (id, user_id, title, body) —
--   curl .../rest/v1/notifications?select=id,user_id,title,body
-- returned other users' "Verify your account" notifications with no
-- authentication at all. This means schema/notifications.sql was written
-- but never actually deployed to this project (same class of gap as the
-- get-r2-upload-url Edge Function being stale).
--
-- This migration re-applies the same 4 policies (idempotent — safe to run
-- even if some already exist). Run once in the Supabase SQL Editor.
-- ============================================================

alter table public.notifications enable row level security;

drop policy if exists "own notifications: select" on public.notifications;
create policy "own notifications: select"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "own notifications: update" on public.notifications;
create policy "own notifications: update"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own notifications: insert" on public.notifications;
create policy "own notifications: insert"
  on public.notifications for insert
  with check (auth.uid() = user_id);

drop policy if exists "own notifications: delete" on public.notifications;
create policy "own notifications: delete"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- ── VERIFY (run after, as anon — should return an empty array or a 401,
--    never another user's notification content) ──
-- select id, user_id, title, body from notifications limit 3;
-- ============================================================
