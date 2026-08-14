-- =============================================================
-- PaMarket: Google Play Billing — recruiter subscriptions
--
-- Mirrors add_play_subscriptions.sql / add_activate_play_subscription_rpc.sql
-- exactly (same ledger + "current subscription" + activation-RPC pattern),
-- but targets a NEW recruiter_profiles table instead of businesses, since
-- posting/hiring on PaMarket is not tied to owning a shop business — any
-- verified user can be a recruiter.
--
-- Lifecycle stays current the same two ways as shop subscriptions:
--   1. Synchronous verification at purchase time (verify-play-subscription).
--   2. RTDN via play-rtdn-webhook (source of truth for renewals/cancellations
--      that happen on Google's own schedule).
-- =============================================================

-- One row per user who has ever subscribed as a recruiter. Created lazily
-- (upserted) the first time a user purchases a recruiter subscription —
-- not created for every user, unlike businesses which are created at
-- shop-onboarding time.
create table if not exists public.recruiter_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  plan_id         text not null default 'free'
                    check (plan_id in ('free','recruiter','recruiter_pro')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint uq_recruiter_profiles_user unique (user_id)
);

drop trigger if exists recruiter_profiles_set_updated_at on public.recruiter_profiles;
create trigger recruiter_profiles_set_updated_at
  before update on public.recruiter_profiles
  for each row execute function public.set_updated_at();

alter table public.recruiter_profiles enable row level security;

drop policy if exists "recruiter_profiles: owner read" on public.recruiter_profiles;
create policy "recruiter_profiles: owner read"
  on public.recruiter_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "recruiter_profiles: admin all" on public.recruiter_profiles;
create policy "recruiter_profiles: admin all"
  on public.recruiter_profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- Recurring plan state, one active row per recruiter at a time — mirrors
-- business_subscriptions.
create table if not exists public.recruiter_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  recruiter_id        uuid not null references public.recruiter_profiles(id) on delete cascade,
  plan_id             text not null check (plan_id in ('recruiter','recruiter_pro')),
  billing_cycle       text not null check (billing_cycle in ('monthly','yearly')),
  status              text not null default 'active'
                        check (status in ('active','downgraded','expired')),
  current_period_end  timestamptz,
  auto_renew          boolean not null default true,
  created_at          timestamptz not null default now()
);

create index if not exists recruiter_subs_recruiter_idx on public.recruiter_subscriptions (recruiter_id, status);

alter table public.recruiter_subscriptions enable row level security;

drop policy if exists "recruiter_subscriptions: owner read" on public.recruiter_subscriptions;
create policy "recruiter_subscriptions: owner read"
  on public.recruiter_subscriptions for select
  using (
    exists (
      select 1 from public.recruiter_profiles rp
      where rp.id = recruiter_id and rp.user_id = auth.uid()
    )
  );

drop policy if exists "recruiter_subscriptions: admin all" on public.recruiter_subscriptions;
create policy "recruiter_subscriptions: admin all"
  on public.recruiter_subscriptions for all
  using (public.is_admin())
  with check (public.is_admin());

-- Purchase-token ledger — identical shape/semantics to play_subscriptions,
-- just keyed by recruiter_id (via recruiter_profiles) instead of business_id.
create table if not exists public.play_recruiter_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  recruiter_id        uuid not null references public.recruiter_profiles(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,

  product_id          text not null
                        check (product_id in (
                          'recruiter_monthly','recruiter_yearly',
                          'recruiter_pro_monthly','recruiter_pro_yearly'
                        )),
  purchase_token      text not null,
  order_id            text,

  plan_id             text not null check (plan_id in ('recruiter','recruiter_pro')),
  billing_cycle       text not null check (billing_cycle in ('monthly','yearly')),

  status              text not null default 'pending'
                        check (status in ('pending', 'verified', 'failed')),
  verification_error  text,

  subscription_state  text not null default 'pending'
                        check (subscription_state in (
                          'pending', 'active', 'in_grace_period',
                          'on_hold', 'canceled', 'expired', 'paused'
                        )),
  auto_renewing       boolean not null default true,

  purchase_time       timestamptz,
  expiry_time         timestamptz,

  created_at          timestamptz not null default now(),
  verified_at         timestamptz,
  updated_at          timestamptz not null default now(),

  constraint uq_play_recruiter_subscription_token unique (purchase_token)
);

create index if not exists play_recruiter_subs_recruiter_idx on public.play_recruiter_subscriptions (recruiter_id, created_at desc);
create index if not exists play_recruiter_subs_user_idx on public.play_recruiter_subscriptions (user_id);
create index if not exists play_recruiter_subs_state_idx on public.play_recruiter_subscriptions (subscription_state);

