// Admin → General Settings → Free for everyone mode: say so above the plans
// on plans.html (the app and server already give every business the top
// tier's limits). Loaded with `defer` after js/site-content.js, so
// PMContent exists by the time this runs.
(function () {
  if (!window.PMContent || !window.PMContent.fetchOpsSettings) return;
  window.PMContent.fetchOpsSettings().then(function (ops) {
    if (ops.freeOnly !== true) return;
    var grid = document.querySelector('.plans-grid');
    if (!grid) return;
    var note = document.createElement('div');
    note.setAttribute('role', 'status');
    note.style.cssText = 'margin-top:28px;padding:16px 20px;border-radius:14px;background:#ECFDF5;border:1.5px solid #10B981;color:#065F46;font-weight:700;line-height:1.5';
    note.textContent = 'Good news: every plan feature is free right now. Unlimited listings, staff and featured slots for every shop, with no payment needed.';
    grid.parentNode.insertBefore(note, grid);
  });
})();
