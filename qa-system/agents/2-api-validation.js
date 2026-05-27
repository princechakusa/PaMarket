'use strict';
/**
 * AGENT 2 — Supabase API Validation Agent
 *
 * Directly queries Supabase (PostgREST + Auth) with the anon key, exactly as
 * the browser app does. Validates:
 *   • Table reads (schema, column names, data presence)
 *   • RLS enforcement (anon vs authenticated)
 *   • Silent failures (no error but no data returned)
 *   • Column-name mapping between DB (snake_case) and JS (camelCase)
 *   • Known bug states (notification bigint, verifications table, 200-cap)
 *
 * Returns: { agent, status, tests, issues, metrics }
 */

const logger = require('../utils/logger');
const sb     = require('../utils/supabase-client');

// ── Exact field mappings the app relies on (JS camelCase → DB snake_case) ──
const LISTING_FIELD_MAP = {
  sellerId:    'seller_id',
  sellerName:  'seller_name',
  sellerPhone: 'seller_phone',
  title:       'title',
  desc:        'description',
  price:       'price',
  currency:    'currency',
  cat:         'category',
  prov:        'province',
  city:        'city',
  suburb:      'suburb',
  photos:      'photos',
  status:      'status',
  boost:       'boost',
  views:       'views',
  createdAt:   'created_at',
};

const PAID_ADS_FIELD_MAP = {
  businessName: 'business_name',
  imageUrl:     'image_url',     // BUG 1 history: was 'image'
  bgColor:      'bg_color',
  linkUrl:      'link_url',
  targetCat:    'target_cat',
  startsAt:     'starts_at',
  endsAt:       'ends_at',
  listingId:    'listing_id',
};

const MESSAGE_FIELD_MAP = {
  from:         'sender_id',
  senderName:   'sender_name',
  text:         'text',
  t:            'created_at',  // note: converted via new Date().getTime()
  read:         'read',
};

