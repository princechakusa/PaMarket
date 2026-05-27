'use strict';
/**
 * Persistent issue store for the QA pipeline.
 *
 * Issues survive across runs so the pipeline can detect regressions
 * (a previously-fixed issue reappearing in a later run).
 *
 * Store layout  →  reports/issue-store.json
 * {
 *   issues:     { [issueId]: IssueRecord },
 *   lastRunId:  string,
 *   runHistory: RunSummary[]          (capped at 50)
 * }
 */

const fs   = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'reports', 'issue-store.json');

// ── Persistence ───────────────────────────────────────────────────────────────

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    }
  } catch {}
  return { issues: {}, lastRunId: null, runHistory: [] };
}

function saveStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

// ── Run IDs ───────────────────────────────────────────────────────────────────

function generateRunId() {
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run_${ts}_${rand}`;
}

// ── Issue lifecycle ───────────────────────────────────────────────────────────

/**
 * Insert or update an issue in the store.
 * If the issue was previously fixed and reappears, marks it as 'regression'.
 * Returns the stored IssueRecord.
 */
function upsertIssue(store, issue) {
  const now      = new Date().toISOString();
  const existing = store.issues[issue.id];

  if (!existing) {
    store.issues[issue.id] = {
      id:               issue.id,
      title:            issue.title || issue.description || issue.id,
      firstDetectedAt:  now,
      lastDetectedAt:   now,
      status:           'open',
      severity:         issue.severity || 'medium',
      rootCause:        issue.rootCause || issue.detail || '',
      layer:            issue.layer || 'unknown',
      fixHistory:       [],
      testResultsBefore: [],
      testResultsAfter:  [],
      deploymentTarget:  'staging',
      regressionCount:   0,
    };
  } else {
    existing.lastDetectedAt = now;
    existing.severity = issue.severity || existing.severity;

    if (existing.status === 'fixed') {
      existing.status          = 'regression';
      existing.regressionCount = (existing.regressionCount || 0) + 1;
    } else if (existing.status !== 'regression') {
      existing.status = 'open';
    }
  }

  return store.issues[issue.id];
}

/**
 * Record a successful fix deployment to staging.
 */
function markFixed(store, issueId, fixId) {
  const issue = store.issues[issueId];
  if (!issue) return null;
  issue.status = 'fixed';
  issue.fixHistory.push({
    fixId,
    fixedAt:    new Date().toISOString(),
    deployedTo: 'staging',
  });
  return issue;
}

/**
 * Attach before/after test results to an issue record.
 */
function attachTestResults(store, issueId, phase, results) {
  const issue = store.issues[issueId];
  if (!issue) return;
  if (phase === 'before') issue.testResultsBefore.push(...results);
  if (phase === 'after')  issue.testResultsAfter.push(...results);
}

// ── Run history ───────────────────────────────────────────────────────────────

function addRunHistory(store, runId, summary) {
  store.lastRunId    = runId;
  store.runHistory   = store.runHistory || [];
  store.runHistory.push({ runId, timestamp: new Date().toISOString(), ...summary });
  if (store.runHistory.length > 50) {
    store.runHistory = store.runHistory.slice(-50);
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

function getOpenIssues(store) {
  return Object.values(store.issues).filter(i =>
    i.status === 'open' || i.status === 'regression' || i.status === 'investigating'
  );
}

function getRegressions(store) {
  return Object.values(store.issues).filter(i => i.status === 'regression');
}

function getIssueById(store, id) {
  return store.issues[id] || null;
}

/**
 * Return a flat array of all current issues from an agent results map.
 * Used to feed the store at the start of each run.
 */
function extractIssuesFromResults(results) {
  return Object.values(results).flatMap(r => r?.issues || []);
}

module.exports = {
  loadStore,
  saveStore,
  generateRunId,
  upsertIssue,
  markFixed,
  attachTestResults,
  addRunHistory,
  getOpenIssues,
  getRegressions,
  getIssueById,
  extractIssuesFromResults,
};
