import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders as sharedCorsHeaders } from '../_shared/cors.ts'

function corsHeaders(req: Request) {
  return sharedCorsHeaders(req, { allowNativeAppOrigins: false, extraOrigins: ['https://pamarket.app', 'https://www.pamarket.app'] })
}

// Admin-only proxy onto the Sentry API — the Sentry auth token lives only
// as an edge function secret, never shipped to any client. admin.html calls
// this instead of talking to Sentry directly. See
// project_fabric_navigation_crash memory for the org slug ("pamarket", not
// "pamrk") and how this was first done manually via the API.
Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (d: unknown, s?: number) => new Response(JSON.stringify(d), { status: s || 200, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await sb.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const token = Deno.env.get('SENTRY_AUTH_TOKEN')
    const org = Deno.env.get('SENTRY_ORG') || 'pamarket'
    const project = Deno.env.get('SENTRY_PROJECT') || 'react-native'
    if (!token) return json({ error: 'Sentry not configured' }, 500)

    const url = new URL(req.url)
    const issueId = url.searchParams.get('issueId')

    if (issueId) {
      // Single issue detail — stack trace + device/app context, for the
      // "view details" drill-down.
      const res = await fetch(
        `https://sentry.io/api/0/organizations/${org}/issues/${encodeURIComponent(issueId)}/events/latest/`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) return json({ error: 'Sentry API error', status: res.status }, 502)
      const ev = await res.json()
      const exceptionEntry = (ev.entries || []).find((e: any) => e.type === 'exception')
      const firstException = exceptionEntry?.data?.values?.[0]
      return json({
        title: ev.title,
        platform: ev.platform,
        app: ev.contexts?.app || null,
        device: ev.contexts?.device || null,
        tags: ev.tags || [],
        exception: firstException
          ? {
              type: firstException.type,
              value: firstException.value,
              frames: (firstException.stacktrace?.frames || [])
                .slice()
                .reverse()
                .slice(0, 30)
                .map((f: any) => ({ module: f.module, function: f.function, filename: f.filename, lineno: f.lineno })),
            }
          : null,
      })
    }

    // Issue list — the overview panel.
    const statsPeriod = url.searchParams.get('statsPeriod') || '14d'
    const query = url.searchParams.get('query') || 'is:unresolved'
    const res = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?statsPeriod=${encodeURIComponent(statsPeriod)}&sort=date&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return json({ error: 'Sentry API error', status: res.status }, 502)
    const issues = await res.json()
    return json({
      issues: (Array.isArray(issues) ? issues : []).map((i: any) => ({
        id: i.id,
        shortId: i.shortId,
        title: i.title,
        culprit: i.culprit,
        level: i.level,
        count: i.count,
        userCount: i.userCount,
        firstSeen: i.firstSeen,
        lastSeen: i.lastSeen,
        permalink: i.permalink,
      })),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    return json({ error: msg }, 500)
  }
})
