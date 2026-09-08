-- ============================================================
-- PaMarket — Admin Crash and Error Logs Center (Stage 6)
--
-- Inspection findings (do not re-derive):
--   - Sentry (@sentry/react-native) is already the mobile app's real crash
--     reporter (apps/mobile/lib/sentry.ts, wrapped around RootLayout, plus
--     an explicit captureException in components/ErrorBoundary.tsx). It
--     stays exactly as-is — this migration does not touch it, does not
--     read from the Sentry API, and never puts a Sentry token anywhere
--     near client code (browser or mobile). This table is a lightweight,
--     PaMarket-owned SUMMARY the admin panel can query directly; Sentry
--     remains the deep-diagnostic tool (source maps, breadcrumbs, replay)
--     admins already have via the Sentry dashboard. sentry_event_id below
--     is only ever a cross-reference string, never a live API call target.
--   - public.error_logs already exists (id, type, message, source, stack,
--     user_id, user_agent, created_at) but is a different, narrower thing:
--     a handful of *server-side cron function* failure logs (see
--     run_saved_listing_reminders / run_marketplace_reengagement). It has
--     no fingerprint/dedup, no platform/app-version/screen columns, no
--     status workflow, and mixing "cron job failed" rows with "mobile
--     client crashed" rows would make both harder to triage. Left
--     untouched; app_error_events below is new and purpose-built for
--     client-reported errors.
--   - Admin auth precedent (www/admin.html): ADMIN_ROLES = ['super_admin',
--     'admin','moderator','support','finance'] gates the whole panel;
--     is_admin_team() (unchanged, already live) checks exactly that role
--     set. Mutating admin actions elsewhere in admin.html are plain
--     RLS-gated `.update()` calls from the client followed by a call to
--     the existing auditLog() helper (admin_audit_logs) — not a bespoke
--     RPC per action. This migration follows that same shape: one
--     SECURITY DEFINER RPC for ingestion (the only genuinely new,
--     security-sensitive write path), and ordinary RLS-gated updates for
--     admin status/note changes, exactly like every other admin.html
--     section already does.
--   - Rate-limit precedent: moderation_settings key/int_value table +
--     an in-function count-and-reject check (enforce_message_rate_limit).
--     Reused below with a new key rather than a new mechanism.
--
-- Safe to run more than once.
-- ============================================================

create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'mobile'
    check (source in ('mobile', 'website', 'edge_function')),
  fingerprint text not null,
  error_type text not null,
  message text not null,
  stack text,
  screen text,
  component text,
  app_version text,
  build_number text,
  platform text
    check (platform is null or platform in ('ios', 'android', 'web')),
  os_version text,
  device_model text,
  environment text not null default 'production'
    check (environment in ('production', 'development', 'preview')),
  user_id uuid,
  severity text not null default 'error'
    check (severity in ('fatal', 'error', 'warning')),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  -- Bounded sample (never unbounded growth) plus an exact running count —
  -- the count keeps incrementing even once the sample array is full.
  affected_user_ids uuid[] not null default '{}',
  affected_users_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved')),
  admin_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  sentry_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_error_events_fingerprint_unique unique (fingerprint),
  constraint app_error_events_message_length check (char_length(message) <= 500),
  constraint app_error_events_stack_length check (stack is null or char_length(stack) <= 8000),
  constraint app_error_events_notes_length check (admin_notes is null or char_length(admin_notes) <= 2000)
);

create index if not exists app_error_events_last_seen_idx on public.app_error_events (last_seen_at desc);
create index if not exists app_error_events_severity_idx on public.app_error_events (severity);
create index if not exists app_error_events_platform_idx on public.app_error_events (platform);
create index if not exists app_error_events_app_version_idx on public.app_error_events (app_version);
create index if not exists app_error_events_status_idx on public.app_error_events (status);
create index if not exists app_error_events_screen_idx on public.app_error_events (screen);
create index if not exists app_error_events_status_last_seen_idx on public.app_error_events (status, last_seen_at desc);

drop trigger if exists app_error_events_set_updated_at on public.app_error_events;
create trigger app_error_events_set_updated_at
  before update on public.app_error_events
  for each row execute function public.set_updated_at();

-- Stamps resolved_at/resolved_by from the server's own clock and the
-- caller's real auth.uid() whenever status moves to/from 'resolved' —
-- never trusts whatever the admin client happened to send for these two
-- columns, even though the update itself is a plain client-side call.
create or replace function public.stamp_error_event_resolution()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
    new.resolved_by := auth.uid();
  elsif new.status <> 'resolved' then
    new.resolved_at := null;
    new.resolved_by := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists app_error_events_stamp_resolution on public.app_error_events;
