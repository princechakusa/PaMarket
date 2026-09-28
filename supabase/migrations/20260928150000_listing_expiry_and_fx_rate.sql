-- ============================================================================
-- Listing expiry UX + automatic USD→ZiG rate.
--
-- 1. Expired ads now get status 'expired' instead of 'deleted', so sellers
--    still see them in My Listings and can Relist with one tap (previously
--    they vanished — indistinguishable from ads the seller deleted).
--    renew_listing() also brings an expired ad back.
-- 2. Expiry warning push: no emoji, and deep-links to /listing/<id> (was the
--    retired Capacitor "Detail?id=" route).
-- 3. set_fx_rate(): the automation runner refreshes app_settings.fxRate from
--    the market feed every few hours while fxRateMode is 'auto' (default).
--    Admin can switch fxRateMode to 'manual' and type a rate instead.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ── 1. 'expired' status ─────────────────────────────────────────────────────
-- NOT VALID: only new writes are checked, so an unexpected legacy value on
-- an old row can never make this migration fail.
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in (
    'pending', 'active', 'paused', 'under_review', 'flagged', 'rejected',
    'sold', 'removed', 'deleted', 'expired'
  )) not valid;

create or replace function public.expire_old_listings()
returns void
language plpgsql
set search_path = public
as $$
begin
  perform set_config('pamarket.expiry_cleanup', 'on', true);

  update public.listings
  set status = 'expired'
  where status = 'active'
    and expires_at < now();

  perform set_config('pamarket.expiry_cleanup', 'off', true);
end;
$$;
revoke all on function public.expire_old_listings() from public, anon, authenticated;
grant execute on function public.expire_old_listings() to service_role;

create or replace function public.renew_listing(listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Active: extend. Expired: relist (ensure_active_listing_expiry starts a
  -- fresh window on the status change as well).
  update public.listings
  set expires_at = now() + interval '4 months',
      expiry_warned_at = null,
      status = case when status = 'expired' then 'active' else status end
  where id = $1
    and seller_id = (select auth.uid())
    and status in ('active', 'expired');
end;
$$;
revoke all on function public.renew_listing(uuid) from public, anon;
grant execute on function public.renew_listing(uuid) to authenticated, service_role;

-- ── 2. Expiry warning copy + deep link ──────────────────────────────────────
create or replace function public.run_listing_expiry_warnings()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select id, seller_id, title, category, expires_at
    from public.listings
    where status = 'active'
      and expires_at is not null
      and expires_at <= now() + interval '3 days'
      and expires_at > now()
      and expiry_warned_at is null
    limit 500
  loop
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.seller_id::text,
        'Your ad expires soon',
        '"' || rec.title || '" goes offline on ' || to_char(rec.expires_at, 'Mon DD')
          || '. Tap to renew it for free and stay visible to buyers.',
        'listing_expiry', '/listing/' || rec.id, now()
      );
      update public.listings set expiry_warned_at = now() where id = rec.id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_listing_expiry_warnings: failed for listing %: %', rec.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('warned', v_count);
end;
$$;
revoke all on function public.run_listing_expiry_warnings() from public, anon, authenticated;
grant execute on function public.run_listing_expiry_warnings() to service_role;

-- ── 3. Exchange rate ────────────────────────────────────────────────────────
update public.app_settings
set settings = coalesce(settings, '{}'::jsonb)
               || jsonb_build_object('fxRateMode', coalesce(settings ->> 'fxRateMode', 'auto'))
where id = 1;

-- Atomic jsonb merge (never overwrites admin's other keys). Skips when admin
-- has switched to manual mode. Service role only (automation runner).
create or replace function public.set_fx_rate(p_rate numeric, p_source text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_rate is null or p_rate <= 0 or p_rate > 100000 then return false; end if;
  update public.app_settings
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'fxRate', round(p_rate, 4),
        'fxRateUpdatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'fxRateSource', p_source)
  where id = 1
    and coalesce(settings ->> 'fxRateMode', 'auto') = 'auto';
  return found;
end;
$$;
revoke all on function public.set_fx_rate(numeric, text) from public, anon, authenticated;
grant execute on function public.set_fx_rate(numeric, text) to service_role;

notify pgrst, 'reload schema';
