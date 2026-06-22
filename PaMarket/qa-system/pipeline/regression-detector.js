'use strict';
/**
 * Regression Detector — compares current-run issues against the persistent store.
 *
 * A regression is an issue that was previously marked 'fixed' but reappears
 * in a later run. Regressions are automatically severity-escalated and block
 * deployment when critical or high.
 *
 * An issue is "unstable" when it has regressed more than REGRESSION_THRESHOLD
 * times — this signals an unreliable fix and also blocks deployment.
 */

const logger = require('../utils/logger');

const REGRESSION_THRESHOLD = 2;

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

// ── Severity helpers ──────────────────────────────────────────────────────────

function upgradeSeverity(severity) {
  const idx = SEVERITY_ORDER.indexOf(severity);
  return idx < SEVERITY_ORDER.length - 1
    ? SEVERITY_ORDER[idx + 1]
    : 'critical';
}

// ── Core detection ────────────────────────────────────────────────────────────

/**
 * Classify current-run issues by comparing them against the store.
 *
 * Returns:
 *   regressions     — issues that were 'fixed' but reappear now
 *   newIssues       — issues never seen before
 *   knownOpenIssues — issues already tracked as open/investigating
 */
function detectRegressions(currentIssues, store) {
  const regressions     = [];
  const newIssues       = [];
  const knownOpenIssues = [];

  for (const issue of currentIssues) {
    const existing = store.issues[issue.id];

    if (!existing) {
      newIssues.push(issue);
      continue;
    }

    if (existing.status === 'fixed') {
      const regressionCount = (existing.regressionCount || 0) + 1;
      regressions.push({
        ...issue,
        isRegression:    true,
        regressionCount,
        lastFixedAt:     existing.fixHistory?.slice(-1)[0]?.fixedAt || null,
        originalSeverity: issue.severity,
        severity:        upgradeSeverity(issue.severity),
      });
    } else {
      knownOpenIssues.push(issue);
    }
  }

  return { regressions, newIssues, knownOpenIssues };
}

// ── Stability check ───────────────────────────────────────────────────────────

function isUnstable(issueId, store) {
  const issue = store.issues[issueId];
  return issue ? (issue.regressionCount || 0) >= REGRESSION_THRESHOLD : false;
}

// ── Report builder ────────────────────────────────────────────────────────────

function generateRegressionReport(detectionResult, store) {
  const { regressions, newIssues, knownOpenIssues } = detectionResult;

  const unstableIssues = regressions.filter(r => isUnstable(r.id, store));

  const blockDeployment =
    regressions.some(r => ['critical', 'high'].includes(r.severity)) ||
    unstableIssues.length > 0;

  const report = {
    hasRegressions:   regressions.length > 0,
    regressionCount:  regressions.length,
    newIssueCount:    newIssues.length,
    knownIssueCount:  knownOpenIssues.length,
    unstableCount:    unstableIssues.length,
    regressions,
    newIssues,
    knownOpenIssues,
    unstableIssues,
    blockDeployment,
    summary:          buildSummary(regressions, newIssues, unstableIssues),
  };

  if (regressions.length > 0) {
    logger.warn(`[RegressionDetector] ${regressions.length} regression(s): ${regressions.map(r => r.id).join(', ')}`);
  }
  if (unstableIssues.length > 0) {
    logger.fail(`[RegressionDetector] ${unstableIssues.length} unstable issue(s) — deployment blocked`);
  }
  if (newIssues.length > 0) {
    logger.info(`[RegressionDetector] ${newIssues.length} new issue(s) detected`);
  }

  return report;
}

function buildSummary(regressions, newIssues, unstableIssues) {
  const parts = [];
  if (regressions.length > 0)   parts.push(`${regressions.length} regression(s)`);
  if (newIssues.length > 0)     parts.push(`${newIssues.length} new issue(s)`);
  if (unstableIssues.length > 0) parts.push(`${unstableIssues.length} unstable`);
  return parts.length > 0 ? parts.join(', ') : 'clean';
}

// ── Run comparison (history-based) ────────────────────────────────────────────

/**
 * Compares the latest run against the previous run stored in runHistory.
 * Useful for catching issues introduced in the last push specifically.
 */
function compareWithPreviousRun(store, currentIssueIds) {
  const runs = store.runHistory || [];
  if (runs.length < 2) return null;

  const previous = runs[runs.length - 2];
  const prevIds  = new Set(previous.issueIds || []);
  const currIds  = new Set(currentIssueIds);

  const appeared  = [...currIds].filter(id => !prevIds.has(id));
  const resolved  = [...prevIds].filter(id => !currIds.has(id));
  const persisted = [...currIds].filter(id => prevIds.has(id));

  return { appeared, resolved, persisted, previousRunId: previous.runId };
}

module.exports = {
  detectRegressions,
  generateRegressionReport,
  isUnstable,
  upgradeSeverity,
  compareWithPreviousRun,
  REGRESSION_THRESHOLD,
};
