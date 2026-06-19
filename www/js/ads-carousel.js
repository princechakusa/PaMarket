/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Sponsored ad carousel — a swipeable, auto-rotating row of full-width banner
 * ads, shown on Home (all active ads) and on category pages (ads targeting
 * that category). Driven by the existing paid_ads table.
 */
'use strict';
(function (H) {

  // Active, in-window ads, optionally filtered to a target category.
  H.activeAds = function (cat) {
    var now = Date.now();
    return (H.state.paidAds || []).filter(function (a) {
      if (!a || !a.active) return false;
      if (a.startsAt && a.startsAt > now) return false;
      if (a.endsAt && a.endsAt < now) return false;
      if (cat) return a.targetCat === cat;          // category page: only ads for this category
      return true;                                  // Home: every active ad
    }).sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
  };

  // Build the carousel HTML for a set of ads. opts: { heading, title }.
  H.adCarousel = function (ads, opts) {
    if (!ads || !ads.length) return '';
    opts = opts || {};
    var cid = 'adc_' + Math.random().toString(36).slice(2, 8);
    var esc = H.escHtml;
    var slides = ads.map(function (a) {
      if (H.trackAdImpression) { try { H.trackAdImpression(a.id); } catch (e) {} }
      // Use a data attribute and safe id (UUIDs have no special chars) so no
      // HTML-escaping of JS strings is needed in the onclick attribute.
      var safeId = String(a.id || '').replace(/['"\\<>&]/g, '');
      var bg = esc(a.bgColor || '#1A3A8F');
      var kick = esc(a.businessName || 'Sponsored');
      var head = esc(a.headline || a.businessName || '');
      var cta = esc(a.cta || a.tagline || 'Learn More');
      var img = a.imageUrl
        ? '<img class="adc-img" src="' + esc(a.imageUrl) + '" loading="lazy" onerror="this.remove()">'
        + '<div class="adc-scrim"></div>' : '';
      return '<div class="adc-slide" style="background:' + bg + '" onclick="H.trackAdClick(\'' + safeId + '\')">'
        + img
        + '<span class="adc-badge">AD</span>'
        + '<div class="adc-txt">'
        + '<div class="adc-kick">' + kick + '</div>'
        + '<div class="adc-h">' + head + '</div>'
        + (cta ? '<span class="adc-cta">' + cta + ' &rarr;</span>' : '')
        + '</div></div>';
    }).join('');
    var dots = ads.length > 1
      ? '<div class="adc-dots" id="' + cid + '_dots">' + ads.map(function (_, i) { return '<i class="' + (i === 0 ? 'on' : '') + '"></i>'; }).join('') + '</div>'
      : '';
    var head = opts.heading === false ? '' :
      '<div class="adc-head"><span class="adc-spon">Sponsored</span><span class="adc-title">' + esc(opts.title || 'Featured Partners') + '</span></div>';
    return '<div class="ad-caro">' + head + '<div class="adc-track" id="' + cid + '">' + slides + '</div>' + dots + '</div>';
  };

  // Auto-rotate + dot sync. Started once; idempotent.
  H._initAdCarousels = function () {
    if (H._adCaroBound) return;
    H._adCaroBound = true;
    function step(tr) { return tr.children.length > 1 ? (tr.children[1].offsetLeft - tr.children[0].offsetLeft) : tr.clientWidth; }
    function indexOf(tr) { var s = step(tr); return s ? Math.round(tr.scrollLeft / s) : 0; }
    function syncDots(tr) {
      var dots = document.getElementById(tr.id + '_dots'); if (!dots) return;
      var idx = indexOf(tr);
      [].forEach.call(dots.children, function (d, i) { d.className = i === idx ? 'on' : ''; });
    }
    // Advance every visible carousel on a timer.
    H._adCaroTimer = setInterval(function () {
      document.querySelectorAll('.adc-track').forEach(function (tr) {
        if (!tr.offsetParent || tr.children.length < 2) return;
        if (tr._adcTouching) return;               // don't fight the user mid-swipe
        var idx = indexOf(tr);
        var next = (idx + 1) % tr.children.length;
        tr.scrollTo({ left: next * step(tr), behavior: 'smooth' });
        setTimeout(function () { syncDots(tr); }, 450);
      });
    }, 5000);
    // Live dot sync + pause-on-touch (delegated).
    document.addEventListener('scroll', function (e) {
      var tr = e.target.closest && e.target.closest('.adc-track'); if (tr) syncDots(tr);
    }, true);
    document.addEventListener('touchstart', function (e) {
      var tr = e.target.closest && e.target.closest('.adc-track'); if (tr) { tr._adcTouching = true; }
    }, true);
    document.addEventListener('touchend', function (e) {
      var tr = e.target.closest && e.target.closest('.adc-track');
      if (tr) setTimeout(function () { tr._adcTouching = false; }, 4000);
    }, true);
  };

})(window.H);
