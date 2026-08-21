-- browse_recruitment_candidates and get_recruitment_candidate already strip
-- CV file paths/URLs via recruitment_public_cv(), but both still returned a
-- candidate's real `name`/`avatar` in the raw response to ANY authorized
-- recruiter, unconditionally. The mobile client hid it in the UI ("reveal"
-- gated on an approved contact_requests row / self / admin), but that's a
-- visual hide only — the actual name/avatar were already in the network
-- payload for every candidate on the page. This makes the same "reveal"
-- rule the client already enforces authoritative at the server: identity
-- fields are null unless the caller IS the candidate, is admin/moderator,
-- or holds an approved contact_requests row for that candidate. Everything
-- else about these two functions (eligibility, pagination, CV redaction,
-- search fields) is unchanged.

create or replace function public.browse_recruitment_candidates(
  p_query text default null,
  p_sector text default null,
  p_experience text default null,
  p_city text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns table (
  id uuid, name text, avatar text, verified boolean, job_title text,
  skills text, sector text, exp text, province text, city text,
  open_to_work boolean, cv jsonb, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_authorized_recruiter() then
    raise exception 'Verified employer access required.' using errcode = '42501';
  end if;
  return query
    select p.id,
           case when public.is_admin_team() or exists (
             select 1 from public.contact_requests cr
             where cr.requester_id = auth.uid() and cr.candidate_id = p.id and cr.status = 'approved'
           ) then p.name else null end as name,
           case when public.is_admin_team() or exists (
             select 1 from public.contact_requests cr
             where cr.requester_id = auth.uid() and cr.candidate_id = p.id and cr.status = 'approved'
           ) then p.avatar else null end as avatar,
           p.verified, p.job_title, p.skills,
           p.sector, p.exp, p.province, p.city, p.open_to_work,
           public.recruitment_public_cv(p.cv), p.updated_at
    from public.profiles p
    where p.status = 'active'
      and p.open_to_work is true
      and (nullif(btrim(p_query), '') is null or
        p.name ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.job_title ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.sector ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.skills ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\' or
        p.city ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\')
      and (nullif(p_sector, '') is null or p.sector = p_sector)
      and (nullif(p_experience, '') is null or p.exp = p_experience)
      and (nullif(p_city, '') is null or p.city = p_city)
    order by p.updated_at desc nulls last, p.id
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.get_recruitment_candidate(p_candidate_id uuid)
returns table (
  id uuid, name text, avatar text, verified boolean, job_title text,
  skills text, sector text, exp text, province text, city text,
  open_to_work boolean, cv jsonb, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_reveal boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if auth.uid() <> p_candidate_id
     and not public.is_authorized_recruiter()
     and not exists (
       select 1 from public.applications a
       join public.listings j on j.id = a.job_id
       where a.applicant_id = p_candidate_id and j.seller_id = auth.uid()
     ) then
    raise exception 'Candidate profile access denied.' using errcode = '42501';
  end if;

  v_reveal := auth.uid() = p_candidate_id
    or public.is_admin_team()
    or exists (
      select 1 from public.contact_requests cr
      where cr.requester_id = auth.uid() and cr.candidate_id = p_candidate_id and cr.status = 'approved'
    );

  return query
    select p.id,
           case when v_reveal then p.name else null end as name,
           case when v_reveal then p.avatar else null end as avatar,
           p.verified, p.job_title, p.skills,
           p.sector, p.exp, p.province, p.city, p.open_to_work,
           public.recruitment_public_cv(p.cv), p.updated_at
    from public.profiles p
    where p.id = p_candidate_id
      and p.status = 'active'
      and (p.id = auth.uid() or p.open_to_work is true or exists (
        select 1 from public.applications a
        join public.listings j on j.id = a.job_id
        where a.applicant_id = p.id and j.seller_id = auth.uid()
      ));
end;
$$;

notify pgrst, 'reload schema';
