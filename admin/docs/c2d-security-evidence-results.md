# Stage C2D — Server-owned security evidence and honeypot logging

Applied to production project `gxgytumhknmnwspxjzxw` and deployed. This document is
the required record: schema, threat model, limitations, retention, legal holds,
prohibited data, RLS, permissions, failure behavior, testing, rollback, remaining work.

## 1. Differences confirmed before building anything

Inspected `admin/docs/audit-plan.md`, `admin/docs/c2-hardening-plan.md`, the live
`admin_audit_logs`/`error_logs`/`app_error_events` schemas, the admin login/MFA flow,
`HoneypotField`, current permissions/navigation, `admin-login-guard`'s IP-extraction
and CORS patterns, `_shared/cors.ts`, `_shared/amos-rate-limit.ts`, migration
conventions (`npx supabase migration new`), installed extensions, and existing
`pg_cron` jobs. Confirmed distinct systems, deliberately not merged:

| System | Who can write | Purpose | Evidence-grade? |
| --- | --- | --- | --- |
| `admin_audit_logs` | any admin-team browser session, client-supplied actor/before/after | operational notes | No — C2-VERIFY found it browser-forgeable |
| `error_logs` / `app_error_events` | anyone (`error_logs: anyone insert`) / server jobs | application crash/bug telemetry | No — not security-relevant by design |
| **`security_events`** (this stage) | `service_role` only, via one function | investigation evidence | The intended evidence store — see limitations below |
| `security_event_legal_holds` | `service_role`/`super_admin`+aal2, via two functions | suspends retention for matching events | N/A — a hold record, not an event |

## 2. Schema

`public.security_events` — see
`supabase/migrations/20260911210834_create_security_events.sql` for the exact DDL.
Columns match the requested set exactly (`id`, `event_type`, `severity`, `source`,
`occurred_at`, `received_at`, `actor_user_id`, `actor_role`, `actor_authenticated`,
`session_id`, `assurance_level`, `target_type`, `target_id`, `action`, `outcome`,
`reason_code`, `correlation_id`, `request_path`, `request_method`, `ip_address`
(`inet`), `ip_source`, `user_agent`, `event_key`, `metadata` (`jsonb`, object-only,
≤4KB), `retention_until`, `created_at`). Every text field has a bounded `CHECK`
length. `request_path` has a `CHECK` rejecting any stored `?` — the writer also
strips query strings, so this is defense in depth, not the only guard.

Indexes were chosen against the Security Events page's actual filters (time range,
severity, event type, source, outcome, actor, correlation ID), not created
per-column speculatively:
`occurred_at desc`; `(event_type, occurred_at desc)`; `(severity, occurred_at desc)`;
`(outcome, occurred_at desc)`; `(actor_user_id, occurred_at desc)` partial;
`(target_type, target_id)` partial; `(correlation_id)` partial; `(retention_until)`;
a partial unique index on `event_key`. `source` has only two values today and rides
the time-ordered index without its own composite.

`public.security_event_legal_holds` — scoped to exactly one `event_id` **or** one
`correlation_id` (an investigation thread), never created by editing an evidence row.

## 3. Threat model

The system is meant to answer, after the fact: did someone probe the admin login,
fail MFA repeatedly, or trip the honeypot — and can that record survive scrutiny
about who/what wrote it? It is explicitly **not** meant to:
- prove a specific person's identity from an IP address alone;
- replace Supabase Auth's own login/MFA enforcement (it only observes those
  outcomes);
- serve as a legally self-authenticating record without further process — see
  §4 and §10.

## 4. Server attribution — what "server-owned" actually means here

`public.security_events` has **no browser INSERT path at any layer**: RLS has no
INSERT policy for any role, `anon`/`authenticated` hold no table grants beyond
`authenticated: SELECT`, and the one writer function
(`public.record_security_event`) has `EXECUTE` granted only to `service_role`.
The Edge Function `record-security-event` is the only caller, and it is the actual
identity boundary: it verifies a presented JWT with `supabase.auth.getUser()`,
loads `profiles.role` itself, and reads the `aal` claim out of that *already
signature-verified* token — none of `actor_user_id`, `actor_role`,
`actor_authenticated`, `assurance_level`, `ip_address`, `user_agent`, or any
timestamp is ever taken from the request body. `record_security_event` itself
accepts **no timestamp parameter at all** — `occurred_at`/`received_at`/
`created_at` are table defaults, so there is no code path, forged or not, that can
set them.

