# C2E-3 — Full Current Admin Surface Audit

Audit date: 2026-09-14  
Repository: `master` at `25158d0a`  
Production project: `gxgytumhknmnwspxjzxw`  
Method: read-only repository inspection, live PostgreSQL catalog queries, deployed Edge Function inventory, Supabase database lint, and the existing 101-test admin suite. No production object, application code, configuration, migration, or deployment was changed.

## A. EXECUTIVE SUMMARY

The current admin security boundary is not ready to pass C2E-3. One high-severity issue is directly exploitable today: the public `admin-login-guard` `record` action accepts caller-asserted failed logins and uses them to block an arbitrary admin email. Five anonymous calls can deny the sole production super-admin access for 30 minutes. The same function's alert fallback omits `super_admin`, so the only current operator may receive no warning.

The strongest implemented boundary is C2D/C2E-2: native Supabase MFA is active for the one production `super_admin`; security evidence is server-attributed, application-append-only, AAL2-protected, redacted, and isolated from browser writes; R2 privileged namespaces are role checked and evidence-safe. No regression was found in that baseline.

The React admin is mostly a reference implementation rather than a connected production console. It has 71 navigation entries, but only 15 distinct functional page destinations (including authentication/security pages); the remaining mapped entries render `MockSectionPage`. Most recent feature pages contain fixtures and disabled actions. The production admin deployment script still publishes only `www/admin.html`, creating two admin implementations and making the live surface different from the React repository intent.

Live PostgreSQL has 123 public tables, all with RLS enabled, but only `security_events` and `security_event_legal_holds` force RLS. It has 181 public `SECURITY DEFINER` functions; 89 are executable by `anon`, 122 by `authenticated`, and 73 by `PUBLIC`. Many are trigger/helper functions whose direct invocation fails or has an internal check, but the grants are unnecessarily broad. Server authorization commonly uses coarse `is_admin()` or `is_admin_team()` checks while the client advertises 47 granular permissions. Consequently, server behavior does not preserve the UI's moderator/support/finance separation.

Production and migration history are materially out of sync: 95 distinct numeric repository versions versus 74 live ledger versions, with 23 repository-only and two production-only versions. Live objects prove that some repository-only SQL was hand-applied without ledger alignment. The live Edge inventory also contains `diag-apple`, absent from the repository, while local `notify-application` is not deployed.

## B. CURRENT ADMIN INVENTORY

### Application structure

| Area | Current implementation | Data or mutation path | Effective state |
|---|---|---|---|
| Login | `LoginPage`, `AuthProvider`, `admin-login-guard`, `record-security-event` | Supabase password auth plus native MFA | Connected, but login guard has N-01/N-02 |
| MFA challenge/enrolment/removal | `MfaChallengePage`, `SecuritySettingsPage`, `MfaEnrollPage`, `services/supabase/mfa.ts` | `supabase.auth.mfa.*`, session refresh | Connected |
| Operations dashboard | `OpsDashboardPage` | Security-event query plus reference metrics | Partly connected |
| Security events and legal holds | `SecurityEventsPage`, `SecurityEventDetail` | four AAL2 RPCs | Connected and server enforced |
| Errors / Health | `ErrorsHealthPage` | UI fixtures; Sentry service exists separately | Reference UI |
| Roles and Permissions | `RolesPermissionsPage` | local role map | Reference/read-only |
| Vehicle Rentals | `VehicleRentalsPage` | fixtures; disabled actions | Reference UI |
| Shop Orders / Escrow | `ShopOrdersPage` | fixtures; disabled actions | Reference UI |
| Reports / Disputes | `ReportsDisputesPage` | fixtures; disabled actions | Reference UI |
| Jobs / Recruiters | `JobsRecruitersPage` | fixtures; disabled actions | Reference UI |
| User Directory | `UserDirectoryPage` | fixtures; disabled actions | Reference UI |
| General Settings | `GeneralSettingsPage` | local draft and JSON export | Reference only; does not change production |
| Business verification | `BusinessVerificationsPage` | fixtures; disabled actions | Reference UI |
| Listing moderation | `ListingsModerationPage` | fixtures; disabled actions | Reference UI |
| Connection check | `SecurityCheckPage` | Supabase client checks | Connected diagnostic |
| All other navigation destinations | `MockSectionPage` | none | Placeholder |

All protected React routes are nested under `RequireSession`; each mapped route also uses `RequirePermission`. `/login` and `/mfa/challenge` are intentionally pre-session. `AuthProvider` verifies the live profile role and sends an enrolled AAL1 session to the MFA challenge. Accounts without a verified factor are allowed through at AAL1; therefore privileged server operations must enforce AAL2 themselves.

The browser stores its Supabase session using the standard supabase-js client. No application logging of passwords, OTPs, access tokens, refresh tokens, QR payloads, or MFA secrets was found. Return destinations are normalized and remain same-application routes. Error normalization can surface upstream messages, but credentials are not deliberately logged.

## C. AUTHORIZATION MATRIX

This is the intended React matrix. `user` has no admin permissions. A checkmark means the client exposes the capability; it does not establish server authorization.

