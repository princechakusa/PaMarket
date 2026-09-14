-- C2E-6: grants and profile privacy (N-05, N-04 — scoped, evidence-driven).
--
-- N-05: public.profiles_public exposed role/status/privacy/updated_at/
-- language to anon with no WHERE clause and no real consumer. Consumer
-- inspection across apps/mobile found real uses of: id, name, avatar,
-- verified, bio, city, created_at, last_seen (last_seen is a genuine
-- presence feature in app/chat/[id].tsx — kept despite the original audit
-- suggesting its removal, because an actual consumer exists). role/status/
-- privacy/updated_at/language have zero real consumers and are dropped.
-- security_barrier is kept as-is (NOT switched to security_invoker): the
-- base profiles table has no anon SELECT RLS policy at all, so
-- security_invoker would return zero rows to anonymous callers and break
-- anonymous public-profile/listing-seller viewing — a real regression.
-- Narrowing the column list under the existing security_barrier mode is
-- the smallest safe change that preserves current behavior.
-- CREATE OR REPLACE VIEW cannot drop or reorder existing columns in
-- Postgres (only append) — this view removes columns, so it must be
-- dropped and recreated. Confirmed no other view/rule depends on it
-- (pg_depend query, zero dependents) before doing so.
drop view if exists "public"."profiles_public";
create view "public"."profiles_public"
with (security_barrier = true) as
select
  id,
  name,
  avatar,
  verified,
  bio,
  city,
  created_at,
  last_seen,
  null::text as phone  -- unchanged: already a placeholder, one existing
                        -- consumer (business-staff/[id].tsx) already only
                        -- ever received null here.
from public.profiles;

-- This project's ALTER DEFAULT PRIVILEGES grants ALL on new tables/views
-- to anon/authenticated, so the fresh CREATE VIEW above silently picked up
-- INSERT/UPDATE/DELETE/TRUNCATE grants for both roles (anon included) —
-- caught live during verification and corrected here. Explicit revoke-all
-- then grant-select-only, matching this view's actual read-only intent.
revoke all on "public"."profiles_public" from anon, authenticated;
grant select on "public"."profiles_public" to anon, authenticated;

-- N-04: anon has no legitimate path to profiles.mfa_secret/mfa_enabled/
-- two_factor_secret/two_factor_enabled — the only SELECT RLS policy on
-- profiles ("profiles: owner or staff read") is scoped to authenticated
-- only, so anon already gets zero rows; the anon column grants are pure
-- excess with no functional dependency. authenticated's grants on these
-- columns are NOT touched here: two_factor_secret/two_factor_enabled are a
-- live production feature (apps/mobile/app/two-factor-setup.tsx, mirrored
-- from www/js/auth.js) for ordinary users' own 2FA, and mfa_secret/
-- mfa_enabled are read/written by www/admin.html's own legacy admin MFA
-- toggle (out of scope to modify) — revoking authenticated's access would
-- break both live features. The broader issue found during investigation
-- (profiles admin update / profiles: admin update let any is_admin()/
-- is_admin_team() staff member overwrite ANY other user's 2FA/MFA columns
-- with no guard) is NOT fixed here — it needs new trigger logic that
-- must not break the ordinary-user self-service enrollment flow, which is
-- a design decision beyond this stage's grant-cleanup scope. Flagged in
-- the C2E-6 report as a new finding for explicit sign-off.
revoke select, insert, update, references (mfa_secret, mfa_enabled, two_factor_secret, two_factor_enabled)
  on "public"."profiles" from "anon";
