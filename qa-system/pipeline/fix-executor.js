'use strict';
/**
 * Fix Executor — applies approved SQL fixes to the STAGING environment only.
 *
 * SAFETY CONTRACT:
 *   • Requires SUPABASE_STAGING_DB_URL (separate from production URL).
 *   • Refuses to run if staging URL is missing or matches the production URL.
 *   • Never touches production data.
 *   • Every execution is logged with timestamp, SQL, and result.
 */

const logger = require('../utils/logger');

// ── Safety guard ──────────────────────────────────────────────────────────────

function assertStagingSafe(config) {
  if (!config.SUPABASE_STAGING_DB_URL) {
    throw new Error(
      'SUPABASE_STAGING_DB_URL not configured. ' +
      'Fix execution is disabled until a separate staging database is provided.'
    );
  }
  // Guard against accidentally pointing staging at production
  if (
    config.SUPABASE_STAGING_DB_URL === config.SUPABASE_URL ||
    (config.SUPABASE_URL && config.SUPABASE_STAGING_DB_URL.includes(
      new URL(config.SUPABASE_URL).hostname
    ))
  ) {
    throw new Error(
      'SUPABASE_STAGING_DB_URL appears to point at the production database. ' +
      'Fix execution aborted to protect production data.'
    );
  }
}

// ── SQL execution ─────────────────────────────────────────────────────────────

async function executeSqlFix(fix, config) {
  let pg;
  try {
    pg = require('pg');
  } catch {
    return {
      fixId:       fix.id,
      success:     false,
      error:       'pg package not installed — run: npm install pg',
      deployedTo:  'staging',
      startedAt:   new Date().toISOString(),
      completedAt: new Date().toISOString(),
      sql:         fix.sql,
    };
  }

  const { Client } = pg;
  const client = new Client({
    connectionString: config.SUPABASE_STAGING_DB_URL,
    ssl:              { rejectUnauthorized: false },
    statement_timeout: 30000,
  });

  const result = {
    fixId:       fix.id,
    description: fix.description || '',
    sql:         fix.sql,
    deployedTo:  'staging',
    startedAt:   new Date().toISOString(),
    success:     false,
    error:       null,
    completedAt: null,
  };

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query(fix.sql);
    await client.query('COMMIT');
    await client.end();
    result.success     = true;
    result.completedAt = new Date().toISOString();
    logger.pass(`[FixExecutor] ${fix.id} deployed to staging`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    try { await client.end(); } catch {}
    result.error       = err.message;
    result.completedAt = new Date().toISOString();
    logger.fail(`[FixExecutor] ${fix.id} failed: ${err.message}`);
  }

  return result;
}

// ── Batch execution ───────────────────────────────────────────────────────────

async function applyApprovedFixes(approvalResult, config) {
  const approved = (approvalResult.decisions || []).filter(d => d.decision === 'APPROVED');

  if (approved.length === 0) {
    logger.info('[FixExecutor] No approved fixes to execute');
    return { executed: [], skipped: [], failed: [] };
  }

  // Check if staging is configured
  if (!config.SUPABASE_STAGING_DB_URL) {
    logger.warn('[FixExecutor] SUPABASE_STAGING_DB_URL not set — skipping fix execution (staging only)');
    return {
      executed: [],
      skipped:  approved.map(d => ({ fixId: d.fixId, reason: 'staging DB URL not configured' })),
      failed:   [],
    };
  }

  // Safety: refuse to run against production
  try {
    assertStagingSafe(config);
  } catch (err) {
    logger.fail(`[FixExecutor] Safety check failed: ${err.message}`);
    return {
      executed: [],
      skipped:  [],
      failed:   approved.map(d => ({ fixId: d.fixId, error: err.message })),
    };
  }

  const executed = [];
  const failed   = [];
  const skipped  = [];

  // Attach fix payloads from the autoFix result (if provided)
  const fixMap = new Map((approvalResult.fixes || []).map(f => [f.id, f]));

  for (const decision of approved) {
    const fix = fixMap.get(decision.fixId);

    if (!fix) {
      skipped.push({ fixId: decision.fixId, reason: 'fix payload not found in approval result' });
      continue;
    }

    if (!fix.sql) {
      skipped.push({ fixId: decision.fixId, reason: 'no SQL payload (JS-only or manual fix)' });
      continue;
    }

    logger.info(`[FixExecutor] Applying ${fix.id}: ${fix.description}`);
    const execResult = await executeSqlFix(fix, config);

    if (execResult.success) {
      executed.push(execResult);
    } else {
      failed.push(execResult);
    }
  }

  return { executed, skipped, failed };
}

module.exports = { applyApprovedFixes, executeSqlFix, assertStagingSafe };