| Capability family | user | super_admin | admin | moderator | support | finance |
|---|---:|---:|---:|---:|---:|---:|
| Dashboard | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Users view/assist | — | ✓ | ✓ | — | ✓ | — |
| Listings view/moderate | — | ✓ | ✓ | ✓ | — | — |
| Verifications | — | ✓ | ✓ | ✓ | — | — |
| Reports view/manage | — | ✓ | ✓ | ✓ | ✓ | — |
| Reviews/moderation | — | ✓ | ✓ | ✓ | — | — |
| Chats/support | — | ✓ | ✓ | — | ✓ | — |
| Orders manage | — | ✓ | ✓ | — | — | — |
| Content/legal/taxonomy publish | — | ✓ | ✓ | — | — | — |
| Revenue/ads/billing | — | ✓ | ✓ | — | — | view only |
| AMOS run/publish | — | ✓ | ✓ | — | — | — |
| Integration credentials | — | ✓ | — | — | — | — |
| Rentals moderate/manage | — | ✓ | ✓ | — | — | — |
| Analytics | — | ✓ | ✓ | — | — | — |
| Audit view/export | — | view+export | view | — | — | — |
| Errors resolve | — | ✓ | ✓ | — | — | — |
| Security/admin/MFA policy manage | — | ✓ | view only | — | — | — |
| Settings manage | — | ✓ | ✓ | — | — | — |

Effective server helpers are coarser:

| Helper | Effective roles | Main consequence |
|---|---|---|
| `is_super_admin()` | super_admin | Correct for credentials and legal holds |
| `is_admin()` | super_admin, admin | Used for orders, paid ads and rental state; no AAL2 |
| `is_moderator()` | super_admin, admin, moderator | Broad read/update of profiles and reports |
| `is_admin_team()` | all five staff roles | Broad analytics, AMOS table access, notifications, sessions and saved views |
| `has_admin_privilege('admin')` | super_admin, admin | Correct hierarchy for security-evidence reads when combined with AAL2 |

The key mismatch is that `is_admin_team()` gives every specialist the same database authority on several tables and AMOS endpoints, while the UI denies those capabilities. No specialist account exists in production today, so this is latent, but provisioning one makes it exploitable immediately.

## D. DATABASE / RLS MATRIX

Live catalog result: 123/123 public tables have RLS enabled; 2/123 force RLS. Browser table grants are often broad and depend on policies. The matrix groups tables with the same effective boundary; individual policy expressions were inspected for the high-risk groups.

| Tables/surface | Forced | Browser access and policies | Definer/RPC access | Assessment |
|---|---:|---|---|---|
| `profiles` | No | authenticated owner insert/update; owner or `is_moderator()` read; both `is_admin()` and `is_admin_team()` update policies; broad column grants | privileged-column trigger | Protected role fields are trigger-guarded and role changes require AAL2, but legacy MFA columns remain selectable (N-04) |
| `profiles_public` view | n/a | anon/auth SELECT; `security_barrier=true`, not `security_invoker`; exposes 107 rows and fields including role/status/last_seen/privacy | owner-rights view | Intended public projection but bypasses base RLS; minimize fields and make intent explicit (N-05) |
| `admin_audit_logs` | No | any admin-team browser may INSERT and SELECT | none required | Caller can supply operational audit content; not evidence-grade (N-03) |
| `security_events` | Yes | authenticated table SELECT grant, no direct RLS policy in current catalog; actual reads use RPC | service-only writer; AAL2 list/detail RPC | Fail closed for browser table access; RPC boundary is correct |
| `security_event_legal_holds` | Yes | authenticated SELECT with admin-or-higher + AAL2 | super-admin+AAL2 place/release | Correct |
| `app_error_events` | No | admin-team SELECT; admin UPDATE | server error writer | Coarse but consistent with current Errors permissions for active roles |
| `admin_sessions`, `admin_saved_views` | No | `is_admin_team()` ALL; saved views owner-scoped | none | Sessions are over-broad between staff; saved views are scoped |
| `amos_*` operational tables | No | many `is_admin_team()` ALL policies | service helpers and Edge functions | Conflicts with granular UI permissions (N-06) |
| `shop_orders`, items, history | No | customer/business owner/admin SELECT | `create_shop_order`, `update_shop_order_status` | Ownership reads are sound; admin mutation lacks AAL2 and transition-specific permission (N-07) |
| `reports` | No | duplicate policies; reporter insert/read, moderator read/update; older admin-only policies check literal `admin` and omit super-admin | direct RLS | Effective access comes from the broad moderator policy; redundant policies obscure intent |
| `notifications` | No | own or admin-team read/update; self or admin insert; own delete | dispatch/service jobs | Admin-team may read/update all user notifications; injection paths need narrower endpoints |
| recruitment/jobs | No | owner/recruiter policies plus admin-team candidate RPCs | browse/detail candidate definers | Candidate access grants all staff, differing from UI |
| rentals | No | user/company ownership policies; five analytics/state tables have RLS but no policies | owner helpers, admin state/analytics definers | service-only tables fail closed; public execute grants are excessive (N-08) |
| paid ads/boosts | No | public read only when active; mutations through RPCs/jobs | admin mutation definers | Admin-only server checks, safe search path, no AAL2 (N-07) |
| businesses/listings/verifications/reviews/messages/payments/subscriptions | No | RLS/ownership and admin/moderator helper policies vary by object | user, job and payment definers | No current React mutation path; broad helper/grant cleanup still required before connection |
| `_category_digest_cooldown`, rental analytics/state event tables | No | RLS enabled, zero policies | service/job access | Intentional fail-closed browser posture; FORCE RLS would add defense in depth |

