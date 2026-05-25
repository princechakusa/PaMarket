'use strict';
/**
 * AGENT 7 — Auto-Fix Generation Agent
 *
 * Transforms diagnosed issues into exact, actionable fixes.
 * NEVER applies or deploys fixes. Outputs:
 *   - Exact SQL for Supabase changes
 *   - Exact JavaScript patches (file + function + before/after diff)
 *   - Risk assessment per fix
 *   - Application instructions for human review
 *
 * Fix objects are passed to Agent 8 (Approval Gate) before any action.
 * Returns: { agent, status, fixes }
 */

const logger = require('../utils/logger');

// ── Fix priority mapping from known issue IDs ─────────────────────────────────
// Each fix specifies: type, file, scope, code, risks, safetyLevel
// safetyLevel: 'safe' | 'caution' | 'dangerous'

const CANONICAL_FIXES = {

  // ── BUG 2: Admin RLS — listings ─────────────────────────────────────────────
  'admin_rls_listings': {
    id:          'FIX-001',
    issueIds:    ['ISSUE-SEC-LISTINGS-ADMIN', 'ISSUE-TRACE-006'],
    type:        'sql',
    file:        'supabase/schema/listings.sql',
    scope:       'Supabase SQL Editor or migration',
    description: 'Create admin bypass SELECT policy on listings table (BUG 2)',
    risks: [
      'Admins will now see ALL listing statuses (pending, sold, deleted, active). This is intentional.',
      'Ensure only genuine admin accounts have role=admin in profiles.',
    ],
    safetyLevel: 'safe',
    code: `-- Allow admin users to read ALL listings regardless of status
-- Run in Supabase SQL Editor → Dashboard → SQL Editor
CREATE POLICY "admin_read_all_listings" ON listings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Verify: sign in as admin and run: SELECT count(*) FROM listings WHERE status='pending'
-- Expected: returns actual count of pending listings`,
    apply: 'Run in Supabase Dashboard → SQL Editor',
  },

  // ── BUG 2: Admin RLS — profiles ─────────────────────────────────────────────
  'admin_rls_profiles': {
    id:          'FIX-002',
    issueIds:    ['ISSUE-SEC-PROFILES-ADMIN', 'ISSUE-API-007'],
    type:        'sql',
    file:        'supabase/schema/profiles.sql',
    scope:       'Supabase SQL Editor or migration',
    description: 'Create admin bypass SELECT policy on profiles table (BUG 2)',
    risks: [
      'Admins will see all user profile data including phone, email, banReason.',
      'This is required for moderation. Ensure admin accounts are trusted.',
    ],
    safetyLevel: 'safe',
    code: `-- Allow admin users to read ALL profiles
CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()  -- users can read own profile (existing policy)
    OR EXISTS (
      SELECT 1 FROM profiles admin_check
      WHERE admin_check.id = auth.uid()
        AND admin_check.role = 'admin'
    )
  );

-- IMPORTANT: If a policy named "admin_read_all_profiles" already exists, drop it first:
-- DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;`,
    apply: 'Run in Supabase Dashboard → SQL Editor',
  },

  // ── BUG 3: Create verifications table ────────────────────────────────────────
  'create_verifications_table': {
    id:          'FIX-003',
    issueIds:    ['ISSUE-API-005', 'ISSUE-TRACE-003'],
    type:        'sql',
    file:        'supabase/schema/verifications.sql',
    scope:       'Supabase SQL Editor — creates new table',
    description: 'Create verifications table to persist ID verification photos (BUG 3)',
    risks: [
      'New table — no existing data affected.',
      'After creating, existing users with verification_pending=true CANNOT be verified (their photos were discarded). Admin should reach out to ask them to re-submit.',
    ],
    safetyLevel: 'safe',
    code: `-- Create the verifications table (BUG 3 fix)
CREATE TABLE IF NOT EXISTS verifications (
  user_id       uuid        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  id_doc        text,                    -- base64 encoded ID document photo
  selfie        text,                    -- base64 encoded selfie photo
  status        text        NOT NULL DEFAULT 'pending',
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  admin_note    text
);

ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

-- Users can submit their own verification
CREATE POLICY "user_upsert_own_verification" ON verifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can read all verifications
CREATE POLICY "admin_read_verifications" ON verifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin can update verification status
CREATE POLICY "admin_update_verifications" ON verifications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Verify: SELECT * FROM verifications LIMIT 5;`,
    apply: 'Run in Supabase Dashboard → SQL Editor',
  },

  // ── BUG 1: Notification created_at type ──────────────────────────────────────
  'notification_bigint_type': {
    id:          'FIX-004',
    issueIds:    ['ISSUE-API-004', 'ISSUE-TRACE-002'],
    type:        'sql',
    file:        'supabase/schema/notifications.sql',
    scope:       'Supabase SQL Editor — alters existing column type',
    description: 'Change notifications.created_at from timestamptz to bigint (BUG 1 fix verification)',
    risks: [
      'DESTRUCTIVE: Converts existing timestamptz values to Unix milliseconds. Formula: EXTRACT(EPOCH FROM created_at) * 1000.',
      'All existing notifications will have their timestamps correctly converted.',
      'Real-time subscriptions and existing reads will continue working (JS reads the value and uses getTime() which handles both formats during transition).',
      'Run during low-traffic period.',
    ],
    safetyLevel: 'caution',
    code: `-- CAUTION: This alters an existing column. Ensure you have a backup.
-- This converts timestamptz → bigint (Unix ms)

BEGIN;
-- Step 1: Add a temporary backup column
ALTER TABLE notifications ADD COLUMN created_at_backup timestamptz DEFAULT now();
UPDATE notifications SET created_at_backup = to_timestamp(created_at::bigint / 1000)
  WHERE created_at IS NOT NULL;

-- Step 2: Convert the column type
ALTER TABLE notifications
  ALTER COLUMN created_at TYPE bigint
  USING EXTRACT(EPOCH FROM created_at::timestamptz) * 1000;

-- Step 3: Verify a few rows
-- SELECT id, created_at, created_at_backup FROM notifications LIMIT 5;
-- Confirm: created_at should be a large integer (ms since epoch, e.g. 1748123456789)

-- Step 4: After verification, drop backup column
-- ALTER TABLE notifications DROP COLUMN created_at_backup;

COMMIT;`,
    apply: 'Run in Supabase Dashboard → SQL Editor in a transaction',
  },

  // ── BUG 4: 200-listing cap — JS pagination ────────────────────────────────
  'listing_pagination': {
    id:          'FIX-005',
    issueIds:    ['ISSUE-PERF-001', 'ISSUE-API-003'],
    type:        'javascript',
    file:        'www/js/app.js',
    fn:          'H.fetchListingsFromSupabase',
    scope:       'Frontend code change',
    description: 'Replace single 200-row fetch with cursor-based pagination',
    risks: [
      'Increases number of API calls on boot (one per 100-listing page).',
      'H.state.listings array may grow larger, increasing localStorage usage — mitigate with Supabase Storage for photos.',
      'filterListings() already operates on the full array — no change needed there.',
      'renderPage() is called after each page fetch if desired, or after all pages load.',
      'Test thoroughly: the nonActive filter logic must be preserved.',
    ],
    safetyLevel: 'caution',
    code: `// File: www/js/app.js
// Replace the existing fetchListingsFromSupabase function with this:

H._listingCursor = null,  // ISO timestamp of last fetched listing
H._listingsFetching = false,

async fetchListingsFromSupabase(reset) {
  if (H._listingsFetching) return;
  H._listingsFetching = true;
  const PAGE_SIZE = 100;

  try {
    if (reset !== false) H._listingCursor = null;  // default: always reset on manual calls
    if (!window.supabase || typeof window.supabase.from !== 'function') return;

    let query = window.supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (H._listingCursor) {
      query = query.lt('created_at', H._listingCursor);
    }

    const { data, error } = await query;
    if (error) {
      if (!navigator.onLine) H.toast('No internet — showing saved listings', 4000, true);
      return;
    }

    const cloud = (data || []).map(r => ({
      id: r.id, sellerId: r.seller_id, sellerName: r.seller_name || '',
      sellerPhone: r.seller_phone || '', title: r.title, desc: r.description,
      price: r.price, currency: r.currency, cat: r.category,
      prov: r.province, city: r.city, suburb: r.suburb,
      photos: Array.isArray(r.photos) ? r.photos : (r.photos ? [r.photos] : []),
      status: r.status, boost: r.boost, views: r.views || 0,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
    }));

    const nonActive = (H.state.listings || []).filter(l => l.status !== 'active');

    if (!H._listingCursor) {
      // First page — replace active listings entirely
      H.state.listings = [...cloud, ...nonActive];
    } else {
      // Subsequent pages — append deduplicated
      const existingIds = new Set(H.state.listings.map(l => l.id));
      cloud.forEach(l => { if (!existingIds.has(l.id)) H.state.listings.push(l); });
    }

    if (cloud.length === PAGE_SIZE) {
      // More pages available — update cursor
      H._listingCursor = data[data.length - 1].created_at;
      H._hasMoreListings = true;
    } else {
      H._hasMoreListings = false;
    }

    H.saveState();
  } catch(e) {
    console.warn('fetchListingsFromSupabase:', e.message);
  } finally {
    H._listingsFetching = false;
  }
},

// Call H.fetchListingsFromSupabase() for first page (reset=true implicit)
// Call H.fetchListingsFromSupabase(false) to load next page
// Add a "Load More" button in browse.js that calls H.fetchListingsFromSupabase(false)`,
    apply: 'Edit www/js/app.js and rebuild bundle with ./build.sh',
  },

  // ── BUG 5: Base64 photos → Supabase Storage ──────────────────────────────
  'base64_to_storage': {
    id:          'FIX-006',
    issueIds:    ['ISSUE-PERF-002', 'ISSUE-PERF-003'],
    type:        'javascript',
    file:        'www/js/verify.js',
    fn:          'H._verify.submitForReview',
    scope:       'Frontend code change + Supabase Storage bucket setup',
    description: 'Upload verification photos to Supabase Storage instead of storing base64 in profiles table',
    risks: [
      'Requires creating Supabase Storage buckets: "ids" and "selfies" with appropriate RLS.',
      'Existing base64 data in profiles must be migrated (or users re-submit).',
      'Storage bucket must be private — admin-readable but not public.',
      'URLs stored in verifications.id_doc and verifications.selfie instead of base64.',
    ],
    safetyLevel: 'caution',
    code: `// File: www/js/verify.js
// Add this helper function:

async function _uploadVerificationPhoto(base64DataUrl, userId, type) {
  const arr    = base64DataUrl.split(',');
  const mime   = arr[0].match(/:(.*?);/)[1];
  const bStr   = atob(arr[1]);
  const bytes  = new Uint8Array(bStr.length);
  for (let i = 0; i < bStr.length; i++) bytes[i] = bStr.charCodeAt(i);
  const blob   = new Blob([bytes], { type: mime });
  const bucket = type === 'id_doc' ? 'ids' : 'selfies';
  const filePath = \`\${userId}/\${type}-\${Date.now()}.jpg\`;

  const { error } = await window.supabase.storage
    .from(bucket).upload(filePath, blob, { upsert: true });
  if (error) throw new Error('Photo upload failed: ' + error.message);

  // Return the path — admin reads it via signed URL, not public URL
  return filePath;
}

// In H._verify.submitForReview(), replace base64 storage with:
// const idDocPath  = await _uploadVerificationPhoto(u.idDocs, u.id, 'id_doc');
// const selfiePath = await _uploadVerificationPhoto(u.selfie, u.id, 'selfie');
// Then upsert: { user_id: u.id, id_doc: idDocPath, selfie: selfiePath, status: 'pending' }

// ─── Supabase Storage bucket setup (run in SQL Editor): ───
// Storage buckets must be created via Dashboard → Storage, then:

/*
-- Create RLS policies for the storage buckets
-- Run after creating buckets "ids" and "selfies" (both private):

INSERT INTO storage.buckets (id, name, public) VALUES ('ids', 'ids', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('selfies', 'selfies', false);

CREATE POLICY "user_upload_own_id" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ids' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "admin_read_ids" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('ids', 'selfies')
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
*/`,
    apply: 'Edit www/js/verify.js, create Storage buckets, rebuild bundle',
  },

  // ── BUG 6: Conversation ID collision ─────────────────────────────────────
  'conversation_id_collision': {
    id:          'FIX-007',
    issueIds:    ['ISSUE-SEC-CONVID-COLLISION'],
    type:        'javascript',
    file:        'www/js/messages.js',
    fn:          'H.startChatWith',
    scope:       'Frontend code change + data migration',
    description: 'Increase conversation ID entropy to prevent collisions',
    risks: [
      'MIGRATION REQUIRED: Existing conversations will have old-format IDs. New convIds will not match.',
      'Users with existing conversations may lose them in UI (they still exist in DB with old IDs).',
      'A one-time migration script must update all existing conversation IDs in both conversations and messages tables.',
      'This is a breaking change — coordinate with admin to notify users of potential message loss.',
    ],
    safetyLevel: 'dangerous',
    code: `// File: www/js/messages.js
// Replace the convId generation formula in H.startChatWith():

// OLD (collision-prone):
// const convId = 'conv_' + [uid1,uid2].sort()[0].slice(-6) + '_' + [uid1,uid2].sort()[1].slice(-6) + '_' + listingId.slice(-6);

// NEW (collision-resistant — 10+10+10 chars = ~10^17 combinations):
function _makeConvId(uid1, uid2, listingId) {
  const [a, b] = [uid1, uid2].sort();
  const aKey = a.replace(/-/g, '').slice(-10);
  const bKey = b.replace(/-/g, '').slice(-10);
  const lKey = listingId.replace(/-/g, '').slice(-10);
  return \`conv_\${aKey}_\${bKey}_\${lKey}\`;
}

// In H.startChatWith(otherId, listingId):
// const convId = _makeConvId(H.state.currentUserId, otherId, listingId);

// ─── Migration SQL (run ONLY after deploying new code): ───
/*
-- This renames all existing conversation IDs to the new format.
-- BACKUP your database before running this.
-- WARNING: Also updates messages.conversation_id FK references.

-- Step 1: Add new_id column
ALTER TABLE conversations ADD COLUMN new_id text;

-- Step 2: Compute new IDs (requires a PL/pgSQL function)
-- (Complex migration — consult DBA before executing)
-- Simplified approach: force all users to start new conversations
-- by archiving old ones rather than migrating IDs.
*/`,
    apply: 'DANGEROUS — requires DBA review, data migration, and coordinated deployment',
  },

  // ── Profile wallet_usd remapping ────────────────────────────────────────
  'profile_wallet_remap': {
    id:          'FIX-008',
    issueIds:    ['ISSUE-API-007'],
    type:        'javascript',
    file:        'www/js/auth.js',
    fn:          'H.loadProfile',
    scope:       'Frontend code change — add 3 lines after profile merge',
    description: 'Remap snake_case DB columns to camelCase after loading profile into H.state',
    risks: [
      'Low risk — additive change that adds camelCase aliases.',
      'No DB change required.',
      'Some code already uses u.wallet_usd directly — this adds u.walletUSD as an alias, not a replacement.',
    ],
    safetyLevel: 'safe',
    code: `// File: www/js/auth.js
// In H.loadProfile(userId), after the Object.assign/merge step, add:

// Example: after line like "Object.assign(existingUser, data);"
// Add the following remappings:
if (u.wallet_usd !== undefined && u.walletUSD === 0) {
  u.walletUSD = parseFloat(u.wallet_usd) || 0;
}
if (u.blocked_users !== undefined) {
  u.blocked = Array.isArray(u.blocked_users) ? u.blocked_users : [];
}
if (u.joined_at && !u.joinedAt) {
  u.joinedAt = new Date(u.joined_at).getTime();
}`,
    apply: 'Edit www/js/auth.js, add after the profile merge. Rebuild bundle with ./build.sh',
  },

  // ── Realtime channel cleanup on logout ───────────────────────────────────
  'realtime_channel_cleanup': {
    id:          'FIX-009',
    issueIds:    ['ISSUE-PERF-CHANNEL-messages_rt'],
    type:        'javascript',
    file:        'www/js/auth.js',
    fn:          'H.logout',
    scope:       'Frontend code change — add cleanup before signOut',
    description: 'Unsubscribe all realtime channels before logout to prevent cross-session leaks',
    risks: [
      'Low risk — cleanup is best-effort (errors silently caught).',
      'The page reload after signOut already cleans up channels, but explicit cleanup prevents edge cases.',
    ],
    safetyLevel: 'safe',
    code: `// File: www/js/auth.js or app.js — in H.logout() function
// Add BEFORE state clear and signOut call:

async function _cleanupRealtimeChannels() {
  if (window._msgChannel) {
    try { await window.supabase.removeChannel(window._msgChannel); } catch (e) {}
    window._msgChannel = null;
  }
  if (window.H._notifChannel) {
    try { await window.supabase.removeChannel(window.H._notifChannel); } catch (e) {}
    window.H._notifChannel = null;
  }
}

// Modified H.logout (add cleanup at the start):
H.logout = async function() {
  await _cleanupRealtimeChannels();
  H.state.currentUserId = null;
  H.saveState();
  if (window.supabase) await window.supabase.auth.signOut();
  window.location.reload();
};`,
    apply: 'Edit www/js/auth.js. Rebuild bundle with ./build.sh',
  },
};

