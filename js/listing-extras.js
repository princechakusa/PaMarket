// Share button + recently-viewed strip for listing pages. Shared by the
// dynamic detail.html renderer AND the pre-rendered /l/ pages (which is
// where visitors actually land for existing listings), so the behavior
// lives in exactly one place.
//
// PMListingExtras.init(meta) — meta: { id, title, price, currency, photo,
// city, province, url }. Expects optional #shareBtn, #recentSec/#recentGrid
// elements; missing elements are skipped, never thrown on.
(function (global) {
  var COLORS = ['#EEF2FF', '#FEF3C7', '#DCFCE7', '#FCE7F3', '#E0F2FE', '#FEF9C3', '#F3E8FF', '#FFEDD5'];
  var TCOLORS = ['#1A3A8F', '#B27D22', '#16A34A', '#9D174D', '#0369A1', '#92400E', '#7B2D8B', '#C2410C'];
  var PIN = '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function money(n, currency) {
    if (global.PM && global.PM.money) return global.PM.money(n, currency);
    return '$' + Number(n || 0).toLocaleString();
  }

  function card(r, i) {
    var bg = COLORS[i % COLORS.length], tc = TCOLORS[i % TCOLORS.length];
    var loc = [r.city, r.province].filter(Boolean).join(', ') || 'Zimbabwe';
    var img = r.photo
      ? '<img src="' + escHtml(r.photo) + '" alt="' + escHtml(r.title) + '" loading="lazy">'
      : '<div class="gcard-img-ph" style="color:' + tc + '">' + escHtml(String(r.title || '').split(' ').slice(0, 3).join(' ')) + '</div>';
    return '<a class="gcard" href="' + escHtml(global.PMSchema.listingPath(r)) + '">' +
      '<div class="gcard-img" style="background:' + bg + '">' + img + '</div>' +
      '<div class="gcard-body">' +
      '<div class="gcard-price">' + money(r.price, r.currency) + '</div>' +
      '<div class="gcard-title">' + escHtml(r.title) + '</div>' +
      '<div class="gcard-loc">' + PIN + ' ' + escHtml(loc) + '</div>' +
      '</div></a>';
  }

  function initShare(meta) {
    var btn = document.getElementById('shareBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var data = { title: meta.title, text: meta.title + ' — ' + money(meta.price, meta.currency) + ' on PaMarket', url: meta.url };
      if (navigator.share) {
        navigator.share(data).catch(function () { /* user cancelled */ });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(meta.url).then(function () {
          var orig = btn.innerHTML;
          btn.textContent = 'Link copied!';
          setTimeout(function () { btn.innerHTML = orig; }, 1600);
        }).catch(function () {});
      }
    });
  }

  function initRecent(meta) {
    var sec = document.getElementById('recentSec');
    var grid = document.getElementById('recentGrid');
    try {
      var recent = JSON.parse(localStorage.getItem('pm_recent') || '[]');
      var others = recent.filter(function (r) { return r && r.id && r.id !== meta.id; }).slice(0, 4);
      if (others.length && sec && grid) {
        grid.innerHTML = others.map(card).join('');
        sec.classList.remove('hidden');
        sec.style.display = '';
      }
      recent = [{ id: meta.id, title: meta.title, price: meta.price, currency: meta.currency, photo: meta.photo || null, city: meta.city, province: meta.province }]
        .concat(recent.filter(function (r) { return r && r.id && r.id !== meta.id; }))
        .slice(0, 8);
      localStorage.setItem('pm_recent', JSON.stringify(recent));
    } catch (e) { /* private mode / disabled storage */ }
  }

  global.PMListingExtras = {
    init: function (meta) {
      if (!meta || !meta.id) return;
      initShare(meta);
      initRecent(meta);
    }
  };
})(window);
