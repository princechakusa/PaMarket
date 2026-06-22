-- ─────────────────────────────────────────────────────────────
-- STABILIZATION MIGRATION — 2026-06
-- Closes schema gaps the frontend depends on but that were never
-- present in production. Run ONCE in the Supabase SQL Editor.
-- Idempotent and safe to re-run (every statement uses IF NOT EXISTS).
--
-- Fixes the following console errors:
--   1. businesses.upsert 400: "Could not find column featured_listing_ids"
--      -> blocks business onboarding, and cascades into the
--         business_subscriptions 403 (the subscription insert RLS check
--         requires the owning business row to already exist, but the
--         business write was failing first).
--   2. profiles select 400: "select=last_seen,privacy"
--      -> breaks last-seen header + My Activity privacy honouring.
-- ─────────────────────────────────────────────────────────────

-- ── businesses.featured_listing_ids ──────────────────────────
-- Up to two listing ids the owner pins as storefront highlights.
alter table public.businesses
  add column if not exists featured_listing_ids uuid[];

-- ── profiles.last_seen ───────────────────────────────────────
-- Written when the user opens the app; read to show "Last seen ...".
alter table public.profiles
  add column if not exists last_seen timestamptz;
create index if not exists profiles_last_seen_idx on public.profiles (last_seen);

-- ── profiles.privacy ─────────────────────────────────────────
-- Per-user privacy toggles (e.g. { "showActivity": true }). Read by
-- the chat header to honour the other user's last-seen visibility.
alter table public.profiles
  add column if not exists privacy jsonb not null default '{}'::jsonb;

-- Force PostgREST to reload its schema cache so the new columns are
-- visible immediately (otherwise the API may keep returning the cache
-- miss for a minute).
notify pgrst, 'reload schema';
