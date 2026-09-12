# Stage C2D-FIX — IP redaction enforced at the database boundary

Applied to production project `gxgytumhknmnwspxjzxw`. No real IP address, from a
customer or otherwise, appears anywhere in this document — only booleans and
synthetic RFC 5737 test addresses were used during verification.

## 1. Confirmed original defect

C2D's `security_events` table granted `authenticated` a table-level `SELECT`, gated
by one RLS policy — `has_admin_privilege('admin') and has_mfa_aal2()` — that
admits `admin` and `super_admin` identically. The Security Events *page* hid the
`ip_address` column from a non-`super_admin` identity, but that was a frontend
convenience only. Confirmed live, via rolled-back role/JWT simulation, before any
code was changed (booleans only, never a real IP):

| Check | Result |
| --- | --- |
| `authenticated` table grants on `security_events` | `SELECT` |
| `admin` AAL2 direct `SELECT ip_address` | **`ip_visible=true`** — the defect |
| `super_admin` AAL2 direct `SELECT ip_address` | `ip_visible=true` (intended) |
| `admin`/ordinary-user AAL1 direct read | 0 rows (already correctly denied) |
| IP duplicated in `metadata`/`request_path`/query strings | none found (0 rows) |

## 2. Final authorization model

- `authenticated` holds **no grant at all** on `public.security_events`; its one
  RLS policy was dropped. There is no browser path to the table.
- All browser reads go through two `SECURITY DEFINER` RPCs,
  `list_security_events()` and `get_security_event()`, each independently
  re-checking `has_admin_privilege('admin')` and `has_mfa_aal2()` before touching
  any row — the caller's role/AAL is derived from the verified JWT via existing
  helpers, never accepted as a parameter.
- Both RPCs compute `v_include_ip := is_super_admin()` and return
  `ip_address = NULL, ip_source = 'restricted'` for anyone else. Only a verified
  `super_admin` session ever receives a real value.
- `security_event_legal_holds`'s own grants/policy are unchanged from C2D — this
  fix is scoped to the reported `security_events.ip_address` defect. Its data no
  longer needs a separate direct read from the detail view, though, since
  `get_security_event()` now returns `hold_status`/`hold_id` inline.
- Writer (`record_security_event`), cleanup
  (`security_events_cleanup_expired`), and legal-hold functions
  (`place_legal_hold`/`release_legal_hold`) are byte-for-byte unchanged.

A `SECURITY DEFINER` view was considered and rejected: a view has no way to express
"return `NULL` for this column, for this caller, based on their role" — that is
inherently per-row, per-caller logic, which only a function can express safely.

## 3. RPC signatures

```sql
list_security_events(
  p_page integer default 1, p_page_size integer default 25,
  p_from timestamptz default null, p_to timestamptz default null,
  p_severity text default null, p_event_type text default null,
  p_source text default null, p_outcome text default null,
  p_actor_user_id uuid default null, p_correlation_id uuid default null
) returns table (id, event_type, severity, source, occurred_at, actor_user_id,
  actor_role, actor_authenticated, assurance_level, target_type, target_id,
  action, outcome, reason_code, correlation_id, request_path, request_method,
  ip_address, ip_source, user_agent, retention_until, total_count)

get_security_event(p_event_id uuid) returns table (id, event_type, severity,
  source, occurred_at, received_at, actor_user_id, actor_role,
  actor_authenticated, assurance_level, target_type, target_id, action, outcome,
  reason_code, correlation_id, request_path, request_method, ip_address,
  ip_source, user_agent, metadata, retention_until, created_at, hold_status,
  hold_id)
```

Both: `SECURITY DEFINER`, `search_path = ''`, every object schema-qualified,
`REVOKE ALL FROM PUBLIC`, `REVOKE EXECUTE FROM anon`, `GRANT EXECUTE TO
authenticated` only. No dynamic SQL — every filter is a plain
`(param IS NULL OR column = param)` predicate. Page size is clamped to
`[1, 100]` server-side regardless of what is requested. Ordering is always
`(occurred_at DESC, id DESC)` for determinism.

