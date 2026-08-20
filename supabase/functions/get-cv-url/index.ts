// get-cv-url — the ONLY authorized way to read a candidate's private CV.
//
// Replaces the old model where a candidate's CV lived at a permanent public
// R2 URL stored directly in profiles.cv_file_url. CVs are now uploaded to
// the private `cv-files` Supabase Storage bucket (see
// 202608190005_lock_down_cv_files_bucket.sql) and referenced by
// profiles.cv_file_path — an internal object path, never a URL. This
// function is the only thing that turns that path into something openable,
// and only after checking the caller is actually allowed to see it.
//
// Authorization (matches the CV security review's stated rule — no parallel
// permission system, reuses the existing applications table):
//   A. caller requests their own CV (candidateId omitted, or === caller id)
//   B. caller owns the real listings row for jobId and that job has an
//      application from candidateId. applications.employer_id is not trusted.
//   C. caller has role in (admin, moderator)
// Everyone else: 403.
//
// The caller never supplies a storage path directly — only a candidateId
// (+ jobId for the employer case). The path is looked up server-side from
// profiles.cv_file_path, so there is no way to request an arbitrary path
// to be signed.
//
// Rate limited (30 requests / 5 min per authenticated caller) using the
// same generic amos_manual_trigger_log/checkAmosRateLimit pattern already
// used for get-r2-upload-url and the AMOS admin functions — this protects
// against automated CV harvesting by a scripted "employer" account without
// affecting normal recruiting workflows (30 distinct CV opens in 5 minutes
// is far beyond any real reviewing pace).
//
// Deploy: supabase functions deploy get-cv-url
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
  'https://admin.pamarketzw.com',
  'https://pamarket.chakusaprince.workers.dev',
  'https://pamarket.app',
  'https://www.pamarket.app',
  'com.pamarket.app',
  'https://localhost',
  'capacitor://localhost',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://pamarketzw.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

// Short-lived by design — this is a sensitive personal document. 5 minutes
// is enough for a mobile client to open the returned URL immediately; it is
// never persisted or reused past that window.
const SIGNED_URL_TTL_SECONDS = 300
const RATE_LIMIT = { windowMinutes: 5, maxCalls: 30 }

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (data: unknown, status?: number) =>
    new Response(JSON.stringify(data), { status: status || 200, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ error: 'Unauthorized' }, 401)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )
    const { data: { user }, error: authErr } = await sb.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    // Service-role client for the actual profile lookup + signed-URL
    // generation — deliberately bypasses RLS, because this function IS the
    // authorized access path (equivalent to a SECURITY DEFINER RPC). It is
    // never exposed to the client; only this server-side code holds it.
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const rate = await checkAmosRateLimit(db, 'get-cv-url', user.id, RATE_LIMIT)
    if (!rate.allowed) return json({ error: `Too many CV requests — try again in ${rate.retryAfterSeconds}s` }, 429)

    const body = await req.json().catch(() => ({}))
    const candidateId = typeof body['candidateId'] === 'string' && body['candidateId'] ? body['candidateId'] : user.id
    const jobId = typeof body['jobId'] === 'string' ? body['jobId'] : null

    let authorized = candidateId === user.id // (A) self

    if (!authorized) {
      const profileRes = await db.from('profiles').select('role').eq('id', user.id).single()
      if (profileRes.data && ['admin', 'moderator'].includes(profileRes.data['role'])) {
        authorized = true // (C) admin/moderator
      }
    }

    if (!authorized) {
      if (!jobId) return json({ error: 'Forbidden' }, 403)
      // (B) Prove the application and the real job owner independently.
      const appRes = await db
        .from('applications')
        .select('job_id')
        .eq('applicant_id', candidateId)
        .eq('job_id', jobId)
        .limit(1)
        .maybeSingle()
      if (appRes.data) {
        const jobRes = await db
          .from('listings')
          .select('id')
          .eq('id', appRes.data['job_id'])
          .eq('seller_id', user.id)
          .limit(1)
          .maybeSingle()
        authorized = Boolean(jobRes.data)
      }
    }

    if (!authorized) return json({ error: 'Forbidden' }, 403)

    const profileRes = await db.from('profiles').select('cv_file_path').eq('id', candidateId).maybeSingle()
    const path = profileRes.data?.['cv_file_path'] as string | null | undefined
    if (!path) return json({ ok: false, reason: 'no_cv' })

    const signRes = await db.storage.from('cv-files').createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (signRes.error || !signRes.data?.signedUrl) {
      return json({ ok: false, reason: 'sign_failed' })
    }

    return json({ ok: true, url: signRes.data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    return json({ error: msg }, 500)
  }
})
