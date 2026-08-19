-- ============================================================
-- 202608190008_prevent_review_delete_repost.sql
--
-- FIX (Audit 3/5 P1, verified live 2026-08-19): both `reviews` (seller
-- reviews) and `rental_reviews` allow the reviewer to hard-delete their own
-- review row. Combined with the existing UNIQUE(target, reviewer)
-- constraints, a reviewer can cycle delete -> repost -> delete -> repost
-- indefinitely, and each insert unconditionally fires a "New Review"
-- notification to the target (trg_notify_review_recipient on reviews;
-- confirmed live) — real, unlimited rating-change/notification-spam
-- potential. `business_reviews` already has no self-delete policy at all
-- (confirmed live) — not affected, no change needed there.
--
-- FIX: reviewers can no longer delete their own review — self-delete
-- policies are replaced with admin-only. This forces "change my review"
-- through UPDATE instead, which is already fully supported for `reviews`
-- (existing "reviews: own update" policy) and doesn't re-fire the insert
-- notification trigger (AFTER INSERT only), so editing a rating/body
-- produces no repeat notification and no way to reset the unique
-- constraint.
--
-- `rental_reviews`, unlike `reviews`, had NO update policy at all — the
-- self-delete policy being removed was, in practice, the reviewer's ONLY
-- way to change anything. To avoid a real regression ("editing is
-- acceptable, do not break it"), this migration also adds an own-update
-- policy for rental_reviews. Its schema already has a deleted_at column
-- respected by the existing public-read policy
-- ("status = 'published' and deleted_at is null") — the table was clearly
-- designed for soft-delete already; reviewers can now retract their review
-- by updating deleted_at themselves, which still leaves the row (and the
-- unique constraint) in place, so a retracted review can be edited/
-- restored but never re-inserted as a fresh row.
--
-- Net result for both tables: one reviewer, one logical review row per
-- target, forever. Editing remains fully available. Rating manipulation
-- and notification-spam via delete+repost are both closed.
-- ============================================================

-- reviews: remove self-delete, keep admin delete.
drop policy if exists "reviews: own or admin delete" on public.reviews;
create policy "reviews: admin delete"
  on public.reviews
  for delete
  to authenticated
  using (public.is_admin());

-- rental_reviews: remove self-delete (admin delete already covered by the
-- existing "rental_reviews: admin all" policy, cmd=ALL), add own-update so
-- editing/retracting remains possible.
drop policy if exists "rental_reviews: own delete" on public.rental_reviews;
create policy "rental_reviews: own update"
  on public.rental_reviews
  for update
  to authenticated
  using (auth.uid() = reviewer_id)
  with check (auth.uid() = reviewer_id);

-- Verification (run after applying):
--   select policyname, cmd from pg_policies where tablename='reviews' and cmd='DELETE';
--   select policyname, cmd from pg_policies where tablename='rental_reviews' and cmd in ('DELETE','UPDATE');
-- ============================================================
