(function () {
  'use strict';

  var STORE_URLS = Object.freeze({
    android: 'https://play.google.com/store/apps/details?id=com.pamarket.app',
    ios: 'https://apps.apple.com/app/id6794616959',
  });

  var BOT_PATTERN = /bot|crawler|spider|crawling|facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot/i;

  function isBot(userAgent) {
    return BOT_PATTERN.test(String(userAgent || ''));
  }

  function detectPlatform(environment) {
    var env = environment || {};
    var userAgent = String(env.userAgent || '');
    var platform = String(env.platform || '');
    var userAgentPlatform = String(env.userAgentPlatform || '');
    var maxTouchPoints = Number(env.maxTouchPoints || 0);
    var combinedPlatform = userAgentPlatform || platform;

    if (/android/i.test(userAgent) || /android/i.test(combinedPlatform)) return 'android';
    if (/iphone|ipad|ipod/i.test(userAgent) || /ios/i.test(combinedPlatform)) return 'ios';
    if (/mac/i.test(combinedPlatform) && maxTouchPoints > 1) return 'ios';
    return null;
  }

  function getDecision(options) {
    var input = options || {};
    var params = new URLSearchParams(input.search || '');
    var userAgent = String(input.userAgent || '');
    var noRedirect = /^(1|true|yes)$/i.test(params.get('no_redirect') || '');

    if (noRedirect || isBot(userAgent)) return Object.freeze({ platform: null, redirect: false });

    var override = String(params.get('store') || '').toLowerCase();
    var platform = override === 'android' || override === 'ios'
      ? override
      : detectPlatform(input);

    return Object.freeze({
      platform: platform,
      redirect: Boolean(platform && STORE_URLS[platform]),
    });
  }

  function browserEnvironment() {
    var nav = window.navigator || {};
    return {
      search: window.location.search,
      userAgent: nav.userAgent || '',
      platform: nav.platform || '',
      userAgentPlatform: nav.userAgentData && nav.userAgentData.platform || '',
      maxTouchPoints: nav.maxTouchPoints || 0,
    };
  }

  function showRedirectStatus(platform, url) {
    var panel = document.getElementById('downloadStatus');
    var text = document.getElementById('downloadStatusText');
    var fallback = document.getElementById('downloadFallbackLink');
    if (!panel || !text || !fallback) return;

    text.textContent = platform === 'android'
      ? 'Opening PaMarket on Google Play…'
      : 'Opening PaMarket on the App Store…';
    fallback.href = url;
    fallback.textContent = platform === 'android' ? 'Open Google Play' : 'Open App Store';
    panel.hidden = false;
  }

  function initialise() {
    var decision = getDecision(browserEnvironment());
    document.documentElement.dataset.downloadPlatform = decision.platform || 'other';
    if (!decision.redirect) return;

    var url = STORE_URLS[decision.platform];
    showRedirectStatus(decision.platform, url);
    window.setTimeout(function () {
      window.location.replace(url);
    }, 650);
  }

  window.PMDownload = Object.freeze({
    STORE_URLS: STORE_URLS,
    isBot: isBot,
    detectPlatform: detectPlatform,
    getDecision: getDecision,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
})();
