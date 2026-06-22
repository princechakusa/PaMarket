-- ─────────────────────────────────────────────────────────────
-- Push notification infrastructure
-- Run in Supabase SQL editor (Dashboard → SQL Editor)
-- ─────────────────────────────────────────────────────────────

SET search_path = public;

-- 1. Add push_token and province to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token text,
  ADD COLUMN IF NOT EXISTS province   text;

-- Index for fast province-targeted notifications
CREATE INDEX IF NOT EXISTS profiles_province_idx ON public.profiles (province);

-- 2. scheduled_notifications table
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target        text NOT NULL DEFAULT 'all',
  title         text NOT NULL,
  body          text NOT NULL,
  type          text NOT NULL DEFAULT 'info',
  deep_link     text,
  image_url     text,
  provinces     text[],
  scheduled_for timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled')),
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sched_notif_status_time_idx
  ON public.scheduled_notifications (status, scheduled_for)
  WHERE status = 'pending';

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Only service-role (Edge Function) can read/write scheduled notifications
CREATE POLICY "sched_notif_admin_only"
  ON public.scheduled_notifications
  FOR ALL
  USING (false)    -- blocks all client access
  WITH CHECK (false);
