// Shared transactional-email helper (Resend HTTP API).
//
// Resend was chosen because it sends straight from a Deno Edge Function over
// plain HTTPS (no SMTP), has a generous free tier, and verifies a custom
// domain (pamarketzw.com) so mail is sent from a PaMarket address rather than
// a shared sandbox.
//
// Required Edge Function secret:
//   RESEND_API_KEY   (from https://resend.com → API Keys)
// Optional:
//   EMAIL_FROM       (default 'PaMarket <noreply@pamarketzw.com>' — the domain
//                     must be verified in Resend before mail will deliver)

export interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not set' };
  if (!opts.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(opts.to)) return { ok: false, error: 'invalid recipient' };

  const from = Deno.env.get('EMAIL_FROM') || 'PaMarket <noreply@pamarketzw.com>';
  const body: Record<string, unknown> = { from, to: [opts.to], subject: opts.subject, html: opts.html };
  if (opts.replyTo) body.reply_to = opts.replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, error: 'Resend ' + res.status + ': ' + t.slice(0, 200) };
  }
  return { ok: true };
}

export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// Branded HTML shell shared by every PaMarket email, so they all look alike.
export function emailShell(opts: { heading: string; bodyHtml: string; ctaText?: string; ctaUrl?: string; preheader?: string }): string {
  const cta = (opts.ctaText && opts.ctaUrl)
    ? `<tr><td style="padding:8px 0 4px"><a href="${esc(opts.ctaUrl)}" style="display:inline-block;background:#1A3A8F;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px">${esc(opts.ctaText)}</a></td></tr>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F172A">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden">
<tr><td style="background:#0F2460;padding:20px 28px">
<span style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-.02em">Pa<span style="color:#E8A33D">Market</span></span>
</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:20px;font-weight:800;letter-spacing:-.01em">${esc(opts.heading)}</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:14.5px;line-height:1.65;color:#334155">${opts.bodyHtml}</td></tr>${cta}</table>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;line-height:1.6">
PaMarket — Zimbabwe's free marketplace. You're receiving this because you used PaMarket Hire Talent.<br>
Never pay a fee to apply for a job. Report suspicious activity to <a href="mailto:support@pamarketzw.com" style="color:#1A3A8F">support@pamarketzw.com</a>.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
