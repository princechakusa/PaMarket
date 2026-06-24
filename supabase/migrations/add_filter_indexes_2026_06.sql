-- ─────────────────────────────────────────────────────────────
-- FILTER PERFORMANCE INDEXES — 2026-06
-- Covers every server-side predicate emitted by the filter engine
-- in categories.js and browse.js. All statements use IF NOT EXISTS
-- and are safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- ── Composite: the primary category-page query ────────────────
-- Query: status=active AND category=X ORDER BY created_at DESC
-- The partial index on active listings only keeps the index small.
CREATE INDEX IF NOT EXISTS idx_listings_cat_created
  ON public.listings (category, created_at DESC)
  WHERE status = 'active';

-- ── Composite: price range + category (for price sorts / filters) ─
CREATE INDEX IF NOT EXISTS idx_listings_cat_price
  ON public.listings (category, price)
  WHERE status = 'active';

-- ── City ILIKE — leading-wildcard requires pg_trgm GIN index ──
-- Query: city ILIKE '%harare%'  OR  province ILIKE '%harare%'
-- pg_trgm is bundled with Supabase; CREATE EXTENSION is idempotent.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_listings_city_trgm
  ON public.listings USING GIN (city gin_trgm_ops)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_province_trgm
  ON public.listings USING GIN (province gin_trgm_ops)
  WHERE status = 'active';

-- ── JSONB attributes — GIN for containment + key existence ────
-- Used by server-side .contains() calls and future JSONB predicates.
CREATE INDEX IF NOT EXISTS idx_listings_attributes_gin
  ON public.listings USING GIN (attributes)
  WHERE status = 'active';

-- ── Status-only index (used by admin fetch and single-listing lookup) ─
-- Already exists as listings_status_idx in schema.sql; kept for
-- completeness and safety.
CREATE INDEX IF NOT EXISTS idx_listings_status_created
  ON public.listings (status, created_at DESC);
