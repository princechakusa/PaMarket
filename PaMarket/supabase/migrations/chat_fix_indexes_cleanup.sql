-- =============================================================
-- PAmarket: chat fix, index optimisation, inactivity cleanup
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CONVERSATIONS — delete policy
-- ─────────────────────────────────────────────────────────────
drop policy if exists "conversations: member delete" on public.conversations;
create policy "conversations: member delete"
  on public.conversations for delete
  using (auth.uid() = any(members));

-- Btree indexes for cleanup queries (GIN already exists from schema)
create index if not exists conversations_updated_at_idx
  on public.conversations (updated_at);

create index if not exists conversations_created_at_idx
  on public.conversations (created_at);

-- ─────────────────────────────────────────────────────────────
-- 2. MESSAGES — additional performance indexes
--    (messages_conv_created_idx already exists from schema.sql)
-- ─────────────────────────────────────────────────────────────
create index if not exists messages_sender_idx
  on public.messages (sender_id);

create index if not exists messages_sender_created_idx
  on public.messages (sender_id, created_at desc);

create index if not exists messages_created_at_idx
  on public.messages (created_at);

-- ─────────────────────────────────────────────────────────────
-- 3. PROFILES — indexes  (updated_at exists per schema)
-- ─────────────────────────────────────────────────────────────
create index if not exists profiles_updated_at_idx
  on public.profiles (updated_at);

create index if not exists profiles_status_idx
  on public.profiles (status)
  where status <> 'active';

create index if not exists profiles_role_idx
  on public.profiles (role)
  where role <> 'user';

-- ─────────────────────────────────────────────────────────────
-- 4. LISTINGS — search / filter / sort indexes
--    (listings_seller_idx, listings_status_idx, listings_category_idx,
--     listings_created_idx already exist from schema.sql)
-- ─────────────────────────────────────────────────────────────
create index if not exists listings_seller_created_idx
  on public.listings (seller_id, created_at desc);

create index if not exists listings_category_active_idx
  on public.listings (category)
  where status = 'active';

create index if not exists listings_province_active_idx
  on public.listings (province)
  where status = 'active';

create index if not exists listings_category_province_idx
  on public.listings (category, province)
  where status = 'active';

create index if not exists listings_price_active_idx
  on public.listings (price)
  where status = 'active';

create index if not exists listings_status_created_idx
  on public.listings (status, created_at desc);

create index if not exists listings_boost_active_idx
  on public.listings (boost)
  where boost is not null and status = 'active';

-- ─────────────────────────────────────────────────────────────
-- 5. NOTIFICATIONS — type filter index
--    (notifications_user_created_idx, notifications_user_unread_idx
--     already exist from schema.sql)
-- ─────────────────────────────────────────────────────────────
create index if not exists notifications_type_idx
  on public.notifications (user_id, type, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 6. REPORTS — reports table uses created_at
-- ─────────────────────────────────────────────────────────────
create index if not exists reports_status_open_idx
  on public.reports (status)
  where status = 'open';

create index if not exists reports_reporter_idx
  on public.reports (reporter_id);

create index if not exists reports_target_idx
  on public.reports (target_type, target_id);

-- ─────────────────────────────────────────────────────────────
-- 7. USER_SAVES — user_saves uses saved_at (not created_at)
--    unique(user_id, listing_id) already defined in schema
-- ─────────────────────────────────────────────────────────────
create index if not exists user_saves_user_idx
  on public.user_saves (user_id);

create index if not exists user_saves_listing_idx
  on public.user_saves (listing_id);

-- ─────────────────────────────────────────────────────────────
-- 8. TOPUP_REQUESTS — uses created_at
-- ─────────────────────────────────────────────────────────────
create index if not exists topup_requests_user_idx
  on public.topup_requests (user_id, created_at desc);

create index if not exists topup_requests_status_pending_idx
  on public.topup_requests (status)
  where status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- 9. APPLICATIONS — uses applied_at (not created_at)
--    applications_applicant_idx, applications_employer_idx,
--    applications_job_idx already exist from schema.sql
-- ─────────────────────────────────────────────────────────────
create index if not exists applications_applicant_applied_idx
  on public.applications (applicant_id, applied_at desc);

create index if not exists applications_employer_applied_idx
  on public.applications (employer_id, applied_at desc);

-- ─────────────────────────────────────────────────────────────
-- 10. REVIEWS — reviews_seller_idx, reviews_reviewer_idx
--     already exist from schema.sql — nothing to add
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 11. SAVED_SEARCHES — uses saved_at (not created_at)
-- ─────────────────────────────────────────────────────────────
create index if not exists saved_searches_user_idx
  on public.saved_searches (user_id, saved_at desc);

-- ─────────────────────────────────────────────────────────────
-- 12. 30-DAY INACTIVITY CLEANUP FUNCTION
-- ─────────────────────────────────────────────────────────────
create or replace function public.cleanup_inactive_chat_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - interval '30 days';
begin
  -- Delete messages sent by users whose profile has not been updated in 30 days
  delete from public.messages m
  where m.created_at < cutoff
    and exists (
      select 1 from public.profiles p
      where p.id = m.sender_id
        and p.updated_at < cutoff
    );

  -- Delete conversations with no remaining messages that are also older than cutoff
  delete from public.conversations c
  where c.updated_at < cutoff
    and not exists (
      select 1 from public.messages m
      where m.conversation_id = c.id
    );

  -- Delete notifications older than 30 days
  delete from public.notifications
  where created_at < cutoff;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 13. SCHEDULE CLEANUP VIA pg_cron (optional — run manually)
--
--     pg_cron is NOT enabled by default on Supabase free tier.
--     To enable it:
--       Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable
--
--     Then run this separately in the SQL editor AFTER enabling:
--
--       select cron.schedule(
--         'pamarket-chat-cleanup',
--         '0 2 * * *',
--         $cron$ select public.cleanup_inactive_chat_data(); $cron$
--       );
--
--     Alternative: call cleanup_inactive_chat_data() from a
--     Supabase Edge Function scheduled via the Supabase cron UI.
-- ─────────────────────────────────────────────────────────────
