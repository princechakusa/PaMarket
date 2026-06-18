-- ─────────────────────────────────────────────────────────────
-- Last-seen presence for chat headers.
-- Adds profiles.last_seen; the app updates the user's OWN row on app open,
-- background/close, and periodically while active (throttled). Chat partners
-- read it to show "Last seen …". Honours the existing profiles.privacy
-- (showActivity) setting on the client. Run once in the SQL Editor.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists last_seen timestamptz;

-- Optional: speeds up any future "recently active users" queries.
create index if not exists profiles_last_seen_idx on public.profiles (last_seen);
