-- Testing-only data change: enable ordering (is_orderable = true) for every
-- listing that is eligible to be sold through a verified, active storefront.
-- No mobile/website/admin UI sets this flag yet (see
-- 20260910120000_shop_orders_foundation.sql) -- this is a manual, one-time
-- enablement so shop cart/checkout can be tested end-to-end.
--
-- Eligible = business_id set AND listing active AND price > 0 AND the owning
-- business is status='active' AND verification_level >= 2, excluding
-- property/vehicles/jobs categories (rentals live in their own tables, never
-- in `listings`, so no separate rental exclusion is needed here).
--
-- Verified before writing this migration: 75 total listings, 17 linked to a
-- business, 12 eligible under the above rule (all belonging to the single
-- verified-level-3 active business "KudzieFinds✨"), 0 listings already had
-- is_orderable = true. The other 5 business-linked listings are excluded
-- solely because their businesses have verification_level = 0.
update public.listings l
set is_orderable = true
from public.businesses b
where b.id = l.business_id
  and l.status = 'active'
  and l.price is not null
  and l.price > 0
  and b.status = 'active'
  and b.verification_level >= 2
  and l.category not in ('property', 'vehicles', 'jobs')
  and l.is_orderable is distinct from true;
