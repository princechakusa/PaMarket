-- ─────────────────────────────────────────────────────────────
-- FEED & MESSAGING INDEXES — 2026-06
-- Covers every high-frequency query issued by the frontend.
-- All statements use IF NOT EXISTS and are safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- ── pg_trgm — needed for LIKE '%…%' (leading wildcard) ───────
-- syncConversations Phase 2 does:
--   messages WHERE conversation_id LIKE '%uidSuffix%'
-- A B-tree index cannot serve a leading-wildcard LIKE; pg_trgm can.
-- pg_trgm is bundled with Supabase and enabled by default in the
-- Supabase extensions schema; IF NOT EXISTS makes this a no-op if
-- it is already enabled.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ── messages ─────────────────────────────────────────────────
-- (1) Per-conversation chronological load — runs in PARALLEL for every
--     conversation on each syncConversations call (Phase 4).
--     Query: eq('conversation_id', id).order('created_at', ASC).limit(200)
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at ASC);

-- (2) Sent-message discovery — Phase 2 of syncConversations.
--     Query: eq('sender_id', u.id).order('created_at', DESC).limit(300)
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
  ON public.messages (sender_id, created_at DESC);

-- (3) LIKE pattern scans — covers BOTH Phase 2 patterns:
--     '%uidSuffix%'  (leading wildcard  — only trigram can serve this)
--     'biz_XXX_%'    (fixed prefix      — trigram or text_pattern_ops)
--     One GIN trigram index covers both cases.
CREATE INDEX IF NOT EXISTS idx_messages_conv_id_trgm
  ON public.messages USING GIN (conversation_id gin_trgm_ops);

-- (4) Read-receipt UPDATE: eq('conversation_id',…).eq('sender_id',…).eq('read',false)
--     Composite covering index; filtered on read=false keeps it small.
CREATE INDEX IF NOT EXISTS idx_messages_conv_sender_unread
  ON public.messages (conversation_id, sender_id) WHERE read = false;

-- ── conversations ─────────────────────────────────────────────
-- Array containment query: .contains('members', [u.id])
-- PostgREST translates this to members @> ARRAY[u.id] which
-- requires a GIN index to avoid a sequential scan.
CREATE INDEX IF NOT EXISTS idx_conversations_members
  ON public.conversations USING GIN (members);

-- ── businesses ────────────────────────────────────────────────
-- Public feed: eq('status','active').order('created_at',DESC).limit(300)
CREATE INDEX IF NOT EXISTS idx_businesses_status_created
  ON public.businesses (status, created_at DESC);

-- Owner lookup: eq('owner_user_id', u.id) in business-onboarding + my businesses
CREATE INDEX IF NOT EXISTS idx_businesses_owner
  ON public.businesses (owner_user_id);

-- ── notifications ─────────────────────────────────────────────
-- Per-user notification list: eq('user_id', u.id).order('created_at',DESC).limit(100)
-- Also covers the realtime channel filter: user_id=eq.{uid}
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- ── paid_ads ──────────────────────────────────────────────────
-- Active ads only are fetched; a partial index keeps it tiny.
-- Query: eq('active', true)
CREATE INDEX IF NOT EXISTS idx_paid_ads_active
  ON public.paid_ads (id) WHERE active = true;
