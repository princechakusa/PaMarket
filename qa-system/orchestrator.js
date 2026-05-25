'use strict';
/**
 * PaMarket QA System — Autonomous CI/CD Pipeline Orchestrator  (v2)
 *
 * 10-phase pipeline:
 *
 *   Phase  1 — Initialize       Load issue store, generate run ID, print header
 *   Phase  2 — QA Execution     Feature Testing + API Validation (parallel)
 *   Phase  3 — Data Flow Trace  Trace UI → H.state → Supabase → render paths
 *   Phase  4 — Bug Diagnosis    Root-cause classification of all findings
 *   Phase  5 — Security+Perf    RLS Audit + Performance & State (parallel)
 *   Phase  6 — Fix Generation   Auto-Fix Generator → Approval Gate
 *   Phase  7 — Staging Deploy   Apply approved SQL fixes to staging (if configured)
 *   Phase  8 — Auto-Retest      Targeted + full regression suite after staging deploy
 *   Phase  9 — Regression Scan  Compare current run vs historical store
 *   Phase 10 — CI Report        GitHub Step Summary, GITHUB_OUTPUT vars, final exit code
 *
 * Usage:
 *   node orchestrator.js
 *   QA_DEBUG=1 node orchestrator.js        (verbose)
 *   AGENT=api node orchestrator.js         (single agent)
 *   QA_SKIP_DEPLOY=1 node orchestrator.js  (skip staging deploy even if configured)
 */

const logger      = require('./utils/logger');
const reporter    = require('./utils/report-builder');
const tracker     = require('./pipeline/issue-tracker');
const fixExecutor = require('./pipeline/fix-executor');
const retester    = require('./pipeline/retest-engine');
const regDetector = require('./pipeline/regression-detector');
const ciReporter  = require('./pipeline/ci-reporter');

// ── Config loading ────────────────────────────────────────────────────────────

let config;
try {
  config = require('./config');
  logger.info('Using config.js (custom configuration)');
} catch {
  config = require('./config.example');
  logger.warn('config.js not found — using config.example.js (READ-ONLY, no test credentials)');
  logger.warn('Copy config.example.js to config.js and fill in credentials to enable full testing.');
}

// ── Agent imports ─────────────────────────────────────────────────────────────

