import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders as sharedCorsHeaders } from '../_shared/cors.ts'

type JsonObject = Record<string, unknown>
type AssuranceLevel = 'aal1' | 'aal2' | 'unknown'

const ALLOWED_STATS_PERIODS = new Set(['24h', '7d', '14d', '30d'])
const ERROR_VIEWER_ROLES = new Set(['admin', 'super_admin'])
const REQUEST_TIMEOUT_MS = 8_000
const MAX_QUERY_LENGTH = 200

function corsHeaders(req: Request) {
  // Preserved until the separate C2E CORS-origin decision is approved.
  return sharedCorsHeaders(req, {
    allowNativeAppOrigins: false,
    extraOrigins: ['https://pamarket.app', 'https://www.pamarket.app'],
  })
}

function json(cors: Record<string, string>, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function boundedString(value: unknown, maxLength = 500): string | null {
  return typeof value === 'string' ? value.slice(0, maxLength) : null
}

function boundedNumberString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && /^\d{1,20}$/.test(value)) return value
  return null
}

function decodeVerifiedAal(jwt: string): AssuranceLevel {
  try {
    const segment = jwt.split('.')[1]
    if (!segment) return 'unknown'
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(segment.length + (4 - segment.length % 4) % 4, '=')
    const payload = JSON.parse(atob(padded)) as JsonObject
    return payload['aal'] === 'aal2' ? 'aal2' : payload['aal'] === 'aal1' ? 'aal1' : 'unknown'
  } catch {
    return 'unknown'
  }
}

function requestIp(req: Request): { address: string | null; source: string } {
  const cloudflareIp = req.headers.get('cf-connecting-ip')?.trim()
  return cloudflareIp
    ? { address: cloudflareIp, source: 'cf-connecting-ip' }
    : { address: null, source: 'unavailable' }
}

function safeSentryLink(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || (url.hostname !== 'sentry.io' && !url.hostname.endsWith('.sentry.io'))) return null
    return url.toString()
  } catch {
    return null
  }
}

function sanitizeTags(value: unknown) {
  const allowed = new Set(['environment', 'release', 'dist', 'level', 'platform', 'device', 'device.family', 'os', 'os.name', 'os.version'])
  if (!Array.isArray(value)) return []
  return value
    .map(asObject)
    .filter((tag) => {
      const key = tag['key']
      return typeof key === 'string' && allowed.has(key)
    })
    .slice(0, 20)
    .map((tag) => ({ key: boundedString(tag['key'], 64), value: boundedString(tag['value'], 200) }))
}

function sanitizeContext(value: unknown, allowedKeys: readonly string[]) {
  const source = asObject(value)
  return Object.fromEntries(
    allowedKeys
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, typeof source[key] === 'boolean' || typeof source[key] === 'number' ? source[key] : boundedString(source[key], 200)]),
  )
}

function sanitizeIssueList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).map((entry) => {
    const issue = asObject(entry)
    return {
      id: boundedNumberString(issue['id']),
      shortId: boundedString(issue['shortId'], 64),
      title: boundedString(issue['title'], 500),
      culprit: boundedString(issue['culprit'], 500),
      level: boundedString(issue['level'], 32),
      count: boundedNumberString(issue['count']),
      userCount: boundedNumberString(issue['userCount']),
      firstSeen: boundedString(issue['firstSeen'], 64),
      lastSeen: boundedString(issue['lastSeen'], 64),
      permalink: safeSentryLink(issue['permalink']),
    }
  })
}

function sanitizeIssueDetail(value: unknown) {
  const event = asObject(value)
  const entries = Array.isArray(event['entries']) ? event['entries'].map(asObject) : []
  const exceptionEntry = entries.find((entry) => entry['type'] === 'exception')
  const exceptionData = asObject(exceptionEntry?.['data'])
  const exceptionValues = Array.isArray(exceptionData['values']) ? exceptionData['values'].map(asObject) : []
  const firstException = exceptionValues[0]
  const stacktrace = asObject(firstException?.['stacktrace'])
  const frames = Array.isArray(stacktrace['frames']) ? stacktrace['frames'].map(asObject) : []
  const contexts = asObject(event['contexts'])

  return {
    title: boundedString(event['title'], 500),
    platform: boundedString(event['platform'], 64),
    app: sanitizeContext(contexts['app'], ['app_identifier', 'app_name', 'app_version', 'app_build', 'app_start_time']),
    device: sanitizeContext(contexts['device'], ['name', 'family', 'model', 'model_id', 'manufacturer', 'brand', 'arch', 'orientation', 'simulator', 'memory_size', 'free_memory', 'low_memory', 'charging', 'battery_level', 'online']),
    tags: sanitizeTags(event['tags']),
    exception: firstException
      ? {
          type: boundedString(firstException['type'], 200),
          value: boundedString(firstException['value'], 2_000),
          frames: frames.slice().reverse().slice(0, 30).map((frame) => ({
            module: boundedString(frame['module'], 300),
            function: boundedString(frame['function'], 300),
            filename: boundedString(frame['filename'], 500),
            lineno: typeof frame['lineno'] === 'number' ? frame['lineno'] : null,
          })),
        }
      : null,
  }
}

