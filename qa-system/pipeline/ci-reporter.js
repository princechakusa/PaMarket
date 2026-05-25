'use strict';
/**
 * CI Reporter — generates GitHub-flavored markdown for pipeline outputs.
 *
 * Writes to:
 *   GITHUB_STEP_SUMMARY  → appears in the Actions run summary page
 *   GITHUB_OUTPUT        → step outputs consumed by downstream jobs / if conditions
 *
 * In local development (no env vars set), prints to stdout instead.
 */

const fs   = require('fs');
const path = require('path');

// ── GitHub environment writers ────────────────────────────────────────────────

function writeGithubOutput(key, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    fs.appendFileSync(file, `${key}=${String(value)}\n`);
  }
}

function writeGithubStepSummary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) {
    fs.appendFileSync(file, markdown + '\n');
  } else {
    // Local dev preview
    const divider = '─'.repeat(72);
    console.log(`\n${divider}`);
    console.log('CI Report (GITHUB_STEP_SUMMARY preview)');
    console.log(divider);
    console.log(markdown);
    console.log(divider + '\n');
  }
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function statusBadgeUrl(status) {
  const colors = { passing: 'brightgreen', warning: 'yellow', failing: 'red' };
  const color  = colors[status] || 'lightgrey';
  return `https://img.shields.io/badge/QA-${status}-${color}`;
}

// ── Markdown report ───────────────────────────────────────────────────────────

