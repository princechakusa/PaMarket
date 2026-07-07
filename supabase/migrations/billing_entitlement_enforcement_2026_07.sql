-- =============================================================
-- PaMarket: Server-side entitlement enforcement (2026-07 audit, part 2)
--
-- Until now every monetized LIMIT (featured slots, listing counts, job post
-- caps) was enforced only in the client UI — a user talking to PostgREST
-- directly could feature unlimited listings, exceed plan listing limits, or
-- post unlimited jobs. This migration makes the DATABASE the source of
-- truth via BEFORE triggers, while every legitimate server path (the
-- security-definer activation RPCs called with the service-role key, where
-- auth.uid() is null, and admin sessions) passes through untouched.
--
-- Run AFTER: add_recruiter_subscriptions.sql, add_job_credits.sql,
--            add_featured_slot_packs.sql, billing_hardening_2026_07.sql
--
-- Enforced here:
--   1. businesses.plan_id can never be set by a non-admin client.
--   2. business_subscriptions: clients may only record FREE plan rows
--      (paid rows come exclusively from activate_play_subscription / admin).
--   3. listings.boost / featured_until:
--        - stripped on client INSERT (no pre-featured listings),
--        - client UPDATE may only extend featuring for a business catalog
--          listing within its plan+purchased featured-slot budget (≤31d);
--        - personal/marketplace/vehicle/property/job listings can only be
--          featured through the Play boost purchase path (service role).
--   4. Business catalog listing limits per plan (free 3 / starter 15 /
--      pro 60 / premium unlimited) on INSERT.
--   5. Job posting limits per recruiter plan (free 2 / recruiter 10 /
--      pro unlimited), auto-spending a purchased job credit server-side
--      when posting beyond the plan limit; blocked when no credit remains.
--   6. Backfills businesses.plan_id from legacy business_subscriptions
--      rows so pre-Play-Billing paying businesses aren't clamped to free.
--   7. Drops the obsolete wallet-funded apply_listing_boost RPC (legacy
--      pre-Play-Billing flow; wallet_usd is dead — this was still granted
--      to `authenticated`).
-- =============================================================

-- ── Plan entitlement limits: single SQL source of truth ────────────────
-- Mirrors H.PLAN_ENTITLEMENTS (business-subscription.js) and
-- H.RECRUITER_PLAN_ENTITLEMENTS (jobs.js). -1 = unlimited. Keep all three
-- files in sync by hand when plans change.
create or replace function public.biz_plan_listing_limit(p_plan text)
returns int language sql immutable as
$$ select case p_plan when 'starter' then 15 when 'pro' then 60 when 'premium' then -1 else 3 end $$;

create or replace function public.biz_plan_featured_slots(p_plan text)
returns int language sql immutable as
$$ select case p_plan when 'pro' then 1 when 'premium' then 3 else 0 end $$;

create or replace function public.recruiter_plan_job_limit(p_plan text)
returns int language sql immutable as
$$ select case p_plan when 'recruiter' then 10 when 'recruiter_pro' then -1 else 2 end $$;

-- ── Job credit balance for an explicit user (trigger-callable) ─────────
-- get_job_credit_balance() (add_job_credits.sql) stays as the client-facing
-- auth.uid()-scoped read; this definer variant is for server-side callers
-- and is NOT granted to clients (p_user is arbitrary).
create or replace function public.job_credit_balance_for(p_user uuid)
returns int language sql security definer set search_path = public stable as
$$
  select coalesce((
    select sum(credits) from public.job_credit_packs
    where user_id = p_user and status = 'consumed'
  ), 0) - coalesce((
    select count(*) from public.job_credit_spends
    where user_id = p_user
  ), 0);
$$;
revoke execute on function public.job_credit_balance_for(uuid) from public;
revoke execute on function public.job_credit_balance_for(uuid) from authenticated;
revoke execute on function public.job_credit_balance_for(uuid) from anon;

-- ── 6. Backfill businesses.plan_id from legacy subscriptions ───────────
-- Pre-Play-Billing upgrades (admin "mark paid" flow) wrote
-- business_subscriptions but businesses.plan_id may not have existed yet.
-- Without this, the new limits below would clamp legacy paying businesses
-- to the free tier.
update public.businesses b
set plan_id = s.plan_id
from (
  select distinct on (business_id) business_id, plan_id
  from public.business_subscriptions
  where status = 'active' and plan_id in ('starter', 'pro', 'premium')
  order by business_id, created_at desc
) s
where s.business_id = b.id and b.plan_id = 'free';

