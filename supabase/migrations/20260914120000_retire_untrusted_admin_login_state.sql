-- C2E-3A: retire browser writes to the legacy admin login-attempt ledger.
--
-- Supabase Auth is the authoritative password/brute-force boundary. A browser
-- cannot prove that Auth rejected a password, so no anon/authenticated request
-- may manufacture an attempt or block row. Historical rows remain readable to
-- authorized staff under the existing SELECT policies.

drop policy if exists "login_attempts insert" on public.admin_login_attempts;

-- Remove any legacy or default browser DML grants. Regrant only the read used
-- by the Security Center; RLS still limits that read to its admin policies.
revoke all privileges on table public.admin_login_attempts from public, anon, authenticated;
revoke all privileges on table public.admin_ip_blocks from public, anon, authenticated;

grant select on table public.admin_login_attempts to authenticated;
grant select on table public.admin_ip_blocks to authenticated;

comment on table public.admin_login_attempts is
  'Historical operational login signals. Browser writes retired in C2E-3A; Supabase Auth owns password attempt enforcement.';
comment on table public.admin_ip_blocks is
  'Historical custom login blocks. Browser writes and client-asserted block creation retired in C2E-3A.';