`anon` and `authenticated` still possess broad base-table privileges on many tables. RLS currently prevents the obvious direct paths, but owners and security definers can bypass it. Only the two evidence tables use `FORCE ROW LEVEL SECURITY`.

## E. RPC SECURITY MATRIX

There are 181 public security definers. The table lists every relevant callable family and exact high-impact signatures; trigger-only helpers are grouped because direct invocation has no useful caller-controlled row.

| Functions/signatures | EXECUTE | Internal boundary | AAL2 | search_path | Result |
|---|---|---|---:|---|---|
| `list_security_events(integer,integer,timestamptz,timestamptz,text,text,text,text,uuid,uuid)`, `get_security_event(uuid)` | authenticated | super_admin in live definition; admin hierarchy in RLS design | Yes | empty | Strong, though UI grants `audit.view` to admin while live RPC currently resolves as super-admin-only; verify desired role |
| `place_legal_hold(uuid,uuid,text)`, `release_legal_hold(uuid)` | authenticated | super_admin | Yes | empty | Correct |
| `record_security_event(...)`, `security_events_cleanup_expired()` | service only | structural grant | n/a | empty | Correct |
| `admin_create_paid_ad(...)`, `admin_delete_paid_ad(uuid)`, `admin_expire_due_paid_ads()`, `admin_pause_scheduled_paid_ad(uuid)`, `admin_set_paid_ad_active(uuid,boolean)` | authenticated | `is_admin()` and trusted `auth.uid()` | No | empty | Grant appropriate; privileged mutation needs explicit assurance policy |
| `update_shop_order_status(uuid,text,text)` | authenticated | `is_admin()`; validates transition in body | No | public | High-impact mutation lacks AAL2 and empty path |
| `rental_set_listing_state(uuid,text,text,timestamptz)`, `rental_business_analytics(uuid)` | anon/auth/PUBLIC | internal `is_admin()` | No | public | Internal check blocks ordinary caller, but grants are much broader than needed |
| `admin_category_breakdown()`, `admin_cohorts(integer)`, `admin_daily_growth(integer)`, `admin_province_breakdown()`, `admin_revenue_summary(integer)`, `admin_top_payers(integer,integer)` | authenticated | `is_admin_team()` | No | public | All staff can see analytics, contrary to UI |
| `browse_recruitment_candidates(...)`, `get_recruitment_candidate(uuid)` | authenticated | `is_admin_team()` and reference resolution | No | public + pg_temp | Candidate data is exposed to all staff, contrary to UI |
| `amos_set_integration_credential(text,text,text)` | authenticated | super_admin | Yes | public + vault | Correct role/AAL; schema list is intentional for Vault |
| AMOS service/claim/secret/purge functions | service only | structural grant/automation | n/a | public or public+vault | Appropriate grants; mutable path is pinned but should migrate toward empty path where practical |
| `get_my_mfa_secret()` | authenticated | `auth.uid()` | No | public | Legacy custom-MFA path remains; unused by React native MFA |
| `create_shop_order(...)`, `create_job_listing(...)`, recruitment/rental conversation RPCs | authenticated | `auth.uid()` plus ownership/input checks | No | public/pg_temp | User operations; no admin escalation found |
| `apply_listing_boost`, account deletion, error logging and user rental helpers | anon and/or authenticated | `auth.uid()`/business rules | No | public | Anonymous grant is broader than necessary for authenticated-only operations |
| rental/job/message/notification trigger functions | often anon/auth/PUBLIC | trigger context/row checks | No | public | Direct grants are unnecessary; defense-in-depth cleanup needed |

All 181 definers have an explicit `search_path` configuration, so the current mutable-search-path category is zero. A path containing only trusted schemas is safer than an unset path; an empty path plus fully qualified objects remains preferred for privileged mutations.

## F. EDGE FUNCTION SECURITY MATRIX

