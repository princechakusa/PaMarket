-- ROLLBACK for 20260911210834_create_security_events.sql
--
-- Drops every object this migration created, in dependency order. Restores
-- the exact pre-C2D schema. Touches nothing else (no existing table,
-- function, or policy from an earlier stage is modified).
--
-- Apply the same way as the forward migration
-- (`supabase db query --linked -f <this file>`) only if C2D must be
-- reverted after being applied.

begin;

drop function if exists public.security_events_cleanup_expired();
drop function if exists public.release_legal_hold(uuid);
drop function if exists public.place_legal_hold(uuid, uuid, text);
drop function if exists public.record_security_event(
  text, text, text, uuid, text, boolean, text, text, text, text, text, text,
  uuid, text, text, inet, text, text, text, jsonb
);

drop table if exists public.security_event_legal_holds;

drop trigger if exists trg_security_events_block_delete on public.security_events;
drop trigger if exists trg_security_events_block_update on public.security_events;
drop function if exists public.security_events_block_mutation();

drop table if exists public.security_events;

notify pgrst, 'reload schema';

commit;
