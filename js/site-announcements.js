// Public website announcement banner. This is deliberately separate from the
// signed-in user's personal notification center and does not request browser
// notification permission.
(function (global) {
  var DISMISSED_KEY = 'pm_dismissed_announcement';
  var SB_URL = global.SUPABASE_URL || 'https://gxgytumhknmnwspxjzxw.supabase.co';
  var SB_KEY = global.SUPABASE_ANON_KEY || 'sb_publishable_cf3Z72lUE6PLCb2m42OFLA_znE8JK2r';

  function fallbackFetch() {
    var path = '/rest/v1/site_announcements?is_active=eq.true' +
      '&select=id,message,link_url,link_label,starts_at,ends_at' +
      '&order=created_at.desc&limit=1';
    return fetch(SB_URL + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    }).then(function (res) {
      if (!res.ok) throw new Error('Announcement request failed');
      return res.json();
    }).then(function (rows) { return rows[0] || null; });
  }

  function fetchAnnouncement() {
    if (global.PM && typeof global.PM.fetchActiveSiteAnnouncement === 'function') {
      return global.PM.fetchActiveSiteAnnouncement();
    }
    return fallbackFetch();
  }

  function dismissedId() {
    try { return global.localStorage.getItem(DISMISSED_KEY) || ''; }
    catch (_) { return ''; }
  }

  function rememberDismissal(id) {
    try { global.localStorage.setItem(DISMISSED_KEY, id); }
    catch (_) { /* Banner still closes when storage is unavailable. */ }
  }

  function safeLink(raw) {
    if (!raw) return '';
    try {
      var url = new URL(raw, global.location.origin);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (_) { return ''; }
  }

  function render(announcement) {
    var banner = document.getElementById('siteAnnouncementBanner');
    var message = document.getElementById('siteAnnouncementMessage');
    var link = document.getElementById('siteAnnouncementLink');
    var close = document.getElementById('siteAnnouncementClose');
    if (!banner || !message || !link || !close || !announcement || !announcement.id) return;
    if (dismissedId() === String(announcement.id)) return;

    message.textContent = announcement.message || '';
    if (!message.textContent) return;

    var href = safeLink(announcement.link_url);
    if (href && announcement.link_label) {
      link.href = href;
      link.textContent = announcement.link_label;
      link.hidden = false;
      if (new URL(href).origin !== global.location.origin) {
        link.target = '_blank';
        link.rel = 'noopener';
      }
    } else {
      link.hidden = true;
      link.removeAttribute('href');
      link.textContent = '';
    }

    close.onclick = function () {
      rememberDismissal(String(announcement.id));
      banner.hidden = true;
    };
    banner.hidden = false;
  }

  function init() {
    fetchAnnouncement().then(render).catch(function () {
      // Announcements are optional; a failed request must never break the page.
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
