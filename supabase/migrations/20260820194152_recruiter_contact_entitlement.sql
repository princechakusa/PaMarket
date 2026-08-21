-- A paid recruiter entitlement authorizes requesting contact. Approval stays
-- a separate admin decision, and existing approved relationships remain valid.
drop policy if exists "contact_requests: insert" on public.contact_requests;
drop policy if exists "contact_requests: requester update" on public.contact_requests;
revoke insert, update on public.contact_requests from anon, authenticated;

create or replace function public.request_candidate_contact(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.contact_requests%rowtype;
  v_requester public.profiles%rowtype;
  v_candidate public.profiles%rowtype;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  select * into v_requester from public.profiles where id = v_uid;
  if v_requester.id is null or v_requester.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'account_ineligible');
  end if;
  if not (coalesce(v_requester.company_verified, false) or v_requester.role in ('admin','moderator')) then
    return jsonb_build_object('ok', false, 'code', 'employer_verification_required');
  end if;
  if p_candidate_id = v_uid then return jsonb_build_object('ok', false, 'code', 'self_request_denied'); end if;

  select * into v_candidate from public.profiles
  where id = p_candidate_id and status = 'active' and open_to_work is true;
  if v_candidate.id is null then return jsonb_build_object('ok', false, 'code', 'candidate_unavailable'); end if;

  if not exists (
    select 1 from public.recruiter_profiles rp
    join public.recruiter_subscriptions rs on rs.recruiter_id = rp.id
    where rp.user_id = v_uid and rs.plan_id = 'recruiter'
      and rs.status = 'active' and rs.current_period_end is not null
      and rs.current_period_end > now()
  ) then return jsonb_build_object('ok', false, 'code', 'entitlement_required'); end if;

  perform pg_advisory_xact_lock(hashtext('candidate_contact:' || v_uid::text || ':' || p_candidate_id::text));
  select * into v_request from public.contact_requests
  where requester_id = v_uid and candidate_id = p_candidate_id for update;

  if v_request.id is not null and v_request.status in ('pending','approved') then
    return jsonb_build_object('ok', true, 'request', to_jsonb(v_request), 'existing', true);
  elsif v_request.id is not null then
    update public.contact_requests
    set requester_name = coalesce(v_requester.name,''), candidate_name = coalesce(v_candidate.name,''),
        company = coalesce(v_requester.company,''), status = 'pending', created_at = now(),
        decided_at = null, decided_by = null
    where id = v_request.id returning * into v_request;
  else
    insert into public.contact_requests
      (requester_id,candidate_id,requester_name,candidate_name,company,status)
    values (v_uid,p_candidate_id,coalesce(v_requester.name,''),coalesce(v_candidate.name,''),
            coalesce(v_requester.company,''),'pending') returning * into v_request;
  end if;
  return jsonb_build_object('ok', true, 'request', to_jsonb(v_request), 'existing', false);
end;
$$;
revoke execute on function public.request_candidate_contact(uuid) from public, anon;
grant execute on function public.request_candidate_contact(uuid) to authenticated;

drop function if exists public.get_recruitment_candidate(uuid);
create function public.get_recruitment_candidate(p_candidate_id uuid)
returns table (
  id uuid, name text, avatar text, phone text, email text,
  contact_authorized boolean, has_cv boolean, verified boolean,
  job_title text, skills text, sector text, exp text, province text, city text,
  open_to_work boolean, cv jsonb, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_application_access boolean; v_contact_access boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  select exists (
    select 1 from public.applications a join public.listings j on j.id = a.job_id
    where a.applicant_id = p_candidate_id and j.seller_id = auth.uid()
  ) into v_application_access;
  if auth.uid() <> p_candidate_id and not public.is_authorized_recruiter() and not v_application_access then
    raise exception 'Candidate profile access denied.' using errcode = '42501';
  end if;
  v_contact_access := auth.uid() = p_candidate_id or public.is_admin_team() or v_application_access
    or exists (select 1 from public.contact_requests cr where cr.requester_id = auth.uid()
      and cr.candidate_id = p_candidate_id and cr.status = 'approved');
  return query select p.id,
    case when v_contact_access then p.name else null end,
    case when v_contact_access then p.avatar else null end,
    case when v_contact_access then p.phone else null end,
    case when v_contact_access then p.email else null end,
    v_contact_access, (p.cv_file_path is not null or p.cv_file_url is not null),
    p.verified,p.job_title,p.skills,p.sector,p.exp,p.province,p.city,p.open_to_work,
    public.recruitment_public_cv(p.cv),p.updated_at
  from public.profiles p where p.id = p_candidate_id and p.status = 'active'
    and (p.id = auth.uid() or p.open_to_work is true or v_application_access);
end;
$$;
revoke execute on function public.get_recruitment_candidate(uuid) from public, anon;
grant execute on function public.get_recruitment_candidate(uuid) to authenticated;
notify pgrst, 'reload schema';
