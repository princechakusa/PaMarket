-- ============================================================
-- 202608190002_batch_notification_purge.sql
--
-- FIX (production audit 2/5, verified live 2026-08-19): job_purge_notifications()
-- is confirmed LIVE (cron.job id 7, "0 3 * * 0", active) and does a single
-- unbounded `DELETE FROM notifications WHERE created_at < cutoff` with no
-- LIMIT/batching. At today's actual size (250 rows total, confirmed live)
-- this is harmless, but the pattern is unsafe at scale — a single
-- unbounded delete on a table fed by ~7 different triggers can eventually
-- hold a long lock / generate a large WAL burst in one shot. There is also
-- no plain index on notifications(created_at) — both existing indexes lead
-- with user_id — so the cutoff scan is a sequential scan regardless of
-- table size.
--
-- Also observed live: cron.job id 9 (a separate weekly maintenance job)
-- contains its OWN identical `DELETE FROM notifications WHERE created_at <
-- (...30 days...)` inline, alongside unrelated cleanup (job_runs,
-- error_logs, search_logs, admin_login_attempts, cron.job_run_details).
-- That makes job_purge_notifications() currently redundant in practice
-- (job 9 runs first, at 00:00 Sunday; job 7 runs at 03:00 Sunday and finds
-- nothing left). This migration does NOT touch job 9 — it bundles multiple
-- unrelated tables' cleanup in one inline command and editing a live
-- cron.job's command string is a separate, higher-blast-radius change than
-- what was authorized in this pass. Flagged in the audit report as a
-- follow-up, not fixed here.
--
-- FIX: replace the single unbounded DELETE with a bounded loop (batch size
-- 5,000 rows per statement, hard cap 20 batches = 100,000 rows per
-- invocation) and add a supporting index on notifications(created_at) so
-- each batch's cutoff scan is index-backed instead of a sequential scan.
-- Same retention semantics (30-day cutoff, identical formula), same
-- function signature/security/search_path, same log_job_run bookkeeping
-- (now logs the total across all batches). Safe to run repeatedly
-- (idempotent — a partial run just leaves fewer old rows for next week).
-- No partitioning introduced, per the smallest-safe-fix instruction — this
-- table is nowhere near the scale where that would be warranted.
-- ============================================================

create index if not exists idx_notifications_created_at
  on public.notifications (created_at);

create or replace function public.job_purge_notifications()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n int;
  total int := 0;
  cutoff bigint;
  batch_size constant int := 5000;
  max_batches constant int := 20; -- hard cap: at most 100,000 rows purged per run
  i int := 0;
begin
  cutoff := (extract(epoch from now())::bigint * 1000) - (30::bigint * 86400000);

  loop
    delete from notifications
    where id in (
      select id from notifications
      where created_at < cutoff
      order by created_at
      limit batch_size
    );
    get diagnostics n = row_count;
    total := total + n;
    i := i + 1;
    exit when n = 0 or i >= max_batches;
  end loop;

  perform log_job_run('purge_notifications', true, 'weekly', total);
exception when others then
  perform log_job_run('purge_notifications', false, sqlerrm, null);
end;
$function$;

-- Verification (run after applying):
--   -- 1. Confirm the function body is batched:
--   select prosrc from pg_proc where proname = 'job_purge_notifications';
--   -- 2. Confirm the new index exists:
--   select indexname from pg_indexes where tablename = 'notifications' and indexname = 'idx_notifications_created_at';
--   -- 3. Prove a batch cannot touch newer rows: insert one deliberately-old
--   --    test row and one current row, run the function, confirm only the
--   --    old one is gone:
--   --    insert into notifications (id, user_id, title, body, type, created_at)
--   --      values ('purge-test-old', '00000000-0000-0000-0000-000000000000', 't','b','test',
--   --              (extract(epoch from now())::bigint*1000) - 31*86400000);
--   --    insert into notifications (id, user_id, title, body, type, created_at)
--   --      values ('purge-test-new', '00000000-0000-0000-0000-000000000000', 't','b','test',
--   --              extract(epoch from now())::bigint*1000);
--   --    select job_purge_notifications();
--   --    select id from notifications where id in ('purge-test-old','purge-test-new');
--   --    -- expect only 'purge-test-new' to remain
-- ============================================================