**Explicit limitation:** a PostgreSQL database owner (or anyone with `postgres`/
superuser access to this project) can still alter rows directly, outside the
application entirely. This table is **not** cryptographically tamper-evident —
no hash chain, no external attestation is implemented or tested. It should be
described as "server-attributed and application-append-only," not as
cryptographically immutable, in any future legal or compliance conversation.

## 5. IP and user-agent attribution

**Only `CF-Connecting-IP`** (Cloudflare's own header, which Cloudflare sets and does
not let a client override) is treated as a verified client IP. `X-Forwarded-For`
and `X-Real-Ip` are **not** trusted by this function — unlike `admin-login-guard`'s
use of those as a rate-limit *signal*, this endpoint writes to an evidence table, so
an unverified forwarded value is never presented as confirmed. When
`CF-Connecting-IP` is absent, `ip_address` is stored `NULL` with
`ip_source = 'unavailable'`; `ip_source` is always recorded so a reader can see
*why* an IP is missing rather than assuming it wasn't tried. Live smoke testing
(§14) confirmed Supabase's Edge Function gateway does deliver a genuine
`CF-Connecting-IP` in this deployed environment, so `ip_source = 'cf-connecting-ip'`
is expected on real traffic, not a will-never-fire code path.

`User-Agent` is read from the request header, truncated to 300 characters, and
that is the only header captured — **no other request header is stored**, and the
raw request body is never persisted (only the specific narrow fields the function
extracts from it).

## 6. Prohibited data — never accepted or stored

Passwords, OTP codes, TOTP secrets, QR payloads, access/refresh tokens,
`Authorization` header contents, the honeypot's entered value, card/CVV data, raw
Supabase/Postgres error messages, the full request body, and raw HTTP headers other
than `User-Agent`. Enforced at three layers: the Edge Function's `EVENT_CONFIG` /
`ALLOWED_METADATA_KEYS` (client can only ever select a fixed event type plus a tiny
per-event metadata allowlist — it cannot send free-form fields at all), the Edge
Function's own generic-error responses (never a stack trace, never the raw Postgres
error), and `record_security_event`'s own metadata-key redaction
(`password, otp, otp_code, code, secret, totp_secret, qr, qr_code, token,
access_token, refresh_token, authorization, honeypot, honeypot_value, card, cvv,
card_number, email, query`) as a second, independent filter even if the first were
ever bypassed.

## 7. Honeypot

`HoneypotField` (existing component, unchanged behavior — off-screen, `aria-hidden`,
`tabIndex={-1}`, `autoComplete="off"`, default field name `company_website`, never
"honeypot") is now wired into `LoginPage`. When filled: `signInWithPassword()` is
never called; exactly one fixed signal (`admin_login_honeypot`, no arguments beyond
the event type) is sent; the operator sees the identical generic failure message
used for a real bad password; the trigger is never revealed in the UI; the
duplicate-submit guard (`submitting` state, now correctly awaited end-to-end — see
§13) blocks a second click while the report is in flight; nothing auto-retries.

**Limitation, stated plainly for the Security Events page's own label:** a single
honeypot trigger is a *signal requiring investigation*, not proof of a specific
actor, device, or successful intrusion — automated crawlers, misconfigured password
managers, and accidental tab-completion can all fill a hidden field. The page must
never claim otherwise (see §11).

## 8. Retention and legal holds

`retention_until` defaults to `now() + 24 months` at insert time and is
**immutable afterward** — the append-only trigger blocks `UPDATE` unconditionally,
with no exception, so retention cannot be silently extended or shortened after the
fact either. `public.security_events_cleanup_expired()` (service_role only, not
exposed to any client, **not scheduled** by this migration) deletes rows past
`retention_until` with no active hold, matched by `event_id` or `correlation_id`.
`pg_cron` is an established, already-used pattern in this project
(`weekly-log-cleanup`, `purge-old-notifications`), so scheduling this function later
would be a justified choice — deliberately deferred here since nothing becomes
eligible for two years regardless, and the evidence pipeline itself should be
observed in production first.

A legal hold is a **separate row** in `security_event_legal_holds`, created only by
`place_legal_hold()` / released only by `release_legal_hold()`
(`super_admin` + `aal2`, checked inside the function; `service_role` also permitted
for a future server-initiated hold, not currently invoked from anywhere).
No evidence row is ever edited to create or reflect a hold.

**The 24-month period is an operational default, not legal advice** — it must be
reviewed with counsel before being relied on for a specific jurisdiction or matter,
exactly as `admin/docs/audit-plan.md` already states for the general evidence model.

## 9. RLS and grants

