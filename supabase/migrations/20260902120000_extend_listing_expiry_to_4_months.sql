-- Extend listing lifetime from 30 days to 4 months, and restore listings
-- that the hourly expiry cron auto-deleted in the last 3 months under the
-- old, much shorter window.
--
-- Context: 20260819203749_listing_expiry_authority.sql made expiry
-- authoritative -- ensure_active_listing_expiry() sets a fresh 30-day
-- window whenever a listing (re)enters 'active', renew_listing() extends by
-- another 30 days, and the hourly cron (expire_old_listings) transitions
-- any active listing past its expires_at straight to status='deleted'.
-- 30 days turned out far too aggressive for this market -- sellers were
-- losing live listings before buyers had a real chance to find them.
--
-- Run once in the Supabase SQL Editor. Safe to re-run: CREATE OR REPLACE
-- is idempotent, the active-listing extension only ever lengthens
-- expires_at (never shortens it), and the restore's WHERE clause only
-- matches rows still sitting at status='deleted' -- once restored to
-- 'active' they no longer match on a second run.

begin;

-- ── 1. New default: 4 months instead of 30 days ─────────────────────────
create or replace function public.ensure_active_listing_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' and new.expires_at is null then
      new.expires_at := now() + interval '4 months';
      new.expiry_warned_at := null;
    end if;
  elsif new.status = 'active' and old.status is distinct from 'active' then
    new.expires_at := now() + interval '4 months';
    new.expiry_warned_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.renew_listing(listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
  set expires_at = now() + interval '4 months',
      expiry_warned_at = null
  where id = $1
    and seller_id = (select auth.uid());
end;
$$;

revoke all on function public.renew_listing(uuid) from public, anon;
grant execute on function public.renew_listing(uuid) to authenticated, service_role;

-- ── 2. Currently-active listings were given a 30-day window at creation --
-- give them the benefit of the new 4-month policy too, not just listings
-- created/renewed from here on. Only ever extends, never shortens (a
-- manual renewal could already be further out than created_at + 4 months).
update public.listings
set expires_at = greatest(expires_at, created_at + interval '4 months'),
    expiry_warned_at = null
where status = 'active'
  and expires_at < created_at + interval '4 months';

-- ── 3. Restore listings the hourly cron auto-expired in the last 3 months.
-- The cron sets status='deleted' with no distinct marker from a real
-- user/admin deletion, so this restore only matches rows whose updated_at
-- closely tracks their expires_at -- exactly what the cron leaves behind
-- (either ~within the hour, for one caught by a normal run, or a shared
-- timestamp across many rows, for a backlog catch-up run after the cron
-- was first deployed) -- rather than every status='deleted' row blindly.
-- The trigger above (now already updated to 4 months) sets the fresh
-- expires_at/clears expiry_warned_at automatically on this status change.
update public.listings
set status = 'active'
where status = 'deleted'
  and expires_at >= now() - interval '3 months'
  and updated_at >= expires_at
  and updated_at <= expires_at + interval '2 days';

commit;

-- Verification (run manually after applying):
--   select status, count(*) from public.listings group by status;
--   select id, title, status, expires_at, expiry_warned_at
--     from public.listings order by updated_at desc limit 20;
