'use strict';
/**
 * Retest Engine — re-runs targeted and full regression tests after a fix deployment.
 *
 * Step 1: Targeted retest — only re-run agents affected by the deployed fix(es).
 * Step 2: Full regression  — re-run all non-browser agents in parallel.
 * Step 3: Comparison       — diff before vs after results and emit a verdict.
 *
 * Verdicts:
 *   FIX_SUCCESSFUL — all issues addressed, no new issues introduced
 *   PARTIAL_FIX    — some issues resolved, some persist
 *   FAILED_FIX     — fix made things worse (new issues introduced)
 */

const logger = require('../utils/logger');

// Maps each fix ID to the agent keys that should be retested
const FIX_TO_AGENTS = {
  'FIX-001': ['apiValidation', 'securityAudit'],
  'FIX-002': ['apiValidation', 'securityAudit'],
  'FIX-003': ['apiValidation', 'dataFlowTrace'],
  'FIX-004': ['dataFlowTrace'],
  'FIX-005': ['apiValidation', 'performance'],
  'FIX-006': ['performance'],
  'FIX-007': ['dataFlowTrace', 'featureTesting'],
  'FIX-008': ['dataFlowTrace'],
  'FIX-009': ['securityAudit'],
};

// ── Targeted retest ───────────────────────────────────────────────────────────

async function runTargetedRetests(executedFixes, agents, config) {
  const agentsToRetest = new Set();

  for (const fix of executedFixes) {
    const targets = FIX_TO_AGENTS[fix.fixId] || [];
    targets.forEach(a => agentsToRetest.add(a));
  }

  if (agentsToRetest.size === 0) {
    logger.info('[RetestEngine] No targeted agents for deployed fixes');
    return { phase: 'targeted', results: {}, agentsTested: [] };
  }

  logger.info(`[RetestEngine] Targeted retest: ${[...agentsToRetest].join(', ')}`);

  const results = {};
  for (const agentKey of agentsToRetest) {
    if (!agents[agentKey]) {
      logger.warn(`[RetestEngine] Agent ${agentKey} not available for retest`);
      continue;
    }
    try {
      logger.info(`[RetestEngine] Retesting ${agentKey}...`);
      results[agentKey] = await agents[agentKey].run(config);
    } catch (err) {
      results[agentKey] = {
        agent:  agentKey,
        status: 'error',
        error:  err.message,
        tests:  [],
        issues: [],
      };
    }
  }

  return { phase: 'targeted', results, agentsTested: [...agentsToRetest] };
}

// ── Full regression suite ─────────────────────────────────────────────────────

async function runFullRegression(agents, config) {
  logger.info('[RetestEngine] Running full regression suite...');

  // Run API, data-flow, security, and performance agents in parallel.
  // Feature testing (Playwright) is slower — only include if playwright is installed.
  const agentKeys = ['apiValidation', 'dataFlowTrace', 'securityAudit', 'performance'];

  const results = {};

  await Promise.all(
    agentKeys.map(async key => {
      if (!agents[key]) return;
      try {
        results[key] = await agents[key].run(config);
      } catch (err) {
        results[key] = {
          agent:  key,
          status: 'error',
          error:  err.message,
          tests:  [],
          issues: [],
        };
      }
    })
  );

  const passed = Object.values(results).flatMap(r => r?.tests || []).filter(t => t.status === 'pass').length;
  const failed = Object.values(results).flatMap(r => r?.tests || []).filter(t => t.status === 'fail').length;
  logger.info(`[RetestEngine] Regression suite complete: ${passed} passed, ${failed} failed`);

  return { phase: 'regression', results, agentsTested: agentKeys };
}

// ── Before/after comparison ───────────────────────────────────────────────────

function compareBeforeAfter(beforeResults, afterResults) {
  const beforeIssues = new Map();
  const afterIssues  = new Map();

  for (const result of Object.values(beforeResults)) {
    for (const issue of (result?.issues || [])) {
      beforeIssues.set(issue.id, issue);
    }
  }

  for (const result of Object.values(afterResults)) {
    for (const issue of (result?.issues || [])) {
      afterIssues.set(issue.id, issue);
    }
  }

  const fixed      = [];
  const persisting = [];
  const newIssues  = [];

  for (const [id, issue] of beforeIssues) {
    if (!afterIssues.has(id)) {
      fixed.push(issue);
    } else {
      persisting.push(issue);
    }
  }

  for (const [id, issue] of afterIssues) {
    if (!beforeIssues.has(id)) {
      newIssues.push(issue);
    }
  }

  return { fixed, persisting, newIssues };
}

function evaluateVerdict(comparison) {
  const { fixed, persisting, newIssues } = comparison;

  if (newIssues.length > 0) {
    return 'FAILED_FIX';
  }
  if (persisting.length === 0 && fixed.length >= 0) {
    return 'FIX_SUCCESSFUL';
  }
  if (fixed.length > 0 && persisting.length > 0) {
    return 'PARTIAL_FIX';
  }
  return 'FAILED_FIX';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run targeted + full regression, compare against pre-fix snapshot, and return verdict.
 */
async function run(executedFixes, beforeResults, agents, config) {
  if (!executedFixes || executedFixes.length === 0) {
    return {
      skipped:    true,
      reason:     'no fixes were executed — retest not needed',
      verdict:    null,
      comparison: null,
    };
  }

  const targeted  = await runTargetedRetests(executedFixes, agents, config);
  const full      = await runFullRegression(agents, config);

  // Merge targeted + full results for comparison (full is a superset, use it)
  const afterResults = { ...targeted.results, ...full.results };
  const comparison   = compareBeforeAfter(beforeResults, afterResults);
  const verdict      = evaluateVerdict(comparison);

  logger.info(`[RetestEngine] Verdict: ${verdict}`);

  return {
    skipped:     false,
    targeted,
    full,
    afterResults,
    comparison,
    verdict,
  };
}

module.exports = {
  run,
  runTargetedRetests,
  runFullRegression,
  compareBeforeAfter,
  evaluateVerdict,
};
