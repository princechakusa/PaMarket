# Stage C architecture

## Scope

Stage C keeps feature data as static fixtures while adding a production-shaped authentication boundary. Its dependency direction is:

```text
main → providers + router → layout → route pages → reusable shell components
```

`src/app` owns composition and route metadata. `src/security` resolves a Supabase session, loads the caller's role from `profiles`, and maps it to frontend permissions. `src/services` owns validated browser configuration, the one typed Supabase client, error normalization, and the dormant Edge invocation wrapper. Layouts and pages consume those boundaries. Tests live outside `src`.

Feature folders are deliberately absent until a feature migration begins. The shell does not import files from `www`, `apps/mobile`, or `supabase`.

## Security boundary

Mock mode remains the default and authorizes only the static preview. In live mode, the shell stays hidden until Supabase Auth has a session and `profiles.role` resolves to a recognized admin role. The client never trusts `user_metadata`. The connection page exposes only mode, connection state, user ID, database role, assurance level, and enabled permissions.

Auth storage uses the separate `pamarket.admin.v2.auth` key. Auth events re-read the profile role and authorization loss clears the exposed identity and access token. Route and action guards remain presentation behavior. Supabase RLS and server-side Edge Function checks remain authoritative. Stage C observes Supabase's assurance level but does not enforce MFA; privileged operations must eventually require the approved assurance level on the server and in RLS.

Only public browser configuration may ever use a `VITE_` environment variable. Server credentials and service-role keys must remain in server-managed secrets.

## Honeypot placeholder

`HoneypotField.tsx` remains a form primitive only. It is not connected to a server check and provides no security in Stage C.

Real honeypot validation must happen at the protected server endpoint. The server must not log the honeypot value or any passwords, tokens, OTP values, TOTP secrets, or sensitive field contents. Detection logic and thresholds must remain server-side. A honeypot does not replace authentication, RLS, rate limits, or Cloudflare controls. Any future Cloudflare Turnstile token must be verified server-side.

## Free-tools constraint

The build and test packages are free, open-source npm dependencies. No commercial template or component kit is used. CSS is local and requires no hosted font or asset service.

For a future Cloudflare layer, evaluate free options first: Turnstile, the applicable Cloudflare Access free allowance, Workers free-tier routing, available WAF/bot controls, and rate limiting within current plan limits. Plan limits must be rechecked at implementation time. Turnstile validation belongs server-side. Cloudflare protection cannot replace Supabase authentication, RLS, or direct API authorization.

## Future Supabase rules

The shared browser client accepts only the public project URL and browser-safe publishable key. It defaults to mock mode when configuration is absent and returns an explicit configuration state when live mode is incomplete. Feature modules will own generated database types and queries; no feature query exists in Stage C. The Edge wrapper requires the current session JWT, supports cancellation and timeout, and normalizes errors. It is not called by the shell.

## Build isolation

`admin/package.json`, lockfile, TypeScript configuration, tests, and Vite output are local to this folder. `npm run build` writes only `admin/dist`. Stage C does not modify root scripts, public allowlists, GitHub workflows, `admin-build.sh`, existing deployment routes, the legacy admin, website, mobile app, or Supabase resources.
