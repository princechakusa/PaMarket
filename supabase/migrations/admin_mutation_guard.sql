-- ============================================================
-- PaMarket — admin mutation rate limiting (run once in SQL Editor)
-- Backs the admin-login-guard edge function's mutation-check/mutation-record
-- actions: throttles destructive admin actions (ban, delete, role change) —
-- 20 per 5 minutes per admin, then a 10-minute cool-down. Server-side and
-- keyed by verified admin UID (JWT), so it can't be bypassed by clearing
-- browser storage the way a client-side counter could.
-- Both tables are written ONLY by the service role (edge function). Safe to
-- run more than once.
-- ============================================================

create table if not exists public.admin_mutation_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action_name text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists admin_mutation_log_admin_idx on public.admin_mutation_log (admin_id, created_at desc);

create table if not exists public.admin_mutation_blocks (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  reason text,
  until timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_mutation_blocks_admin_idx on public.admin_mutation_blocks (admin_id);
create index if not exists admin_mutation_blocks_until_idx on public.admin_mutation_blocks (until desc);

alter table public.admin_mutation_log enable row level security;
alter table public.admin_mutation_blocks enable row level security;

drop policy if exists "admin_mutation_log: admin read" on public.admin_mutation_log;
create policy "admin_mutation_log: admin read" on public.admin_mutation_log
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_mutation_blocks: admin read" on public.admin_mutation_blocks;
create policy "admin_mutation_blocks: admin read" on public.admin_mutation_blocks
  for select to authenticated
  using (public.is_admin());

-- No insert/update/delete policies for authenticated/anon — writes happen
-- exclusively via the service-role key inside admin-login-guard.