`security_events` and `security_event_legal_holds`: RLS **enabled and forced** on
both. Exactly one SELECT policy each:
`has_admin_privilege('admin') and has_mfa_aal2()` — true only for `admin`/
`super_admin` with a verified `aal2` session. No INSERT/UPDATE/DELETE policy exists
for any role on either table (structural absence, not a rule that could be
loosened). `anon` holds zero grants on either table. `authenticated` holds `SELECT`
only. A defense-in-depth `BEFORE UPDATE/DELETE` trigger
(`security_events_block_mutation`) rejects every mutation attempt on
`security_events`, including from `service_role` — the one deliberate exception is
a transaction-local flag set only by `security_events_cleanup_expired()`
immediately before its own retention delete.

## 10. Writer authorization model

`record_security_event(...)`: `SECURITY DEFINER`, `search_path = ''`, every object
schema-qualified, `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated`, granted
only to `service_role`. It validates `event_type`/`severity`/`source`/`outcome`
against fixed allowlists, strips query strings, redacts prohibited metadata keys,
bounds metadata to 4KB, and is idempotent via
`ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`. It has **no
timestamp parameter** and does not itself re-verify identity — that verification
already happened in the Edge Function before this function is ever called; this
function's authorization boundary is simply "only `service_role` may call it," which
`GRANT`/`REVOKE` enforce structurally.

## 11. Edge Function authorization, CORS, and JWT setting

`record-security-event`, deployed with **`verify_jwt = false`** (confirmed live —
the gateway must not reject the unauthenticated login-security event types before
they reach the function). Method restricted to `POST` (405 otherwise);
`Content-Type: application/json` required (415 otherwise); body capped at 4KB (413
otherwise); an 8-second internal timeout; CORS via the shared `_shared/cors.ts`
allowlist (no wildcard), with `http://localhost:5173` added to the existing
`ALLOW_DEV_CORS_ORIGINS`-gated dev-origin list for the new admin app's Vite dev
server — no production behavior change. Every field the client sends is validated
against a fixed allowlist before use; severity/action/outcome are **never**
client-supplied at all — they are looked up from the event type server-side, so a
caller cannot claim a false outcome for a real event or invent a new event type.

## 12. Exact events supported

`admin_login_honeypot` (severity `high`, outcome `blocked`, no auth required),
`admin_login_failed` (`notice`/`failure`, no auth required),
`admin_login_succeeded` (`info`/`success`, **auth required** — uses the caller's
fresh post-sign-in session), `admin_mfa_challenge_failed` (`notice`/`failure`, auth
required), `admin_mfa_challenge_succeeded` (`info`/`success`, auth required),
`admin_logout` (`info`/`success`, auth required). No other event type is accepted.

## 13. Failure behavior

`reportLoginSecurityEvent()` (the browser-side helper) never throws, has a 5-second
bounded timeout, and is not retried automatically anywhere it is called
(`LoginPage`, `MfaChallengePage`, `AuthProvider.signOut`) — a telemetry failure
cannot trap an administrator on a loading screen or create a retry loop. One real
bug was found and fixed during testing: the honeypot branch originally fired the
report without awaiting it, which meant the `submitting` duplicate-guard could be
bypassed by a fast second click; it now awaits the report (bounded to 5s) before
re-enabling the form, matching the real-login branch's existing behavior.

## 14. Testing

**SQL** (`supabase/tests/c2d_security_events.test.sql` — applies the full forward
migration in-transaction against real production data, then rolls back; run twice
during development, catching and fixing two real bugs before apply — see §17):
23/23 assertions passed, covering anonymous/ordinary-user/admin-aal1 read+insert
denial, admin/super_admin aal2 read, update/delete denial (even for super_admin
aal2), writer unavailable to any browser role, accept/reject/oversized/duplicate
writer behavior, no timestamp parameter exists, actor identity cannot be forged
(no anon/authenticated `EXECUTE`), missing assurance defaults to `aal1`, legal hold
authorization (super_admin+aal2 only) and its effect on retention cleanup
eligibility (proven both ways — a held event survives cleanup, and the same event
is deleted once the hold is released). Zero test data remains in production from
this suite (confirmed via a separate post-run read query).

**Application** (`admin/tests/security-events.test.tsx`,
`security-events-report.test.ts`, plus existing suites): 78/78 tests passing —
honeypot blocks the real sign-in call and sends only the fixed signal with no
duplicate submission, an invalid real login records only a safe `reasonCode` (never
the email/password), a successful login reports with the fresh session token, the
report helper never throws and sends only the intended fields, the Security Events
page requires `aal2` before querying at all, shows loading/empty/error+retry/loaded
states, and hides the IP column for a non-`super_admin` identity. All prior Stage
B/C/C2B/C2C tests (navigation counts, MFA flows, route guards, QR normalization,
etc.) remain green.

