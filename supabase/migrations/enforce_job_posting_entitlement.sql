-- ============================================================================
-- PaMarket — server-side job posting entitlement, atomic with credit spend
-- ----------------------------------------------------------------------------
-- Two proven defects, fixed together because they share a transaction.
--
-- 1. Monetization was enforced only in the mobile UI. `select count(*) from
--    pg_trigger ... where prosrc ilike '%job_credit%'` on listings returned 0,
--    so any authenticated user could POST directly to /rest/v1/listings with
--    category='jobs' and post unlimited jobs for free.
--
-- 2. The app inserted the listing and then called spend_job_credit() in an
--    unawaited .then(). If the spend failed the job stayed published and no
--    credit was deducted — a free paid post.
--
-- The model is unchanged (verified against production code, not redesigned):
--   * valid recruiter subscription  -> unlimited
--   * otherwise                     -> 2 active jobs free
--   * beyond that                   -> one job credit per active job
-- "Active" means listings.category='jobs' and status='active', matching what
-- post.tsx counts (it excludes only status='removed'; 'active' is the stricter
-- and safer reading for an entitlement gate).
--
-- Billing authority is recruiter_subscriptions, never recruiter_profiles.
-- plan_id — that column has no status or expiry and a stale 'recruiter' value
-- there was granting unlimited posting to an account with no subscription.
-- auto_renew is deliberately NOT consulted: it signals intent to bill again,
-- not entitlement, so access ends at current_period_end (same rule now applied
-- to business subscriptions in plan-entitlements.ts).
--
-- Concurrency: the advisory lock is taken on the user id, so two simultaneous
-- posts from one account serialize. Without it, both could read "1 of 2 free
-- used" or "1 credit available" and both succeed. The lock is transaction
-- scoped and released on commit or rollback.
--
-- Ownership: seller_id is taken from auth.uid() and never from the caller, so
-- a client cannot create a job under another account.
--
-- Idempotent. Run once via the Supabase SQL Editor.
-- ============================================================================

create index if not exists idx_listings_seller_active_jobs
  on public.listings (seller_id)
  where category = 'jobs' and status = 'active';

create or replace function public.create_job_listing(
  p_title text,
  p_description text,
  p_price numeric default 0,
  p_currency text default 'USD',
  p_city text default null,
  p_province text default null,
  p_seller_name text default null,
  p_seller_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_free_allowance constant int := 2;
  v_active_jobs int;
  v_recruiter_active boolean;
  v_credits int;
  v_listing_id uuid;
  v_used_credit boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated', 'msg', 'Please sign in again.');
  end if;

  -- Serialize concurrent posts by this user so two requests cannot both claim
  -- the last free slot or the same credit.
  perform pg_advisory_xact_lock(hashtext('create_job_listing:' || v_uid::text));

  -- recruiter_subscriptions.recruiter_id references recruiter_profiles.id, NOT
  -- auth.users.id, so it must be joined through the profile. Comparing it to
  -- auth.uid() directly never matches and would silently deny unlimited
  -- posting to a genuine subscriber.
  select exists (
    select 1
    from public.recruiter_subscriptions rs
    join public.recruiter_profiles rp on rp.id = rs.recruiter_id
    where rp.user_id = v_uid
      and rs.status = 'active'
      and rs.current_period_end is not null
      and rs.current_period_end > now()
  ) into v_recruiter_active;

  if not v_recruiter_active then
    select count(*) into v_active_jobs
    from public.listings
    where seller_id = v_uid and category = 'jobs' and status = 'active';

    if v_active_jobs >= v_free_allowance then
      select coalesce((select sum(credits) from public.job_credit_packs
                        where user_id = v_uid and status = 'consumed'), 0)
           - coalesce((select count(*) from public.job_credit_spends
                        where user_id = v_uid), 0)
        into v_credits;

      if v_credits < 1 then
        return jsonb_build_object(
          'ok', false, 'code', 'no_entitlement',
          'msg', 'You have used your free job posts. Buy a job credit or upgrade your recruiter plan.');
      end if;
      v_used_credit := true;
    end if;
  end if;

  -- Transaction-scoped flag the guard trigger below checks, so this function's
  -- own insert is allowed while direct client inserts are not.
  perform set_config('pamarket.job_rpc', 'on', true);

  insert into public.listings (
    seller_id, seller_name, seller_phone, title, description,
    price, currency, category, city, province, photos, status
  ) values (
    v_uid, coalesce(p_seller_name,''), coalesce(p_seller_phone,''), p_title, p_description,
    coalesce(p_price,0), coalesce(p_currency,'USD'), 'jobs', p_city, p_province, '{}', 'active'
  ) returning id into v_listing_id;

  -- Same transaction as the insert: if this fails the job never exists, and if
  -- the insert fails (moderation trigger, length constraint) no credit is spent.
  if v_used_credit then
    insert into public.job_credit_spends (user_id, listing_id)
    values (v_uid, v_listing_id);
  end if;

  return jsonb_build_object(
    'ok', true, 'listing_id', v_listing_id,
    'used_credit', v_used_credit, 'unlimited', v_recruiter_active);
end;
$$;

revoke execute on function public.create_job_listing(text,text,numeric,text,text,text,text,text) from public, anon;
grant execute on function public.create_job_listing(text,text,numeric,text,text,text,text,text) to authenticated;

-- Direct-insert bypass: block client job inserts entirely. The RPC above is
-- security definer, so its own insert is unaffected; service-role and admin
-- paths are also unaffected. This is what actually closes the revenue bypass —
-- without it a client can still POST to /rest/v1/listings.
create or replace function public.enforce_job_insert_via_rpc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.category,'') <> 'jobs' then return new; end if;
  if auth.uid() is null then return new; end if;          -- service role / cron
  if public.is_admin() then return new; end if;
  -- current_setting is set by create_job_listing via set_config below.
  if coalesce(current_setting('pamarket.job_rpc', true), '') = 'on' then
    return new;
  end if;
  raise exception 'JOB_POST_REQUIRES_RPC: job posts must go through create_job_listing';
end;
$$;

drop trigger if exists trg_enforce_job_insert_via_rpc on public.listings;
create trigger trg_enforce_job_insert_via_rpc
  before insert on public.listings
  for each row execute function public.enforce_job_insert_via_rpc();

notify pgrst, 'reload schema';
