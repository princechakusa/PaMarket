import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  }

  const summary = {
    topic_selected: null as string | null,
    content_item_id: null as string | null,
    drafts_written: 0,
    placements_failed: [] as string[],
    errors: [] as string[],
  }

  const finish = async (ok: boolean) => {
    const finishedAt = Date.now()
    const detail = summary.topic_selected
      ? `"${summary.topic_selected}" — ${summary.drafts_written}/${PLACEMENTS.length} draft(s) written`
      : summary.errors.join('; ').slice(0, 2000)

    await db.from('job_runs').insert({
      job: 'amos_content_generator',
      ok,
      detail,
      rows_affected: summary.drafts_written,
      started_at: new Date(startedAt).toISOString(),
      trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
      meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
    })

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

    // ── 2. Create the content item ─────────────────────────────────────
    const categoryHint = (topic.raw && topic.raw.category_hint) || null
    const { data: item, error: itemError } = await db
      .from('amos_content_items')
      .insert({
        country_code: topic.country_code || 'ZW',
        title: topic.topic,
        category: mapCategory(categoryHint),
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

    const systemPrompt = `You are writing marketing content for PaMarket, Zimbabwe's marketplace app for buying, selling, hiring, and getting hired (listings, jobs, vehicles, properties, rentals). Brand tone: ${tone}. Avoid: ${avoid}. Never invent statistics, prices, or claims about PaMarket that aren't given to you. Always end your response with a line starting exactly "WHY THIS WORKS:" followed by one sentence explaining why this piece should perform well with a Zimbabwean audience, referencing the specific context you were given.`

    const userContext = `Topic/signal: "${topic.topic}"\nWhy this is relevant right now: ${topic.rationale || 'no additional context'}\nSignal type: ${topic.signal_type}`

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
          status: 'draft',
        })
        if (draftError) throw draftError
        summary.drafts_written++
      } catch (placementError) {
        summary.placements_failed.push(placement.channel)
        summary.errors.push(`${placement.label}: ${placementError instanceof Error ? placementError.message : String(placementError)}`)
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

function mapCategory(hint: string | null): string | null {
  if (!hint) return null
  const h = hint.toLowerCase()
  if (h.includes('school') || h.includes('education')) return 'seasonal'
  if (h.includes('apparel') || h.includes('electronics') || h.includes('gifts') || h.includes('groceries') || h.includes('decor')) return 'marketplace'
  return 'seasonal'
}

async function generatePlacement(
  apiKey: string,
  systemPrompt: string,
  userContext: string,
  placement: Placement
): Promise<{ body: string; cta: string | null; hashtags: string[] | null; rationale: string | null }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: placement.maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `${userContext}\n\nWrite this: ${placement.instructions}` },
      ],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${errBody.slice(0, 300)}`)
  }

  const data = await res.json()
  const text: string = (data.content || []).map((b: { type: string; text?: string }) => b.text || '').join('\n').trim()
  if (!text) throw new Error('Empty response from model')

  // Split off the mandated "WHY THIS WORKS:" line; everything before it is
  // the actual draft body.
  const whyMatch = text.match(/WHY THIS WORKS:\s*(.+)$/is)
  const rationale = whyMatch ? whyMatch[1].trim() : null
  const body = whyMatch ? text.slice(0, whyMatch.index).trim() : text

  const hashtagMatches = body.match(/#\w+/g)
  const hashtags = hashtagMatches && hashtagMatches.length ? hashtagMatches : null

  return { body, cta: null, hashtags, rationale }
}
