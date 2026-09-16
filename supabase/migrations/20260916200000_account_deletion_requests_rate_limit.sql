-- Website Account-Deletion Form Protection (P2 finding): the public
-- account-deletion request form (delete-account.html) POSTs directly to
-- PostgREST (/rest/v1/account_deletion_requests) using the public anon
-- key -- there is no website server/API layer in this path at all, so
-- PostgREST + RLS IS the actual POST boundary. The existing "adr: public
-- insert" policy (anon+authenticated, with_check true) has no rate limit
-- or bot protection, matching the audit finding.
--
-- This mirrors the exact enforce_report_rate_limit()/
-- enforce_listing_rate_limit() pattern already used for 5 other tables in
-- this project (moderation_settings-configurable limit, count existing
-- rows in a rolling window, raise a check_violation once exceeded) --
-- no new infrastructure, no external CAPTCHA provider, no new table.
--
-- Scoped by the `email` field the form already collects and already
-- indexes (adr_email_idx) -- not by IP. This means no new column, no raw
-- IP ever stored, per the explicit privacy requirement for this stage.
-- It does not stop an attacker rotating through many different emails,
-- but that is the same trade-off every other rate-limit trigger in this
-- project already accepts (each is scoped to the acting identity/owner
-- field available on that table, not to network origin).
--
-- Legitimate use is at most 1-2 submissions per person ever (the form's
-- own error handling explicitly anticipates a retry after "Network
-- error. Please try again."), so a limit of 3 per rolling hour per email
-- comfortably covers real retries while blocking scripted/automated
-- flooding of a single target email.
--
-- Applied live via mcp__supabase__apply_migration on 2026-09-16 and
-- verified: trigger enabled, 1st-3rd requests for one email succeed, 4th
-- within the hour is rejected, a different email is unaffected. All test
-- rows rolled back, zero residue.

create or replace function public.enforce_account_deletion_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  lim int;
  cnt int;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  select int_value into lim
  from public.moderation_settings
  where key = 'max_account_deletion_requests_per_hour';
  if lim is null then lim := 3; end if;
  if lim <= 0 then return new; end if; -- disabled

  select count(*) into cnt
  from public.account_deletion_requests
  where lower(email) = lower(new.email)
    and created_at > now() - interval '1 hour';

  if cnt >= lim then
    raise exception 'rate_limited: too many deletion requests submitted recently for this email. Please wait a while and try again, or contact support@pamarketzw.com.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_account_deletion_request_rate_limit on public.account_deletion_requests;
create trigger trg_account_deletion_request_rate_limit
  before insert on public.account_deletion_requests
  for each row execute function public.enforce_account_deletion_request_rate_limit();
