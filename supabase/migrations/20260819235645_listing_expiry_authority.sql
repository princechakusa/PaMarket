-- Listing expiry authority hardening.
--
-- Public visibility is enforced synchronously by RLS. The hourly cron is
-- lifecycle cleanup only, so a delayed/failed cron cannot expose expired ads.
-- Existing rows are not modified by this migration itself.

begin;

-- Supports both the active-expiry cleanup scan and public expiry predicates.
create index if not exists listings_active_expires_at_idx
  on public.listings (expires_at)
  where status = 'active';

-- Production currently has zero NULL expiry rows and the product contract is a
-- 30-day lifetime. Fail rather than silently rewriting data if that changes
-- before deployment, then make the invariant explicit.
do $$
begin
  if exists (select 1 from public.listings where expires_at is null) then
    raise exception 'Cannot enforce listing expiry: NULL expires_at rows exist';
  end if;
end;
$$;

alter table public.listings alter column expires_at set not null;

-- A new active listing receives the legacy 30-day default if a caller omitted
-- expiry. Every real transition back to active starts a deterministic fresh
-- 30-day window and clears the warning dedupe marker.
create or replace function public.ensure_active_listing_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' and new.expires_at is null then
      new.expires_at := now() + interval '30 days';
      new.expiry_warned_at := null;
    end if;
  elsif new.status = 'active' and old.status is distinct from 'active' then
    new.expires_at := now() + interval '30 days';
    new.expiry_warned_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ensure_active_listing_expiry on public.listings;
create trigger trg_ensure_active_listing_expiry
  before insert or update of status, expires_at on public.listings
  for each row
  execute function public.ensure_active_listing_expiry();

-- Renewal extends a listing without changing moderation or lifecycle status.
-- It also makes a future T-3 warning eligible for the renewed window.
create or replace function public.renew_listing(listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
  set expires_at = now() + interval '30 days',
      expiry_warned_at = null
  where id = $1
    and seller_id = (select auth.uid());
end;
$$;

revoke all on function public.renew_listing(uuid) from public, anon;
grant execute on function public.renew_listing(uuid) to authenticated, service_role;

-- Cleanup is idempotent and preserves rows: expired active listings transition
-- to the existing 'deleted' status. The transaction-local flag prevents the
-- moderation trigger from sending a false "listing rejected" notification.
create or replace function public.expire_old_listings()
returns void
language plpgsql
set search_path = public
as $$
begin
  perform set_config('pamarket.expiry_cleanup', 'on', true);

  update public.listings
  set status = 'deleted'
  where status = 'active'
    and expires_at < now();

  perform set_config('pamarket.expiry_cleanup', 'off', true);
end;
$$;

revoke all on function public.expire_old_listings() from public, anon, authenticated;
grant execute on function public.expire_old_listings() to service_role;

-- Profile rows are intentionally not public-readable, so a direct profiles
-- subquery in the listings RLS policy would hide every listing from anonymous
-- users. Keep the account/business check behind a narrowly-scoped definer
-- helper in a non-exposed schema. It returns only eligibility for the supplied
-- principals; it does not expose profile or business data.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.listing_principals_are_active(
  p_seller_id uuid,
  p_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = p_seller_id
        and p.status = 'active'
    )
    and (
      p_business_id is null
      or exists (
        select 1
        from public.businesses b
        where b.id = p_business_id
          and b.status = 'active'
      )
    );
$$;

revoke all on function private.listing_principals_are_active(uuid, uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.listing_principals_are_active(uuid, uuid) to anon, authenticated;

-- Preserve the existing moderation notification function while excluding only
-- status transitions performed by expire_old_listings().
drop trigger if exists trg_notify_listing_status_change on public.listings;
create trigger trg_notify_listing_status_change
  after update of status on public.listings
  for each row
  when (
    old.status is distinct from new.status
    and current_setting('pamarket.expiry_cleanup', true) is distinct from 'on'
  )
  execute function public.notify_listing_status_change();

-- Public discovery requires both an active lifecycle state and a live expiry.
-- Owners and admins retain their existing management visibility.
drop policy if exists "listings: public read active" on public.listings;
create policy "listings: public read active"
  on public.listings
  for select
  to public
  using (
    (
      status = 'active'
      and expires_at > now()
      and private.listing_principals_are_active(seller_id, business_id)
    )
    or (select auth.uid()) = seller_id
    or (select public.is_admin())
  );

-- Schedule at most one equivalent cleanup. Re-running this migration cannot
-- create a duplicate, and an existing differently-named equivalent is kept.
do $$
declare
  v_job_id bigint;
  v_job_name text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is required for listing expiry cleanup';
  end if;

  select jobid, jobname
    into v_job_id, v_job_name
  from cron.job
  where active
    and (
      jobname = 'pamarket-expire-listings-hourly'
      or command ~* 'expire_old_listings[[:space:]]*[(]'
    )
  order by (jobname = 'pamarket-expire-listings-hourly') desc, jobid
  limit 1;

  if v_job_id is null then
    perform cron.schedule(
      'pamarket-expire-listings-hourly',
      '5 * * * *',
      $cron$select public.expire_old_listings()$cron$
    );
  elsif v_job_name = 'pamarket-expire-listings-hourly' then
    -- pg_cron updates an existing job when cron.schedule receives its name.
    perform cron.schedule(
      'pamarket-expire-listings-hourly',
      '5 * * * *',
      $cron$select public.expire_old_listings()$cron$
    );
  else
    raise notice 'Equivalent listing-expiry cron already exists as job % (%)',
      v_job_name, v_job_id;
  end if;
end;
$$;

commit;
