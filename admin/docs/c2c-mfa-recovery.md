# Stage C2C-1 — MFA recovery procedure (sole super_admin)

Applies only to native Supabase TOTP factors enrolled through
`/settings/security/mfa/enroll`. There is exactly one `super_admin` account
today (`e79039a4-2216-4526-81e1-c8c25e688834`); this procedure exists so a
lost authenticator cannot become a permanent lockout. It is an **operator
procedure performed outside the browser**, not a feature of the admin app —
Stage C2C-1 deliberately ships no in-app bypass, recovery code, master OTP,
or "remove my own factor without aal2" shortcut.

## 1. Identify a lost authenticator factor

- The operator (the account holder, or whoever they've asked to help)
  confirms they can sign in with the correct email/password but cannot
  produce a valid 6-digit code at `/mfa/challenge` (new phone, deleted
  authenticator app, factor reset, etc.).
- Before touching anything, confirm this is really a lost factor and not a
  clock-skew or typo problem: TOTP codes are time-based — check the
  device's clock is correct and retry once with the next code.

## 2. Verify the correct user ID before removal

**Never remove a factor by email or by guessing.** In the Supabase
dashboard (Authentication → Users), or via a read-only SQL query against
the linked project, confirm:

```sql
select id, email, role from public.profiles where email = '<claimed email>';
```

- Confirm the returned `id` matches the account the operator is claiming
  to be, and that `role` is `super_admin` (or another admin-team role, if
  this procedure is later extended).
- Cross-check the `id` against `auth.users` (dashboard: Authentication →
  Users → search by email) so the factor removed in step 3 belongs to the
  same user, not a different account with a similar email.

## 3. Remove the lost factor through Supabase administration

This is done **outside the admin app**, using access the browser never has:

- **Preferred:** Supabase Dashboard → Authentication → Users → the
  confirmed user → MFA factors → remove the specific factor.
- **Alternative (scripted, service-role only, never from a browser):** the
  [Admin MFA API](https://supabase.com/docs/reference/javascript/auth-admin-mfa-listfactors)
  (`supabase.auth.admin.mfa.listFactors({ userId })` /
  `deleteFactor({ id, userId })`) run from a trusted server context using
  the **service_role key** — never the publishable/anon key, and never
  from the admin React app.
- Do **not** attempt this via the C2B `profiles` table or any RPC — MFA
  factors live in Supabase Auth's own schema (`auth.mfa_factors`), not in
  `public.profiles`, and are outside the scope of this admin app entirely.

## 4. Force fresh authentication afterward

- After the factor is removed, the account's assurance level drops back to
  a state with no verified factor, so `needsMfaChallenge()` (see
  `AuthProvider.tsx`) no longer routes it to `/mfa/challenge` — the
  operator can sign in normally and reach `/settings/security/mfa/enroll`
  to enrol a new authenticator immediately.
- As a precaution, also revoke existing sessions for that user (Dashboard →
  Authentication → Users → the user → "Revoke sessions", or
  `supabase.auth.admin.signOut(userId, 'global')` from the same trusted
  server context) so a stolen refresh token from the lost device cannot
  keep riding the old session.
- Have the operator sign in again with their password and immediately
  enrol a new authenticator before doing anything else.

## 5. Evidence to record

Record, in whatever incident/change log this project uses outside the
database (this stage does not create the server-owned evidence table —
that is Stage C2D):

- Date/time of the request and of the removal.
- Who requested the recovery and who performed it (names, not
  credentials).
- The confirmed `user_id` (UUID) and role from step 2.
- Which factor was removed (its Supabase factor ID and friendly name —
  never its secret) and the method used (dashboard vs. admin API).
- Confirmation that sessions were revoked (step 4).
- Confirmation that a new factor was enrolled afterward, and by whom.

## 6. Values that must never be recorded, anywhere

- OTP / TOTP codes (past or current).
- QR code image content or the authenticator URI it encodes.
- The TOTP secret (the base32 string shown once at enrollment).
- Access tokens or refresh tokens.
- The account's password.
- Any Supabase service_role key or personal access token used to perform
  the removal.

If any of the above was pasted into a ticket, chat, or log by mistake,
treat it as a leaked credential: rotate what can be rotated (force a new
TOTP enrollment; if a password or token leaked, rotate that too) and note
the exposure in the incident record — do not just delete the message and
move on.

## What this stage does not provide (by design)

- No recovery codes, backup codes, or master OTP.
- No in-app "I lost my device" self-service bypass.
- No database-level `aal2` enforcement yet (Stage C2C-1 is enrollment and
  challenge only — see `admin/docs/c2b-results.md` and the C2C-1 final
  report for the enforcement boundary).
- No change to legacy MFA columns on `public.profiles` or to
  `www/admin.html`.