create trigger app_error_events_stamp_resolution
  before update of status on public.app_error_events
  for each row execute function public.stamp_error_event_resolution();

-- Trigger functions can't usefully be invoked directly anyway (Postgres
-- rejects a bare call outside trigger context), but closed for the same
-- explicit-revoke reason as redact_error_text above.
revoke all on function public.stamp_error_event_resolution() from public, anon, authenticated;

-- ── RLS ────────────────────────────────────────────────────────
-- Default privileges on this project grant anon/authenticated full table
-- access on any new table (confirmed live in Stage 1) — every grant below
-- is explicit, not incremental. No client role gets INSERT at all: the
-- log_client_error() RPC is the only write path for new/updated events
-- (it is SECURITY DEFINER and so is unaffected by these policies).
alter table public.app_error_events enable row level security;

revoke all on table public.app_error_events from anon, authenticated;
grant select, update on table public.app_error_events to authenticated;

drop policy if exists "app_error_events: admin team read" on public.app_error_events;
create policy "app_error_events: admin team read"
  on public.app_error_events for select to authenticated
  using (public.is_admin_team());

-- Status/notes changes are a narrower "admin" (not full admin-team) action
-- — matches how content.manage/taxonomy.manage are already reserved to
-- super_admin/admin only elsewhere in admin.html's ROLE_PERMS.
drop policy if exists "app_error_events: admin update" on public.app_error_events;
create policy "app_error_events: admin update"
  on public.app_error_events for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- No insert/delete policy for any client role — combined with the
-- table-level revoke above, direct client inserts/deletes are impossible.

-- ── Rate limiting (reuses the existing moderation_settings table) ───────
insert into public.moderation_settings (key, int_value) values
  ('max_error_events_per_10min_per_user', 30),
  ('max_anon_error_events_per_10min', 200)
on conflict (key) do nothing;

-- Strips the shapes of secrets that might slip into a message/stack
-- despite client-side redaction — defense in depth, not the only layer.
create or replace function public.redact_error_text(p_text text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case when p_text is null then null else
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            p_text,
            'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', '[redacted-jwt]', 'g'
          ),
          -- The separator between the keyword and its value is optional
          -- so this also catches the common "Authorization: Bearer <tok>"
          -- and plain "Bearer <tok>" (space, no colon/equals) shapes, not
          -- just "key=value"/"key:value".
          '(?i)(bearer|apikey|api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|password|secret)\s*[:=]?\s*\S+', '\1 [redacted]', 'g'
        ),
        '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[redacted-email]', 'g'
      ),
      -- \b is NOT a word boundary in PostgreSQL's regex flavor (it matches
      -- a literal backspace character — \y is the real word-boundary
      -- metacharacter here) — omitted entirely; {8} already anchors the
      -- match to exactly a 10-digit Zimbabwean mobile number.
      '(\+?263|0)7[0-9]{8}', '[redacted-phone]', 'g'
    )
  end;
$function$;

-- Internal helper, never called directly by any client — only from inside
-- log_client_error(). Postgres grants EXECUTE to PUBLIC by default for
-- every new function unless revoked; closing that here even though a
-- direct call is harmless (pure text transform, no data access) for the
-- same "revoke unnecessary public/client execute" reason as everywhere
-- else in this migration.
revoke all on function public.redact_error_text(text) from public, anon, authenticated;

