# Stage C2E-2, R2 privileged upload hardening

## Status

Prepared on current `master` state `dc1219c`. This stage is not applied to Supabase and the Edge Function is not deployed by Codex.

## Scope

The change hardens `get-r2-upload-url`, which issues signed Cloudflare R2 URLs. It does not change the mobile app, public website, `www/admin.html`, storage keys already in use, or the existing C2E Sentry implementation.

Privileged namespaces now use an explicit server-side role allowlist:

- `ads/` upload URLs: `admin` or `super_admin`
- `amos/manual-media/` upload URLs: `admin` or `super_admin`
- any-user verification read: `admin` or `super_admin`
- own verification read: any authenticated owner, unchanged

The server loads the caller’s role from `profiles` after verifying the JWT. Browser-supplied role or permission values are never trusted. Specialist roles remain denied for privileged namespaces.

## Preserved user paths

The following paths retain their existing authenticated-user ownership checks and are not routed through the admin role gate:

`listings/{user}/`, `chat/{user}/`, `cv/{user}/`, `verification/{user}/`, `profiles/{user}/`, `rentals/{user}/`, and owned `businesses/{businessId}/`.

The existing content-type, size, random server-generated object key, PDF restriction, rate limits, private verification behavior, CORS origins, and R2 signing behavior remain unchanged.

## Evidence events

The forward migration extends the service-role-only `record_security_event` allowlist with:

- `admin_r2_access_denied`
- `admin_r2_upload_issued`
- `admin_r2_verification_read_issued`

The function records only namespace-level operations. It does not record the caller’s requested object key, signed URL, R2 credentials, file name, file contents, query text, or authorization header. IP attribution uses only `CF-Connecting-IP`, matching C2D.

Evidence writes are five-minute idempotent and failure-isolated. A logging failure never causes a signed URL to be returned to the wrong role, and it does not expose a database error to the caller.

## Tests and handoff

The admin suite on the current master passed previously at 87/87, with typecheck, lint, build, and audit clean. The new SQL test must be run after applying the forward migration. Edge syntax should be checked with the Supabase/Deno toolchain available on the Windows machine.

Claude handoff order:

```powershell
cd C:\Projects\PaMarket
npx supabase db query --linked -f supabase/migrations/20260912153000_r2_admin_evidence_events.sql
npx supabase db query --linked -f supabase/tests/c2e2_r2_admin_upload_authorization.test.sql
npx supabase functions deploy get-r2-upload-url --use-api
```

Required live checks:

1. `super_admin` can request an `ads/` upload URL and an AMOS media upload URL.
2. `super_admin` can read a verification document URL.
3. The legacy admin can still upload ads and AMOS media.
4. A normal user and every specialist role receive 403 for `ads/` and `amos/manual-media/`.
5. A normal user can still upload and read only their own user-scoped paths.
6. A user cannot read another user’s verification document.
7. Evidence rows appear for privileged success and denied requests, with no object key or signed URL in metadata.
8. CORS preflight and the existing approved origins remain functional.

Do not remove `https://pamarket.app` or `https://www.pamarket.app` in this stage. That requires the separate origin decision already recorded in the C2 plan.
