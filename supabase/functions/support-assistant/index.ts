// PaMarket help assistant: answers a user's support question in the in-app
// Help chat when the local FAQ matcher isn't confident.
//
// Grounded ONLY on PaMarket's own help content — the published FAQ
// (content_pages slug 'faq') plus the bot knowledge base the app sends
// along — and instructed to say so and hand over to a human when the answer
// isn't there, never to invent policies, prices or promises.
//
// Runs on Gemini Flash's free tier (GEMINI_API_KEY Edge Function secret) so
// it costs nothing; if the free quota runs out the app falls back to its
// local FAQ matcher. Signed-in users only, rate limited per user
// (support_assistant_usage).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MODEL = 'gemini-3.8-flash'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const PER_HOUR = 20
const PER_DAY = 60
const MAX_QUESTION_CHARS = 600
const MAX_KB_CHARS = 30_000
const REQUEST_TIMEOUT_MS = 25_000

const SYSTEM = `You are PaMarket Help, the support assistant inside PaMarket, Zimbabwe's online marketplace app and website (buying and selling, jobs, vehicle rentals, local shops, campus listings).

Answer the user's question using ONLY the PaMarket help content provided below. Rules:
- If the help content does not answer the question, say you're not sure and suggest tapping "Talk to a Human". Never guess about PaMarket policies, prices, refunds, account decisions or timelines.
- Keep answers short and practical: 2-6 sentences or a few numbered steps. Plain text only, no markdown headings, no emoji.
- Reply in the same language the user wrote in (English, chiShona or isiNdebele). If unsure, use simple English.
- Safety first: never tell anyone to pay a deposit before seeing an item, share an OTP/PIN/password, or move a conversation off PaMarket to pay. PaMarket does not hold or process payments between buyers and sellers.
- Never ask for or repeat passwords, codes, ID numbers or card details.
- You cannot see the user's account or take actions for them; explain where in the app they can do it themselves.`

type Body = { question?: unknown; kb?: unknown; history?: unknown; lang?: unknown }

// Raw REST shape of an Interaction: the answer is the text content of the
// model's output step(s); thought steps are skipped.
type InteractionContent = { type?: string; text?: unknown }
type InteractionStep = { type?: string; content?: InteractionContent[] }
type Interaction = { status?: string; output_text?: unknown; steps?: InteractionStep[] }

function extractAnswer(interaction: Interaction): string {
  if (typeof interaction.output_text === 'string' && interaction.output_text.trim()) {
    return interaction.output_text.trim()
  }
  const steps = interaction.steps ?? []
  const outputSteps = steps.filter((s) => s.type === 'model_output')
  const candidates = outputSteps.length ? outputSteps : steps.slice(-1)
  return candidates
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('\n')
    .trim()
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'assistant_unavailable' }, 503)

  // Signed-in users only. An app with no session still sends the anon key as
  // a bearer token, which resolves to no user and is refused here.
  const url = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth) return json({ error: 'sign_in_required' }, 401)
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData.user) return json({ error: 'sign_in_required' }, 401)
  const actor = 'u:' + userData.user.id

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

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const [{ count: lastHour }, { count: lastDay }] = await Promise.all([
    db.from('support_assistant_usage').select('id', { count: 'exact', head: true }).eq('actor', actor).gte('created_at', hourAgo),
    db.from('support_assistant_usage').select('id', { count: 'exact', head: true }).eq('actor', actor).gte('created_at', dayAgo),
  ])
  if ((lastHour ?? 0) >= PER_HOUR || (lastDay ?? 0) >= PER_DAY) return json({ error: 'rate_limited' }, 429)
  await db.from('support_assistant_usage').insert({ actor })

  // Published FAQ is the authoritative source; the app's bundled KB adds
  // how-to detail.
  const { data: faqRow } = await db.from('content_pages').select('body').eq('slug', 'faq').eq('status', 'published').maybeSingle()
  const faqItems = ((faqRow?.body as { items?: { group?: string; q?: string; a?: string }[] } | null)?.items ?? [])
    .map((i) => `Q: ${i.q ?? ''}\nA: ${i.a ?? ''}`)
    .join('\n\n')

  // Stateless: the recent turns travel inside this request instead of being
  // stored on Google's side between questions.
  const transcript = history
    .map((m) => `${m.role === 'user' ? 'User' : 'PaMarket Help'}: ${m.text.slice(0, 1500)}`)
    .join('\n')
  const input = transcript
    ? `Earlier in this conversation:\n${transcript}\n\nNew question from the user:\n${question}`
    : question

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: MODEL,
        store: false,
        system_instruction: `${SYSTEM}\n\n=== PaMarket FAQ (published) ===\n${faqItems || '(none)'}\n\n=== PaMarket help topics ===\n${kb || '(none)'}`,
        input,
        generation_config: { thinking_level: 'low', max_output_tokens: 2048 },
      }),
    })
    // 429 = free-tier quota used up; the app falls back to its local FAQ.
    if (res.status === 429) return json({ error: 'busy' }, 503)
    if (!res.ok) {
      console.error('support-assistant Gemini error', res.status, (await res.text()).slice(0, 500))
      return json({ error: 'assistant_unavailable' }, 503)
    }
    const interaction = (await res.json()) as Interaction
    const answer = extractAnswer(interaction)
    if (!answer) {
      console.error('support-assistant empty answer', interaction.status, JSON.stringify(interaction.steps?.map((s) => s.type) ?? []))
      return json({ answer: null, handoff: true })
    }
    const handoff = /talk to a human|not sure|don't know|do not know/i.test(answer)
    return json({ answer, handoff })
  } catch (error) {
    console.error('support-assistant error', error)
    return json({ error: 'assistant_unavailable' }, 503)
  }
})
