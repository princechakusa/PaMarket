import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3'
import { checkAmosRateLimit } from '../_shared/amos-rate-limit.ts'

// Deploy:  supabase functions deploy amos-media-generator --no-verify-jwt
// (same reason as every other AMOS function — the cron path sends only
// x-automation-secret, no apikey/Authorization header.)
//
// AMOS Module 10 — AI Media Generation (images).
//
// Generates one marketing image for a single amos_content_drafts row via
// OpenAI's gpt-image-1. Two free options were tried first (Pollinations,
// then Hugging Face's Inference API running Stable Diffusion 3 Medium)
// but both produced garbled/illegible text and broken UI mockups when
// the post needed a graphic with text or interface elements in it — a
// real capability ceiling of free diffusion models, not a prompt-tuning
// problem. gpt-image-1 is billed (billing added specifically for this)
// but renders text and structured layouts far more reliably.
//
// This is the AI-generation path only — the separate "Attach My Own"
// flow in the admin UI (paste a URL or upload a file) is unaffected and
// remains the recommended path when AI quality isn't good enough for a
// given post.
//
// Uploads the result to the R2 public bucket (same bucket/credentials as
// get-r2-upload-url, direct SDK write since this runs server-side and
// already holds the R2 secrets — no signed-URL round trip needed), and
// records the result in amos_media_assets + amos_content_drafts.media_asset_id.
//
// DRAFT-ONLY, same posture as amos-content-generator: this function only
// ever attaches an image to an existing draft. It never publishes
// anything — that stays gated by the existing Approval Queue and
// amos-publish-dispatcher, both unchanged by this module.

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
const OPENAI_MODEL = 'gpt-image-1'

// Placement -> pixel dimensions gpt-image-1 actually supports. It only
// accepts these three exact sizes; anything else 400s.
const PLACEMENT_SIZE: Record<string, { size: string; width: number; height: number; format: string }> = {
  facebook:        { size: '1536x1024', width: 1536, height: 1024, format: 'landscape' },
  instagram:        { size: '1024x1024', width: 1024, height: 1024, format: 'square' },
  linkedin:         { size: '1536x1024', width: 1536, height: 1024, format: 'landscape' },
  x:                { size: '1536x1024', width: 1536, height: 1024, format: 'landscape' },
  blog_header:      { size: '1536x1024', width: 1536, height: 1024, format: 'landscape' },
  website_banner:   { size: '1536x1024', width: 1536, height: 1024, format: 'landscape' },
  story:            { size: '1024x1536', width: 1024, height: 1536, format: 'portrait' },
  square:           { size: '1024x1024', width: 1024, height: 1024, format: 'square' },
  landscape:        { size: '1536x1024', width: 1536, height: 1024, format: 'landscape' },
  portrait:         { size: '1024x1536', width: 1024, height: 1536, format: 'portrait' },
}