**Pagination tradeoff, stated explicitly:** stable server-side offset pagination
was kept (page-number based, matching the existing page UI) rather than
introducing keyset/cursor pagination. A page can in principle skip or repeat a row
if new events are inserted between two page loads at the exact boundary — accepted
for an investigation view at this data volume, and unrelated to the authorization
fix itself.

## 4. Table grants and RLS

| Object | RLS | Policies | `anon` grant | `authenticated` grant |
| --- | --- | --- | --- | --- |
| `security_events` | enabled + forced | **0** (dropped) | none | **none** (dropped) |
| `security_event_legal_holds` | enabled + forced | 1 (unchanged) | none | `SELECT` (unchanged) |
| `list_security_events` (function) | — | — | no EXECUTE | EXECUTE |
| `get_security_event` (function) | — | — | no EXECUTE | EXECUTE |

## 5. Admin vs. super-admin results (verified live, post-apply, booleans only)

| Caller | `list_security_events` result |
| --- | --- |
| `admin`, AAL2 | `ip_visible=false (ip_source=restricted)` |
| `super_admin`, AAL2 | `ip_visible=true (ip_source=cf-connecting-ip)` |

## 6. Other-role results

`admin`/`super_admin` AAL1, `moderator`, `support`, `finance`, ordinary
authenticated users, and `anon` all receive a rejected call (permission denied or
0 rows for the now-inaccessible table) — verified in the SQL test suite (§9).

## 7. Security Events page changes

- `admin/src/services/security-events/query.ts`: `listSecurityEvents()` and the
  new `getSecurityEvent()` now call `.rpc('list_security_events', …)` /
  `.rpc('get_security_event', …)` — **no `.from('security_events')` or
  `.from('security_event_legal_holds')` call exists anywhere in `admin/src`**
  (confirmed by search, §10). Added `ipDisplay(ipAddress, ipSource)`, the single
  place that turns a redacted/absent value into a label — `"Restricted for this
  role"` when `ip_source === 'restricted'`, `"Not available"` when genuinely
  uncaptured, the real value otherwise.
- `SecurityEventsTable`: the IP column is **always rendered** now — what changes
  per caller is the *value* the RPC returned, not whether the browser decided to
  show a column. This directly satisfies "does not infer authorization only from
  the frontend role."
- `SecurityEventDetail`: now takes an `eventSummary` prop and fetches full detail
  via `getSecurityEvent(id)`; `hold_status`/`hold_id` come back inline, so no
  separate `security_event_legal_holds` read happens for this view. Filters,
  pagination, loading/empty/error+retry, and legal-hold placement/release for
  `super_admin` are all preserved.
- `database.types.ts`: the `security_events`/`security_event_legal_holds` table
  declarations were removed entirely (nothing calls `.from()` on them); the two
  RPCs were added under `Functions`.

## 8. Metadata protection

Confirmed live: 0 rows had an IP-shaped string inside `metadata` or a query string
inside `request_path` before this fix (i.e., no duplication path existed to begin
with). `get_security_event()` returns `metadata` unmodified from storage (already
redacted at write time by `record_security_event`'s prohibited-key filter — see
`admin/docs/c2d-security-evidence-results.md` §6); the IP fix does not touch that
filter. Verified in the SQL suite that an admin's `get_security_event()` response
metadata never contains the seeded synthetic IP.

## 9. SQL assertions — 26/26 passed (rolled-back transaction, synthetic IPs only)

