import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Module 5 — real integration, reusing the existing send-push edge
// function rather than reimplementing FCM's service-account OAuth/JWT
// signing (send-push already has that, already batches over push_tokens,
// already targets all/sellers/buyers/province-filtered audiences). This
// adapter is a thin caller, not a parallel push pipeline.
//
// Deliberately conservative default: target='sellers' with a small,
// engaged audience, not 'all' — a marketing broadcast to PaMarket's
// entire user base is a real, high-blast-radius action that should be a
// deliberate choice, not AMOS's default the first time this is wired up.
// A future admin-configurable audience setting can widen this; changing
// the default requires a deliberate code change, not an accidental one.
const DEFAULT_PUSH_TARGET = 'sellers'

function parseTitleBody(body: string | null): { title: string; message: string } {
  if (!body) return { title: 'PaMarket', message: '' }
  const titleMatch = body.match(/Title:\s*(.+)/i)
  const bodyMatch = body.match(/Body:\s*([\s\S]+)/i)
  if (titleMatch && bodyMatch) {
    return { title: titleMatch[1].trim().slice(0, 100), message: bodyMatch[1].trim().slice(0, 500) }
  }
  // Fallback: generation prompt asked for "Title: ...\nBody: ..." but if a
  // draft was hand-edited and lost that structure, use the first line as
  // the title and the rest as the body rather than failing the publish.
  const lines = body.trim().split('\n')
  return { title: (lines[0] || 'PaMarket').slice(0, 100), message: (lines.slice(1).join(' ') || lines[0] || '').slice(0, 500) }
}

export class PushPublisher implements ContentPublisher {
  readonly platform = 'push'

  async publish(draft: DraftForPublish): Promise<PublishResult> {
    const automationSecret = Deno.env.get('AUTOMATION_SECRET') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    if (!automationSecret || !supabaseUrl) {
      return { ok: false, status: 'failed', error: 'AUTOMATION_SECRET or SUPABASE_URL not configured for push dispatch.' }
    }

    const { title, message } = parseTitleBody(draft.body)
    if (!message) {
      return { ok: false, status: 'failed', error: 'Push draft has no parseable body text.' }
    }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-automation-secret': automationSecret },
        // 'promotion' — NOT 'promo' — is the exact type key send-push's
        // PREFERENCE_COLUMN_BY_TYPE maps to the 'promotions' opt-out
        // column. Any type string not in that map silently skips
        // preference filtering entirely, so getting this exact value
        // right is what makes AMOS pushes respect a user's notification
        // settings instead of bypassing them.
        body: JSON.stringify({ target: DEFAULT_PUSH_TARGET, title, body: message, type: 'promotion' }),
      })
      const responseBody = await res.json().catch(() => ({}))

      if (!res.ok) {
        return { ok: false, status: 'failed', error: responseBody?.error || `send-push responded ${res.status}`, rawResponse: responseBody }
      }

      return { ok: true, status: 'published', rawResponse: responseBody }
    } catch (error) {
      return { ok: false, status: 'failed', error: error instanceof Error ? error.message : String(error) }
    }
  }
}