function buildMarkdownReport(pipeline) {
  const {
    runId,
    config,
    report,
    regressionReport,
    approvalResult,
    executionResult,
    retestResult,
    elapsed,
  } = pipeline;

  const byS         = report?.meta?.bySeverity || {};
  const hasCritical = (byS.critical || 0) > 0;
  const hasHigh     = (byS.high     || 0) > 0;
  const hasRegs     = regressionReport?.hasRegressions || false;

  const status =
    hasCritical || hasRegs ? 'failing' :
    hasHigh                ? 'warning' :
    'passing';

  const badge     = `![QA](${statusBadgeUrl(status)})`;
  const timestamp = new Date().toISOString();

  const lines = [
    `# PaMarket QA Pipeline`,
    ``,
    `${badge}`,
    ``,
    `| Field     | Value |`,
    `|-----------|-------|`,
    `| Run ID    | \`${runId || 'n/a'}\` |`,
    `| Timestamp | ${timestamp} |`,
    `| Mode      | ${config?.READ_ONLY ? 'Read-Only' : 'Full'} |`,
    `| Supabase  | ${config?.SUPABASE_URL || 'unknown'} |`,
    `| Duration  | ${elapsed ? elapsed + 's' : 'n/a'} |`,
    ``,
    `## Issue Summary`,
    ``,
    `| Severity    | Count |`,
    `|-------------|-------|`,
    `| 🔴 Critical | ${byS.critical || 0} |`,
    `| 🟠 High     | ${byS.high     || 0} |`,
    `| 🟡 Medium   | ${byS.medium   || 0} |`,
    `| 🔵 Low      | ${byS.low      || 0} |`,
    ``,
  ];

  // Regressions section
  if (hasRegs) {
    lines.push(`## ⚠️ Regressions Detected`);
    lines.push(``);
    for (const r of (regressionReport.regressions || [])) {
      lines.push(
        `- **${r.id}** (${r.severity}): ${r.title || r.id}` +
        ` — regression #${r.regressionCount}` +
        (r.lastFixedAt ? `, last fixed ${r.lastFixedAt.slice(0, 10)}` : '')
      );
    }
    if ((regressionReport.unstableIssues || []).length > 0) {
      lines.push(``);
      lines.push(`### Unstable Issues (deployment blocked)`);
      for (const u of regressionReport.unstableIssues) {
        lines.push(`- **${u.id}**: regressed ${u.regressionCount}x`);
      }
    }
    lines.push(``);
  }

  // Fix execution section
  if (executionResult) {
    const total =
      (executionResult.executed?.length || 0) +
      (executionResult.skipped?.length  || 0) +
      (executionResult.failed?.length   || 0);

    lines.push(`## Fix Execution (Staging Only)`);
    lines.push(``);

    if (total === 0) {
      lines.push(`_No fixes were applied this run._`);
    } else {
      lines.push(`| Fix ID | Status | Target |`);
      lines.push(`|--------|--------|--------|`);
      for (const e of (executionResult.executed || [])) {
        lines.push(`| ${e.fixId} | ✅ Deployed | staging |`);
      }
      for (const s of (executionResult.skipped || [])) {
        lines.push(`| ${s.fixId} | ⏭️ Skipped (${s.reason}) | — |`);
      }
      for (const f of (executionResult.failed || [])) {
        lines.push(`| ${f.fixId} | ❌ Failed | staging |`);
      }
    }
    lines.push(``);
  }

  // Retest verdict section
  if (retestResult && !retestResult.skipped) {
    const c       = retestResult.comparison || {};
    const verdict = retestResult.verdict || 'UNKNOWN';
    const emoji   =
      verdict === 'FIX_SUCCESSFUL' ? '✅' :
      verdict === 'PARTIAL_FIX'    ? '⚠️' :
      '❌';

    lines.push(`## Retest Verdict: ${emoji} ${verdict}`);
    lines.push(``);
    lines.push(`| Metric       | Count |`);
    lines.push(`|--------------|-------|`);
    lines.push(`| Issues fixed | ${(c.fixed      || []).length} |`);
    lines.push(`| Persisting   | ${(c.persisting || []).length} |`);
    lines.push(`| New issues   | ${(c.newIssues  || []).length} |`);
    lines.push(``);
  }

  // Approved fixes (not yet deployed, for reference)
  const approvedFixes = (approvalResult?.decisions || []).filter(d => d.decision === 'APPROVED');
  if (approvedFixes.length > 0) {
    lines.push(`## Approved Fixes (apply to staging)`);
    lines.push(``);
    for (const d of approvedFixes) {
      lines.push(`- **${d.fixId}**: ${d.fixDescription || d.fixId}`);
    }
    lines.push(``);
  }

  // Deployment gate
  const execFailed    = (executionResult?.failed?.length || 0) > 0;
  const blockDeploy   = hasCritical || hasRegs || execFailed;

  lines.push(`## Deployment Gate`);
  lines.push(``);
  lines.push(
    blockDeploy
      ? `> ❌ **BLOCKED** — Critical issues, regressions, or failed staging deployments must be resolved before merging to production.`
      : `> ✅ **PASS** — No blocking issues found. Proceed with staging validation before production deployment.`
  );
  lines.push(``);

  return lines.join('\n');
}

// ── GitHub Actions outputs ────────────────────────────────────────────────────

function emitCiOutputs(pipeline) {
  const { runId, report, regressionReport } = pipeline;

  const byS          = report?.meta?.bySeverity || {};
  const hasCritical  = (byS.critical || 0) > 0;
  const issueCount   = Object.values(byS).reduce((a, b) => a + (b || 0), 0);
  const hasRegs      = regressionReport?.hasRegressions || false;

  const qaStatus =
    hasCritical || hasRegs          ? 'failing' :
    (byS.high   || 0) > 0          ? 'warning'  :
    'passing';

  writeGithubOutput('has_critical',    String(hasCritical));
  writeGithubOutput('issue_count',     String(issueCount));
  writeGithubOutput('qa_status',       qaStatus);
  writeGithubOutput('has_regressions', String(hasRegs));
  writeGithubOutput('run_id',          runId || 'unknown');
}

// ── Full CI report emission ───────────────────────────────────────────────────

function emit(pipeline) {
  const markdown = buildMarkdownReport(pipeline);
  writeGithubStepSummary(markdown);
  emitCiOutputs(pipeline);
  return markdown;
}

module.exports = {
  emit,
  buildMarkdownReport,
  writeGithubStepSummary,
  emitCiOutputs,
  writeGithubOutput,
};