| Function/family | Live version / gateway JWT | Internal controls | Audit result |
|---|---|---|---|
| `admin-login-guard` | v23 / false | partial JWT only for mutation actions; rate logic; origin allowlist | Anonymous lockout fabrication, ordinary-user mutation logging, raw 500 messages, alert target bug (N-01/N-02) |
| `admin-sentry-issues` | v2 / true | verified user, admin role, AAL checks, sanitized Sentry URLs/responses | C2E baseline sound; no dedicated endpoint rate limit, currently optional because upstream Sentry and bounded requests constrain it |
| `get-r2-upload-url` | v55 / true | verified user, role/ownership/path authorization, size/type rules, rates, evidence | C2E-2 sound; no regression |
| `record-security-event` | v1 / false | event allowlist, conditional verified JWT, bounded JSON/CORS, dedup, server attribution/redaction | Intentional false gateway setting; correct internal boundary |
| `get-cv-url` | v4 / true | verified user, role/ownership, rate limit | Sound statically; add cross-user live regression tests |
| `send-push` | v60 / true | verified user/automation path and role targeting | No AAL; admin recipient targeting should be permission-specific before React connection |
| `dispatch-notification-push` | v22 / true | service/job use | No direct user identity; deployment grant and automation-secret path must remain service-only |
| AMOS runners (research v23, content v27, publish v31, media v28, analytics/SEO/advanced/competitor v19) | false | verified admin-team JWT or automation secret, input validation, rate helper | Coarse role check lets future support/finance run/publish; rate helper intentionally fails open on DB failure (N-06) |
| AMOS OAuth start v10/callback v11, unsubscribe v16 | false | state/token validation and narrowly scoped unauth flows | Gateway setting intentional; keep state and redirect tests |
| purchase verification (Play v39/v38; Apple v24/v23) | true | verified user and store validation | User billing paths, not admin |
| store webhooks (Play v32; Apple v22) | false | provider signature/payload verification | Intentional webhook posture |
| Paynow create v2/check v2 | true/false | create authenticates; check validates payment reference/provider | User payment path; lint/runtime regression checks required |
| account deletion (`delete-my-account` v21, `process-account-deletion` v20) | true | verified owner; service processing | Database lint proves one deletion RPC currently fails (N-10) |
| `notify-message` | v57 / false | service/event-driven authorization | Intentional non-browser entry point; retain signature/secret tests |
| `automation-runner` | v38 / true | automation secret/service orchestration | No end-user role expected |
| `diag-apple` | v7 / true | repository source absent | Production-only diagnostic; cannot audit source (N-09) |

CORS uses explicit origins in the reviewed privileged functions. No wildcard privileged origin was found. No secrets are deliberately returned; several older functions still return raw or near-raw errors and should adopt fixed public codes.

## G. R2 / MEDIA SECURITY

C2E-2 remains valid. `get-r2-upload-url` v55 generates random server-side object keys, binds ordinary-user namespaces to `auth.uid()` or an owned business, restricts privileged `ads/` and `amos/manual-media/` namespaces to admin/super-admin, constrains content type and size, restricts verification documents, applies bounded signed URL TTLs and rate limits, and records only namespace-level evidence. Object keys, signed URLs, filenames, query strings, credentials and authorization headers are excluded from evidence. The C2E-2 redaction migration is present in live behavior.

CV access uses a dedicated verified-user URL endpoint. Rental and listing media rely on path ownership and database ownership policies. Verification documents remain private. No current React feature page constructs arbitrary signed URLs itself. Required remaining work is regression coverage for cross-owner CV, verification, rental, ad and AMOS media access; no design replacement is indicated.

## H. AUDIT LOG / SECURITY EVIDENCE

`security_events` is the authoritative security evidence store. Browser roles cannot insert, update or delete; the writer is service-role-only; event type and metadata keys are allowlisted; sensitive fields are redacted twice; actor, role, AAL, timestamps and CF IP are server-derived; request query strings are rejected; event keys provide five-minute idempotency. Legal holds are separate, super-admin+AAL2 operations. Retention is 24 months, but cleanup exists without a scheduled cron. The database owner can still alter records, so the accurate claim is “server-attributed and application-append-only,” not cryptographically immutable.

`admin_audit_logs` is an operational log. Any admin-team browser can create a row under its RLS policy, so an administrator can fabricate action text, actor context and before/after payloads. It must never be presented as security evidence. `app_error_events` and `error_logs` are observability stores, also not evidence.

The current sole super-admin cannot mutate security evidence through browser grants or legal-hold functions. Retention deletion is possible only through the service cleanup function and respects active holds. There is no evidence export implementation despite an `audit.export` client permission.

## I. ADMIN FEATURE-BY-FEATURE SECURITY REVIEW

| Feature | Current conclusion |
|---|---|
| Security Operations Center | Connected RPC-only path; requires AAL2; strongest current feature |
| Errors / Health | React view is fixture-based; Edge Sentry boundary is hardened but not wired to the page |
| Roles and Permissions | Displays client policy only; no role-admin mutation exists in React; production trigger guards role changes and requires AAL2 |
| Vehicle Rentals | Reference UI; existing `rental_set_listing_state` is admin-only internally but anonymously executable and lacks AAL2 |
| Shop Orders / Escrow | Reference UI; status RPC is admin-only, lacks AAL2 and fine-grained permission |
| Dispute arbitration | Reference UI; reports RLS uses moderator helper and redundant legacy admin policies |
| Jobs | Reference UI; recruitment candidate RPC exposes data to every admin-team role |
| User Directory | Reference UI; profile update policies are broad and legacy secret column grants remain |
| General Settings / policy management | Local drafts and JSON export only; no server mutation, so displayed policy does not change production |
| Business verification | Reference UI; no current React mutation to assess |
| Listing moderation | Reference UI; no current React mutation to assess |
| Reports and Reviews | Mostly placeholders/reference; underlying moderator helper controls server access |
| Payments / Subscriptions | Placeholder React routes; store/Paynow Edge functions are user/provider paths |
| Paid ads | Placeholder React route; admin RPCs use trusted server role but lack AAL2 |
| AMOS | Placeholder React routes; Edge/backend treats all staff as admin team, unlike UI |
| Notifications | Placeholder settings route; broad admin-team read/update and mixed service delivery paths |
| Messaging / Support | Placeholders; underlying policies/helpers must be rechecked when connected because UI roles differ |
| Analytics | Placeholder; production analytics RPCs allow all admin-team roles while UI allows admin/super-admin only |

