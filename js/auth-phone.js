/* Phone / WhatsApp one-time-code sign-in for auth.html.
   Shown only when Admin → General Settings → Phone / WhatsApp sign-in is on
   (needs the Phone provider configured in Supabase Auth). Reuses auth.html's
   globals: sbPost, saveSession, showSuccess, showError, setBusy, busy,
   renderTurnstile, getTurnstileToken, resetTurnstile, showIllustration, esc,
   showSignIn. Loaded after auth.html's inline script. */
(function () {
  'use strict';
  var phoneE164 = '';
  var channel = 'whatsapp';

  function normalizeZwPhone(input) {
    var d = String(input || '').replace(/[^\d+]/g, '');
    if (d.charAt(0) === '+') d = d.slice(1);
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.indexOf('263') === 0) d = d.slice(3);
    if (d.charAt(0) === '0') d = d.slice(1);
    var e = '+263' + d;
    return /^\+2637[1378]\d{7}$/.test(e) ? e : null;
  }
  function pretty(e) {
    var m = e.match(/^\+263(\d{2})(\d{3})(\d{4})$/);
    return m ? '+263 ' + m[1] + ' ' + m[2] + ' ' + m[3] : e;
  }

  function header(title) {
    return '<div class="auth-tabs-row"><div><span class="eyebrow">Secure Trade Gate</span><h2 style="margin-top:2px">' + title + '</h2></div></div>';
  }

  function channelButtons() {
    return ['whatsapp', 'sms'].map(function (c) {
      var on = c === channel;
      return '<button type="button" class="social-btn ph-ch" data-ch="' + c + '" aria-pressed="' + on + '" style="flex:1;justify-content:center' +
        (on ? ';border-color:var(--blue);box-shadow:0 0 0 2px rgba(26,58,143,.18)' : '') + '">' + (c === 'whatsapp' ? 'WhatsApp' : 'SMS') + '</button>';
    }).join('');
  }

  window.showPhone = function (anim) {
    showIllustration(false);
    var card = document.getElementById('authCard');
    card.className = 'auth-card slide-' + (anim || 'in');
    card.innerHTML = header('Continue with phone') +
      '<p style="font-size:13px;color:var(--sub);margin:4px 0 14px">We will send a one-time code to your WhatsApp or by SMS. New numbers get a free account.</p>' +
      '<div id="phoneError"></div>' +
      '<div class="fg"><label class="fl" for="phNumber">Mobile number</label>' +
      '<input class="fi" id="phNumber" type="tel" inputmode="tel" autocomplete="tel" placeholder="077 123 4567"></div>' +
      '<div class="fg"><span class="fl">Send my code by</span><div id="phChannels" style="display:flex;gap:8px">' + channelButtons() + '</div></div>' +
      '<div id="turnstilePhone" style="margin:4px 0"></div>' +
      '<button class="auth-btn" id="phSendBtn" type="button">Send code</button>' +
      '<p style="font-size:12px;color:var(--sub);margin-top:12px">By continuing you confirm you are 18+ and agree to our <a href="terms" class="auth-link">Terms</a> and <a href="privacy" class="auth-link">Privacy Policy</a>.</p>' +
      '<div class="auth-switch" style="margin-top:14px"><span class="auth-link" id="phBack">Back to email sign in</span></div>';
    bindChannels();
    document.getElementById('phSendBtn').addEventListener('click', sendCode);
    document.getElementById('phBack').addEventListener('click', function () { showSignIn('in'); });
    document.getElementById('phNumber').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendCode(); });
    renderTurnstile('turnstilePhone', 'ph');
    setTimeout(function () { var el = document.getElementById('phNumber'); if (el) el.focus(); }, 80);
  };

  function bindChannels() {
    var wrap = document.getElementById('phChannels');
    if (!wrap) return;
    wrap.querySelectorAll('.ph-ch').forEach(function (b) {
      b.addEventListener('click', function () {
        channel = b.getAttribute('data-ch');
        wrap.innerHTML = channelButtons();
        bindChannels();
      });
    });
  }

  async function sendCode() {
    if (busy) return;
    var input = document.getElementById('phNumber');
    var e164 = normalizeZwPhone(input && input.value);
    showError('phoneError', '');
    if (!e164) { showError('phoneError', 'Enter a valid Zimbabwe mobile number, e.g. 077 123 4567.'); return; }
    var captcha = getTurnstileToken('ph');
    if (!captcha) { showError('phoneError', 'Please complete the verification check.'); return; }
    setBusy(true);
    var btn = document.getElementById('phSendBtn');
    btn.innerHTML = '<div class="spinner"></div> Sending…';
    try {
      var res = await sbPost('/auth/v1/otp', { phone: e164, channel: channel, create_user: true, gotrue_meta_security: { captcha_token: captcha } });
      resetTurnstile('ph');
      setBusy(false);
      if (!res.ok) {
        var msg = (res.data && (res.data.msg || res.data.error_description || res.data.error)) || 'Could not send the code.';
        if (/database error saving new user/i.test(msg)) {
          msg = 'New sign-ups are paused for a short while. Existing members can still sign in.';
        } else if (channel === 'whatsapp' && /whatsapp|channel/i.test(msg)) {
          channel = 'sms';
          var wrap = document.getElementById('phChannels');
          if (wrap) { wrap.innerHTML = channelButtons(); bindChannels(); }
          msg = 'WhatsApp codes are not available right now. We switched you to SMS, tap Send code again.';
        }
        btn.innerHTML = 'Send code';
        showError('phoneError', msg);
        return;
      }
      phoneE164 = e164;
      showCodeStep();
    } catch (err) {
      setBusy(false);
      btn.innerHTML = 'Send code';
      showError('phoneError', 'Connection error. Please check your internet and try again.');
    }
  }

  function showCodeStep() {
    var card = document.getElementById('authCard');
    card.innerHTML = header('Enter your code') +
      '<p style="font-size:13px;color:var(--sub);margin:4px 0 14px">We sent a 6-digit code by ' + (channel === 'whatsapp' ? 'WhatsApp' : 'SMS') +
      ' to <strong>' + esc(pretty(phoneE164)) + '</strong>.</p>' +
      '<div id="phoneError"></div>' +
      '<div class="fg"><label class="fl" for="phCode">Verification code</label>' +
      '<input class="fi" id="phCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" style="letter-spacing:8px;font-size:20px;text-align:center"></div>' +
      '<button class="auth-btn" id="phVerifyBtn" type="button">Verify and sign in</button>' +
      '<div class="auth-switch" style="margin-top:14px"><span class="auth-link" id="phChange">Use a different number or resend</span></div>';
    var codeEl = document.getElementById('phCode');
    codeEl.addEventListener('input', function () {
      codeEl.value = codeEl.value.replace(/\D/g, '').slice(0, 6);
      if (codeEl.value.length === 6) verify();
    });
    document.getElementById('phVerifyBtn').addEventListener('click', verify);
    document.getElementById('phChange').addEventListener('click', function () { window.showPhone('in'); });
    setTimeout(function () { codeEl.focus(); }, 80);
  }

  async function verify() {
    if (busy) return;
    var token = (document.getElementById('phCode').value || '').trim();
    showError('phoneError', '');
    if (!/^\d{6}$/.test(token)) { showError('phoneError', 'Enter the 6-digit code.'); return; }
    setBusy(true);
    var btn = document.getElementById('phVerifyBtn');
    btn.innerHTML = '<div class="spinner"></div> Verifying…';
    try {
      var res = await sbPost('/auth/v1/verify', { type: 'sms', phone: phoneE164, token: token });
      if (!res.ok || !res.data || !res.data.access_token) {
        setBusy(false);
        btn.innerHTML = 'Verify and sign in';
        showError('phoneError', 'That code is wrong or has expired. Check it, or go back and request a new one.');
        return;
      }
      saveSession(res.data);
      var meta = (res.data.user && res.data.user.user_metadata) || {};
      showSuccess(String(meta.full_name || meta.name || '').split(' ')[0], 'signin');
    } catch (err) {
      setBusy(false);
      btn.innerHTML = 'Verify and sign in';
      showError('phoneError', 'Connection error. Please check your internet and try again.');
    }
  }

  // Reveal the entry button only when admin has switched phone sign-in on.
  window.revealPhoneAuth = function () {
    if (!window.PMContent || !window.PMContent.fetchOpsSettings) return;
    window.PMContent.fetchOpsSettings().then(function (ops) {
      var btn = document.getElementById('phoneAuthBtn');
      if (btn && ops.phoneAuthEnabled === true) btn.style.display = '';
    });
  };
  document.addEventListener('DOMContentLoaded', window.revealPhoneAuth);
})();