const VALID_STYLES = new Set([
  'product_showcase', 'promotional_banner', 'hiring_announcement',
  'marketplace_advertisement', 'quote_card', 'infographic',
  'event_announcement', 'feature_announcement',
])

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

  // ── Auth: identical dual-path pattern to every other AMOS function ──
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

    const rate = await checkAmosRateLimit(db, 'amos-media-generator', userData.user.id, { windowMinutes: 15, maxCalls: 10 })
    if (!rate.allowed) {
      return json({ error: `Too many manual runs — try again in ${rate.retryAfterSeconds}s` }, 429)
    }
  }

  let body: { draftId?: string; style?: string; placement?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { draftId } = body
  if (!draftId) return json({ error: 'draftId is required' }, 400)

  const style = body.style && VALID_STYLES.has(body.style) ? body.style : 'marketplace_advertisement'

  const summary = {
    draft_id: draftId,
    media_asset_id: null as string | null,
    status: 'failed' as 'ready' | 'failed',
    error: null as string | null,
  }

  const jobStart = async () => {
    console.log(`[amos-media-generator] run started for draft ${draftId}, trigger=${cronAuthOk ? 'cron' : 'manual'}`)
  }
  await jobStart()

  const finish = async (ok: boolean) => {
    const finishedAt = Date.now()
    console.log(`[amos-media-generator] run finished ok=${ok} draft=${draftId} asset=${summary.media_asset_id ?? 'none'}`)
    if (summary.error) console.error(`[amos-media-generator] error:`, summary.error)

    await db.from('job_runs').insert({
      job: 'amos_media_generator',
      ok,
      detail: ok ? `image generated for draft ${draftId}` : summary.error?.slice(0, 2000),
      rows_affected: ok ? 1 : 0,
      started_at: new Date(startedAt).toISOString(),
      trigger_type: triggeredBy.actorRole === 'system' ? 'cron' : 'manual',
      meta: { ...summary, triggered_by: triggeredBy.actorRole, duration_ms: finishedAt - startedAt },
    })

    if (triggeredBy.actorRole !== 'system') {
      await db.from('admin_audit_logs').insert({
        actor_id: triggeredBy.actorId,
        actor_email: triggeredBy.actorEmail,
        actor_role: triggeredBy.actorRole,
        action: 'run_amos_media_generator',
        entity: 'amos_media_assets',
        entity_id: summary.media_asset_id,
        after_state: { ...summary, duration_ms: finishedAt - startedAt },
        reason: 'manual image generation from AMOS Approval Queue',
      })
    }

    return json({ success: ok, ...summary, duration_ms: finishedAt - startedAt }, ok ? 200 : 502)
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY') || ''
  if (!openaiKey) {
    summary.error = 'OPENAI_API_KEY not configured — set it under Supabase → Edge Functions → amos-media-generator → Secrets.'
    return await finish(false)
  }

  try {
    // ── 1. Load the draft + its content item + brand kit ──────────────
    const { data: draft, error: draftError } = await db
      .from('amos_content_drafts')
      .select('id, channel, body, content_item_id')
      .eq('id', draftId)
      .maybeSingle()
    if (draftError) throw draftError
    if (!draft) {
      summary.error = 'Draft not found'
      return await finish(false)
    }

    const placementKey = body.placement || draft.channel
    const sizeConfig = PLACEMENT_SIZE[placementKey] || PLACEMENT_SIZE.square

    const { data: item } = await db
      .from('amos_content_items')
      .select('title, country_code')
      .eq('id', draft.content_item_id)
      .maybeSingle()

    const { data: brandKit } = await db
      .from('amos_brand_kit')
      .select('*')
      .eq('country_code', item?.country_code || 'ZW')
      .maybeSingle()

    // Real spend ceiling — same amos_check_and_record_ai_spend RPC and
    // pattern amos-content-generator uses for its own Anthropic calls
    // (Production Readiness Audit, High #4). gpt-image-1's 1536x1024
    // "high" quality is roughly $0.19/image at the top end; budgeting for
    // that here so the check can't under-count a real charge.
    const ESTIMATED_CENTS_PER_IMAGE = 19
    const { data: budgetOk, error: budgetError } = await db.rpc('amos_check_and_record_ai_spend', {
      p_country_code: item?.country_code || 'ZW', p_estimated_cents: ESTIMATED_CENTS_PER_IMAGE,
    })
    if (budgetError) {
      console.error('[amos-media-generator] budget check failed, failing open:', budgetError.message)
    } else if (budgetOk === false) {
      summary.error = 'Monthly AI budget limit reached — increase it in AI Configuration or wait for next month\'s reset.'
      return await finish(false)
    }

    // ── 3. Build the prompt from brand kit + draft copy ────────────────
    const prompt = buildImagePrompt({
      title: item?.title || 'PaMarket',
      draftBody: draft.body || '',
      style,
      placement: placementKey,
      brandKit,
    })

    // ── 4. Create the pending media_assets row before calling the API ──
    const { data: mediaRow, error: mediaInsertError } = await db
      .from('amos_media_assets')
      .insert({
        draft_id: draft.id,
        content_item_id: draft.content_item_id,
        asset_type: 'image',
        style,
        placement: placementKey,
        format: sizeConfig.format,
        prompt,
        provider: 'openai',
        model: OPENAI_MODEL,
        status: 'generating',
        created_by: triggeredBy.actorId,
      })
      .select('id')
      .single()
    if (mediaInsertError) throw mediaInsertError
    summary.media_asset_id = mediaRow.id

    // ── 5. Call OpenAI ───────────────────────────────────────────────
    const imageB64 = await generateImage(openaiKey, prompt, sizeConfig.size)

    // ── 6. Upload to R2 ──────────────────────────────────────────────
    const key = `amos/media/${draft.content_item_id}/${mediaRow.id}.png`
    const publicUrl = await uploadToR2(imageB64, key)

    // ── 7. Mark ready, link to the draft ────────────────────────────
    await db.from('amos_media_assets').update({
      status: 'ready',
      storage_key: key,
      url: publicUrl,
      width: sizeConfig.width,
      height: sizeConfig.height,
      generation_cost_cents: ESTIMATED_CENTS_PER_IMAGE,
      updated_at: new Date().toISOString(),
    }).eq('id', mediaRow.id)

    await db.from('amos_content_drafts').update({ media_asset_id: mediaRow.id }).eq('id', draft.id)

    summary.status = 'ready'
    return await finish(true)
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error)
    if (summary.media_asset_id) {
      await db.from('amos_media_assets').update({
        status: 'failed', error: summary.error, updated_at: new Date().toISOString(),
      }).eq('id', summary.media_asset_id)
    }
    return await finish(false)
  }
})

