# Vehicle Rental Marketplace — Phase 2: Database Architecture

## Schema Overview

17 new tables. Zero duplication of existing PaMarket tables.
Existing tables reused: `profiles`, `businesses`, `conversations`, `messages`, `notifications`.

---

## Entity Relationship Map

```
businesses (existing)
    └── rental_companies (1:1, via business_id)
            └── rental_company_profiles (1:1)
            └── rental_vehicle_listings (1:N)
                    ├── rental_vehicle_media      (1:N, ordered photos)
                    ├── rental_vehicle_specs      (1:1, technical specs)
                    ├── rental_vehicle_features   (1:N, amenity tags)
                    ├── rental_vehicle_availability (1:N, blocked ranges)
                    ├── rental_favorites          (N:M via user_id)
                    ├── rental_reports            (1:N)
                    ├── rental_featured_listings  (1:N, time-windowed)
                    └── rental_activity_logs      (1:N, append-only)
            └── rental_reviews          (1:N, per user per company)
            └── rental_promotions       (1:N)

LOOKUP TABLES (admin-managed):
    rental_categories   (SUV, Sedan, Pickup …)
    rental_brands       (Toyota, Honda, Mercedes …)
    rental_locations    (Harare, Bulawayo, Vic Falls …)

AUDIT:
    rental_audit_logs   (append-only, admin-read)
```

---

## Table Inventory

| # | Table | Rows type | Normalisation note |
|---|---|---|---|
| 1 | `rental_categories` | Lookup | Admin-managed, seeded |
| 2 | `rental_brands` | Lookup | Admin-managed, seeded |
| 3 | `rental_locations` | Lookup | City registry, seeded |
| 4 | `rental_companies` | Entity | Extends `businesses` via FK |
| 5 | `rental_company_profiles` | 1:1 extension | Media, bio, service areas |
| 6 | `rental_vehicle_listings` | Core entity | Pricing, terms, status |
| 7 | `rental_vehicle_media` | Child | Ordered photos, one cover |
| 8 | `rental_vehicle_specs` | 1:1 child | Engine, seats, fuel, drive |
| 9 | `rental_vehicle_features` | Child (tags) | One row per feature tag |
| 10 | `rental_vehicle_availability` | Child | Date ranges, reason |
| 11 | `rental_reviews` | Transactional | 1 per user per company |
| 12 | `rental_favorites` | Junction | 1 per user per listing |
| 13 | `rental_reports` | Transactional | 1 per user per listing per reason |
| 14 | `rental_promotions` | Entity | Banners, discounts, seasonal |
| 15 | `rental_featured_listings` | Entity | Time-windowed boost slots |
| 16 | `rental_activity_logs` | Append-only | Views, clicks, chats |
| 17 | `rental_audit_logs` | Append-only | Admin/system actions |

---

## Indexing Strategy

### rental_vehicle_listings (most-queried table)

| Index | Columns | Type | Use case |
|---|---|---|---|
| `rvl_company_status_idx` | `(company_id, status)` partial `deleted_at IS NULL` | B-Tree | Business portal fleet list |
| `rvl_browse_idx` | `(category_id, location_id, is_available, status)` partial active | B-Tree | Primary browse filter |
| `rvl_price_idx` | `(daily_rate)` partial active | B-Tree | Price range slider |
| `rvl_brand_idx` | `(brand_id, status)` partial non-deleted | B-Tree | Brand filter |
| `rvl_admin_status_idx` | `(admin_status, created_at desc)` | B-Tree | Admin moderation queue |
| `rvl_created_desc_idx` | `(created_at desc)` partial active | B-Tree | Default "newest" sort |
| `rvl_fts_idx` | `to_tsvector(model + description)` | GIN | Full-text search |

### rental_vehicle_specs (join for filter queries)

| Index | Columns | Use case |
|---|---|---|
| `rvs_transmission_fuel_idx` | `(transmission, fuel_type)` | Filter combos |
| `rvs_drive_idx` | `(drive_type)` | 4WD filter |
| `rvs_seats_idx` | `(seats)` | Seat count filter |

### rental_vehicle_media

| Index | Columns | Use case |
|---|---|---|
| `rvm_listing_order_idx` | `(listing_id, sort_order asc)` | Ordered photo fetch |
| `rvm_cover_unique_idx` | `(listing_id)` partial `is_cover=true` — UNIQUE | Enforce single cover |

