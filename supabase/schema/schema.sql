-- ═══════════════════════════════════════════════════════════════
-- Hostly — complete schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor).
-- Safe to re-run; all statements use IF NOT EXISTS / OR REPLACE.
-- ═══════════════════════════════════════════════════════════════

-- shared updated_at trigger function (used by multiple tables)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── 1. profiles ─────────────────────────────────────────────
\i profiles.sql

-- ── 2. listings ─────────────────────────────────────────────
\i listings.sql

-- ── 3. conversations + messages ──────────────────────────────
\i conversations.sql

-- ── 4. applications ─────────────────────────────────────────
\i applications.sql

-- ── 5. reviews ──────────────────────────────────────────────
\i reviews.sql

-- ── 6. notifications ────────────────────────────────────────
\i notifications.sql

-- ═══════════════════════════════════════════════════════════════
-- Realtime: enable postgres_changes for these tables in
-- Supabase Dashboard → Database → Replication:
--   messages, notifications, applications, listings
-- ═══════════════════════════════════════════════════════════════
