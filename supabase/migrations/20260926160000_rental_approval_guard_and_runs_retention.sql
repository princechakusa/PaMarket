-- ============================================================
-- 1. A vehicle whose rental company was deleted can never appear publicly
--    (rental_search_listings requires rental_companies.deleted_at is null),
--    so approving it only creates an "approved but invisible" listing.
--    Refuse that approval at the database, whoever attempts it.
-- 2. Automation run history (job_runs): keep 7 days instead of 30.
-- ============================================================

create or replace function public.guard_rental_listing_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.admin_status = 'approved'
     and new.admin_status is distinct from old.admin_status
     and exists (
       select 1 from public.rental_companies rc
       where rc.id = new.company_id and rc.deleted_at is not null
     ) then
    raise exception 'rental company is deleted; restore it before approving its vehicles'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_rental_listing_approval on public.rental_vehicle_listings;
create trigger guard_rental_listing_approval
  before update of admin_status on public.rental_vehicle_listings
  for each row execute function public.guard_rental_listing_approval();

delete from public.job_runs where created_at < now() - interval '7 days';

select cron.schedule(
  'pamarket-log-retention-daily',
  '30 3 * * *',
  $cron$
    delete from cron.job_run_details where start_time < now() - interval '7 days';
    delete from public.job_runs where created_at < now() - interval '7 days';
  $cron$
);