No connected React mutation was found for approve, reject, suspend, publish, export, arbitrary status transition, notification dispatch, or role administration outside legal holds/MFA. Disabled UI controls provide no security assurance, but presently they also do not issue a request.

## J. DUPLICATE / ORPHANED / LEGACY CODE

1. `www/admin.html` is a large legacy admin implementation and is the only artifact published by `admin-build.sh`; `admin/` is the newer React implementation. This is an active duplicate authorization/UI system, not merely archived code.
2. `mockNavigation` and `enterpriseNavigation` duplicate the same principal destinations. The router derives routes from the larger mock set while the layout can show a smaller set, making reachable routes differ from visible navigation.
3. Seventy-one navigation entries collapse into a small set of real pages plus `MockSectionPage`. These are reachable placeholders, not finished features.
4. Legacy custom MFA remains in schema (`mfa_secret`, `two_factor_secret`, `mfa_enabled`, `get_my_mfa_secret`) beside native Supabase MFA. React uses only native MFA.
5. Multiple overlapping `reports` and `profiles` policies encode old and new role semantics simultaneously.
6. `diag-apple` is production-only; `notify-application` is repository-only. The former cannot be source reviewed and the latter is currently orphaned from production.
7. Historical migrations without numeric versions coexist with timestamped migrations and rollback files in the migration directory, contributing to ledger ambiguity.

## K. PRODUCTION VS REPOSITORY DRIFT

| Drift | Evidence | Risk |
|---|---|---|
| Migration ledger | repo 95 numeric versions; live 74; 23 repo-only; 2 live-only (`20260828131916`, `20260828133805`) | Migration names cannot establish live state; reproducibility is broken |
| Hand-applied current SQL | live contains objects from several repo-only September migrations | Live schema changed without matching ledger entries |
| Edge source | live `diag-apple` v7 has no repository directory | Unreviewable production code |
| Local-only Edge | `notify-application` directory absent from live inventory | Dead or undeployed implementation |
| Admin deployment | live build script publishes `www/admin.html`, not `admin/dist` | New React console is not the deployed admin described by repository work |
| Function versions | live versions recorded in F; repository has no immutable source-to-version manifest | Cannot prove which commit produced each deployed bundle |

The two stated C2E-2 commits exist in history and live `get-r2-upload-url` is v55 with JWT verification. No C2E-2 drift was detected.

## L. SUPABASE ADVISOR REVIEW

The live catalog was read directly and `supabase db lint --linked --level warning` was run. Dashboard-only Auth configuration could not be read through the database connection; leaked-password protection must therefore remain “unverified,” not “disabled” or “enabled.”

| Category | Current evidence | Classification |
|---|---|---|
| Anon-executable security definers | 89 | Some intentional identity/trigger helpers; broad grants on rental/admin-adjacent helpers should be fixed (N-08) |
| Authenticated-executable security definers | 122 | Many intentional RPCs; role/AAL still must be internal. Coarse admin-team functions should be fixed |
| PUBLIC-executable security definers | 73 | Mostly triggers/helpers; unnecessary and should be revoked defense in depth |
| Security-definer view | `profiles_public` lacks `security_invoker` | Intentional public projection today, but field minimization/explicit invoker decision required (N-05) |
| Mutable function search path | 0 public security definers without configured path | Cleared; some configured `public` paths should still be tightened when touching those functions |
| RLS tables without policies | six: `_category_digest_cooldown`, five rental analytics/state tables, `security_events` | Intentional fail closed/service-only; `security_events` is RPC-only. Defer FORCE RLS review |
| Extension in public | `pg_trgm` | Defense in depth; move in a planned extension/schema stage |
| Leaked-password protection | not observable via SQL/CLI used here | Verify manually in Auth settings before sign-off |
| Database lint | six errors | Runtime defects; `delete_own_account` and notification/rental jobs should be fixed (N-10) |

Lint errors: `delete_own_account` compares text and UUID while deleting notifications; `cleanup_inactive_chat_data` references `_inactive_users`; two re-engagement runners insert a nonexistent `error_logs.error_code`; `rental_capture_lead` uses `ON CONFLICT` without a matching unique constraint; `get_or_create_rental_conversation` leaves `p_user_id` unused.

## M. TEST COVERAGE GAPS

The React suite passes: 17 files, 101 tests. It covers client route guards, the local role map, MFA service/pages, login/session behavior, security-event display/reporting, error/reference pages and several UI states. It does not prove production authorization.

Missing automated boundaries:

- a six-role × AAL1/AAL2 production matrix for every privileged RPC and Edge function;
- anonymous login-guard forgery, arbitrary-email lockout, and alert-recipient tests;
- SQL assertions for every high-risk table grant plus RLS policy, including column privileges;
- specialist-role denials for AMOS, analytics, recruitment, notifications and admin tables;
- arbitrary UUID, cross-user and cross-business tests for orders, rentals, CVs, verification documents and conversations;
- permitted and forbidden state-transition tests for order/rental/report/listing mutations;
- notification recipient and deep-link validation, deduplication and rate behavior;
- service-secret versus user-JWT tests for dispatchers, webhooks and automation paths;
- deploy-manifest tests comparing function source, version and `verify_jwt`;
- migration-ledger parity and schema drift checks;
- retention-cleanup scheduling/hold regression and evidence integrity tests after future changes;
- leaked-password protection configuration assertion through the Management API or documented dashboard evidence.