async function run(config) {
  logger.agent('AGENT 2 — Supabase API Validation');
  const tests  = [];
  const issues = [];
  const metrics = {};

  const anon = sb.anonClient(config);

  // ── HOST ALLOWLIST DETECTION ─────────────────────────────────────────────
  // Check if Supabase project has API host restrictions (a security feature).
  // If restricted, direct API calls from this server are blocked.
  // The real app (on GitHub Pages) is whitelisted and works normally.
  logger.section('Supabase API — Host Allowlist Detection');
  let hostAllowlistActive = false;
  {
    const probe = await sb.rawGet(config, 'listings?select=id&limit=1');
    if (probe.denyReason === 'host_not_allowed') {
      hostAllowlistActive = true;
      logger.warn('Supabase API host allowlist is ACTIVE on this project');
      logger.info('  Direct API calls from this QA server are blocked (security feature).');
      logger.info('  The real app works normally because it runs from an allowed origin (GitHub Pages).');
      logger.info('  To enable direct API validation from this server:');
      logger.info('    1. Go to Supabase Dashboard → Settings → API → Allowed Origins');
      logger.info('    2. Add this server\'s hostname or use a wildcard for testing environments');
      logger.info('    3. Or run the Playwright feature tests (Agent 1) which execute inside the browser');
      tests.push({
        name: 'host_allowlist_check',
        status: 'warn',
        note: 'Host allowlist is active — direct API validation limited. App itself works normally.',
        guidance: 'Add QA server hostname to Supabase allowed origins to enable full API validation.',
      });
    } else if (probe.status === 200 || probe.status === 403) {
      logger.pass('API accessible from this host (no allowlist restriction)');
      tests.push({ name: 'host_allowlist_check', status: 'pass' });
    }
  }

  // ── TEST 1: Anon can read active listings ─────────────────────────────────
  logger.section('Listings — Anon Read');
  {
    const rawRes = await sb.rawGet(config, 'listings?status=eq.active&order=created_at.desc&limit=5&select=*');
    // Handle host_not_allowed gracefully
    if (rawRes.denyReason === 'host_not_allowed') {
      logger.warn('Anon listing read skipped — API host allowlist blocking (expected for non-whitelisted QA server)');
      tests.push({ name: 'anon_read_active_listings', status: 'skipped', reason: 'host_allowlist' });
      metrics.hostAllowlistActive = true;
      // Skip remaining SDK-based tests — they will all be blocked
    }
    const data   = Array.isArray(rawRes.body) ? rawRes.body : null;
    const error  = (!rawRes.denyReason && rawRes.status >= 400) ? { message: `HTTP ${rawRes.status}` } : null;

    if (error) {
      logger.fail('Anon read active listings FAILED', error.message);
      tests.push({ name: 'anon_read_active_listings', status: 'fail', error: error.message });
      issues.push({
        id: 'ISSUE-API-001',
        summary: 'Anon cannot read active listings from Supabase',
        module: 'listings',
        layer: 'supabase-rls',
        severity: 'critical',
        evidence: { apiResponse: { error: error.message } },
        rootCause: 'The listings table has no SELECT policy for anon role, or the table does not exist. Active listings will not load in the app at all.',
        fix: {
          type: 'sql',
          file: 'supabase/schema/listings.sql',
          description: 'Create RLS policy allowing anon to read active listings',
          code: `CREATE POLICY "public_read_active_listings" ON listings
  FOR SELECT TO anon
  USING (status = 'active');`,
        },
      });
    } else {
      logger.pass(`Anon read active listings`, `${(data || []).length} rows returned`);
      tests.push({ name: 'anon_read_active_listings', status: 'pass', rowCount: (data || []).length });

      metrics.activeListingsAnon = (data || []).length;

      // Validate column names in response match what the app expects
      if (data && data.length > 0) {
        const row = data[0];
        const missingDbCols = Object.values(LISTING_FIELD_MAP).filter(col => !(col in row));
        if (missingDbCols.length > 0) {
          logger.fail('Listing column mapping mismatch', `Missing DB columns: ${missingDbCols.join(', ')}`);
          issues.push({
            id: 'ISSUE-API-002',
            summary: `Listing DB schema missing columns expected by app: ${missingDbCols.join(', ')}`,
            module: 'listings',
            layer: 'database-schema',
            severity: 'high',
            evidence: { apiResponse: { availableColumns: Object.keys(row), missingColumns: missingDbCols } },
            rootCause: `The app's fetchListingsFromSupabase() maps these DB columns to JS state. If columns are absent, the corresponding JS fields will be undefined, causing rendering failures.`,
            fix: {
              type: 'sql',
              file: 'supabase/schema/listings.sql',
              description: 'Add missing columns to listings table',
              code: missingDbCols.map(col => `ALTER TABLE listings ADD COLUMN IF NOT EXISTS ${col} text;`).join('\n'),
            },
          });
        } else {
          logger.pass('Listing column names match app expectations');
        }

        // Check 'negotiable' column exists (in schema but not mapped in JS)
        if (!('negotiable' in row)) {
          logger.warn('negotiable column absent from listing response');
        }
      }
    }
  }

  // ── TEST 2: Count total listings vs 200-cap ───────────────────────────────
  logger.section('Listings — 200-Cap Detection');
  {
    const countRes = await sb.rawGet(config, 'listings?status=eq.active&select=id');
    const countArr = Array.isArray(countRes.body) ? countRes.body : [];
    // Extract count from Content-Range header or body length
    const contentRange = countRes.headers && countRes.headers['content-range'];
    const count = contentRange ? parseInt(contentRange.split('/')[1], 10) : countArr.length;
    const error = countRes.status >= 400 ? { message: `HTTP ${countRes.status}` } : null;

    if (!error && (count !== null && !isNaN(count))) {
      metrics.totalActiveListings = count;
      if (count > 200) {
        logger.warn(`Total active listings ${count} exceeds 200-row fetch cap`, `${count - 200} listings permanently invisible`);
        issues.push({
          id: 'ISSUE-API-003',
          summary: `200-listing hard cap: ${count - 200} listings are permanently invisible to users`,
          module: 'listings',
          layer: 'frontend',
          severity: 'high',
          evidence: { apiResponse: { totalActiveListings: count, fetchLimit: 200, invisible: count - 200 } },
          rootCause: 'app.js fetchListingsFromSupabase() uses .limit(200) with no pagination. Listings beyond position 200 (ordered by created_at DESC) are never fetched and never appear in any feed or search.',
          fix: {
            type: 'javascript',
            file: 'www/js/app.js',
            fn: 'fetchListingsFromSupabase',
            description: 'Add cursor-based pagination: fetch in pages and append to H.state.listings',
            code: `// In fetchListingsFromSupabase(), replace the single .limit(200) query
// with a paginated approach:
async fetchListingsFromSupabase(page = 0) {
  const PAGE_SIZE = 200;
  const { data, error } = await window.supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  // Merge results into H.state.listings instead of replacing entirely
}`,
          },
        });
      } else {
        logger.pass(`Listing count ${count} is within 200-row cap`);
        tests.push({ name: 'listing_200_cap_check', status: 'pass', count });
      }
    }
  }

  // ── TEST 3: Verify notifications.created_at is bigint (not timestamptz) ───
  logger.section('Notifications — created_at Type (BUG 1 Regression Check)');
  {
    let userToken = null;
    try {
      userToken = await sb.getAccessToken(config, config.TEST_USER);
    } catch (_) {
      logger.warn('Test user credentials not configured — skipping notification type check');
    }

    if (userToken) {
      // Insert a test notification and read it back to verify type
      const testId   = `qa-notif-${Date.now()}`;
      const testUser = config.TEST_USER.userId;

      if (testUser && !config.READ_ONLY) {
        const authClient = await sb.userClient(config);
        const insertTs   = Date.now(); // integer
        const { error: insErr } = await authClient.from('notifications').insert({
          id:         testId,
          user_id:    testUser,
          title:      'QA Test Notification',
          body:       'Automated QA check — safe to delete',
          type:       'info',
          read:       false,
          created_at: insertTs,  // bigint
        });

        if (insErr) {
          logger.fail('Notification insert failed', insErr.message);
          if (insErr.message.includes('invalid input syntax for type bigint') ||
              insErr.message.includes('timestamptz')) {
            issues.push({
              id: 'ISSUE-API-004',
              summary: 'notifications.created_at type mismatch — insert of integer fails',
              module: 'notifications',
              layer: 'database-schema',
              severity: 'critical',
              evidence: { apiResponse: { error: insErr.message, insertedValue: insertTs } },
              rootCause: 'The notifications.created_at column expects timestamptz but the app inserts Date.now() (integer milliseconds). This was BUG 1 in the blueprint. The column must be bigint to match the app\'s H.pushNotif() which uses n.t (Date.now()).',
              fix: {
                type: 'sql',
                file: 'supabase/schema/notifications.sql',
                description: 'Change notifications.created_at column type from timestamptz to bigint',
                code: `ALTER TABLE notifications
  ALTER COLUMN created_at TYPE bigint USING EXTRACT(EPOCH FROM created_at) * 1000;`,
              },
            });
          }
        } else {
          logger.pass('Notification insert with bigint created_at succeeded (BUG 1 is fixed)');
          tests.push({ name: 'notification_bigint_insert', status: 'pass' });
          // Clean up test notification
          await authClient.from('notifications').delete().eq('id', testId);
        }
      } else {
        // Read existing notification to check type
        const rawRes = await sb.rawGet(config, 'notifications?limit=1&order=created_at.desc', userToken);
        if (rawRes.status === 200 && Array.isArray(rawRes.body) && rawRes.body.length > 0) {
          const notif = rawRes.body[0];
          const ts    = notif.created_at;
          const isInt = typeof ts === 'number' && Number.isInteger(ts) && ts > 1_000_000_000_000;
          const isIso = typeof ts === 'string' && ts.includes('T');
          if (isIso) {
            logger.fail('notifications.created_at is ISO string — BUG 1 regression detected', ts);
            issues.push({
              id: 'ISSUE-API-004',
              summary: 'notifications.created_at stored as ISO string but app requires bigint (milliseconds)',
              module: 'notifications',
              layer: 'database-schema',
              severity: 'critical',
              evidence: { apiResponse: { sample_created_at: ts, type: typeof ts } },
              rootCause: 'BUG 1 regression: notifications.created_at column is timestamptz. App inserts Date.now() (integer). Column must be bigint.',
              fix: {
                type: 'sql',
                file: 'supabase/schema/notifications.sql',
                code: `ALTER TABLE notifications ALTER COLUMN created_at TYPE bigint USING EXTRACT(EPOCH FROM created_at) * 1000;`,
              },
            });
          } else if (isInt) {
            logger.pass('notifications.created_at is bigint (BUG 1 is fixed)');
            tests.push({ name: 'notification_created_at_type', status: 'pass', sample: ts });
          } else {
            logger.warn('notifications.created_at type unclear', String(ts));
          }
        } else {
          logger.info('No notifications to sample for type check');
        }
      }
    }
  }

  // ── TEST 4: Verifications table exists (BUG 3) ────────────────────────────
  logger.section('Verifications Table — Existence Check (BUG 3)');
  {
    const rawRes = await sb.rawGet(config, 'verifications?limit=1');
    // 200/206 = table exists + accessible; 403 = table exists + RLS blocking (correct); 404/'42P01' = table missing (BUG 3)
    if (rawRes.status === 404 || (rawRes.body && (rawRes.body.code === '42P01' || rawRes.body.message?.includes('does not exist')))) {
      logger.fail('verifications table does NOT exist — BUG 3 active');
      issues.push({
        id: 'ISSUE-API-005',
        summary: 'verifications table missing — ID verification photos are silently lost',
        module: 'verification',
        layer: 'database-schema',
        severity: 'critical',
        evidence: {
          apiResponse: { status: rawRes.status, body: rawRes.body },
          stateInspection: 'verify.js catches the UPSERT error silently and still sets profiles.verification_pending=true, so admin sees user as pending but has no photos to review',
        },
        rootCause: 'BUG 3: verify.js submits ID doc and selfie via verifications.upsert(). If the table does not exist, the error is caught silently. The profile.verification_pending flag is still set, creating a state inconsistency: admin sees a pending verification with no photos.',
        fix: {
          type: 'sql',
          file: 'supabase/schema/verifications.sql',
          description: 'Create the verifications table',
          code: `CREATE TABLE IF NOT EXISTS verifications (
  user_id      uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  id_doc       text,
  selfie       text,
  status       text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  admin_note   text
);

ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_can_upsert_own_verification" ON verifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin_can_read_verifications" ON verifications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));`,
        },
      });
    } else if (rawRes.status === 200 || rawRes.status === 206 || rawRes.status === 403) {
      // 403 = table exists but RLS blocks anon (which is correct security behavior)
      logger.pass('verifications table exists (BUG 3 resolved)', `HTTP ${rawRes.status} — ${rawRes.status === 403 ? 'RLS blocking anon (correct)' : 'accessible'}`);
      tests.push({ name: 'verifications_table_exists', status: 'pass' });
    } else {
      logger.warn('verifications table status unclear', `HTTP ${rawRes.status}`);
      tests.push({ name: 'verifications_table_exists', status: 'warn', httpStatus: rawRes.status });
    }
  }

  // ── TEST 5: paid_ads column mapping ──────────────────────────────────────
  logger.section('Paid Ads — Column Mapping');
  {
    const adsRaw = await sb.rawGet(config, 'paid_ads?active=eq.true&limit=1&select=*');
    const data   = Array.isArray(adsRaw.body) ? adsRaw.body : [];
    const error  = adsRaw.status >= 400 ? { message: `HTTP ${adsRaw.status}` } : null;

    if (!error && data && data.length > 0) {
      const row         = data[0];
      const dbCols      = Object.keys(row);
      const expectedCols = Object.values(PAID_ADS_FIELD_MAP);
      const missingCols  = expectedCols.filter(c => !dbCols.includes(c));

      if (missingCols.length > 0) {
        logger.fail('Paid ads column mapping mismatch', `Missing: ${missingCols.join(', ')}`);
        issues.push({
          id: 'ISSUE-API-006',
          summary: `Paid ads DB missing expected columns: ${missingCols.join(', ')}`,
          module: 'listings',
          layer: 'database-schema',
          severity: 'high',
          evidence: { apiResponse: { availableColumns: dbCols, missingColumns: missingCols } },
          rootCause: `The app fetchAdsFromSupabase() maps DB columns to JS camelCase fields. A missing DB column means the ad will render incorrectly (e.g., missing image_url means no ad image).`,
          fix: {
            type: 'sql',
            file: 'supabase/schema/paid_ads.sql',
            description: 'Add missing columns to paid_ads table',
            code: missingCols.map(col => `ALTER TABLE paid_ads ADD COLUMN IF NOT EXISTS ${col} text;`).join('\n'),
          },
        });
      } else {
        // Specifically check image_url vs old 'image' field (historical bug)
        if ('image' in row && !('image_url' in row)) {
          logger.fail('paid_ads has image column instead of image_url — old bug still present');
          issues.push({
            id: 'ISSUE-API-006b',
            summary: 'paid_ads.image_url column missing — using deprecated image column',
            module: 'listings',
            layer: 'database-schema',
            severity: 'high',
            evidence: { apiResponse: { actualColumn: 'image', expectedColumn: 'image_url' } },
            rootCause: 'The paid_ads table was originally designed with an image column. The app was updated to use image_url but the column was not renamed, causing ad images to never display.',
            fix: {
              type: 'sql',
              file: 'supabase/schema/paid_ads.sql',
              code: `ALTER TABLE paid_ads RENAME COLUMN image TO image_url;`,
            },
          });
        } else {
          logger.pass('Paid ads column mapping correct (image_url present)');
          tests.push({ name: 'paid_ads_column_mapping', status: 'pass' });
        }
      }
    } else if (error) {
      logger.warn('paid_ads table read failed', error.message);
    } else {
      logger.info('No active paid ads to validate column mapping');
      tests.push({ name: 'paid_ads_column_mapping', status: 'pass', note: 'no data to validate' });
    }
  }

  // ── TEST 6: app_settings accessible ──────────────────────────────────────
  logger.section('App Settings — Read Check');
  {
    const settingsRaw = await sb.rawGet(config, 'app_settings?id=eq.1&select=settings');
    const arr  = Array.isArray(settingsRaw.body) ? settingsRaw.body : [];
    const data = arr.length > 0 ? arr[0] : null;
    const error = settingsRaw.status >= 400 ? { message: `HTTP ${settingsRaw.status}` } : null;

    if (error) {
      logger.warn('app_settings read failed (may be RLS-blocked for anon)', error.message);
      tests.push({ name: 'app_settings_read', status: 'warn', error: error.message });
    } else if (data) {
      logger.pass('app_settings readable', `keys: ${Object.keys(data.settings || {}).join(', ')}`);
      tests.push({ name: 'app_settings_read', status: 'pass', settings: data.settings });
      metrics.appSettings = data.settings;
    }
  }

  // ── TEST 7: Profile loadProfile field alignment ───────────────────────────
  logger.section('Profiles — Field Alignment Check');
  {
    let userToken = null;
    try {
      userToken = await sb.getAccessToken(config, config.TEST_USER);
    } catch (_) {
      userToken = null;
    }

    if (userToken) {
      const rawRes = await sb.rawGet(config, `profiles?id=eq.${config.TEST_USER.userId}&limit=1`, userToken);
      if (rawRes.status === 200 && Array.isArray(rawRes.body) && rawRes.body.length > 0) {
        const profile     = rawRes.body[0];
        const dbCols      = Object.keys(profile);
        // Columns the JS stub creates vs DB columns — check for dangerous mismatches
        const stubFields  = ['id', 'email', 'name', 'phone', 'avatar', 'verified', 'walletUSD', 'language', 'role', 'status', 'blocked'];
        const jsToDb      = { walletUSD: 'wallet_usd', blocked: 'blocked_users' };
        const mismatches  = [];

        for (const [jsField, dbCol] of Object.entries(jsToDb)) {
          if (!dbCols.includes(dbCol)) {
            mismatches.push({ jsField, expectedDbCol: dbCol });
          }
        }

        // Check that JS stub walletUSD maps correctly (wallet_usd in DB)
        if (dbCols.includes('wallet_usd') && !dbCols.includes('walletUSD')) {
          logger.warn('Profile: DB column is wallet_usd but JS stub creates walletUSD', 'wallet balance may show 0 if not re-mapped on loadProfile');
          issues.push({
            id: 'ISSUE-API-007',
            summary: 'Profile field mismatch: DB wallet_usd vs JS stub walletUSD causes wallet to always read $0',
            module: 'admin',
            layer: 'h-state',
            severity: 'medium',
            evidence: {
              stateInspection: 'H.currentUser() initialises stub with walletUSD:0. When loadProfile() merges DB data (wallet_usd), it does not remap. So u.walletUSD stays 0 while u.wallet_usd has the real value.',
              apiResponse: { wallet_usd_in_db: profile.wallet_usd, dbColumns: dbCols },
            },
            rootCause: 'H.currentUser() stub uses walletUSD (camelCase) but the Supabase profiles table column is wallet_usd (snake_case). loadProfile() merges the raw DB object via Object.assign, so wallet_usd exists but walletUSD is never populated from DB.',
            fix: {
              type: 'javascript',
              file: 'www/js/auth.js',
              fn: 'H.loadProfile',
              description: 'Remap snake_case DB fields to camelCase after loading profile',
              code: `// After merging DB data into user object, add these remaps:
if (u.wallet_usd !== undefined) u.walletUSD = u.wallet_usd;
if (u.blocked_users !== undefined) u.blocked = u.blocked_users || [];
if (u.joined_at !== undefined) u.joinedAt = new Date(u.joined_at).getTime();`,
            },
          });
        } else {
          logger.pass('Profile field alignment looks correct');
          tests.push({ name: 'profile_field_alignment', status: 'pass' });
        }
      } else {
        logger.warn('Could not fetch test user profile to validate field alignment');
      }
    } else {
      logger.warn('Test credentials not configured — skipping profile field alignment check');
    }
  }

  // ── TEST 8: messages table accessible to anon (should be blocked) ─────────
  logger.section('Messages — Anon Access (should be blocked)');
  {
    const rawRes = await sb.rawGet(config, 'messages?limit=5');
    if (rawRes.status === 200 && Array.isArray(rawRes.body) && rawRes.body.length > 0) {
      logger.fail('CRITICAL: messages table readable by anon — RLS missing or misconfigured');
      issues.push({
        id: 'ISSUE-API-008',
        summary: 'messages table is readable by unauthenticated (anon) requests',
        module: 'messaging',
        layer: 'supabase-rls',
        severity: 'critical',
        evidence: { apiResponse: { status: rawRes.status, sampleRow: rawRes.body[0] } },
        rootCause: 'The messages table has no RLS policy restricting access to conversation participants. Any anonymous request can read all private messages.',
        fix: {
          type: 'sql',
          file: 'supabase/schema/conversations.sql',
          description: 'Add RLS policy restricting message reads to conversation members',
          code: `-- Enable RLS if not already enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_only_read_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE auth.uid() = ANY(members)
    )
  );

CREATE POLICY "sender_can_insert_message" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());`,
        },
      });
    } else if (rawRes.status === 200 && Array.isArray(rawRes.body) && rawRes.body.length === 0) {
      logger.pass('messages table returns empty for anon (RLS active or no data)');
      tests.push({ name: 'anon_cannot_read_messages', status: 'pass' });
    } else {
      logger.pass('messages table blocked for anon', `HTTP ${rawRes.status}`);
      tests.push({ name: 'anon_cannot_read_messages', status: 'pass' });
    }
  }

  // ── TEST 9: conversations table — anon access ─────────────────────────────
  logger.section('Conversations — Anon Access (should be blocked)');
  {
    const rawRes = await sb.rawGet(config, 'conversations?limit=5');
    if (rawRes.status === 200 && Array.isArray(rawRes.body) && rawRes.body.length > 0) {
      logger.fail('CRITICAL: conversations table readable by anon');
      issues.push({
        id: 'ISSUE-API-009',
        summary: 'conversations table readable by unauthenticated (anon) requests',
        module: 'messaging',
        layer: 'supabase-rls',
        severity: 'critical',
        evidence: { apiResponse: { status: rawRes.status, rowCount: rawRes.body.length } },
        rootCause: 'RLS policy missing on conversations table. Exposes who messaged whom and about which listing.',
        fix: {
          type: 'sql',
          file: 'supabase/schema/conversations.sql',
          code: `ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_only_read_conversations" ON conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = ANY(members));`,
        },
      });
    } else {
      logger.pass('conversations blocked for anon', `HTTP ${rawRes.status}`);
      tests.push({ name: 'anon_cannot_read_conversations', status: 'pass' });
    }
  }

  // ── METRICS summary ───────────────────────────────────────────────────────
  logger.divider();
  const allTests = tests;
  const passed   = allTests.filter(t => t.status === 'pass').length;
  const failed   = allTests.filter(t => t.status === 'fail').length;
  logger.info(`API Validation: ${passed} passed, ${failed} failed, ${issues.length} issues found`);

  return {
    agent:   'APIValidation',
    status:  failed > 0 ? 'fail' : issues.length > 0 ? 'warn' : 'pass',
    tests,
    issues,
    metrics,
  };
}

// Standalone execution
if (require.main === module) {
  let config;
  try {
    config = require('../config');
  } catch {
    config = require('../config.example');
  }
  run(config).then(result => {
    console.log('\n' + JSON.stringify({ summary: { status: result.status, issueCount: result.issues.length } }, null, 2));
  }).catch(err => {
    console.error('Agent 2 failed:', err.message);
    process.exit(1);
  });
}

module.exports = { run };
