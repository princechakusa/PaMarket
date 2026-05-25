'use strict';
/**
 * PaMarket QA System — Orchestrator
 *
 * Executes the 8-agent QA pipeline in the correct dependency order:
 *
 *   Phase 1 (parallel): Feature Testing  +  API Validation
 *   Phase 2:            Data Flow Trace  (depends on Phase 1 results)
 *   Phase 3:            Bug Diagnosis    (depends on all prior results)
 *   Phase 4 (parallel): Security Audit  +  Performance & State
 *   Phase 5:            Auto-Fix Generation (depends on Phase 3)
 *   Phase 6:            Approval Gate   (depends on Phase 5)
 *   Phase 7:            Final Report    (assembles everything)
 *
 * Usage:
 *   node orchestrator.js
 *   QA_DEBUG=1 node orchestrator.js   (verbose output)
 *   AGENT=api node orchestrator.js    (run single agent)
 */

const path     = require('path');
const logger   = require('./utils/logger');
const reporter = require('./utils/report-builder');

// Load config — falls back to example config if config.js does not exist
let config;
try {
  config = require('./config');
  logger.info('Using config.js (custom configuration)');
} catch {
  config = require('./config.example');
  logger.warn('config.js not found — using config.example.js (READ-ONLY mode, no test credentials)');
  logger.warn('Copy config.example.js to config.js and fill in TEST_USER/TEST_ADMIN to enable full testing.');
}

// Import all agents
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

