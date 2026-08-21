-- create_job_listing had no server-side employer-verification check at all —
-- only the mobile client's UI gate (jobs/post.tsx) kept an unverified user
-- off the "Post a Job" form. Any authenticated user could call the RPC
-- directly and post a job with zero verification, as long as they were
-- under the free-post allowance or held a credit. This adds the same
-- is_authorized_recruiter() check (company_verified, or admin/moderator)
-- already used by browse_recruitment_candidates/get_recruitment_candidate
-- in 202608200002_release_blocker_recruitment_hardening.sql, so job
-- creation is gated the same way candidate/recruiter access already is.
-- Everything else in the function is unchanged.
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
set search_path to 'public'
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

  if not public.is_authorized_recruiter() then
    return jsonb_build_object(
      'ok', false, 'code', 'unverified',
      'msg', 'Verify your company or employer identity before posting a job.'
    );
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

notify pgrst, 'reload schema';
