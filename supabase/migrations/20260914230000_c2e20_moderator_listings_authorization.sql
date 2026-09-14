-- C2E-20: moderator listings/verification authorization alignment.
--
-- Found in Batch 1 (C2E-19-adjacent): React Admin grants moderator
-- `listings.moderate` AND `verifications.manage`, but every one of those
-- server-side paths was is_admin()-only (admin/super_admin), not
-- is_moderator() -- unlike reports/appeals, which C2E-8 already correctly
-- narrowed to is_moderator(). Confirmed live (Batch 1 verification):
-- moderator saw 0 non-active listings and 0 verifications.
--
-- Legacy-Admin inspection: www/admin.html has NO client-side role
-- restriction anywhere (grepped for role-branching logic around
-- listings/verifications -- none exists); every ADMIN_ROLES member sees
-- the identical UI, and the database policy is the only real boundary.
-- This means the legacy system never actually differentiated moderator
-- capability either way -- it offers no evidence FOR granting verification
-- access, and the RLS being admin-only was very likely just never revisited
-- when the moderator role's client permissions were designed, not a
-- deliberate restriction.
--
-- Decision (mixed outcome, evaluated independently per C2E-11 audit's own
-- reasoning about not forcing one rule for convenience):
--
-- LISTINGS -- Outcome A (moderator SHOULD get this). Reasoning:
-- moderator's client permission set (listings.moderate, reports.manage,
-- moderation.manage, reviews.moderate, verifications.manage) is a
-- coherent "trust & safety operations" role, and 3 of those 5 domains
-- (reports, moderation appeals, reviews-adjacent) are ALREADY correctly
-- wired to is_moderator() -- listings.moderate is the clear odd-one-out,
-- not a deliberately narrower permission. Routine listing moderation
-- (flag/hold/remove low-stakes marketplace content) is exactly the kind
-- of triage work this role exists for.
--
-- INDIVIDUAL + BUSINESS VERIFICATIONS -- Outcome B (moderator should NOT
-- get this; client permission is corrected instead). Reasoning: KYC/
-- business-verification approval is a fundamentally different, higher-
-- stakes decision than content moderation -- approving a fake business
-- registration or falsified national ID enables downstream fraud at a
-- scale a single flagged listing does not. This is treated as an
-- admin-tier compliance decision, matching the already-established
-- pattern that AAL2-gated/high-impact mutations (paid ads, order
-- overrides, wallet adjustments) all stayed admin-tier-or-above
-- throughout this project's prior security stages, not moderator-tier.
--
-- Reuses is_moderator() exactly as designed (admin/super_admin/moderator)
-- -- no new helper. support/finance remain excluded from both listings
-- and verifications, unchanged.

drop policy if exists "listings: public read active" on "public"."listings";
create policy "listings: public read active" on "public"."listings"
  for select
  using (
    (status = 'active' and expires_at > now() and private.listing_principals_are_active(seller_id, business_id))
    or (auth.uid() = seller_id)
    or public.is_moderator()
  );

drop policy if exists "listings: admin update" on "public"."listings";
create policy "listings: admin update" on "public"."listings"
  for update
  using (public.is_moderator())
  with check (public.is_moderator());

-- Deliberately unchanged: "listings: own delete" stays is_admin()-only
-- (DELETE is a more destructive, separate operation from the status-change
-- "moderate" actions actually exposed in the Batch 1 UI, and was never
-- part of the listings.moderate client permission's intended scope).
-- Deliberately unchanged: verifications/business_verifications RLS stays
-- is_admin()-only per the Outcome B decision above.