**Commands run:**
```
npm.cmd run typecheck   → clean
npm.cmd run lint        → clean
npm.cmd test            → 78/78 passed
npm.cmd run build       → succeeds
npm.cmd audit           → 0 vulnerabilities
```
Edge Function validation: no local `deno` toolchain exists in this environment or
this repo's established workflow (no prior Edge Function has one either); the
deploy step itself performs Deno's own bundling/type check and would fail loudly on
a syntax error — that, plus careful manual review, is this project's actual
established method. Secret scan and browser-bundle scan: clean (the one
`sb_secret_` string found in the built bundle is `@supabase/supabase-js`'s own
internal key-prefix-classification code, not a real credential — verified by
reading the surrounding minified source).

**Advisor before/after:** 703 → 705 (+2, both expected: `place_legal_hold` and
`release_legal_hold` newly appear under `authenticated_security_definer_function_executable`
— intentional, since both are `authenticated`-callable by design and internally
enforce `super_admin`+`aal2`). Zero new `anon_security_definer_function_executable`
findings; zero findings reference `security_events` or
`security_event_legal_holds` by name.

**Live smoke tests** (unauthenticated, against the deployed function):
honeypot event → `200 {"ok":true,"status":"recorded"}`; unknown event type →
`400 unsupported_event_type`; auth-required event with no session →
`401 authentication_required`; wrong method → `405 method_not_allowed`; wrong
content-type → `415 unsupported_media_type`; a second honeypot call within the
5-minute window → `200 {"ok":true,"status":"duplicate"}` (confirmed only one row
exists). This created one real `security_events` row from this session's own test
traffic (`admin_login_honeypot`, `severity: high`, `ip_source: cf-connecting-ip`) —
by design the append-only model means it cannot be deleted; it is disclosed here
rather than hidden, and its IP is not reprinted in this document. A live
authenticated-path smoke test (real JWT) was **not** performed — it would require
signing in as the production `super_admin`, which is not appropriate to do from an
automated script; that path was instead verified via the SQL test suite's
role-simulated calls to `record_security_event` directly, and via the mocked
application test suite.

## 15. Rollback

`supabase/migrations/20260911210834_create_security_events_ROLLBACK.sql` drops
every object this migration created, in dependency order, and touches nothing else.
Rehearsed twice in a rolled-back transaction against live production (forward +
rollback + verification, all inside one transaction that never commits): confirmed
zero of the six new objects remain afterward. **Not applied for real** — production
currently has the forward migration applied.

## 16. Remaining C2E/C2F work (not started)

- No evidence export yet (explicitly deferred; `audit.export` permission exists but
  nothing calls it).
- No scheduled retention cleanup (function exists, not cron-scheduled).
- Broader RLS/grants cleanup across the rest of the schema (C2F, unrelated to this
  table).
- `admin_audit_logs` remains browser-writable and not evidence-grade — migrating
  admin.html's audit writes onto a server-attributed path is future work.
- Rate limiting on `record-security-event` is dedup-based (a 5-minute
  `event_key` bucket) rather than a dedicated per-network rate-limit table; this was
  judged sufficient for this endpoint's actual risk (a single bounded INSERT,
  behind Supabase Auth's own existing login rate limiting) but is a smaller control
  than a full rate-limiter, and is noted as a documented limitation rather than
  overstated.
- The Security Events page does not yet expose bulk actions, CSV export, or
  free-text search beyond the indexed filter fields — intentionally, per this
  stage's scope.

## 17. Bugs found and fixed during this stage's own testing

Two real defects were caught by the rolled-back SQL test suite before this
migration was ever applied to production, and fixed in the migration file itself
(not worked around in tests):
1. `release_legal_hold`'s `UPDATE ... WHERE id = p_hold_id` was ambiguous against
   the function's own `RETURNS TABLE(id uuid)` implicit variable — fixed to
   `WHERE security_event_legal_holds.id = p_hold_id`.
2. `security_event_legal_holds.event_id`'s foreign key was `ON DELETE RESTRICT`,
   which meant retention cleanup could never delete an event that had ever had a
   hold placed on it, even after release — changed to `ON DELETE CASCADE`, since a
   released hold's history is only meaningful while its subject event still exists.