-- ── 1. Protect businesses.plan_id from client writes ───────────────────
-- The plan is granted ONLY by activate_play_subscription (service role,
-- auth.uid() is null), the RTDN downgrade path, the expiry sweep, or an
-- admin. A client INSERT is forced to 'free'; a client UPDATE keeps the
-- old value — silently, so ordinary profile upserts that echo the column
-- back never break.
create or replace function public.protect_business_plan_id()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null or public.is_admin() then
    return NEW;
  end if;
  if TG_OP = 'INSERT' then
    NEW.plan_id := 'free';
  else
    NEW.plan_id := OLD.plan_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_business_plan_id on public.businesses;
create trigger trg_protect_business_plan_id
  before insert or update on public.businesses
  for each row execute function public.protect_business_plan_id();

-- ── 2. business_subscriptions: clients record free rows only ───────────
-- RESTRICTIVE policy: ANDed with whatever permissive owner-insert policy
-- exists, so onboarding can still record its free-plan row, while paid
-- rows can only be created by activate_play_subscription (definer,
-- bypasses RLS) or an admin.
drop policy if exists "biz_subs: client paid writes blocked" on public.business_subscriptions;
create policy "biz_subs: client paid writes blocked"
  on public.business_subscriptions
  as restrictive for insert to authenticated
  with check (public.is_admin() or plan_id = 'free');

-- ── 3. listings featuring entitlement ───────────────────────────────────
create or replace function public.enforce_listing_feature_entitlement()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  v_extending boolean;
  v_plan  text;
  v_extra int;
  v_used  int;
begin
  -- Server paths (service-role / definer RPCs) and admins bypass.
  if auth.uid() is null or public.is_admin() then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    -- The client saves listings via UPSERT, so an edit of an EXISTING row
    -- arrives here as an INSERT first (the ON CONFLICT UPDATE that follows
    -- is enforced by the UPDATE branch below). Only strip featuring from
    -- genuinely new rows — otherwise editing a paid-boosted listing would
    -- wipe its boost.
    if exists (select 1 from public.listings where id = NEW.id) then
      return NEW;
    end if;
    -- Never trust pre-featured inserts; featuring always happens after the
    -- listing exists, via the slot flow or a verified Play purchase.
    NEW.featured_until := null;
    NEW.boost := null;
    return NEW;
  end if;

  v_extending := NEW.featured_until is not null
                 and NEW.featured_until > now()
                 and (OLD.featured_until is null or NEW.featured_until > OLD.featured_until);

  if not v_extending then
    -- Shrinking/clearing is always allowed; keep the boost flag honest so
    -- ranking can never be gamed by the flag alone.
    if NEW.featured_until is null or NEW.featured_until <= now() then
      NEW.boost := null;
    end if;
    return NEW;
  end if;

  -- Extension path. Only business catalog listings have a client-side
  -- featuring entitlement (plan slots + purchased packs); every other
  -- listing is featured exclusively via the Play boost purchase (which
  -- runs as service role and bypasses this).
  if NEW.business_id is null then
    raise exception 'BOOST_REQUIRES_PURCHASE: boosts for this listing are purchased via Google Play';
  end if;
  if NEW.featured_until > now() + interval '31 days' then
    raise exception 'FEATURE_DURATION_LIMIT: featured placement cannot exceed 31 days';
  end if;

  select b.plan_id into v_plan
  from public.businesses b
  where b.id = NEW.business_id and b.owner_user_id = auth.uid();
  if v_plan is null then
    raise exception 'FEATURE_NOT_OWNER: you do not own this business';
  end if;

  select coalesce(sum(extra_slots), 0) into v_extra
  from public.featured_slot_packs
  where business_id = NEW.business_id and status = 'consumed';

  select count(*) into v_used
  from public.listings l
  where l.business_id = NEW.business_id
    and l.id != NEW.id
    and l.featured_until > now();

  if v_used >= public.biz_plan_featured_slots(v_plan) + v_extra then
    raise exception 'NO_FEATURED_SLOTS: all featured slots are in use — buy more slots or upgrade your plan';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_listings_feature_entitlement on public.listings;
create trigger trg_listings_feature_entitlement
  before insert or update on public.listings
  for each row execute function public.enforce_listing_feature_entitlement();