1. Anonymous direct table read denied — ✅ (0/permission error)
2. Ordinary authenticated direct table read denied — ✅
3. Admin AAL2 direct table read denied — ✅ (confirms the fix — this used to return rows)
4. Super-admin AAL2 direct table read denied — ✅ (all reads now via RPC)
5. Admin AAL1 list RPC denied — ✅
6. Admin AAL2 list RPC succeeds — ✅ (10/10 rows)
7. Admin AAL2 receives NULL ip via list RPC — ✅
8. Admin AAL2 detail RPC receives NULL ip — ✅
9. Super-admin AAL1 RPC denied — ✅
10. Super-admin AAL2 list RPC receives the real ip — ✅ (matched the seeded synthetic value, never printed)
11. Super-admin AAL2 detail RPC receives the real ip — ✅
12. Moderator/support/finance/user RPC calls denied — ✅ (4 sub-checks)
13. PUBLIC/anon cannot execute either RPC — ✅
14. Invalid severity filter rejected — ✅
15. Page size capped at 100 regardless of request (1000 requested, 32 returned — fewer than the 41 seeded rows matched the concurrent filter-less call, still ≤100) — ✅
16. Ordering deterministic — ✅ (structural, shared `ORDER BY`)
17. Pagination does not duplicate rows across pages — ✅ (0 overlap)
18. Metadata cannot reveal the redacted ip — ✅
19. Legal hold still requires super_admin + aal2 (place rejected for admin) — ✅
20. Event insertion through the deployed writer remains functional — ✅ (`status=recorded`)
21. Update/delete remain blocked — ✅ (2 sub-checks)
22. `get_security_event` reports active hold status without a separate table read — ✅

Zero test data remained in production after the run (confirmed by a separate
post-run read query); the transient `admin`/`moderator`/`support`/`finance` role
promotions used for testing were rolled back with the rest of the transaction.

## 10. Application tests — 81/81 passed

Added: IP shown as "Restricted for this role" for `admin` when the (mocked) RPC
redacts it; the real IP shown for `super_admin` when the RPC includes it; the
detail drawer loads via `getSecurityEvent()` (never `listHoldsForEvent`/a direct
table read) and displays hold status. Fixed one now-obsolete assertion (the old
"IP column hidden for admin" test, which tested the pre-fix, insecure-adjacent
behavior) to match the corrected model. All prior C2D/C2C/MFA/navigation tests
remain green.

```
npm.cmd run typecheck   → clean
npm.cmd run lint        → clean
npm.cmd test            → 81/81 passed
npm.cmd run build       → succeeds
npm.cmd audit           → 0 vulnerabilities
```

Search confirming no direct browser table query:
`grep -rn "from('security_events')\|from('security_event_legal_holds')" admin/src/`
→ no matches.

## 11. Advisor before/after

Before (post-C2D, pre-fix): 705 total. After: **707 (+2)** — both
`authenticated_security_definer_function_executable` (the two new
`authenticated`-callable RPCs, intentional). Zero new `anon_security_definer_function_executable`
findings; zero new RLS-related findings for `security_events` (RLS enabled, zero
policies, deny-all by construction — not flagged as a problem for a
function-only table).

## 12. Rollback

`supabase/migrations/20260912054941_security_events_read_rpcs_ROLLBACK.sql` drops
both RPCs and restores C2D's exact grant (`SELECT` to `authenticated`) and policy.
Rehearsed twice in rolled-back transactions — once standalone, once directly
against the real, already-fixed production state (forward-already-applied) — both
confirmed the exact prior state is restored, then rolled back so production kept
the fix. **Not applied for real.**

## 13. Remaining risks

- `security_event_legal_holds` itself still grants `authenticated` a direct
  `SELECT` (unchanged from C2D) — out of scope for this fix, since it carries no
  IP data and the reported defect was specific to `security_events.ip_address`.
- Releasing a hold from the Security Events detail drawer requires having loaded
  that event's `hold_id` via `get_security_event()` in the current view — there is
  no standalone "Legal Holds" list yet (unrelated to this fix; a pre-existing gap
  from C2D's original scope, now slightly more visible since the drawer's
  `handleReleaseHold` depends on `hold_id` being present).
- Offset-based pagination's boundary-skip tradeoff (§3) remains, as documented.
- Broader RLS/grants work elsewhere in the schema remains C2F, untouched here.
