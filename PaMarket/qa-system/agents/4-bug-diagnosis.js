'use strict';
/**
 * AGENT 4 — Bug Diagnosis Agent (Root Cause Engine)
 *
 * Ingests the outputs of all prior agents and:
 *   1. Deduplicates overlapping issues
 *   2. Classifies each by layer (frontend | supabase-rls | database-schema | h-state | realtime-sync)
 *   3. Groups related issues into compound failures
 *   4. Assigns severity based on user-facing impact
 *   5. Produces a ranked issue list with exact root-cause reasoning
 *
 * This agent does NOT call Supabase — it works purely from prior agent outputs.
 * Returns: { agent, status, issues, compoundFailures, priorityList }
 */

const logger = require('../utils/logger');

// ── Layer classification rules ────────────────────────────────────────────────
const LAYER_SIGNATURES = {
  'supabase-rls': [
    'rls', 'policy', 'anon', 'role', 'auth.uid', 'row level security',
    'admin_read', 'authenticated', 'permission', 'blocked silently',
  ],
  'database-schema': [
    'column', 'table', 'schema', 'missing', 'bigint', 'timestamptz',
    'timestamptz', 'alter table', 'type mismatch', 'does not exist',
  ],
  'h-state': [
    'localstorage', 'h.state', 'savestate', 'loadstate', 'quota',
    'base64', 'camelcase', 'cache', 'stub', 'walletusd',
  ],
  'realtime-sync': [
    'realtime', 'websocket', 'channel', 'subscription', 'postgres_changes',
    'insert event', 'unsubscribe', 'leak',
  ],
  'frontend': [
    'limit(200)', 'cap', 'pagination', 'render', 'dom', 'camelcase mapping',
    'conv_', 'collision', 'deterministic id', 'hard-code',
  ],
};

// ── Known compound failure patterns ──────────────────────────────────────────
const COMPOUND_PATTERNS = [
  {
    id: 'COMPOUND-001',
    name: 'Admin Portal Completely Non-Functional',
    description: 'BUG 2 (no admin RLS) + optional BUG 3 (no verifications table) combine to make the admin dashboard show empty data in every tab.',
    triggerIssueIds: ['ISSUE-API-005', 'ISSUE-TRACE-006', 'ISSUE-SEC-LISTINGS-ADMIN', 'ISSUE-SEC-PROFILES-ADMIN', 'ISSUE-SEC-VERIFICATIONS-ADMIN'],
    combinedSeverity: 'critical',
    userImpact: 'Admin cannot approve pending listings, verify users, read reports, or manage the platform. The marketplace runs without moderation.',
    remediationOrder: ['listings admin policy', 'profiles admin policy', 'verifications table creation', 'verifications admin policy'],
  },
  {
    id: 'COMPOUND-002',
    name: 'Verification Flow Silently Broken',
    description: 'BUG 3 (verifications table missing) causes submitted ID photos to be silently discarded. Combined with BUG 2 (admin RLS), admin cannot verify users even when photos were saved.',
    triggerIssueIds: ['ISSUE-API-005', 'ISSUE-TRACE-003'],
    combinedSeverity: 'critical',
    userImpact: 'Users submit verification believing it was received. Admin sees user as "pending" but has no photos to review. Verified badge never awarded. Trust system non-functional.',
    remediationOrder: ['Create verifications table', 'Add admin RLS policy on verifications'],
  },
  {
    id: 'COMPOUND-003',
    name: 'Notification System at Risk',
    description: 'If notifications.created_at is wrong type (BUG 1) AND admin notification sends fail, the primary admin communication tool fails silently.',
    triggerIssueIds: ['ISSUE-API-004', 'ISSUE-TRACE-002'],
    combinedSeverity: 'critical',
    userImpact: 'Admins cannot notify users of listing approvals, verification results, or bans. Users do not receive in-app notifications across devices.',
    remediationOrder: ['Fix notifications.created_at column type'],
  },
  {
    id: 'COMPOUND-004',
    name: 'Marketplace Growth Blocked',
    description: 'BUG 4 (200-listing cap) + localStorage size growth mean the app degrades as listing count grows. New sellers cannot be found; existing sellers lose visibility.',
    triggerIssueIds: ['ISSUE-API-003', 'ISSUE-PERF-001', 'ISSUE-PERF-002'],
    combinedSeverity: 'high',
    userImpact: 'Platform growth is self-limiting. As listing count exceeds 200, the "first-come-first-served" discovery model means all new sellers are invisible. Meanwhile localStorage fills with 200 listings + conversations + photos.',
    remediationOrder: ['Implement pagination', 'Move photos to Supabase Storage'],
  },
];

// ── Severity scoring matrix ───────────────────────────────────────────────────
const SEVERITY_SCORE = { critical: 4, high: 3, medium: 2, low: 1 };

function classifyLayer(issue) {
  const text = `${issue.summary} ${issue.rootCause || ''}`.toLowerCase();
  for (const [layer, keywords] of Object.entries(LAYER_SIGNATURES)) {
    if (keywords.some(kw => text.includes(kw))) return layer;
  }
  return issue.layer || 'frontend';  // fall back to declared layer
}

function deduplicateIssues(allIssues) {
  const seen = new Map();
  for (const issue of allIssues) {
    if (!seen.has(issue.id)) {
      seen.set(issue.id, issue);
    } else {
      // Merge evidence from duplicate
      const existing = seen.get(issue.id);
      existing.evidence = { ...existing.evidence, ...issue.evidence };
    }
  }
  return Array.from(seen.values());
}

