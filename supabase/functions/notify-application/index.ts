// notify-application — transactional emails around job applications, wired via
// a Supabase Database Webhook on public.applications (INSERT + UPDATE). Covers
// BOTH web- and app-submitted applications with one hook.
//
//   INSERT  → email the employer ("New application")   [reply-to = applicant]
//           + email the applicant ("Application sent")  [receipt]
//   UPDATE  → if status changed to shortlisted/declined, email the applicant
//             ("Update on your application")
//
// The applicant's email is on the application row; the employer's email is
// looked up from auth.users by employer_id (service role). Failures are logged
// but never 500 the webhook — a missing/blocked email must not break applying.
//
// Deploy:  supabase functions deploy notify-application --no-verify-jwt
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
//   NOTIFY_WEBHOOK_SECRET                    (must match the webhook header)
//   RESEND_API_KEY                           (https://resend.com → API Keys)
// Optional:
//   EMAIL_FROM   (default 'PaMarket <noreply@pamarketzw.com>')

import { sendEmail, emailShell, esc } from '../_shared/email.ts';

const SITE = 'https://pamarketzw.com';

function json(d: unknown, s?: number) {
  return new Response(JSON.stringify(d), { status: s || 200, headers: { 'Content-Type': 'application/json' } });
}

function answersHtml(answers: unknown): string {
  if (!Array.isArray(answers) || !answers.length) return '';
  const rows = answers
    .filter((a: any) => a && a.answer)
    .map((a: any) => `<div style="margin-bottom:10px"><div style="font-weight:700;font-size:13px">${esc(a.question)}</div><div style="font-size:14px;color:#334155">${esc(a.answer)}</div></div>`)
    .join('');
  if (!rows) return '';
  return `<div style="margin-top:16px;padding-top:14px;border-top:1px solid #E2E8F0"><div style="font-weight:800;font-size:13px;margin-bottom:10px">Screening answers</div>${rows}</div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  try {
    const expected = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
    if (!expected) { console.error('NOTIFY_WEBHOOK_SECRET not set'); return json({ error: 'misconfigured' }, 500); }
    if (req.headers.get('x-webhook-secret') !== expected) return json({ error: 'unauthorized' }, 401);

    const payload = await req.json();
    const type = payload?.type || (payload?.old_record ? 'UPDATE' : 'INSERT');
    const record = payload?.record || payload?.new || payload;
    const oldRecord = payload?.old_record || payload?.old || null;
    if (!record || !record.id) return json({ skipped: 'no record' });

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const jobTitle = record.job_title || 'your job posting';
    const company = record.company || 'the employer';
    const applicantName = record.applicant_name || 'A candidate';
    const applicantEmail = record.applicant_email || '';
    const applicantPhone = record.applicant_phone || '';

    // ── UPDATE: status change → tell the applicant ──
    if (type === 'UPDATE') {
      const newStatus = record.status;
      const changed = oldRecord && oldRecord.status !== newStatus;
      if (!changed || (newStatus !== 'shortlisted' && newStatus !== 'declined')) {
        return json({ skipped: 'no notifiable status change' });
      }
      if (!applicantEmail) return json({ skipped: 'no applicant email' });

      const shortlisted = newStatus === 'shortlisted';
      const heading = shortlisted ? "You've been shortlisted! 🎉" : 'Update on your application';
      const bodyHtml = shortlisted
        ? `<p style="margin:0 0 12px">Good news — <strong>${esc(company)}</strong> has shortlisted your application for <strong>${esc(jobTitle)}</strong>.</p>
           <p style="margin:0">They may contact you directly using the details you provided. Keep an eye on your phone and inbox.</p>`
        : `<p style="margin:0 0 12px">Thank you for applying for <strong>${esc(jobTitle)}</strong> at <strong>${esc(company)}</strong>.</p>
           <p style="margin:0">On this occasion the employer has decided not to take your application further. Don't be discouraged — new roles are posted on PaMarket every day.</p>`;
      const r = await sendEmail({
        to: applicantEmail,
        subject: shortlisted ? `You've been shortlisted for ${jobTitle}` : `Update on your application for ${jobTitle}`,
        html: emailShell({ heading, bodyHtml, ctaText: shortlisted ? 'Browse more jobs' : 'Find another role', ctaUrl: SITE + '/jobs', preheader: shortlisted ? 'An employer shortlisted you.' : 'An update on your PaMarket application.' }),
      });
      if (!r.ok) console.error('notify-application: applicant status email failed:', r.error);
      return json({ ok: true, sent: r.ok ? ['applicant_status'] : [] });
    }

    // ── INSERT: notify employer + receipt to applicant ──
    const sent: string[] = [];

    // Employer email — looked up from auth.users by employer_id.
    let employerEmail = '';
    if (record.employer_id) {
      const ur = await db.auth.admin.getUserById(String(record.employer_id));
      employerEmail = ur.data?.user?.email || '';
    }
    if (employerEmail) {
      const contact = [
        applicantEmail ? `Email: <a href="mailto:${esc(applicantEmail)}" style="color:#1A3A8F">${esc(applicantEmail)}</a>` : '',
        applicantPhone ? `Phone: ${esc(applicantPhone)}` : '',
      ].filter(Boolean).join(' &nbsp;·&nbsp; ');
      const bodyHtml =
        `<p style="margin:0 0 12px"><strong>${esc(applicantName)}</strong> applied for <strong>${esc(jobTitle)}</strong>.</p>` +
        (contact ? `<div style="font-size:13.5px;color:#334155;margin-bottom:12px">${contact}</div>` : '') +
        (record.message ? `<div style="background:#F8FAFC;border-radius:10px;padding:12px 14px;font-size:14px;color:#334155;white-space:pre-wrap">${esc(record.message)}</div>` : '') +
        answersHtml(record.answers);
      const r = await sendEmail({
        to: employerEmail,
        subject: `New application: ${jobTitle}`,
        html: emailShell({ heading: 'You have a new applicant', bodyHtml, ctaText: 'Review applications', ctaUrl: SITE + '/applications', preheader: `${applicantName} applied for ${jobTitle}.` }),
        replyTo: applicantEmail || undefined, // reply goes straight to the candidate
      });
      if (r.ok) sent.push('employer'); else console.error('notify-application: employer email failed:', r.error);
    }

    // Applicant receipt.
    if (applicantEmail) {
      const bodyHtml =
        `<p style="margin:0 0 12px">Your application for <strong>${esc(jobTitle)}</strong> at <strong>${esc(company)}</strong> has been sent. ✅</p>` +
        `<p style="margin:0">The employer can now review your details and will contact you directly if you're a match. Applying on PaMarket is always free — never pay anyone a fee to apply.</p>`;
      const r = await sendEmail({
        to: applicantEmail,
        subject: `Application sent: ${jobTitle}`,
        html: emailShell({ heading: 'Your application is on its way', bodyHtml, ctaText: 'Browse more jobs', ctaUrl: SITE + '/jobs', preheader: `We sent your application for ${jobTitle}.` }),
      });
      if (r.ok) sent.push('applicant'); else console.error('notify-application: applicant receipt failed:', r.error);
    }

    return json({ ok: true, sent });
  } catch (err) {
    console.error('notify-application error:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
