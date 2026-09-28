// PaMarket help assistant: answers a user's support question in the in-app
// Help chat when the local FAQ matcher isn't confident.
//
// Grounded ONLY on PaMarket's own help content — the published FAQ
// (content_pages slug 'faq') plus the bot knowledge base the app sends
// along — and instructed to say so and hand over to a human when the answer
// isn't there, never to invent policies, prices or promises.
//
// Guests and signed-in users can both call it; each is rate limited
// (support_assistant_usage) so a script can't run up the API bill.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MODEL = 'claude-opus-5'
const PER_HOUR = 20
const PER_DAY = 60
const MAX_QUESTION_CHARS = 600
const MAX_KB_CHARS = 30_000

const SYSTEM = `You are PaMarket Help, the support assistant inside PaMarket, Zimbabwe's online marketplace app and website (buying and selling, jobs, vehicle rentals, local shops, campus listings).

Answer the user's question using ONLY the PaMarket help content provided below. Rules:
- If the help content does not answer the question, say you're not sure and suggest tapping "Talk to a Human". Never guess about PaMarket policies, prices, refunds, account decisions or timelines.
- Keep answers short and practical: 2-6 sentences or a few numbered steps. Plain text only, no markdown headings, no emoji.
- Reply in the same language the user wrote in (English, chiShona or isiNdebele). If unsure, use simple English.
- Safety first: never tell anyone to pay a deposit before seeing an item, share an OTP/PIN/password, or move a conversation off PaMarket to pay. PaMarket does not hold or process payments between buyers and sellers.
- Never ask for or repeat passwords, codes, ID numbers or card details.
- You cannot see the user's account or take actions for them; explain where in the app they can do it themselves.`

type Body = { question?: unknown; kb?: unknown; history?: unknown; lang?: unknown }

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'assistant_unavailable' }, 503)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION_CHARS) : ''
  if (question.length < 2) return json({ error: 'bad_request' }, 400)
  const kb = typeof body.kb === 'string' ? body.kb.slice(0, MAX_KB_CHARS) : ''
  const history = Array.isArray(body.history)
    ? (body.history as unknown[])
        .filter((m): m is { role: string; text: string } =>
          !!m && typeof m === 'object' && typeof (m as { text?: unknown }).text === 'string' &&
          ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant'))
        .slice(-6)
    : []

  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Actor: the signed-in user, else a hash of the caller's IP (never stored raw).
  let actor = ''
  const auth = req.headers.get('Authorization') ?? ''
  if (auth) {
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data } = await userClient.auth.getUser()
    if (data.user) actor = 'u:' + data.user.id
  }
  if (!actor) {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    actor = 'ip:' + (await sha256(ip + (Deno.env.get('SUPABASE_URL') ?? ''))).slice(0, 32)
  }

  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const [{ count: lastHour }, { count: lastDay }] = await Promise.all([
    db.from('support_assistant_usage').select('id', { count: 'exact', head: true }).eq('actor', actor).gte('created_at', hourAgo),
    db.from('support_assistant_usage').select('id', { count: 'exact', head: true }).eq('actor', actor).gte('created_at', dayAgo),
  ])
  if ((lastHour ?? 0) >= PER_HOUR || (lastDay ?? 0) >= PER_DAY) return json({ error: 'rate_limited' }, 429)
  await db.from('support_assistant_usage').insert({ actor })

  // Published FAQ is the authoritative source; the app's bundled KB adds
  // how-to detail. Both are frozen text, so they sit in the cached system
  // prefix ahead of the per-request question.
  const { data: faqRow } = await db.from('content_pages').select('body').eq('slug', 'faq').eq('status', 'published').maybeSingle()
  const faqItems = ((faqRow?.body as { items?: { group?: string; q?: string; a?: string }[] } | null)?.items ?? [])
    .map((i) => `Q: ${i.q ?? ''}\nA: ${i.a ?? ''}`)
    .join('\n\n')

  const client = new Anthropic({ apiKey })
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text.slice(0, 1500) })),
    { role: 'user', content: question },
  ]
  // The API needs the first message to be from the user.
  while (messages.length && messages[0].role !== 'user') messages.shift()

  try {
    const params = {
      model: MODEL,
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: `${SYSTEM}\n\n=== PaMarket FAQ (published) ===\n${faqItems || '(none)'}\n\n=== PaMarket help topics ===\n${kb || '(none)'}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    }
    const response = await client.beta.messages.create(params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming)
    if (response.stop_reason === 'refusal') {
      return json({ answer: null, handoff: true })
    }
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    if (!answer) return json({ answer: null, handoff: true })
    const handoff = /talk to a human|not sure|don't know|do not know/i.test(answer)
    return json({ answer, handoff })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 503)
    if (error instanceof Anthropic.APIError) {
      console.error('support-assistant API error', error.status, error.message)
      return json({ error: 'assistant_unavailable' }, 503)
    }
    console.error('support-assistant error', error)
    return json({ error: 'assistant_unavailable' }, 503)
  }
})
