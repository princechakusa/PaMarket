-- ════════════════════════════════════════════════════════════════════════
-- AMOS — Module 18: approving a draft actually schedules it
--
-- Run manually in the Supabase SQL Editor.
--
-- Bug found while wiring the video pipeline (2026-09-28): amos-publish-
-- dispatcher and claim_due_amos_schedule are real and working, but
-- nothing in the shipped system ever INSERTs a row into amos_schedule.
-- decideDraft() (admin/src/services/amos/query.ts) only flips
-- amos_content_drafts.status to 'approved' — there was no path from
-- "admin approved this" to "the dispatcher will actually pick it up".
-- Every approved draft sat in amos_content_drafts forever with no way
-- to ever get published automatically. This affects every content type
-- AMOS produces (video, text, images), not just video.
--
-- Fix: a trigger that fires the moment a draft's status transitions
-- into 'approved', inserting one amos_schedule row for it, due
-- immediately (scheduled_for = now()) — approving IS the publish-timing
-- decision an admin makes by choosing when to click Approve, matching
-- how every post has been published manually so far. amos-publish-
-- dispatcher (cron or manual run) picks it up from there exactly like
-- any other schedule row.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION amos_schedule_on_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO amos_schedule (draft_id, scheduled_for, status, platform)
    VALUES (NEW.id, now(), 'pending', NEW.channel);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS amos_schedule_on_approve_trg ON amos_content_drafts;
CREATE TRIGGER amos_schedule_on_approve_trg
  AFTER UPDATE ON amos_content_drafts
  FOR EACH ROW
  EXECUTE FUNCTION amos_schedule_on_approve();

-- Verify:
--   select trigger_name from information_schema.triggers
--   where event_object_table = 'amos_content_drafts';
--
-- Should now show amos_schedule_on_approve_trg. Approve any pending
-- draft in the admin panel afterward and confirm a matching row appears
-- in amos_schedule with status='pending' — amos-publish-dispatcher will
-- pick it up on its next run (or trigger a manual run from the AMOS
-- Publishing Queue).
