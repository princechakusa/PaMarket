'use strict';
/**
 * AGENT 3 — Data Flow Trace Agent
 *
 * Traces the full data pipeline for each critical user flow:
 *   UI action → H.state mutation → Supabase API call → DB write → read-back → UI render
 *
 * Identifies exact breakpoints at each stage without executing the actual flows
 * (since we're in Node, not the browser). Instead we:
 *   1. Parse the JS source to extract field mappings
 *   2. Run corresponding read-back queries against Supabase
 *   3. Compare actual DB schema vs what the JS expects
 *   4. Flag any mismatches as data flow breakpoints
 *
 * Returns: { agent, status, traces, issues }
 */

const fs      = require('fs');
const path    = require('path');
const logger  = require('../utils/logger');
const sb      = require('../utils/supabase-client');

// ── Known data flow mappings extracted from source code ──────────────────────
// Each trace describes: what JS sends → what column DB expects → what JS reads back
const FLOW_TRACES = [

  // ── Flow 1: Listing creation ─────────────────────────────────────────────
  {
    id:      'TRACE-001',
    name:    'Listing Creation: JS → Supabase → H.state',
    module:  'listings',
    source:  'www/js/app.js → H.saveListingToCloud()',
    stages: [
      {
        label:  'UI → H.state',
        jsObj:  'H.state.listings.push(listing)',
        fields: { sellerId:'UUID', title:'string', desc:'string', price:'number', currency:'USD|ZiG', cat:'category-id', prov:'province', city:'city', photos:'array<base64|url>', status:'pending|active' },
      },
      {
        label:  'H.state → Supabase UPSERT',
        table:  'listings',
        mapping: {
          sellerId:    'seller_id',
          sellerName:  'seller_name',
          sellerPhone: 'seller_phone',
          title:       'title',
          desc:        'description',      // ← MAPPING: desc → description
          cat:         'category',          // ← MAPPING: cat → category
          prov:        'province',          // ← MAPPING: prov → province
          createdAt:   'created_at',        // ← TYPE: JS sends new Date().toISOString()
          price:       'price',
          currency:    'currency',
          photos:      'photos',
          status:      'status',
          boost:       'boost',
          views:       'views',
        },
        knownIssues: [
          'negotiable field is in DB schema but NOT written by saveListingToCloud — always null',
        ],
      },
      {
        label:  'Supabase → H.state (read-back)',
        fn:     'H.fetchListingsFromSupabase()',
        mapping: {
          'seller_id':    'sellerId',
          'seller_name':  'sellerName',
          'seller_phone': 'sellerPhone',
          'description':  'desc',
          'category':     'cat',
          'province':     'prov',
          'created_at':   'createdAt',  // ← TYPE: converted via new Date().getTime()
        },
      },
    ],
  },

  // ── Flow 2: Notification push ─────────────────────────────────────────────
  {
    id:      'TRACE-002',
    name:    'Notification Push: H.pushNotif() → Supabase → Realtime → UI',
    module:  'notifications',
    source:  'www/js/notifications.js → H.pushNotif()',
    stages: [
      {
        label:  'H.pushNotif() → local state',
        fields: { id:'UUID', t:'Date.now() (bigint)', title:'string', body:'string', type:'string', read:'false' },
      },
      {
        label:  'H.pushNotif() → Supabase INSERT',
        table:  'notifications',
        mapping: {
          id:         'id',
          uid:        'user_id',
          title:      'title',
          body:       'body',
          type:       'type',
          read:       'read',
          't':        'created_at',   // ← CRITICAL: n.t (integer) inserted as bigint
        },
        knownIssues: [
          'created_at column MUST be bigint (not timestamptz). If column type is wrong, insert fails silently and notification is lost on other devices.',
        ],
      },
      {
        label:  'Realtime INSERT → _setupRealtimeNotifs()',
        channel: 'notifications:{userId}',
        filter:  'user_id=eq.{userId}',
        delivery: 'payload.new.created_at used as Date: new Date(r.created_at).getTime()',
        risk: 'If created_at is bigint, new Date(bigintMs) is correct. If created_at is timestamptz ISO string, this still works. But the INSERT itself fails with bigint column if a string is passed.',
      },
    ],
  },

  // ── Flow 3: Verification submit ───────────────────────────────────────────
  {
    id:      'TRACE-003',
    name:    'Verification Submit: verify.js → verifications table + profiles update',
    module:  'verification',
    source:  'www/js/verify.js → H._verify.submitForReview()',
    stages: [
      {
        label: 'UI → verify.js',
        steps: [
          'Step 1: user captures ID doc via file input → H.compressImage() → base64 stored in u.idDocs',
          'Step 2: user takes selfie via getUserMedia() → canvas.toDataURL() → base64 in u.selfie',
          'Step 3: submit button calls H._verify.submitForReview()',
        ],
      },
      {
        label: 'submitForReview() → Supabase UPSERT verifications',
        table: 'verifications',
        code: `verifications.upsert({ user_id: u.id, id_doc: u.idDocs, selfie: u.selfie, status: 'pending' }, { onConflict: 'user_id' })`,
        risk: 'The ENTIRE flow is wrapped in try/catch. If verifications table does not exist, the error is swallowed. profiles.verification_pending is still set to true. Admin sees user as pending but has NO photos.',
      },
      {
        label: 'submitForReview() → profiles UPDATE',
        table: 'profiles',
        code: `profiles.update({ verification_pending: true }).eq('id', u.id)`,
        note: 'This ALWAYS succeeds regardless of whether the verifications upsert succeeded.',
      },
      {
        label: 'Admin reads verification',
        table: 'verifications',
        note: 'Admin queries verifications JOIN profiles. If verifications table is missing or RLS blocks admin, admin sees empty list or user name only (no photos).',
        breakpoint: 'Admin sees "verification_pending=true" in profiles but gets no rows from verifications. Creates false positive — user appears to need review but has submitted no valid data.',
      },
    ],
    knownIssues: ['BUG 3: Silent data loss if verifications table missing'],
  },

  // ── Flow 4: Messaging ─────────────────────────────────────────────────────
  {
    id:      'TRACE-004',
    name:    'Messaging: Send → Supabase → Realtime → Recipient',
    module:  'messaging',
    source:  'www/js/messages.js → H.sendChat()',
    stages: [
      {
        label: 'H.sendChat() → local DOM append (Pattern B)',
        note: 'Chat uses DOM append pattern — NOT full page re-render. Message appears instantly.',
      },
      {
        label: 'H.sendChat() → messages.upsert()',
        table: 'messages',
        mapping: {
          id:              'id',
          'conv.id':       'conversation_id',
          'state.currentUserId': 'sender_id',
          'u.name':        'sender_name',
          text:            'text',
          'Date.now()':    'created_at',   // ← TYPE: ISO string sent, timestamptz column
          read:            'false',
        },
        risk: 'messages.created_at is timestamptz — the JS sends new Date().toISOString() which is correct. However on read-back, the JS converts with new Date(msg.created_at).getTime() which also works. No type bug here.',
      },
      {
        label: 'Realtime INSERT → _setupRealtimeMessages()',
        channel: 'messages-rt',
        note: 'Global channel (no user filter). All users receive all message inserts. RLS must filter.',
        risk: 'If the realtime channel fires for a conversation the recipient is NOT a member of, the message is appended to a non-existent conversation or silently dropped. The H.state.conversations.find() check prevents corruption.',
      },
      {
        label: 'Recipient conversation display',
        check: 'H._appendChatMessages() or H._refreshMessagesPage() is called. The new message must already be in H.state.conversations[].messages[].',
        breakpoint: 'If syncConversations() failed earlier (conversations table RLS blocked), the conversation may not be in H.state. The realtime payload arrives but finds no matching conv — calls syncConversations() again (line 831 app.js).',
      },
    ],
  },

  // ── Flow 5: Paid ad display ───────────────────────────────────────────────
  {
    id:      'TRACE-005',
    name:    'Paid Ad Display: fetchAdsFromSupabase → H.state.paidAds → home.js render',
    module:  'listings',
    source:  'www/js/app.js → H.fetchAdsFromSupabase()',
    stages: [
      {
        label: 'fetchAdsFromSupabase() → paid_ads SELECT',
        table: 'paid_ads',
        selectCols: 'id,type,business_name,headline,tagline,image_url,bg_color,link_url,target_cat,starts_at,ends_at,active,priority,impressions,clicks,listing_id',
        note: 'If any column is missing from DB, the select will fail or return null for that column.',
      },
      {
        label: 'DB → H.state.paidAds mapping',
        mapping: {
          'business_name': 'businessName',
          'image_url':     'imageUrl',   // ← HISTORICAL BUG: was 'image', fixed to 'image_url'
          'bg_color':      'bgColor',
          'link_url':      'linkUrl',
          'target_cat':    'targetCat',
          'starts_at':     'startsAt',   // converted via new Date().getTime()
          'ends_at':       'endsAt',     // null → 9999999999999
          'listing_id':    'listingId',
        },
      },
      {
        label: 'home.js renders ad',
        note: 'home.js uses a.imageUrl for the ad image. If imageUrl is null (because DB column is image not image_url), no image renders.',
        check: 'Verify DB column is image_url not image',
      },
    ],
  },

  // ── Flow 6: Admin reads listings/users (BUG 2) ────────────────────────────
  {
    id:      'TRACE-006',
    name:    'Admin Portal: admin.html → listings/users read → DATA object',
    module:  'admin',
    source:  'www/js/admin.js → loadListings(), loadUsers()',
    stages: [
      {
        label: 'Admin signs in',
        note: 'admin.html has its own Supabase client. Admin signs in via email/password. Gets JWT with user\'s role in profile, but token is still anon key based — NOT service role.',
      },
      {
        label: 'loadListings() → listings.select("*")',
        table: 'listings',
        note: 'No status filter — should return ALL listings (pending, active, sold, deleted). But WITHOUT admin RLS policy, only active listings are returned (or 0 rows). Admin cannot see pending listings.',
        breakpoint: 'BUG 2: No "admin_read_listings" policy exists. Admin sees only what anon sees.',
      },
      {
        label: 'loadUsers() → profiles 3-tier fallback',
        tiers: [
          'Tier 1: select("id,name,email,phone,role,status,verified,verification_pending,banReason,...")',
          'Tier 2: without verification_pending (if column missing)',
          'Tier 3: bare minimum ("id,name,email,role,status")',
        ],
        note: 'If RLS blocks admin from reading profiles, all 3 tiers return 0 rows. No error, no indication of RLS block. Admin users tab is empty.',
        breakpoint: 'BUG 2: No "admin_read_profiles" policy exists.',
      },
      {
        label: 'DATA.verifications read',
        table: 'verifications',
        note: 'Admin reads verifications table to show ID docs for review. If verifications table missing (BUG 3) OR admin RLS missing (BUG 2), admin sees no pending verifications.',
        breakpoint: 'Compound failure: both BUG 2 and BUG 3 can make the verifications tab empty.',
      },
    ],
  },
];