async function fetchSentry(url: string, token: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

// `admin` and `super_admin` are the current server-side mapping for the
// UI permission `errors.view`. Browser metadata is never trusted here.
Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET') return json(cors, { error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json(cors, { error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(cors, { error: 'service_unavailable' }, 503)

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const db = createClient(supabaseUrl, serviceRoleKey)
  const { data: userResult, error: authError } = await userClient.auth.getUser(jwt)
  const user = userResult?.user
  if (authError || !user) return json(cors, { error: 'unauthorized' }, 401)

  const assuranceLevel = decodeVerifiedAal(jwt)
  const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const actorRole = typeof profile?.role === 'string' ? profile.role : null
  const url = new URL(req.url)
  const issueId = url.searchParams.get('issueId')
  const operation = issueId ? 'detail' : 'list'
  const { address: ipAddress, source: ipSource } = requestIp(req)
  const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null

  const recordEvidence = async (eventType: string, outcome: 'success' | 'failure' | 'blocked', reasonCode: string | null) => {
    const bucket = Math.floor(Date.now() / (5 * 60_000))
    const eventKey = `${eventType}:${user.id}:${issueId ?? 'list'}:${outcome}:${bucket}`
    const { error } = await db.rpc('record_security_event', {
      p_event_type: eventType,
      p_severity: outcome === 'blocked' ? 'warning' : outcome === 'failure' ? 'notice' : 'info',
      p_source: 'edge_function',
      p_actor_user_id: user.id,
      p_actor_role: actorRole,
      p_actor_authenticated: true,
      p_assurance_level: assuranceLevel,
      p_target_type: issueId ? 'sentry_issue' : null,
      p_target_id: issueId,
      p_action: 'errors_view',
      p_outcome: outcome,
      p_reason_code: reasonCode,
      p_correlation_id: null,
      p_request_path: url.pathname,
      p_request_method: req.method,
      p_ip_address: ipAddress,
      p_ip_source: ipSource,
      p_user_agent: userAgent,
      p_event_key: eventKey,
      p_metadata: { operation },
    })
    if (error) console.error('admin-sentry-issues: evidence write failed', error.code ?? 'unknown')
  }

  if (profileError || !actorRole || !ERROR_VIEWER_ROLES.has(actorRole)) {
    await recordEvidence('admin_sentry_access_denied', 'blocked', 'insufficient_role')
    return json(cors, { error: 'forbidden' }, 403)
  }

  if (issueId !== null && !/^\d{1,32}$/.test(issueId)) return json(cors, { error: 'invalid_issue_id' }, 400)

  const token = Deno.env.get('SENTRY_AUTH_TOKEN')
  const org = Deno.env.get('SENTRY_ORG') || 'pamarket'
  const project = Deno.env.get('SENTRY_PROJECT') || 'react-native'
  if (!token) return json(cors, { error: 'service_unavailable' }, 503)

  try {
    if (issueId) {
      const response = await fetchSentry(
        `https://sentry.io/api/0/organizations/${encodeURIComponent(org)}/issues/${encodeURIComponent(issueId)}/events/latest/`,
        token,
      )
      if (!response.ok) {
        await recordEvidence('admin_sentry_issue_viewed', 'failure', 'upstream_unavailable')
        return json(cors, { error: 'upstream_unavailable' }, 502)
      }
      const payload = sanitizeIssueDetail(await response.json())
      await recordEvidence('admin_sentry_issue_viewed', 'success', null)
      return json(cors, payload)
    }

    const statsPeriod = url.searchParams.get('statsPeriod') || '14d'
    const query = url.searchParams.get('query') || 'is:unresolved'
    if (!ALLOWED_STATS_PERIODS.has(statsPeriod)) return json(cors, { error: 'invalid_stats_period' }, 400)
    if (query.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(query)) return json(cors, { error: 'invalid_query' }, 400)

    const response = await fetchSentry(
      `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?statsPeriod=${encodeURIComponent(statsPeriod)}&sort=date&query=${encodeURIComponent(query)}`,
      token,
    )
    if (!response.ok) {
      await recordEvidence('admin_sentry_issues_listed', 'failure', 'upstream_unavailable')
      return json(cors, { error: 'upstream_unavailable' }, 502)
    }
    const issues = sanitizeIssueList(await response.json())
    await recordEvidence('admin_sentry_issues_listed', 'success', null)
    return json(cors, { issues })
  } catch (error: unknown) {
    console.error('admin-sentry-issues: request failed', error instanceof Error ? error.name : 'unknown')
    await recordEvidence(issueId ? 'admin_sentry_issue_viewed' : 'admin_sentry_issues_listed', 'failure', 'unexpected_error')
    return json(cors, { error: 'service_unavailable' }, 503)
  }
})
