'use strict';
/**
 * AGENT 5 — Security + RLS Audit Agent
 *
 * Empirically validates Row Level Security policies by making HTTP requests
 * at three privilege levels and comparing what data is returned:
 *
 *   • anon      — unauthenticated (public visitors)
 *   • user      — authenticated regular user
 *   • admin     — authenticated user with role='admin' in profiles
 *
 * Does NOT require service-role key. Validates the exact same security
 * surface that real app users face.
 *
 * Returns: { agent, status, tests, issues }
 */

const logger = require('../utils/logger');
const sb     = require('../utils/supabase-client');

// Tables to audit and expected access per role
const TABLE_AUDIT = [
  // table, anon_expected, user_expected, admin_expected, notes
  { table: 'listings',       anon: 'some',  user: 'some',  admin: 'all',  note: 'anon should see active only; admin sees all statuses' },
  { table: 'profiles',       anon: 'none',  user: 'own',   admin: 'all',  note: 'private user data' },
  { table: 'messages',       anon: 'none',  user: 'own',   admin: 'all',  note: 'sensitive chat content' },
  { table: 'conversations',  anon: 'none',  user: 'own',   admin: 'all',  note: 'conversation membership' },
  { table: 'notifications',  anon: 'none',  user: 'own',   admin: 'all',  note: 'per-user private notifications' },
  { table: 'verifications',  anon: 'none',  user: 'own',   admin: 'all',  note: 'sensitive ID documents' },
  { table: 'user_saves',     anon: 'none',  user: 'own',   admin: 'all',  note: 'private save lists' },
  { table: 'reports',        anon: 'none',  user: 'none',  admin: 'all',  note: 'moderation data' },
  { table: 'topup_requests', anon: 'none',  user: 'none',  admin: 'all',  note: 'financial requests' },
  { table: 'paid_ads',       anon: 'some',  user: 'some',  admin: 'all',  note: 'public active ads visible to all' },
  { table: 'applications',   anon: 'none',  user: 'own',   admin: 'all',  note: 'job applications' },
];

