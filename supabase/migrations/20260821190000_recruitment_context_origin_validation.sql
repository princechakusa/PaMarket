-- Codex P1 findings on get_or_create_recruitment_conversation:
--
-- 1) Post-write validation checked conversation membership and
--    employer_id/candidate_id, but never re-verified that a pre-existing
--    context row's job_id/contact_request_id actually still belong to a
--    real, valid relationship for that exact pair.
-- 2) The admin/moderator authority branch could create a context row with
--    BOTH job_id and contact_request_id null (no durable origin at all).
--    enforce_recruitment_contact_authority() (20260821170000) requires a
--    valid contact_request OR application to let a NON-admin party send a
--    message — so an admin-originated, originless thread was created
--    successfully but the candidate (and the employer, on their next
--    message) could never actually use it. is_admin_team() already lets
--    admins send into ANY conversation unconditionally (see the trigger's
--    first check) — they never needed this RPC's exemption to intervene.
--    Removing it means every successful recruitment conversation now has a
--    real, durable, participant-usable origin, matching this task's
--    explicit fallback instruction ("if admin-only recruitment conversation
--    is not a real product requirement, reject originless creation
--    instead").
create or replace function public.get_or_create_recruitment_conversation(
  p_candidate_id uuid,
  p_job_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_conv_id text;
  v_contact_request_id uuid;
  v_job_id uuid;
  v_conv public.conversations%rowtype;
  v_ctx public.recruitment_conversation_context%rowtype;
  v_job_origin_valid boolean;
  v_contact_origin_valid boolean;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  if p_candidate_id = v_uid then return jsonb_build_object('ok', false, 'code', 'self_chat_denied'); end if;

  select cr.id into v_contact_request_id
  from public.contact_requests cr
  where cr.requester_id = v_uid and cr.candidate_id = p_candidate_id and cr.status = 'approved'
  limit 1;

  select a.job_id into v_job_id
  from public.applications a
  join public.listings j on j.id = a.job_id
  where a.applicant_id = p_candidate_id and j.seller_id = v_uid
    and (p_job_id is null or a.job_id = p_job_id)
  order by a.applied_at desc
  limit 1;

  -- Admin/moderator no longer bypasses the origin requirement for CREATING
  -- a recruitment conversation — every successful result must have a real,
  -- durable authority origin both participants can keep using.
  if v_contact_request_id is null and v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'contact_not_authorized');
  end if;

  v_conv_id := 'recruit_' || least(v_uid::text, p_candidate_id::text)
    || '_' || greatest(v_uid::text, p_candidate_id::text);

  insert into public.conversations (id, members, listing_id, business_id)
  values (v_conv_id, array[v_uid, p_candidate_id], null, null)
  on conflict (id) do nothing;

  select * into v_conv from public.conversations where id = v_conv_id;
  if v_conv.id is null
     or v_conv.members is null
     or array_length(v_conv.members, 1) is distinct from 2
     or not (v_conv.members @> array[v_uid, p_candidate_id])
     or v_conv.business_id is not null
     or v_conv.listing_id is not null then
    return jsonb_build_object('ok', false, 'code', 'conversation_integrity_error');
  end if;

  insert into public.recruitment_conversation_context
    (conversation_id, employer_id, candidate_id, job_id, contact_request_id)
  values (v_conv_id, v_uid, p_candidate_id, v_job_id, v_contact_request_id)
  on conflict (conversation_id) do nothing;

  select * into v_ctx from public.recruitment_conversation_context where conversation_id = v_conv_id;
  if v_ctx.conversation_id is null
     or v_ctx.employer_id is distinct from v_uid
     or v_ctx.candidate_id is distinct from p_candidate_id then
    return jsonb_build_object('ok', false, 'code', 'context_integrity_error');
  end if;

  -- Backfill null -> value only, never overwrite an existing non-null origin.
  if v_ctx.job_id is null and v_job_id is not null then
    update public.recruitment_conversation_context set job_id = v_job_id where conversation_id = v_conv_id;
    v_ctx.job_id := v_job_id;
  end if;
  if v_ctx.contact_request_id is null and v_contact_request_id is not null then
    update public.recruitment_conversation_context set contact_request_id = v_contact_request_id where conversation_id = v_conv_id;
    v_ctx.contact_request_id := v_contact_request_id;
  end if;

  -- Full origin re-validation: whatever ended up on the row (freshly
  -- written OR pre-existing) must actually belong to THIS employer/candidate
  -- pair right now, not just have been true at some point in the past.
  if v_ctx.job_id is null and v_ctx.contact_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'context_integrity_error');
  end if;

  if v_ctx.job_id is not null then
    select exists (
      select 1 from public.applications a
      join public.listings j on j.id = a.job_id
      where a.job_id = v_ctx.job_id and a.applicant_id = v_ctx.candidate_id and j.seller_id = v_ctx.employer_id
    ) into v_job_origin_valid;
  else
    v_job_origin_valid := null;
  end if;

  if v_ctx.contact_request_id is not null then
    select exists (
      select 1 from public.contact_requests cr
      where cr.id = v_ctx.contact_request_id
        and cr.requester_id = v_ctx.employer_id
        and cr.candidate_id = v_ctx.candidate_id
        and cr.status = 'approved'
    ) into v_contact_origin_valid;
  else
    v_contact_origin_valid := null;
  end if;

  if coalesce(v_job_origin_valid, false) is not true and coalesce(v_contact_origin_valid, false) is not true then
    return jsonb_build_object('ok', false, 'code', 'context_integrity_error');
  end if;

  return jsonb_build_object('ok', true, 'conversation_id', v_conv_id);
end;
$$;

revoke all on function public.get_or_create_recruitment_conversation(uuid, uuid) from public, anon;
grant execute on function public.get_or_create_recruitment_conversation(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
