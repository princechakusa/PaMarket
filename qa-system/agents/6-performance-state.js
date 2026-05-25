'use strict';
/**
 * AGENT 6 — Performance + State Agent
 *
 * Monitors risks specific to PaMarket's localStorage-based state architecture:
 *   • H.state JSON size vs localStorage 5MB limit (critical on iOS Safari)
 *   • Base64 photo payload growth (ID docs + selfies)
 *   • 200-listing cap: invisible listings beyond the fetch limit
 *   • Realtime channel leak risk
 *   • localStorage QuotaExceededError — caught but state not persisted silently
 *
 * Operates entirely via Supabase reads — no browser required.
 * Returns: { agent, status, tests, issues, metrics }
 */

const logger  = require('../utils/logger');
const sb      = require('../utils/supabase-client');

// Thresholds (bytes unless noted)
const LOCALSTORAGE_LIMIT  = 5 * 1024 * 1024;  // 5 MB — Safari iOS hard limit
const STATE_WARN_THRESHOLD = 3 * 1024 * 1024;  // 3 MB — alert before hitting limit
const STATE_CRIT_THRESHOLD = 4 * 1024 * 1024;  // 4 MB — critical
const BASE64_ID_DOC_AVG   = 600 * 1024;         // ~600 KB per ID document
const BASE64_SELFIE_AVG   = 300 * 1024;         // ~300 KB per selfie
const LISTING_PAYLOAD_AVG = 1200;               // ~1.2 KB per listing JSON object
const MESSAGE_PAYLOAD_AVG = 400;                // ~400 bytes per message
const CONVERSATION_BASE   = 200;                // ~200 bytes per conversation header

