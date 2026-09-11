// Shared CORS handling for PaMarket Edge Functions — Stage 6 of the
// production security cleanup. One consistent production allowlist,
// instead of the same origins array (with small, undocumented drifts)
// copy-pasted into 20+ functions.
//
// Security model:
//   - CORS is a BROWSER-enforced mechanism. It only matters for requests
//     made from a web page (the website, the admin panel, or a legacy
//     Capacitor WebView). A native mobile fetch (Expo/React Native) sends
//     no Origin header and is not subject to CORS at all — the Access-
//     Control-Allow-Origin header returned here is irrelevant to it.
//   - CORS is NOT an authorization mechanism. It never replaces a
//     function's own auth/JWT/webhook-secret checks — it only controls
//     which web origins a BROWSER will let read the response. Every
//     function that needs authorization keeps its own checks unchanged;
//     this module only ever computes headers.
//   - `Access-Control-Allow-Origin` is only ever the literal requesting
//     Origin (when explicitly allowed) or a fixed fallback — never `*`,
//     since these functions accept Authorization headers.
//
// Local development origins (http://localhost:5500, http://127.0.0.1:5500)
// are NOT included in the production allowlist. They're allowed only when
// the Edge Function secret ALLOW_DEV_CORS_ORIGINS is explicitly set to
// "true" — a protected, project-level secret (set via `supabase secrets
// set` or the dashboard), never a public app_settings value, and never
// something a website/mobile/admin client can flip. It defaults to unset
// (production-safe) since this project has one Supabase deployment, not a
// separate staging project — an admin turns this on temporarily to test
// against the live project from a local dev server, then unsets it.
// An "https://admin.pamarketzw.com" entry lived here until the Stage 6
// follow-up — confirmed not a real or active PaMarket subdomain. The real
// admin panel origin is the workers.dev URL below; removing the stale
// entry doesn't affect it.
const PRODUCTION_ORIGINS = [
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
  'https://pamarket.chakusaprince.workers.dev', // the live admin panel
] as const;

// Native-app / legacy WebView origins. These are not "websites" — a
// Capacitor WebView (the app's previous shell, some installs may still be
// on it) sends a real Origin header of exactly one of these; the current
// Expo/React Native app sends no Origin header at all and isn't affected
// by this list either way. Kept unchanged from the existing per-function
// allowlists — Stage 6 does not add or remove any of these.
const NATIVE_APP_ORIGINS = ['https://localhost', 'capacitor://localhost'] as const;

// http://localhost:5173 added for C2D — Vite's default dev port, used by
// the new admin/ React app's local dev server (`npm run dev`). Same
// ALLOW_DEV_CORS_ORIGINS opt-in gate as the rest of this list; no
// production behavior change.
const DEV_ORIGINS = ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'http://localhost:5173'] as const;

function devOriginsEnabled(): boolean {
  return Deno.env.get('ALLOW_DEV_CORS_ORIGINS') === 'true';
}

export type CorsOptions = {
  /** Extra origins this specific function must keep allowing (e.g. an
   *  admin-only automation origin), on top of the shared production set.
   *  Defaults to none. */
  extraOrigins?: readonly string[];
  /** Whether this function is ever called from a Capacitor WebView /
   *  legacy native origin. Defaults to false — most functions are called
   *  either from a browser (website/admin) or from native mobile fetch
   *  (no Origin header, unaffected by this list). */
  allowNativeAppOrigins?: boolean;
  /** Extra headers this function's callers send beyond the default set
   *  (authorization, x-client-info, apikey, content-type). */
  extraHeaders?: readonly string[];
  /** HTTP methods this function accepts. Defaults to GET, POST, OPTIONS. */
  methods?: readonly string[];
};

const DEFAULT_HEADERS = ['authorization', 'x-client-info', 'apikey', 'content-type'] as const;
const DEFAULT_METHODS = ['GET', 'POST', 'OPTIONS'] as const;

// The origin used when the request's Origin isn't in any allowed set (or
// is absent, which is normal and expected for native mobile requests —
// this value is simply never inspected by anything in that case).
const FALLBACK_ORIGIN = PRODUCTION_ORIGINS[0];

function resolveAllowedOrigin(req: Request, options?: CorsOptions): string {
  const origin = req.headers.get('origin') ?? '';
  if (!origin) return FALLBACK_ORIGIN;

  const allowed = new Set<string>(PRODUCTION_ORIGINS);
  if (options?.allowNativeAppOrigins) for (const o of NATIVE_APP_ORIGINS) allowed.add(o);
  if (options?.extraOrigins) for (const o of options.extraOrigins) allowed.add(o);
  if (devOriginsEnabled()) for (const o of DEV_ORIGINS) allowed.add(o);

  return allowed.has(origin) ? origin : FALLBACK_ORIGIN;
}

// Builds the CORS response headers for a request. Call once per request
// (origin can legitimately differ between two concurrent requests) and
// spread the result into every response this function returns, including
// error responses — a blocked/failed request still needs valid CORS
// headers for the browser to let the caller read the failure body/status.
export function corsHeaders(req: Request, options?: CorsOptions): Record<string, string> {
  const allowOrigin = resolveAllowedOrigin(req, options);
  const headers = [...DEFAULT_HEADERS, ...(options?.extraHeaders ?? [])].join(', ');
  const methods = (options?.methods ?? DEFAULT_METHODS).join(', ');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': headers,
    'Access-Control-Allow-Methods': methods,
    // Tells caches/CDNs the response varies by request Origin — required
    // whenever Access-Control-Allow-Origin echoes back the caller's own
    // origin instead of a fixed value (already present on some functions;
    // now consistent everywhere that uses this module).
    'Vary': 'Origin',
  };
}

// Convenience for the standard `if (req.method === 'OPTIONS') return ...`
// preflight short-circuit every function already does.
export function handleOptions(req: Request, options?: CorsOptions): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeaders(req, options) });
}