async function run(config) {
  logger.agent('AGENT 3 — Data Flow Trace');
  const traces = [];
  const issues = [];
  const anon   = sb.anonClient(config);

  for (const flow of FLOW_TRACES) {
    logger.section(`${flow.id}: ${flow.name}`);
    const traceResult = { ...flow, stageResults: [], breakpoints: [] };

    // Run any Supabase verification queries associated with this trace
    switch (flow.id) {

      case 'TRACE-001': {
        // Verify listing field mapping by reading an actual listing back (use rawGet to avoid Host allowlist)
        const rawRes = await sb.rawGet(config, 'listings?status=eq.active&select=*&limit=1');
        const data   = Array.isArray(rawRes.body) ? rawRes.body : null;
        if (data && data.length > 0) {
          const row = data[0];
          const mapping = flow.stages[1].mapping;
          const breakpoints = [];

          for (const [jsField, dbCol] of Object.entries(mapping)) {
            if (!(dbCol in row)) {
              breakpoints.push({ jsField, dbCol, status: 'missing', impact: `H.state.listings[].${jsField} will always be undefined` });
              logger.fail(`Column mapping broken: ${jsField} → ${dbCol} (column absent in DB)`);
            } else {
              // Type check for created_at
              if (dbCol === 'created_at') {
                const val = row[dbCol];
                const isIso = typeof val === 'string' && val.includes('T');
                if (isIso) {
                  logger.pass(`listing.created_at is ISO string — JS converts via new Date().getTime() ✔`);
                }
              }
            }
          }

          // Check 'negotiable' is not written
          if ('negotiable' in row && row.negotiable === null) {
            logger.warn('listing.negotiable is always null (never written by saveListingToCloud)');
            breakpoints.push({
              jsField: '(missing)',
              dbCol: 'negotiable',
              status: 'unwritten',
              impact: 'negotiable flag never set, feature non-functional if UI shows it',
            });
          }

          traceResult.breakpoints = breakpoints;
          if (breakpoints.filter(b => b.status === 'missing').length > 0) {
            issues.push({
              id: 'ISSUE-TRACE-001',
              summary: 'Listing field mapping has missing DB columns — some H.state fields will be undefined',
              module: 'listings',
              layer: 'database-schema',
              severity: 'high',
              evidence: { apiResponse: { sampleRow: row, breakpoints } },
              rootCause: `The DB columns ${breakpoints.map(b=>b.dbCol).join(', ')} are missing. fetchListingsFromSupabase() mapping will produce undefined for the corresponding JS fields.`,
              fix: { type: 'sql', file: 'supabase/schema/listings.sql', code: breakpoints.map(b=>`ALTER TABLE listings ADD COLUMN IF NOT EXISTS ${b.dbCol} text;`).join('\n') },
            });
          } else {
            logger.pass('All listing field mappings verified against live DB');
          }
        }
        break;
      }

      case 'TRACE-002': {
        // Verify notifications created_at type
        let userToken = null;
        try { userToken = await sb.getAccessToken(config, config.TEST_USER); } catch (_) {}

        if (userToken) {
          const rawRes = await sb.rawGet(config, 'notifications?limit=1&order=created_at.desc', userToken);
          if (rawRes.status === 200 && Array.isArray(rawRes.body) && rawRes.body.length > 0) {
            const ts  = rawRes.body[0].created_at;
            const isInt = typeof ts === 'number';
            const isStr = typeof ts === 'string';

            if (isStr && ts.includes('T')) {
              logger.fail('TRACE-002 BREAKPOINT: notifications.created_at is timestamptz ISO string');
              logger.info('  App inserts: created_at: n.t (integer, Date.now())');
              logger.info(`  DB returns:  ${ts} (ISO string)`);
              logger.info('  → Column type mismatch — inserts with integer will be auto-converted or fail');
              traceResult.breakpoints.push({
                stage: 'H.pushNotif() INSERT',
                expected: 'bigint (integer ms)',
                actual: `timestamptz (${ts})`,
                impact: 'Notification created_at sorting wrong; potential insert rejection',
              });
              issues.push({
                id: 'ISSUE-TRACE-002',
                summary: 'notifications.created_at column type mismatch: app uses bigint, DB has timestamptz',
                module: 'notifications',
                layer: 'database-schema',
                severity: 'critical',
                evidence: { apiResponse: { sample_created_at: ts, type: typeof ts } },
                rootCause: 'The notifications.created_at column is timestamptz but H.pushNotif() inserts n.t (Date.now() integer ms). PostgreSQL will auto-convert a timestamp-like integer (Unix seconds) but will reject values > 32503680000 (year 3000) or misinterpret them. The app blueprint explicitly requires bigint.',
                fix: {
                  type: 'sql',
                  file: 'supabase/schema/notifications.sql',
                  code: `ALTER TABLE notifications ALTER COLUMN created_at TYPE bigint USING EXTRACT(EPOCH FROM created_at) * 1000;`,
                },
              });
            } else if (isInt) {
              logger.pass(`TRACE-002: notifications.created_at is bigint (${ts}) — correct`);
            }
          }
        }
        break;
      }

      case 'TRACE-003': {
        // Verify verifications table and profile.verification_pending column
        const vRes = await sb.rawGet(config, 'verifications?limit=0');
        const tableExists = vRes.status !== 404 && !(vRes.body && vRes.body.code === '42P01');

        if (!tableExists) {
          logger.fail('TRACE-003 BREAKPOINT: verifications table does not exist');
          traceResult.breakpoints.push({
            stage:  'submitForReview() → verifications.upsert()',
            impact: 'UPSERT throws, error caught silently, profile.verification_pending=true set anyway',
            result: 'Admin sees pending verification with no photos — impossible to approve correctly',
          });
        } else {
          logger.pass('TRACE-003: verifications table exists');
          // Check if profiles.verification_pending column exists
          let userToken = null;
          try { userToken = await sb.getAccessToken(config, config.TEST_USER); } catch (_) {}
          if (userToken && config.TEST_USER.userId) {
            const pRes = await sb.rawGet(config, `profiles?id=eq.${config.TEST_USER.userId}&select=verification_pending`, userToken);
            if (pRes.status === 200 && Array.isArray(pRes.body)) {
              const hasCol = pRes.body.length > 0 && 'verification_pending' in pRes.body[0];
              if (!hasCol) {
                logger.warn('profiles.verification_pending column may be missing or not readable');
                traceResult.breakpoints.push({ stage: 'profiles.update(verification_pending)', impact: 'Column may not exist' });
              } else {
                logger.pass('profiles.verification_pending column accessible');
              }
            }
          }
        }
        break;
      }

      case 'TRACE-004': {
        // Check conversations table and messages accessible
        const cRes = await sb.rawGet(config, 'conversations?limit=0');
        const mRes = await sb.rawGet(config, 'messages?limit=0');
        const convOk = cRes.status !== 404;
        const msgOk  = mRes.status !== 404;

        if (!convOk) {
          logger.fail('TRACE-004 BREAKPOINT: conversations table missing');
          traceResult.breakpoints.push({ stage: 'H.syncConversations()', impact: 'All conversations invisible' });
        }
        if (!msgOk) {
          logger.fail('TRACE-004 BREAKPOINT: messages table missing');
          traceResult.breakpoints.push({ stage: 'H.saveMessageToCloud()', impact: 'Messages not persisted' });
        }
        if (convOk && msgOk) {
          logger.pass('TRACE-004: conversations and messages tables exist');
        }
        break;
      }

      case 'TRACE-005': {
        // Verify paid_ads image_url column (use rawGet to avoid Host allowlist)
        const adsRes = await sb.rawGet(config, 'paid_ads?active=eq.true&select=*&limit=1');
        const data   = Array.isArray(adsRes.body) ? adsRes.body : null;
        if (data && data.length > 0) {
          const row = data[0];
          if ('image_url' in row) {
            logger.pass('TRACE-005: paid_ads.image_url column present (historical bug fixed)');
          } else if ('image' in row) {
            logger.fail('TRACE-005 BREAKPOINT: paid_ads uses "image" column not "image_url" — ads will not render images');
            traceResult.breakpoints.push({ stage: 'fetchAdsFromSupabase() mapping', dbCol: 'image', expected: 'image_url' });
            issues.push({
              id: 'ISSUE-TRACE-005',
              summary: 'paid_ads table still uses deprecated "image" column — ad images never render',
              module: 'listings',
              layer: 'database-schema',
              severity: 'high',
              evidence: { apiResponse: { presentColumn: 'image', expectedColumn: 'image_url' } },
              rootCause: 'fetchAdsFromSupabase() maps r.image_url to state.imageUrl. If DB column is "image", r.image_url is undefined, imageUrl is undefined, and the ad renders with no image.',
              fix: { type: 'sql', file: 'supabase/schema/paid_ads.sql', code: `ALTER TABLE paid_ads RENAME COLUMN image TO image_url;` },
            });
          }
        }
        break;
      }

      case 'TRACE-006': {
        // Verify admin can read all listings (BUG 2 check)
        let adminToken = null;
        try { adminToken = await sb.getAccessToken(config, config.TEST_ADMIN); } catch (_) {}

        if (adminToken) {
          const allListings = await sb.rawGet(config, 'listings?limit=10', adminToken);
          const pendingOnly = await sb.rawGet(config, 'listings?status=eq.pending&limit=10', adminToken);
          const pendingCount = Array.isArray(pendingOnly.body) ? pendingOnly.body.length : 0;

          if (pendingCount === 0 && allListings.status === 200) {
            logger.warn('TRACE-006: Admin gets 0 pending listings — BUG 2 (admin RLS) may be active');
            traceResult.breakpoints.push({
              stage: 'Admin loadListings()',
              expected: 'All listing statuses (pending, active, sold)',
              actual: '0 pending listings — likely RLS blocking admin',
              impact: 'Admin cannot review or approve pending listings',
            });
            issues.push({
              id: 'ISSUE-TRACE-006',
              summary: 'Admin cannot read pending listings — BUG 2: missing admin SELECT policy on listings',
              module: 'admin',
              layer: 'supabase-rls',
              severity: 'critical',
              evidence: { apiResponse: { pendingListingsReturned: 0, adminHttpStatus: allListings.status } },
              rootCause: 'BUG 2: Admin uses anon key, authenticated as admin user. Without an explicit admin SELECT policy on listings that overrides status=active filter, admin only sees active listings. Pending listings are completely invisible.',
              fix: {
                type: 'sql',
                file: 'supabase/schema/listings.sql',
                code: `CREATE POLICY "admin_read_all_listings" ON listings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );`,
              },
            });
          } else if (pendingCount > 0) {
            logger.pass(`TRACE-006: Admin can read pending listings (${pendingCount} found)`);
          }
        } else {
          logger.warn('TRACE-006: No admin credentials — admin RLS trace skipped');
        }
        break;
      }
    }

    traces.push(traceResult);
    logger.divider();
  }

  return { agent: 'DataFlowTrace', status: issues.length > 0 ? 'warn' : 'pass', traces, issues };
}

if (require.main === module) {
  let config;
  try { config = require('../config'); } catch { config = require('../config.example'); }
  run(config).then(r => {
    console.log(`\nData flow trace: ${r.traces.length} flows traced, ${r.issues.length} issues`);
  }).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { run };
