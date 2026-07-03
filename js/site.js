/* PaMarket — shared site JS */
'use strict';

// ── Mobile nav toggle ──────────────────────────────────────────
function toggleMob() {
  var n = document.getElementById('mobNav');
  if (n) n.classList.toggle('open');
}
document.addEventListener('click', function(e) {
  var h = document.getElementById('site-header');
  var n = document.getElementById('mobNav');
  if (n && n.classList.contains('open') && h && !h.contains(e.target)) {
    n.classList.remove('open');
  }
});

// ── Breadcrumb auto-inject ────────────────────────────────────
(function() {
  var header = document.getElementById('site-header');
  if (!header) return;
  // Don't add breadcrumb on homepage
  if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) return;

  var label = document.body.getAttribute('data-page') || document.title.replace(/\s*[-–|].*$/, '').trim();
  var bar = document.createElement('div');
  bar.className = 'breadcrumb-bar';
  bar.innerHTML =
    '<div class="bc-wrap">' +
      '<button class="bc-back" onclick="history.length>1?history.back():window.location=\'index.html\'">' +
        '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="m12 5-7 7 7 7"/></svg>' +
        'Back' +
      '</button>' +
      '<div class="bc-div"></div>' +
      '<div class="bc-crumb">' +
        '<a href="index.html">Home</a>' +
        '<span class="bc-sep">›</span>' +
        '<span class="bc-cur">' + label + '</span>' +
      '</div>' +
    '</div>';
  header.insertAdjacentElement('afterend', bar);
})();

// ── Scroll reveal ─────────────────────────────────────────────
var revObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); }
  });
}, { threshold: 0.07 });
document.querySelectorAll('.reveal').forEach(function(el) { revObs.observe(el); });

// ── Back-to-top ───────────────────────────────────────────────
(function() {
  var btn = document.createElement('button');
  btn.id = 'btt';
  btn.title = 'Back to top';
  btn.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
  btn.onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); };
  document.body.appendChild(btn);
  window.addEventListener('scroll', function() {
    btn.classList.toggle('show', window.scrollY > 400);
  }, { passive: true });
})();

// ── Toast (shared) ────────────────────────────────────────────
window.siteToast = function(msg, type) {
  var c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  var t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(function() { requestAnimationFrame(function() { t.classList.add('show'); }); });
  setTimeout(function() { t.classList.remove('show'); setTimeout(function() { t.remove(); }, 300); }, 3000);
};
