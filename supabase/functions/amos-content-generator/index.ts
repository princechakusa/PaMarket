import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

// Deploy:  supabase functions deploy amos-content-generator --no-verify-jwt
// (same reason as amos-research-runner: the pg_cron path — not wired up
// yet, manual-trigger only for now — calls this with only
// x-automation-secret, no apikey/Authorization header.)
//
// AMOS Module 2 — Content Generation.
//
// DRAFT-ONLY. This function never publishes anything anywhere — it only
// ever writes rows with status='draft' into amos_content_drafts. Nothing
// it does is visible to the public; every row it creates must go through
// the (Module 2) Approval Queue before it can be scheduled or published by
// a later module. approval_required in amos_settings is not even consulted
// here, because generation and publishing are deliberately separate steps
// — this function has no publish path at all yet to gate.
//
// Same dual-auth pattern as amos-research-runner:
//   1. Cron path — x-automation-secret header (not scheduled yet).
//   2. Manual path — admin session JWT, verified server-side, audited to
//      admin_audit_logs, heartbeat to job_runs with started_at/trigger_type.
//
// Flow per run:
//   1. Pick the single highest-scoring, unexpired amos_market_intelligence
//      row that doesn't already have a content item pointing at it.
//   2. Create one amos_content_items row for that topic.
//   3. Call Claude once per placement (facebook, instagram, linkedin, x,
//      website/blog, push, email) — 7 isolated calls, one placement
//      failing never blocks the others.
//   4. Each successful call becomes one amos_content_drafts row,
//      status='draft', with a performance_rationale the model was asked
//      for explicitly (never fabricated after the fact by this function).
//
// If ANTHROPIC_API_KEY is not configured, the function fails clearly and
// immediately (before touching amos_content_items) rather than partially
// writing an idea with zero drafts.

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
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929'
// Bump whenever systemPrompt's wording changes meaningfully — stored on
// every draft so a future prompt-quality comparison can group drafts by
// which wording produced them.
const PROMPT_VERSION = 'v2-quality-layer'

const REAL_CATEGORIES = ['property','vehicles','rooms','electronics','jobs','furniture','fashion','services','agriculture','pets','kids','other'] as const
const CAMPAIGN_TYPES = ['seasonal','promotional','spotlight','evergreen','urgent'] as const

type Placement = {
  channel: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'website' | 'push' | 'email'
  draftType: 'post' | 'article' | 'notification' | 'email'
  label: string
  instructions: string
  maxTokens: number
}

