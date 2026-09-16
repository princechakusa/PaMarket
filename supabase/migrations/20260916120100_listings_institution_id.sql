-- ============================================================
-- PaMarket Institutions — Phase 1 Database Foundation (part 2).
-- Adds a single nullable institution_id FK to the existing public.listings
-- table, mirroring business_id's addition in
-- business_catalog_and_followers.sql exactly. Purely additive: existing
-- listings remain valid (column defaults to NULL), existing listing RLS,
-- ownership, status rules, categories and queries are untouched -- this
-- migration adds one column and one index, nothing else.
-- Safe to run more than once.
-- ============================================================

alter table public.listings
  add column if not exists institution_id uuid references public.institutions(id) on delete set null;

create index if not exists listings_institution_id_idx on public.listings (institution_id);

comment on column public.listings.institution_id is
  'Optional tag linking a listing to an institution (public.institutions). Mirrors business_id -- a listing stays one row whether or not it is tagged. Set only via the institution-context Post Ad entry point (not a free picker in the generic form) at the application layer; enforced at the database layer by this FK alone (invalid/nonexistent institution ids are rejected by Postgres regardless of client behaviour). Set to NULL automatically if the referenced institution is ever deleted -- the listing itself is never affected.';
