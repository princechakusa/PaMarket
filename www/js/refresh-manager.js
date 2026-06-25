/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function (H) {

  // Shared throttled fetches — at most once per 30s across all pages
  var _THROTTLE          = 30000;
  var _lastListingsFetch = 0;
  var _lastBizFetch      = 0;

  function _fetchListings() {
    var now = Date.now();
    if (now - _lastListingsFetch < _THROTTLE) return Promise.resolve();
    _lastListingsFetch = now;
    return typeof H.fetchListingsFromSupabase === 'function'
      ? H.fetchListingsFromSupabase().catch(function () {})
      : Promise.resolve();
  }

  var _lastJobsFetch = 0;
  function _fetchJobs() {
    var now = Date.now();
    if (now - _lastJobsFetch < _THROTTLE) return Promise.resolve();
    _lastJobsFetch = now;
    return typeof H.fetchJobsFromSupabase === 'function'
      ? H.fetchJobsFromSupabase().catch(function () {})
      : Promise.resolve();
  }

  function _fetchBiz() {
    var now = Date.now();
    if (now - _lastBizFetch < _THROTTLE) return Promise.resolve();
    _lastBizFetch = now;
    return typeof H.fetchAllActiveBusinesses === 'function'
      ? H.fetchAllActiveBusinesses().catch(function () {})
      : Promise.resolve();
  }

  // Signature helpers — detect meaningful state changes to avoid needless re-renders
  function _sigListings() {
    var ls = (H.state && H.state.listings) || [];
    return ls.length + (ls[0] ? '|' + ls[0].id + ls[0].status : '');
  }
  function _sigBiz() {
    var bz = (H.state && H.state.businesses) || [];
    if (!bz.length) return '0';
    // Track the most-recently-modified timestamp so that ANY field change
    // (logo, name, status, etc.) causes a different signature and triggers
    // a re-render — not just count or first-business status.
    var maxTs = 0;
    for (var i = 0; i < bz.length; i++) {
      var t = bz[i]._updatedAt || bz[i].updatedAt || 0;
      if (t > maxTs) maxTs = t;
    }
    return bz.length + '|' + maxTs;
  }
  function _sigNotifs() {
    var u = H.currentUser && H.currentUser();
    var ns = (u && H.state && H.state.notifs && H.state.notifs[u.id]) || [];
    return ns.length + (ns[0] ? '|' + ns[0].id : '');
  }

  // Per-page config: interval(ms), fetch(params)->Promise, sig(params)->string
  var _cfg = {
    Home:        { interval: 45000,  fetch: function () { return Promise.all([_fetchListings(), _fetchBiz()]); }, sig: function () { return _sigListings() + '|' + _sigBiz(); } },
    Browse:      { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Categories:  { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Property:    { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Vehicles:    { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Electronics: { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Fashion:     { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Furniture:   { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Services:    { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Agriculture: { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Pets:        { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Kids:        { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Other:       { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Jobs:        { interval: 60000,  fetch: _fetchJobs, sig: _sigListings },
    FindJobs:    { interval: 60000,  fetch: _fetchJobs, sig: _sigListings },
    JobDetail:   { interval: 60000,  fetch: _fetchJobs, sig: _sigListings },
    Rooms:       { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Detail: {
      interval: 60000,
      fetch: function (p) {
        if (!p || !p.id) return _fetchListings();
        return typeof H._fetchListingById === 'function'
          ? H._fetchListingById(p.id).catch(function () {})
          : _fetchListings();
      },
      sig: function (p) {
        if (!p || !p.id) return _sigListings();
        var l = ((H.state && H.state.listings) || []).find(function (x) { return x.id === p.id; });
        return l ? l.id + '|' + l.status + '|' + l.price : '';
      }
    },
    // NOTE: Messages and Chat are intentionally NOT managed by H.RM. They have
    // their own realtime subscription (_setupRealtimeMessages) plus a dedicated
    // poll (_messagesPoll) and incremental appender (_appendChatMessages) that
    // adds new messages without rebuilding the thread, so the chat stays pinned
    // to the latest message. A full RM re-render here would reset the scroll
    // position back to the oldest messages on every poll.
    Notifications: { interval: 20000,  fetch: function () { return typeof H.syncNotifications  === 'function' ? H.syncNotifications().catch(function () {})  : Promise.resolve(); }, sig: _sigNotifs },
    BusinessShop:    { interval: 30000,  fetch: function () { return Promise.all([_fetchListings(), _fetchBiz()]); }, sig: function () { return _sigListings() + '|' + _sigBiz(); } },
    BusinessSearch:  { interval: 60000,  fetch: _fetchBiz, sig: _sigBiz },
    BusinessProfile: { interval: 60000,  fetch: _fetchBiz, sig: _sigBiz },
    Admin: {
      interval: 30000,
      fetch: function () {
        var ps = [];
        if (typeof H.syncVerificationsFromSupabase === 'function') ps.push(H.syncVerificationsFromSupabase().catch(function () {}));
        if (typeof H.fetchAllListingsForAdmin === 'function') ps.push(H.fetchAllListingsForAdmin().catch(function () {}));
        if (typeof H.syncReports      === 'function') ps.push(H.syncReports().catch(function () {}));
        return ps.length ? Promise.all(ps) : Promise.resolve();
      },
      sig: function () {
        var rs = (H.state && H.state.reports)        || [];
        var vs = (H.state && H.state.verifications)  || [];
        var ls = (H.state && H.state.listings)       || [];
        var pend = 0;
        for (var i = 0; i < ls.length; i++) { if (ls[i] && ls[i].status === 'pending') pend++; }
        return rs.length + '|' + vs.length + '|' + ls.length + '|' + pend;
      }
    },
    MyListings: { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Favorites:  { interval: 120000, fetch: _fetchListings, sig: _sigListings },
    Account:    { interval: 120000, fetch: function () { return Promise.resolve(); }, sig: function () { return ''; } },
    Profile:    { interval: 120000, fetch: function () { return Promise.resolve(); }, sig: function () { return ''; } },
  };

  // ── Core RefreshManager ──────────────────────────────────────────────────────
  // Realtime-first architecture: every data change arrives instantly via Supabase
  // Realtime channels (postgres_changes) set up in app.js and notifications.js.
  // RM no longer drives periodic poll loops for any user-facing page. Its role is:
  //   1. ONE initial hydration fetch when a page mounts (RM.start)
  //   2. A catch-up fetch when the app returns from background (RM.resume)
  //   3. Immediate re-fetch after a user mutation (RM.postAction)
  //   4. Scroll-safe re-render infrastructure used by realtime handlers (_renderPreserved)
  //
  // The Admin page is the sole exception: it queries non-published tables
  // (verifications, all listings including non-active, reports) that have no
  // realtime publication, so a 30s poll interval is kept for that page only.
  //
  // Disconnection fallback: realtime-extras.js runs a 30s health check. When the
  // WebSocket is found disconnected it calls H.RT.reconnectAll() + H.RM.resume()
  // so the app catches up even when realtime is temporarily down.
  var RM = H.RM = {
    _loops:      {},   // { pageName: intervalId } — only Admin uses this now
    _current:    null, // page name currently on screen
    _params:     null, // params for current page
    _appActive:  true,
    _inBgRender: false,

    // Allow other modules to add/override page configs
    register: function (name, cfg) { _cfg[name] = cfg; },

    // Called from each page's _after hook. Does ONE hydration fetch then stops.
    // Interval-based polling is only started for the Admin page (no RT coverage).
    start: function (name, params) {
      RM.stopAll();
      RM._current = name;
      RM._params  = params || null;
      var c = _cfg[name];
      if (!c) return;
      clearTimeout(RM._startTimer);
      RM._startTimer = setTimeout(function () {
        if (RM._current !== name) return; // navigated away during debounce
        RM._poll(name, params, false);
        // Admin has no realtime publication for its queries — keep a 30s interval.
        if (name === 'Admin') {
          RM._loops[name] = setInterval(function () {
            if (!RM._appActive || document.hidden) return;
            if (RM._current !== name) { RM.stop(name); return; }
            RM._poll(name, params, false);
          }, c.interval);
        }
      }, 300);
    },

    stop: function (name) {
      if (RM._loops[name]) { clearInterval(RM._loops[name]); delete RM._loops[name]; }
    },

    stopAll: function () {
      clearTimeout(RM._startTimer);
      Object.keys(RM._loops).forEach(function (name) { RM.stop(name); });
    },

    // Called by H._onAppStateChange('background') — no-op for timers we no longer run.
    pause: function () {
      RM._appActive = false;
    },

    // Called on foreground return or realtime reconnect: do one fresh fetch to
    // catch up on anything missed while backgrounded. Realtime channels are
    // re-subscribed independently by H.RT.reconnectAll() in realtime-extras.js.
    resume: function () {
      RM._appActive    = true;
      _lastListingsFetch = 0; // bypass throttle — get server-fresh data immediately
      _lastJobsFetch     = 0;
      _lastBizFetch      = 0;
      var name   = RM._current || H.currentPageName;
      var params = RM._params;
      if (!name || document.hidden) return;
      RM.stop(name);
      clearTimeout(RM._startTimer);
      RM._poll(name, params, true);
      // Restart Admin interval if we're returning to that page.
      var c = _cfg[name];
      if (c && name === 'Admin') {
        RM._loops[name] = setInterval(function () {
          if (!RM._appActive || document.hidden) return;
          if (RM._current !== name) { RM.stop(name); return; }
          RM._poll(name, params, false);
        }, c.interval);
      }
    },

    // Immediate re-fetch + re-render after a user action that mutates data
    postAction: function (page, params) {
      var name = page   !== undefined ? page   : RM._current;
      var p    = params !== undefined ? params : RM._params;
      if (!name) return;
      var c = _cfg[name];
      if (!c) return;
      c.fetch(p).then(function () {
        if (H.currentPageName === name && !RM._inBgRender) RM._renderPreserved(name, p);
      }).catch(function(){});
    },

    // Core poll: fetch then re-render only when data actually changed (or forced)
    _poll: function (name, params, force) {
      var c = _cfg[name];
      if (!c) return;
      if (H.RT && H.RT._log) H.RT._log('pipeline', '[poll] fetch start', { page: name, force: !!force });
      var before = c.sig(params);
      c.fetch(params).then(function () {
        if (H.RT && H.RT._log) H.RT._log('pipeline', '[poll] fetch done', { page: name, changed: c.sig(params) !== before });
        if (RM._current !== name || H.currentPageName !== name) return;
        if (!RM._appActive || document.hidden) return;
        if (RM._inBgRender) return;
        if (force || c.sig(params) !== before) RM._renderPreserved(name, params);
      }).catch(function(){});
    },

    // Re-render while preserving scroll position and active input value + cursor.
    // Works correctly for both sync and async renderPage: keeps _inBgRender=true
    // until the page and its _after hook have fully completed, preventing the
    // _after hook from triggering a second RM.start() or redundant fetch.
    _renderPreserved: function (name, params) {
      if (RM._inBgRender) return;
      RM._inBgRender = true;
      if (H.RT && H.RT._log) H.RT._log('pipeline', '[4] render started', { page: name });
      var area = document.getElementById('mainArea');
      var scrollTop = area ? area.scrollTop : 0;
      var focused  = document.activeElement;
      var fId  = focused && focused.id ? focused.id : null;
      var fTag = focused ? focused.tagName : '';
      var fVal = (fTag === 'INPUT' || fTag === 'TEXTAREA') ? focused.value : null;
      var fS   = fVal !== null && focused.selectionStart !== undefined ? focused.selectionStart : null;
      var fE   = fVal !== null && focused.selectionEnd   !== undefined ? focused.selectionEnd   : null;

      function _restore() {
        RM._inBgRender = false;
        if (H.RT && H.RT._log) H.RT._log('pipeline', '[5] render completed', { page: name });
        if (area) area.scrollTop = scrollTop;
        if (fId) {
          var el = document.getElementById(fId);
          if (el) {
            el.focus();
            if (fVal !== null) {
              el.value = fVal;
              if (fS !== null) { try { el.setSelectionRange(fS, fE); } catch (e) {} }
            }
          }
        }
      }

      var result;
      try {
        result = typeof H.renderPage === 'function' ? H.renderPage(name, params) : null;
      } catch (e) {
        _restore();
        return;
      }

      // If renderPage returned a Promise (async page), keep _inBgRender=true
      // until the Promise settles — that's when the _after hook will have run.
      if (result && typeof result.then === 'function') {
        result.then(_restore, _restore);
      } else {
        // Sync page: renderPage already ran _after synchronously; restore now.
        _restore();
      }
    }
  };

  // Lifecycle events (visibilitychange, appStateChange, online/offline) are
  // handled exclusively by lifecycle.js which calls H.RM.resume() / H.RM.pause()
  // through the single H._onAppStateChange() entry point.

  // ── _after auto-install ──────────────────────────────────────────────────────
  // Each page's _after hook starts that page's polling loop. RM.start() calls
  // stopAll() first, so navigating between pages always swaps loops cleanly — no
  // need to override navTo/openInner/goBack (which risks breaking awaited
  // navigation). Loops also self-stop when RM._current no longer matches.
  function _autoHook(name) {
    var orig = H.pages && H.pages[name + '_after'];
    H.pages[name + '_after'] = function (params) {
      if (orig) orig.call(this, params);
      if (!RM._inBgRender) RM.start(name, params);
    };
  }

  function _install() {
    if (RM._installed) return;
    RM._installed = true;
    H.pages = H.pages || {};
    Object.keys(_cfg).forEach(function (name) { _autoHook(name); });
    // If the app already rendered a page before this ran, start its loop now
    if (H.currentPageName && _cfg[H.currentPageName]) {
      RM._current = H.currentPageName;
      RM.start(H.currentPageName, null);
    }
  }

  // Run on load, but if the page already finished loading, install immediately
  // (otherwise the load listener would never fire and RM would stay dormant).
  if (document.readyState === 'complete') {
    setTimeout(_install, 0);
  } else {
    window.addEventListener('load', _install);
  }

})(window.H = window.H || {});
