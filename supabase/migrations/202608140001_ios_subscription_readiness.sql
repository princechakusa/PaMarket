-- iOS subscription readiness: prevent stale Apple status from re-granting an
-- expired plan and enforce business staff-seat entitlements in the database.

alter table public.business_subscriptions
  add column if not exists auto_renew boolean not null default true;

-- This table exists in the canonical schema but was never carried by a
-- timestamped migration in production. Create it idempotently because staff
-- seats are advertised as paid-plan entitlements.
create table if not exists public.business_staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'staff' check (role in ('manager', 'staff')),
  invited_by uuid references public.profiles(id),
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index if not exists business_staff_user_idx on public.business_staff (user_id);
alter table public.business_staff enable row level security;

drop policy if exists "business_staff: visible to owner or member" on public.business_staff;
create policy "business_staff: visible to owner or member"
  on public.business_staff for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid())
  );

drop policy if exists "business_staff: owner invites" on public.business_staff;
create policy "business_staff: owner invites"
  on public.business_staff for insert
  with check (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid()
  ));

drop policy if exists "business_staff: owner or self update" on public.business_staff;
create policy "business_staff: owner or self update"
  on public.business_staff for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid())
  );

drop policy if exists "business_staff: owner deletes" on public.business_staff;
create policy "business_staff: owner deletes"
  on public.business_staff for delete
  using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = auth.uid()
  ));

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
    return jsonb_build_object('ok', false, 'msg', 'Subscription record not found');
  end if;
  if v_sub.status != 'verified' then
    return jsonb_build_object('ok', false, 'msg', 'Purchase is not in a verified state: ' || v_sub.status);
  end if;
  if v_sub.subscription_state not in ('active', 'in_grace_period')
     or v_sub.expiry_time is null
     or v_sub.expiry_time <= now() then
    return jsonb_build_object(
      'ok', true,
      'granted', false,
      'subscription_state', v_sub.subscription_state
    );
  end if;

  update public.business_subscriptions
  set status = 'downgraded'
  where business_id = v_sub.business_id and status = 'active';

  insert into public.business_subscriptions
    (business_id, plan_id, billing_cycle, status, current_period_end, auto_renew)
  values
    (v_sub.business_id, v_sub.plan_id, v_sub.billing_cycle, 'active', v_sub.expiry_time, v_sub.auto_renewing);

  update public.businesses
  set plan_id = v_sub.plan_id
  where id = v_sub.business_id;

  return jsonb_build_object('ok', true, 'granted', true, 'plan_id', v_sub.plan_id, 'until', v_sub.expiry_time);
end;
$$;

revoke execute on function public.activate_play_subscription(uuid) from public;
revoke execute on function public.activate_play_subscription(uuid) from authenticated;
revoke execute on function public.activate_play_subscription(uuid) from anon;

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
    return jsonb_build_object('ok', false, 'msg', 'Subscription record not found');
  end if;
  if v_sub.status != 'verified' then
    return jsonb_build_object('ok', false, 'msg', 'Purchase is not in a verified state: ' || v_sub.status);
  end if;
  if v_sub.subscription_state not in ('active', 'in_grace_period')
     or v_sub.expiry_time is null
     or v_sub.expiry_time <= now() then
    return jsonb_build_object(
      'ok', true,
      'granted', false,
      'subscription_state', v_sub.subscription_state
    );
  end if;

  update public.recruiter_subscriptions
  set status = 'downgraded'
  where recruiter_id = v_sub.recruiter_id and status = 'active';

  insert into public.recruiter_subscriptions
    (recruiter_id, plan_id, billing_cycle, status, current_period_end, auto_renew)
  values
    (v_sub.recruiter_id, v_sub.plan_id, v_sub.billing_cycle, 'active', v_sub.expiry_time, v_sub.auto_renewing);

  update public.recruiter_profiles
  set plan_id = v_sub.plan_id
  where id = v_sub.recruiter_id;

  return jsonb_build_object('ok', true, 'granted', true, 'plan_id', v_sub.plan_id, 'until', v_sub.expiry_time);
end;
$$;

revoke execute on function public.activate_recruiter_subscription(uuid) from public;
revoke execute on function public.activate_recruiter_subscription(uuid) from authenticated;
revoke execute on function public.activate_recruiter_subscription(uuid) from anon;

create or replace function public.biz_plan_listing_limit(p_plan text)
returns int language sql immutable as
$$ select case p_plan when 'starter' then 15 when 'pro' then 60 when 'premium' then -1 else 3 end $$;

create or replace function public.biz_plan_featured_slots(p_plan text)
returns int language sql immutable as
$$ select case p_plan when 'pro' then 1 when 'premium' then 3 else 0 end $$;

create or replace function public.protect_business_plan_id()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if TG_OP = 'INSERT' then NEW.plan_id := 'free'; else NEW.plan_id := OLD.plan_id; end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_business_plan_id on public.businesses;
create trigger trg_protect_business_plan_id
  before insert or update on public.businesses
  for each row execute function public.protect_business_plan_id();

