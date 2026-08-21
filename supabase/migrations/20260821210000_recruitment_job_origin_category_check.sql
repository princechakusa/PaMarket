-- Codex final P1: get_or_create_recruitment_conversation's job-origin check
-- validated "a real application exists for this job/candidate/employer",
-- but never independently re-confirmed that the referenced listing is
-- actually a Jobs listing (listings.category = 'jobs'). The applications
-- INSERT-authority trigger already prevents applying to a non-job listing,
-- so there is no known live exploit — but the recruitment authority must
-- enforce its own invariant rather than depend on a different subsystem's
-- guarantee holding forever. Additive follow-up to 20260821190000 (which
-- introduced the independent job/contact origin validation this extends) —
-- that migration is left untouched since it already ran in production.

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
  where a.applicant_id = v_candidate_id and j.seller_id = v_uid and j.category = 'jobs'
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
  -- must be present and valid. Job-origin validity now additionally
  -- requires listings.category = 'jobs' — a Jobs-shaped recruitment
  -- authority must never be satisfied by a non-Jobs listing, regardless of
  -- what any other subsystem currently prevents.
  v_job_origin_valid := null;
  v_contact_origin_valid := null;

  if v_ctx.job_id is not null then
    select exists (
      select 1 from public.applications a
      join public.listings j on j.id = a.job_id
      where a.job_id = v_ctx.job_id
        and a.applicant_id = v_ctx.candidate_id
        and j.seller_id = v_ctx.employer_id
        and j.category = 'jobs'
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
