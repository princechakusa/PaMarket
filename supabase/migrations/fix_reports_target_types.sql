-- ============================================================
-- PaMarket — accept all report target types the app actually sends
--
-- Audit finding (Section 2, RP1): the app lets users report BUSINESSES
-- (messages.js reportShop -> target_type 'business') and MESSAGES
-- (messages.js -> target_type 'message'), but the reports.target_type CHECK
-- constraint only allowed ('listing','user','support','bug','appeal'). Postgres
-- rejected those inserts, and the client swallowed the error (.catch(()=>{}))
-- while showing "Report submitted" — so business/message reports vanished
-- silently and never reached admin moderation.
--
-- Fix: widen the CHECK constraint to the full set the client emits. Existing
-- rows are unaffected. Idempotent.
-- ============================================================

alter table public.reports
  drop constraint if exists reports_target_type_check;

alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('listing','user','business','message','support','bug','appeal'));
