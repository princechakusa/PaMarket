/* Invite links: pamarketzw.com/download?ref=CODE (shared from the app's
   Invite Friends screen). Remembers the code for 30 days so the website
   sign-up form can pre-fill it, and on the download page tells the visitor
   which code to enter when they sign up in the app. */
(function (global) {
  'use strict';
  var KEY = 'pm_ref';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000;

  function clean(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }
  function save(code) {
    try { global.localStorage.setItem(KEY, JSON.stringify({ code: code, at: Date.now() })); } catch (e) {}
  }
  function get() {
    try {
      var raw = JSON.parse(global.localStorage.getItem(KEY) || 'null');
      if (raw && raw.code && Date.now() - raw.at < TTL_MS) return raw.code;
    } catch (e) {}
    return '';
  }

  var fromUrl = '';
  try { fromUrl = clean(new URLSearchParams(global.location.search).get('ref')); } catch (e) {}
  if (fromUrl.length >= 4) save(fromUrl);

  global.PMReferral = { get: get };

  function showBanner() {
    var code = get();
    // auth.html may have drawn its sign-up form before this deferred script
    // ran; fill the invite field now if it is still empty.
    var field = document.getElementById('newInvite');
    if (field && !field.value && code) field.value = code;
    if (!code || !/\/download(?:\.html)?$/.test(global.location.pathname)) return;
    var main = document.querySelector('main') || document.body;
    var box = document.createElement('div');
    box.setAttribute('role', 'status');
    box.style.cssText = 'max-width:720px;margin:20px auto 0;padding:16px 20px;border-radius:14px;background:#FFF8E1;border:1.5px solid #F5A623;color:#0B1B4A;line-height:1.5;font-weight:600';
    box.innerHTML = 'A friend invited you to PaMarket. When you sign up, enter invite code <strong style="letter-spacing:2px;font-size:18px">' +
      code.replace(/[^A-Z0-9]/g, '') + '</strong> so they get a free boost.';
    main.insertBefore(box, main.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
  else showBanner();
})(window);