const PLACEMENTS: Placement[] = [
  { channel: 'facebook', draftType: 'post', label: 'Facebook post',
    instructions: 'Write a Facebook post (2-4 short paragraphs max, conversational, can include 2-4 relevant hashtags). Include a clear call to action.',
    maxTokens: 500 },
  { channel: 'instagram', draftType: 'post', label: 'Instagram caption',
    instructions: 'Write an Instagram caption (punchy, visual language since it pairs with an image, 3-6 relevant hashtags at the end). Include a clear call to action.',
    maxTokens: 500 },
  { channel: 'linkedin', draftType: 'post', label: 'LinkedIn post',
    instructions: 'Write a LinkedIn post in a more professional/business tone (PaMarket as a growing Zimbabwean marketplace company), no hashtag spam (0-2 max). Include a clear call to action.',
    maxTokens: 500 },
  { channel: 'x', draftType: 'post', label: 'X post',
    instructions: 'Write a single X (Twitter) post, under 280 characters total including any hashtags. Punchy, direct. 1-2 hashtags max.',
    maxTokens: 300 },
  { channel: 'website', draftType: 'article', label: 'Blog/SEO article',
    instructions: 'Write a short blog article (400-600 words) optimized for organic search, structured with a clear headline and 2-3 subheadings, naturally including the topic keyword. End with a call to action pointing to the PaMarket app/website.',
    maxTokens: 1500 },
  { channel: 'push', draftType: 'notification', label: 'Push notification',
    instructions: 'Write a push notification: a title (under 50 characters) and a body (under 120 characters). Format your response as "Title: ...\\nBody: ...". Urgent/actionable tone, no hashtags.',
    maxTokens: 150 },
  { channel: 'email', draftType: 'email', label: 'Email campaign',
    instructions: 'Write a short marketing email: a subject line and a body (150-250 words, friendly, one clear call to action button text at the end). Format your response as "Subject: ...\\n\\nBody: ...".',
    maxTokens: 600 },
]

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

  // ── Auth: identical dual-path pattern to amos-research-runner ──────────
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
      .select('role, email, name')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (profileError || !profile || !ADMIN_TEAM_ROLES.has(profile.role)) {
      return json({ error: 'Unauthorized automation request' }, 401)
    }

    triggeredBy = {
      actorId: userData.user.id,
      actorEmail: profile.email || userData.user.email || null,
      actorRole: profile.role,
    }

    // Content generation is 7 API calls per run — a tighter window than
    // the research runner, since it's both more expensive (API cost) and
    // slower per call.
    const rate = await checkAmosRateLimit(db, 'amos-content-generator', userData.user.id, { windowMinutes: 15, maxCalls: 3 })
    if (!rate.allowed) {
      return json({ error: `Too many manual runs — try again in ${rate.retryAfterSeconds}s` }, 429)
    }
  }

  const summary = {
    topic_selected: null as string | null,
    content_item_id: null as string | null,
    drafts_written: 0,
    placements_failed: [] as string[],
    errors: [] as string[],
  }

  // Production Readiness Audit, Critical #3 fix: write a job_runs row
  // marked "in progress" BEFORE any real work starts, not only after
  // everything finishes. A hard platform-level kill (timeout, OOM) is not
  // a catchable JS exception — the old code's only job_runs write lived
  // after the placement loop and inside a try/catch, so a mid-run kill
  // produced ZERO record of the run ever having happened. Now, even in
  // that worst case, an admin sees a run stuck at ok=false,
  // detail='in progress' past its expected duration — a real signal
  // instead of silence. finish() below UPDATEs this same row instead of
  // inserting a fresh one.
  let jobRunId: string | null = null
  try {
    const { data: inProgress } = await db.from('job_runs').insert({
      job: 'amos_content_generator',
      ok: false,
      detail: 'in progress',
      started_at: new Date(startedAt).toISOString(),
      trigger_type: cronAuthOk ? 'cron' : 'manual',
    }).select('id').single()
    jobRunId = inProgress?.id ?? null
  } catch (_e) { /* best effort — a failure to write the marker must never block the actual run */ }
  console.log(`[amos-content-generator] run started, trigger=${cronAuthOk ? 'cron' : 'manual'}, job_run_id=${jobRunId ?? 'unrecorded'}`)

  const finish = async (ok: boolean) => {
    const finishedAt = Date.now()
    const detail = summary.topic_selected
      ? `"${summary.topic_selected}" — ${summary.drafts_written}/${PLACEMENTS.length} draft(s) written`
      : summary.errors.join('; ').slice(0, 2000)

    console.log(`[amos-content-generator] run finished ok=${ok} ${detail}`)
    if (summary.errors.length) console.error(`[amos-content-generator] errors:`, summary.errors)

    const jobRunRow = {
      job: 'amos_content_generator',
      ok,
      detail,
      rows_affected: summary.drafts_written,
      started_at: new Date(startedAt).toISOString(),
      trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
      meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
    }

    // UPDATE the "in progress" marker written at the start rather than
    // inserting a second row — one row per run, correctly reflecting
    // in-progress -> resolved. Falls back to insert only if the marker
    // write at the start failed for some reason (defensive, not the
    // expected path).
    if (jobRunId) {
      const { error: updateError } = await db.from('job_runs').update(jobRunRow).eq('id', jobRunId)
      if (updateError) await db.from('job_runs').insert(jobRunRow)
    } else {
      await db.from('job_runs').insert(jobRunRow)
    }

    if (triggeredBy.actorRole !== 'system') {
      await db.from('admin_audit_logs').insert({
        actor_id: triggeredBy.actorId,
        actor_email: triggeredBy.actorEmail,
        actor_role: triggeredBy.actorRole,
        action: 'run_amos_content_generator',
        entity: 'amos_content_items',
        entity_id: summary.content_item_id,
        after_state: { ...summary, duration_ms: finishedAt - startedAt },
        reason: 'manual trigger from AMOS Dashboard',
      })
    }

    return json({ success: ok, ...summary, duration_ms: finishedAt - startedAt }, ok ? 200 : 207)
  }

  // Fail fast and cleanly if the model provider isn't configured — before
  // creating a content_items row with zero drafts behind it.
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || ''
  if (!anthropicKey) {
    summary.errors.push('ANTHROPIC_API_KEY not configured — set it under Supabase → Edge Functions → amos-content-generator → Secrets.')
    return await finish(false)
  }

  // Production Readiness Audit, High #4 fix: a real spend ceiling, not
  // just an unused budget_monthly_cents schema field. Rough per-run
  // estimate (1 classification call + 7 placement calls, Claude Sonnet
  // pricing) charged atomically against amos_settings.ai_budget_cents_limit
  // via amos_check_and_record_ai_spend BEFORE any Anthropic call is made,
  // so a misconfigured cron interval has a real backstop instead of an
  // unbounded bill. Manual triggers are already rate-limited (3/15min);
  // this is what protects the cron path, which has no such limit.
  const ESTIMATED_CENTS_PER_RUN = 15
  const { data: budgetOk, error: budgetError } = await db.rpc('amos_check_and_record_ai_spend', {
    p_country_code: 'ZW', p_estimated_cents: ESTIMATED_CENTS_PER_RUN,
  })
  if (budgetError) {
    console.error('[amos-content-generator] budget check failed, failing open:', budgetError.message)
  } else if (budgetOk === false) {
    summary.errors.push('Monthly AI budget limit reached (amos_settings.ai_budget_cents_limit) — increase it in AI Configuration or wait for next month\'s reset to generate more content.')
    console.error('[amos-content-generator] blocked: monthly AI budget limit reached')
    return await finish(false)
  }

  try {
    // ── 1. Pick a topic ────────────────────────────────────────────────
    const { data: alreadyUsed, error: usedError } = await db
      .from('amos_content_items')
      .select('market_intelligence_id')
      .not('market_intelligence_id', 'is', null)
    if (usedError) throw usedError
    const usedIds = new Set((alreadyUsed || []).map((r) => r.market_intelligence_id))

    const { data: candidates, error: candError } = await db
      .from('amos_market_intelligence')
      .select('*')
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
      .order('score', { ascending: false, nullsFirst: false })
      .limit(50)
    if (candError) throw candError

    const topic = (candidates || []).find((c) => !usedIds.has(c.id))
    if (!topic) {
      summary.errors.push('No unused Market Intelligence signals available — run the research runner first, or all current signals already have content items.')
      return await finish(false)
    }
    summary.topic_selected = topic.topic

    // ── 2. Classify the topic (category / target audience / campaign
    //    type) with one lightweight call, before creating the content
    //    item — so the item is tagged correctly from the moment it exists
    //    rather than backfilled after the fact. ─────────────────────────
    const categoryHint = (topic.raw && topic.raw.category_hint) || null
    const classification = await classifyTopic(anthropicKey, topic.topic, topic.rationale, topic.signal_type, categoryHint)

    const { data: item, error: itemError } = await db
      .from('amos_content_items')
      .insert({
        country_code: topic.country_code || 'ZW',
        title: topic.topic,
        category: classification.category,
        target_audience: classification.targetAudience,
        campaign_type: classification.campaignType,
        market_intelligence_id: topic.id,
        status: 'drafted',
        created_by: triggeredBy.actorId,
      })
      .select()
      .single()
    if (itemError) throw itemError
    summary.content_item_id = item.id

    // ── 3. Brand voice for the system prompt ───────────────────────────
    const { data: settings } = await db.from('amos_settings').select('brand_voice').eq('country_code', 'ZW').maybeSingle()
    const tone = (settings?.brand_voice?.tone || ['professional', 'trustworthy', 'modern', 'friendly', 'helpful']).join(', ')
    const avoid = (settings?.brand_voice?.avoid || ['clickbait', 'misleading claims', 'copying competitors']).join(', ')

    const systemPrompt = `You are writing marketing content for PaMarket, Zimbabwe's marketplace app for buying, selling, hiring, and getting hired (listings, jobs, vehicles, properties, rentals). Brand tone: ${tone}. Avoid: ${avoid}. Never invent statistics, prices, or claims about PaMarket that aren't given to you.

After writing the content, append these exact tagged lines (each on its own line, in this order, nothing after them):
WHY THIS WORKS: <one sentence on why this should perform well with a Zimbabwean audience, referencing the specific context you were given>
RELEVANCE SCORE: <0-100, how well this content matches the given topic/signal>
BRAND ALIGNMENT SCORE: <0-100, how well this matches the brand tone and avoids the listed pitfalls>
ENGAGEMENT PREDICTION SCORE: <0-100, your honest estimate of how likely this specific piece is to get engagement from a Zimbabwean marketplace audience — do not default to high numbers>
SEO VALUE SCORE: <0-100 if this is a blog/article placement with real search-ranking potential, or 0 if not applicable>`

    const userContext = `Topic/signal: "${topic.topic}"\nWhy this is relevant right now: ${topic.rationale || 'no additional context'}\nSignal type: ${topic.signal_type}\nTarget audience: ${classification.targetAudience || 'general PaMarket users in Zimbabwe'}`

    // ── 4. Generate each placement, isolated ───────────────────────────
    for (const placement of PLACEMENTS) {
      try {
        const draft = await generatePlacement(anthropicKey, systemPrompt, userContext, placement)
        const { error: draftError } = await db.from('amos_content_drafts').insert({
          content_item_id: item.id,
          channel: placement.channel,
          draft_type: placement.draftType,
          body: draft.body,
          cta: draft.cta,
          hashtags: draft.hashtags,
          performance_rationale: draft.rationale,
          ai_provider: 'anthropic',
          ai_model: ANTHROPIC_MODEL,
          prompt_version: PROMPT_VERSION,
          relevance_score: draft.scores.relevance,
          brand_alignment_score: draft.scores.brandAlignment,
          engagement_prediction_score: draft.scores.engagementPrediction,
          seo_value_score: draft.scores.seoValue,
          status: 'draft',
        })
        if (draftError) throw draftError
        summary.drafts_written++
        console.log(`[amos-content-generator] ${placement.channel} draft written`)
      } catch (placementError) {
        summary.placements_failed.push(placement.channel)
        const message = placementError instanceof Error ? placementError.message : String(placementError)
        summary.errors.push(`${placement.label}: ${message}`)
        console.error(`[amos-content-generator] ${placement.channel} failed:`, message)
      }
    }

    // Item status reflects reality: only fully "drafted" if every placement
    // succeeded; otherwise leave a trail rather than silently claiming success.
    if (summary.placements_failed.length > 0) {
      await db.from('amos_content_items').update({ status: summary.drafts_written > 0 ? 'drafted' : 'idea' }).eq('id', item.id)
    }

    return await finish(summary.drafts_written > 0)
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : String(error))
    return await finish(false)
  }
})