-- ── 4. Business catalog listing limit per plan ──────────────────────────
create or replace function public.enforce_biz_listing_limit()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  v_plan  text;
  v_limit int;
  v_count int;
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if NEW.business_id is null then return NEW; end if;
  if coalesce(NEW.status, 'active') != 'active' then return NEW; end if;
  -- Upsert-edit of an existing listing adds nothing to the count — only
  -- genuinely new rows are limited (legacy over-limit businesses can still
  -- edit what they already have).
  if exists (select 1 from public.listings where id = NEW.id) then return NEW; end if;

  select plan_id into v_plan from public.businesses where id = NEW.business_id;
  v_limit := public.biz_plan_listing_limit(coalesce(v_plan, 'free'));
  if v_limit < 0 then return NEW; end if;

  select count(*) into v_count
  from public.listings
  where business_id = NEW.business_id and status = 'active' and id != NEW.id;

  if v_count >= v_limit then
    raise exception 'LISTING_LIMIT: your plan allows % active listings — upgrade to add more', v_limit;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_listings_biz_limit on public.listings;
create trigger trg_listings_biz_limit
  before insert on public.listings
  for each row execute function public.enforce_biz_listing_limit();

-- ── 5. Job posting limit + server-side credit spend ─────────────────────
-- Fires on INSERT of an active job listing, and on UPDATE when a job is
-- REACTIVATED (status → active). Uses the same per-user advisory lock as
-- spend_job_credit so concurrent posts can't overspend. When the recruiter
-- is over their plan limit, a purchased credit is spent HERE, in the same
-- transaction as the insert — the client's spend_job_credit call becomes a
-- harmless no-op (already_spent). A reactivated job that already consumed
-- a credit does not consume a second one (unique listing_id).
create or replace function public.enforce_job_post_limit()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  v_plan    text;
  v_limit   int;
  v_active  int;
  v_balance int;
begin
  if auth.uid() is null or public.is_admin() then return NEW; end if;
  if NEW.category is distinct from 'jobs' then return NEW; end if;
  if coalesce(NEW.status, 'active') != 'active' then return NEW; end if;
  if TG_OP = 'UPDATE' and OLD.status = 'active' then return NEW; end if; -- not a (re)activation
  -- Upsert-edit of an existing job arrives as INSERT first — skip; the
  -- UPDATE branch above already decides whether it's a reactivation.
  if TG_OP = 'INSERT' and exists (select 1 from public.listings where id = NEW.id) then return NEW; end if;

  perform pg_advisory_xact_lock(hashtext('job_credit_spend:' || auth.uid()::text));

  -- A credit already spent on this listing covers it forever (edit/reactivation).
  if exists (select 1 from public.job_credit_spends where listing_id = NEW.id) then
    return NEW;
  end if;

  select rp.plan_id into v_plan from public.recruiter_profiles rp where rp.user_id = auth.uid();
  v_limit := public.recruiter_plan_job_limit(coalesce(v_plan, 'free'));
  if v_limit < 0 then return NEW; end if;

  select count(*) into v_active
  from public.listings
  where seller_id = auth.uid() and category = 'jobs' and status = 'active' and id != NEW.id;

  if v_active < v_limit then return NEW; end if;

  v_balance := public.job_credit_balance_for(auth.uid());
  if v_balance <= 0 then
    raise exception 'JOB_POST_LIMIT: free job post limit reached — buy a job credit or upgrade your recruiter plan';
  end if;

  insert into public.job_credit_spends (user_id, listing_id)
  values (auth.uid(), NEW.id)
  on conflict (listing_id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_listings_job_limit on public.listings;
create trigger trg_listings_job_limit
  before insert or update on public.listings
  for each row execute function public.enforce_job_post_limit();

-- ── Supporting indexes for the trigger counts ───────────────────────────
create index if not exists idx_listings_biz_active
  on public.listings (business_id) where status = 'active';
create index if not exists idx_listings_biz_featured
  on public.listings (business_id, featured_until);
create index if not exists idx_listings_seller_jobs_active
  on public.listings (seller_id) where status = 'active';

-- ── 7. Drop the obsolete wallet boost RPC ───────────────────────────────
-- Legacy pre-Play-Billing flow (add_listing_boost_rpc.sql): deducted
-- profiles.wallet_usd and set boost directly; still granted to
-- `authenticated` but no client code calls it anymore. Play Billing
-- (verify-play-purchase → activate_play_boost) fully replaces it.
drop function if exists public.apply_listing_boost(text, int);

notify pgrst, 'reload schema';
