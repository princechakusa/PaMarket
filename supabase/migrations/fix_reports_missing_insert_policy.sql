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

drop policy if exists "reports: reporter insert" on public.reports;
create policy "reports: reporter insert"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid()::text);

-- Verification (run manually, as a signed-in user):
--   insert into reports (target_type, target_id, reason, reporter_id)
--   values ('listing', '<some-listing-uuid>', 'Spam', auth.uid()::text);
--   -- expect success, not a permission-denied/RLS error
