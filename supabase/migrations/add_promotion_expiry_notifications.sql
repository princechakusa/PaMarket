-- ============================================================================
-- PaMarket — promotion lifecycle notifications (expiring soon / ended)
-- ----------------------------------------------------------------------------
-- Nothing currently reads listings.featured_until to tell a seller their paid
-- promotion is about to lapse: `select proname from pg_proc where prosrc ilike
-- '%featured_until%' and prosrc ilike '%notification%'` returns nothing. A
-- seller's Boost or Featured placement simply stops, with no prompt to renew —
-- the highest-value reminder the marketplace is missing.
--
-- Source neutrality (deliberate): Featured Slots and paid Boosts both write
-- listings.boost + listings.featured_until with identical values, and the
-- schema has no column recording which system created the promotion. So the
-- copy here never says "your Featured slot is available again" or "your Boost
-- ended" — it would be a guess. It says "promotion", which is true either way.
-- Adding a promotion_source column is explicitly out of scope.
--
-- Dedupe follows the run_view_milestones pattern already in this database:
-- a column on listings records what has been sent, updated in the same loop
-- iteration as the insert, so a repeated runner pass cannot resend. Two
-- separate marks are needed because a listing gets both notifications in turn,
-- and each promotion window must be able to notify again after a renewal:
--   promo_warned_until  = the featured_until value a "soon" notice was sent for
--   promo_ended_until   = the featured_until value an "ended" notice was sent for
-- Storing the timestamp itself (rather than a boolean) means renewing a
-- promotion moves featured_until forward and naturally re-arms both notices.
--
-- Both tasks are bounded (limit 500) and driven by indexed predicates, matching
-- the other automation-runner tasks.
--
-- Idempotent. Run once via the Supabase SQL Editor.
-- ============================================================================

alter table public.listings
  add column if not exists promo_warned_until timestamptz,
  add column if not exists promo_ended_until  timestamptz;

-- Partial index: only promoted rows are ever scanned by these tasks, which
-- keeps the working set tiny even at 100k+ listings.
create index if not exists idx_listings_featured_until_active
  on public.listings (featured_until)
  where featured_until is not null and status = 'active';

-- ── Expiring soon (≈24h before featured_until) ──────────────────────────────
create or replace function public.run_promotion_expiry_warnings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select id, seller_id, title, featured_until
    from public.listings
    where status = 'active'
      and featured_until is not null
      and featured_until > now()
      and featured_until <= now() + interval '24 hours'
      and (promo_warned_until is null or promo_warned_until <> featured_until)
      and seller_id is not null
    order by featured_until
    limit 500
  loop
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.seller_id::text,
        'Your promotion ends soon',
        '"' || rec.title || '" will stop being promoted tomorrow. Renew it to keep the extra visibility.',
        'promotion', 'Detail?id=' || rec.id, now()
      );
      -- Marked with the exact window so a renewal re-arms the warning.
      update public.listings set promo_warned_until = rec.featured_until where id = rec.id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_promotion_expiry_warnings: failed for listing %: %', rec.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('warned', v_count);
end;
$$;

-- ── Ended (featured_until has passed) ───────────────────────────────────────
create or replace function public.run_promotion_ended_notices()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select id, seller_id, title, featured_until
    from public.listings
    where status = 'active'
      and featured_until is not null
      and featured_until <= now()
      -- Only recent lapses, so enabling this task does not notify every
      -- historical promotion that ended months ago.
      and featured_until > now() - interval '3 days'
      and (promo_ended_until is null or promo_ended_until <> featured_until)
      and seller_id is not null
    order by featured_until desc
    limit 500
  loop
    begin
      insert into public.scheduled_notifications (target, title, body, type, deep_link, scheduled_for)
      values (
        rec.seller_id::text,
        'Your promotion has ended',
        '"' || rec.title || '" is still active, but it is no longer promoted.',
        'promotion', 'Detail?id=' || rec.id, now()
      );
      update public.listings set promo_ended_until = rec.featured_until where id = rec.id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'run_promotion_ended_notices: failed for listing %: %', rec.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('ended', v_count);
end;
$$;

revoke execute on function public.run_promotion_expiry_warnings() from public, anon, authenticated;
revoke execute on function public.run_promotion_ended_notices()  from public, anon, authenticated;

notify pgrst, 'reload schema';

-- Verification (run manually):
--   select public.run_promotion_expiry_warnings();  -- expect {"warned": n}
--   select public.run_promotion_expiry_warnings();  -- expect {"warned": 0} (dedupe)
--   select public.run_promotion_ended_notices();    -- expect {"ended": n}
--   select public.run_promotion_ended_notices();    -- expect {"ended": 0} (dedupe)
