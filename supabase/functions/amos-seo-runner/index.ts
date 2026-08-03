import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

// Deploy:  supabase functions deploy amos-seo-runner --no-verify-jwt
//
// AMOS Module 7 — SEO.
//
// Writes into amos_seo_recommendations (Module 0's schema, unchanged).
// Every recommendation here comes from directly inspecting real
// PaMarket data (active listings missing titles/descriptions/photos,
// thin categories) — nothing requires Google Analytics or Search
// Console, and neither is connected in this project (checked: no
// GOOGLE_ANALYTICS/GSC/GA4 secret exists). Keyword-type recommendations
// (which DO need GSC's query data to be meaningful — "what are people
// searching that finds this page") are explicitly left unimplemented
// rather than faked; the recommendation_type enum already has 'keyword'
// reserved for when that connection exists.
//
// Recommendations are idempotent per (page_type, page_ref,
// recommendation_type): re-running the same day doesn't create
// duplicates of an already-open recommendation for the same page/issue.
//
// Same dual-auth + rate-limit pattern as every other amos-* function.

const ALLOWED_ORIGINS = new Set([
  'https://pamarketzw.com',
  'https://www.pamarketzw.com',
  'https://admin.pamarketzw.com',
  'https://pamarket.chakusaprince.workers.dev',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://pamarketzw.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-automation-secret',
    'Vary': 'Origin',
  }
}

