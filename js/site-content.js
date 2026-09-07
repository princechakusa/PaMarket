// Admin-managed public content (legal docs, FAQ, contact/social links) —
// stage 1 of the hardcoded-content migration. Mirrors js/site-announcements.js:
// a plain REST fetch with the anon key, and every caller must treat a
// failed/slow request as normal — the static HTML already on the page is
// the fallback, so a page must never go blank because this request failed.
(function (global) {
  var sharedClient = global.PMSupabaseClient && global.PMSupabaseClient.get();
  var SB_URL = sharedClient ? sharedClient.url : global.SUPABASE_URL;
  var SB_KEY = sharedClient ? sharedClient.publishableKey : global.SUPABASE_ANON_KEY;
  var REQUEST_TIMEOUT_MS = 6000;

  function withTimeout(promise) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('content request timed out')); }, REQUEST_TIMEOUT_MS);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  // Fetches one published content_pages row by slug. Resolves to null
  // (never rejects) on any failure, so callers can just do
  // `fetchContentPage('terms').then(function (row) { if (row) {...} })`
  // and leave the existing static markup untouched otherwise.
  function fetchContentPage(slug) {
    var path = '/rest/v1/content_pages?slug=eq.' + encodeURIComponent(slug) +
      '&status=eq.published&select=slug,title,short_description,body,effective_date,updated_at&limit=1';
    return withTimeout(fetch(SB_URL + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    })).then(function (res) {
      if (!res.ok) throw new Error('content_pages request failed');
      return res.json();
    }).then(function (rows) { return rows[0] || null; })
      .catch(function () { return null; });
  }

  // Fetches the public settings.content block from app_settings (support
  // email, WhatsApp, social links, store links, website URL). Resolves to
  // null on any failure.
  function fetchSiteSettings() {
    var path = '/rest/v1/app_settings?id=eq.1&select=settings';
    return withTimeout(fetch(SB_URL + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    })).then(function (res) {
      if (!res.ok) throw new Error('app_settings request failed');
      return res.json();
    }).then(function (rows) {
      var row = rows[0];
      return row && row.settings && row.settings.content ? row.settings.content : null;
    }).catch(function () { return null; });
  }

  // Renders a content_pages `body.sections` array into the same markup
  // shape the static legal pages already use (h3 heading + p paragraph),
  // so swapping it in changes nothing but the text.
  function renderSections(sections) {
    return (sections || []).map(function (s) {
      var heading = s.heading ? '<h3>' + escapeHtml(s.heading) + '</h3>' : '';
      var body = (s.body || '').split(/\n\n+/).map(function (para) {
        return '<p>' + escapeHtml(para) + '</p>';
      }).join('');
      return heading + body;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function safeHref(raw) {
    if (!raw) return '';
    try {
      var url = new URL(raw, global.location.origin);
      return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:' ? url.href : '';
    } catch (_) { return ''; }
  }

  global.PMContent = {
    fetchContentPage: fetchContentPage,
    fetchSiteSettings: fetchSiteSettings,
    renderSections: renderSections,
    escapeHtml: escapeHtml,
    safeHref: safeHref,
  };
})(window);
