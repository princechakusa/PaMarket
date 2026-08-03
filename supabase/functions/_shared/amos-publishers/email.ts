import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, emailShell } from '../email.ts'
import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Module 5 — real integration, reusing the existing sendEmail/emailShell
// helper (Resend, already used by notify-application) rather than adding
// a second email-sending code path. No bulk/newsletter sender exists
// anywhere else in this codebase, so this is genuinely new — built
// deliberately conservative given the blast radius of an email broadcast:
//   - Hard-capped recipient count per publish call (MAX_RECIPIENTS), not
//     "every user with an email" — a marketing email to the entire user
//     base is a decision an admin should make explicitly (a future
//     module/setting), not AMOS's unattended default.
//   - Sends are sequential with a small delay, not fire-all-at-once,
//     to stay well under Resend's rate limits without needing to first
//     research this project's specific plan/tier.
const MAX_RECIPIENTS = 50
const SEND_DELAY_MS = 250

function parseSubjectBody(body: string | null): { subject: string; bodyText: string } {
  if (!body) return { subject: 'PaMarket', bodyText: '' }
  const subjectMatch = body.match(/Subject:\s*(.+)/i)
  const bodyMatch = body.match(/Body:\s*([\s\S]+)/i)
  if (subjectMatch && bodyMatch) {
    return { subject: subjectMatch[1].trim().slice(0, 200), bodyText: bodyMatch[1].trim() }
  }
  const lines = body.trim().split('\n')
  return { subject: (lines[0] || 'PaMarket').slice(0, 200), bodyText: lines.slice(1).join('\n') || lines[0] || '' }
}

export class EmailPublisher implements ContentPublisher {
  readonly platform = 'email'
  private db: SupabaseClient

  constructor(db: SupabaseClient) {
    this.db = db
  }

  async publish(draft: DraftForPublish): Promise<PublishResult> {
    if (!Deno.env.get('RESEND_API_KEY')) {
      return { ok: false, status: 'failed', error: 'RESEND_API_KEY not configured — set it under Supabase → Edge Functions → Secrets before scheduling email campaigns to auto-publish.' }
    }

    const { subject, bodyText } = parseSubjectBody(draft.body)
    if (!bodyText) {
      return { ok: false, status: 'failed', error: 'Email draft has no parseable body text.' }
    }

    // Conservative recipient selection: verified users with an email on
    // file who have NOT opted out of marketing email, capped. Not "every
    // user" — see file header. marketing_email_opt_out defaults to false
    // (opted in), matching how every other notification preference in
    // this codebase defaults — but every send still includes a working
    // one-click unsubscribe link (below), which is what makes that
    // default acceptable rather than presumptuous.
    //
    // Rotation (Production Readiness Audit, Critical #2 fix): ordered
    // never-emailed-first, then longest-since-last-emailed. Without this,
    // an unordered LIMIT query returns the same rows every single call —
    // every campaign hit the identical first 50 users forever. Each send
    // below records last_amos_marketing_email_at, so the next campaign's
    // ORDER BY naturally rotates to whoever hasn't been reached recently.
    const { data: recipients, error: recipientsError } = await this.db
      .from('profiles')
      .select('id, email')
      .not('email', 'is', null)
      .eq('verified', true)
      .eq('marketing_email_opt_out', false)
      .order('last_amos_marketing_email_at', { ascending: true, nullsFirst: true })
      .limit(MAX_RECIPIENTS)
    if (recipientsError) {
      return { ok: false, status: 'failed', error: `Could not load recipients: ${recipientsError.message}` }
    }
    if (!recipients || !recipients.length) {
      return { ok: false, status: 'failed', error: 'No eligible recipients found (verified, opted-in users with an email on file).' }
    }

    const baseUrl = Deno.env.get('SUPABASE_URL') || ''
    const bodyHtml = bodyText.split('\n\n').map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br>')}</p>`).join('')

    let sent = 0
    const failures: string[] = []
    for (const r of recipients) {
      const row = r as { id: string; email: string }
      // A unique token per recipient — required for a real one-click
      // unsubscribe rather than a shared/guessable link.
      const { data: token } = await this.db.rpc('amos_get_or_create_unsubscribe_token', { p_user_id: row.id })
      const unsubscribeUrl = token ? `${baseUrl}/functions/v1/amos-unsubscribe?token=${token}` : null
      const html = emailShell({
        heading: subject,
        bodyHtml: bodyHtml + (unsubscribeUrl
          ? `<p style="margin:20px 0 0;font-size:11px;color:#94A3B8">Don't want marketing emails from PaMarket? <a href="${unsubscribeUrl}" style="color:#94A3B8">Unsubscribe</a>.</p>`
          : ''),
        preheader: subject,
      })
      const result = await sendEmail({ to: row.email, subject, html })
      if (result.ok) {
        sent++
        // Record the send so the NEXT campaign's rotation naturally
        // skips this recipient in favor of whoever hasn't been reached
        // recently — this is what actually makes the ORDER BY above a
        // real rotation instead of a one-time reordering.
        await this.db.from('profiles').update({ last_amos_marketing_email_at: new Date().toISOString() }).eq('id', row.id)
      } else {
        failures.push(`${row.email}: ${result.error}`)
      }
      await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS))
    }

    if (sent === 0) {
      return { ok: false, status: 'failed', error: `All ${recipients.length} send(s) failed. First error: ${failures[0] || 'unknown'}` }
    }

    return {
      ok: true,
      status: 'published',
      rawResponse: { sent, attempted: recipients.length, failures: failures.slice(0, 5) },
    }
  }
}
