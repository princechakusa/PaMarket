-- ============================================================================
-- AI help assistant (supabase/functions/support-assistant) rate-limit log.
-- One row per question; actor is 'u:<user id>' or 'ip:<hashed ip>' (the raw
-- IP is never stored). Service role only — RLS on, no policies.
-- A nightly pg_cron job deletes rows older than 7 days.
--
-- Also requires the ANTHROPIC_API_KEY Edge Function secret (already set for
-- AMOS) and deploying the support-assistant function.
-- ============================================================================

create table if not exists public.support_assistant_usage (
  id bigint generated always as identity primary key,
  actor text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_assistant_usage_actor_idx
  on public.support_assistant_usage (actor, created_at desc);

alter table public.support_assistant_usage enable row level security;
revoke all on public.support_assistant_usage from anon, authenticated;

-- Housekeeping: keep a week of history.
create or replace function public.prune_support_assistant_usage()
returns void language sql security definer set search_path = public as $$
  delete from public.support_assistant_usage where created_at < now() - interval '7 days';
$$;
revoke all on function public.prune_support_assistant_usage() from public, anon, authenticated;
grant execute on function public.prune_support_assistant_usage() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'prune-support-assistant-usage';
    perform cron.schedule('prune-support-assistant-usage', '17 3 * * *', 'select public.prune_support_assistant_usage()');
  end if;
end $$;

-- ============================================================================
-- In-app "Leave us a message" → a real support ticket.
-- The Help chat used to show "Message sent" without saving anything. Users
-- can't write support_tickets directly (team-only RLS), so this definer RPC
-- opens a ticket + first message for the signed-in user. Max 5 per day.
-- ============================================================================
create or replace function public.submit_support_ticket(
  p_body text,
  p_category text default 'other',
  p_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := left(trim(coalesce(p_body, '')), 4000);
  v_ticket uuid;
  v_recent int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  if length(v_body) < 5 then return jsonb_build_object('ok', false, 'code', 'too_short'); end if;

  select count(*) into v_recent from public.support_tickets
  where requester_id = v_uid and created_at > now() - interval '1 day';
  if v_recent >= 5 then return jsonb_build_object('ok', false, 'code', 'rate_limited'); end if;

  insert into public.support_tickets (subject, requester_id, category, source, priority)
  values (left(regexp_replace(v_body, '\s+', ' ', 'g'), 80),
          v_uid,
          case when p_category in ('billing','listing','account','bug','other') then p_category else 'other' end,
          'app', 'normal')
  returning id into v_ticket;

  insert into public.support_ticket_messages (ticket_id, author_id, author_kind, body)
  values (v_ticket, v_uid, 'user',
          v_body || case when coalesce(trim(p_contact), '') <> '' then E'\n\nPreferred contact: ' || left(trim(p_contact), 120) else '' end);

  return jsonb_build_object('ok', true, 'id', v_ticket);
end;
$$;
revoke execute on function public.submit_support_ticket(text, text, text) from public, anon;
grant execute on function public.submit_support_ticket(text, text, text) to authenticated;

notify pgrst, 'reload schema';