## N. FINDINGS

### N-01 — P1 High: anonymous callers can lock out an arbitrary admin email

- **Exact location:** `supabase/functions/admin-login-guard/index.ts:151-196`; deployed `admin-login-guard` v23 with `verify_jwt=false`.
- **What is wrong:** `record` trusts caller-supplied `email`, `ok`, and `reason`, inserts the attempt with service role, counts failures, and creates an email block after five failures. It never verifies that Supabase Auth actually rejected an attempt.
- **Why it matters:** An attacker can deny admin access repeatedly without knowing a password.
- **Who can exploit it:** Any internet caller who knows or guesses an admin email.
- **Exploitable today:** Yes. Production has one super-admin, so a targeted block affects the only administrator.
- **Evidence:** Live deployment is unauthenticated; source lines 151-185 implement the caller-driven counter/block.
- **Affected surfaces:** Admin login, incident response, all operations dependent on the sole operator.
- **Recommended fix:** Make the server own failure evidence. Use an Auth hook/provider-verifiable signal or a short-lived server-issued attempt nonce bound to email/IP; never increment a blocking email counter from an unverified client assertion. Keep generic UI errors.
- **Regression test required:** Five forged public `record` calls cannot create an email block; five verified failed attempts do; success cannot be forged; IP throttling remains functional.

### N-02 — P1 High: lockout alerts can omit the only production administrator

- **Exact location:** `supabase/functions/admin-login-guard/index.ts:228-235`.
- **What is wrong:** The fallback recipient roles are `admin`, `moderator`, `support`, `finance`; `super_admin` is omitted. Production contains one `super_admin` and no other staff roles. Delivery depends on an unverified `ADMIN_ALERT_USER_IDS` secret.
- **Why it matters:** A real or forged lockout may produce no alert to the only operator.
- **Who can exploit it:** An attacker triggering N-01 benefits; configuration drift can also trigger it accidentally.
- **Exploitable today:** Yes unless the undeclared secret happens to contain the current operator ID; that secret value was not read.
- **Evidence:** Exact fallback source and live role counts (super_admin 1, all specialist/admin roles 0).
- **Affected surfaces:** Login monitoring and security notification response.
- **Recommended fix:** Resolve recipients through one canonical permission/role function including super-admin and fail visibly into security evidence when delivery has zero targets.
- **Regression test required:** With only a super-admin profile and no override secret, one alert row and one targeted push are queued.

### N-03 — P2 Medium: browser-writable audit logs can be fabricated

- **Exact location:** live policies `aal admin insert/select` on `public.admin_audit_logs`; C2D documentation §1.
- **What is wrong:** Any admin-team browser may insert operational audit rows with caller-supplied content.
- **Why it matters:** Consumers may incorrectly treat fabricated actor/action/before/after data as evidence.
- **Who can exploit it:** Any compromised or malicious staff session.
- **Exploitable today:** Yes by the current super-admin session, although this does not grant another privilege.
- **Evidence:** Live INSERT policy checks role only; it does not derive actor or payload server-side.
- **Affected surfaces:** Legacy admin audit screens, investigations, compliance exports.
- **Recommended fix:** Label it operational-only now; migrate security-relevant actions to a server-owned writer and retain `security_events` as the evidence system.
- **Regression test required:** Browser roles cannot set actor/timestamp on evidence rows; operational log is never included in an evidence export without a warning.

### N-04 — P2 Medium: legacy MFA secret columns remain browser-selectable

- **Exact location:** live column grants on `public.profiles.mfa_secret`, `two_factor_secret`, `mfa_enabled`; repository migrations `admin_mfa_secret_column_lockdown.sql` and `20260911090000_profiles_privileged_column_guard_and_role_hierarchy.sql`.
- **What is wrong:** Later table-level grants restored effective SELECT privileges on legacy custom-MFA columns.
- **Why it matters:** If a legacy TOTP seed is ever populated, a permitted base-profile read can disclose it.
- **Who can exploit it:** An authenticated owner and staff roles able to read the affected profile row.
- **Exploitable today:** No secret is presently stored: all three live non-null/true counts are zero. It becomes exploitable when legacy data returns.
- **Evidence:** Live `information_schema.column_privileges` and zero-value aggregate.
- **Affected surfaces:** Legacy MFA only; native Supabase MFA factors are stored in `auth`, not these columns.
- **Recommended fix:** Remove the custom-MFA columns/RPC after confirming no consumer, or restore explicit column revokes after every table grant.
- **Regression test required:** authenticated and every staff role fail direct SELECT of both secret columns; native MFA still works.

### N-05 — P2 Medium: public profile view bypasses base-table RLS

