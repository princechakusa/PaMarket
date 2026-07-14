/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 *
 * Product telemetry that powers the admin Operations Center.
 *
 *   H.touchPresence()      → profiles.last_seen_at   (Online-now, Active-today,
 *                             and the "engaged" step of the acquisition funnel)
 *   H.logSearch(term, n)   → search_logs             (Top searches + zero-result
 *                             searches = catalogue gaps)
 *
 * Both are FIRE-AND-FORGET and completely optional:
 *   • Never block, never throw, never surface an error to the user.
 *   • Self-disable permanently on the first failure (missing column/table means
 *     ADMIN_ENTERPRISE_V2.sql has not been run yet — that is fine, the app just
 *     stops trying).
 *   • Only ever write for the *authenticated* user, using the auth uid, so the
 *     existing "users update own profile" RLS policy is sufficient. No new
 *     policy is required for presence.
 *
 * See supabase/ADMIN_ENTERPRISE_V2.sql for the backing column/table.
 */
'use strict';
(function (H) {

  var sb = function () { return window.supabase; };

  // ── Cached auth uid (avoids an auth round-trip on every heartbeat) ─────────
  var _uid = null;
  async function authUid() {
    if (_uid) return _uid;
    try {
      var r = await sb().auth.getUser();
      _uid = (r && r.data && r.data.user && r.data.user.id) || null;
    } catch (e) { _uid = null; }
    return _uid;
  }
  // Drop the cached id on sign-out/sign-in so we never write to a stale user.
  try {
    if (sb() && sb().auth && typeof sb().auth.onAuthStateChange === 'function') {
      sb().auth.onAuthStateChange(function () { _uid = null; });
    }
  } catch (e) {}

  // ── Presence: profiles.last_seen_at ───────────────────────────────────────
  // Throttled to one write per 5 minutes — matches the admin "online now"
  // window, so a chattier heartbeat would buy nothing but write load.
  var PRESENCE_THROTTLE_MS = 5 * 60 * 1000;
  var _lastTouch = 0;
  var _presenceOff = false;   // set once if the column doesn't exist

  H.touchPresence = async function () {
    if (_presenceOff || !sb()) return;
    var now = Date.now();
    if (now - _lastTouch < PRESENCE_THROTTLE_MS) return;
    _lastTouch = now;                       // set before the await: at-most-once
    try {
      var uid = await authUid();
      if (!uid) return;                     // signed out — nothing to record
      var r = await sb().from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', uid);
      // A missing column is a schema error, not a transient one: stop trying.
      if (r && r.error) {
        var m = (r.error.message || '').toLowerCase();
        if (m.indexOf('last_seen_at') !== -1 || m.indexOf('column') !== -1) _presenceOff = true;
      }
    } catch (e) { /* never surface */ }
  };

  // ── Search analytics: search_logs ─────────────────────────────────────────
  // `results` is the number of matches the user actually saw. 0 = a catalogue
  // gap, which is the single most actionable number in the admin analytics.
  var _searchOff = false;
  var _lastTerm = '';
  var _lastTermAt = 0;
  var SEARCH_DEDUPE_MS = 3000;  // typing "sofa" fires per keystroke; log once

  H.logSearch = async function (term, results) {
    if (_searchOff || !sb()) return;
    term = String(term == null ? '' : term).trim();
    if (term.length < 2) return;            // ignore noise / single chars
    if (term.length > 120) term = term.slice(0, 120);

    var now = Date.now();
    // Collapse the keystroke burst: same term within 3s counts once, and a term
    // that is merely a prefix of the one we just logged is superseded.
    if (now - _lastTermAt < SEARCH_DEDUPE_MS &&
        (term === _lastTerm || _lastTerm.indexOf(term) === 0 || term.indexOf(_lastTerm) === 0)) {
      _lastTerm = term; _lastTermAt = now;
      return;
    }
    _lastTerm = term; _lastTermAt = now;

    try {
      var uid = await authUid();            // may be null — anonymous searches count too
      var r = await sb().from('search_logs').insert({
        term: term.toLowerCase(),
        results: (typeof results === 'number' && results >= 0) ? results : null,
        user_id: uid || null
      });
      if (r && r.error) {
        var m = (r.error.message || '').toLowerCase();
        // Table absent (migration not run) → disable permanently for this session.
        if (m.indexOf('search_logs') !== -1 || m.indexOf('does not exist') !== -1 ||
            m.indexOf('relation') !== -1 || r.error.code === '42P01') _searchOff = true;
      }
    } catch (e) { /* never surface */ }
  };

  // ── Wire presence into the app lifecycle ──────────────────────────────────
  // lifecycle.js is the single source of truth for foreground/background, so we
  // subscribe rather than adding competing OS listeners.
  var _prevOnAppStateChange = H._onAppStateChange;
  H._onAppStateChange = function (state) {
    if (typeof _prevOnAppStateChange === 'function') _prevOnAppStateChange.call(H, state);
    if (state === 'foreground' || state === 'online') H.touchPresence();
  };

  // First beat once the session has had a moment to restore, then a slow
  // keepalive so a long open session still counts as "online".
  setTimeout(function () { H.touchPresence(); }, 4000);
  setInterval(function () {
    if (!document.hidden) H.touchPresence();
  }, PRESENCE_THROTTLE_MS);

})(window.H = window.H || {});
