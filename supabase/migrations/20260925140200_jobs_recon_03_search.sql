-- ============================================================
-- Jobs Reconstruction Phase 3 — Migration 3 of 6: Search & discovery
-- Run AFTER migrations 1-2.
-- Extends search_active_jobs() with new optional structured filters,
-- keeping every existing parameter and its position unchanged so the
-- current mobile app build's call site keeps working unmodified — new
-- parameters are appended with defaults, not inserted earlier in the
-- signature.
-- ============================================================

begin;

-- Functional GIN index for full-text search, scoped to jobs only via the
-- partial-index predicate — does not affect any other category's queries
-- or add any column/trigger to the shared listings table.
create index if not exists listings_jobs_fts_idx on public.listings
  using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')))
  where category = 'jobs';

drop function if exists public.search_active_jobs(text, text, integer, integer);
drop function if exists public.search_active_jobs(text, text, integer, integer, uuid, uuid);

create or replace function public.search_active_jobs(
  p_query text default null,
  p_job_type text default null,           -- kept for compatibility: matched against job_types.label if p_job_type_id not given
  p_limit integer default 20,
  p_offset integer default 0,
  p_job_type_id uuid default null,
  p_industry_id uuid default null,
  p_experience_level text default null,
  p_province text default null,
  p_city text default null,
  p_remote_type text default null,
  p_salary_min numeric default null,
  p_salary_max numeric default null,
  p_salary_negotiable_only boolean default false,
  p_skills text[] default null
)
returns table (
  id uuid, seller_id uuid, seller_name text, title text, description text,
  price numeric, currency text, province text, city text, photos text[],
  status text, created_at timestamptz, expires_at timestamptz,
  job_type_label text, industry_label text, experience_level text,
  salary_min numeric, salary_max numeric, salary_currency text,
  salary_negotiable boolean, skills text[], remote_type text
)
language plpgsql stable security invoker set search_path = public
as $$
declare
  v_job_type_id uuid := p_job_type_id;
begin
  if v_job_type_id is null and p_job_type is not null then
    select jt.id into v_job_type_id from public.job_types jt where jt.label = p_job_type;
  end if;

  return query
  select
    l.id, l.seller_id, l.seller_name, l.title, l.description,
    l.price, l.currency, l.province, l.city, l.photos,
    l.status, l.created_at, l.expires_at,
    jt.label, ji.label, jp.experience_level,
    jp.salary_min, jp.salary_max, jp.salary_currency,
    jp.salary_negotiable, jp.skills, jp.remote_type
  from public.listings l
  left join public.job_postings jp on jp.listing_id = l.id
  left join public.job_types jt on jt.id = jp.job_type_id
  left join public.job_industries ji on ji.id = jp.industry_id
  where l.category = 'jobs'
    and l.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
    and (l.attributes->>'institution_visibility' is distinct from 'institution_only')
    and (
      p_query is null or p_query = ''
      or to_tsvector('english', coalesce(l.title,'') || ' ' || coalesce(l.description,''))
         @@ plainto_tsquery('english', p_query)
    )
    and (v_job_type_id is null or jp.job_type_id = v_job_type_id)
    and (p_industry_id is null or jp.industry_id = p_industry_id)
    and (p_experience_level is null or jp.experience_level = p_experience_level)
    and (p_province is null or l.province ilike p_province)
    and (p_city is null or l.city ilike p_city)
    and (p_remote_type is null or jp.remote_type = p_remote_type)
    and (p_salary_min is null or jp.salary_max is null or jp.salary_max >= p_salary_min)
    and (p_salary_max is null or jp.salary_min is null or jp.salary_min <= p_salary_max)
    and (not p_salary_negotiable_only or jp.salary_negotiable = true)
    and (p_skills is null or jp.skills && p_skills)
  order by l.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.search_active_jobs(
  text, text, integer, integer, uuid, uuid, text, text, text, text, numeric, numeric, boolean, text[]
) from public;
grant execute on function public.search_active_jobs(
  text, text, integer, integer, uuid, uuid, text, text, text, text, numeric, numeric, boolean, text[]
) to anon, authenticated;

-- ---- Single job detail, with legacy-parsing fallback ----
-- Returns structured fields where job_postings has them; leaves the
-- corresponding column NULL when it doesn't, so the CALLING client (mobile/
-- website) applies its existing description-parsing fallback exactly as
-- today for any field this function reports as NULL. This function never
-- guesses a value on the server side, it only ever reports what's actually
-- structured.
create or replace function public.get_job_detail(p_listing_id uuid)
returns table (
  id uuid, seller_id uuid, seller_name text, seller_phone text, title text,
  description text, price numeric, currency text, province text, city text,
  suburb text, photos text[], status text, created_at timestamptz,
  expires_at timestamptz, views integer, custom_questions jsonb,
  job_type_id uuid, job_type_label text, industry_id uuid, industry_label text,
  experience_level text, salary_min numeric, salary_max numeric,
  salary_currency text, salary_negotiable boolean, skills text[],
  remote_type text, responsibilities text, requirements text, benefits text,
  how_to_apply_email text, how_to_apply_phone text,
  accepts_in_app_applications boolean, application_deadline timestamptz,
  has_structured_data boolean
)
language sql stable security invoker set search_path = public
as $$
  select
    l.id, l.seller_id, l.seller_name, l.seller_phone, l.title,
    l.description, l.price, l.currency, l.province, l.city,
    l.suburb, l.photos, l.status, l.created_at,
    l.expires_at, l.views, l.custom_questions,
    jp.job_type_id, jt.label, jp.industry_id, ji.label,
    jp.experience_level, jp.salary_min, jp.salary_max,
    jp.salary_currency, jp.salary_negotiable, jp.skills,
    jp.remote_type, jp.responsibilities, jp.requirements, jp.benefits,
    jp.how_to_apply_email, jp.how_to_apply_phone,
    coalesce(jp.accepts_in_app_applications, true), jp.application_deadline,
    (jp.listing_id is not null)
  from public.listings l
  left join public.job_postings jp on jp.listing_id = l.id
  left join public.job_types jt on jt.id = jp.job_type_id
  left join public.job_industries ji on ji.id = jp.industry_id
  where l.id = p_listing_id and l.category = 'jobs';
$$;

revoke all on function public.get_job_detail(uuid) from public;
grant execute on function public.get_job_detail(uuid) to anon, authenticated;

commit;

-- Verification:
--   select * from public.search_active_jobs(); -- expect the 1 active job
--   select * from public.get_job_detail('77a73b3d-0d37-494e-969a-152e69ecbf16');
-- recommend_jobs_for_me() moved to migration 5 (jobs_recon_05) — it reads
-- profiles.preferred_industry_ids/preferred_job_type_ids/preferred_remote_type/
-- preferred_locations, which don't exist until that migration's ALTER TABLE
-- runs. Defining it here would leave the function callable-but-broken for
-- any window between migration 3 and migration 5, so it belongs after its
-- own dependencies are actually in place, not before.
