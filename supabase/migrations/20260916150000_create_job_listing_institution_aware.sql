-- Institutions Phase 5C: create_job_listing() institution-aware extension.
-- Signature-extends the existing, already-deployed function (same name,
-- same return type, same security mode, same grants -- create or replace
-- preserves those automatically) rather than creating a second Jobs RPC.
-- Every existing parameter/behaviour is unchanged; the two new parameters
-- default to null/'public' so the one real caller (apps/mobile/app/jobs/
-- post.tsx) continues to work unmodified until its own change lands.
--
-- Institution validation is a direct read of public.institutions performed
-- as this function's own security definer identity (the same authority
-- already used for the recruiter_subscriptions/recruiter_profiles check
-- below) -- not a new validation mechanism, and not reliant on institutions
-- RLS or the client-supplied id being trustworthy. It runs before any
-- entitlement/credit accounting, so a bad institution_id/visibility value
-- fails fast: no listing, no credit spend, no job_credit_spends row.
--
-- IMPORTANT: appending new parameters is NOT a same-signature replace in
-- Postgres -- CREATE OR REPLACE FUNCTION only replaces a function whose
-- argument-type list matches exactly. Adding p_institution_id/
-- p_institution_visibility at the end changes the signature, so without an
-- explicit DROP first this would silently create a second, overloaded
-- function (8-arg and 10-arg both existing), which is ambiguous for a
-- caller supplying only the original 8 named arguments. The DROP below
-- guarantees exactly one create_job_listing exists afterward.
drop function if exists public.create_job_listing(text, text, numeric, text, text, text, text, text);

create function public.create_job_listing(
  p_title text,
  p_description text,
  p_price numeric default 0,
  p_currency text default 'USD',
  p_city text default null,
  p_province text default null,
  p_seller_name text default null,
  p_seller_phone text default null,
  p_institution_id uuid default null,
  p_institution_visibility text default 'public'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_free_allowance constant int := 2;
  v_active_jobs int;
  v_recruiter_active boolean;
  v_credits int;
  v_listing_id uuid;
  v_used_credit boolean := false;
  v_institution_active boolean;
  v_attributes jsonb := '{}'::jsonb;
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

  -- Institution validation (Phase 5C) -- before any entitlement/credit
  -- logic, per the Phase 5B audit's required placement. p_institution_id is
  -- never trusted as proof of anything; this is the one authoritative check.
  if p_institution_id is not null then
    select is_active into v_institution_active
    from public.institutions
    where id = p_institution_id;

    if v_institution_active is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_institution', 'msg', 'This institution is no longer available.');
    end if;
    if not v_institution_active then
      return jsonb_build_object('ok', false, 'code', 'invalid_institution', 'msg', 'This institution is no longer available.');
    end if;

    if p_institution_visibility not in ('public', 'institution_only') then
      return jsonb_build_object('ok', false, 'code', 'invalid_visibility', 'msg', 'Invalid visibility option.');
    end if;

    v_attributes := jsonb_build_object('institution_visibility', p_institution_visibility);
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
    price, currency, category, city, province, photos, status,
    institution_id, attributes
  ) values (
    v_uid, coalesce(p_seller_name,''), coalesce(p_seller_phone,''), p_title, p_description,
    coalesce(p_price,0), coalesce(p_currency,'USD'), 'jobs', p_city, p_province, '{}', 'active',
    p_institution_id, v_attributes
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
$function$;

-- The DROP above does not carry grants forward (unlike a true in-place
-- CREATE OR REPLACE) -- re-stating the exact same grant the original
-- function had, confirmed live before this migration ran
-- (has_function_privilege('authenticated', ...) was true).
grant execute on function public.create_job_listing(
  text, text, numeric, text, text, text, text, text, uuid, text
) to authenticated;
