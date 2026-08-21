-- Codex P0/P1 recruitment security audit fixes.
--
-- P0-1: profiles_public (security-barrier view, runs with the view OWNER's
-- privileges — bypasses the base profiles table's "owner or staff read" RLS
-- entirely) exposed job_title/skills/sector/exp/open_to_work — fields with
-- ZERO consuming use anywhere in the app or website (verified via full-repo
-- grep before touching this) other than functioning as a complete, free,
-- anonymous clone of "Browse Candidates" (filter open_to_work=true, read
-- name+phone) that totally bypasses the recruiter_monthly + contact-request
-- + admin-approval system this whole engagement built. Dropping these five
-- columns closes that directory-enumeration vector; the legitimate columns
-- marketplace/chat/business/rental/review surfaces actually read (id, name,
-- avatar, verified, role, bio, city, last_seen, privacy, language, status,
-- created_at, updated_at — confirmed via grep of every `.from("profiles_public")`
-- call site) are untouched.
--
-- `phone` stays for its one genuine load-bearing use (WhatsApp/Call buttons
-- on marketplace listings — see fix_profiles_public_email_leak.sql) but is
-- now hidden specifically for profiles with open_to_work = true: an
-- authorized recruiter who legitimately learned a candidate's UUID via
-- browse_recruitment_candidates must not be able to pivot straight to
-- profiles_public and pull their phone number, skipping the entire
-- approve-then-message flow. A candidate who is also an ordinary marketplace
-- seller keeps their listing phone-reveal working right up until they flip
-- Open to Work on — the same flag they already control for Browse Candidates
-- visibility, so this is not a new/surprise restriction.
--
-- security_invoker is deliberately NOT added here even though a local file
-- (fix_profiles_public_security_invoker.sql) proposes it and Supabase's
-- linter flags the current security-definer-equivalent behavior: direct
-- verification against production (this migration) shows it was never
-- actually applied, and the base table's current RLS ("owner or staff
-- read") would make enabling it now return ZERO rows to anon AND to every
-- authenticated non-owner/non-staff caller — breaking every cross-user
-- profile read in both the app and the website (seller cards, chat avatars,
-- presence, business/rental lookups, review author names — all confirmed
-- consumers of this view). That is a separate, much larger architectural
-- change (the base RLS would need to allow a broader-but-still-safe
-- authenticated read first) and is reported, not silently applied, per this
-- task's explicit instruction not to blindly break marketplace functionality.
drop view if exists public.profiles_public;

create view public.profiles_public
  with (security_barrier = true)
as
  select
    id,
    name,
    avatar,
    verified,
    role,
    created_at,
    updated_at,
    bio,
    city,
    last_seen,
    privacy,
    language,
    status,
    case when open_to_work is true then null else phone end as phone
  from public.profiles;

-- Independently discovered while investigating P0-1 (not in Codex's report,
-- but the same "least privilege" principle P1-2 asks for on the recruitment
-- context table applies here too, more urgently): this read-only identity
-- view had INSERT/UPDATE/DELETE/TRUNCATE granted to anon AND authenticated.
-- Because it is a simple single-table projection with no WHERE/GROUP BY,
-- Postgres treats it as automatically updatable — meaning any anonymous
-- caller could UPDATE or DELETE arbitrary users' profile rows through it.
-- No app or website code writes to profiles_public anywhere (verified by
-- grep) — all legitimate writes go through public.profiles directly, which
-- has its own real RLS. Revoked entirely; SELECT-only from here on.
revoke all on public.profiles_public from anon, authenticated;
grant select on public.profiles_public to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- P1-2: recruitment_conversation_context grants were left at whatever the
-- CREATE TABLE default was (owner-level for postgres/service_role is
-- correct and untouched) plus a blanket `grant select ... to authenticated`
-- from 20260821140000 — but table-level default privileges on Supabase can
-- include more than that depending on default ACLs. Explicitly reduce to
-- the minimum: SELECT only, for authenticated (RLS still further narrows to
-- own rows) — no anon grant at all (anon has no legitimate reason to read
-- ANY recruitment context), and no INSERT/UPDATE/DELETE/TRUNCATE for any
-- client role. All writes happen exclusively through the SECURITY DEFINER
-- get_or_create_recruitment_conversation RPC (owned by a role with the
-- underlying table privileges), never directly by a client.
-- ---------------------------------------------------------------------------
revoke all on public.recruitment_conversation_context from anon, authenticated, public;
grant select on public.recruitment_conversation_context to authenticated;

-- ---------------------------------------------------------------------------
-- P0-3 / P1-1 / P1-5: get_or_create_recruitment_conversation must (a) always
-- produce a valid context row for every ok:true result, including the
-- admin/moderator path, and (b) never silently return ok:true against a
-- pre-existing context row that doesn't actually match the requested
-- employer/candidate relationship.
--
-- Design change from 20260821170000: the context write is now
-- `on conflict (conversation_id) do nothing` (never overwrites an existing
-- row's employer_id/candidate_id — those never change once set), followed
-- by an explicit re-read and a strict identity check. A pre-existing row
-- that doesn't match the caller/candidate pair returns a deterministic
-- integrity error instead of quietly leaving mismatched data in place while
-- still reporting success. job_id/contact_request_id are only ever
-- backfilled from null -> a real value, never overwritten once set.
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
  v_ctx public.recruitment_conversation_context%rowtype;
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

  select * into v_conv from public.conversations where id = v_conv_id;
  if v_conv.id is null
     or v_conv.members is null
     or array_length(v_conv.members, 1) is distinct from 2
     or not (v_conv.members @> array[v_uid, p_candidate_id])
     or v_conv.business_id is not null
     or v_conv.listing_id is not null then
    return jsonb_build_object('ok', false, 'code', 'conversation_integrity_error');
  end if;

  -- Always produce a context row for a successful result — including the
  -- admin/moderator path, which previously left ok:true with NO context row
  -- at all (P0-3). job_id/contact_request_id stay null for an admin-only
  -- authority with neither on file; that's a valid, honest state, not a
  -- missing row.
  insert into public.recruitment_conversation_context
    (conversation_id, employer_id, candidate_id, job_id, contact_request_id)
  values (v_conv_id, v_uid, p_candidate_id, v_job_id, v_contact_request_id)
  on conflict (conversation_id) do nothing;

  select * into v_ctx from public.recruitment_conversation_context where conversation_id = v_conv_id;
  if v_ctx.conversation_id is null
     or v_ctx.employer_id is distinct from v_uid
     or v_ctx.candidate_id is distinct from p_candidate_id then
    -- A context row exists at this deterministic id but does not match the
    -- requested relationship (e.g. roles reversed from an earlier call) —
    -- never silently trust or overwrite it.
    return jsonb_build_object('ok', false, 'code', 'context_integrity_error');
  end if;

  if v_ctx.job_id is null and v_job_id is not null then
    update public.recruitment_conversation_context set job_id = v_job_id where conversation_id = v_conv_id;
  end if;
  if v_ctx.contact_request_id is null and v_contact_request_id is not null then
    update public.recruitment_conversation_context set contact_request_id = v_contact_request_id where conversation_id = v_conv_id;
  end if;

  return jsonb_build_object('ok', true, 'conversation_id', v_conv_id);
end;
$$;

revoke all on function public.get_or_create_recruitment_conversation(uuid, uuid) from public, anon;
grant execute on function public.get_or_create_recruitment_conversation(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
