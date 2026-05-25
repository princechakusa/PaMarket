'use strict';
/**
 * Report builder — assembles all agent outputs into the mandatory output format:
 *
 * For each issue:
 *   1.  Issue summary
 *   2.  Affected module
 *   3.  Layer of failure
 *   4.  Evidence (UI test / API response / state inspection)
 *   5.  Root cause analysis
 *   6.  Exact fix (code or SQL)
 *   7.  Approval decision
 *   8.  Post-fix validation result
 *   9.  Severity level
 */

const fs   = require('fs');
const path = require('path');

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function buildReport(agentResults, config) {
  const timestamp = new Date().toISOString();
  const issues    = collectIssues(agentResults);
  const fixes     = agentResults.autoFix    ? agentResults.autoFix.fixes       : [];
  const decisions = agentResults.approval   ? agentResults.approval.decisions   : [];

  // Attach fix + decision to each issue
  const enrichedIssues = issues.map(issue => {
    const fix      = fixes.find(f => f.issueId === issue.id) || null;
    const decision = fix ? decisions.find(d => d.fixId === fix.id) || null : null;
    return { ...issue, fix, decision };
  });

  // Sort by severity
  enrichedIssues.sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  const report = {
    meta: {
      generated:   timestamp,
      appUrl:      config.APP_URL,
      supabaseUrl: config.SUPABASE_URL,
      readOnly:    config.READ_ONLY,
      totalIssues: enrichedIssues.length,
      bySeverity:  countBySeverity(enrichedIssues),
      byModule:    countByModule(enrichedIssues),
      agentStatus: Object.keys(agentResults).reduce((acc, k) => {
        const r = agentResults[k];
        acc[k] = r ? (r.status || 'completed') : 'skipped';
        return acc;
      }, {}),
    },
    issues: enrichedIssues.map(formatIssue),
    rawAgentResults: agentResults,
  };

  return report;
}

function collectIssues(agentResults) {
  const all = [];
  Object.values(agentResults).forEach(result => {
    if (!result || !Array.isArray(result.issues)) return;
    result.issues.forEach(issue => {
      if (!all.find(x => x.id === issue.id)) all.push(issue);
    });
  });
  return all;
}

function countBySeverity(issues) {
  return issues.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {});
}

function countByModule(issues) {
  return issues.reduce((acc, i) => {
    acc[i.module] = (acc[i.module] || 0) + 1;
    return acc;
  }, {});
}

function formatIssue(issue) {
  return {
    // 1. Issue summary
    summary: issue.summary,

    // 2. Affected module
    module: issue.module,

    // 3. Layer of failure
    layer: issue.layer,

    // 4. Evidence
    evidence: {
      uiTest:         issue.evidence?.uiTest         || null,
      apiResponse:    issue.evidence?.apiResponse     || null,
      stateInspection:issue.evidence?.stateInspection || null,
    },

    // 5. Root cause analysis
    rootCause: issue.rootCause,

    // 6. Exact fix
    fix: issue.fix ? {
      type:        issue.fix.type,        // 'sql' | 'javascript'
      file:        issue.fix.file,
      fn:          issue.fix.fn || null,
      description: issue.fix.description,
      code:        issue.fix.code,
    } : null,

    // 7. Approval decision
    approvalDecision: issue.decision ? {
      status:          issue.decision.decision,   // APPROVED | REJECTED | NEEDS_REVISION
      reasoning:       issue.decision.reasoning,
      sideEffects:     issue.decision.sideEffects || [],
      integrityImpact: issue.decision.integrityImpact,
    } : null,

    // 8. Post-fix validation
    postFixValidation: issue.postFixValidation || null,

    // 9. Severity
    severity: issue.severity,

    id: issue.id,
  };
}