const agents = {
  featureTesting: require('./agents/1-feature-testing'),
  apiValidation:  require('./agents/2-api-validation'),
  dataFlowTrace:  require('./agents/3-data-flow-trace'),
  bugDiagnosis:   require('./agents/4-bug-diagnosis'),
  securityAudit:  require('./agents/5-security-rls-audit'),
  performance:    require('./agents/6-performance-state'),
  autoFix:        require('./agents/7-auto-fix-generator'),
  approvalGate:   require('./agents/8-approval-gate'),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function runWithTimeout(name, fn, ms = 120000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Agent ${name} timed out after ${ms}ms`)), ms)
    ),
  ]).catch(err => {
    logger.fail(`Agent ${name} failed: ${err.message}`);
    return {
      agent:     name,
      status:    'error',
      error:     err.message,
      issues:    [],
      tests:     [],
      fixes:     [],
      decisions: [],
    };
  });
}

function phaseHeader(n, title) {
  logger.info(`\n╔══ PHASE ${n}: ${title} ${'═'.repeat(Math.max(0, 52 - title.length))}╗`);
}

// ── Single-agent mode ─────────────────────────────────────────────────────────

async function runSingleAgent(agentKey) {
  const agentKeys = Object.keys(agents);
  const key = agentKeys.find(k =>
    k.toLowerCase().includes(agentKey.toLowerCase()) || k === agentKey
  );
  if (!key) {
    console.error(`Unknown agent: ${agentKey}. Available: ${agentKeys.join(', ')}`);
    process.exit(1);
  }
  logger.info(`Running single agent: ${key}`);
  const result = await agents[key].run(config);
  console.log('\nResult:', JSON.stringify(result, null, 2));
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log('\n' + '═'.repeat(64));
  console.log('  PaMarket QA — Autonomous CI/CD Pipeline  (v2)');
  console.log('  Supabase: ' + config.SUPABASE_URL);
  console.log('  App URL:  ' + config.APP_URL);
  console.log('  Staging:  ' + (config.SUPABASE_STAGING_DB_URL ? 'configured' : 'not configured (deploy skipped)'));
  console.log('  Mode:     ' + (config.READ_ONLY ? 'READ-ONLY (safe)' : 'FULL (writes enabled)'));
  console.log('═'.repeat(64) + '\n');

  // Single-agent shortcut
  if (process.env.AGENT) {
    await runSingleAgent(process.env.AGENT);
    return;
  }

  // ── PHASE 1: Initialize ─────────────────────────────────────────────────────
  phaseHeader(1, 'Initialize');
  const runId = tracker.generateRunId();
  const store = tracker.loadStore();
  logger.info(`Run ID: ${runId}`);
  logger.info(`Known issues in store: ${Object.keys(store.issues).length}`);

  const results = {};

  // ── PHASE 2: QA Execution (parallel) ───────────────────────────────────────
  phaseHeader(2, 'QA Execution — Feature Testing + API Validation');
  const [featureResult, apiResult] = await Promise.all([
    runWithTimeout('FeatureTesting', () => agents.featureTesting.run(config), 120000),
    runWithTimeout('APIValidation',  () => agents.apiValidation.run(config),   60000),
  ]);
  results.featureTesting = featureResult;
  results.apiValidation  = apiResult;

  // ── PHASE 3: Data Flow Trace ────────────────────────────────────────────────
  phaseHeader(3, 'Data Flow Trace');
  const traceResult = await runWithTimeout('DataFlowTrace', () => agents.dataFlowTrace.run(config), 60000);
  results.dataFlowTrace = traceResult;

  // ── PHASE 4: Bug Diagnosis ──────────────────────────────────────────────────
  phaseHeader(4, 'Bug Diagnosis (Root Cause Engine)');
  const diagnosisResult = await runWithTimeout('BugDiagnosis', () =>
    agents.bugDiagnosis.run(config, {
      apiValidation:  apiResult,
      dataFlowTrace:  traceResult,
      featureTesting: featureResult,
    }), 30000
  );
  results.bugDiagnosis = diagnosisResult;

  // ── PHASE 5: Security + Performance (parallel) ─────────────────────────────
  phaseHeader(5, 'Security & RLS Audit + Performance');
  const [securityResult, performanceResult] = await Promise.all([
    runWithTimeout('SecurityAudit', () => agents.securityAudit.run(config), 60000),
    runWithTimeout('Performance',   () => agents.performance.run(config),   60000),
  ]);
  results.securityAudit = securityResult;
  results.performance   = performanceResult;

  // Merge + deduplicate all issues
  const allIssues = [
    ...(diagnosisResult.issues   || []),
    ...(securityResult.issues    || []),
    ...(performanceResult.issues || []),
  ];
  const seenIds = new Set();
  const dedupedIssues = allIssues.filter(i => {
    if (seenIds.has(i.id)) return false;
    seenIds.add(i.id);
    return true;
  });
  const mergedDiagnosis = { ...diagnosisResult, issues: dedupedIssues };

  // Feed issues into the persistent store (before fix execution)
  const currentIssues = tracker.extractIssuesFromResults({
    ...results,
    diagnosis: mergedDiagnosis,
  });
  for (const issue of currentIssues) {
    tracker.upsertIssue(store, issue);
  }

  // Snapshot pre-fix results for retest comparison
  const preFixResults = {
    apiValidation:  apiResult,
    dataFlowTrace:  traceResult,
    securityAudit:  securityResult,
    performance:    performanceResult,
    featureTesting: featureResult,
  };

  // ── PHASE 6: Fix Generation + Approval Gate ─────────────────────────────────
  phaseHeader(6, 'Fix Generation + Approval Gate');
  const fixResult = await runWithTimeout('AutoFix', () =>
    agents.autoFix.run(config, mergedDiagnosis), 30000
  );
  results.autoFix = fixResult;

  const approvalResult = await runWithTimeout('ApprovalGate', () =>
    agents.approvalGate.run(config, fixResult), 30000
  );
  results.approval = approvalResult;

  // ── PHASE 7: Staging Fix Execution ─────────────────────────────────────────
  phaseHeader(7, 'Staging Fix Execution');
  let executionResult = null;

  const skipDeploy = process.env.QA_SKIP_DEPLOY === '1';

  if (skipDeploy) {
    logger.warn('QA_SKIP_DEPLOY=1 — skipping staging deployment');
    executionResult = { executed: [], skipped: [], failed: [], skippedReason: 'QA_SKIP_DEPLOY set' };
  } else {
    executionResult = await fixExecutor.applyApprovedFixes(
      { ...approvalResult, fixes: fixResult.fixes || [] },
      config
    );
  }

  // Update the store with fix results
  for (const exec of (executionResult.executed || [])) {
    // Mark issues addressed by this fix as 'fixed'
    for (const issue of currentIssues) {
      const fix = (fixResult.fixes || []).find(f => f.id === exec.fixId);
      if (fix && (fix.addresses || []).includes(issue.id)) {
        tracker.markFixed(store, issue.id, exec.fixId);
      }
    }
  }

  // ── PHASE 8: Auto-Retest ────────────────────────────────────────────────────
  phaseHeader(8, 'Auto-Retest');
  const retestResult = await retester.run(
    executionResult.executed || [],
    preFixResults,
    agents,
    config
  );

  // ── PHASE 9: Regression Detection ──────────────────────────────────────────
  phaseHeader(9, 'Regression Detection');
  const freshIssues = retestResult.afterResults
    ? tracker.extractIssuesFromResults(retestResult.afterResults)
    : currentIssues;

  const detectionResult    = regDetector.detectRegressions(freshIssues, store);
  const regressionReport   = regDetector.generateRegressionReport(detectionResult, store);

  // Escalate regressions in store
  for (const reg of detectionResult.regressions) {
    tracker.upsertIssue(store, reg);
  }

  // ── PHASE 10: CI Report + Final Status ─────────────────────────────────────
  phaseHeader(10, 'CI Report + Final Status');

  const allResultsForReport = {
    featureTesting: featureResult,
    apiValidation:  apiResult,
    dataFlowTrace:  traceResult,
    bugDiagnosis:   mergedDiagnosis,
    securityAudit:  securityResult,
    performance:    performanceResult,
    autoFix:        fixResult,
    approval:       approvalResult,
  };

  const report = reporter.buildReport(allResultsForReport, config);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const pipeline = {
    runId,
    config,
    report,
    regressionReport,
    approvalResult,
    executionResult,
    retestResult,
    elapsed,
  };

  // Emit CI outputs (GitHub Step Summary + GITHUB_OUTPUT vars)
  ciReporter.emit(pipeline);

  // Save JSON + HTML reports
  let reportPaths = { jsonPath: null, htmlPath: null };
  try {
    reportPaths = reporter.saveReport(report, config);
    logger.pass(`Report saved: ${reportPaths.jsonPath}`);
    if (reportPaths.htmlPath) logger.pass(`HTML report:  ${reportPaths.htmlPath}`);
  } catch (e) {
    logger.warn(`Could not save report: ${e.message}`);
  }

  // Persist updated store
  tracker.addRunHistory(store, runId, {
    issueCount:     freshIssues.length,
    issueIds:       freshIssues.map(i => i.id),
    regressions:    regressionReport.regressionCount,
    fixesDeployed:  (executionResult.executed || []).length,
    qaStatus:       regressionReport.hasRegressions || (report?.meta?.bySeverity?.critical > 0)
                    ? 'failing' : 'passing',
  });
  tracker.saveStore(store);

  // ── Final console summary ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  console.log('  PaMarket QA — FINAL SUMMARY');
  console.log('═'.repeat(64));

  const allTestResults = Object.values(results).flatMap(r => r?.tests || []);
  logger.summary(allTestResults);

  const byS = report.meta.bySeverity;
  console.log('  ISSUES:');
  if (byS.critical) console.log(`    🔴 Critical: ${byS.critical}`);
  if (byS.high)     console.log(`    🟠 High:     ${byS.high}`);
  if (byS.medium)   console.log(`    🟡 Medium:   ${byS.medium}`);
  if (byS.low)      console.log(`    🔵 Low:      ${byS.low}`);

  if (regressionReport.hasRegressions) {
    console.log(`\n  ⚠️  REGRESSIONS: ${regressionReport.regressionCount}`);
  }

  const fx = approvalResult.summary || {};
  console.log('\n  FIXES:');
  console.log(`    ✅ Approved:       ${fx.approved       || 0}`);
  console.log(`    🔄 Needs Revision: ${fx.needsRevision  || 0}`);
  console.log(`    ❌ Rejected:       ${fx.rejected       || 0}`);

  if (executionResult.executed?.length > 0) {
    console.log(`\n  STAGING DEPLOY: ${executionResult.executed.length} fix(es) applied`);
  }
  if (retestResult?.verdict) {
    console.log(`  RETEST VERDICT: ${retestResult.verdict}`);
  }

  console.log(`\n  Total time: ${elapsed}s`);
  if (reportPaths.jsonPath) console.log(`  Report:     ${reportPaths.jsonPath}`);
  if (reportPaths.htmlPath) console.log(`  HTML:       ${reportPaths.htmlPath}`);
  console.log('═'.repeat(64) + '\n');

  // Exit code: 1 if critical issues or regressions (blocks CI deployment)
  const hasCritical     = (byS.critical || 0) > 0;
  const hasRegressions  = regressionReport.hasRegressions;
  const stagingFailed   = (executionResult.failed || []).length > 0;

  if (hasCritical || hasRegressions || stagingFailed) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\nOrchestrator failed with uncaught error:', err);
  process.exit(2);
});
