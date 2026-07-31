-- ============================================================
-- PaMarket — admin login guard (run once in SQL Editor)
-- Backs the admin-login-guard Edge Function: real-IP-aware brute-force
-- tracking and timed lockouts for the admin.html login, separate from the
-- client-side sessionStorage lockout (which an attacker can just clear).
-- Both tables are written ONLY by the service role (edge function) — no
-- authenticated/anon INSERT policy exists, so a compromised anon key cannot
-- forge attempts or blocks. Admins may read for the Security Center UI.
-- Safe to run more than once.
-- ============================================================

-- admin_login_attempts may already exist (created ad hoc); add the ip column
-- if missing rather than recreating.
create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text,
  ok boolean not null,
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.admin_login_attempts add column if not exists ip text;

create index if not exists admin_login_attempts_ip_idx on public.admin_login_attempts (ip, created_at desc);
create index if not exists admin_login_attempts_email_idx on public.admin_login_attempts (email, created_at desc);

create table if not exists public.admin_ip_blocks (
  id uuid primary key default gen_random_uuid(),
  ip text,
  email text,
  reason text,
  until timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_ip_blocks_until_idx on public.admin_ip_blocks (until desc);
create index if not exists admin_ip_blocks_ip_idx on public.admin_ip_blocks (ip);
create index if not exists admin_ip_blocks_email_idx on public.admin_ip_blocks (email);

alter table public.admin_login_attempts enable row level security;
alter table public.admin_ip_blocks enable row level security;

drop policy if exists "admin_login_attempts: admin read" on public.admin_login_attempts;
create policy "admin_login_attempts: admin read" on public.admin_login_attempts
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_ip_blocks: admin read" on public.admin_ip_blocks;
create policy "admin_ip_blocks: admin read" on public.admin_ip_blocks
  for select to authenticated
  using (public.is_admin());

-- No insert/update/delete policies for authenticated/anon — writes happen
-- exclusively via the service-role key inside admin-login-guard, which
-- bypasses RLS by design. This is what makes the lockout tamper-proof from
-- the browser: nothing client-side can clear a block or forge a clean record.
