-- The mobile app's Report flow (apps/mobile/app/listing/[id].tsx submitReport,
-- and the equivalent in chat/[id].tsx) inserts into public.reports directly
-- from the client. RLS has been enabled on this table since
-- moderation_backend_phase_a.sql, and every migration since then
-- (fix_reports_redundant_policies.sql, admin_security_hardening.sql) only
-- ever touched the SELECT and UPDATE policies — one of them even assumed
-- "the untouched insert policy" already existed. Grepping every migration
-- in this repo turns up zero `for insert` policy on public.reports. With
-- RLS enabled and no matching policy, every insert is silently denied by
-- default — this is why reporting a listing/user/message has never worked.
--
-- reports.reporter_id is TEXT in production (not uuid — same pattern as
-- messages.sender_id), so auth.uid() must be cast to text to compare,
-- matching the exact pattern already fixed for this table's SELECT policy
-- in fix_reports_redundant_policies.sql.
--
-- Re-created here with a proper timestamped filename (the original
-- fix_reports_missing_insert_policy.sql predates this project's move to
-- CLI-tracked migrations and was never actually tracked/pushed) so it's
-- provably applied via `supabase db push` rather than trusted to have been
-- pasted into the SQL Editor by hand at some point.

drop policy if exists "reports: reporter insert" on public.reports;
create policy "reports: reporter insert"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid()::text);
