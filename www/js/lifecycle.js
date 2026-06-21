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
 *
 * iOS + Android lifecycle event ordering
 * ───────────────────────────────────────
 * Both platforms fire two signals on every foreground/background transition:
 * visibilitychange (from WKWebView / WebView) and appStateChange (Capacitor).
 *
 * iOS backgrounding :  visibilitychange(hidden) fires first, then appStateChange.
 * iOS foregrounding :  visibilitychange(visible) fires first, then appStateChange.
 *                      appStateChange also fires alone for transient interruptions
 *                      (phone call overlays, notification centre) that do not
 *                      affect document visibility.
 *
 * Android backgrounding: appStateChange fires first; visibilitychange follows.
 * Android foregrounding: appStateChange fires first and is authoritative;
 *                        visibilitychange can be delayed or skipped on app-switch.
 *
 * The 2-second foreground debounce absorbs the duplicate regardless of order.
 * Background has no debounce because RM.pause() and touchLastSeen are idempotent
 * or self-throttled, so duplicate background signals are harmless.
 *
 * WebSocket behaviour after iOS suspension
 * ─────────────────────────────────────────
 * iOS suspends the JS process after ~3-10 s in background, killing all WebSocket
 * connections. On return to foreground, _rtOnForeground calls RT.reconnectAll
 * which re-subscribes every Supabase channel. If the network is not yet ready,
 * each channel emits CHANNEL_ERROR which triggers scheduleReconnect (exponential
 * backoff: 2 s, 4 s, 8 s … 30 s cap). The 30 s health monitor in realtime-extras
 * catches any connections that were not restored by the foreground handler.
 */
'use strict';
(function (H) {

  // ── Debounce guard ───────────────────────────────────────────────────────────
  // Both visibilitychange and appStateChange fire on the same foreground transition
  // on iOS and Android, so two _onAppStateChange('foreground') calls arrive within
  // milliseconds of each other. The 2-second gate ensures exactly one execution
  // regardless of which signal arrives first or whether both arrive.
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
      // Suspend poll loops; update last-seen timestamp.
      // No debounce needed: RM.pause() is idempotent, touchLastSeen is 60 s
      // throttled, so duplicate background signals (iOS transient interruptions
      // fire appStateChange without a matching visibilitychange) are harmless.
      if (H.RM && typeof H.RM.pause === 'function') H.RM.pause();
      if (typeof H._rtOnBackground === 'function') H._rtOnBackground();

    } else if (state === 'online') {
      // Network returned: reconnect realtime and force an immediate poll.
      // Runs independently of the foreground debounce — network recovery can
      // occur while the app is already foregrounded (Wi-Fi handoff, tunnel up).
      if (typeof H._rtOnOnline === 'function') H._rtOnOnline();

    }
    // 'offline' — no action; polls and realtime degrade gracefully on their own.
  };

  // ── OS event listeners ───────────────────────────────────────────────────────

  // visibilitychange — fires on both iOS (WKWebView) and Android (WebView).
  // On iOS this is the first signal to arrive on foreground/background transitions,
  // so document.hidden is already in its new state when the handler runs.
  document.addEventListener('visibilitychange', function () {
    H._onAppStateChange(document.hidden ? 'background' : 'foreground');
  });

  // Capacitor App plugin (iOS + Android) — fires appStateChange on every
  // active/inactive transition. On Android this is the authoritative signal
  // because visibilitychange can be delayed or skipped on app-switch. On iOS
  // this additionally covers transient interruptions (phone call overlays,
  // notification centre) where visibilitychange is not raised. The 2-second
  // foreground debounce absorbs any duplicate that arrives for the same transition.
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
