-- ============================================================================
-- Referrals: "Invite a friend, get a free boost".
--
--   * Every user gets a short invite code (profiles.referral_code, created on
--     first request by get_my_referral_code(); users cannot write it).
--   * A new account is linked to its inviter either at sign-up
--     (user_metadata.referral_code — email sign-up on app and website) or
--     afterwards via claim_referral(code) within 14 days (phone / Google /
--     Apple sign-ups, or someone who forgot).
--   * The invite QUALIFIES when the invited friend posts their first
--     listing. Only then does the inviter get a reward — so fake empty
--     accounts earn nothing. Capped at 10 rewards per inviter per 30 days.
--   * Reward = one free 7-day boost, applied to any of the inviter's own
--     active listings via redeem_referral_boost(listing_id).
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ── 1. Tables ───────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists referral_code text;
create unique index if not exists profiles_referral_code_key on public.profiles (upper(referral_code));
grant select (referral_code) on public.profiles to authenticated;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  code text not null,
  status text not null default 'joined' check (status in ('joined', 'qualified')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, status);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  referral_id uuid unique references public.referrals(id) on delete set null,
  kind text not null default 'boost_7day' check (kind in ('boost_7day')),
  status text not null default 'available' check (status in ('available', 'used')),
  listing_id uuid,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists referral_rewards_user_idx on public.referral_rewards (user_id, status);

alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;

drop policy if exists "referrals: referrer or referred read" on public.referrals;
create policy "referrals: referrer or referred read" on public.referrals
  for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

drop policy if exists "referral_rewards: owner read" on public.referral_rewards;
create policy "referral_rewards: owner read" on public.referral_rewards
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- No insert/update/delete policies: every write goes through the
-- SECURITY DEFINER functions below.
revoke insert, update, delete on public.referrals, public.referral_rewards from anon, authenticated;
grant select on public.referrals, public.referral_rewards to authenticated;

-- ── 2. Invite code ──────────────────────────────────────────────────────────
create or replace function public.get_my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_prefix text;
  v_try int := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  select referral_code into v_code from public.profiles where id = auth.uid();
  if v_code is not null then return v_code; end if;

  -- First 3 letters of the name (readable, personal) + 4 random chars.
  -- Ambiguous characters (0/O, 1/I/L) are left out.
  select upper(substr(regexp_replace(coalesce(name, ''), '[^A-Za-z]', '', 'g'), 1, 3))
    into v_prefix from public.profiles where id = auth.uid();
  if coalesce(length(v_prefix), 0) < 3 then v_prefix := 'PAM'; end if;

  loop
    v_try := v_try + 1;
    v_code := v_prefix || (
      select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
      from generate_series(1, 4)
    );
    begin
      update public.profiles set referral_code = v_code where id = auth.uid() and referral_code is null;
      exit;
    exception when unique_violation then
      if v_try > 8 then raise; end if;
    end;
  end loop;
  select referral_code into v_code from public.profiles where id = auth.uid();
  return v_code;
end;
$$;
revoke execute on function public.get_my_referral_code() from public, anon;
grant execute on function public.get_my_referral_code() to authenticated;

