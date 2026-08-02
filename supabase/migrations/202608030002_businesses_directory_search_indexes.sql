-- Shop directory (app/shops/index.tsx) filters businesses by status (+
-- optional category), sorts by verification_level desc then name asc, and
-- does a leading-wildcard ILIKE name search (also used by
-- app/(tabs)/search.tsx's shop-match lookup). Neither was indexed, so both
-- were sequential-scanning the full businesses table on every request —
-- fine at today's row count, not at 100k+ users/businesses.

create extension if not exists pg_trgm;

create index if not exists idx_businesses_status_verif_name
  on public.businesses (status, verification_level desc, name);

create index if not exists idx_businesses_name_trgm
  on public.businesses using gin (name gin_trgm_ops);