-- Deliberately NOT a unique partial index on (recruiter_id) for active-ish
-- states: during a plan upgrade Google issues a NEW purchase token while the
-- old row is still recorded as 'active' (the RTDN expiring it arrives
-- asynchronously), so a uniqueness constraint would reject the verified
-- upgrade purchase's ledger insert. "Current subscription" is resolved as
-- the latest active-state row (order by created_at desc limit 1) instead.
drop index if exists public.play_recruiter_subs_one_active_idx;
create index if not exists play_recruiter_subs_active_lookup_idx
  on public.play_recruiter_subscriptions (recruiter_id, created_at desc)
  where subscription_state in ('active', 'in_grace_period', 'on_hold', 'pending');

drop trigger if exists play_recruiter_subscriptions_set_updated_at on public.play_recruiter_subscriptions;
create trigger play_recruiter_subscriptions_set_updated_at
  before update on public.play_recruiter_subscriptions
  for each row execute function public.set_updated_at();

alter table public.play_recruiter_subscriptions enable row level security;

drop policy if exists "play_recruiter_subscriptions: owner read" on public.play_recruiter_subscriptions;
create policy "play_recruiter_subscriptions: owner read"
  on public.play_recruiter_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "play_recruiter_subscriptions: admin all" on public.play_recruiter_subscriptions;
create policy "play_recruiter_subscriptions: admin all"
  on public.play_recruiter_subscriptions for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── activate_recruiter_subscription RPC ──────────────────────────
-- Mirrors activate_play_subscription exactly. security definer, revoked
-- from authenticated/anon — callable only via the service-role client in
-- verify-play-subscription / play-rtdn-webhook.
create or replace function public.activate_recruiter_subscription(
  p_play_recruiter_subscription_id uuid
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
  from public.play_recruiter_subscriptions
  where id = p_play_recruiter_subscription_id
  for update;

  if v_sub is null then
    return jsonb_build_object('ok', false, 'msg', 'Recruiter subscription record not found');
  end if;

  if v_sub.status != 'verified' then
    return jsonb_build_object('ok', false, 'msg', 'Purchase is not in a verified state: ' || v_sub.status);
  end if;

  if v_sub.subscription_state not in ('active', 'in_grace_period')
     or v_sub.expiry_time is null
     or v_sub.expiry_time <= now() then
    return jsonb_build_object('ok', true, 'granted', false, 'subscription_state', v_sub.subscription_state);
  end if;

  update public.recruiter_subscriptions
  set status = 'downgraded'
  where recruiter_id = v_sub.recruiter_id and status = 'active';

  insert into public.recruiter_subscriptions (recruiter_id, plan_id, billing_cycle, status, current_period_end, auto_renew)
  values (v_sub.recruiter_id, v_sub.plan_id, v_sub.billing_cycle, 'active', v_sub.expiry_time, v_sub.auto_renewing);

  update public.recruiter_profiles
  set plan_id = v_sub.plan_id
  where id = v_sub.recruiter_id;

  return jsonb_build_object('ok', true, 'granted', true, 'plan_id', v_sub.plan_id, 'until', v_sub.expiry_time);
end;
$$;

revoke execute on function public.activate_recruiter_subscription(uuid) from public;
revoke execute on function public.activate_recruiter_subscription(uuid) from authenticated;
revoke execute on function public.activate_recruiter_subscription(uuid) from anon;

-- ── get_or_create_recruiter_profile RPC ──────────────────────────
-- verify-play-subscription needs a recruiter_profiles.id to attach the
-- purchase ledger row to, but a profile may not exist yet for a first-time
-- recruiter subscriber. Upserts on user_id and returns the row id.
-- security definer so the Edge Function's service-role client (or, if ever
-- called by the client directly, the authenticated user themselves) can
-- create their own profile row without a broad INSERT policy on the table.
create or replace function public.get_or_create_recruiter_profile(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.recruiter_profiles where user_id = p_user_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.recruiter_profiles (user_id) values (p_user_id)
  on conflict (user_id) do update set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- Service-role only, like the activation RPCs: p_user_id is an arbitrary
-- uuid parameter, so if `authenticated` could call this directly a signed-in
-- user could create profile rows for OTHER user ids. The Edge Function
-- always passes its own verified caller id via the service-role client.
revoke execute on function public.get_or_create_recruiter_profile(uuid) from public;
revoke execute on function public.get_or_create_recruiter_profile(uuid) from anon;
revoke execute on function public.get_or_create_recruiter_profile(uuid) from authenticated;

notify pgrst, 'reload schema';
