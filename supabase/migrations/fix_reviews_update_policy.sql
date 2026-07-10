-- =============================================================
-- FIX: reviews / business_reviews disappearing after refresh
--
-- Root cause: the client upserts ratings with
--   .upsert(..., { onConflict: 'seller_id,reviewer_id' })
-- Because of the UNIQUE(seller_id, reviewer_id) constraint, the SECOND
-- time a user rates the same seller (changing their rating) the upsert
-- resolves to an UPDATE — but these tables had only INSERT + DELETE RLS
-- policies, no UPDATE policy. RLS silently rejected the UPDATE, the app
-- still showed "Thanks for your rating!", and on the next fetch the server
-- (with the old/no row) overwrote local state → the review "vanished".
--
-- Fix: add an owner UPDATE policy to both review tables so a reviewer can
-- change their own review. Safe to re-run.
-- =============================================================

-- ── public.reviews (seller ratings) ─────────────────────────
drop policy if exists "reviews: own update" on public.reviews;
create policy "reviews: own update"
  on public.reviews for update
  using      (auth.uid() = reviewer_id)
  with check (auth.uid() = reviewer_id and auth.uid() <> seller_id);

-- ── public.business_reviews (shop ratings) ──────────────────
-- Guarded in case the table isn't created in this environment yet.
do $$
begin
  if to_regclass('public.business_reviews') is not null then
    execute 'drop policy if exists "business_reviews: own update" on public.business_reviews';
    execute $p$
      create policy "business_reviews: own update"
        on public.business_reviews for update
        using      (auth.uid() = reviewer_id)
        with check (auth.uid() = reviewer_id)
    $p$;
  end if;
end $$;

notify pgrst, 'reload schema';
