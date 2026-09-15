// Non-blocking nudge, shown on the seller's own dashboard, to add a location
// to an existing listing that predates (or skipped) the location feature.
// Never requests GPS itself — it only links to the existing Edit page, where
// the real "Use my current location" button already lives. Dismissal is
// remembered permanently (same localStorage idiom as site-announcements.js)
// so it doesn't nag on every visit. Takes the caller's already-fetched
// listings array — this never makes a network request of its own.
//
// The banner's markup and styling are built here, not in the host page's
// HTML/CSS, and only inserted when a qualifying listing actually exists —
// dashboard.html stays untouched when there's nothing to show.
(function (global) {
  var DISMISS_KEY = 'pm_loc_reminder_dismissed';

  function isDismissed() {
    try { return global.localStorage.getItem(DISMISS_KEY) === '1'; }
    catch (_) { return false; }
  }

  function rememberDismissal() {
    try { global.localStorage.setItem(DISMISS_KEY, '1'); }
    catch (_) { /* banner still closes when storage is unavailable */ }
  }

  function render(listings) {
    var slot = document.getElementById('dbLocBannerSlot');
    if (!slot || isDismissed()) return;

    var missing = (listings || []).find(function (l) {
      return l.status === 'active' && l.latitude == null && l.longitude == null;
    });
    if (!missing) return;

    var banner = document.createElement('div');
    banner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:var(--gold-tint);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-top:20px';
    banner.innerHTML =
      '<div>' +
        '<b style="display:block;font-size:14.5px;color:var(--ink)">Add your location</b>' +
        '<span style="font-size:13px;color:var(--mute)">Help buyers find listings near them by adding an approximate location.</span>' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-shrink:0">' +
        '<a class="btn btn-navy" href="post-ad?edit=' + encodeURIComponent(missing.id) + '">Add location</a>' +
        '<button type="button" style="background:none;border:none;color:var(--mute);font-size:13px;cursor:pointer;padding:0 6px">Not now</button>' +
      '</div>';

    banner.querySelector('button').addEventListener('click', function () {
      rememberDismissal();
      banner.remove();
    });

    slot.appendChild(banner);
  }

  global.PMSellerLocationReminder = { render: render };
})(window);