function saveReport(report, config) {
  const dir       = config.REPORT_DIR || './reports';
  const ts        = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName  = `pamarket-qa-${ts}`;

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const jsonPath = path.join(dir, `${baseName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  let htmlPath = null;
  if (config.REPORT_FORMAT === 'html' || config.REPORT_FORMAT === 'both') {
    htmlPath = path.join(dir, `${baseName}.html`);
    fs.writeFileSync(htmlPath, buildHtmlReport(report));
  }

  return { jsonPath, htmlPath };
}

function buildHtmlReport(report) {
  const severityColour = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6' };
  const layerLabel = {
    'frontend':        'Frontend (JS)',
    'supabase-rls':    'Supabase RLS',
    'database-schema': 'DB Schema',
    'h-state':         'H.state',
    'realtime-sync':   'Realtime Sync',
  };

  const issueHtml = report.issues.map(issue => {
    const sc  = severityColour[issue.severity] || '#6b7280';
    const dec = issue.approvalDecision;
    const decBg = dec?.status === 'APPROVED' ? '#22c55e' : dec?.status === 'REJECTED' ? '#ef4444' : '#f59e0b';

    return `
    <div class="issue">
      <div class="issue-header">
        <span class="badge sev" style="background:${sc}">${issue.severity.toUpperCase()}</span>
        <span class="badge mod">${issue.module}</span>
        <span class="badge layer">${layerLabel[issue.layer] || issue.layer}</span>
        <strong>${escHtml(issue.summary)}</strong>
      </div>
      <div class="issue-grid">
        <div><h4>Root Cause</h4><p>${escHtml(issue.rootCause || '')}</p></div>
        ${issue.evidence?.apiResponse  ? `<div><h4>API Evidence</h4><pre>${escHtml(JSON.stringify(issue.evidence.apiResponse, null, 2))}</pre></div>` : ''}
        ${issue.evidence?.uiTest       ? `<div><h4>UI Evidence</h4><p>${escHtml(issue.evidence.uiTest)}</p></div>` : ''}
        ${issue.evidence?.stateInspection ? `<div><h4>State Inspection</h4><pre>${escHtml(JSON.stringify(issue.evidence.stateInspection, null, 2))}</pre></div>` : ''}
      </div>
      ${issue.fix ? `
      <div class="fix-block">
        <div class="fix-header">🔧 Fix (${issue.fix.type?.toUpperCase()}) — ${escHtml(issue.fix.file || '')}${issue.fix.fn ? ` → ${escHtml(issue.fix.fn)}` : ''}</div>
        <pre class="code">${escHtml(issue.fix.code || '')}</pre>
      </div>` : ''}
      ${dec ? `<div class="decision" style="border-left:4px solid ${decBg}">
        <strong>${dec.status}</strong> — ${escHtml(dec.reasoning || '')}
        ${dec.sideEffects?.length ? `<ul>${dec.sideEffects.map(s => `<li>${escHtml(s)}</li>`).join('')}</ul>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PaMarket QA Report — ${report.meta.generated}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 16px 80px; }
  h1 { font-size: 28px; font-weight: 800; color: #f1f5f9; margin-bottom: 6px; }
  .meta { color: #94a3b8; font-size: 13px; margin-bottom: 32px; }
  .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }
  .stat { background: #1e293b; border-radius: 12px; padding: 16px 24px; flex: 1; min-width: 120px; }
  .stat-num { font-size: 32px; font-weight: 800; }
  .stat-lbl { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .section-title { font-size: 18px; font-weight: 700; margin: 32px 0 16px; color: #f1f5f9; }
  .issue { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #334155; }
  .issue-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .badge { border-radius: 6px; padding: 2px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .badge.sev { color: #fff; }
  .badge.mod { background: #1a3a8f; color: #fff; }
  .badge.layer { background: #334155; color: #94a3b8; }
  .issue-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px; }
  .issue-grid div h4 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 6px; }
  .issue-grid div p { font-size: 13px; color: #cbd5e1; }
  pre { background: #0f172a; border-radius: 8px; padding: 12px; font-size: 12px; overflow-x: auto; color: #94a3b8; }
  .fix-block { background: #0f172a; border-radius: 10px; padding: 16px; margin: 12px 0; border: 1px solid #1e3a5f; }
  .fix-header { font-size: 12px; color: #60a5fa; font-weight: 600; margin-bottom: 8px; }
  .decision { background: rgba(255,255,255,.04); border-radius: 8px; padding: 12px 16px; margin-top: 12px; font-size: 13px; }
  .code { color: #86efac; }
</style>
</head>
<body>
<div class="container">
  <h1>PaMarket QA Report</h1>
  <div class="meta">Generated: ${report.meta.generated} | App: ${report.meta.appUrl} | Mode: ${report.meta.readOnly ? 'Read-Only' : 'Full'}</div>
  <div class="stats">
    <div class="stat"><div class="stat-num">${report.meta.totalIssues}</div><div class="stat-lbl">Total Issues</div></div>
    ${Object.entries(report.meta.bySeverity).map(([s, n]) => `<div class="stat"><div class="stat-num" style="color:${severityColour[s]}">${n}</div><div class="stat-lbl">${s}</div></div>`).join('')}
  </div>
  <div class="section-title">Issues (sorted by severity)</div>
  ${issueHtml || '<p style="color:#64748b">No issues detected.</p>'}
</div>
</body>
</html>`;
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

module.exports = { buildReport, saveReport };
