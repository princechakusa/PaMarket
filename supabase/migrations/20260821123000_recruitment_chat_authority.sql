-- P1 fix: Browse Candidates exposes a candidate's UUID to any authorized
-- recruiter, and the existing generic conversations upsert path
-- (RLS: authenticated + auth.uid() = ANY(members), same path used by every
-- normal "Message" button in the app) let that recruiter create a plain
-- personal conversation and message the candidate directly — completely
-- bypassing recruiter_monthly + Request Contact Details + admin approval.
--
-- Two parts:
--  1. get_or_create_recruitment_conversation() — the front door the mobile
--     client should call. Proves authority (approved contact_requests row,
--     or a real job-application relationship) before creating/reusing a
--     conversation, and returns a clear ok:false otherwise.
--  2. enforce_recruitment_contact_authority() — a BEFORE INSERT trigger on
--     messages that is the actual, unavoidable enforcement. (1) alone isn't
--     enough: nothing stops a client from skipping the RPC and using the
--     same generic conversations.upsert() every other "Message" button
--     already uses. The trigger inspects who's actually involved rather
--     than trusting how the conversation was created, so it can't be routed
--     around by choosing a different insert path or id scheme.
--
-- Scope is intentionally narrow: it only fires for a plain 2-person
-- personal conversation (business_id and listing_id both null) where the
-- RECIPIENT has open_to_work = true and the SENDER is acting as a verified
-- recruiter (is_authorized_recruiter()) who is neither the recipient nor
-- holds an approved contact_requests row or a real application relationship
-- with them. Every other case — normal marketplace buyer/seller chat,
-- business chat, rental chat (all carry business_id/listing_id), a
-- candidate replying, a non-recruiter messaging anyone, admin/moderator —
-- returns immediately and is untouched.

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
  v_has_authority boolean;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  if p_candidate_id = v_uid then return jsonb_build_object('ok', false, 'code', 'self_chat_denied'); end if;

  v_has_authority := public.is_admin_team()
    or exists (
      select 1 from public.contact_requests cr
      where cr.requester_id = v_uid and cr.candidate_id = p_candidate_id and cr.status = 'approved'
    )
    or exists (
      select 1 from public.applications a join public.listings j on j.id = a.job_id
      where a.applicant_id = p_candidate_id and j.seller_id = v_uid
        and (p_job_id is null or a.job_id = p_job_id)
    );

  if not v_has_authority then
    return jsonb_build_object('ok', false, 'code', 'contact_not_authorized');
  end if;

  v_conv_id := 'recruit_' || least(v_uid::text, p_candidate_id::text)
    || '_' || greatest(v_uid::text, p_candidate_id::text);

  insert into public.conversations (id, members, listing_id, business_id)
  values (v_conv_id, array[v_uid, p_candidate_id], null, null)
  on conflict (id) do nothing;

  return jsonb_build_object('ok', true, 'conversation_id', v_conv_id);
end;
$$;
revoke all on function public.get_or_create_recruitment_conversation(uuid, uuid) from public, anon;
grant execute on function public.get_or_create_recruitment_conversation(uuid, uuid) to authenticated;

create or replace function public.enforce_recruitment_contact_authority()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  -- messages.sender_id/conversation_id are text (ids carry prefixes like
  -- conv_/biz_/rental_), not uuid — every comparison against a uuid column
  -- below needs an explicit cast, or Postgres rejects the operator outright.
  v_sender uuid := new.sender_id::uuid;
  v_conv public.conversations%rowtype;
  v_recipient uuid;
  v_recipient_open_to_work boolean;
begin
  if public.is_admin_team() then return new; end if;

  select * into v_conv from public.conversations where id = new.conversation_id;
  if v_conv.id is null then return new; end if;
  if v_conv.business_id is not null or v_conv.listing_id is not null then return new; end if;
  if array_length(v_conv.members, 1) is distinct from 2 then return new; end if;

  select m into v_recipient from unnest(v_conv.members) as m where m <> v_sender limit 1;
  if v_recipient is null or v_sender = v_recipient then return new; end if;

  select open_to_work into v_recipient_open_to_work from public.profiles where id = v_recipient;
  if coalesce(v_recipient_open_to_work, false) is not true then return new; end if;

  if not public.is_authorized_recruiter() then return new; end if;

  if exists (
    select 1 from public.contact_requests cr
    where cr.requester_id = v_sender and cr.candidate_id = v_recipient and cr.status = 'approved'
  ) then return new; end if;

  if exists (
    select 1 from public.applications a join public.listings j on j.id = a.job_id
    where a.applicant_id = v_recipient and j.seller_id = v_sender
  ) then return new; end if;

  raise exception 'recruitment_contact_not_authorized: request and approval required before messaging this candidate.'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_enforce_recruitment_contact_authority on public.messages;
create trigger trg_enforce_recruitment_contact_authority
  before insert on public.messages
  for each row execute function public.enforce_recruitment_contact_authority();

notify pgrst, 'reload schema';