// One lightweight call to tag the content item before any placement copy
// is written — keeps classification independent of any single placement's
// wording, and means every draft under this item inherits a consistent
// category/audience/campaign_type rather than each placement guessing on
// its own. "Business" is deliberately never a possible output value here;
// the instructions explicitly redirect it to 'services', the app's real
// category for business/service-provider content.
async function classifyTopic(
  apiKey: string,
  topic: string,
  rationale: string | null,
  signalType: string,
  categoryHint: string | null
): Promise<{ category: string | null; targetAudience: string | null; campaignType: string | null }> {
  const prompt = `Topic: "${topic}"\nContext: ${rationale || 'none'}\nSignal type: ${signalType}\nCategory hint: ${categoryHint || 'none'}\n\nClassify this for a Zimbabwean marketplace app (PaMarket). Respond with EXACTLY these three tagged lines and nothing else:\nCATEGORY: <one of: ${REAL_CATEGORIES.join(', ')} — if the topic is about a business/service provider in general, use 'services', never invent a 'business' category>\nTARGET AUDIENCE: <one short phrase describing who this content should reach, e.g. "first-time car buyers in Harare">\nCAMPAIGN TYPE: <one of: ${CAMPAIGN_TYPES.join(', ')}>`

  try {
    // Best-effort enrichment, not load-bearing (per the function's own
    // purpose — see the classifyTopic doc comment above) — still routed
    // through the shared retry helper since a single transient 429/5xx
    // shouldn't waste the whole classification for free, but any
    // remaining failure after retries still degrades to nulls rather than
    // failing the run.
    const data = await callAnthropicWithRetry(apiKey, { model: ANTHROPIC_MODEL, max_tokens: 150, messages: [{ role: 'user', content: prompt }] }, 'classification')
    const text: string = (data.content || []).map((b: { type: string; text?: string }) => b.text || '').join('\n')

    const categoryMatch = text.match(/CATEGORY:\s*(\w+)/i)
    const audienceMatch = text.match(/TARGET AUDIENCE:\s*(.+)/i)
    const campaignMatch = text.match(/CAMPAIGN TYPE:\s*(\w+)/i)

    const category = categoryMatch && REAL_CATEGORIES.includes(categoryMatch[1].toLowerCase() as typeof REAL_CATEGORIES[number]) ? categoryMatch[1].toLowerCase() : null
    const campaignType = campaignMatch && CAMPAIGN_TYPES.includes(campaignMatch[1].toLowerCase() as typeof CAMPAIGN_TYPES[number]) ? campaignMatch[1].toLowerCase() : null
    const targetAudience = audienceMatch ? audienceMatch[1].trim().split('\n')[0].slice(0, 200) : null

    return { category, targetAudience, campaignType }
  } catch {
    // Classification is a best-effort enrichment, not load-bearing —
    // generation proceeds with null tags rather than failing the whole run.
    return { category: null, targetAudience: null, campaignType: null }
  }
}

