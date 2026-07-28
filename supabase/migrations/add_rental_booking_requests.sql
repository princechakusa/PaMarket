-- Consumer-facing rental booking never existed beyond "contact the owner via
-- chat/call/WhatsApp" — there was no way to actually propose specific rental
-- dates. Extends the existing rental_vehicle_leads table (rather than a new
-- parallel table) with the requested date range and a new lead_source, so
-- it shows up in the fleet owner's existing Leads/Inquiries screen
-- (app/rental-fleet/leads.tsx) with no changes needed there beyond
-- displaying the two new columns.

alter table public.rental_vehicle_leads
  drop constraint if exists rental_vehicle_leads_lead_source_check;
alter table public.rental_vehicle_leads
  add constraint rental_vehicle_leads_lead_source_check
  check (lead_source in (
    'chat','whatsapp_click','call_click',
    'favorite','share','view_detail','booking_request'
  ));

alter table public.rental_vehicle_leads
  add column if not exists requested_start_date date,
  add column if not exists requested_end_date   date;

alter table public.rental_vehicle_leads
  add constraint rental_vehicle_leads_dates_check
  check (requested_end_date is null or requested_start_date is null or requested_end_date >= requested_start_date);

notify pgrst, 'reload schema';