drop policy if exists "biz_subs: client paid writes blocked" on public.business_subscriptions;
create policy "biz_subs: client paid writes blocked"
  on public.business_subscriptions
  as restrictive for insert to authenticated
  with check (public.is_admin() or plan_id = 'free');

create or replace function public.enforce_biz_listing_limit()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  v_plan text;
  v_limit int;
  v_count int;
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if NEW.business_id is null or coalesce(NEW.status, 'active') != 'active' then return NEW; end if;
  if exists (select 1 from public.listings where id = NEW.id) then return NEW; end if;

  select plan_id into v_plan from public.businesses where id = NEW.business_id;
  v_limit := public.biz_plan_listing_limit(coalesce(v_plan, 'free'));
  if v_limit < 0 then return NEW; end if;

  select count(*) into v_count
  from public.listings
  where business_id = NEW.business_id and status = 'active' and id != NEW.id;
  if v_count >= v_limit then
    raise exception 'LISTING_LIMIT: your plan allows % active listings', v_limit;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_listings_biz_limit on public.listings;
create trigger trg_listings_biz_limit
  before insert on public.listings
  for each row execute function public.enforce_biz_listing_limit();

create or replace function public.enforce_listing_feature_entitlement()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  v_plan text;
  v_extra int;
  v_used int;
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if TG_OP = 'INSERT' then
    if exists (select 1 from public.listings where id = NEW.id) then return NEW; end if;
    NEW.featured_until := null;
    NEW.boost := null;
    return NEW;
  end if;
  if NEW.featured_until is null or NEW.featured_until <= now()
     or (OLD.featured_until is not null and NEW.featured_until <= OLD.featured_until) then
    if NEW.featured_until is null or NEW.featured_until <= now() then NEW.boost := null; end if;
    return NEW;
  end if;
  if NEW.business_id is null then
    raise exception 'BOOST_REQUIRES_PURCHASE: featured placement requires a verified purchase';
  end if;
  if NEW.featured_until > now() + interval '31 days' then
    raise exception 'FEATURE_DURATION_LIMIT: featured placement cannot exceed 31 days';
  end if;

  select plan_id into v_plan
  from public.businesses
  where id = NEW.business_id and owner_user_id = auth.uid();
  if v_plan is null then raise exception 'FEATURE_NOT_OWNER: you do not own this business'; end if;

  select coalesce(sum(extra_slots), 0) into v_extra
  from public.featured_slot_packs
  where business_id = NEW.business_id and status = 'consumed';
  select count(*) into v_used
  from public.listings
  where business_id = NEW.business_id and id != NEW.id and featured_until > now();
  if v_used >= public.biz_plan_featured_slots(v_plan) + v_extra then
    raise exception 'NO_FEATURED_SLOTS: all featured slots are in use';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_listings_feature_entitlement on public.listings;
create trigger trg_listings_feature_entitlement
  before insert or update on public.listings
  for each row execute function public.enforce_listing_feature_entitlement();

create index if not exists idx_listings_biz_active
  on public.listings (business_id) where status = 'active';
create index if not exists idx_listings_biz_featured
  on public.listings (business_id, featured_until);

create or replace function public.biz_plan_staff_limit(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan
    when 'starter' then 2
    when 'pro' then 10
    when 'premium' then -1
    else 0
  end
$$;

create or replace function public.protect_business_staff_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if exists (select 1 from public.businesses b where b.id = OLD.business_id and b.owner_user_id = auth.uid()) then
    return NEW;
  end if;
  if auth.uid() != OLD.user_id then raise exception 'STAFF_UPDATE_FORBIDDEN'; end if;
  NEW.business_id := OLD.business_id;
  NEW.user_id := OLD.user_id;
  NEW.role := OLD.role;
  NEW.invited_by := OLD.invited_by;
  if NEW.status not in ('active', 'removed') then raise exception 'STAFF_STATUS_INVALID'; end if;
  return NEW;
end;
$$;

drop trigger if exists trg_business_staff_member_guard on public.business_staff;
create trigger trg_business_staff_member_guard
  before update on public.business_staff
  for each row execute function public.protect_business_staff_member_update();

create or replace function public.enforce_business_staff_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_limit int;
  v_used int;
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if NEW.status = 'removed' then return NEW; end if;
  if TG_OP = 'UPDATE' and OLD.status != 'removed' then return NEW; end if;

  select plan_id into v_plan
  from public.businesses
  where id = NEW.business_id and owner_user_id = auth.uid();
  if v_plan is null then
    raise exception 'STAFF_NOT_OWNER: you do not own this business';
  end if;

  v_limit := public.biz_plan_staff_limit(v_plan);
  if v_limit < 0 then return NEW; end if;

  select count(*) into v_used
  from public.business_staff
  where business_id = NEW.business_id
    and status != 'removed'
    and id != NEW.id;

  if v_used >= v_limit then
    raise exception 'STAFF_LIMIT: your plan allows % staff seats', v_limit;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_business_staff_plan_limit on public.business_staff;
create trigger trg_business_staff_plan_limit
  before insert or update of status on public.business_staff
  for each row execute function public.enforce_business_staff_limit();

create index if not exists idx_business_staff_active_seats
  on public.business_staff (business_id)
  where status != 'removed';

notify pgrst, 'reload schema';