- **Exact location:** live `public.profiles_public`; `20260822122615_emergency_profiles_public_privacy_authority.sql`.
- **What is wrong:** The owner-rights view has `security_barrier=true` but not `security_invoker`; anon/auth can read 107 projected rows including role, status, last-seen and privacy fields.
- **Why it matters:** Future additions to the view bypass profile RLS and can silently create a public data leak; current metadata also aids account/staff enumeration.
- **Who can exploit it:** Any anonymous caller.
- **Exploitable today:** Yes for the current projected metadata; no email, phone or secret field is exposed.
- **Evidence:** Live view options and definition, live grants, existing 107 profiles.
- **Affected surfaces:** Public profile displays and recruitment identity lookup.
- **Recommended fix:** Document required public fields, remove role/status/last_seen/privacy unless demonstrably needed, and use an invoker-safe policy/RPC design that preserves public display requirements.
- **Regression test required:** anon sees only approved display fields/rows and cannot enumerate staff role or private status metadata.

### N-06 — P2 Medium: coarse server roles conflict with granular UI permissions

- **Exact location:** `admin/src/security/permissions.ts`; live `is_admin_team()` policies/RPCs; all AMOS Edge functions using `ADMIN_TEAM_ROLES`.
- **What is wrong:** Support, finance and moderator are denied AMOS/analytics/recruitment capabilities in React but accepted by multiple server paths.
- **Why it matters:** Hidden buttons do not prevent direct API calls. Provisioning a specialist creates cross-role access.
- **Who can exploit it:** Any future compromised or malicious specialist account.
- **Exploitable today:** No specialist profile exists today; immediately exploitable after provisioning.
- **Evidence:** Live role counts and catalog/body inspection; React matrix differs.
- **Affected surfaces:** AMOS run/publish, analytics, recruitment candidates, admin sessions/notifications and some shared tables.
- **Recommended fix:** Define one server-side permission mapping and make every Edge/RPC/table policy check the specific capability. Keep the client map as display logic only.
- **Regression test required:** full role matrix asserts allow and deny results at the server for each capability.

### N-07 — P2 Medium: high-impact admin mutations do not require AAL2

- **Exact location:** live `update_shop_order_status(uuid,text,text)`, `rental_set_listing_state(uuid,text,text,timestamptz)`, and five `admin_*paid_ad*` security definers.
- **What is wrong:** These mutations check `is_admin()` but not `has_mfa_aal2()`.
- **Why it matters:** An AAL1 admin session can change order, rental or paid-ad state. React's challenge flow cannot protect direct RPC calls.
- **Who can exploit it:** An attacker with an AAL1 admin/super-admin session or token.
- **Exploitable today:** Yes if the current account is operating at AAL1; its verified factor normally causes React to challenge, but server calls remain possible.
- **Evidence:** Live function definitions/configuration show role checks and `aal2=false`.
- **Affected surfaces:** Orders/escrow, rental moderation and ad lifecycle.
- **Recommended fix:** Classify mutations by impact, require AAL2 for destructive/financial/publishing transitions, and enforce allowed transitions in the same server function.
- **Regression test required:** admin AAL1 denied, admin AAL2 allowed, specialist denied, invalid transitions and arbitrary UUIDs denied.

### N-08 — P2 Medium: excessive EXECUTE grants expand the callable attack surface

- **Exact location:** live grants on 181 public security definers; examples `rental_set_listing_state`, `rental_business_analytics`, trigger functions, `delete_my_account`, `delete_own_account`.
- **What is wrong:** 89 definers are anon-executable and 73 PUBLIC-executable. Internal checks often prevent success, but callers can still reach parsing, error and expensive code paths.
- **Why it matters:** A missed check or future edit becomes remotely reachable; it increases abuse and regression risk.
- **Who can exploit it:** Anonymous and ordinary authenticated callers depending on function.
- **Exploitable today:** Some functions only fail closed; account-deletion and helper calls are reachable today. No direct admin escalation was demonstrated beyond N-01.
- **Evidence:** Live `has_function_privilege` inventory and exact signatures in section E.
- **Affected surfaces:** Rentals, jobs, messaging, notifications, account deletion and helpers.
- **Recommended fix:** Revoke PUBLIC/anon by default; grant only to the real caller role. Revoke trigger functions from browser roles even when direct execution is harmless.
- **Regression test required:** grant snapshot allowlist plus direct anon/auth calls for every retained definer.

### N-09 — P2 Medium: production code and migration history are not reproducible

- **Exact location:** live migration ledger, `supabase/migrations`, live `diag-apple` v7, local `notify-application`, `admin-build.sh`.
- **What is wrong:** 23 repository versions are absent from the ledger, two ledger versions lack matching repository files, deployed code lacks source, and the active admin build publishes the legacy panel.
- **Why it matters:** Reviewers cannot derive production exposure from master or reliably rebuild/rollback it.
- **Who can exploit it:** Not a direct attacker primitive; it increases the chance and duration of security mistakes.
- **Exploitable today:** Drift exists today.
- **Evidence:** Read-only ledger/source/deployment comparison in section K.
- **Affected surfaces:** Entire database, Edge fleet and admin deployment.
- **Recommended fix:** Reconcile a canonical baseline without replaying already-applied SQL, remove or recover `diag-apple`, decide `notify-application`, add a deploy manifest, and select one admin application.
- **Regression test required:** CI fails on ledger/source/function-manifest drift and confirms the intended admin artifact.

