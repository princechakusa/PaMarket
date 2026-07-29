-- CRITICAL FIX: the `authenticated` role was missing the table-level SELECT
-- grant on public.profiles entirely (confirmed via
-- information_schema.role_table_grants — it had INSERT/UPDATE/DELETE but
-- not SELECT). This is a permission error that happens BEFORE row-level
-- security is even evaluated, so it wasn't a policy problem — the existing
-- "profiles: owner or staff read" RLS policy (auth.uid() = id OR
-- is_moderator()) was already correctly scoped and untouched.
--
-- Impact: every authenticated user's own-row read of public.profiles
-- failed silently across the app — apps/mobile queries it directly (not
-- through the profiles_public view) on Account, chat (sender display
-- name), job applications, CV profile, edit-profile, company-verify, and
-- more — and admin.html's login check (`select role,name,mfa_secret ...
-- eq('id', user.id).single()`) failed the same way, showing "Access
-- denied. Admin team only." even for a genuine admin account.
--
-- Likely cause: an earlier security-hardening migration revoked broad
-- privileges on this table before re-granting only some of them, and
-- SELECT was missed. Re-granting it does not reopen the privacy issues
-- those hardening migrations fixed (e.g. fix_profiles_public_email_leak.sql)
-- since those were about an overly-permissive POLICY (using(true)), not
-- this table-level grant — the current policy already restricts reads to
-- the caller's own row or staff, regardless of this grant being present.

grant select on public.profiles to authenticated;

notify pgrst, 'reload schema';
