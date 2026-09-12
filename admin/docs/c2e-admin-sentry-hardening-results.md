# Stage C2E, admin Sentry authorization and evidence

## Status

Prepared and validated by Codex on branch `feat/admin-stage-b-shell`, starting from `e6459531ee8c6cd6cd02f396397c5fe352f55037`.

Nothing in this stage has been applied to Supabase or deployed. Claude must independently review the diff, apply the forward migration, deploy the Edge Function, run live smoke tests, then commit and push if the checks pass.

## Scope

This is the narrow C2E prerequisite identified in `c2-hardening-plan.md`. It hardens `admin-sentry-issues` without migrating the Error page or changing the legacy admin.

Changed surfaces:

- `supabase/functions/admin-sentry-issues/index.ts`
- `supabase/config.toml`
- `supabase/migrations/20260912123000_admin_sentry_authorization_and_evidence.sql`
- paired rollback migration
- `supabase/tests/c2e_admin_sentry_authorization_and_evidence.test.sql`
- the Security Events filter and its application test

Explicitly unchanged:

- `www/admin.html`
- mobile and public website code
- all other Edge Functions
- existing C2D tables, RLS, IP redaction, legal holds, and retention behavior

## Authorization result

The Edge Function now derives identity from `auth.getUser(jwt)` and role from `public.profiles` through its server client. It never accepts role or permission values from browser input.

The current server mapping for `errors.view` is intentionally explicit:

- allowed: `admin`, `super_admin`
- denied: `moderator`, `support`, `finance`, ordinary users, missing profiles

`super_admin` is therefore no longer locked out by the former exact `role === 'admin'` check.

This stage does not require AAL2 at the Sentry proxy. The legacy `www/admin.html` caller uses the authenticated Supabase session but does not yet guarantee native Supabase AAL2. Enforcing AAL2 here now would break that production caller. The evidence record still captures the assurance level from the already-verified JWT so the later legacy-admin retirement can tighten this safely.

## Request and response controls

- only `GET` and CORS `OPTIONS` are accepted
- `issueId` must contain 1 to 32 digits
- `statsPeriod` is restricted to `24h`, `7d`, `14d`, or `30d`
- query text is capped at 200 characters and rejects control characters
- Sentry requests time out after 8 seconds
- organization, project, query, and issue values are URL encoded
- upstream and internal errors return fixed messages, never raw Sentry, Postgres, token, or exception text
- returned issue fields, tags, contexts, and stack frames are allowlisted and bounded
- returned Sentry links must use HTTPS on `sentry.io` or a subdomain

The existing approved CORS origins remain unchanged. The function is now explicitly recorded as `verify_jwt = true` in `supabase/config.toml` to prevent deployment drift.

## Evidence events

The migration extends the existing service-role-only writer and read filter with:

- `admin_sentry_access_denied`
- `admin_sentry_issues_listed`
- `admin_sentry_issue_viewed`

The Edge Function records success, blocked access, and upstream/internal failure outcomes. Actor ID, persisted role, JWT assurance level, Cloudflare IP attribution, bounded User-Agent, request path, and operation are server-derived. It never records the Sentry token, authorization header, query text, exception content, or returned Sentry payload.

Evidence uses a five-minute idempotency bucket. Evidence-write failure does not expose an error or block this read-only operational endpoint. This matches C2D's failure-isolation design for non-mutating reads.

## Migration behavior

The forward migration replaces only these two existing functions:

- `record_security_event(...)`, solely to add the three fixed event types
- `list_security_events(...)`, solely to permit those event types as filters

Signatures, security mode, body logic, grants, IP redaction, pagination, legal holds, and all existing event types remain unchanged. The paired rollback restores the exact C2D and C2D-FIX definitions.

Apply order matters:

1. Apply the forward migration.
2. Run the SQL test.
3. Deploy `admin-sentry-issues` with JWT verification enabled.
4. Perform live role and response smoke tests.

Deploying the function first is safe but would temporarily fail evidence writes because the new event types would not yet exist. Avoid that order.

## Handoff commands for Claude

Review first. Then, only with production authorization:

```powershell
cd C:\Projects\PaMarket
npx supabase db query --linked -f supabase/migrations/20260912123000_admin_sentry_authorization_and_evidence.sql
npx supabase db query --linked -f supabase/tests/c2e_admin_sentry_authorization_and_evidence.test.sql
npx supabase functions deploy admin-sentry-issues --use-api
```

Required live smoke checks:

1. No JWT and malformed JWT are rejected by the gateway.
2. An ordinary authenticated user receives 403 and creates one redacted `admin_sentry_access_denied` event.
3. The real `super_admin` can list issues.
4. The real `super_admin` can open one numeric issue ID.
5. Invalid methods, issue IDs, periods, and oversized/control-character queries receive fixed 4xx responses.
6. Successful list/detail evidence rows are visible through the AAL2 Security Events page.
7. No token, query text, Sentry payload, exception text, email, or authorization header appears in evidence metadata.
8. `www/admin.html` Sentry list/detail remains functional.

If production verification fails, do not deploy further C2E changes. Revert the function deployment first if necessary, then apply the paired rollback only after confirming no newer evidence event depends on the expanded allowlist.
