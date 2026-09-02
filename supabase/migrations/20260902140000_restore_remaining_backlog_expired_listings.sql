-- 20260902130000's restore missed a whole batch: those 21 listings were
-- caught by the expiry cron's very first run on 2026-08-19 (a backlog
-- catch-up covering weeks of overdue listings at once), so updated_at sits
-- WAY past expires_at + 2 days -- the correlation window used before was
-- too tight for that one-time catch-up run, though it correctly matched
-- ordinary hourly runs.
--
-- Better signal, verified against the data: the cron always fires at
-- minute :05 of the hour (schedule '5 * * * *'), so literally every row it
-- ever touches has updated_at sitting within a few seconds of :05:00,
-- regardless of how overdue the listing was. A manual user/admin deletion
-- landing in that same few-second window by coincidence is not realistic.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

begin;

update public.listings
set status = 'active'
where status = 'deleted'
  and extract(minute from updated_at) = 5
  and extract(second from updated_at) < 30;

-- Same uniform 4-month reset as before, now covering this batch too.
update public.listings
set expires_at = now() + interval '4 months',
    expiry_warned_at = null
where status = 'active';

commit;

-- Verification:
--   select status, count(*) from public.listings group by status;
