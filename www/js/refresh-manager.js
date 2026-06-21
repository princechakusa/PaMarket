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
    return bz.length + (bz[0] ? '|' + bz[0].id + bz[0].status : '');
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
    Jobs:        { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
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
        if (typeof H.syncReports      === 'function') ps.push(H.syncReports().catch(function () {}));
        if (typeof H.syncConversations === 'function') ps.push(H.syncConversations().catch(function () {}));
        return ps.length ? Promise.all(ps) : Promise.resolve();
      },
      sig: function () {
        var rs = (H.state && H.state.reports)        || [];
        var vs = (H.state && H.state.verifications)  || [];
        return rs.length + '|' + vs.length;
      }
    },
    MyListings: { interval: 60000,  fetch: _fetchListings, sig: _sigListings },
    Favorites:  { interval: 120000, fetch: _fetchListings, sig: _sigListings },
    Account:    { interval: 120000, fetch: function () { return Promise.resolve(); }, sig: function () { return ''; } },
    Profile:    { interval: 120000, fetch: function () { return Promise.resolve(); }, sig: function () { return ''; } },
  };

  // ── Core RefreshManager ──────────────────────────────────────────────────────
  var RM = H.RM = {
    _loops:      {},   // { pageName: intervalId }
    _current:    null, // page name currently on screen
    _params:     null, // params for current page
    _appActive:  true,
    _inBgRender: false,

    // Allow other modules to add/override page configs
    register: function (name, cfg) { _cfg[name] = cfg; },

    // Start polling for a page — called from each page's _after hook.
    // Debounced: rapid successive calls (e.g. realtime + boot) only set
    // the interval once, from the LAST call within a 500ms window.
    start: function (name, params) {
      RM.stopAll();
      RM._current = name;
      RM._params  = params || null;
      var c = _cfg[name];
      if (!c) return;
      // Debounce interval creation so rapid re-renders (realtime events,
      // initial boot sequence) don't keep resetting the 45s countdown.
      clearTimeout(RM._startTimer);
      RM._startTimer = setTimeout(function () {
        if (RM._current !== name) return; // navigated away during debounce
        RM._poll(name, params, false);
        RM._loops[name] = setInterval(function () {
          if (!RM._appActive || document.hidden) return;
          if (RM._current !== name) { RM.stop(name); return; }
          RM._poll(name, params, false);
        }, c.interval);
      }, 300);
    },

    stop: function (name) {
      if (RM._loops[name]) { clearInterval(RM._loops[name]); delete RM._loops[name]; }
    },

    stopAll: function () {
      clearTimeout(RM._startTimer);
      Object.keys(RM._loops).forEach(function (name) { RM.stop(name); });
    },

    // Called when app returns to foreground — force fresh fetch then resume loop
    resume: function () {
      RM._appActive    = true;
      _lastListingsFetch = 0; // bypass throttle so we get fresh data immediately
      _lastBizFetch      = 0;
      var name   = RM._current || H.currentPageName;
      var params = RM._params;
      if (!name || document.hidden) return;
      RM.stop(name);
      clearTimeout(RM._startTimer);
      RM._poll(name, params, true);
      var c = _cfg[name];
      if (!c) return;
      RM._loops[name] = setInterval(function () {
        if (!RM._appActive || document.hidden) return;
        if (RM._current !== name) { RM.stop(name); return; }
        RM._poll(name, params, false);
      }, c.interval);
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
      });
    },

    // Core poll: fetch then re-render only when data actually changed (or forced)
    _poll: function (name, params, force) {
      if (RM._inBgRender) return;
      var c = _cfg[name];
      if (!c) return;
      var before = c.sig(params);
      c.fetch(params).then(function () {
        if (RM._current !== name || H.currentPageName !== name) return;
        if (!RM._appActive || document.hidden) return;
        if (force || c.sig(params) !== before) RM._renderPreserved(name, params);
      });
    },

    // Re-render while preserving scroll position and active input value + cursor.
    // Works correctly for both sync and async renderPage: keeps _inBgRender=true
    // until the page and its _after hook have fully completed, preventing the
    // _after hook from triggering a second RM.start() or redundant fetch.
    _renderPreserved: function (name, params) {
      if (RM._inBgRender) return;
      RM._inBgRender = true;
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

  // ── Visibility & foreground detection ────────────────────────────────────────
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      RM._appActive = false;
    } else {
      RM.resume();
    }
  });

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