function clampScore(raw: string | undefined): number | null {
  if (!raw) return null
  const n = parseInt(raw, 10)
  if (Number.isNaN(n)) return null
  return Math.max(0, Math.min(100, n))
}

// Production Readiness Audit fix (item 10): retry/backoff for transient
// Anthropic failures. Only retries on signals that are actually transient
// (429 rate limit, 5xx server errors, network-level fetch failure) — a
// real 400/401 (bad request, bad key) retrying would just waste time and
// budget on a guaranteed-repeat failure. Capped at 2 retries with a short
// fixed backoff, deliberately small: this function already runs close to
// the platform's wall-clock ceiling (Production Readiness Audit,
// Critical #3), so an aggressive/unbounded retry here would make that
// risk worse, not better.
const ANTHROPIC_MAX_RETRIES = 2
const ANTHROPIC_RETRY_DELAY_MS = 1000

async function callAnthropicWithRetry(apiKey: string, body: Record<string, unknown>, label: string): Promise<{ content?: { type: string; text?: string }[] }> {
  let lastError: string = 'unknown error'
  for (let attempt = 0; attempt <= ANTHROPIC_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      })

      if (res.ok) return await res.json()

      const errBody = await res.text().catch(() => '')
      lastError = `Anthropic API error ${res.status}: ${errBody.slice(0, 300)}`
      const transient = res.status === 429 || res.status >= 500
      if (!transient || attempt === ANTHROPIC_MAX_RETRIES) throw new Error(lastError)
      console.warn(`[amos-content-generator] ${label}: transient error (${res.status}), retrying in ${ANTHROPIC_RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${ANTHROPIC_MAX_RETRIES})`)
    } catch (fetchError) {
      // A thrown non-transient error (from the block above) re-throws
      // immediately; a genuine network-level failure falls through to the
      // same retry path as a transient HTTP error.
      if (fetchError instanceof Error && fetchError.message === lastError) throw fetchError
      lastError = fetchError instanceof Error ? fetchError.message : String(fetchError)
      if (attempt === ANTHROPIC_MAX_RETRIES) throw new Error(lastError)
      console.warn(`[amos-content-generator] ${label}: network error, retrying (attempt ${attempt + 1}/${ANTHROPIC_MAX_RETRIES}):`, lastError)
    }
    await new Promise((resolve) => setTimeout(resolve, ANTHROPIC_RETRY_DELAY_MS))
  }
  throw new Error(lastError)
}

