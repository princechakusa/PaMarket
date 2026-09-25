/* ============================================================
   Real, live USD -> ZiG (ZWG) exchange rate.
   Source: https://open.er-api.com (exchangerate-api.com's free, no-key
   open tier; CORS-enabled, updates once daily, real terms of use at
   https://www.exchangerate-api.com/terms). This is a genuine market
   rate feed, not the official RBZ interbank auction rate specifically
   (Zimbabwe's central bank publishes that on rbz.co.zw with no public
   API) -- copy referencing this rate should say "Live Market Rate",
   never "Reserve Bank Daily Indicator", to stay honest about the
   actual source.

   Cached in localStorage for 6 hours so every page load doesn't hit
   the third-party API -- the upstream data itself only refreshes once
   a day anyway. Falls back to a fixed, clearly-labelled illustrative
   rate if the fetch fails (offline, API down, CORS blocked) so the
   site never shows a broken price.
   ============================================================ */
(function (global) {
  'use strict';

  var ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
  var CACHE_KEY = 'pm_fx_zig_rate_v1';
  var CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours
  var FALLBACK_RATE = 27.42; // illustrative only, used solely if the live feed is unreachable

  function readCache() {
    try {
      var raw = global.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.rate !== 'number' || !parsed.fetchedAt) return null;
      if (Date.now() - parsed.fetchedAt > CACHE_MS) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function writeCache(rate, isLive) {
    try {
      global.localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: rate, isLive: isLive, fetchedAt: Date.now() }));
    } catch (e) { /* private mode / quota -- fine, just skip caching */ }
  }

  function fetchLiveRate() {
    return global.fetch(ENDPOINT).then(function (res) {
      if (!res.ok) throw new Error('FX feed HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      var rate = data && data.rates && (data.rates.ZWG || data.rates.ZWL);
      if (!rate || typeof rate !== 'number') throw new Error('FX feed missing ZWG rate');
      return { rate: rate, isLive: true, updatedAt: data.time_last_update_utc || null };
    });
  }

  /** Returns a Promise<{rate:number, isLive:boolean, updatedAt:string|null}>.
   * isLive:false means the fallback constant was used (feed unreachable). */
  function getRate() {
    var cached = readCache();
    if (cached) return Promise.resolve({ rate: cached.rate, isLive: cached.isLive, updatedAt: null, fromCache: true });
    return fetchLiveRate().then(function (result) {
      writeCache(result.rate, true);
      return result;
    }).catch(function () {
      writeCache(FALLBACK_RATE, false);
      return { rate: FALLBACK_RATE, isLive: false, updatedAt: null };
    });
  }

  global.PMFxRate = Object.freeze({ getRate: getRate, FALLBACK_RATE: FALLBACK_RATE });

  // Fill the shared header's rate slot on any page that loads this file,
  // so pages don't each need their own copy of this wiring. Pages that
  // still set it themselves write the same text; harmless.
  function fillHeader() {
    if (!global.document || !global.document.getElementById('fxRateHeader')) return;
    getRate().then(function (r) {
      var el = global.document.getElementById('fxRateHeader');
      if (el) el.textContent = r.isLive ? ('Live Rate: 1 USD = ' + r.rate.toFixed(2) + ' ZiG') : 'Official Rates Synced Daily';
    });
  }
  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', fillHeader);
    else fillHeader();
  }
})(typeof self !== 'undefined' ? self : this);
