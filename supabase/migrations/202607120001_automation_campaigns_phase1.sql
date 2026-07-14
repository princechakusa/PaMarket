-- PaMarket automation phase 1 (2026-07-12)
-- Reliable scheduled notifications + paid-ad lifecycle automation.

set search_path = public;

create extension if not exists pgcrypto;

create table if not exists public.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  target text not null default 'all',
  title text not null,
  body text not null,
  type text not null default 'info',
  deep_link text,
  image_url text,
  provinces text[],
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.scheduled_notifications
  add column if not exists attempts integer not null default 0,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_error text,
  add column if not exists created_by uuid,
  add column if not exists idempotency_key text,
  add column if not exists delivery_count integer not null default 0,
  add column if not exists failure_count integer not null default 0,
  add column if not exists delivery_result jsonb not null default '{}'::jsonb;

alter table public.scheduled_notifications
  drop constraint if exists scheduled_notifications_status_check;
alter table public.scheduled_notifications
  add constraint scheduled_notifications_status_check
  check (status in ('pending','processing','sent','failed','cancelled'));

create unique index if not exists scheduled_notifications_idempotency_idx
  on public.scheduled_notifications (idempotency_key)
  where idempotency_key is not null;
create index if not exists scheduled_notifications_due_idx
  on public.scheduled_notifications (scheduled_for, next_attempt_at)
  where status = 'pending';

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  ok boolean not null default true,
  detail text,
  rows_affected integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.job_runs add column if not exists meta jsonb not null default '{}'::jsonb;
create index if not exists job_runs_job_created_idx on public.job_runs (job, created_at desc);

alter table public.paid_ads
  add column if not exists status text,
  add column if not exists activated_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists automation_error text;

update public.paid_ads
set status = case
  when active = false and ends_at is not null and ends_at <= now() then 'completed'
  when active = false and starts_at is not null and starts_at > now() then 'scheduled'
  when active = true then 'active'
  else 'paused'
end
where status is null;

alter table public.paid_ads alter column status set default 'draft';
alter table public.paid_ads alter column status set not null;
alter table public.paid_ads drop constraint if exists paid_ads_status_check;
alter table public.paid_ads add constraint paid_ads_status_check
  check (status in ('draft','scheduled','active','paused','completed','failed'));
create index if not exists paid_ads_lifecycle_idx
  on public.paid_ads (status, starts_at, ends_at);

-- Atomically claims due rows. SKIP LOCKED prevents duplicate sends if two
-- worker invocations overlap. Only the service role may execute it.
create or replace function public.claim_due_scheduled_notifications(p_limit integer default 20)
returns setof public.scheduled_notifications
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select n.id
    from public.scheduled_notifications n
    where n.status = 'pending'
      and n.scheduled_for <= now()
      and coalesce(n.next_attempt_at, n.scheduled_for) <= now()
      and n.attempts < n.max_attempts
    order by n.scheduled_for asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,20),100))
  ), claimed as (
    update public.scheduled_notifications n
    set status = 'processing',
        attempts = n.attempts + 1,
        locked_at = now(),
        processing_started_at = coalesce(n.processing_started_at, now()),
        last_error = null
    from due
    where n.id = due.id
    returning n.*
  )
  select * from claimed;
end;
$$;

revoke all on function public.claim_due_scheduled_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_notifications(integer) to service_role;

-- Keeps ad state derived from its schedule. Safe to call repeatedly.
create or replace function public.run_paid_ads_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activated integer := 0;
  v_completed integer := 0;
begin
  update public.paid_ads
  set status = 'active', active = true,
      activated_at = coalesce(activated_at, now()), automation_error = null
  where status = 'scheduled'
    and coalesce(starts_at, now()) <= now()
    and (ends_at is null or ends_at > now());
  get diagnostics v_activated = row_count;

  update public.paid_ads
  set status = 'completed', active = false,
      completed_at = coalesce(completed_at, now()), automation_error = null
  where status in ('scheduled','active')
    and ends_at is not null and ends_at <= now();
  get diagnostics v_completed = row_count;

  return jsonb_build_object('activated',v_activated,'completed',v_completed);
end;
$$;

revoke all on function public.run_paid_ads_lifecycle() from public, anon, authenticated;
grant execute on function public.run_paid_ads_lifecycle() to service_role;

alter table public.scheduled_notifications enable row level security;
alter table public.job_runs enable row level security;

drop policy if exists "scheduled notifications admin read" on public.scheduled_notifications;
create policy "scheduled notifications admin read"
  on public.scheduled_notifications for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id::text = auth.uid()::text and p.role = 'admin'
  ));
drop policy if exists "scheduled notifications admin update" on public.scheduled_notifications;
create policy "scheduled notifications admin update"
  on public.scheduled_notifications for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id::text = auth.uid()::text and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id::text = auth.uid()::text and p.role = 'admin'
  ));

drop policy if exists "job runs admin read" on public.job_runs;
create policy "job runs admin read"
  on public.job_runs for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id::text = auth.uid()::text and p.role = 'admin'
  ));