// ── Issue ID → canonical fix mapping ──────────────────────────────────────────
const ISSUE_TO_FIX = {};
Object.entries(CANONICAL_FIXES).forEach(([key, fix]) => {
  fix.issueIds.forEach(id => {
    if (!ISSUE_TO_FIX[id]) ISSUE_TO_FIX[id] = [];
    ISSUE_TO_FIX[id].push(key);
  });
});

async function run(config, diagnosisResult) {
  logger.agent('AGENT 7 — Auto-Fix Generation');
  const fixes = [];

  const issues = diagnosisResult && diagnosisResult.issues ? diagnosisResult.issues : [];
  if (issues.length === 0) {
    logger.info('No issues to generate fixes for');
    return { agent: 'AutoFixGeneration', status: 'pass', fixes: [] };
  }

  logger.section('Generating Fixes for Diagnosed Issues');
  const generatedFixKeys = new Set();

  for (const issue of issues) {
    const fixKeys = ISSUE_TO_FIX[issue.id] || [];
    for (const key of fixKeys) {
      if (generatedFixKeys.has(key)) continue;  // dedup
      generatedFixKeys.add(key);

      const fix = { ...CANONICAL_FIXES[key] };
      logger.fix(fix.id, fix.type, fix.description);
      logger.info(`  Safety: ${fix.safetyLevel.toUpperCase()} | File: ${fix.file}`);
      if (fix.risks.length > 0) {
        logger.warn(`  Risks: ${fix.risks[0]}`);
      }

      fixes.push({
        ...fix,
        issueId:    issue.id,
        issueSummary: issue.summary,
        severity:   issue.severity,
        generated:  new Date().toISOString(),
      });
    }

    // If no canonical fix exists, generate a generic one from issue.fix
    if (fixKeys.length === 0 && issue.fix) {
      const genericFix = {
        id:          `FIX-GEN-${fixes.length + 1}`,
        issueId:     issue.id,
        issueSummary: issue.summary,
        severity:    issue.severity,
        type:        issue.fix.type || 'sql',
        file:        issue.fix.file || 'unknown',
        fn:          issue.fix.fn || null,
        description: issue.fix.description || 'Fix for ' + issue.summary,
        code:        issue.fix.code || '-- No code generated',
        risks:       ['Generic fix — review carefully before applying'],
        safetyLevel: 'caution',
        apply:       'Review code carefully and apply in staging first',
        generated:   new Date().toISOString(),
      };
      fixes.push(genericFix);
      logger.fix(genericFix.id, genericFix.type, genericFix.description);
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  fixes.sort((a, b) => (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9));

  logger.divider();
  logger.info(`Generated ${fixes.length} fixes:`);
  logger.info(`  Safe: ${fixes.filter(f => f.safetyLevel === 'safe').length}`);
  logger.info(`  Caution: ${fixes.filter(f => f.safetyLevel === 'caution').length}`);
  logger.info(`  Dangerous: ${fixes.filter(f => f.safetyLevel === 'dangerous').length}`);

  return { agent: 'AutoFixGeneration', status: 'pass', fixes };
}

if (require.main === module) {
  let config;
  try { config = require('../config'); } catch { config = require('../config.example'); }
  run(config, { issues: [] }).then(r => {
    console.log(`\nFix generation: ${r.fixes.length} fixes generated`);
  }).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { run, CANONICAL_FIXES };
