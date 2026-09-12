-- ROLLBACK for 20260912054941_security_events_read_rpcs.sql
--
-- Restores the exact C2D state: drops both new RPCs, re-grants
-- `authenticated` table-level SELECT on public.security_events, and
-- recreates the single admin-team-aal2 read policy exactly as C2D defined
-- it. This intentionally restores C2D's own defect (unredacted table
-- access) — only apply this if the C2D-FIX migration itself must be
-- reverted; it does not mean the defect is acceptable.

begin;

drop function if exists public.get_security_event(uuid);
drop function if exists public.list_security_events(
  integer, integer, timestamptz, timestamptz, text, text, text, text, uuid, uuid
);

grant select on public.security_events to authenticated;

create policy "security_events: admin team aal2 read"
  on public.security_events
  for select
  to authenticated
  using (public.has_admin_privilege('admin') and public.has_mfa_aal2());

notify pgrst, 'reload schema';

commit;
