-- ============================================================
-- PaMarket — allow admins to insert notifications for any user
--
-- Audit finding (Section 5, A1, HIGH): the admin panel notifies users on nearly
-- every moderation action — listing approved/rejected, account suspended/
-- reinstated, identity verified, company verified — by inserting a row with
-- user_id = the affected user. But the notifications INSERT policy is
-- `with check (auth.uid() = user_id)` (self-only, hardened to stop an anon read
-- leak). Under that policy every admin -> user notification is rejected by RLS,
-- so users are NEVER told their listing was approved/rejected, that they were
-- banned, or that their verification succeeded. Moderation is invisible to users.
--
-- Fix: widen the INSERT policy so a row is allowed when the caller owns it
-- (auth.uid() = user_id, unchanged) OR the caller is an admin. This keeps the
-- self-only guarantee for regular users while letting admins deliver moderation
-- notices. Cross-USER (non-admin) notifications — e.g. message notifications —
-- are handled by the security-definer message trigger, not by this policy.
--
-- Requires public.is_admin(). Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================

alter table public.notifications enable row level security;

drop policy if exists "own notifications: insert" on public.notifications;
drop policy if exists "notifications: self or admin insert" on public.notifications;
-- Cast both sides to text so this works whether notifications.user_id is uuid
-- (schema/notifications.sql) or text (as some live deployments have it) — avoids
-- a uuid = text operator error.
create policy "notifications: self or admin insert"
  on public.notifications for insert
  to authenticated
  with check (auth.uid()::text = user_id::text or public.is_admin());
