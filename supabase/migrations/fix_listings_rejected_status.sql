-- ============================================================================
-- PaMarket — Fix listings_status_check missing 'rejected'
-- ----------------------------------------------------------------------------
-- www/js/moderation.js sets listings.status = 'rejected' when an admin
-- rejects a listing (content-filter auto-reject, duplicate detection, daily
-- posting-limit block), but listings_status_check has never included
-- 'rejected' as an allowed value — neither in moderation_backend_phase_a.sql
-- (2026-07-07) nor 202607140002_listing_paused_status.sql (2026-07-14, the
-- current live version). Every reject attempt throws:
--   ERROR: new row for relation "listings" violates check constraint
--   "listings_status_check"
--
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================================

alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in (
    'pending', 'active', 'paused', 'under_review', 'flagged', 'rejected',
    'sold', 'removed', 'deleted'
  ));

notify pgrst, 'reload schema';

-- ============================================================================
-- Verification (run manually, not part of the migration):
--
--   update listings set status = 'rejected' where id = '<some listing id>';
--   -- expect: success, no constraint error
-- ============================================================================
