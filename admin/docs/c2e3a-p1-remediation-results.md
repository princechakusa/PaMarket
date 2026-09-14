# C2E-3A — P1 Remediation Results

Status: **FIXED LOCALLY**  
Date: 2026-09-14  
Production changes: none  
Commit/push: none

## Root cause and complete flow

The deployed legacy admin called `admin-login-guard` twice around a direct browser `supabase.auth.signInWithPassword()` call:

1. `check` accepted a browser-selected email and queried `admin_ip_blocks` with service-role authority.
2. The browser performed the password request directly against Supabase Auth.
3. `record` accepted the same browser-selected email plus browser-selected `ok` and `reason` values.
4. The function inserted those values into `admin_login_attempts`, counted them, and created an email block after five caller-asserted failures.
5. A later `check` prevented the targeted email from reaching Supabase Auth.

The function used no JWT for `check` or `record`. Identity was not established. The caller chose the target identity, outcome and reason. `CF-Connecting-IP` was preferred, but `X-Forwarded-For` and `X-Real-IP` fallbacks were browser-controllable outside a correctly normalizing proxy. Replays created additional rows and amplified the count. A separate live `INSERT ... WITH CHECK (true)` RLS policy plus broad anon/auth table grants also allowed direct attempt-row fabrication.

## Local remediation

- `admin-login-guard` rejects `check` and `record` with fixed HTTP 410 `unsupported_action` before constructing a service-role database client.
- All login-attempt and login-block reads/writes were removed from that Edge handler.
- IP attribution in the retained `whoami` and authenticated mutation throttle accepts only `CF-Connecting-IP`; forwarding headers are ignored.
- Raw exception responses were replaced with `internal_error`.
- The alert role list now includes `super_admin`, resolving the second C2E-3 P1 in the same smallest-safe function change.
- The deployed legacy UI no longer calls the retired actions. Password authentication remains a direct Supabase Auth request; its local session limiter remains a UX/duplicate guard and successful login clears it.
- Failed login, successful login and MFA failure signals are sent to the existing `record-security-event` pipeline with fixed event types and no email, password, IP, raw error or other body data. That evidence is deliberately non-authoritative and cannot create a lockout.
- A forward migration drops the public attempt INSERT policy, removes all browser privileges on both state tables, and regrants authenticated SELECT only for the existing Security Center policies.
- The old enterprise bootstrap SQL was updated so rerunning it cannot restore the public INSERT policy.

Supabase Auth remains the authoritative password and brute-force boundary. No custom parallel authentication or lockout system was added. React native MFA, the legacy MFA flow, honeypot behavior, C2D evidence redaction/idempotency and the authenticated destructive-mutation throttle were preserved.

## Files changed

- `supabase/functions/admin-login-guard/index.ts`
- `supabase/functions/_shared/admin-login-guard-policy.ts`
- `supabase/migrations/20260914120000_retire_untrusted_admin_login_state.sql`
- `supabase/tests/c2e3a_admin_login_state_authorization.test.sql`
- `supabase/ADMIN_ENTERPRISE_V2.sql`
- `www/admin.html`
- `admin/tests/admin-login-guard-remediation.test.ts`
- `admin/tsconfig.app.json` (Node types for source-contract tests)
- `docs/ADMIN_OPERATIONS_PLATFORM.md`
- this results document

The accepted C2E-3 audit report remains a separate uncommitted artifact from the preceding audit stage.

## Tests added

`admin/tests/admin-login-guard-remediation.test.ts` verifies:

1. both public state actions are retired regardless of a supplied identity;
2. rejection occurs before service-role client creation;
3. the Edge handler has no attempt/block database path;
4. the migration removes browser write policies and DML grants while preserving authorized reads;
5. spoofable proxy headers are ignored;
6. the real Supabase password call, local failure increment and success reset remain;
7. the legacy client has no retired-action call and emits only fixed security signals;
8. failure responses are generic and do not include credentials, identity, IP or internal errors;
9. authenticated mutation throttling remains;
10. alert roles include `super_admin`.

`supabase/tests/c2e3a_admin_login_state_authorization.test.sql` is a read-only post-apply assertion suite for live policy and grant state. It was not run because production application is outside this stage.

Existing honeypot and evidence-report suites run alongside the focused test and remain unchanged.

## Gate results

| Gate | Result |
|---|---|
| Focused tests | 3 files, 25 tests passed |
| Typecheck | passed |
| Lint | passed |
| Complete admin suite | 18 files, 109 tests passed |
| Build | passed; 146 modules transformed |
| npm audit | 0 vulnerabilities |
| Edge TypeScript bundle/parse | passed with local esbuild |
| Static alternative-path search | no runtime write/call path remains; legacy Security Center retains authorized historical reads |
| Diff whitespace check | passed |

One initial full-suite run had an unrelated `user-directory.test.tsx` five-second timeout while 108 tests passed. A clean full rerun passed 109/109 without a code change.

## Post-fix attack review

- **Alternate endpoints/direct writes:** retired at the Edge handler, legacy UI and database grant/policy layers. The migration must be applied for the database layer to be true in production.
- **Privilege escalation/IDOR:** retired actions accept no identity and reach no database. Existing authenticated mutation actions still derive UID with `auth.getUser`; their broader role issue remains a C2E-3 P2 and was not changed.
- **Race/replay/duplicates:** repeated `check`/`record` requests return the same fixed 410 and cannot increment state. Direct REST DML is denied after migration. Evidence duplicates retain C2D's five-minute idempotency and do not affect access.
- **Rate-limit bypass:** clearing session storage bypasses only the explicitly non-security UX limiter. Supabase Auth continues to own real password rate limiting. No client assertion can create server lockout state.
- **Identity:** no anonymous request supplies a trusted email, user ID or outcome. Authenticated mutation identity remains derived from verified JWT.
- **Proxy headers:** `X-Forwarded-For` and `X-Real-IP` are ignored. Only Cloudflare's header is used; missing attribution becomes `unknown`.
- **Sensitive data:** failed-login evidence contains a fixed event and reason code. The failure response contains only a fixed error code. Password, email, access token, IP and internal exception text are absent from the request body and response.

## Residual risk and production requirements

Production remains vulnerable until the local artifacts are separately approved and released. A production migration **is required** to revoke the live public INSERT policy and browser DML grants. An `admin-login-guard` Edge Function deployment **is required**. The legacy admin static artifact also requires deployment because it is the current active UI.

The existing `record-security-event` unauthenticated login signals can be fabricated as signals, as documented in C2D, but are idempotent and cannot affect authentication or lockout state. `whoami` still returns the caller's Cloudflare-observed IP for legacy operational logging. The authenticated mutation actions still accept any verified user rather than checking an admin role; that is an accepted P2 outside C2E-3A.

Technical rollback is available through source reversion and Edge/static redeployment. Reversing the SQL revokes or deploying the prior Edge version would restore the P1 and is not a safe production rollback. The safe operational fallback is to keep the retired actions and database revokes in place while disabling the affected legacy UI flow or correcting the release forward.

## C2E-3A STATUS

**FIXED LOCALLY**

C2E-3 remains **BLOCKED BY P1** until the migration, Edge Function and legacy admin artifact are approved for production and independently verified there.
