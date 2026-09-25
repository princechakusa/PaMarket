-- ============================================================
-- Jobs Reconstruction Phase 3 — Migration 6 of 6: RPC extensions
-- Run AFTER migrations 1-5.
--
-- IMPORTANT DESIGN NOTE ON create_job_listing(): its exact internal SQL
-- body (the advisory-lock key, the precise free-job counting query, the
-- job_credit_spends insert conditions) was not fully available to this
-- migration's author — only its documented behavior was. Reconstructing
-- security/monetization-critical logic like a credit-consumption lock
-- from a paraphrased description, rather than the real source, is exactly
-- the kind of guess this project's rules prohibit. So this migration does
-- NOT replace create_job_listing() at all — it wraps it. The existing
-- function keeps running byte-for-byte unchanged, verified/tested exactly
-- as it is today; this file only adds a new function that calls it.
-- ============================================================

begin;

-- ---- Create: wraps the untouched, existing create_job_listing() ----
create or replace function public.create_job_listing_v2(
  p_title text,
  p_description text,
  p_price numeric default 0,
  p_currency text default 'USD',
  p_city text default null,
  p_province text default null,
  p_seller_name text default null,
  p_seller_phone text default null,
  p_institution_id uuid default null,
  p_institution_visibility text default 'public',
  p_job_type_id uuid default null,
  p_industry_id uuid default null,
  p_experience_level text default null,
  p_skills text[] default null,
  p_salary_min numeric default null,
  p_salary_max numeric default null,
  p_salary_currency text default null,
  p_salary_negotiable boolean default false,
  p_remote_type text default null,
  p_responsibilities text default null,
  p_requirements text default null,
  p_benefits text default null,
  p_how_to_apply_email text default null,
  p_how_to_apply_phone text default null,
  p_accepts_in_app_applications boolean default true,
  p_application_deadline timestamptz default null,
  p_custom_questions jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
  v_listing_id uuid;
begin
  -- Delegates entirely to the existing, unmodified function for every
  -- authorization/entitlement/credit check and the actual listings insert.
  v_result := public.create_job_listing(
    p_title, p_description, p_price, p_currency, p_city, p_province,
    p_seller_name, p_seller_phone, p_institution_id, p_institution_visibility
  );

  if not coalesce((v_result->>'ok')::boolean, false) then
    return v_result;
  end if;

  v_listing_id := (v_result->>'listing_id')::uuid;

  -- 180-day default visibility for Jobs specifically (the generic
  -- listings default is 30 days for every other category — untouched).
  -- Set here, once, rather than altering the shared listings default.
  update public.listings
  set expires_at = now() + interval '180 days'
  where id = v_listing_id;

  if p_custom_questions is not null then
    update public.listings set custom_questions = p_custom_questions where id = v_listing_id;
    -- The jobs_custom_questions_shape CHECK constraint (migration 4) makes
    -- a malformed shape a hard error here, not a silently swallowed one.
  end if;

  insert into public.job_postings (
    listing_id, job_type_id, industry_id, experience_level, skills,
    salary_min, salary_max, salary_currency, salary_negotiable, remote_type,
    responsibilities, requirements, benefits,
    how_to_apply_email, how_to_apply_phone,
    accepts_in_app_applications, application_deadline
  ) values (
    v_listing_id, p_job_type_id, p_industry_id, p_experience_level, coalesce(p_skills, '{}'),
    p_salary_min, p_salary_max, p_salary_currency, coalesce(p_salary_negotiable, false), p_remote_type,
    p_responsibilities, p_requirements, p_benefits,
    p_how_to_apply_email, p_how_to_apply_phone,
    coalesce(p_accepts_in_app_applications, true), p_application_deadline
  )
  on conflict (listing_id) do update set
    job_type_id = excluded.job_type_id, industry_id = excluded.industry_id,
    experience_level = excluded.experience_level, skills = excluded.skills,
    salary_min = excluded.salary_min, salary_max = excluded.salary_max,
    salary_currency = excluded.salary_currency, salary_negotiable = excluded.salary_negotiable,
    remote_type = excluded.remote_type, responsibilities = excluded.responsibilities,
    requirements = excluded.requirements, benefits = excluded.benefits,
    how_to_apply_email = excluded.how_to_apply_email, how_to_apply_phone = excluded.how_to_apply_phone,
    accepts_in_app_applications = excluded.accepts_in_app_applications,
    application_deadline = excluded.application_deadline;

  return v_result || jsonb_build_object('listing_id', v_listing_id, 'structured', true);
end;
$$;

revoke all on function public.create_job_listing_v2(
  text, text, numeric, text, text, text, text, text, uuid, text,
  uuid, uuid, text, text[], numeric, numeric, text, boolean, text,
  text, text, text, text, text, boolean, timestamptz, jsonb
) from public;
grant execute on function public.create_job_listing_v2(
  text, text, numeric, text, text, text, text, text, uuid, text,
  uuid, uuid, text, text[], numeric, numeric, text, boolean, text,
  text, text, text, text, text, boolean, timestamptz, jsonb
) to authenticated;

-- ---- Update: owner-only, structured fields only (title/price/etc already
-- updatable by the owner directly via the existing generic listings RLS
-- update policy — unchanged, not duplicated here).
create or replace function public.update_job_posting(
  p_listing_id uuid,
  p_job_type_id uuid default null,
  p_industry_id uuid default null,
  p_experience_level text default null,
  p_skills text[] default null,
  p_salary_min numeric default null,
  p_salary_max numeric default null,
  p_salary_currency text default null,
  p_salary_negotiable boolean default null,
  p_remote_type text default null,
  p_responsibilities text default null,
  p_requirements text default null,
  p_benefits text default null,
  p_how_to_apply_email text default null,
  p_how_to_apply_phone text default null,
  p_accepts_in_app_applications boolean default null,
  p_application_deadline timestamptz default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.listings l where l.id = p_listing_id and l.seller_id = auth.uid() and l.category = 'jobs') then
    raise exception 'not_authorized_or_not_a_job_listing';
  end if;

  insert into public.job_postings (listing_id) values (p_listing_id)
  on conflict (listing_id) do nothing;

  update public.job_postings set
    job_type_id = coalesce(p_job_type_id, job_type_id),
    industry_id = coalesce(p_industry_id, industry_id),
    experience_level = coalesce(p_experience_level, experience_level),
    skills = coalesce(p_skills, skills),
    salary_min = coalesce(p_salary_min, salary_min),
    salary_max = coalesce(p_salary_max, salary_max),
    salary_currency = coalesce(p_salary_currency, salary_currency),
    salary_negotiable = coalesce(p_salary_negotiable, salary_negotiable),
    remote_type = coalesce(p_remote_type, remote_type),
    responsibilities = coalesce(p_responsibilities, responsibilities),
    requirements = coalesce(p_requirements, requirements),
    benefits = coalesce(p_benefits, benefits),
    how_to_apply_email = coalesce(p_how_to_apply_email, how_to_apply_email),
    how_to_apply_phone = coalesce(p_how_to_apply_phone, how_to_apply_phone),
    accepts_in_app_applications = coalesce(p_accepts_in_app_applications, accepts_in_app_applications),
    application_deadline = coalesce(p_application_deadline, application_deadline)
  where listing_id = p_listing_id;

  return true;
end;
$$;

revoke all on function public.update_job_posting(
  uuid, uuid, uuid, text, text[], numeric, numeric, text, boolean, text, text, text, text, text, text, boolean, timestamptz
) from public;
grant execute on function public.update_job_posting(
  uuid, uuid, uuid, text, text[], numeric, numeric, text, boolean, text, text, text, text, text, text, boolean, timestamptz
) to authenticated;

-- ---- Close / fill / pause: reuses the existing generic listings.status
-- values rather than inventing a parallel job-specific status column.
-- 'sold' is reused with the meaning "filled" for a job row (the admin/
-- feed/moderation systems already understand 'sold' as "no longer
-- available", which is exactly the right semantics) — a client-facing
-- label override ("Filled" instead of "Sold") is a display-layer concern,
-- not a schema concern, and belongs in the client code changes below.
create or replace function public.close_job_listing(p_listing_id uuid, p_reason text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
begin
  if not exists (select 1 from public.listings l where l.id = p_listing_id and l.seller_id = auth.uid() and l.category = 'jobs') then
    raise exception 'not_authorized_or_not_a_job_listing';
  end if;
  v_status := case p_reason
    when 'filled' then 'sold'
    when 'paused' then 'paused'
    when 'removed' then 'removed'
    else null
  end;
  if v_status is null then
    raise exception 'invalid_close_reason: %, expected filled|paused|removed', p_reason;
  end if;
  update public.listings set status = v_status where id = p_listing_id;
  return true;
end;
$$;

revoke all on function public.close_job_listing(uuid, text) from public;
grant execute on function public.close_job_listing(uuid, text) to authenticated;

-- ---- Withdraw: thin, friendly wrapper. The RLS policy + validation
-- trigger from migration 4 already fully enforce this even for a direct
-- PostgREST PATCH — this RPC exists only to give the client one call with
-- a clean error rather than parsing a raw constraint-violation message.
create or replace function public.withdraw_application(p_application_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update public.applications set status = 'withdrawn'
  where id = p_application_id and applicant_id = auth.uid();
  if not found then
    raise exception 'application_not_found_or_not_yours';
  end if;
  return true;
end;
$$;

revoke all on function public.withdraw_application(uuid) from public;
grant execute on function public.withdraw_application(uuid) to authenticated;

-- ---- Employer private note ----
create or replace function public.add_application_note(p_application_id uuid, p_note text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.applications a
    join public.listings l on l.id = a.job_id
    where a.id = p_application_id and l.seller_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;
  insert into public.application_notes (application_id, employer_id, note)
  values (p_application_id, auth.uid(), p_note)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.add_application_note(uuid, text) from public;
grant execute on function public.add_application_note(uuid, text) to authenticated;

commit;

-- Verification:
--   select proname from pg_proc where proname like '%job%' and pronamespace = 'public'::regnamespace order by proname;
--   -- Confirm the original create_job_listing() still has its original
--   -- behavior by checking its function body is unchanged from before this
--   -- migration ran (this migration issues no CREATE OR REPLACE against it).
