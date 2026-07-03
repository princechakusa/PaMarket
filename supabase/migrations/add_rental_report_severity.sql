-- ============================================================
-- PaMarket — add severity/escalation to rental reports (Module 5)
--
-- rental_reports already has categorization (reason: fraudulent/wrong_category/
-- offensive/unavailable/duplicate/other) and a full status workflow
-- (open -> reviewing -> resolved -> dismissed), resolved_by/at, admin_note.
-- The ONLY missing piece for the escalation requirement is a severity level, so
-- we extend the existing table with one column (no new table).
--
-- Default 'medium' keeps existing rows valid. Admin-only writes are already
-- enforced by the existing "rental_reports admin" RLS policy (is_admin()).
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================

alter table public.rental_reports
  add column if not exists severity text not null default 'medium'
    check (severity in ('low','medium','high'));

-- Optional: seed a sensible severity from the existing reason so the queue is
-- immediately useful (fraud = high). Only touches rows still at the default.
update public.rental_reports
  set severity = 'high'
  where reason = 'fraudulent' and severity = 'medium';

create index if not exists rrep_severity_idx
  on public.rental_reports (severity, status, created_at desc);