function rankIssues(issues) {
  return [...issues].sort((a, b) => {
    const sa = SEVERITY_SCORE[a.severity] || 0;
    const sb = SEVERITY_SCORE[b.severity] || 0;
    if (sa !== sb) return sb - sa;
    // Within same severity, RLS and schema issues come first (server-side, harder to fix)
    const layerPriority = { 'supabase-rls': 3, 'database-schema': 2, 'h-state': 1, 'realtime-sync': 1, 'frontend': 0 };
    return (layerPriority[b.layer] || 0) - (layerPriority[a.layer] || 0);
  });
}

async function run(config, agentResults) {
  logger.agent('AGENT 4 — Bug Diagnosis (Root Cause Engine)');

  if (!agentResults) {
    logger.warn('No prior agent results provided — running in standalone mode with empty inputs');
    agentResults = {};
  }

  // ── Step 1: Collect all issues from prior agents ──────────────────────────
  logger.section('Collecting Issues from All Agents');
  const rawIssues = [];
  const agentNames = {
    apiValidation:  'API Validation',
    dataFlowTrace:  'Data Flow Trace',
    securityAudit:  'Security & RLS Audit',
    performance:    'Performance & State',
    featureTesting: 'Feature Testing',
  };

  for (const [key, name] of Object.entries(agentNames)) {
    const result = agentResults[key];
    if (!result) { logger.info(`${name}: no results (agent not run)`); continue; }
    const count = (result.issues || []).length;
    logger.info(`${name}: ${count} issue(s)`);
    (result.issues || []).forEach(i => rawIssues.push({ ...i, _source: key }));
  }

  logger.info(`Total raw issues before dedup: ${rawIssues.length}`);

  // ── Step 2: Deduplicate ───────────────────────────────────────────────────
  logger.section('Deduplication');
  const dedupedIssues = deduplicateIssues(rawIssues);
  logger.info(`After dedup: ${dedupedIssues.length} unique issues`);

  // ── Step 3: Re-classify layers ─────────────────────────────────────────────
  logger.section('Layer Classification & Severity Assignment');
  const classifiedIssues = dedupedIssues.map(issue => {
    const classifiedLayer = classifyLayer(issue);
    if (classifiedLayer !== issue.layer) {
      logger.debug(`${issue.id}: layer reclassified ${issue.layer} → ${classifiedLayer}`);
    }
    return { ...issue, layer: classifiedLayer };
  });

  // ── Step 4: Detect compound failures ─────────────────────────────────────
  logger.section('Compound Failure Detection');
  const issueIds   = new Set(classifiedIssues.map(i => i.id));
  const activeCompounds = COMPOUND_PATTERNS.filter(pattern =>
    pattern.triggerIssueIds.some(tid => issueIds.has(tid))
  );

  if (activeCompounds.length > 0) {
    logger.warn(`${activeCompounds.length} compound failure pattern(s) detected:`);
    activeCompounds.forEach(c => {
      logger.issue(c.combinedSeverity, c.id, c.name);
      logger.info(`  Impact: ${c.userImpact}`);
    });
  } else {
    logger.pass('No compound failure patterns detected');
  }

  // ── Step 5: Rank and output ───────────────────────────────────────────────
  logger.section('Priority Ranking');
  const rankedIssues = rankIssues(classifiedIssues);

  rankedIssues.forEach((issue, i) => {
    logger.issue(issue.severity, issue.id, issue.summary);
    logger.info(`  Layer: ${issue.layer} | Module: ${issue.module}`);
    if (issue.rootCause) {
      const rc = issue.rootCause.slice(0, 120) + (issue.rootCause.length > 120 ? '...' : '');
      logger.info(`  Root cause: ${rc}`);
    }
  });

  // ── Step 6: Summary by module and layer ──────────────────────────────────
  logger.section('Issue Distribution');
  const byModule = {};
  const byLayer  = {};
  rankedIssues.forEach(i => {
    byModule[i.module] = (byModule[i.module] || 0) + 1;
    byLayer[i.layer]   = (byLayer[i.layer]   || 0) + 1;
  });

  logger.info('By module: ' + Object.entries(byModule).map(([m, n]) => `${m}:${n}`).join(', '));
  logger.info('By layer:  ' + Object.entries(byLayer).map(([l, n]) => `${l}:${n}`).join(', '));

  // ── Step 7: Priority action list ─────────────────────────────────────────
  logger.section('Recommended Fix Priority');
  const criticals = rankedIssues.filter(i => i.severity === 'critical');
  const highs     = rankedIssues.filter(i => i.severity === 'high');

  logger.info(`Critical (fix immediately): ${criticals.length}`);
  criticals.forEach(i => logger.fail(`  → ${i.id}: ${i.summary}`));
  logger.info(`High (fix before next release): ${highs.length}`);
  highs.slice(0, 5).forEach(i => logger.warn(`  → ${i.id}: ${i.summary}`));

  logger.divider();

  const status = criticals.length > 0 ? 'fail' : highs.length > 0 ? 'warn' : 'pass';

  return {
    agent:            'BugDiagnosis',
    status,
    issues:           rankedIssues,
    compoundFailures: activeCompounds,
    priorityList: {
      critical: criticals.map(i => ({ id: i.id, summary: i.summary, layer: i.layer })),
      high:     highs.map(i => ({ id: i.id, summary: i.summary, layer: i.layer })),
    },
  };
}

if (require.main === module) {
  let config;
  try { config = require('../config'); } catch { config = require('../config.example'); }
  // Run with empty agent results for standalone testing
  run(config, {}).then(r => {
    console.log(`\nDiagnosis: ${r.status.toUpperCase()} — ${r.issues.length} issues, ${r.compoundFailures.length} compound failures`);
  }).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { run };
