-- P0 fix: request_candidate_contact() returned to_jsonb(v_request) — the
-- raw contact_requests row, including candidate_name — for a request that
-- was still 'pending'. Separately, the table's own SELECT policy let a
-- requester read their own rows directly (`auth.uid() = requester_id`),
-- again exposing candidate_name regardless of approval status. Together
-- these defeated the entire approval gate: a requester learned the
-- candidate's real name the instant they submitted a request, never mind
-- admin approval.
--
-- Fix: the raw table's SELECT policy becomes admin-only (RLS can't redact
-- individual columns, only rows — hiding candidate_name in the client was
-- never enough while the table itself was directly readable). A new
-- SECURITY DEFINER RPC gives everyone else (requester or candidate) a safe,
-- redacted projection instead: candidate_name is only included when the
-- request is approved, or when the caller IS the candidate looking at their
-- own incoming requests. request_candidate_contact()'s return shape drops
-- candidate_name (and every other identity field) entirely — a freshly
-- created/reused request is never anything but 'pending' or already-decided
-- at that moment, so there is never a safe reason for that call to include it.

drop policy if exists "contact_requests: read" on public.contact_requests;
create policy "contact_requests: read"
  on public.contact_requests for select to authenticated
  using (is_admin());

drop function if exists public.list_my_contact_requests();
create function public.list_my_contact_requests()
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
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  return query
    select
      cr.id, cr.candidate_id, cr.requester_id, cr.status, cr.created_at, cr.decided_at,
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

create or replace function public.request_candidate_contact(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.contact_requests%rowtype;
  v_requester public.profiles%rowtype;
  v_candidate public.profiles%rowtype;
  v_safe_request jsonb;
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
    v_safe_request := jsonb_build_object(
      'id', v_request.id, 'candidate_id', v_request.candidate_id,
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
    values (v_uid,p_candidate_id,coalesce(v_requester.name,''),coalesce(v_candidate.name,''),
            coalesce(v_requester.company,''),'pending') returning * into v_request;
  end if;

  v_safe_request := jsonb_build_object(
    'id', v_request.id, 'candidate_id', v_request.candidate_id,
    'status', v_request.status, 'created_at', v_request.created_at
  );
  return jsonb_build_object('ok', true, 'request', v_safe_request, 'existing', false);
end;
$$;
revoke execute on function public.request_candidate_contact(uuid) from public, anon;
grant execute on function public.request_candidate_contact(uuid) to authenticated;

notify pgrst, 'reload schema';
