-- ============================================================
-- 202608190010_scheduled_notifications_retention.sql
--
-- Audit 4/5 item 1 (verified live 2026-08-19): scheduled_notifications has
-- no retention of any kind — confirmed live, 148 rows, all status='sent',
-- oldest 2026-07-19 (31 days), no cron references this table for cleanup
-- anywhere. No plain index on created_at exists either — both existing
-- indexes (sched_notif_status_time_idx, scheduled_notifications_due_idx)
-- are partial, WHERE status='pending' only, so they don't support a
-- cutoff scan over 'sent'/'failed'/'cancelled' rows.
--
-- A real UNIQUE idempotency_key index exists on this table and is used by
-- 2 of the automation-runner sub-jobs for dedup — a `sent` row is not
-- purely historical, it can also be acting as a dedup record. Per the
-- conservative recommendation already made in a prior audit pass: use a
-- 90-day window (comfortably past any realistic idempotency-relevant
-- recurrence), and only for terminal statuses (sent/failed/cancelled) —
-- 'pending'/'processing' rows are NEVER touched regardless of age, since
-- those still need to be processed.
--
-- Same batched pattern as job_purge_notifications() (5,000/batch, 20
-- batches max = 100,000 rows/run) added to the existing every-minute
-- automation-runner tick would be overkill for a weekly-cadence cleanup —
-- instead this runs on its own weekly cron entry, mirroring
-- job_purge_notifications' own schedule (Sunday 03:00), reusing the
-- existing cron infrastructure (pg_cron, log_job_run bookkeeping) rather
-- than inventing a new mechanism.
-- ============================================================

create index if not exists idx_scheduled_notifications_status_created
  on public.scheduled_notifications (status, created_at);

create or replace function public.job_purge_scheduled_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  n int;
  total int := 0;
  cutoff timestamptz;
  batch_size constant int := 5000;
  max_batches constant int := 20; -- hard cap: at most 100,000 rows purged per run
  i int := 0;
begin
  cutoff := now() - interval '90 days';

  loop
    delete from scheduled_notifications
    where id in (
      select id from scheduled_notifications
      where status in ('sent', 'failed', 'cancelled')
        and created_at < cutoff
      order by created_at
      limit batch_size
    );
    get diagnostics n = row_count;
    total := total + n;
    i := i + 1;
    exit when n = 0 or i >= max_batches;
  end loop;

  perform log_job_run('purge_scheduled_notifications', true, 'weekly', total);
exception when others then
  perform log_job_run('purge_scheduled_notifications', false, sqlerrm, null);
end;
$function$;

select cron.schedule(
  'purge-scheduled-notifications',
  '30 3 * * 0', -- Sunday 03:30, right after job_purge_notifications (03:00)
  $$select public.job_purge_scheduled_notifications()$$
);

-- Verification (run after applying):
--   select jobid, schedule, active from cron.job where jobname = 'purge-scheduled-notifications';
--   select indexname from pg_indexes where tablename='scheduled_notifications' and indexname='idx_scheduled_notifications_status_created';
--   select prosrc from pg_proc where proname = 'job_purge_scheduled_notifications';
-- ============================================================