async function runWithTimeout(name, fn, ms = 120000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Agent ${name} timed out after ${ms}ms`)), ms)
    ),
  ]).catch(err => {
    logger.fail(`Agent ${name} failed: ${err.message}`);
    return { agent: name, status: 'error', error: err.message, issues: [], tests: [], fixes: [], decisions: [] };
  });
}

async function main() {
  const startTime = Date.now();

  console.log('\n' + '═'.repeat(64));
  console.log('  PaMarket QA System — Production-Grade Multi-Agent Pipeline');
  console.log('  Supabase: ' + config.SUPABASE_URL);
  console.log('  App URL:  ' + config.APP_URL);
  console.log('  Mode:     ' + (config.READ_ONLY ? 'READ-ONLY (safe)' : 'FULL (writes enabled)'));
  console.log('═'.repeat(64) + '\n');

  const singleAgent = process.env.AGENT;

  // ── Single-agent mode ─────────────────────────────────────────────────────
  if (singleAgent) {
    const agentKey = Object.keys(agents).find(k =>
      k.toLowerCase().includes(singleAgent.toLowerCase()) ||
      singleAgent === k
    );
    if (!agentKey) {
      console.error(`Unknown agent: ${singleAgent}. Available: ${Object.keys(agents).join(', ')}`);
      process.exit(1);
    }
    logger.info(`Running single agent: ${agentKey}`);
    const result = await agents[agentKey].run(config);
    console.log('\nResult:', JSON.stringify(result, null, 2));
    return;
  }

  // ── Full pipeline ─────────────────────────────────────────────────────────

  const results = {};

  // ── PHASE 1: Feature Testing + API Validation (parallel) ─────────────────
  logger.info('\n╔══ PHASE 1: Feature Testing + API Validation (parallel) ═══╗');
  const [featureResult, apiResult] = await Promise.all([
    runWithTimeout('FeatureTesting', () => agents.featureTesting.run(config), 120000),
    runWithTimeout('APIValidation',  () => agents.apiValidation.run(config),   60000),
  ]);
  results.featureTesting = featureResult;
  results.apiValidation  = apiResult;

  // ── PHASE 2: Data Flow Trace (uses Phase 1 results) ──────────────────────
  logger.info('\n╔══ PHASE 2: Data Flow Trace ════════════════════════════════╗');
  const traceResult = await runWithTimeout('DataFlowTrace', () => agents.dataFlowTrace.run(config), 60000);
  results.dataFlowTrace = traceResult;

  // ── PHASE 3: Bug Diagnosis (aggregates all prior results) ─────────────────
  logger.info('\n╔══ PHASE 3: Bug Diagnosis (Root Cause Engine) ══════════════╗');
  const diagnosisResult = await runWithTimeout('BugDiagnosis', () =>
    agents.bugDiagnosis.run(config, {
      apiValidation:  apiResult,
      dataFlowTrace:  traceResult,
      featureTesting: featureResult,
    }), 30000
  );
  results.bugDiagnosis = diagnosisResult;

  // ── PHASE 4: Security Audit + Performance (parallel) ─────────────────────
  logger.info('\n╔══ PHASE 4: Security & RLS Audit + Performance (parallel) ══╗');
  const [securityResult, performanceResult] = await Promise.all([
    runWithTimeout('SecurityAudit', () => agents.securityAudit.run(config),  60000),
    runWithTimeout('Performance',   () => agents.performance.run(config),    60000),
  ]);
  results.securityAudit = securityResult;
  results.performance   = performanceResult;

  // Merge security and performance issues into diagnosis
  const allIssues = [
    ...(diagnosisResult.issues    || []),
    ...(securityResult.issues     || []),
    ...(performanceResult.issues  || []),
  ];
  // Deduplicate
  const seenIds   = new Set();
  const dedupedIssues = allIssues.filter(i => {
    if (seenIds.has(i.id)) return false;
    seenIds.add(i.id);
    return true;
  });
  const mergedDiagnosis = { ...diagnosisResult, issues: dedupedIssues };

  // ── PHASE 5: Auto-Fix Generation ──────────────────────────────────────────
  logger.info('\n╔══ PHASE 5: Auto-Fix Generation ════════════════════════════╗');
  const fixResult = await runWithTimeout('AutoFix', () =>
    agents.autoFix.run(config, mergedDiagnosis), 30000
  );
  results.autoFix = fixResult;

  // ── PHASE 6: Approval Gate ────────────────────────────────────────────────
  logger.info('\n╔══ PHASE 6: Approval Gate (MANDATORY) ══════════════════════╗');
  const approvalResult = await runWithTimeout('ApprovalGate', () =>
    agents.approvalGate.run(config, fixResult), 30000
  );
  results.approval = approvalResult;

  // ── PHASE 7: Final Report ─────────────────────────────────────────────────
  logger.info('\n╔══ PHASE 7: Final Report Generation ════════════════════════╗');

  // Update issues with fix + decision data for the report
  const allResultsForReport = {
    featureTesting: featureResult,
    apiValidation:  apiResult,
    dataFlowTrace:  traceResult,
    bugDiagnosis:   { ...mergedDiagnosis, issues: dedupedIssues },
    securityAudit:  securityResult,
    performance:    performanceResult,
    autoFix:        fixResult,
    approval:       approvalResult,
  };

  const report = reporter.buildReport(allResultsForReport, config);

  let reportPaths;
  try {
    reportPaths = reporter.saveReport(report, config);
    logger.pass(`Report saved: ${reportPaths.jsonPath}`);
    if (reportPaths.htmlPath) logger.pass(`HTML report:  ${reportPaths.htmlPath}`);
  } catch (e) {
    logger.warn('Could not save report to disk', e.message);
    reportPaths = { jsonPath: null, htmlPath: null };
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(64));
  console.log('  PaMarket QA System — FINAL SUMMARY');
  console.log('═'.repeat(64));

  const allTestResults = Object.values(results).flatMap(r => r?.tests || []);
  logger.summary(allTestResults);

  console.log('  ISSUES BY SEVERITY:');
  const byS = report.meta.bySeverity;
  if (byS.critical) console.log(`    🔴 Critical: ${byS.critical}`);
  if (byS.high)     console.log(`    🟠 High:     ${byS.high}`);
  if (byS.medium)   console.log(`    🟡 Medium:   ${byS.medium}`);
  if (byS.low)      console.log(`    🔵 Low:      ${byS.low}`);

  console.log('\n  FIXES:');
  const fixSummary = approvalResult.summary || {};
  console.log(`    ✅ Approved:       ${fixSummary.approved || 0}`);
  console.log(`    🔄 Needs Revision: ${fixSummary.needsRevision || 0}`);
  console.log(`    ❌ Rejected:       ${fixSummary.rejected || 0}`);

  if (approvalResult.decisions && approvalResult.decisions.filter(d => d.decision === 'APPROVED').length > 0) {
    console.log('\n  APPROVED FIXES — APPLY IN STAGING (never auto-deployed):');
    approvalResult.decisions
      .filter(d => d.decision === 'APPROVED')
      .forEach(d => console.log(`    • ${d.fixId}: ${d.fixDescription}`));
  }

  console.log(`\n  Total time: ${elapsed}s`);
  if (reportPaths.jsonPath) console.log(`  Report:     ${reportPaths.jsonPath}`);
  if (reportPaths.htmlPath) console.log(`  HTML:       ${reportPaths.htmlPath}`);
  console.log('═'.repeat(64) + '\n');

  // Exit with appropriate code
  const hasCritical = (byS.critical || 0) > 0;
  process.exit(hasCritical ? 1 : 0);
}

main().catch(err => {
  console.error('\nOrchestrator failed with uncaught error:', err);
  process.exit(2);
});