async function generatePlacement(
  apiKey: string,
  systemPrompt: string,
  userContext: string,
  placement: Placement
): Promise<{
  body: string
  cta: string | null
  hashtags: string[] | null
  rationale: string | null
  scores: { relevance: number | null; brandAlignment: number | null; engagementPrediction: number | null; seoValue: number | null }
}> {
  const data = await callAnthropicWithRetry(apiKey, {
    model: ANTHROPIC_MODEL,
    max_tokens: placement.maxTokens,
    system: systemPrompt,
    messages: [
      { role: 'user', content: `${userContext}\n\nWrite this: ${placement.instructions}` },
    ],
  }, placement.channel)
  const text: string = (data.content || []).map((b: { type: string; text?: string }) => b.text || '').join('\n').trim()
  if (!text) throw new Error('Empty response from model')

  // Split off the mandated tagged trailer (WHY THIS WORKS + 4 scores);
  // everything before the first tagged line is the actual draft body.
  const whyMatch = text.match(/WHY THIS WORKS:\s*(.+)/i)
  const rationale = whyMatch ? whyMatch[1].split('\n')[0].trim() : null
  const body = whyMatch ? text.slice(0, whyMatch.index).trim() : text

  const scores = {
    relevance: clampScore(text.match(/RELEVANCE SCORE:\s*(\d+)/i)?.[1]),
    brandAlignment: clampScore(text.match(/BRAND ALIGNMENT SCORE:\s*(\d+)/i)?.[1]),
    engagementPrediction: clampScore(text.match(/ENGAGEMENT PREDICTION SCORE:\s*(\d+)/i)?.[1]),
    seoValue: clampScore(text.match(/SEO VALUE SCORE:\s*(\d+)/i)?.[1]),
  }

  const hashtagMatches = body.match(/#\w+/g)
  const hashtags = hashtagMatches && hashtagMatches.length ? hashtagMatches : null

  return { body, cta: null, hashtags, rationale, scores }
}