function buildImagePrompt(args: {
  title: string
  draftBody: string
  style: string
  placement: string
  brandKit: Record<string, unknown> | null
}): string {
  const { title, draftBody, style, placement, brandKit } = args
  const primary = (brandKit?.color_primary as string) || '#1A3A8F'
  const secondary = (brandKit?.color_secondary as string) || '#D4AF37'
  const notes = (brandKit?.design_notes as string) || ''

  const styleDescriptions: Record<string, string> = {
    product_showcase: 'a clean product showcase composition with generous negative space around the subject',
    promotional_banner: 'a bold promotional scene with a clear focal point',
    hiring_announcement: 'a professional hiring/recruitment scene',
    marketplace_advertisement: 'a vibrant marketplace advertisement scene',
    quote_card: 'a minimal, atmospheric background composition (this style may include a short quote as text)',
    infographic: 'a structured, icon-driven visual composition',
    event_announcement: 'an eye-catching event scene',
    feature_announcement: 'a modern, clean scene representing the feature',
  }

  return [
    `Professional marketing photograph/illustration for "${title}", promoting PaMarket, a Zimbabwean marketplace app.`,
    `Depict the real subject matter described below as an actual photographic or illustrated SCENE — real people, real objects, real settings relevant to the topic. Style: ${styleDescriptions[style] || styleDescriptions.marketplace_advertisement}, sized for ${placement}.`,
    `Brand colors: navy blue (${primary}) and gold (${secondary}) as accent/background tones, not necessarily literal UI elements.`,
    `High-resolution, polished, photo-realistic or high-quality editorial-illustration style (not cartoonish, not low-effort clipart).`,
    `Any people depicted should reflect Zimbabwe's real population mix: predominantly Black African, with white and coloured (mixed-race) Zimbabweans also represented where a group or crowd is shown. Settings, clothing, and details should reflect authentic Zimbabwean/Southern African life.`,
    notes ? `Additional brand guidance: ${notes}.` : '',
    `What this image should depict, based on the actual post content: ${draftBody.slice(0, 300)}`,
    `IMPORTANT: Do NOT depict a phone, app screen, user interface, or any mockup with on-screen text — those consistently render as garbled, illegible gibberish and must be avoided entirely. Do not include any readable text, logos, or captions in the image at all, unless this is explicitly a quote-card style. The scene alone should communicate the subject; the caption lives in the post text, not the image.`,
  ].filter(Boolean).join(' ')
}

// Serverless HF inference endpoints can return 503 "model is loading"
// on a cold start rather than the image itself — a real, common
// condition (not an error case to just fail on), so it's retried with a
// short wait rather than surfaced as a failure on the first attempt. An
// explicit per-attempt timeout keeps a hung request from running until
// the platform kills the whole function with no useful error message.
async function generateImage(apiKey: string, prompt: string, size: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      prompt,
      size,
      n: 1,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`OpenAI image API error ${res.status}: ${errBody.slice(0, 300)}`)
  }

  const data = await res.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI response had no image data')
  return b64
}

async function uploadToR2(base64Data: string, key: string): Promise<string> {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    },
  })

  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
  const bucket = Deno.env.get('R2_PUBLIC_BUCKET')!

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentType: 'image/png',
  }))

  return `${Deno.env.get('R2_PUBLIC_URL')}/${key}`
}