### N-10 — P2 Medium: current production routines contain verified runtime errors

- **Exact location:** live database lint results for `delete_own_account`, `cleanup_inactive_chat_data`, `run_saved_listing_reminders`, `run_marketplace_reengagement`, `rental_capture_lead`, `get_or_create_rental_conversation`.
- **What is wrong:** Invalid types, missing relation/column, missing conflict constraint and unused authority input are present in live definitions.
- **Why it matters:** Account deletion and background notification/rental workflows can fail, leaving data undeleted or operations incomplete.
- **Who can exploit it:** Mostly triggered by legitimate users/jobs; deliberate repeated calls can amplify errors where grants permit.
- **Exploitable today:** Yes as availability/integrity defects; no privilege escalation was established.
- **Evidence:** `supabase db lint --linked --level warning` on 2026-09-14.
- **Affected surfaces:** Account deletion, messaging cleanup, saved-listing/re-engagement notifications and rental leads/conversations.
- **Recommended fix:** Repair each routine in isolated migrations after C2E-3; start with account deletion and add transactional regression tests.
- **Regression test required:** execute each routine against representative rows and assert both success and rollback/error behavior.

### N-11 — P3 Low: privileged endpoints return overly detailed internal errors

- **Exact location:** `supabase/functions/admin-login-guard/index.ts:200-201` and similar older Edge catch blocks.
- **What is wrong:** Raw exception messages can be returned to callers.
- **Why it matters:** Schema/provider details can aid probing and make client behavior unstable.
- **Who can exploit it:** Any caller who can trigger the error branch; anonymous for login guard.
- **Exploitable today:** Yes, if an internal error can be induced.
- **Evidence:** Direct source inspection.
- **Affected surfaces:** Login guard and older Edge endpoints.
- **Recommended fix:** Return fixed public error codes and log redacted details server-side.
- **Regression test required:** injected database/upstream errors never appear verbatim in the HTTP response.

### N-12 — P3 Low: security retention cleanup is not scheduled

- **Exact location:** `security_events_cleanup_expired()` and C2D results §8/§16.
- **What is wrong:** The tested cleanup function exists but no cron invokes it.
- **Why it matters:** Rows will outlive the stated 24-month default after they begin expiring.
- **Who can exploit it:** No direct attacker; it is a retention/compliance gap.
- **Exploitable today:** No row is yet 24 months old.
- **Evidence:** Live job/function inspection recorded by C2D and current catalog.
- **Affected surfaces:** Security evidence retention.
- **Recommended fix:** Schedule the existing function after legal retention approval; do not create another cleanup system.
- **Regression test required:** expired unheld rows are removed, held rows survive, released rows become eligible, job identity is service-only.

## O. SAFE IMPLEMENTATION ORDER

1. **C2E-4: repair `admin-login-guard` N-01 and N-02.** Replace caller-asserted failure blocking, include the super-admin in canonical alert resolution, add abuse/recipient tests, deploy only that function, and verify no C2D/C2E-2 change.
2. **C2E-5: reconcile server permissions and AAL.** Define the authoritative role-to-capability matrix; update AMOS/analytics/recruitment/notification paths; add AAL2 to approved high-impact transitions; test every role and AAL.
3. **C2E-6: grants and profile privacy.** Remove legacy MFA secret access, minimize `profiles_public`, revoke unnecessary definer grants, and test table grants plus RLS together.
4. **C2E-7: operational correctness.** Fix the six lint failures in isolated migrations, beginning with account deletion.
5. **C2E-8: drift reconciliation.** Baseline the migration ledger safely, recover/remove production-only source, create a function deployment manifest, and choose the React or legacy admin as the single deploy target.
6. **C2E-9: connect admin features one vertical slice at a time.** For each page, implement one server-authorized service, evidence event, transition/ownership tests and UI; remove its placeholder/legacy duplicate in the same stage.
7. **C2E-10: retention/advisor closure.** Verify leaked-password protection through an authorized management surface, decide `pg_trgm` relocation, and schedule the existing evidence cleanup after retention approval.

## P. OUT-OF-SCOPE ITEMS

This audit made no implementation or production change. C2E-2 `get-r2-upload-url` v55, its authorization model, evidence redaction and commits `28906cc1`/`9b775bd3` must not be reopened without a demonstrated regression. Do not rewrite the mobile app or public website merely to address admin placeholders. Do not add a second role system, MFA implementation, evidence table, media signer, notification dispatcher or retention worker. Do not replay repository-only migrations against production to “fix” ledger counts; first determine which effects already exist. Do not treat `admin_audit_logs` as cryptographic evidence. Do not expose secrets or production user data in tests. Legal retention duration and formal evidentiary claims require counsel and remain outside this engineering audit.

## C2E-3 STATUS

**BLOCKED BY P1**

## NEXT STAGE RECOMMENDATION

**C2E-4 — Fix N-01 first: remove the unauthenticated, caller-asserted failed-login signal that can create an arbitrary admin-email block.** In the same narrowly scoped login-guard stage, fix N-02 so the sole production super-admin is a guaranteed alert recipient, then validate forged-attempt denial and real lockout behavior without changing C2D or C2E-2.
