-- C2E-13: close the two_factor_secret cross-user read exposure left open by
-- C2E-8 (explicitly deferred there because it required mobile-app changes,
-- which that stage was barred from making).
--
-- Confirmed live before this change: `authenticated` had a plain
-- COLUMN-level SELECT grant on two_factor_secret (54 column-level SELECT
-- grants total on profiles, no table-level SELECT grant remains — C2E-8's
-- mfa_secret fix already converted the old broad table grant into an
-- explicit per-column list). Because it's already column-scoped, this fix
-- is a straightforward REVOKE — it does NOT need C2E-8's
-- revoke-all-then-regrant-list dance (that was only required because
-- mfa_secret's grant was still table-wide at the time).
--
-- Inspection this stage found TWO legitimate owner-scoped consumers of this
-- column, not one: apps/mobile (lib/auth.tsx, app/two-factor-setup.tsx) and
-- the live marketplace website (www/js/auth.js, www/js/security_pages.js).
-- Both are updated in this same change to call the new RPC below instead of
-- selecting the column directly, so no legitimate flow breaks.
--
-- Mirrors get_my_mfa_secret()'s exact, already-proven pattern: owner-scoped
-- via auth.uid(), SECURITY DEFINER, no parameters (so there is no argument
-- through which another user's id could be supplied), not grantable to
-- anon (confirmed live: get_my_mfa_secret() has no anon/PUBLIC EXECUTE
-- grant either — explicit anon revoke here for defense in depth).

create or replace function "public"."get_my_two_factor_secret"()
returns text
language sql stable security definer
set search_path to 'public'
as $$
  select two_factor_secret from public.profiles where id = auth.uid();
$$;

revoke all on function "public"."get_my_two_factor_secret"() from public;
grant execute on function "public"."get_my_two_factor_secret"() to "authenticated";
revoke execute on function "public"."get_my_two_factor_secret"() from "anon";

revoke select (two_factor_secret) on "public"."profiles" from "authenticated";

notify pgrst, 'reload schema';
