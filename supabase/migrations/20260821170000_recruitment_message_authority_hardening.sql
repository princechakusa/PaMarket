-- Follow-up to 20260821140000_recruitment_conversation_context.sql (already
-- applied/live) — that migration's context table/RPC shape is unchanged;
-- this hardens the pieces Codex's audit flagged. A new migration is used
-- rather than editing 140000 in place, since 140000 already ran in
-- production and its file must keep matching what was actually executed.
--
-- 1) enforce_recruitment_contact_authority() previously inferred "this is a
--    recruitment message" heuristically from sender-is-recruiter +
--    recipient-open_to_work + business_id/listing_id both null. That is
--    both a false negative (any non-recruiter could still message an
--    Open-to-Work user completely unchecked, since the heuristic only fired
--    for recruiters) and a false positive (a verified employer's ORDINARY
--    personal marketplace chat with an Open-to-Work user — nothing to do
--    with recruiting — got blocked by this same heuristic). Recruitment
--    intent must come from an explicit recruitment_conversation_context
--    row (written only by get_or_create_recruitment_conversation), never
--    from either party's profile state.
-- 2) get_or_create_recruitment_conversation's `on conflict (id) do nothing`
--    silently trusted whatever conversation already existed at the
--    deterministic recruit_<pair> id, without checking its members. Now
--    validates the row actually contains exactly the two expected members
--    (and no business/listing context) before returning success.

-- ---------------------------------------------------------------------------
-- get_or_create_recruitment_conversation: validate the conversation row
-- (new or pre-existing) before trusting it.
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
  v_conv_id text;
  v_contact_request_id uuid;
  v_job_id uuid;
  v_has_authority boolean;
  v_conv public.conversations%rowtype;
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

  v_has_authority := public.is_admin_team() or v_contact_request_id is not null or v_job_id is not null;

  if not v_has_authority then
    return jsonb_build_object('ok', false, 'code', 'contact_not_authorized');
  end if;

  v_conv_id := 'recruit_' || least(v_uid::text, p_candidate_id::text)
    || '_' || greatest(v_uid::text, p_candidate_id::text);

  insert into public.conversations (id, members, listing_id, business_id)
  values (v_conv_id, array[v_uid, p_candidate_id], null, null)
  on conflict (id) do nothing;

  -- Never trust a pre-existing row at this deterministic id blindly — a
  -- malformed/stale conversation (wrong members, or repurposed with a
  -- business/listing context) must not be silently handed back as success.
  select * into v_conv from public.conversations where id = v_conv_id;
  if v_conv.id is null
     or v_conv.members is null
     or array_length(v_conv.members, 1) is distinct from 2
     or not (v_conv.members @> array[v_uid, p_candidate_id])
     or v_conv.business_id is not null
     or v_conv.listing_id is not null then
    return jsonb_build_object('ok', false, 'code', 'conversation_integrity_error');
  end if;

  -- Admin-initiated threads (no request/application on file) leave context
  -- fields null; the client falls back to a neutral "Recruitment" label.
  if v_contact_request_id is not null or v_job_id is not null then
    insert into public.recruitment_conversation_context
      (conversation_id, employer_id, candidate_id, job_id, contact_request_id)
    values (v_conv_id, v_uid, p_candidate_id, v_job_id, v_contact_request_id)
    on conflict (conversation_id) do update set
      job_id = coalesce(excluded.job_id, public.recruitment_conversation_context.job_id),
      contact_request_id = coalesce(excluded.contact_request_id, public.recruitment_conversation_context.contact_request_id)
    where public.recruitment_conversation_context.employer_id = excluded.employer_id
      and public.recruitment_conversation_context.candidate_id = excluded.candidate_id;
  end if;

  return jsonb_build_object('ok', true, 'conversation_id', v_conv_id);
end;
$$;

revoke all on function public.get_or_create_recruitment_conversation(uuid, uuid) from public, anon;
grant execute on function public.get_or_create_recruitment_conversation(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- enforce_recruitment_contact_authority(): explicit-context authority only.
-- A conversation is a recruitment conversation if and only if it has a row
-- in recruitment_conversation_context — never inferred from sender/
-- recipient profile state. Conversations without a context row are left
-- completely alone here (normal marketplace/business/rental/personal rules
-- apply, unaffected by anyone's recruiter or open_to_work status).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_recruitment_contact_authority()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_sender uuid;
  v_ctx public.recruitment_conversation_context%rowtype;
  v_ok boolean := false;
begin
  if public.is_admin_team() then return new; end if;

  -- sender_id is text (conversations/messages predate a uuid column type
  -- change and can in principle carry non-uuid system/legacy values) — only
  -- attempt the cast for values that are actually uuid-shaped. Anything
  -- else is exempt from this recruitment-specific check rather than
  -- crashing the insert.
  if new.sender_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return new;
  end if;
  v_sender := new.sender_id::uuid;

  select * into v_ctx from public.recruitment_conversation_context where conversation_id = new.conversation_id;
  if not found then
    return new;
  end if;

  if v_sender <> v_ctx.employer_id and v_sender <> v_ctx.candidate_id then
    raise exception 'recruitment_contact_not_authorized: sender is not a party to this recruitment conversation.'
      using errcode = '42501';
  end if;

  -- Re-validate the underlying authority is still current (not just that it
  -- existed when the thread was created) — an approval can be revoked, or
  -- an application relationship record removed, after the fact.
  if v_ctx.contact_request_id is not null then
    select true into v_ok from public.contact_requests cr
    where cr.id = v_ctx.contact_request_id and cr.status = 'approved';
  end if;
  if not coalesce(v_ok, false) and v_ctx.job_id is not null then
    select true into v_ok from public.applications a
    join public.listings j on j.id = a.job_id
    where a.job_id = v_ctx.job_id and a.applicant_id = v_ctx.candidate_id and j.seller_id = v_ctx.employer_id;
  end if;

  if not coalesce(v_ok, false) then
    raise exception 'recruitment_contact_not_authorized: recruitment authority for this conversation is no longer valid.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_recruitment_contact_authority on public.messages;
create trigger trg_enforce_recruitment_contact_authority
  before insert on public.messages
  for each row execute function public.enforce_recruitment_contact_authority();

notify pgrst, 'reload schema';
