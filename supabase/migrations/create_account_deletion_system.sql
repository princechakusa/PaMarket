-- ============================================================
-- create_account_deletion_system.sql
--
-- Public data-deletion request flow (GDPR-style "right to be forgotten"),
-- required for the /delete-account website page. The frontend only ever
-- INSERTs a pending request — actual deletion is a manual/admin-triggered
-- action via the process_account_deletion Edge Function, never automatic.
--
-- Run once in Supabase SQL Editor.
-- ============================================================

-- ── account_deletion_requests ────────────────────────────────────────
create table if not exists public.account_deletion_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  email       text not null,
  reason      text,
  status      text not null default 'pending'
                check (status in ('pending','processing','completed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists adr_status_idx on public.account_deletion_requests (status, created_at desc);
create index if not exists adr_email_idx  on public.account_deletion_requests (email);

create or replace function public.touch_adr_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_adr_updated_at on public.account_deletion_requests;
create trigger trg_adr_updated_at
  before update on public.account_deletion_requests
  for each row execute function public.touch_adr_updated_at();

alter table public.account_deletion_requests enable row level security;

-- INSERT: anyone (including anon) can submit a deletion request. Deliberately
-- open — a user requesting deletion may not be able to authenticate (e.g.
-- forgotten password), and the request itself carries no sensitive access,
-- only a claim to be reviewed by a human before anything is deleted.
drop policy if exists "adr: public insert" on public.account_deletion_requests;
create policy "adr: public insert"
  on public.account_deletion_requests for insert to anon, authenticated
  with check (true);

-- SELECT: admin only.
drop policy if exists "adr: admin select" on public.account_deletion_requests;
create policy "adr: admin select"
  on public.account_deletion_requests for select
  using (public.is_admin());

-- UPDATE: admin only (status transitions).
drop policy if exists "adr: admin update" on public.account_deletion_requests;
create policy "adr: admin update"
  on public.account_deletion_requests for update
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: admin only.
drop policy if exists "adr: admin delete" on public.account_deletion_requests;
create policy "adr: admin delete"
  on public.account_deletion_requests for delete
  using (public.is_admin());

grant insert on public.account_deletion_requests to anon, authenticated;
grant select, update, delete on public.account_deletion_requests to authenticated;

-- ── deletion_logs ─────────────────────────────────────────────────────
-- Append-only audit trail of what was actually deleted, when, by whom, and
-- for which request. Written only by the process_account_deletion Edge
-- Function (service-role key — RLS below blocks all client access).
create table if not exists public.deletion_logs (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid references public.account_deletion_requests(id) on delete set null,
  user_id       uuid,
  email         text,
  deleted_tables jsonb not null default '[]'::jsonb,
  auth_user_deleted boolean not null default false,
  performed_by  uuid,
  created_at    timestamptz not null default now()
);

create index if not exists dl_request_idx on public.deletion_logs (request_id);

alter table public.deletion_logs enable row level security;

-- Admin can read the audit trail. No insert/update/delete policy for any
-- client role — writes only happen via the Edge Function's service-role
-- key, which bypasses RLS entirely (by design, for an append-only log).
drop policy if exists "deletion_logs: admin select" on public.deletion_logs;
create policy "deletion_logs: admin select"
  on public.deletion_logs for select
  using (public.is_admin());

-- ── VERIFY (optional) ─────────────────────────────────────────────────
-- select policyname, cmd from pg_policies where tablename = 'account_deletion_requests';
-- select policyname, cmd from pg_policies where tablename = 'deletion_logs';
-- ============================================================
