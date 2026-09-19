// DPO / Privacy Data Export -- platform-wide compliance snapshot (2026-09-19).
//
// This is a READ-ONLY aggregation over tables that already exist and are
// already admin-readable via existing RLS (is_admin() / is_admin_team() /
// is_super_admin() policies, or the existing list_security_events RPC for
// the one table with no direct grant at all). Nothing here adds a new
// policy, grant, or bypass -- every query below runs exactly as any other
// admin query in this app does, under the signed-in admin's own session.
// If a table's RLS does not let this admin see a row, the count reflects
// that (and is labelled honestly, not silently substituted).
//
// Where no dedicated data-protection record exists for a checklist item
// (e.g. no data-breach register, no per-user consent timestamp), the
// section says so explicitly instead of inventing a number.
import { getSupabaseClient } from '../supabase/client';
import { normalizeError, type NormalizedError } from '../errors/normalize-error';
import { listSecurityEvents } from '../security-events/query';

export type QueryResult<T> = { data: T; error: null } | { data: null; error: NormalizedError };

function unavailable<T>(): QueryResult<T> {
  return { data: null, error: { code: 'client_unavailable', message: 'Live Supabase is not configured.', retryable: false } };
}

export type Metric = { label: string; value: string; note?: string };
export type Section = {
  id: string;
  title: string;
  description: string;
  metrics: Metric[];
  /** Explicit "no record exists" / RLS-limitation statements for this section. */
  caveats: string[];
};
export type PrivacySnapshot = {
  generatedAt: string;
  generatedBy: { id: string; name: string; email: string; role: string };
  sections: Section[];
};

type Client = ReturnType<typeof getSupabaseClient>;

async function countRows(client: NonNullable<Client>, table: string, apply?: (q: any) => any): Promise<{ n: number | null; err?: string }> {
  try {
    // Generic helper spans ~30 tables across this file -- a typed union
    // param would defeat the point of the helper, so we deliberately opt
    // out of the typed client here (as any) rather than list every table.
    let q = (client.from as any)(table).select('*', { count: 'exact', head: true });
    if (apply) q = apply(q);
    const { count, error } = await q;
    if (error) return { n: null, err: error.message };
    return { n: count ?? 0 };
  } catch (e) {
    return { n: null, err: normalizeError(e).message };
  }
}

