-- Institutions Phase 4. search_active_jobs() is the sole query behind the
-- Jobs browse experience (app/jobs/browse.tsx) -- a read-only, stable,
-- security invoker SQL function (RLS still fully applies underneath it;
-- this is not an RLS change). Adds one WHERE clause excluding
-- "Institution only" jobs from this general browse surface, mirroring the
-- exact exclusion already applied client-side to the Home feed and Search
-- (app/(tabs)/index.tsx, app/(tabs)/search.tsx). Deliberately does NOT
-- touch create_job_listing() (the separate, credits/subscription-bearing
-- insert RPC) -- see the Phase 4 report's Jobs section for why institution
-- association for the job *posting* flow itself remains an open gap, not
-- silently implemented here.
create or replace function public.search_active_jobs(
  p_query text default null,
  p_job_type text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns setof public.listings
language sql stable security invoker set search_path = public
as $$
  select l.* from public.listings l
  where l.category = 'jobs'
    and l.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
    and coalesce(l.attributes->>'institution_visibility', 'public') <> 'institution_only'
    and (nullif(btrim(p_query), '') is null or
      l.title ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
      l.description ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\')
    and (nullif(p_job_type, '') is null or
      l.description ilike '%JOB TYPE: ' || replace(replace(replace(p_job_type, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\')
  order by l.created_at desc, l.id
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