### rental_companies

| Index | Columns | Use case |
|---|---|---|
| `rental_companies_status_idx` | `(status)` partial non-deleted | Admin status filter |
| `rental_companies_active_idx` | `(id)` partial active+non-deleted | Fast active lookup |

### rental_company_profiles

| Index | Columns | Use case |
|---|---|---|
| `rental_profiles_locations_gin` | `service_location_ids` GIN | Location-based company search |

### rental_reviews

| Index | Columns | Use case |
|---|---|---|
| `rr_company_rating_idx` | `(company_id, rating, created_at desc)` partial published | Company reviews sorted by date |

### rental_favorites

| Index | Columns | Use case |
|---|---|---|
| `rfav_user_idx` | `(user_id, created_at desc)` | User's saved rentals list |
| `rfav_listing_idx` | `(listing_id)` | Save count updates |

### rental_reports

| Index | Columns | Use case |
|---|---|---|
| `rrep_status_idx` | `(status, created_at desc)` | Admin report queue |
| `rrep_open_queue_idx` | `(created_at desc)` partial open | Fast open-only queue |

### rental_activity_logs

| Index | Columns | Use case |
|---|---|---|
| `ral_listing_event_date_idx` | `(listing_id, event_type, created_at desc)` | Per-listing analytics |
| `ral_company_date_idx` | `(company_id, created_at desc)` | Company-level rollup |

### rental_featured_listings

| Index | Columns | Use case |
|---|---|---|
| `rfl_active_priority_idx` | `(priority desc, starts_at)` partial active | Featured carousel order |
| `rfl_ends_at_idx` | `(ends_at)` | Expiry cron cleanup |

---

## Normalisation Notes (3NF)

Every non-key attribute depends only on its primary key, not on other non-key columns.

- **Specs extracted** from listings → no repeated engine/fuel/seats columns per listing update
- **Media extracted** → reordering photos doesn't touch the listing row (no write amplification)
- **Features as rows** → amenity additions never alter the listing schema
- **Lookup tables** for categories, brands, locations → no city/brand string drift across rows
- **Denormalised counters** (`fleet_count`, `avg_rating`, `review_count`, `save_count`) maintained by triggers → avoids `COUNT(*)` on hot read paths. Accepted 3NF deviation; documented.

---

## Soft Delete Strategy

Tables with `deleted_at timestamptz`:
- `rental_companies` — suspending a company hides it; data retained for audit
- `rental_vehicle_listings` — archive/removal preserves history
- `rental_reviews` — admin can remove reviews without losing the row

All public-read RLS policies filter `deleted_at IS NULL`.
Partial indexes exclude deleted rows to keep index size minimal.

---

## Row Level Security Summary

| Tier | Can do |
|---|---|
| Anonymous | SELECT on categories, brands, locations, active listings, active companies, media, specs, features, availability, promotions, featured |
| Authenticated | Above + INSERT own favorites/reports/reviews, INSERT activity logs, read own favorites |
| Business owner | Above + INSERT/UPDATE/DELETE own listings, media, specs, features, availability, promotions |
| Admin (`role='admin'`) | Full access to all tables including audit logs, reports, moderation fields |

---

## RPCs (server-side functions)

| Function | Purpose |
|---|---|
| `rental_increment_view(listing_id)` | Atomic view counter + activity log insert |
| `rental_search_listings(filters…)` | Filtered browse query returning listing cards with joined company + cover |
| `refresh_company_rating()` | Trigger: updates `avg_rating` + `review_count` after review write |
| `refresh_company_fleet_count()` | Trigger: updates `fleet_count` after listing status change |
| `refresh_listing_save_count()` | Trigger: updates `save_count` after favorite insert/delete |

---

## Migration File

`supabase/migrations/rental_marketplace_schema.sql`

Run in Supabase SQL Editor. Safe to re-run (all `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

---

## What is NOT in this schema

| Excluded | Reason |
|---|---|
| Booking / reservation table | No booking system per spec |
| Payment / invoice table | No payment system per spec |
| `conversations` / `messages` | Reuses existing tables |
| `notifications` | Reuses existing table |
| `business_staff` | Reuses existing `business_staff` table |
| `business_verifications` | Reuses existing verification flow |