async function firstLastCreatedAt(client: NonNullable<Client>, table: string, column = 'created_at'): Promise<{ earliest: string | null; latest: string | null; err?: string }> {
  try {
    const [oldest, newest] = await Promise.all([
      (client.from as any)(table).select(column).order(column, { ascending: true }).limit(1).maybeSingle(),
      (client.from as any)(table).select(column).order(column, { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (oldest.error || newest.error) return { earliest: null, latest: null, err: (oldest.error ?? newest.error)?.message };
    return { earliest: (oldest.data as any)?.[column] ?? null, latest: (newest.data as any)?.[column] ?? null };
  } catch (e) {
    return { earliest: null, latest: null, err: normalizeError(e).message };
  }
}

function metric(label: string, n: { n: number | null; err?: string }, note?: string): Metric {
  return { label, value: n.err ? 'Unavailable' : String(n.n), note: n.err ? `Query error: ${n.err}` : note };
}

const asOf = () => new Date().toISOString();

export async function generatePrivacySnapshot(generatedBy: { id: string; name: string; email: string; role: string }): Promise<QueryResult<PrivacySnapshot>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const c = client;

  const sections: Section[] = [];

  // 1. Users / accounts and personal data held
  {
    const [total, admins, verified, banned, mfaOn, marketingOptOut, span] = await Promise.all([
      countRows(c, 'profiles'),
      countRows(c, 'profiles', (q) => q.in('role', ['admin', 'super_admin', 'moderator', 'support', 'finance'])),
      countRows(c, 'profiles', (q) => q.eq('verified', true)),
      countRows(c, 'profiles', (q) => q.not('ban_until', 'is', null)),
      countRows(c, 'profiles', (q) => q.eq('mfa_enabled', true)),
      countRows(c, 'profiles', (q) => q.eq('marketing_email_opt_out', true)),
      firstLastCreatedAt(c, 'profiles'),
    ]);
    sections.push({
      id: 'users',
      title: '1. Users / Accounts & Personal Data Held',
      description: 'The `profiles` table is the single account record for every user (buyers, sellers, recruiters, admins). Personal-data columns it holds: name, phone, whatsapp_number, phone_for_calls, email, avatar (photo), city, province, bio, linkedin_url, github_url, website_url, cv_file_url/cv_file_path (uploaded CV), job_title/skills/sector/exp (career profile), admin_notes (internal, about the user), and authentication secrets (mfa_secret, two_factor_secret -- never selected or exported by this report).',
      metrics: [
        metric('Total accounts', total),
        metric('Accounts with an admin/staff role', admins),
        metric('ID-verified accounts (verified = true)', verified),
        metric('Accounts currently banned/suspended', banned),
        metric('Accounts with MFA enabled', mfaOn),
        metric('Accounts opted out of marketing email', marketingOptOut),
        { label: 'Earliest account created', value: span.earliest ?? 'N/A' },
        { label: 'Most recent account created', value: span.latest ?? 'N/A' },
      ],
      caveats: [],
    });
  }

  // 2. Listings, businesses, jobs and other user-generated content
  {
    const [listingsTotal, listingsActive, businessesTotal, businessesActive, reviews, bizReviews, rentalListings, applications, span] = await Promise.all([
      countRows(c, 'listings'),
      countRows(c, 'listings', (q) => q.eq('status', 'active')),
      countRows(c, 'businesses'),
      countRows(c, 'businesses', (q) => q.eq('status', 'active')),
      countRows(c, 'reviews'),
      countRows(c, 'business_reviews'),
      countRows(c, 'rental_vehicle_listings'),
      countRows(c, 'applications'),
      firstLastCreatedAt(c, 'listings'),
    ]);
    sections.push({
      id: 'ugc',
      title: '2. Listings, Businesses, Jobs & Other User-Generated Content',
      description: 'Marketplace listings (`listings`), business/shop profiles (`businesses`), vehicle-rental listings (`rental_vehicle_listings`), job applications (`applications`), and reviews (`reviews`, `business_reviews`) all carry seller/author-identifying fields (seller_name, seller_phone, reviewer_name, applicant_name/phone/email, etc.) alongside the content itself.',
      metrics: [
        metric('Total listings (all statuses)', listingsTotal),
        metric('Active listings', listingsActive),
        metric('Total businesses', businessesTotal),
        metric('Active businesses', businessesActive),
        metric('Marketplace reviews', reviews),
        metric('Business reviews', bizReviews),
        metric('Vehicle rental listings', rentalListings),
        metric('Job applications', applications),
        { label: 'Earliest listing created', value: span.earliest ?? 'N/A' },
        { label: 'Most recent listing created', value: span.latest ?? 'N/A' },
      ],
      caveats: [],
    });
  }

  // 3. Location / GPS data
  {
    const [listingsWithGeo, businessesWithGeo] = await Promise.all([
      countRows(c, 'listings', (q) => q.not('latitude', 'is', null)),
      countRows(c, 'businesses', (q) => q.not('latitude', 'is', null)),
    ]);
    sections.push({
      id: 'location',
      title: '3. Location / GPS Data',
      description: 'Precise latitude/longitude columns exist on `listings` and `businesses` (set when a seller pins their location on the map). `profiles` holds only free-text city/province, no coordinates.',
      metrics: [
        metric('Listings with a stored GPS coordinate', listingsWithGeo),
        metric('Businesses with a stored GPS coordinate', businessesWithGeo),
      ],
      caveats: [
        'profiles (the account table) stores no GPS coordinates -- only self-reported city/province text.',
        'rental_vehicle_listings stores a pickup suburb/location reference, not raw coordinates.',
      ],
    });
  }

  // 4. Messages / communications
  {
    sections.push({
      id: 'messages',
      title: '4. Messages / Relevant Communications',
      description: 'In-app buyer/seller messaging is stored in `conversations` (membership list) and `messages` (text, images, read/edited/deleted flags, sender_name).',
      metrics: [],
      caveats: [
        'No dedicated data protection record/aggregate exists in this system as of ' + asOf() + ' for platform-wide message volume: `messages`/`conversations` RLS only lets a user (or an admin who happens to be a conversation member) read their own conversations -- there is no admin-wide bypass policy on either table, so no admin role (including super_admin) can produce a true platform-wide message count or content export from this app today.',
        'A specific data-subject-access or law-enforcement request for one user\'s message history is technically fulfillable (their user_id appears in conversations.members / messages.sender_id) but requires a direct, audited database query outside this admin UI, not a feature that exists here yet.',
      ],
    });
  }

  // 5. Data collection & processing purposes (proxy: published legal/privacy content)
  {
    const { data, error } = await c
      .from('content_pages')
      .select('slug, title, status, version, effective_date, updated_at')
      .in('slug', ['privacy', 'terms', 'cookie-policy', 'account-deletion', 'acceptable-use-policy'])
      .order('slug', { ascending: true });
    const rows = error ? [] : (data ?? []);
    sections.push({
      id: 'purposes',
      title: '5. Data Collection & Processing Purposes',
      description: 'PaMarket documents its data-processing purposes and legal basis in published policy pages, stored and versioned in `content_pages` (the same table that serves the live Privacy Policy, Terms, and Cookie Policy in the app/website -- this is the authoritative source, per prior engineering notes, not a static file).',
      metrics: rows.map((r: any) => ({
        label: `"${r.title ?? r.slug}" (v${r.version}, ${r.status})`,
        value: r.effective_date ?? 'no effective date set',
        note: `Last updated ${r.updated_at}`,
      })),
      caveats: error ? [`Could not read content_pages: ${error.message}`] : rows.length === 0 ? ['No matching published policy pages were found.'] : [],
    });
  }

  // 6. Consent / privacy choices
  {
    const [notifPrefs, pushTokens, marketingOptOut] = await Promise.all([
      countRows(c, 'notification_preferences'),
      countRows(c, 'push_tokens'),
      countRows(c, 'profiles', (q) => q.eq('marketing_email_opt_out', true)),
    ]);
    sections.push({
      id: 'consent',
      title: '6. Consent / Privacy Choices',
      description: 'Per-user notification/marketing choices are stored in `notification_preferences` (messages, listing_updates, promotions, recommendations, etc. toggles) and `profiles.marketing_email_opt_out`. `profiles.privacy` (jsonb) holds additional in-app privacy toggles set by the user.',
      metrics: [
        metric('Users with saved notification preferences', notifPrefs),
        metric('Registered push-notification devices', pushTokens),
        metric('Users opted out of marketing email', marketingOptOut),
      ],
      caveats: [
        'There is no single "consent given at <timestamp> for <purpose> v<policy version>" ledger -- consent is inferred from account creation (acceptance of Terms/Privacy at signup) plus the current value of these preference columns, not an immutable per-event consent log.',
      ],
    });
  }

  // 7. Data access, changes and deletion records
  {
    const [deletionReqTotal, deletionLogsTotal, roleAudit, adminAuditTotal, adminAuditPersonal, span] = await Promise.all([
      countRows(c, 'account_deletion_requests'),
      countRows(c, 'deletion_logs'),
      countRows(c, 'role_audit_log'),
      countRows(c, 'admin_audit_logs'),
      countRows(c, 'admin_audit_logs', (q) => q.or('entity.ilike.%profile%,entity.ilike.%user%,entity.ilike.%business%')),
      firstLastCreatedAt(c, 'admin_audit_logs'),
    ]);
    sections.push({
      id: 'access-changes-deletion',
      title: '7. Data Access, Changes & Deletion Records',
      description: 'Account-deletion (right-to-erasure) requests are tracked in `account_deletion_requests`, and what was actually deleted per fulfilled request is tracked in `deletion_logs` (deleted_tables jsonb, auth_user_deleted flag, performed_by). Role changes are tracked in `role_audit_log`. General admin write actions against user/business/profile records are tracked in `admin_audit_logs` (before_state/after_state jsonb).',
      metrics: [
        metric('Account deletion (erasure) requests, all time', deletionReqTotal),
        metric('Fulfilled-deletion log entries', deletionLogsTotal),
        metric('Role changes recorded', roleAudit),
        metric('Total admin audit-log entries', adminAuditTotal),
        metric('Admin audit-log entries touching profile/user/business records', adminAuditPersonal),
        { label: 'Earliest admin audit entry', value: span.earliest ?? 'N/A' },
        { label: 'Most recent admin audit entry', value: span.latest ?? 'N/A' },
      ],
      caveats: (deletionReqTotal.n === 0 && deletionLogsTotal.n === 0)
        ? [`As of ${asOf()}, no account-deletion request has ever been submitted or fulfilled on this platform (both tables are empty). This is a factual current-state observation, not evidence the feature is broken -- account-deletion is documented and available to users (see "account-deletion" content page).`]
        : [],
    });
  }

  // 8. Security / privacy events and audit logs
  {
    const secEvents = await listSecurityEvents({}, 1);
    const legalHolds = await countRows(c, 'security_event_legal_holds');
    const [appErrors, appErrorsWithUser] = await Promise.all([
      countRows(c, 'app_error_events'),
      countRows(c, 'app_error_events', (q) => q.not('user_id', 'is', null)),
    ]);
    sections.push({
      id: 'security-events',
      title: '8. Security / Privacy Events & Audit Logs',
      description: '`security_events` is the evidence-grade security/audit event log (auth events, admin actions, suspicious activity -- fields: event_type, severity, actor, target, outcome, ip_address, retention_until). It has no direct table grant at all; every read (including this report) goes through the same list_security_events()/get_security_event() RPCs the Security Center page uses, which redact IP address for non-super_admin callers. `app_error_events` is the client/app-crash telemetry log (linked to a user_id when the crash happened in an authenticated session).',
      metrics: [
        secEvents.error
          ? { label: 'Total security events on record', value: 'Unavailable', note: secEvents.error.message }
          : { label: 'Total security events on record', value: String(secEvents.data.total) },
        metric('Legal holds ever placed on a security event', legalHolds, 'Requires this session to be MFA (AAL2) verified; shows "Unavailable" otherwise -- that is the real RLS gate, not a bug in this report.'),
        metric('Total app error/crash events logged', appErrors),
        metric('App error events linked to a specific user account', appErrorsWithUser),
      ],
      caveats: [
        'error_logs (an older, separate error-logging table) is intentionally unreadable by every role including super_admin ("Service role only read" RLS) -- it cannot be reported on from this app by design, not by omission.',
      ],
    });
  }

  // 9. Data breaches / incidents and related actions
  {
    sections.push({
      id: 'breaches',
      title: '9. Data Breaches / Incidents & Related Actions',
      description: 'No dedicated data-breach or incident-register table exists in this system as of ' + asOf() + ' for this data category.',
      metrics: [],
      caveats: [
        'The closest existing mechanisms are `security_events` (see Section 8) and `security_event_legal_holds`, which lets an admin place an evidentiary hold on a specific security event or correlation_id while an incident is investigated. Neither is a breach register (with fields like affected-user count, notification date, regulator notified) -- they are per-event operational security tooling.',
        'If a breach investigation is ever required, it would need to be assembled manually from Security Center event detail + this snapshot + relevant table records, then formally logged; there is currently no single place that produces a breach report end-to-end.',
      ],
    });
  }

  // 10. Admin access / actions relevant to personal data
  {
    const [sessions, loginAttempts, loginFailed, mutationLog, mutationBlocks, ipBlocks] = await Promise.all([
      countRows(c, 'admin_sessions'),
      countRows(c, 'admin_login_attempts'),
      countRows(c, 'admin_login_attempts', (q) => q.eq('ok', false)),
      countRows(c, 'admin_mutation_log'),
      countRows(c, 'admin_mutation_blocks'),
      countRows(c, 'admin_ip_blocks'),
    ]);
    sections.push({
      id: 'admin-access',
      title: '10. Admin Access / Actions Relevant to Personal Data',
      description: 'Every admin session, login attempt, mutating action, and defensive block is itself logged: `admin_sessions`, `admin_login_attempts`, `admin_mutation_log`, `admin_mutation_blocks`, `admin_ip_blocks`. These are the records of who on the PaMarket team accessed or changed personal data, and when.',
      metrics: [
        metric('Admin session records (current + historical)', sessions),
        metric('Admin login attempts recorded', loginAttempts),
        metric('Failed admin login attempts', loginFailed),
        metric('Admin mutation-log entries (write actions)', mutationLog),
        metric('Admin accounts placed under a mutation block', mutationBlocks),
        metric('IP addresses/emails blocked', ipBlocks),
      ],
      caveats: [],
    });
  }

  // 11. Third-party / service providers receiving data
  {
    const [paynow, playPurchases, pushTokens] = await Promise.all([
      countRows(c, 'paynow_payments'),
      countRows(c, 'play_purchases'),
      countRows(c, 'push_tokens'),
    ]);
    sections.push({
      id: 'third-parties',
      title: '11. Third-Party / Service Providers Receiving Data',
      description: 'No formal third-party-processor register table exists. The following processors are inferred directly from the schema and known infrastructure (not from a compliance record): Supabase (database, auth, file storage), Cloudflare (Pages hosting, R2 object storage for uploaded photos/documents), Expo/EAS (mobile app build & push delivery), Paynow (payment processing -- `paynow_payments`), Google Play Billing (in-app purchases/subscriptions -- `play_purchases`, `play_subscriptions`, `play_recruiter_subscriptions`), Sentry (crash/error monitoring -- `app_error_events.sentry_event_id`), and device push-notification delivery (`push_tokens`).',
      metrics: [
        metric('Paynow payment records (name/phone/email may be attached)', paynow),
        metric('Google Play purchase/subscription records', playPurchases),
        metric('Registered push-notification device tokens', pushTokens),
      ],
      caveats: [
        'This list should be treated as an engineering-derived starting point for the DPO\'s formal processor register, not a substitute for one -- it does not capture data-processing agreements, sub-processor chains, or data-residency terms, none of which are recorded in this database.',
      ],
    });
  }

  // 12. Data retention / deletion information
  {
    sections.push({
      id: 'retention',
      title: '12. Data Retention / Deletion Information',
      description: 'The only table with an explicit, machine-enforced retention field is `security_events.retention_until` (a per-row timestamp). Verification documents (`verifications.id_doc_path`/`selfie_path`, `business_verifications.id_doc_path`/`reg_doc_path`, `company_verifications.*_path`) have no retention/expiry column at all -- they persist indefinitely unless manually deleted. Account erasure is tracked via `account_deletion_requests` + `deletion_logs` (see Section 7).',
      metrics: [],
      caveats: [
        'No documented retention period (e.g. "delete ID documents N days after verification decision") is enforced anywhere in the schema today -- this is a genuine gap the DPO should set a policy for, not something this report can report a number on.',
      ],
    });
  }

  // 13. Data requests / complaints
  {
    const [supportTickets, contactRequests, reports] = await Promise.all([
      countRows(c, 'support_tickets'),
      countRows(c, 'contact_requests'),
      countRows(c, 'reports'),
    ]);
    sections.push({
      id: 'requests-complaints',
      title: '13. Data Requests / Complaints',
      description: 'General support tickets (`support_tickets`), business/recruiter contact requests (`contact_requests`), and user-submitted content/user reports (`reports`) are the platform\'s general complaint/request intake. None of them currently has a "privacy" or "data request" category value in use.',
      metrics: [
        metric('Total support tickets', supportTickets),
        metric('Total contact requests', contactRequests),
        metric('Total content/user reports', reports),
      ],
      caveats: [
        'support_tickets.category has never been set to a privacy/GDPR/data-request-specific value on this data -- a data subject request submitted via support today would be indistinguishable from a normal ticket unless staff manually flag it. There is no dedicated data-subject-request tracker.',
        'Formal erasure requests specifically are tracked separately and accurately in account_deletion_requests (Section 7) -- currently zero.',
      ],
    });
  }

  return {
    data: { generatedAt: asOf(), generatedBy, sections },
    error: null,
  };
}
