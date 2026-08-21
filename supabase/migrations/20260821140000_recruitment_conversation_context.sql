-- Recruitment messaging must be architecturally distinct from marketplace
-- personal/business/rental chat: a candidate may also be a buyer/seller/
-- business owner, and recruitment threads must never be presented (or
-- resolved) as though they came from that personal/listing context.
--
-- Mirrors the existing rental_conversation_context binding-table pattern
-- (supabase/migrations/rental_marketplace_extensions.sql, section E2):
-- attach context to the shared conversations table via a side table rather
-- than overloading conversations.business_id/listing_id. Additive only —
-- does not alter the conversations/messages schema.

create table if not exists public.recruitment_conversation_context (
  -- conversations.id is text (recruit_<sortedIds>) — matched exactly
  conversation_id   text not null
                       references public.conversations(id) on delete cascade,
  employer_id       uuid not null references public.profiles(id) on delete cascade,
  candidate_id      uuid not null references public.profiles(id) on delete cascade,
  -- Set when this thread originated from a real job application relationship
  job_id            uuid references public.listings(id) on delete set null,
  -- Set when this thread originated from an approved Browse Candidates
  -- contact request. Distinguishes the two recruitment-authority origins.
  contact_request_id uuid references public.contact_requests(id) on delete set null,
  created_at        timestamptz not null default now(),

  primary key (conversation_id),
  unique (employer_id, candidate_id)
);

create index if not exists rcc2_employer_idx
  on public.recruitment_conversation_context (employer_id, created_at desc);
create index if not exists rcc2_candidate_idx
  on public.recruitment_conversation_context (candidate_id, created_at desc);

alter table public.recruitment_conversation_context enable row level security;

drop policy if exists "recruitment_conversation_context: employer read" on public.recruitment_conversation_context;
create policy "recruitment_conversation_context: employer read"
  on public.recruitment_conversation_context for select
  using (auth.uid() = employer_id);

drop policy if exists "recruitment_conversation_context: candidate read" on public.recruitment_conversation_context;
create policy "recruitment_conversation_context: candidate read"
  on public.recruitment_conversation_context for select
  using (auth.uid() = candidate_id);

drop policy if exists "recruitment_conversation_context: admin all" on public.recruitment_conversation_context;
create policy "recruitment_conversation_context: admin all"
  on public.recruitment_conversation_context for all
  using (public.is_admin_team()) with check (public.is_admin_team());

grant select on public.recruitment_conversation_context to authenticated;

-- ---------------------------------------------------------------------------
-- get_or_create_recruitment_conversation: now also records WHICH recruitment
-- authority (approved contact request vs. real application) justified the
-- thread, so the client can render honest recruitment context instead of
-- falling back to generic personal-chat identity resolution.
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

  -- Admin-initiated threads (no request/application on file) leave context
  -- fields null; the client falls back to a neutral "Recruitment" label.
  if v_contact_request_id is not null or v_job_id is not null then
    insert into public.recruitment_conversation_context
      (conversation_id, employer_id, candidate_id, job_id, contact_request_id)
    values (v_conv_id, v_uid, p_candidate_id, v_job_id, v_contact_request_id)
    on conflict (conversation_id) do update set
      job_id = coalesce(excluded.job_id, public.recruitment_conversation_context.job_id),
      contact_request_id = coalesce(excluded.contact_request_id, public.recruitment_conversation_context.contact_request_id);
  end if;

  return jsonb_build_object('ok', true, 'conversation_id', v_conv_id);
end;
$$;

revoke all on function public.get_or_create_recruitment_conversation(uuid, uuid) from public, anon;
grant execute on function public.get_or_create_recruitment_conversation(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
