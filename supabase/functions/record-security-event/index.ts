// record-security-event — the ONLY way security_events rows are written.
// Supports two callers:
//   - a pre-authentication browser (login form): only the fixed
//     'admin_login_honeypot' / 'admin_login_failed' event types, no
//     Authorization header required.
//   - an authenticated admin session (post-login / MFA / logout): the
//     browser sends its own access token; this function verifies it with
//     Supabase Auth and derives actor id/role/aal itself — it never
//     trusts anything about identity from the request JSON.
//
// Deploy: supabase functions deploy record-security-event --no-verify-jwt
//   (the gateway must not reject unauthenticated requests outright — the
//   unauthenticated login-security event types are intentionally allowed
//   before a session exists. Every event type that needs identity is
//   still rejected inside this function, per EVENT_CONFIG below, if no
//   valid session is presented.)
//
// What this function does NOT do:
//   - it never stores the honeypot's entered value, a password, an OTP, a
//     TOTP secret, a QR payload, an access/refresh token, or raw request
//     headers;
//   - it never accepts actor identity, role, assurance level, IP,
//     user agent, or a timestamp from the request body — only from
//     server-verified sources (the JWT, and this function's own header
//     reads);
//   - it never echoes stored data back to the caller beyond a bare
//     {ok:true} — see the response builder at the bottom.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders as sharedCorsHeaders } from '../_shared/cors.ts'

function corsHeaders(req: Request) {
  return sharedCorsHeaders(req, { extraHeaders: ['x-request-start'] })
}

// ── Fixed, server-owned event configuration ─────────────────────────────
// The client only ever says WHICH of these happened (plus a small bounded
// set of optional fields below) — severity, action, and outcome are never
// accepted from the request; they are looked up here. This removes an
// entire class of forgery (a caller cannot claim a false outcome/severity
// for a real event type, and cannot invent a new event type at all).
type EventConfig = {
  severity: 'info' | 'notice' | 'warning' | 'high' | 'critical'
  action: string
  outcome: 'success' | 'failure' | 'blocked' | 'suspicious'
  requiresAuth: boolean
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  admin_login_honeypot:          { severity: 'high',   action: 'login',         outcome: 'blocked', requiresAuth: false },
  admin_login_failed:            { severity: 'notice', action: 'login',         outcome: 'failure', requiresAuth: false },
  admin_login_succeeded:         { severity: 'info',   action: 'login',         outcome: 'success', requiresAuth: true },
  admin_mfa_challenge_failed:    { severity: 'notice', action: 'mfa_challenge', outcome: 'failure', requiresAuth: true },
  admin_mfa_challenge_succeeded: { severity: 'info',   action: 'mfa_challenge', outcome: 'success', requiresAuth: true },
  admin_logout:                  { severity: 'info',   action: 'logout',        outcome: 'success', requiresAuth: true },
}

// Safe, pre-mapped reason codes only — never a raw Supabase/Postgres error
// message, which can leak internal detail (column names, whether an
// account exists, etc.).
const ALLOWED_REASON_CODES = new Set([
  'invalid_credentials', 'unknown_account', 'account_locked',
  'invalid_code', 'expired_code', 'no_verified_factor',
  'session_expired', 'unexpected_error',
])

// A tiny, explicit metadata allowlist per event type — never an arbitrary
// client-supplied object. Anything else is dropped before it ever reaches
// the database (the writer function redacts a prohibited-key list too;
// this is the first, narrower filter).
const ALLOWED_METADATA_KEYS: Record<string, readonly string[]> = {
  admin_mfa_challenge_failed: ['factor_type'],
  admin_mfa_challenge_succeeded: ['factor_type'],
}

const MAX_BODY_BYTES = 4 * 1024 // 4 KB — this endpoint only ever needs a few short fields
const REQUEST_TIMEOUT_MS = 8_000

function json(cors: Record<string, string>, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Only Cloudflare's own header is treated as verified client IP — this
// project sits behind Cloudflare (see admin-login-guard), which sets
// CF-Connecting-IP itself and does not let a client override it.
// X-Forwarded-For/X-Real-Ip are NOT trusted here: unlike
// admin-login-guard's login-lockout use (a rate-limit signal, not
// evidence), this endpoint writes to the evidence table, so an unverified
// forwarded value is never presented as a confirmed IP — it is stored as
// NULL with ip_source describing why.
function verifiedIp(req: Request): { ip: string | null; source: string } {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf && cf.trim()) return { ip: cf.trim(), source: 'cf-connecting-ip' }
  return { ip: null, source: 'unavailable' }
}

function normalizedUserAgent(req: Request): string | null {
  const ua = req.headers.get('user-agent')
  if (!ua) return null
  return ua.slice(0, 300)
}

