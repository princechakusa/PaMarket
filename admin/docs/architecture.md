# Stage B architecture

## Scope

Stage B is a frontend shell with static fixtures. Its dependency direction is:

```text
main → providers + router → layout → route pages → reusable shell components
```

`src/app` owns application composition, navigation metadata, and the mock environment descriptor. `src/layouts` owns page chrome. `src/components` owns reusable shell and feedback UI. `src/pages` owns small route views. `src/security` contains placeholders whose names make their non-production status clear. Tests live outside `src`.

Feature folders are deliberately absent until a feature migration begins. The shell does not import files from `www`, `apps/mobile`, or `supabase`.

## Security boundary

The mock identity, role, permissions, environment badge, and session time are display fixtures. They authorize nothing. No Supabase client, authentication call, service-role key, token storage, audit logger, custom MFA logic, or production API exists in this folder.

Future authentication must use a separate browser storage namespace, clear cached privileged data on authorization loss, and treat route guards as presentation behavior. Supabase RLS and server-side Edge Function role checks remain authoritative. Privileged operations must verify the caller and any required MFA assurance on the server and produce durable audit outcomes.

Only public browser configuration may ever use a `VITE_` environment variable. Server credentials and service-role keys must remain in server-managed secrets.

## Honeypot placeholder

`HoneypotField.tsx` is a visual/form primitive only. It is not connected to a form and provides no security in Stage B.

Later validation must happen at the protected server endpoint using a short-lived, action-bound challenge. The server must not log passwords, tokens, OTP values, TOTP secrets, or sensitive field contents. It should record only minimized signals, provide a safe retry or step-up path for legitimate users, and apply an approved retention policy. Detection logic and thresholds must remain server-side. Honeypots supplement authentication, rate limiting, Cloudflare controls, and RLS.

## Free-tools constraint

The build and test packages are free, open-source npm dependencies. No commercial template or component kit is used. CSS is local and requires no hosted font or asset service.

For a future Cloudflare layer, evaluate free options first: Turnstile, the applicable Cloudflare Access free allowance, Workers free-tier routing, available WAF/bot controls, and rate limiting within current plan limits. Plan limits must be rechecked at implementation time. Turnstile validation belongs server-side. Cloudflare protection cannot replace Supabase authentication, RLS, or direct API authorization.

## Future Supabase rules

Stage C must begin with current deployed-policy verification and an approved permission matrix. Add one shared browser client using only the public project URL and publishable/anon key. Feature modules should own typed queries, while a shared transport normalizes cancellation and safe errors. Reads use the signed-in user's JWT and RLS. Sensitive multi-step changes should use server-authoritative operations with traceable outcomes; no browser-held service-role key is permitted.

## Build isolation

`admin/package.json`, lockfile, TypeScript configuration, tests, and Vite output are local to this folder. `npm run build` writes only `admin/dist`. Stage B does not modify root scripts, public allowlists, GitHub workflows, `admin-build.sh`, or existing deployment routes.
