-- =============================================================
-- PaMarket: Recover "verified but not activated" consumable purchases
-- (2026-07 audit, operational readiness pass)
--
-- A consumable purchase can be VERIFIED with Google (token is genuine, money
-- taken) yet fail to ACTIVATE if the activation RPC hit a transient error
-- right after verification (logged as [BILLING_ALERT] ...verified-but-
-- activation-failed). Today recovery relies on the client re-reporting the
-- purchase on next app launch (billing.js _handlePlayPurchase re-fires from
-- getPurchases(), and the verify functions fast-path a 'verified' row
-- straight to activation). That works, but only when the buyer reopens the
-- app.
--
-- This sweep makes recovery server-side and buyer-independent: it re-drives
-- every stuck 'verified' consumable row through its EXISTING activation RPC.
-- It adds NO new entitlement logic — it only retries the same idempotent
-- activate_* function the Edge Function would call, which no-ops if the row
-- is already consumed. Safe to run as often as you like.
--
-- Run AFTER: add_job_credits.sql, add_rental_featured_slot_packs.sql,
--            add_featured_slot_packs.sql, add_activate_play_boost_rpc.sql
-- =============================================================

create or replace function public.reprocess_stuck_play_purchases()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_res jsonb;
  v_boosts int := 0;
  v_slots  int := 0;
  v_credits int := 0;
  v_rentals int := 0;
begin
  -- Listing / job boosts (play_purchases → activate_play_boost)
  for r in
    select id from public.play_purchases
    where status = 'verified' and created_at > now() - interval '30 days'
    for update skip locked
  loop
    v_res := public.activate_play_boost(r.id);
    if coalesce((v_res->>'ok')::boolean, false) then v_boosts := v_boosts + 1; end if;
  end loop;

  -- Business featured-slot packs
  for r in
    select id from public.featured_slot_packs
    where status = 'verified' and created_at > now() - interval '30 days'
    for update skip locked
  loop
    v_res := public.activate_featured_slot_pack(r.id);
    if coalesce((v_res->>'ok')::boolean, false) then v_slots := v_slots + 1; end if;
  end loop;

  -- Job credit packs
  for r in
    select id from public.job_credit_packs
    where status = 'verified' and created_at > now() - interval '30 days'
    for update skip locked
  loop
    v_res := public.activate_job_credit_pack(r.id);
    if coalesce((v_res->>'ok')::boolean, false) then v_credits := v_credits + 1; end if;
  end loop;

  -- Rental featured slot packs
  for r in
    select id from public.rental_featured_slot_packs
    where status = 'verified' and created_at > now() - interval '30 days'
    for update skip locked
  loop
    v_res := public.activate_rental_featured_slot_pack(r.id);
    if coalesce((v_res->>'ok')::boolean, false) then v_rentals := v_rentals + 1; end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'boosts_reprocessed', v_boosts,
    'slot_packs_reprocessed', v_slots,
    'job_credits_reprocessed', v_credits,
    'rental_featured_reprocessed', v_rentals
  );
end;
$$;

revoke execute on function public.reprocess_stuck_play_purchases() from public;
revoke execute on function public.reprocess_stuck_play_purchases() from authenticated;
revoke execute on function public.reprocess_stuck_play_purchases() from anon;

-- Schedule hourly via pg_cron when available (cheap: skips locked rows and
-- only touches the small set of rows still stuck in 'verified').
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'reprocess-stuck-play-purchases',
      '30 * * * *',
      'select public.reprocess_stuck_play_purchases()'
    );
    raise notice 'pg_cron: scheduled reprocess-stuck-play-purchases hourly at :30';
  else
    raise notice 'pg_cron not installed — call select public.reprocess_stuck_play_purchases() periodically, or enable pg_cron and re-run this file.';
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end
$cron$;

notify pgrst, 'reload schema';