const ADMIN_TEAM_ROLES = new Set(['super_admin', 'admin', 'moderator', 'support', 'finance'])
const MIN_TITLE_LENGTH = 15
const MIN_DESCRIPTION_LENGTH = 40
const THIN_CATEGORY_THRESHOLD = 3
const MAX_RECOMMENDATIONS_PER_RUN = 200

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const startedAt = Date.now()
  const projectUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(projectUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let triggeredBy: { actorId: string | null; actorEmail: string | null; actorRole: string } = {
    actorId: null, actorEmail: null, actorRole: 'system',
  }

  const configuredSecret = Deno.env.get('AUTOMATION_SECRET') || ''
  const suppliedSecret = req.headers.get('x-automation-secret') || ''
  const cronAuthOk = !!configuredSecret && suppliedSecret === configuredSecret

  if (!cronAuthOk) {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorized automation request' }, 401)

    const { data: userData, error: userError } = await db.auth.getUser(token)
    if (userError || !userData?.user) return json({ error: 'Unauthorized automation request' }, 401)

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('role, email')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (profileError || !profile || !ADMIN_TEAM_ROLES.has(profile.role)) {
      return json({ error: 'Unauthorized automation request' }, 401)
    }

    triggeredBy = { actorId: userData.user.id, actorEmail: profile.email || userData.user.email || null, actorRole: profile.role }

    const rate = await checkAmosRateLimit(db, 'amos-seo-runner', userData.user.id, { windowMinutes: 10, maxCalls: 5 })
    if (!rate.allowed) return json({ error: `Too many manual runs — try again in ${rate.retryAfterSeconds}s` }, 429)
  }

  const summary = { recommendations_written: 0, listings_scanned: 0, errors: [] as string[] }

  // Production Readiness Audit, High #2 fix: batch, not N+1. The old
  // upsertRecommendation() ran one SELECT (idempotency check) plus a
  // possible INSERT per issue found, per listing — up to 1,500 round
  // trips for a 500-listing scan, against a table (amos_seo_recommendations)
  // that until this same remediation pass had no supporting index either
  // (idx_amos_seo_page, added in AMOS_AUDIT_REMEDIATION.sql). Now: one
  // query loads every currently-open recommendation once, the scan loop
  // only does in-memory Set lookups, and every new recommendation is
  // queued into an array for a single batch insert at the end.
  const { data: existingOpen, error: existingError } = await db
    .from('amos_seo_recommendations')
    .select('page_type, page_ref, recommendation_type')
    .eq('status', 'open')
  if (existingError) {
    summary.errors.push('Could not load existing recommendations: ' + existingError.message)
  }
  const existingKeys = new Set(
    (existingOpen || []).map((r) => `${r.page_type}|${r.page_ref}|${r.recommendation_type}`)
  )

  type NewRecommendation = { page_type: string; page_ref: string; recommendation_type: string; current_value: string | null; suggested_value: string; impact_estimate: string }
  const toInsert: NewRecommendation[] = []
  const queueRecommendation = (opts: { pageType: string; pageRef: string; recType: string; current: string | null; suggested: string; impact: string }) => {
    const key = `${opts.pageType}|${opts.pageRef}|${opts.recType}`
    if (existingKeys.has(key)) return
    existingKeys.add(key) // prevents queuing the same (page, issue) twice within this same run too
    toInsert.push({
      page_type: opts.pageType, page_ref: opts.pageRef, recommendation_type: opts.recType,
      current_value: opts.current, suggested_value: opts.suggested, impact_estimate: opts.impact,
    })
  }

  try {
    // ── Listing-level issues: missing/short title, missing/short
    //    description, missing photos — all directly hurt both on-page
    //    SEO and conversion, and are 100% inspectable without any
    //    external API. ─────────────────────────────────────────────────
    const { data: listings, error: listingsError } = await db
      .from('listings')
      .select('id, title, description, photos, category')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(500)
    if (listingsError) throw listingsError

    summary.listings_scanned = (listings || []).length

    for (const listing of listings || []) {
      if (toInsert.length >= MAX_RECOMMENDATIONS_PER_RUN) break
      const title = (listing.title || '').trim()
      const description = (listing.description || '').trim()
      const photos = listing.photos as unknown

      if (title.length < MIN_TITLE_LENGTH) {
        queueRecommendation({
          pageType: 'listing', pageRef: listing.id, recType: 'metadata',
          current: title || '(empty)',
          suggested: `Title is only ${title.length} character(s) — titles under ${MIN_TITLE_LENGTH} characters rank poorly and give buyers little to go on. Add the item's brand/model/condition/location.`,
          impact: 'medium',
        })
      }
      if (description.length < MIN_DESCRIPTION_LENGTH) {
        queueRecommendation({
          pageType: 'listing', pageRef: listing.id, recType: 'metadata',
          current: description ? `${description.length} character(s)` : '(empty)',
          suggested: `Description is too short to be useful for search or buyers — aim for at least ${MIN_DESCRIPTION_LENGTH} characters covering condition, specs, and why a buyer should choose this listing.`,
          impact: 'medium',
        })
      }
      const photoCount = Array.isArray(photos) ? photos.length : 0
      if (photoCount === 0) {
        queueRecommendation({
          pageType: 'listing', pageRef: listing.id, recType: 'technical',
          current: '0 photos',
          suggested: 'Listings with no photos get far less engagement and are less likely to be shared/indexed well by search image results. Prompt the seller to add at least one photo.',
          impact: 'high',
        })
      }
    }

    // ── Category-level: thin categories (few active listings) hurt that
    //    category page's own SEO value and look sparse to visitors. ────
    const { data: categoryRows, error: catError } = await db
      .from('listings')
      .select('category')
      .eq('status', 'active')
    if (catError) throw catError

    const categoryCounts = new Map<string, number>()
    for (const r of categoryRows || []) {
      const cat = (r as { category: string | null }).category || 'other'
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
    }
    for (const [cat, count] of categoryCounts.entries()) {
      if (count < THIN_CATEGORY_THRESHOLD) {
        queueRecommendation({
          pageType: 'category', pageRef: cat, recType: 'internal_link',
          current: `${count} active listing(s)`,
          suggested: `This category has very few active listings, which reads as thin/low-value content to search engines and visitors alike. Consider a seller-acquisition push for this category, or de-emphasize it in main navigation until it has more inventory.`,
          impact: count === 0 ? 'high' : 'medium',
        })
      }
    }

    // ── Single batch insert for everything queued above ─────────────────
    if (toInsert.length) {
      const { error: insertError } = await db.from('amos_seo_recommendations').insert(
        toInsert.map((r) => ({ country_code: 'ZW', status: 'open', ...r }))
      )
      if (insertError) summary.errors.push('Batch insert failed: ' + insertError.message)
      else summary.recommendations_written = toInsert.length
    }

    // ── Keyword-type recommendations require Search Console query data
    //    (what people actually search to find a page) — not connected
    //    in this project. Recorded as a note, not fabricated. ──────────
    summary.errors.push('Keyword-type recommendations skipped: no Google Search Console connection exists yet (checked: no GSC-related edge function secret). This runner only produces metadata/technical/internal_link recommendations from directly inspectable data.')

    const ok = true // the GSC note above is informational, not a real failure
    const finishedAt = Date.now()
    const detail = `${summary.recommendations_written} new recommendation(s) from ${summary.listings_scanned} listing(s) scanned`

    console.log(`[amos-seo-runner] run finished ok=${ok} ${detail}`)

    await db.from('job_runs').insert({
      job: 'amos_seo_runner',
      ok,
      detail,
      rows_affected: summary.recommendations_written,
      started_at: new Date(startedAt).toISOString(),
      trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
      meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
    })

    if (triggeredBy.actorRole !== 'system') {
      await db.from('admin_audit_logs').insert({
        actor_id: triggeredBy.actorId,
        actor_email: triggeredBy.actorEmail,
        actor_role: triggeredBy.actorRole,
        action: 'run_amos_seo_runner',
        entity: 'amos_seo_recommendations',
        entity_id: null,
        after_state: { ...summary, duration_ms: finishedAt - startedAt },
        reason: 'manual trigger from AMOS SEO Manager',
      })
    }

    return json({ success: ok, ...summary, duration_ms: finishedAt - startedAt }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    summary.errors.push(message)
    await db.from('job_runs').insert({
      job: 'amos_seo_runner', ok: false, detail: message.slice(0, 2000),
      started_at: new Date(startedAt).toISOString(),
      trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
      meta: { ...summary, duration_ms: Date.now() - startedAt },
    })
    return json({ success: false, ...summary, duration_ms: Date.now() - startedAt }, 500)
  }
})