async function run(config) {
  logger.agent('AGENT 5 — Security + RLS Audit');
  const tests  = [];
  const issues = [];

  // Obtain tokens
  let anonToken  = null;  // stays null
  let userToken  = null;
  let adminToken = null;

  try {
    userToken  = await sb.getAccessToken(config, config.TEST_USER);
    logger.pass('Test user authenticated for RLS audit');
  } catch (e) {
    logger.warn('Test user not configured — user-level RLS tests will be skipped', e.message);
  }

  try {
    adminToken = await sb.getAccessToken(config, config.TEST_ADMIN);
    logger.pass('Test admin authenticated for RLS audit');
  } catch (e) {
    logger.warn('Test admin not configured — admin-level RLS tests will be skipped', e.message);
  }

  // ── Audit each table ───────────────────────────────────────────────────────
  for (const spec of TABLE_AUDIT) {
    logger.section(`Table: ${spec.table}`);

    // 1. Anon access
    const anonRes = await sb.rawGet(config, `${spec.table}?limit=5`, anonToken);
    const anonRows = Array.isArray(anonRes.body) ? anonRes.body : [];
    const anonHasData = anonRows.length > 0;
    const anonBlocked = anonRes.status === 401 || anonRes.status === 403 ||
                        (anonRes.status === 200 && !anonHasData);

    if (spec.anon === 'none' && anonHasData) {
      logger.fail(`ANON can read ${spec.table} — ${anonRows.length} rows exposed`, spec.note);
      const severity = ['messages', 'conversations', 'verifications', 'notifications'].includes(spec.table)
        ? 'critical' : 'high';
      issues.push({
        id: `ISSUE-SEC-${spec.table.toUpperCase()}-ANON`,
        summary: `${spec.table} table is readable by unauthenticated (anon) requests — ${anonRows.length} rows exposed`,
        module: tableToModule(spec.table),
        layer: 'supabase-rls',
        severity,
        evidence: {
          apiResponse: {
            table:     spec.table,
            role:      'anon',
            httpStatus: anonRes.status,
            rowCount:  anonRows.length,
            sampleRow: anonRows[0] ? sanitize(anonRows[0]) : null,
          },
        },
        rootCause: `Missing or incorrectly scoped SELECT policy on ${spec.table}. The anon role should never read this data. Every RLS policy must explicitly scope access to auth.uid() or role checks.`,
        fix: {
          type: 'sql',
          file: `supabase/schema/${spec.table}.sql`,
          description: `Restrict ${spec.table} reads to authenticated users only`,
          code: buildAnonBlockPolicy(spec.table),
        },
      });
      tests.push({ name: `${spec.table}_anon_blocked`, status: 'fail' });
    } else if (spec.anon === 'some' && anonHasData) {
      logger.pass(`ANON reads ${spec.table} (${anonRows.length} rows — public data, expected)`);
      tests.push({ name: `${spec.table}_anon_public`, status: 'pass', rowCount: anonRows.length });
    } else if (spec.anon === 'none' && !anonHasData) {
      logger.pass(`ANON cannot read ${spec.table} (blocked or empty)`);
      tests.push({ name: `${spec.table}_anon_blocked`, status: 'pass' });
    } else if (spec.anon === 'some' && !anonHasData) {
      logger.warn(`ANON expected some rows from ${spec.table} but got 0 — may indicate broken public read policy or empty table`);
      tests.push({ name: `${spec.table}_anon_public`, status: 'warn' });
    }

    // 2. Admin access (BUG 2 focus: admin should see all tables)
    if (adminToken) {
      const adminRes  = await sb.rawGet(config, `${spec.table}?limit=10`, adminToken);
      const adminRows = Array.isArray(adminRes.body) ? adminRes.body : [];

      if (spec.admin === 'all') {
        if (adminRows.length === 0 && adminRes.status === 200) {
          logger.warn(`ADMIN reads ${spec.table} but gets 0 rows — RLS may be silently blocking (BUG 2)`);
          issues.push({
            id: `ISSUE-SEC-${spec.table.toUpperCase()}-ADMIN`,
            summary: `Admin gets 0 rows from ${spec.table} — silent RLS block (BUG 2 pattern)`,
            module: tableToModule(spec.table),
            layer: 'supabase-rls',
            severity: spec.table === 'listings' || spec.table === 'profiles' ? 'critical' : 'high',
            evidence: {
              apiResponse: {
                table:      spec.table,
                role:       'admin (via profiles.role)',
                httpStatus: adminRes.status,
                rowCount:   adminRows.length,
              },
              stateInspection: `Admin dashboard DATA.${spec.table} will be empty. No error is thrown — PostgREST returns [] silently when RLS denies all rows.`,
            },
            rootCause: `BUG 2: The admin user authenticates via Supabase Auth with role='admin' in the profiles table, but uses the ANON key (not service-role key). Without a specific admin SELECT policy, the admin sees the same restricted data as a regular user. The admin portal cannot function correctly.`,
            fix: {
              type: 'sql',
              file: `supabase/schema/${spec.table}.sql`,
              description: `Add admin bypass SELECT policy for ${spec.table}`,
              code: buildAdminPolicy(spec.table),
            },
          });
          tests.push({ name: `${spec.table}_admin_all_rows`, status: 'warn' });
        } else if (adminRows.length > 0) {
          logger.pass(`ADMIN reads ${spec.table} (${adminRows.length} rows)`);
          tests.push({ name: `${spec.table}_admin_all_rows`, status: 'pass', rowCount: adminRows.length });
        } else if (adminRes.status !== 200) {
          logger.fail(`ADMIN blocked from ${spec.table}`, `HTTP ${adminRes.status}`);
          tests.push({ name: `${spec.table}_admin_all_rows`, status: 'fail', httpStatus: adminRes.status });
        }
      }
    }

    // 3. User isolation check — user should only see own data
    if (userToken && spec.user === 'own' && config.TEST_USER.userId) {
      const userRes  = await sb.rawGet(config, `${spec.table}?limit=20`, userToken);
      const userRows = Array.isArray(userRes.body) ? userRes.body : [];

      // Check that returned rows belong only to the test user
      if (userRows.length > 0) {
        const foreignRows = userRows.filter(row => !rowBelongsToUser(row, spec.table, config.TEST_USER.userId));
        if (foreignRows.length > 0) {
          logger.fail(`User sees ${foreignRows.length} rows belonging to OTHER users in ${spec.table}`);
          issues.push({
            id: `ISSUE-SEC-${spec.table.toUpperCase()}-ISOLATION`,
            summary: `User can read ${foreignRows.length} rows belonging to other users in ${spec.table}`,
            module: tableToModule(spec.table),
            layer: 'supabase-rls',
            severity: 'critical',
            evidence: {
              apiResponse: {
                table:        spec.table,
                totalRows:    userRows.length,
                foreignRows:  foreignRows.length,
                sampleForeign: sanitize(foreignRows[0]),
              },
            },
            rootCause: `The SELECT policy on ${spec.table} does not properly scope to auth.uid(). Users can read data belonging to other accounts.`,
            fix: {
              type: 'sql',
              file: `supabase/schema/${spec.table}.sql`,
              description: `Fix SELECT policy on ${spec.table} to scope to auth.uid()`,
              code: buildUserIsolationPolicy(spec.table),
            },
          });
          tests.push({ name: `${spec.table}_user_isolation`, status: 'fail' });
        } else {
          logger.pass(`User sees only own rows in ${spec.table} (${userRows.length} rows)`);
          tests.push({ name: `${spec.table}_user_isolation`, status: 'pass', rowCount: userRows.length });
        }
      }
    }
  }

  // ── SQL Injection via PostgREST filters ──────────────────────────────────
  logger.section('SQL Injection — PostgREST Filter Safety');
  {
    // PostgREST parameterises all inputs, so direct SQL injection is not possible.
    // However, we test that malicious filter values do not cause unexpected behaviour.
    const maliciousFilters = [
      `listings?title=eq.'; DROP TABLE listings; --`,
      `listings?price=eq.0; SELECT * FROM profiles`,
      `listings?id=eq.${encodeURIComponent("' OR '1'='1")}`,
    ];

    let injectionSafe = true;
    for (const filter of maliciousFilters) {
      const res = await sb.rawGet(config, filter);
      if (res.status === 500) {
        // 500 from PostgREST usually means a bad query was executed server-side
        logger.fail(`Potential SQL injection vector: ${filter.slice(0, 60)}...`);
        injectionSafe = false;
      } else {
        logger.pass(`Malicious filter safely handled`, `HTTP ${res.status} — ${filter.slice(0, 50)}`);
      }
    }

    if (injectionSafe) {
      tests.push({ name: 'sql_injection_safety', status: 'pass' });
    }
  }

  // ── Conversation ID collision risk ───────────────────────────────────────
  logger.section('Conversation ID — Collision Risk (BUG 6)');
  {
    // BUG 6: convId uses last 6 chars of user IDs and listing ID
    // Two listings that end in the same 6 chars → same conversation thread
    // We can detect this by checking the listing pool from Supabase
    const listingsRaw = await sb.rawGet(config, 'listings?status=eq.active&select=id&limit=200');
    const listings    = Array.isArray(listingsRaw.body) ? listingsRaw.body : [];

    if (listings && listings.length > 0) {
      const last6Set = new Set();
      const collisions = [];
      listings.forEach(l => {
        const key = l.id.slice(-6);
        if (last6Set.has(key)) collisions.push(l.id);
        last6Set.add(key);
      });

      if (collisions.length > 0) {
        logger.fail(`Conversation ID collision risk: ${collisions.length} listing(s) share last-6 chars with another listing`);
        issues.push({
          id: 'ISSUE-SEC-CONVID-COLLISION',
          summary: `${collisions.length} listings have duplicate last-6 chars — conversation ID collisions active`,
          module: 'messaging',
          layer: 'frontend',
          severity: 'high',
          evidence: {
            stateInspection: {
              formula:    "conv_' + sorted(userId1, userId2)[0].slice(-6) + '_' + sorted(userId1, userId2)[1].slice(-6) + '_' + listingId.slice(-6)",
              collision_count: collisions.length,
              sample_colliding_listings: collisions.slice(0, 3),
            },
          },
          rootCause: 'BUG 6: The deterministic conversation ID formula uses only 6 chars of each UUID. UUIDs have ~36^6 = 2.18 billion possibilities but in practice share last segments in clusters. Two different listings that end in the same 6 chars will produce the same conversationId for the same buyer/seller pair, merging their separate conversations into one thread.',
          fix: {
            type: 'javascript',
            file: 'www/js/messages.js',
            fn: 'H.startChatWith',
            description: 'Use full listing ID and 12-char user ID slices to reduce collision probability',
            code: `// Replace the convId formula with a longer hash
function makeConvId(uid1, uid2, listingId) {
  const [a, b] = [uid1, uid2].sort();
  // Use first 8 chars + last 4 chars of each user ID, plus full listing ID tail
  return 'conv_' + a.replace(/-/g,'').slice(-10) + '_' + b.replace(/-/g,'').slice(-10) + '_' + listingId.replace(/-/g,'').slice(-8);
}`,
          },
        });
        tests.push({ name: 'conversation_id_collision_risk', status: 'fail', collisions: collisions.length });
      } else {
        logger.pass('No conversation ID collisions detected in current listing pool');
        tests.push({ name: 'conversation_id_collision_risk', status: 'pass', sampleSize: listings.length });
      }
    }
  }

  logger.divider();
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  logger.info(`Security Audit: ${passed} passed, ${failed} failed, ${issues.length} issues found`);

  return { agent: 'SecurityRLSAudit', status: failed > 0 ? 'fail' : issues.length > 0 ? 'warn' : 'pass', tests, issues };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tableToModule(table) {
  const map = {
    listings: 'listings', profiles: 'admin', messages: 'messaging',
    conversations: 'messaging', notifications: 'notifications',
    verifications: 'verification', user_saves: 'listings',
    reports: 'admin', topup_requests: 'admin',
    paid_ads: 'listings', applications: 'admin',
  };
  return map[table] || 'admin';
}

function rowBelongsToUser(row, table, userId) {
  // Each table has a different user-ownership column
  const ownerCols = {
    profiles:      ['id'],
    messages:      ['sender_id'],
    conversations: ['members'],  // array contains check
    notifications: ['user_id'],
    verifications: ['user_id'],
    user_saves:    ['user_id'],
    applications:  ['applicant_id', 'employer_id'],
  };
  const cols = ownerCols[table];
  if (!cols) return true;  // unknown table — assume ok
  return cols.some(col => {
    const val = row[col];
    if (Array.isArray(val)) return val.includes(userId);
    return val === userId;
  });
}

function sanitize(row) {
  // Remove potentially sensitive values before including in report
  if (!row) return null;
  const safe = { ...row };
  const sensitiveKeys = ['id_doc', 'selfie', 'password', 'twoFactorSecret', 'idDocs'];
  sensitiveKeys.forEach(k => { if (k in safe) safe[k] = '[REDACTED]'; });
  return safe;
}

function buildAnonBlockPolicy(table) {
  return `-- Ensure RLS is enabled
ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;

-- Remove any overly permissive anon SELECT policies if they exist
-- DROP POLICY IF EXISTS "anon_read_${table}" ON ${table};

-- Allow only authenticated users to read (scope further as needed)
CREATE POLICY "authenticated_only_${table}" ON ${table}
  FOR SELECT TO authenticated
  USING (true);`;
}

function buildAdminPolicy(table) {
  return `-- Add admin bypass SELECT policy for ${table}
CREATE POLICY "admin_read_all_${table}" ON ${table}
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );`;
}

function buildUserIsolationPolicy(table) {
  const userCol = {
    profiles: 'id', messages: 'sender_id', notifications: 'user_id',
    verifications: 'user_id', user_saves: 'user_id', applications: 'applicant_id',
  }[table] || 'user_id';

  return `-- Fix user isolation on ${table}
DROP POLICY IF EXISTS "user_read_own_${table}" ON ${table};
CREATE POLICY "user_read_own_${table}" ON ${table}
  FOR SELECT TO authenticated
  USING (${userCol} = auth.uid());`;
}

if (require.main === module) {
  let config;
  try { config = require('../config'); } catch { config = require('../config.example'); }
  run(config).then(r => {
    console.log(`\nSecurity audit: ${r.status.toUpperCase()} — ${r.issues.length} issues`);
  }).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { run };
