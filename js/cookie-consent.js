// PaMarket cookie consent manager — single source of truth for optional
// tracking on the public website. No third-party library: this reads/writes
// one localStorage key, renders the first-visit banner + settings panel,
// and is the ONLY place that is allowed to load Google Analytics or
// Google AdSense. Nothing else on the site should inject those scripts.
//
// Storage key `pamarket_cookie_consent` is plain preference data (booleans +
// a timestamp) — never authentication state, so it is safe to read before
// consent is even granted and safe to leave in essential/unconsented storage.
(function (global, document) {
  var CONSENT_KEY = 'pamarket_cookie_consent';
  var CONSENT_VERSION = '1.0';
  var GA_ID = 'G-EGS078J4Q2';
  var ADSENSE_CLIENT = 'ca-pub-2601167334065110';

  var CATEGORIES = [
    {
      key: 'essential',
      title: 'Essential',
      locked: true,
      body: 'Required to keep PaMarket secure and working — signing you in, remembering your session, preventing fraud, and remembering this consent choice itself. These cannot be switched off because the site cannot function without them.'
    },
    {
      key: 'analytics',
      title: 'Analytics',
      locked: false,
      body: 'Helps us understand traffic, page views, search behaviour and which features are actually used, so we can improve PaMarket. Uses Google Analytics. Off until you allow it.'
    },
    {
      key: 'preferences',
      title: 'Preferences',
      locked: false,
      body: 'Remembers optional personalisation, like recently viewed listings, so the site feels tailored to you on your next visit. Off until you allow it.'
    },
    {
      key: 'marketing',
      title: 'Marketing',
      locked: false,
      body: 'Allows advertising to be shown on PaMarket via Google AdSense. Off until you allow it.'
    }
  ];

  function nowIso() { return new Date().toISOString(); }

  function readConsent() {
    var raw;
    try { raw = global.localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
    if (!raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return null; }
    if (!parsed || parsed.version !== CONSENT_VERSION) return null;
    return {
      essential: true,
      analytics: !!parsed.analytics,
      preferences: !!parsed.preferences,
      marketing: !!parsed.marketing,
      timestamp: parsed.timestamp,
      version: CONSENT_VERSION
    };
  }

  function writeConsent(choice) {
    var record = {
      essential: true,
      analytics: !!choice.analytics,
      preferences: !!choice.preferences,
      marketing: !!choice.marketing,
      timestamp: nowIso(),
      version: CONSENT_VERSION
    };
    try { global.localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch (e) { /* private mode */ }
    return record;
  }

  function loadScript(src, attrs) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) { for (var k in attrs) if (attrs.hasOwnProperty(k)) s.setAttribute(k, attrs[k]); }
    document.head.appendChild(s);
    return s;
  }

  var analyticsStarted = false;
  function initAnalytics() {
    if (analyticsStarted) return;
    analyticsStarted = true;
    global.dataLayer = global.dataLayer || [];
    global.gtag = global.gtag || function () { global.dataLayer.push(arguments); };
    global.gtag('js', new Date());
    global.gtag('config', GA_ID);
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + GA_ID);
  }

  var marketingStarted = false;
  function initMarketing() {
    if (marketingStarted) return;
    marketingStarted = true;
    loadScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT, { crossorigin: 'anonymous' });
  }

  // Nothing third-party currently reads the "preferences" category — it
  // gates first-party personalization (e.g. recently-viewed listings). This
  // flag is what that code checks before writing anything.
  function applyConsent(consent) {
    if (!consent) return;
    if (consent.analytics) initAnalytics();
    if (consent.marketing) initMarketing();
  }

  global.PMConsent = global.PMConsent || {};
  global.PMConsent.get = readConsent;
  global.PMConsent.hasChoice = function () { return !!readConsent(); };
  global.PMConsent.allows = function (category) {
    var c = readConsent();
    return !!(c && (category === 'essential' || c[category]));
  };

  // ---- UI ------------------------------------------------------------

  var lastFocused = null;

  function injectStyles() {
    if (document.getElementById('pmCookieStyles')) return;
    var style = document.createElement('style');
    style.id = 'pmCookieStyles';
    style.textContent =
      '.pm-cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:900;background:#fff;border-top:1px solid #E6DFD1;box-shadow:0 -8px 30px rgba(15,36,96,.12);padding:18px 0;font-family:Inter,system-ui,-apple-system,sans-serif;animation:pmCookieIn .25s ease-out}' +
      '@keyframes pmCookieIn{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}' +
      '.pm-cookie-banner-in{max-width:1200px;margin:0 auto;padding:0 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}' +
      '.pm-cookie-copy strong{display:block;font-family:Georgia,serif;font-size:16px;color:#151A2E;margin-bottom:4px}' +
      '.pm-cookie-copy p{margin:0;font-size:13px;color:#5B6478;max-width:640px;line-height:1.55}' +
      '.pm-cookie-actions{display:flex;gap:10px;flex-wrap:wrap;flex-shrink:0}' +
      '.pm-cookie-btn{display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:13px;font-weight:600;line-height:1;border-radius:9px;padding:0 16px;min-height:38px;border:1.5px solid transparent;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,color .15s}' +
      '.pm-cookie-btn:focus-visible{outline:2px solid #1A3A8F;outline-offset:2px}' +
      '.pm-cookie-btn-outline{background:#fff;color:#151A2E;border-color:#E6DFD1}.pm-cookie-btn-outline:hover{border-color:#1A3A8F;color:#1A3A8F}' +
      '.pm-cookie-btn-solid{background:#1A3A8F;color:#fff}.pm-cookie-btn-solid:hover{background:#0B1C4D}' +
      '@media(max-width:640px){.pm-cookie-banner{padding:16px 0}.pm-cookie-banner-in{padding:0 18px;flex-direction:column;align-items:stretch}.pm-cookie-actions{flex-direction:column}.pm-cookie-actions .pm-cookie-btn{width:100%}}' +
      '.pm-cookie-overlay{position:fixed;inset:0;z-index:950;background:rgba(11,28,77,.45);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,-apple-system,sans-serif}' +
      '.pm-cookie-dialog{background:#fff;border-radius:16px;max-width:520px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(11,28,77,.35);animation:pmCookieIn .2s ease-out}' +
      '.pm-cookie-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:22px 24px 14px;position:sticky;top:0;background:#fff;border-bottom:1px solid #E6DFD1}' +
      '.pm-cookie-dialog-head h2{margin:0;font-family:Georgia,serif;font-size:20px;color:#151A2E}' +
      '.pm-cookie-close{background:none;border:0;font-size:24px;line-height:1;color:#5B6478;width:32px;height:32px;border-radius:50%;flex-shrink:0;cursor:pointer}' +
      '.pm-cookie-close:hover{background:#F7F4EE;color:#151A2E}' +
      '.pm-cookie-close:focus-visible{outline:2px solid #1A3A8F;outline-offset:2px}' +
      '.pm-cookie-dialog-body{padding:6px 24px}' +
      '.pm-cookie-row{padding:16px 0;border-bottom:1px solid #E6DFD1}' +
      '.pm-cookie-row:last-child{border-bottom:none}' +
      '.pm-cookie-row-head{display:flex;align-items:center;justify-content:space-between;gap:16px}' +
      '.pm-cookie-row-title{font-weight:700;font-size:14.5px;color:#151A2E}' +
      '.pm-cookie-row-title em{font-style:normal;font-weight:600;font-size:11.5px;color:#1F7A4D;text-transform:uppercase;letter-spacing:.03em}' +
      '.pm-cookie-row-body{margin:6px 0 0;font-size:13px;color:#5B6478;line-height:1.55}' +
      '.pm-cookie-dialog-foot{display:flex;justify-content:flex-end;gap:10px;padding:16px 24px 22px;position:sticky;bottom:0;background:#fff;border-top:1px solid #E6DFD1}' +
      '@media(max-width:560px){.pm-cookie-overlay{padding:0;align-items:flex-end}.pm-cookie-dialog{max-width:none;max-height:92vh;border-radius:18px 18px 0 0}.pm-cookie-dialog-foot{flex-direction:column-reverse}.pm-cookie-dialog-foot .pm-cookie-btn{width:100%}}' +
      '.pm-switch{position:relative;width:43px;height:25px;flex-shrink:0}' +
      '.pm-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}' +
      '.pm-switch span{position:absolute;inset:0;border-radius:999px;background:#C9CDD5;transition:.2s;pointer-events:none}' +
      '.pm-switch span:after{content:"";position:absolute;width:19px;height:19px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.2);transition:.2s}' +
      '.pm-switch input:checked+span{background:#1A3A8F}' +
      '.pm-switch input:checked+span:after{transform:translateX(18px)}' +
      '.pm-switch input:focus-visible+span{outline:2px solid #1A3A8F;outline-offset:2px}' +
      '.pm-switch.locked{opacity:.55}.pm-switch.locked input{cursor:not-allowed}';
    document.head.appendChild(style);
  }

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) node.setAttribute(k, attrs[k]);
    if (html != null) node.innerHTML = html;
    return node;
  }

  function trapFocus(container, e) {
    if (e.key !== 'Tab') return;
    var focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function removeBanner() {
    var b = document.getElementById('pmCookieBanner');
    if (b) b.remove();
  }

  function renderBanner() {
    if (document.getElementById('pmCookieBanner') || document.getElementById('pmCookieModal')) return;
    injectStyles();
    var banner = el('div', {
      id: 'pmCookieBanner',
      class: 'pm-cookie-banner',
      role: 'dialog',
      'aria-live': 'polite',
      'aria-label': 'Cookie notice'
    },
      '<div class="pm-cookie-banner-in">' +
        '<div class="pm-cookie-copy">' +
          '<strong>We use cookies</strong>' +
          '<p>PaMarket uses essential cookies to keep the website secure and functional. With your permission, we also use optional cookies for analytics, preferences, and marketing.</p>' +
        '</div>' +
        '<div class="pm-cookie-actions">' +
          '<button type="button" class="pm-cookie-btn pm-cookie-btn-outline" id="pmCookieSettingsBtn">Cookie Settings</button>' +
          '<button type="button" class="pm-cookie-btn pm-cookie-btn-outline" id="pmRejectBtn">Reject Optional</button>' +
          '<button type="button" class="pm-cookie-btn pm-cookie-btn-solid" id="pmAcceptBtn">Accept All</button>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(banner);

    document.getElementById('pmAcceptBtn').addEventListener('click', function () {
      applyConsent(writeConsent({ analytics: true, preferences: true, marketing: true }));
      removeBanner();
    });
    document.getElementById('pmRejectBtn').addEventListener('click', function () {
      writeConsent({ analytics: false, preferences: false, marketing: false });
      removeBanner();
    });
    document.getElementById('pmCookieSettingsBtn').addEventListener('click', function (e) {
      openSettings(e.currentTarget, true);
    });
  }

  function switchRow(cat, current) {
    var checked = cat.locked ? true : !!current[cat.key];
    return '<div class="pm-cookie-row">' +
      '<div class="pm-cookie-row-head">' +
        '<span class="pm-cookie-row-title">' + cat.title + (cat.locked ? ' <em>— Always Active</em>' : '') + '</span>' +
        '<label class="pm-switch' + (cat.locked ? ' locked' : '') + '">' +
          '<input type="checkbox" data-cat="' + cat.key + '" ' + (checked ? 'checked' : '') + (cat.locked ? ' disabled' : '') + ' aria-label="' + cat.title + '">' +
          '<span></span>' +
        '</label>' +
      '</div>' +
      '<p class="pm-cookie-row-body">' + cat.body + '</p>' +
    '</div>';
  }

  function openSettings(trigger, bannerVisible) {
    if (document.getElementById('pmCookieModal')) return;
    injectStyles();
    lastFocused = trigger || document.activeElement;
    var current = readConsent() || { essential: true, analytics: false, preferences: false, marketing: false };

    var overlay = el('div', { id: 'pmCookieModal', class: 'pm-cookie-overlay' },
      '<div class="pm-cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="pmCookieModalTitle">' +
        '<div class="pm-cookie-dialog-head">' +
          '<h2 id="pmCookieModalTitle">Cookie Settings</h2>' +
          '<button type="button" class="pm-cookie-close" id="pmCookieCloseBtn" aria-label="Close cookie settings">&times;</button>' +
        '</div>' +
        '<div class="pm-cookie-dialog-body">' +
          CATEGORIES.map(function (c) { return switchRow(c, current); }).join('') +
        '</div>' +
        '<div class="pm-cookie-dialog-foot">' +
          '<button type="button" class="pm-cookie-btn pm-cookie-btn-outline" id="pmCookieRejectAllBtn">Reject Optional</button>' +
          '<button type="button" class="pm-cookie-btn pm-cookie-btn-solid" id="pmCookieSaveBtn">Save Preferences</button>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var dialog = overlay.querySelector('.pm-cookie-dialog');

    function closeModal() {
      overlay.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      // Re-show the banner if the visitor still hasn't made a first choice.
      if (bannerVisible && !readConsent()) renderBanner();
    }

    function onKeydown(e) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      else trapFocus(dialog, e);
    }

    function save(choice) {
      var previous = readConsent();
      var record = writeConsent(choice);
      removeBanner();
      var revoked = previous && ((previous.analytics && !record.analytics) || (previous.marketing && !record.marketing));
      closeModal();
      if (revoked) {
        // Scripts already running (e.g. AdSense/GA) cannot be reliably torn
        // down from the page they're embedded in — a reload is the only way
        // to guarantee a revoked category actually stops on the next load.
        global.location.reload();
      } else {
        applyConsent(record);
      }
    }

    document.getElementById('pmCookieCloseBtn').addEventListener('click', closeModal);
    document.getElementById('pmCookieRejectAllBtn').addEventListener('click', function () {
      save({ analytics: false, preferences: false, marketing: false });
    });
    document.getElementById('pmCookieSaveBtn').addEventListener('click', function () {
      var choice = {};
      overlay.querySelectorAll('input[data-cat]').forEach(function (input) {
        choice[input.dataset.cat] = input.checked;
      });
      save(choice);
    });
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', onKeydown);

    var firstToggle = dialog.querySelector('input[data-cat]:not([disabled])') || document.getElementById('pmCookieCloseBtn');
    firstToggle.focus();
  }

  global.PMConsent.openSettings = function () { openSettings(document.activeElement, false); };

  function wireFooterLink() {
    document.querySelectorAll('[data-cookie-settings]').forEach(function (link) {
      if (link.__pmWired) return;
      link.__pmWired = true;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        openSettings(link, false);
      });
    });
  }

  function init() {
    var consent = readConsent();
    if (consent) applyConsent(consent);
    else renderBanner();
    wireFooterLink();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
