-- ============================================================
-- fix_reports_redundant_policies.sql
--
-- P1-5 (2026-07-23 audit): public.reports has two independent SELECT
-- policies and two independent UPDATE policies, created by two separate
-- migrations that never drop each other's policy name (the same "leftover
-- permissive policy" bug class found and fixed on profiles and cv-files
-- storage earlier in this audit — RLS policies for the same command OR
-- together, so neither migration actually replaced the other):
--
--   SELECT:
--     • moderation_backend_phase_a.sql → "reports: reporter or moderator read"
--       using (reporter_id = auth.uid() or public.is_moderator())
--     • admin_security_hardening.sql   → "reports: read own or admin"
--       using (public.is_admin() or reporter_id = auth.uid()::text)
--       ^ this compares a uuid column to a text value — Postgres has no
--       uuid = text operator, so this exact CREATE POLICY statement cannot
--       have succeeded as written. Whether it silently failed (leaving only
--       the first policy) or was hand-corrected before running is not
--       something static analysis can settle either way.
--   UPDATE:
--     • moderation_backend_phase_a.sql → "reports: moderator update"
--       using (public.is_moderator())
--     • admin_security_hardening.sql   → "reports: admin update"
--       using (public.is_admin())
--
-- Rather than assume which pair actually landed, this migration is written
-- to be correct no matter which subset exists today: public.is_moderator()
-- (role in ('admin','moderator')) is already a strict superset of
-- public.is_admin() (role = 'admin'), so consolidating both SELECT
-- policies into one keyed on is_moderator() — and both UPDATE policies
-- into one keyed on is_moderator() — cannot narrow any access an admin
-- currently has (every admin already satisfies is_moderator()), and cannot
-- widen access beyond what the union of the two originally-intended
-- policies already granted. Confirmed live before writing this: anon reads
-- of public.reports return [] (both with select=* and with explicit
-- sensitive columns), so there is no public/anonymous exposure to begin
-- with — this migration only touches the authenticated-role overlap.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- ── SELECT: reporter reads their own reports; moderators/admins read all ──
drop policy if exists "Users read own reports" on public.reports;
drop policy if exists "reports: reporter or moderator read" on public.reports;
drop policy if exists "reports: read own or admin" on public.reports;
create policy "reports: reporter or moderator read"
  on public.reports for select
  using (reporter_id = auth.uid() or public.is_moderator());

-- ── UPDATE: moderators/admins only (regular users never update reports) ──
drop policy if exists "reports: moderator update" on public.reports;
drop policy if exists "reports: admin update" on public.reports;
create policy "reports: moderator update"
  on public.reports for update
  using (public.is_moderator()) with check (public.is_moderator());

-- INSERT ("Authenticated users can report") is untouched — not part of
-- this cleanup, and not duplicated.

-- Verification (run after applying):
--   select policyname, cmd, roles, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'reports'
--   order by cmd, policyname;
--   -- expect exactly ONE select policy ("reports: reporter or moderator
--   -- read") and ONE update policy ("reports: moderator update"), plus the
--   -- untouched insert policy. No "reports: read own or admin" or
--   -- "reports: admin update" should remain.
--
--   -- Access checks to run manually as each role:
--   -- 1. Anon:                     select * from reports; → 0 rows (RLS)
--   -- 2. Regular signed-in user:   select * from reports; → only rows
--   --    where reporter_id = their own auth.uid()
--   -- 3. Moderator (profiles.role='moderator'): select * from reports; →
--   --    all rows; update on any row succeeds
--   -- 4. Admin (profiles.role='admin'):         same as moderator (admin
--   --    satisfies is_moderator()'s role in ('admin','moderator') check)
-- ============================================================
