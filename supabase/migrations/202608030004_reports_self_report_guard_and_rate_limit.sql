-- Two hardening gaps found in the pre-submission Apple audit:
--
-- 1. Nothing stopped a user from reporting themselves — the client UI now
--    guards against it (profile/[id].tsx only shows "Report User" on
--    someone else's profile, and double-checks myId !== id before
--    inserting), but that's not real protection since anyone can call the
--    REST API directly. Enforce it as a real CHECK constraint.
-- 2. Report submission had no rate limit at all — a user could spam reports
--    against many different targets (the existing uq_report unique index
--    only stops duplicate reports against the *same* target). Mirrors the
--    exact pattern already proven for messages (enforce_message_rate_limit
--    in fix_message_rate_limit.sql): a moderator-exempt, server-authoritative
--    BEFORE INSERT trigger backed by moderation_settings.
--
-- ::text casts are used defensively on both sides of every comparison since
-- reporter_id's column type has drifted between schema snapshots in this
-- repo (uuid in some, text in the live/authoritative one per
-- 202608020001_fix_reports_missing_insert_policy.sql) — casting to text
-- works correctly regardless of which one is actually live.

alter table public.reports drop constraint if exists reports_no_self_report;
alter table public.reports add constraint reports_no_self_report
  check (not (target_type = 'user' and target_id = reporter_id::text));

insert into public.moderation_settings (key, int_value)
values ('max_reports_per_5min', 10)
on conflict (key) do nothing;

create or replace function public.enforce_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int;
  cnt int;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if public.is_moderator() then
    return new;
  end if;

  select int_value into lim
  from public.moderation_settings
  where key = 'max_reports_per_5min';
  if lim is null then lim := 10; end if;
  if lim <= 0 then return new; end if;      -- disabled

  -- Server-authoritative timestamp: prevents backdating out of the window.
  new.created_at := now();

  select count(*) into cnt
  from public.reports
  where reporter_id::text = new.reporter_id::text
    and created_at > now() - interval '5 minutes';

  if cnt >= lim then
    raise exception 'rate_limited: too many reports submitted recently. Please wait a moment and try again.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_report_rate_limit on public.reports;
create trigger trg_report_rate_limit
  before insert on public.reports
  for each row execute function public.enforce_report_rate_limit();