async function run(config) {
  logger.agent('AGENT 6 — Performance + State Monitor');
  const tests   = [];
  const issues  = [];
  const metrics = {};

  const anon = sb.anonClient(config);

  // ── METRIC 1: Listing count and 200-cap ───────────────────────────────────
  logger.section('Listing Count vs 200-Row Fetch Cap');
  {
    const activeRaw  = await sb.rawGet(config, 'listings?status=eq.active&select=id');
    const totalRaw   = await sb.rawGet(config, 'listings?select=id');
    const activeRows = Array.isArray(activeRaw.body) ? activeRaw.body : [];
    const totalRows  = Array.isArray(totalRaw.body)  ? totalRaw.body  : [];
    // Prefer Content-Range header count; fall back to body length
    const parseCount = (res, rows) => {
      const cr = res.headers && res.headers['content-range'];
      if (cr) { const n = parseInt(cr.split('/')[1], 10); if (!isNaN(n)) return n; }
      return rows.length;
    };
    const activeCount = parseCount(activeRaw, activeRows);
    const totalCount  = parseCount(totalRaw,  totalRows);

    metrics.activeListingCount = activeCount;
    metrics.totalListingCount  = totalCount;
    metrics.invisibleListings  = Math.max(0, (activeCount || 0) - 200);

    if (metrics.invisibleListings > 0) {
      logger.fail(`${metrics.invisibleListings} active listings permanently invisible (beyond 200-cap)`);
      issues.push({
        id: 'ISSUE-PERF-001',
        summary: `${metrics.invisibleListings} listings beyond 200-row cap are completely invisible in the app`,
        module: 'listings',
        layer: 'frontend',
        severity: 'high',
        evidence: {
          stateInspection: {
            activeListings: activeCount,
            fetchLimit:     200,
            invisible:      metrics.invisibleListings,
          },
        },
        rootCause: 'BUG 4: app.js H.fetchListingsFromSupabase() hard-codes .limit(200). As the marketplace grows, the oldest listings (beyond position 200, ordered by created_at DESC) will never appear in any feed, search, or category page.',
        fix: {
          type: 'javascript',
          file: 'www/js/app.js',
          fn: 'fetchListingsFromSupabase',
          description: 'Add cursor-based pagination using the last listing\'s created_at as a cursor',
          code: `// Replace the current single fetch with a paginated system.
// Add this function for progressive loading:
H._listingCursor = null;

H.fetchListingsPage = async function(reset = false) {
  if (reset) H._listingCursor = null;
  const PAGE = 100;
  let query = window.supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (H._listingCursor) {
    query = query.lt('created_at', H._listingCursor);
  }
  const { data, error } = await query;
  if (error || !data) return false;
  if (data.length > 0) {
    H._listingCursor = data[data.length - 1].created_at;
    const mapped = data.map(r => ({ /* same mapping as current fetchListingsFromSupabase */ }));
    if (reset) {
      H.state.listings = mapped;
    } else {
      // Append, deduplicating by id
      const ids = new Set(H.state.listings.map(l => l.id));
      H.state.listings.push(...mapped.filter(l => !ids.has(l.id)));
    }
    H.saveState();
  }
  return data.length === PAGE; // returns true if more pages may exist
};`,
        },
      });
      tests.push({ name: 'listing_200_cap', status: 'fail', invisible: metrics.invisibleListings });
    } else {
      logger.pass(`All ${activeCount || 0} active listings within 200-cap`);
      tests.push({ name: 'listing_200_cap', status: 'pass', count: activeCount });
    }
  }

  // ── METRIC 2: H.state size estimation ─────────────────────────────────────
  logger.section('H.state Size Estimation');
  {
    // Fetch representative data to estimate state size
    const listingsRaw = await sb.rawGet(config, 'listings?status=eq.active&select=*&limit=200&order=created_at.desc');
    const listings    = Array.isArray(listingsRaw.body) ? listingsRaw.body : [];

    const listingPayload   = JSON.stringify(listings || []).length;
    const estimatedPayload = {
      listings:         listingPayload,
      conversationsEst: 50 * (CONVERSATION_BASE + 20 * MESSAGE_PAYLOAD_AVG),  // 50 conversations, 20 msgs each
      usersEst:         30 * 800,         // 30 cached user profiles at ~800 bytes each
      notifsEst:        100 * 200,        // 100 notifications at ~200 bytes each
      adminLogsEst:     300 * 300,        // 300 admin log entries
      miscEst:          50 * 1024,        // misc state fields
    };

    const totalEstimate   = Object.values(estimatedPayload).reduce((a, b) => a + b, 0);
    // Add base64 photo risk
    const photoRisk       = BASE64_ID_DOC_AVG + BASE64_SELFIE_AVG;  // if current user has uploaded
    const worstCase       = totalEstimate + photoRisk;

    metrics.stateSizeEstimate   = totalEstimate;
    metrics.stateSizeWithPhotos = worstCase;
    metrics.localStorageLimit   = LOCALSTORAGE_LIMIT;
    metrics.listingPayloadBytes = listingPayload;

    logger.info(`Listing JSON payload: ${(listingPayload / 1024).toFixed(1)} KB (${(listings || []).length} listings)`);
    logger.info(`Estimated H.state size: ${(totalEstimate / 1024 / 1024).toFixed(2)} MB`);
    logger.info(`Worst case (with photos): ${(worstCase / 1024 / 1024).toFixed(2)} MB vs ${(LOCALSTORAGE_LIMIT / 1024 / 1024).toFixed(0)} MB limit`);

    if (worstCase > STATE_CRIT_THRESHOLD) {
      logger.fail(`H.state worst-case size (${(worstCase / 1024 / 1024).toFixed(2)} MB) approaches iOS Safari 5 MB limit`);
      issues.push({
        id: 'ISSUE-PERF-002',
        summary: `H.state can reach ${(worstCase / 1024 / 1024).toFixed(2)} MB — iOS Safari localStorage limit is 5 MB`,
        module: 'admin',
        layer: 'h-state',
        severity: 'high',
        evidence: {
          stateInspection: {
            estimatedComponents: estimatedPayload,
            totalEstimateMB:    (totalEstimate / 1024 / 1024).toFixed(2),
            base64PhotoRiskMB:  (photoRisk / 1024 / 1024).toFixed(2),
            worstCaseMB:        (worstCase / 1024 / 1024).toFixed(2),
            limitMB:            (LOCALSTORAGE_LIMIT / 1024 / 1024).toFixed(0),
          },
        },
        rootCause: 'BUG 5: Base64-encoded ID documents and selfies stored in H.state.users[].idDocs and .selfie add up to ~900 KB per user with photos. Combined with listings, conversations, and admin data, the total can exceed 5 MB — the hard localStorage limit on iOS Safari. H.saveState() catches QuotaExceededError with a toast, but the state is NOT saved, causing silent data loss on reload.',
        fix: {
          type: 'javascript',
          file: 'www/js/verify.js',
          fn: 'submitForReview',
          description: 'Store ID doc and selfie in Supabase Storage instead of H.state (localStorage)',
          code: `// Instead of storing base64 in H.state.users, upload to Supabase Storage:
// In verify.js, replace base64 storage with Storage upload:

async function uploadToStorage(base64DataUrl, bucket, filePath) {
  const arr  = base64DataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const data = atob(arr[1]);
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
  const file = new Blob([bytes], { type: mime });
  const { data: result, error } = await supabase.storage
    .from(bucket).upload(filePath, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return publicUrl; // store URL, not base64
}

// Usage: const idDocUrl = await uploadToStorage(base64, 'ids', userId + '/id_doc.jpg');
//        const selfieUrl = await uploadToStorage(base64, 'selfies', userId + '/selfie.jpg');
// Then store only the URLs in H.state, not the base64 strings.`,
        },
      });
      tests.push({ name: 'state_size_safe', status: 'fail', worstCaseMB: (worstCase / 1024 / 1024).toFixed(2) });
    } else if (totalEstimate > STATE_WARN_THRESHOLD) {
      logger.warn(`H.state estimated at ${(totalEstimate / 1024 / 1024).toFixed(2)} MB — approaching limit`);
      tests.push({ name: 'state_size_safe', status: 'warn', estimateMB: (totalEstimate / 1024 / 1024).toFixed(2) });
    } else {
      logger.pass(`H.state estimated size is safe (${(totalEstimate / 1024 / 1024).toFixed(2)} MB)`);
      tests.push({ name: 'state_size_safe', status: 'pass', estimateMB: (totalEstimate / 1024 / 1024).toFixed(2) });
    }
  }

  // ── METRIC 3: Base64 photo risk ──────────────────────────────────────────
  logger.section('Base64 Photo Storage Risk');
  {
    // Check if any users have base64 stored directly in profiles
    // (we can't read the actual base64 but we can check profile sizes)
    let userToken = null;
    try { userToken = await sb.getAccessToken(config, config.TEST_USER); } catch (_) {}

    if (userToken) {
      const rawRes = await sb.rawGet(config, 'profiles?select=id,idDocs,selfie&limit=1', userToken);
      if (rawRes.status === 200 && Array.isArray(rawRes.body) && rawRes.body.length > 0) {
        const profile = rawRes.body[0];
        const hasBase64IdDoc = profile.idDocs && profile.idDocs.length > 100;  // base64 would be very long
        const hasBase64Selfie = profile.selfie && profile.selfie.length > 100;

        if (hasBase64IdDoc || hasBase64Selfie) {
          const idDocSize   = hasBase64IdDoc  ? Buffer.byteLength(profile.idDocs, 'utf8')  : 0;
          const selfieSize  = hasBase64Selfie ? Buffer.byteLength(profile.selfie, 'utf8')  : 0;
          const totalKB     = (idDocSize + selfieSize) / 1024;

          logger.warn(`Base64 photos detected in profile columns: ~${totalKB.toFixed(0)} KB`);
          metrics.base64InProfiles = { idDocKB: (idDocSize / 1024).toFixed(0), selfieKB: (selfieSize / 1024).toFixed(0) };

          issues.push({
            id: 'ISSUE-PERF-003',
            summary: `Base64-encoded photos stored directly in profiles table, bloating localStorage`,
            module: 'verification',
            layer: 'h-state',
            severity: 'high',
            evidence: {
              stateInspection: {
                idDocPresent:  hasBase64IdDoc,
                selfiePresent: hasBase64Selfie,
                estimatedKB:  totalKB.toFixed(0),
              },
            },
            rootCause: 'BUG 5: verify.js compresses photos and stores them as base64 data URIs in the profiles table. H.loadProfile() then loads this into H.state.users, which is serialized to localStorage via H.saveState(). A 600 KB ID doc + 300 KB selfie = 900 KB just for one user\'s verification data.',
            fix: {
              type: 'javascript',
              file: 'www/js/verify.js',
              description: 'Upload photos to Supabase Storage and store only the public URL',
              code: `// Same as ISSUE-PERF-002 fix — move base64 to Supabase Storage`,
            },
          });
        } else {
          logger.pass('No large base64 blobs detected in profiles (photos likely using URLs)');
          tests.push({ name: 'base64_photo_risk', status: 'pass' });
        }
      }
    } else {
      // Estimate risk from schema knowledge
      logger.warn('Cannot read profiles without test credentials — estimating risk from schema');
      logger.info(`Estimated: 1 user with photos = ${((BASE64_ID_DOC_AVG + BASE64_SELFIE_AVG) / 1024).toFixed(0)} KB in localStorage`);
      metrics.base64RiskEstimateKB = ((BASE64_ID_DOC_AVG + BASE64_SELFIE_AVG) / 1024).toFixed(0);
      tests.push({ name: 'base64_photo_risk', status: 'warn', note: 'no credentials to verify' });
    }
  }

  // ── METRIC 4: Realtime channel leak ──────────────────────────────────────
  logger.section('Realtime Channel — Leak Risk Analysis');
  {
    // We can't run in-browser but we can analyse the code patterns
    const channelRisks = [
      {
        channel: 'messages-rt',
        code: 'app.js H._setupRealtimeMessages()',
        risk: 'Called once on boot. No unsubscribe on logout. Channel persists across user sessions in the same browser tab.',
        severity: 'medium',
      },
      {
        channel: 'notifications:{userId}',
        code: 'notifications.js H._setupRealtimeNotifs()',
        risk: 'Removes old channel before creating new one (correct). But if called multiple times before the first resolves, race condition may create duplicate subscriptions.',
        severity: 'low',
      },
    ];

    channelRisks.forEach(r => {
      if (r.severity === 'medium') {
        logger.warn(`Realtime channel leak risk: ${r.channel}`, r.risk);
        issues.push({
          id: `ISSUE-PERF-CHANNEL-${r.channel.replace(/[^a-z]/gi, '_').toUpperCase()}`,
          summary: `Realtime channel '${r.channel}' not unsubscribed on user logout`,
          module: 'messaging',
          layer: 'realtime-sync',
          severity: 'medium',
          evidence: { stateInspection: { channel: r.channel, sourceCode: r.code, riskDescription: r.risk } },
          rootCause: 'H.logout() clears state and reloads the page, which does clean up the channel implicitly. However, if a user logs in as a different account without a full page reload, the old realtime channel continues to deliver messages to the previous user\'s handler.',
          fix: {
            type: 'javascript',
            file: 'www/js/app.js',
            fn: 'H.logout',
            description: 'Explicitly unsubscribe all realtime channels before logout',
            code: `// Add to H.logout() BEFORE the state clear and signOut call:
async function cleanupRealtimeChannels() {
  if (window._msgChannel) {
    try { await window.supabase.removeChannel(window._msgChannel); } catch(e) {}
    window._msgChannel = null;
  }
  if (H._notifChannel) {
    try { await window.supabase.removeChannel(H._notifChannel); } catch(e) {}
    H._notifChannel = null;
  }
}
// Then in H.logout():
// await cleanupRealtimeChannels();
// H.state.currentUserId = null;
// H.saveState();
// await supabase.auth.signOut();
// window.location.reload();`,
          },
        });
      }
    });

    logger.pass('Realtime channel risk analysis complete');
    tests.push({ name: 'realtime_channel_leak', status: 'warn', riskCount: channelRisks.filter(r => r.severity === 'medium').length });
  }

  // ── METRIC 5: admin logs cap at 300 ─────────────────────────────────────
  logger.section('Admin Logs — 300-Entry Cap');
  {
    logger.info('adminLogs capped at 300 entries in H.state — stored in localStorage only');
    logger.warn('Admin audit trail is lost when localStorage is cleared or device switches');
    issues.push({
      id: 'ISSUE-PERF-005',
      summary: 'Admin audit logs (adminLogs) stored only in H.state/localStorage — not persisted to Supabase',
      module: 'admin',
      layer: 'h-state',
      severity: 'medium',
      evidence: {
        stateInspection: {
          location: 'H.state.adminLogs',
          cap: 300,
          persistence: 'localStorage only',
          risk: 'Logs lost on clear/different device. No cross-admin visibility.',
        },
      },
      rootCause: 'H.adminLog() pushes to H.state.adminLogs and calls H.saveState(). There is no Supabase persistence. If an admin uses a different device or browser, they see no history. If localStorage is cleared, all logs are lost.',
      fix: {
        type: 'javascript',
        file: 'www/js/app.js',
        fn: 'H.adminLog',
        description: 'Persist admin logs to an error_logs or admin_logs Supabase table',
        code: `// Extend H.adminLog to also insert into Supabase:
H.adminLog = function(action, meta = {}) {
  const u = this.currentUser(); if (!u) return;
  const log = { id: this.uid(), t: Date.now(), adminId: u.id, adminName: u.name || 'Admin', action, meta };
  this.state.adminLogs.unshift(log);
  this.state.adminLogs = this.state.adminLogs.slice(0, 300);
  this.saveState();

  // Persist to Supabase (fire-and-forget)
  if (window.supabase) {
    window.supabase.from('error_logs').insert({
      id: log.id,
      created_at: new Date(log.t).toISOString(),
      context: JSON.stringify({ adminId: log.adminId, adminName: log.adminName, action, meta })
    }).then(({ error }) => {
      if (error) console.warn('adminLog persist failed:', error.message);
    });
  }
};`,
      },
    });
    tests.push({ name: 'admin_log_persistence', status: 'warn' });
  }

  logger.divider();
  logger.info(`Performance audit: ${issues.length} issues — ${JSON.stringify(metrics, null, 0)}`);

  return {
    agent:   'PerformanceState',
    status:  issues.some(i => i.severity === 'critical') ? 'fail' : issues.length > 0 ? 'warn' : 'pass',
    tests,
    issues,
    metrics,
  };
}

if (require.main === module) {
  let config;
  try { config = require('../config'); } catch { config = require('../config.example'); }
  run(config).then(r => {
    console.log(`\nPerformance audit: ${r.status.toUpperCase()} — ${r.issues.length} issues`);
    console.log('Metrics:', JSON.stringify(r.metrics, null, 2));
  }).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { run };
