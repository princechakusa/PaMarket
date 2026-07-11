# Job application emails — deployment

Sends transactional email around job applications, for BOTH web- and
app-submitted applications (one database webhook covers both):

- New application → employer gets "New application" (reply-to = the
  candidate, so hitting Reply emails them), and the candidate gets an
  "Application sent" receipt.
- Employer shortlists / declines → the candidate gets a status email.

## 1. Get a Resend API key + verify your domain

1. Sign up at https://resend.com (free tier is plenty to start).
2. Add and verify the domain **pamarketzw.com** (Resend → Domains → add
   the DNS records it shows at your domain registrar). Verifying the
   domain is what lets mail come *from* a PaMarket address and land in
   inboxes instead of spam.
3. Create an API key (Resend → API Keys).

Until the domain is verified you can still test: Resend lets you send from
`onboarding@resend.dev`, but only to the email address that owns the
Resend account. Set `EMAIL_FROM` accordingly while testing.

## 2. Set the Edge Function secrets

    supabase secrets set RESEND_API_KEY=re_xxxxxxxx
    supabase secrets set EMAIL_FROM="PaMarket <noreply@pamarketzw.com>"
    # Reuse the SAME secret the message-notification webhook already uses,
    # or set one if you haven't:
    supabase secrets set NOTIFY_WEBHOOK_SECRET=<a-long-random-string>

## 3. Deploy the function

    supabase functions deploy notify-application --no-verify-jwt

`--no-verify-jwt` is required because the database webhook calls it with a
custom header (`x-webhook-secret`), not a Supabase JWT. The function
rejects any request whose `x-webhook-secret` doesn't match
`NOTIFY_WEBHOOK_SECRET`.

## 4. Create the database webhook

In the Supabase dashboard → Database → Webhooks → Create a new hook:

- **Table:** `public.applications`
- **Events:** Insert **and** Update
- **Type:** Supabase Edge Function → `notify-application`
- **HTTP headers:** add `x-webhook-secret` = the same value you set for
  `NOTIFY_WEBHOOK_SECRET`.

(This mirrors the existing `notify-message` webhook on `public.messages`.)

## 5. Test

1. Apply to one of your own jobs from a second account — the employer
   account should receive the "New application" email and the applicant
   the receipt.
2. In `/applications`, Shortlist that candidate — they should get the
   "You've been shortlisted" email.

If nothing arrives, check the function logs (`supabase functions logs
notify-application`); a missing `RESEND_API_KEY`, an unverified domain, or
a wrong `x-webhook-secret` are the usual causes. Email failures are logged
but never block an application from being submitted.