// Decodes the `aal` claim from an already-verified JWT. Only ever called
// after getUser(jwt) has confirmed the token is genuinely signed by
// Supabase Auth for this project — decoding here does not itself verify
// the signature, it just reads a claim out of a token we already trust.
function decodeAal(jwt: string): 'aal1' | 'aal2' | null {
  try {
    const payloadSegment = jwt.split('.')[1]
    if (!payloadSegment) return null
    const padded = payloadSegment.replace(/-/g, '+').replace(/_/g, '/').padEnd(payloadSegment.length + (4 - (payloadSegment.length % 4)) % 4, '=')
    const payload = JSON.parse(atob(padded))
    return payload.aal === 'aal2' ? 'aal2' : payload.aal === 'aal1' ? 'aal1' : null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(cors, { error: 'method_not_allowed' }, 405)

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return json(cors, { error: 'unsupported_media_type' }, 415)
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return json(cors, { error: 'payload_too_large' }, 413)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS)

  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) return json(cors, { error: 'payload_too_large' }, 413)

    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody)
    } catch {
      return json(cors, { error: 'invalid_json' }, 400)
    }
    // The raw body is never logged, stored, or forwarded beyond the
    // narrow fields read below — this is the only place it is touched.

    const eventType = typeof body['eventType'] === 'string' ? body['eventType'] : ''
    const config = EVENT_CONFIG[eventType]
    if (!config) return json(cors, { error: 'unsupported_event_type' }, 400)

    const reasonCodeRaw = typeof body['reasonCode'] === 'string' ? body['reasonCode'] : null
    const reasonCode = reasonCodeRaw && ALLOWED_REASON_CODES.has(reasonCodeRaw) ? reasonCodeRaw : null

    const correlationIdRaw = typeof body['correlationId'] === 'string' ? body['correlationId'] : null
    const correlationId = correlationIdRaw && /^[0-9a-f-]{36}$/i.test(correlationIdRaw) ? correlationIdRaw : null

    const allowedMetaKeys = ALLOWED_METADATA_KEYS[eventType] ?? []
    const metadata: Record<string, unknown> = {}
    if (allowedMetaKeys.length > 0 && body['metadata'] && typeof body['metadata'] === 'object') {
      const rawMeta = body['metadata'] as Record<string, unknown>
      for (const key of allowedMetaKeys) {
        if (typeof rawMeta[key] === 'string' && rawMeta[key].length <= 64) metadata[key] = rawMeta[key]
      }
    }

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // ── Identity: server-verified only, never trusted from the body ────
    let actorUserId: string | null = null
    let actorRole: string | null = null
    let actorAuthenticated = false
    let assuranceLevel: 'aal1' | 'aal2' | null = null

    const authHeader = req.headers.get('authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (jwt) {
      const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userResult, error: userErr } = await anon.auth.getUser(jwt)
      if (!userErr && userResult?.user) {
        actorUserId = userResult.user.id
        actorAuthenticated = true
        assuranceLevel = decodeAal(jwt)
        const { data: profile } = await db.from('profiles').select('role').eq('id', actorUserId).maybeSingle()
        actorRole = profile?.role ?? null
      }
    }

    if (config.requiresAuth && !actorAuthenticated) {
      // A generic, unrevealing failure — do not distinguish "bad token"
      // from "unsupported event" in the response.
      return json(cors, { error: 'authentication_required' }, 401)
    }

    const { ip, source: ipSource } = verifiedIp(req)
    const userAgent = normalizedUserAgent(req)
    const url = new URL(req.url)

    // Server-generated idempotency key: collapses repeated submissions of
    // the same event from the same (best-effort) network identity within
    // a 5-minute bucket into a single stored row via the writer's
    // ON CONFLICT DO NOTHING — this is this endpoint's primary
    // deduplication/abuse-bounding control, backed by Supabase Auth's own
    // existing rate limiting on the underlying signInWithPassword calls.
    const bucket = Math.floor(Date.now() / (5 * 60_000))
    const keyIdentity = actorUserId ?? ip ?? 'unknown'
    const eventKey = `${eventType}:${keyIdentity}:${bucket}`

    const { data, error } = await db.rpc('record_security_event', {
      p_event_type: eventType,
      p_severity: config.severity,
      p_source: 'edge_function',
      p_actor_user_id: actorUserId,
      p_actor_role: actorRole,
      p_actor_authenticated: actorAuthenticated,
      p_assurance_level: assuranceLevel,
      p_target_type: null,
      p_target_id: null,
      p_action: config.action,
      p_outcome: config.outcome,
      p_reason_code: reasonCode,
      p_correlation_id: correlationId,
      p_request_path: url.pathname,
      p_request_method: req.method,
      p_ip_address: ip,
      p_ip_source: ipSource,
      p_user_agent: userAgent,
      p_event_key: eventKey,
      p_metadata: metadata,
    })

    if (error) {
      // Never forward the raw Postgres error to the caller (may name
      // columns/constraints); never a stack trace. Logged server-side
      // only, with no request body or secret material.
      console.error('record-security-event: writer error', error.code ?? 'unknown')
      return json(cors, { error: 'not_recorded' }, 500)
    }

    // Deliberately minimal — never returns the stored IP, metadata, or
    // any other private field, even to an authenticated caller.
    return json(cors, { ok: true, status: data?.[0]?.status === 'duplicate' ? 'duplicate' : 'recorded' })
  } catch (err: unknown) {
    const timedOut = controller.signal.aborted && controller.signal.reason === 'timeout'
    console.error('record-security-event: unexpected failure', timedOut ? 'timeout' : (err instanceof Error ? err.name : 'unknown'))
    return json(cors, { error: timedOut ? 'timeout' : 'internal_error' }, timedOut ? 504 : 500)
  } finally {
    clearTimeout(timeout)
  }
})
