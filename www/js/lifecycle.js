/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * App lifecycle owner — single source of truth for all OS state change events.
 *
 * All foreground/background/online/offline signals funnel through
 * H._onAppStateChange(state) so every subscriber reacts exactly once per event.
 *
 * Consumers:
 *   H.RM.resume()  / H.RM.pause()    — refresh-manager.js poll loops
 *   H._rtOnForeground / _rtOnBackground / _rtOnOnline — realtime-extras.js
 */
'use strict';
(function (H) {

  // ── Debounce guard ───────────────────────────────────────────────────────────
  // visibilitychange and appStateChange both fire when the app returns to the
  // foreground on Android (Capacitor). The 2-second gate ensures the combined
  // trigger executes exactly once, no matter how many OS signals arrive.
  var _lastFgMs = 0;
  var _FG_DEBOUNCE_MS = 2000;

  // ── Single entry point ───────────────────────────────────────────────────────
  H._onAppStateChange = function (state) {
    if (state === 'foreground') {
      var now = Date.now();
      if (now - _lastFgMs < _FG_DEBOUNCE_MS) return;   // deduplicate dual triggers
      _lastFgMs = now;
      // RM resume: resets throttles and restarts the per-page poll loop
      if (H.RM && typeof H.RM.resume === 'function') H.RM.resume();
      // RT foreground: reconnects all realtime channels + deferred user-data sync
      if (typeof H._rtOnForeground === 'function') H._rtOnForeground();

    } else if (state === 'background') {
      // Suspend poll loops; update last-seen timestamp
      if (H.RM && typeof H.RM.pause === 'function') H.RM.pause();
      if (typeof H._rtOnBackground === 'function') H._rtOnBackground();

    } else if (state === 'online') {
      // Network returned: reconnect realtime and force an immediate poll
      if (typeof H._rtOnOnline === 'function') H._rtOnOnline();
      // online does NOT go through the foreground debounce — it is independent
      // and may fire while the app is already in the foreground

    }
    // 'offline' — no action; polls and realtime degrade gracefully on their own
  };

  // ── OS event listeners ───────────────────────────────────────────────────────

  // Web / PWA — fires reliably on tab focus and on Android in most browser contexts
  document.addEventListener('visibilitychange', function () {
    H._onAppStateChange(document.hidden ? 'background' : 'foreground');
  });

  // Capacitor native (Android) — authoritative foreground/background trigger.
  // visibilitychange can be delayed or skipped on Android app-switch; this fills
  // that gap. The 2-second debounce above absorbs any duplicate that arrives when
  // both events fire for the same transition.
  try {
    var _CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (_CapApp && typeof _CapApp.addListener === 'function') {
      _CapApp.addListener('appStateChange', function (st) {
        H._onAppStateChange(st && st.isActive ? 'foreground' : 'background');
      });
    }
  } catch (e) {}

  // Network recovery — device regains connectivity after mobile data toggle,
  // Wi-Fi reconnect, or tunnel re-establishment.
  window.addEventListener('online',  function () { H._onAppStateChange('online');  });
  window.addEventListener('offline', function () { H._onAppStateChange('offline'); });

})(window.H = window.H || {});
