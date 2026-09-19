// DPO / Privacy Data Export -- platform-wide compliance snapshot (2026-09-19).
//
// Platform aggregation uses existing admin-readable tables and their RLS.
// The individual export uses privacy_export_subject, a fixed allowlist RPC
// gated server-side by super_admin and AAL2. New register reads use their
// own super_admin/AAL2 RLS policies. Query failures are shown explicitly.
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
  records?: Record<string, unknown>[];
  source?: string;
};
export type PrivacySnapshot = {
  generatedAt: string;
  generatedBy: { id: string; name: string; email: string; role: string };
  sections: Section[];
  subjectId?: string;
};

type Client = ReturnType<typeof getSupabaseClient>;

async function countRows(client: NonNullable<Client>, table: string, apply?: (q: any) => any): Promise<{ n: number | null; err?: string }> {
  try {
    // Generic helper spans ~30 tables across this file -- a typed union
    // param would defeat the point of the helper, so we deliberately opt
    // out of the typed client here (as any) rather than list every table.
    // select('id') not select('*') -- a head:true count still evaluates
    // column-level grants for every selected column, and profiles has
    // REVOKE'd column privileges on its auth-secret columns (mfa_secret,
    // two_factor_secret); select('*') hit "permission denied for column"
    // and silently produced a null count with no readable message.
    let q = (client.from as any)(table).select('id', { count: 'exact', head: true });
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
  // n.n === null means the query failed (regardless of whether err carries
  // a readable message) -- must never fall through to String(null),
  // which is the exact bug that showed literal "null" text in a real
  // compliance report instead of an honest failure state.
  if (n.n === null) return { label, value: 'Unavailable', note: `Query error: ${n.err || 'unknown error (no message returned)'}` };
  return { label, value: String(n.n), note };
}

const asOf = () => new Date().toISOString();

async function registerSection(client: NonNullable<Client>, table: string, id: string, title: string, description: string): Promise<Section> {
  const records: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 500) {
    if (from >= 10000) return { id, title, description, source: `public.${table}`, metrics: [{ label: 'Records', value: 'Unavailable' }], caveats: ['Register exceeds the 10,000-row safe export limit. Use an audited paged database export; this report has not silently truncated the register.'] };
    const { data, error } = await (client.from as any)(table).select('*').order('id', { ascending: true }).range(from, from + 499);
    if (error) return { id, title, description, source: `public.${table}`, metrics: [{ label: 'Records', value: 'Unavailable' }], caveats: [`Query failed: ${error.message}`] };
    records.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return { id, title, description, source: `public.${table}`, metrics: [{ label: 'Records', value: String(records.length) }], records, caveats: records.length ? [] : ['No records currently exist in this register. Historical events have not been inferred or backfilled.'] };
}

export async function generatePrivacySnapshot(generatedBy: { id: string; name: string; email: string; role: string }, subjectId?: string): Promise<QueryResult<PrivacySnapshot>> {
  const client = getSupabaseClient();
  if (!client) return unavailable();
  const c = client;
  if (generatedBy.role !== 'super_admin') return { data: null, error: { code: 'forbidden', message: 'Super Admin is required.', retryable: false } };

  if (subjectId) {
    const { data, error } = await (c.rpc as any)('privacy_export_subject', { p_user_id: subjectId });
    if (error) return { data: null, error: normalizeError(error) };
    const groups = data as Record<string, Record<string, unknown>[]>;
    const sections: Section[] = Object.entries(groups).map(([table, records]) => ({
      id: `subject-${table}`, title: `SAR: ${table}`, source: `public.${table}`,
      description: `Records directly linked to subject ${subjectId}. Message records are authored messages only; records about other conversation participants are excluded.`,
      metrics: [{ label: 'Records', value: String(records.length) }], records,
      caveats: records.length ? [] : ['No matching records.'],
    }));
    return { data: { generatedAt: asOf(), generatedBy, subjectId, sections }, error: null };
  }

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
        'The individual SAR export below includes messages authored by the selected user through a Super Admin and MFA gated database function. It does not include other participants\' messages in the same conversation.',
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
        'The event register in Section 16 contains only consents recorded after its introduction. Earlier acceptance cannot be reconstructed from current preferences or account creation.',
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
      description: 'Operational security-event evidence and legal holds are listed above. Formal incident records, when entered, appear in Section 15.',
      metrics: [],
      caveats: [
        'Incident investigation and notification details are recorded in privacy_incidents (Section 15); no historical incidents have been invented.',
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
      description: 'Engineering-derived provider signals: Supabase, Cloudflare, Expo/EAS, Paynow, Google Play Billing, Sentry and push delivery. The DPO-maintained formal processor register appears in Section 17.',
      metrics: [
        metric('Paynow payment records (name/phone/email may be attached)', paynow),
        metric('Google Play purchase/subscription records', playPurchases),
        metric('Registered push-notification device tokens', pushTokens),
      ],
      caveats: [
        'Provider agreements, sub-processors and data location are only known if entered in the formal register; do not infer compliance from usage counts.',
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
        'The DPO-maintained retention schedule is in Section 18. A recorded schedule does not itself enforce deletion; technical enforcement must be checked separately.',
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
        'Privacy-specific requests are tracked in Section 14. General support tickets are not automatically classified or migrated into that register.',
        'Formal erasure requests are tracked separately in account_deletion_requests (Section 7); consult that section for the live count.',
      ],
    });
  }

  // Dedicated registers complement the existing real-data snapshot. They are
  // empty until a DPO records actual cases, agreements and schedules.
  for (const [table, id, title, description] of [
    ['privacy_requests', 'request-register', '14. Privacy / Data-Subject Request Register', 'Access, correction, deletion, portability and other requests; deadlines, verification, decision and evidence. Existing account_deletion_requests remain reported in Section 7.'],
    ['privacy_incidents', 'incident-register', '15. Data Breach / Incident Register', 'Detection, affected data and users, investigation, containment, notifications and resolution. Security events remain reported in Section 8.'],
    ['privacy_consents', 'consent-history', '16. Consent Event History', 'Recorded grants and withdrawals with purpose, policy version, timestamps and evidence. Current preference values remain in Section 6.'],
    ['privacy_processors', 'processor-register', '17. Formal Processor Register', 'DPO-maintained provider, data categories, purpose, location, agreements, retention and compliance status. Engineering-derived provider signals remain in Section 11.'],
    ['privacy_retention_schedule', 'retention-schedule', '18. Retention Schedule', 'DPO-maintained category, source tables, period, trigger, deletion method, exceptions and review status. Actual deletion records remain in Section 7.'],
    ['privacy_register_audit', 'register-audit', '19. Privacy Register Change Evidence', 'Immutable insert/update evidence for the five DPO registers, including actor, timestamp and before/after state.'],
    ['privacy_export_audit', 'export-audit', '20. Individual Export Access Evidence', 'Audit of subject IDs exported, actor IDs and timestamps. Each SAR function invocation records an entry.'],
  ]) sections.push(await registerSection(c, table, id, title, description));

  return {
    data: { generatedAt: asOf(), generatedBy, sections },
    error: null,
  };
}
