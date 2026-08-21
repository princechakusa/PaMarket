-- Codex P0: Browse Candidates / get_recruitment_candidate returned the
-- candidate's REAL profiles.id (== auth.users.id) even before any
-- authorization existed. Since profiles_public grants broad SELECT (a
-- deliberate, separately-reported marketplace-identity tradeoff — see
-- 20260821180000/20260821190000), any authorized recruiter could pivot
-- straight from that real id to `profiles_public?id=eq.<uuid>&select=name,avatar`
-- and defeat the entire recruiter_monthly + Contact Request + admin-approval
-- gate, without ever needing get_recruitment_candidate to leak anything
-- itself. Fix: recruitment screens now hand the recruiter an opaque,
-- server-generated reference instead of the real id. The real id is never
-- serialized to the client until an authorized relationship already exists.
--
-- Design:
--   recruitment_candidate_refs(ref_id, candidate_id) — a random,
--   server-generated, indexed, unique mapping. Never queried directly by
--   any client (no grants to anon/authenticated at all — only resolved
--   internally by SECURITY DEFINER functions, which execute as their owner
--   regardless of table grants).
--
--   recruitment_resolve_ref(p_input): tries p_input as a ref_id first; if
--   no match, treats it as an already-real candidate id. This is safe, not
--   a bypass — every caller of the functions below still has to pass the
--   SAME authority checks (approved contact_request / real application /
--   self / admin) that already independently gate real data, regardless of
--   which form the input took. It exists ONLY so that:
--     - chat/[id].tsx and jobs/messages.tsx (which read a REAL id out of
--       conversations.members, since actual messaging requires a real
--       user id) keep working unchanged, and
--     - applicants/[jobId].tsx (a genuine application relationship, which
--       this task explicitly carves out of the anonymization requirement —
--       "once an authorized application/contact relationship exists, the
--       server may resolve the real candidate internally") keeps working
--       unchanged, passing the real applicant_id it already legitimately
--       has from the applications table.
--   The browse/candidate-detail/contact-request flow, which never had a
--   real id to begin with, only ever passes/receives ref_id.

create table if not exists public.recruitment_candidate_refs (
  ref_id      uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists rcr_candidate_idx on public.recruitment_candidate_refs (candidate_id);

alter table public.recruitment_candidate_refs enable row level security;
drop policy if exists "recruitment_candidate_refs: admin all" on public.recruitment_candidate_refs;
create policy "recruitment_candidate_refs: admin all"
  on public.recruitment_candidate_refs for all
  using (public.is_admin_team()) with check (public.is_admin_team());
-- No SELECT/INSERT/UPDATE/DELETE grants to anon or authenticated at all —
-- this table is resolved exclusively inside SECURITY DEFINER functions,
-- never queried directly by any client.
revoke all on public.recruitment_candidate_refs from anon, authenticated, public;

-- Internal-only helpers (not granted to anon/authenticated — callable only
-- from within other SECURITY DEFINER functions, which execute as owner).
create or replace function public.recruitment_ensure_ref(p_candidate_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_ref uuid;
begin
  insert into public.recruitment_candidate_refs (candidate_id) values (p_candidate_id)
    on conflict (candidate_id) do nothing;
  select ref_id into v_ref from public.recruitment_candidate_refs where candidate_id = p_candidate_id;
  return v_ref;
end;
$$;
revoke all on function public.recruitment_ensure_ref(uuid) from public, anon, authenticated;

create or replace function public.recruitment_resolve_ref(p_input uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select candidate_id from public.recruitment_candidate_refs where ref_id = p_input),
    p_input
  );
$$;
revoke all on function public.recruitment_resolve_ref(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- browse_recruitment_candidates: return the opaque ref, never profiles.id.
-- No longer STABLE (ensures ref rows exist for the matched set, a write).
-- ---------------------------------------------------------------------------
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
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_authorized_recruiter() then
    raise exception 'Verified employer access required.' using errcode = '42501';
  end if;

  insert into public.recruitment_candidate_refs (candidate_id)
  select p.id from public.profiles p
  where p.status = 'active' and p.open_to_work is true
  on conflict (candidate_id) do nothing;

  return query
    select r.ref_id,
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
    join public.recruitment_candidate_refs r on r.candidate_id = p.id
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
revoke all on function public.browse_recruitment_candidates(text,text,text,text,integer,integer) from public, anon;
grant execute on function public.browse_recruitment_candidates(text,text,text,text,integer,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- get_recruitment_candidate: accepts EITHER a ref or a real id (see design
-- note above); returns the opaque ref as `id`, never profiles.id.
-- No longer STABLE (ensures a ref row exists for the resolved candidate).
-- ---------------------------------------------------------------------------
create or replace function public.get_recruitment_candidate(p_candidate_id uuid)
returns table (
  id uuid, name text, avatar text, phone text, email text,
  contact_authorized boolean, has_cv boolean, verified boolean,
  job_title text, skills text, sector text, exp text, province text, city text,
  open_to_work boolean, cv jsonb, updated_at timestamptz
)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_real_id uuid;
  v_application_access boolean;
  v_contact_access boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  v_real_id := public.recruitment_resolve_ref(p_candidate_id);

  select exists (
    select 1 from public.applications a join public.listings j on j.id = a.job_id
    where a.applicant_id = v_real_id and j.seller_id = auth.uid()
  ) into v_application_access;
  if auth.uid() <> v_real_id and not public.is_authorized_recruiter() and not v_application_access then
    raise exception 'Candidate profile access denied.' using errcode = '42501';
  end if;
  v_contact_access := auth.uid() = v_real_id or public.is_admin_team() or v_application_access
    or exists (select 1 from public.contact_requests cr where cr.requester_id = auth.uid()
      and cr.candidate_id = v_real_id and cr.status = 'approved');

  return query select public.recruitment_ensure_ref(p.id),
    case when v_contact_access then p.name else null end,
    case when v_contact_access then p.avatar else null end,
    case when v_contact_access then p.phone else null end,
    case when v_contact_access then p.email else null end,
    v_contact_access, (p.cv_file_path is not null or p.cv_file_url is not null),
    p.verified,p.job_title,p.skills,p.sector,p.exp,p.province,p.city,p.open_to_work,
    public.recruitment_public_cv(p.cv),p.updated_at
  from public.profiles p where p.id = v_real_id and p.status = 'active'
    and (p.id = auth.uid() or p.open_to_work is true or v_application_access);
end;
$$;
revoke all on function public.get_recruitment_candidate(uuid) from public, anon;
grant execute on function public.get_recruitment_candidate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- request_candidate_contact: browse/contact-request flow ONLY — always a
-- ref (never a real id is legitimately available to this call site).
-- Returned candidate_id is the ref, matching what the client already has.
-- ---------------------------------------------------------------------------
create or replace function public.request_candidate_contact(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_real_candidate_id uuid;
  v_request public.contact_requests%rowtype;
  v_requester public.profiles%rowtype;
  v_candidate public.profiles%rowtype;
  v_safe_request jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  v_real_candidate_id := public.recruitment_resolve_ref(p_candidate_id);

  select * into v_requester from public.profiles where id = v_uid;
  if v_requester.id is null or v_requester.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'account_ineligible');
  end if;
  if not (coalesce(v_requester.company_verified, false) or v_requester.role in ('admin','moderator')) then
    return jsonb_build_object('ok', false, 'code', 'employer_verification_required');
  end if;
  if v_real_candidate_id = v_uid then return jsonb_build_object('ok', false, 'code', 'self_request_denied'); end if;

  select * into v_candidate from public.profiles
  where id = v_real_candidate_id and status = 'active' and open_to_work is true;
  if v_candidate.id is null then return jsonb_build_object('ok', false, 'code', 'candidate_unavailable'); end if;

  if not exists (
    select 1 from public.recruiter_profiles rp
    join public.recruiter_subscriptions rs on rs.recruiter_id = rp.id
    where rp.user_id = v_uid and rs.plan_id = 'recruiter'
      and rs.status = 'active' and rs.current_period_end is not null
      and rs.current_period_end > now()
  ) then return jsonb_build_object('ok', false, 'code', 'entitlement_required'); end if;

  perform pg_advisory_xact_lock(hashtext('candidate_contact:' || v_uid::text || ':' || v_real_candidate_id::text));
  select * into v_request from public.contact_requests
  where requester_id = v_uid and candidate_id = v_real_candidate_id for update;

  if v_request.id is not null and v_request.status in ('pending','approved') then
    v_safe_request := jsonb_build_object(
      'id', v_request.id, 'candidate_id', public.recruitment_ensure_ref(v_request.candidate_id),
      'status', v_request.status, 'created_at', v_request.created_at
    );
    return jsonb_build_object('ok', true, 'request', v_safe_request, 'existing', true);
  elsif v_request.id is not null then
    update public.contact_requests
    set requester_name = coalesce(v_requester.name,''), candidate_name = coalesce(v_candidate.name,''),
        company = coalesce(v_requester.company,''), status = 'pending', created_at = now(),
        decided_at = null, decided_by = null
    where id = v_request.id returning * into v_request;
  else
    insert into public.contact_requests
      (requester_id,candidate_id,requester_name,candidate_name,company,status)
    values (v_uid,v_real_candidate_id,coalesce(v_requester.name,''),coalesce(v_candidate.name,''),
            coalesce(v_requester.company,''),'pending') returning * into v_request;
  end if;

  v_safe_request := jsonb_build_object(
    'id', v_request.id, 'candidate_id', public.recruitment_ensure_ref(v_request.candidate_id),
    'status', v_request.status, 'created_at', v_request.created_at
  );
  return jsonb_build_object('ok', true, 'request', v_safe_request, 'existing', false);
end;
$$;
revoke execute on function public.request_candidate_contact(uuid) from public, anon;
grant execute on function public.request_candidate_contact(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- list_my_contact_requests: candidate_id output is now always the opaque
-- ref (matches what jobs/candidate/[id].tsx and jobs/contact-requests.tsx
-- compare/navigate with) — the underlying table's real candidate_id column
-- is untouched and still drives the row-visibility predicate.
-- ---------------------------------------------------------------------------
create or replace function public.list_my_contact_requests()
returns table (
  id uuid,
  candidate_id uuid,
  requester_id uuid,
  status text,
  created_at timestamptz,
  decided_at timestamptz,
  candidate_name text,
  requester_name text,
  company text,
  role text
)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  return query
    select
      cr.id, public.recruitment_ensure_ref(cr.candidate_id), cr.requester_id, cr.status, cr.created_at, cr.decided_at,
      case
        when cr.status = 'approved' or auth.uid() = cr.candidate_id or public.is_admin_team()
          then cr.candidate_name
        else null
      end as candidate_name,
      cr.requester_name,
      cr.company,
      cr.role
    from public.contact_requests cr
    where cr.requester_id = auth.uid() or cr.candidate_id = auth.uid() or public.is_admin_team();
end;
$$;
revoke all on function public.list_my_contact_requests() from public, anon;
grant execute on function public.list_my_contact_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- get_or_create_recruitment_conversation: accepts EITHER a ref (browse/
-- contact-request flow) or a real id (application flow, per this task's
-- explicit carve-out — applicants/[jobId].tsx already has a real applicant_id
-- legitimately from the applications table). Resolves once at the top;
-- everything else is unchanged from 20260821190000's origin-validation logic.
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_recruitment_conversation(
  p_candidate_id uuid,
  p_job_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_candidate_id uuid;
  v_conv_id text;
  v_contact_request_id uuid;
  v_job_id uuid;
  v_conv public.conversations%rowtype;
  v_ctx public.recruitment_conversation_context%rowtype;
  v_job_origin_valid boolean;
  v_contact_origin_valid boolean;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  v_candidate_id := public.recruitment_resolve_ref(p_candidate_id);
  if v_candidate_id = v_uid then return jsonb_build_object('ok', false, 'code', 'self_chat_denied'); end if;

  select cr.id into v_contact_request_id
  from public.contact_requests cr
  where cr.requester_id = v_uid and cr.candidate_id = v_candidate_id and cr.status = 'approved'
  limit 1;

  select a.job_id into v_job_id
  from public.applications a
  join public.listings j on j.id = a.job_id
  where a.applicant_id = v_candidate_id and j.seller_id = v_uid
    and (p_job_id is null or a.job_id = p_job_id)
  order by a.applied_at desc
  limit 1;

  if v_contact_request_id is null and v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'contact_not_authorized');
  end if;

  v_conv_id := 'recruit_' || least(v_uid::text, v_candidate_id::text)
    || '_' || greatest(v_uid::text, v_candidate_id::text);

  insert into public.conversations (id, members, listing_id, business_id)
  values (v_conv_id, array[v_uid, v_candidate_id], null, null)
  on conflict (id) do nothing;

  select * into v_conv from public.conversations where id = v_conv_id;
  if v_conv.id is null
     or v_conv.members is null
     or array_length(v_conv.members, 1) is distinct from 2
     or not (v_conv.members @> array[v_uid, v_candidate_id])
     or v_conv.business_id is not null
     or v_conv.listing_id is not null then
    return jsonb_build_object('ok', false, 'code', 'conversation_integrity_error');
  end if;

  insert into public.recruitment_conversation_context
    (conversation_id, employer_id, candidate_id, job_id, contact_request_id)
  values (v_conv_id, v_uid, v_candidate_id, v_job_id, v_contact_request_id)
  on conflict (conversation_id) do nothing;

  select * into v_ctx from public.recruitment_conversation_context where conversation_id = v_conv_id;
  if v_ctx.conversation_id is null
     or v_ctx.employer_id is distinct from v_uid
     or v_ctx.candidate_id is distinct from v_candidate_id then
    return jsonb_build_object('ok', false, 'code', 'context_integrity_error');
  end if;

  if v_ctx.job_id is null and v_job_id is not null then
    update public.recruitment_conversation_context set job_id = v_job_id where conversation_id = v_conv_id;
    v_ctx.job_id := v_job_id;
  end if;
  if v_ctx.contact_request_id is null and v_contact_request_id is not null then
    update public.recruitment_conversation_context set contact_request_id = v_contact_request_id where conversation_id = v_conv_id;
    v_ctx.contact_request_id := v_contact_request_id;
  end if;

  -- Every NON-NULL origin field must independently be valid; at least one
  -- must be present and valid. A valid job alongside an invalid/mismatched
  -- contact_request_id (or vice versa) must still fail — this is NOT an
  -- "both must be invalid to fail" check.
  v_job_origin_valid := null;
  v_contact_origin_valid := null;

  if v_ctx.job_id is not null then
    select exists (
      select 1 from public.applications a
      join public.listings j on j.id = a.job_id
      where a.job_id = v_ctx.job_id and a.applicant_id = v_ctx.candidate_id and j.seller_id = v_ctx.employer_id
    ) into v_job_origin_valid;
    if v_job_origin_valid is not true then
      return jsonb_build_object('ok', false, 'code', 'context_integrity_error');
    end if;
  end if;

  if v_ctx.contact_request_id is not null then
    select exists (
      select 1 from public.contact_requests cr
      where cr.id = v_ctx.contact_request_id
        and cr.requester_id = v_ctx.employer_id
        and cr.candidate_id = v_ctx.candidate_id
        and cr.status = 'approved'
    ) into v_contact_origin_valid;
    if v_contact_origin_valid is not true then
      return jsonb_build_object('ok', false, 'code', 'context_integrity_error');
    end if;
  end if;

  if v_ctx.job_id is null and v_ctx.contact_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'context_integrity_error');
  end if;

  return jsonb_build_object('ok', true, 'conversation_id', v_conv_id);
end;
$$;

revoke all on function public.get_or_create_recruitment_conversation(uuid, uuid) from public, anon;
grant execute on function public.get_or_create_recruitment_conversation(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
