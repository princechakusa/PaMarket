-- Fix: rental_vehicle_leads got a new row every time a customer re-opened
-- chat / re-clicked WhatsApp / re-called for the same vehicle, so the same
-- buyer showed up multiple times in "Recent Inquiries" on the business
-- dashboard. One lead per (listing, user) is enough — repeat contact should
-- just refresh lead_source/status, not fork a new row.
-- Run in Supabase SQL Editor.

-- Step 1: merge status into the earliest row per (listing, user) pair, so a
-- later 'contacted'/'converted' recorded on a duplicate isn't lost.
with best_status as (
  select listing_id, user_id,
         case
           when bool_or(status = 'converted') then 'converted'
           when bool_or(status = 'contacted') then 'contacted'
           when bool_or(status = 'lost')      then 'lost'
           else 'new'
         end as status
  from public.rental_vehicle_leads
  where user_id is not null
  group by listing_id, user_id
),
earliest as (
  select distinct on (listing_id, user_id) id, listing_id, user_id
  from public.rental_vehicle_leads
  where user_id is not null
  order by listing_id, user_id, created_at asc
)
update public.rental_vehicle_leads l
set status = b.status
from earliest e, best_status b
where l.id = e.id
  and e.listing_id = b.listing_id and e.user_id = b.user_id;

-- Step 2: drop every duplicate row, keeping only the earliest per pair.
with ranked as (
  select id, listing_id, user_id,
         row_number() over (
           partition by listing_id, user_id
           order by created_at asc
         ) as rn
  from public.rental_vehicle_leads
  where user_id is not null
)
delete from public.rental_vehicle_leads l
using ranked r
where l.id = r.id and r.rn > 1;

-- Step 3: enforce one lead per (listing, user) going forward.
create unique index if not exists rl_listing_user_unique
  on public.rental_vehicle_leads (listing_id, user_id)
  where user_id is not null;
