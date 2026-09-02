-- Follow-up to 20260902120000_extend_listing_expiry_to_4_months.sql:
-- (1) restore every remaining cron-expired listing, not just the last 3
-- months, and (2) give every listing a uniform fresh 4-month runway from
-- right now, instead of computed from each one's original created_at.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

begin;

-- ── 1. Restore every listing the hourly cron auto-expired, any age ──────
-- Same cron-vs-manual-deletion correlation guard as before (updated_at
-- tracks expires_at closely), just without the 3-month floor this time.
update public.listings
set status = 'active'
where status = 'deleted'
  and updated_at >= expires_at
  and updated_at <= expires_at + interval '2 days';

-- ── 2. Every active listing (already-active + just-restored) gets a
-- uniform expires_at = now() + 4 months, not created_at + 4 months --
-- so nobody's listing is already partway through its window.
update public.listings
set expires_at = now() + interval '4 months',
    expiry_warned_at = null
where status = 'active';

commit;

-- Verification (run manually after applying):
--   select status, count(*) from public.listings group by status;
--   select min(expires_at), max(expires_at) from public.listings where status='active';