-- ── 3. Linking a new account to its inviter ─────────────────────────────────
create or replace function public.link_referral(p_referred uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  if p_code is null or length(trim(p_code)) < 4 then return 'invalid_code'; end if;
  select id into v_referrer from public.profiles where upper(referral_code) = upper(trim(p_code));
  if v_referrer is null then return 'invalid_code'; end if;
  if v_referrer = p_referred then return 'self_referral'; end if;
  if exists (select 1 from public.referrals where referred_id = p_referred) then return 'already_linked'; end if;
  -- No circular pairs (A invites B, B "invites" A).
  if exists (select 1 from public.referrals where referrer_id = p_referred and referred_id = v_referrer) then
    return 'self_referral';
  end if;
  insert into public.referrals (referrer_id, referred_id, code)
  values (v_referrer, p_referred, upper(trim(p_code)))
  on conflict (referred_id) do nothing;
  return 'ok';
end;
$$;
revoke execute on function public.link_referral(uuid, text) from public, anon, authenticated;

-- Email sign-up passes the code in user metadata; the profile row may be
-- created after auth.users, so link from the profiles insert as well.
create or replace function public.profiles_link_signup_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select raw_user_meta_data ->> 'referral_code' into v_code from auth.users where id = new.id;
  if v_code is not null then perform public.link_referral(new.id, v_code); end if;
  return new;
exception when others then
  return new; -- a bad code must never block account creation
end;
$$;

drop trigger if exists trg_profiles_link_signup_referral on public.profiles;
create trigger trg_profiles_link_signup_referral
  after insert on public.profiles
  for each row execute function public.profiles_link_signup_referral();

create or replace function public.claim_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created timestamptz;
  v_result text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  select created_at into v_created from auth.users where id = auth.uid();
  if v_created < now() - interval '14 days' then
    return jsonb_build_object('ok', false, 'code', 'too_late');
  end if;
  v_result := public.link_referral(auth.uid(), p_code);
  return jsonb_build_object('ok', v_result = 'ok', 'code', v_result);
end;
$$;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- ── 4. Qualification: invited friend posts their first listing ──────────────
create or replace function public.referral_qualify_on_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals%rowtype;
  v_recent int;
begin
  select * into v_ref from public.referrals
  where referred_id = new.seller_id and status = 'joined'
  for update skip locked;
  if v_ref.id is null then return new; end if;

  update public.referrals set status = 'qualified', qualified_at = now() where id = v_ref.id;

  select count(*) into v_recent from public.referral_rewards
  where user_id = v_ref.referrer_id and created_at > now() - interval '30 days';
  if v_recent < 10 then
    insert into public.referral_rewards (user_id, referral_id) values (v_ref.referrer_id, v_ref.id)
    on conflict (referral_id) do nothing;
    insert into public.notifications (id, user_id, title, body, type, read, created_at, meta, push_sent)
    values (gen_random_uuid(), v_ref.referrer_id::text, 'You earned a free boost',
            'A friend you invited just posted their first ad. Open Invite Friends to apply your free 7-day boost.',
            'referral', false, (extract(epoch from clock_timestamp()) * 1000)::bigint,
            jsonb_build_object('deepLink', '/invite'), false);
  end if;
  return new;
exception when others then
  return new; -- rewards must never block posting
end;
$$;

drop trigger if exists trg_referral_qualify_on_listing on public.listings;
create trigger trg_referral_qualify_on_listing
  after insert on public.listings
  for each row execute function public.referral_qualify_on_listing();

-- ── 5. Using a reward ───────────────────────────────────────────────────────
-- enforce_listing_feature_entitlement blocks client-side featuring; allow
-- it only inside redeem_referral_boost via a transaction-local flag.
-- Body identical to 202608190012_fix_featured_slot_race.sql plus that flag.
create or replace function public.enforce_listing_feature_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_plan text;
  v_extra int;
  v_used int;
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if current_setting('pamarket.trusted_feature', true) = 'on' then return NEW; end if;
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

  perform pg_advisory_xact_lock(hashtext('feature_slot:' || NEW.business_id::text));

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
$function$;

create or replace function public.redeem_referral_boost(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward uuid;
  v_until timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;

  select id into v_reward from public.referral_rewards
  where user_id = auth.uid() and status = 'available'
  order by created_at
  limit 1
  for update skip locked;
  if v_reward is null then return jsonb_build_object('ok', false, 'code', 'no_reward'); end if;

  select (case when featured_until > now() then featured_until else now() end) + interval '7 days'
    into v_until
  from public.listings
  where id = p_listing_id and seller_id = auth.uid() and status = 'active';
  if v_until is null then return jsonb_build_object('ok', false, 'code', 'listing_unavailable'); end if;

  perform set_config('pamarket.trusted_feature', 'on', true);
  update public.listings set boost = 'true'::jsonb, featured_until = v_until where id = p_listing_id;
  perform set_config('pamarket.trusted_feature', 'off', true);

  update public.referral_rewards
  set status = 'used', listing_id = p_listing_id, used_at = now()
  where id = v_reward;

  return jsonb_build_object('ok', true, 'until', v_until);
end;
$$;
revoke execute on function public.redeem_referral_boost(uuid) from public, anon;
grant execute on function public.redeem_referral_boost(uuid) to authenticated;

-- ── 6. Summary for the Invite Friends screen ────────────────────────────────
create or replace function public.my_referral_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'joined', (select count(*) from public.referrals where referrer_id = auth.uid()),
    'qualified', (select count(*) from public.referrals where referrer_id = auth.uid() and status = 'qualified'),
    'rewards_available', (select count(*) from public.referral_rewards where user_id = auth.uid() and status = 'available'),
    'rewards_used', (select count(*) from public.referral_rewards where user_id = auth.uid() and status = 'used'),
    'invited_by_code', (select code from public.referrals where referred_id = auth.uid()),
    'can_claim', (
      not exists (select 1 from public.referrals where referred_id = auth.uid())
      and (select created_at from auth.users where id = auth.uid()) > now() - interval '14 days'
    )
  )
$$;
revoke execute on function public.my_referral_summary() from public, anon;
grant execute on function public.my_referral_summary() to authenticated;

notify pgrst, 'reload schema';