-- ── Ingestion RPC ─────────────────────────────────────────────────
-- Callable by anon (a crash can happen before sign-in) and authenticated.
-- Never trusts the client for fingerprint, user_id, or dedup — all three
-- are computed/derived server-side. Truncation and redaction are applied
-- unconditionally regardless of what the client already did on its side.
create or replace function public.log_client_error(
  p_source text,
  p_error_type text,
  p_message text,
  p_stack text default null,
  p_screen text default null,
  p_component text default null,
  p_app_version text default null,
  p_build_number text default null,
  p_platform text default null,
  p_os_version text default null,
  p_device_model text default null,
  p_environment text default 'production',
  p_severity text default 'error',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_source text := case when p_source in ('mobile','website','edge_function') then p_source else 'mobile' end;
  v_severity text := case when p_severity in ('fatal','error','warning') then p_severity else 'error' end;
  v_environment text := case when p_environment in ('production','development','preview') then p_environment else 'production' end;
  v_platform text := case when p_platform in ('ios','android','web') then p_platform else null end;
  v_error_type text;
  v_message text;
  v_stack text;
  v_fingerprint text;
  v_max_user int;
  v_max_anon int;
  v_recent int;
  v_id uuid;
  v_occurrence int;
  v_metadata jsonb;
begin
  if coalesce(trim(p_error_type), '') = '' or coalesce(trim(p_message), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload', 'msg', 'error_type and message are required.');
  end if;

  -- Bounded regardless of what the client sent — a runaway/hostile payload
  -- can never grow the table's per-row storage past this.
  v_error_type := left(trim(p_error_type), 120);
  v_message := public.redact_error_text(left(trim(p_message), 500));
  v_stack := public.redact_error_text(left(p_stack, 8000));
  -- Metadata is attacker-controlled JSON — cap its serialized size rather
  -- than trust arbitrary nesting/length.
  v_metadata := case when p_metadata is null then '{}'::jsonb
    when length(p_metadata::text) > 4000 then '{"truncated":true}'::jsonb
    else p_metadata end;

  perform pg_advisory_xact_lock(hashtext('log_client_error:' || coalesce(v_uid::text, 'anon')));

  if v_uid is not null then
    select int_value into v_max_user from public.moderation_settings where key = 'max_error_events_per_10min_per_user';
    if v_max_user is null then v_max_user := 30; end if;
    if v_max_user > 0 then
      select count(*) into v_recent
      from public.app_error_events
      where user_id = v_uid and last_seen_at > now() - interval '10 minutes';
      if v_recent >= v_max_user then
        return jsonb_build_object('ok', false, 'code', 'rate_limited', 'msg', 'Too many error reports from this account recently.');
      end if;
    end if;
  else
    select int_value into v_max_anon from public.moderation_settings where key = 'max_anon_error_events_per_10min';
    if v_max_anon is null then v_max_anon := 200; end if;
    if v_max_anon > 0 then
      select count(*) into v_recent
      from public.app_error_events
      where user_id is null and last_seen_at > now() - interval '10 minutes';
      if v_recent >= v_max_anon then
        return jsonb_build_object('ok', false, 'code', 'rate_limited', 'msg', 'Too many anonymous error reports recently.');
      end if;
    end if;
  end if;

  -- Server-computed grouping key — a client-supplied fingerprint is never
  -- used, so a client can neither force a collision nor dodge dedup.
  v_fingerprint := md5(v_source || '|' || v_error_type || '|' || left(v_message, 200) || '|' || coalesce(p_screen, ''));

  insert into public.app_error_events (
    source, fingerprint, error_type, message, stack, screen, component,
    app_version, build_number, platform, os_version, device_model,
    environment, user_id, severity, occurrence_count,
    affected_user_ids, affected_users_count, first_seen_at, last_seen_at, metadata
  ) values (
    v_source, v_fingerprint, v_error_type, v_message, v_stack, left(p_screen, 200), left(p_component, 200),
    left(p_app_version, 40), left(p_build_number, 40), v_platform, left(p_os_version, 60), left(p_device_model, 120),
    v_environment, v_uid, v_severity, 1,
    case when v_uid is not null then array[v_uid] else '{}' end,
    case when v_uid is not null then 1 else 0 end,
    now(), now(), v_metadata
  )
  on conflict (fingerprint) do update set
    occurrence_count = app_error_events.occurrence_count + 1,
    last_seen_at = now(),
    stack = coalesce(excluded.stack, app_error_events.stack),
    app_version = coalesce(excluded.app_version, app_error_events.app_version),
    build_number = coalesce(excluded.build_number, app_error_events.build_number),
    metadata = excluded.metadata,
    affected_user_ids = case
      when v_uid is null then app_error_events.affected_user_ids
      when v_uid = any(app_error_events.affected_user_ids) then app_error_events.affected_user_ids
      when array_length(app_error_events.affected_user_ids, 1) is null then array[v_uid]
      when array_length(app_error_events.affected_user_ids, 1) < 25 then array_append(app_error_events.affected_user_ids, v_uid)
      else app_error_events.affected_user_ids
    end,
    affected_users_count = case
      when v_uid is null then app_error_events.affected_users_count
      when v_uid = any(app_error_events.affected_user_ids) then app_error_events.affected_users_count
      else app_error_events.affected_users_count + 1
    end,
    -- A regression on a previously-resolved error is meaningful signal —
    -- reopen it automatically rather than silently hiding a recurrence
    -- behind a stale "resolved" status (mirrors how Sentry itself treats
    -- a new event on a resolved issue).
    status = case when app_error_events.status = 'resolved' then 'open' else app_error_events.status end
  returning id, occurrence_count into v_id, v_occurrence;

  return jsonb_build_object('ok', true, 'id', v_id, 'occurrence_count', v_occurrence, 'fingerprint', v_fingerprint);
exception when others then
  -- Ingestion must never surface a raw DB error to the app, and must
  -- never be the reason a real user action fails.
  return jsonb_build_object('ok', false, 'code', 'log_failed', 'msg', 'Could not record this error.');
end;
$function$;

revoke all on function public.log_client_error(text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.log_client_error(text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) to anon, authenticated, service_role;
