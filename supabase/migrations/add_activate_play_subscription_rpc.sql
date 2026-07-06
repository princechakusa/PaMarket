-- =============================================================
-- PaMarket: activate_play_subscription RPC
--
-- Grants/updates a business's plan from a VERIFIED Google Play
-- subscription purchase — the replacement for the WhatsApp + admin
-- "Mark paid" flow (business-admin.js markPaid / admin.html approveBizUpgrade).
--
-- SECURITY: not granted to `authenticated` — service-role only, callable
-- from verify-play-subscription and play-rtdn-webhook Edge Functions.
--
-- Idempotent: safe to call repeatedly for the same play_subscriptions row
-- (e.g. an RTDN renewal event re-confirming an already-active state) —
-- it just re-asserts the current period end and plan, never double-charges
-- or double-grants anything since there's no charge here at all.
-- =============================================================

create or replace function public.activate_play_subscription(
  p_play_subscription_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
begin
  select * into v_sub
  from public.play_subscriptions
  where id = p_play_subscription_id
  for update;

  if v_sub is null then
    return jsonb_build_object('ok', false, 'msg', 'Play subscription record not found');
  end if;

  if v_sub.status != 'verified' then
    return jsonb_build_object('ok', false, 'msg', 'Purchase is not in a verified state: ' || v_sub.status);
  end if;

  if v_sub.subscription_state not in ('active', 'in_grace_period') then
    -- Verified the token is real, but Google reports the subscription itself
    -- isn't currently entitling access (e.g. on_hold/canceled/expired) — do
    -- not grant a plan. This keeps the RPC safe to call from the RTDN
    -- handler for EVERY lifecycle event, not just "purchased" ones.
    return jsonb_build_object('ok', true, 'granted', false, 'subscription_state', v_sub.subscription_state);
  end if;

  -- Supersede any other active row for this business (mirrors
  -- business_subscriptions' "one active row" invariant from Module 1).
  update public.business_subscriptions
  set status = 'downgraded'
  where business_id = v_sub.business_id and status = 'active';

  insert into public.business_subscriptions (business_id, plan_id, billing_cycle, status, current_period_end, auto_renew)
  values (v_sub.business_id, v_sub.plan_id, v_sub.billing_cycle, 'active', v_sub.expiry_time, v_sub.auto_renewing);

  update public.businesses
  set plan_id = v_sub.plan_id
  where id = v_sub.business_id;

  return jsonb_build_object('ok', true, 'granted', true, 'plan_id', v_sub.plan_id, 'until', v_sub.expiry_time);
end;
$$;

revoke execute on function public.activate_play_subscription(uuid) from public;
revoke execute on function public.activate_play_subscription(uuid) from authenticated;
revoke execute on function public.activate_play_subscription(uuid) from anon;

-- ── businesses.plan_id: create the column the JS layer already assumes exists ──
-- Cross-referenced audit finding: business-admin.js / business-subscription.js
-- read/write businesses.plan_id, but no migration ever added it — every write
-- was silently swallowed by a try/catch. Adding it now so activate_play_subscription
-- (and the existing client code) actually persists it.
alter table public.businesses
  add column if not exists plan_id text not null default 'free'
  check (plan_id in ('free','starter','pro','premium'));

notify pgrst, 'reload schema';
