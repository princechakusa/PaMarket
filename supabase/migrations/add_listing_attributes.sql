-- Category-specific listing attributes (Overview spec table, quick facts,
-- amenities). Stored as a single JSON object so any category's fields fit
-- without schema churn. Run in Supabase SQL Editor. Safe to re-run.

alter table public.listings
  add column if not exists attributes jsonb not null default '{}'::jsonb;
