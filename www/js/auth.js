/*!
 * PaMarket — Zimbabwe's Free Marketplace
 * © 2026 PaMarket. All rights reserved.
 * Unauthorised copying, modification, distribution or use of this
 * software without written permission from the owner is strictly prohibited.
 */
'use strict';
(function(H) {
  let authBusy = false;

  // Rate limiting — escalating lockout, persisted across reloads so it can't be
  // bypassed by refreshing the page. (Server-side Supabase rate limits are the
  // real backstop; this is defense-in-depth + instant user feedback.)
  function sb() { return (window.supabase && window.supabase.auth) ? window.supabase : null; }

  // ── Cloudflare Turnstile CAPTCHA ───────────────────────────
  // Paste your Turnstile SITE key here (the public one). Leave '' to disable
  // CAPTCHA entirely (logins work as before). When set, you MUST also enable
  // CAPTCHA in Supabase → Authentication → Attack Protection and paste the
  // matching SECRET key there.
  H.TURNSTILE_SITE_KEY = '';

  // Resolve a fresh CAPTCHA token, or null if CAPTCHA is disabled/unavailable.
  // Uses an invisible widget rendered on demand; never hangs the login — a
  // missing widget or timeout resolves null and Supabase decides what to do.
  H._captcha = function() {
    return new Promise(function(resolve) {
      var key = H.TURNSTILE_SITE_KEY;
      if (!key || !window.turnstile) { resolve(null); return; }
      var holder = document.getElementById('cfTurnstileHolder');
      if (!holder) {
        holder = document.createElement('div');
        holder.id = 'cfTurnstileHolder';
        holder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden';
        document.body.appendChild(holder);
      }
      var settled = false;
      var done = function(v){ if (settled) return; settled = true; resolve(v); };
      // Safety net: never block the user more than 12s on the CAPTCHA.
      var timer = setTimeout(function(){ done(null); }, 12000);
      try {
        holder.innerHTML = '';
        var wid = window.turnstile.render(holder, {
          sitekey: key,
          size: 'invisible',
          callback: function(token){ clearTimeout(timer); done(token); },
          'error-callback':   function(){ clearTimeout(timer); done(null); },
          'timeout-callback': function(){ clearTimeout(timer); done(null); }
        });
        if (window.turnstile.execute) window.turnstile.execute(wid);
      } catch(e) { clearTimeout(timer); done(null); }
    });
  };

  function setAuthBusy(v) {
    authBusy = v;
    const r = document.getElementById('authCard');
    if (r) r.querySelectorAll('button').forEach(function(b){ b.disabled = v; });
  }

  var _LOCK_KEY = 'pamarket_auth_lock';
  function _loadLock() {
    try { return JSON.parse(localStorage.getItem(_LOCK_KEY)) || { fails:0, until:0 }; }
    catch(e) { return { fails:0, until:0 }; }
  }
  function _saveLock(v) { try { localStorage.setItem(_LOCK_KEY, JSON.stringify(v)); } catch(e) {} }

  function isLocked() {
    var L = _loadLock();
    if (Date.now() < L.until) {
      var secs = Math.ceil((L.until - Date.now()) / 1000);
      H.toast('Too many attempts. Try again in ' + secs + 's', 4000, true);
      return true;
    }
    return false;
  }

  function recordFailure() {
    var L = _loadLock();
    L.fails = (L.fails || 0) + 1;
    // Escalate: 5→30s, 10→2m, 15→10m, 20+→30m
    if (L.fails >= 20)      L.until = Date.now() + 30 * 60000;
    else if (L.fails >= 15) L.until = Date.now() + 10 * 60000;
    else if (L.fails >= 10) L.until = Date.now() + 2  * 60000;
    else if (L.fails >= 5)  L.until = Date.now() + 30000;
    if (L.fails >= 5) {
      var mins = Math.round((L.until - Date.now()) / 60000);
      var secs = Math.round((L.until - Date.now()) / 1000);
      H.toast('Too many failed attempts. Locked for ' + (secs < 90 ? secs + ' seconds' : mins + ' minutes') + '.', 5000, true);
    }
    _saveLock(L);
  }

  function recordSuccess() {
    _saveLock({ fails:0, until:0 });
  }

  function validateEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  }

  function validatePhone(p) {
    if (!p) return true;
    return /^(\+263|0)[0-9]{9}$/.test(p.replace(/\s/g,''));
  }

  function passwordStrength(p) {
    var s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (s <= 1) return { label:'Weak',   color:'#ef4444', width:'25%'  };
    if (s <= 2) return { label:'Fair',   color:'#f97316', width:'50%'  };
    if (s <= 3) return { label:'Good',   color:'#eab308', width:'75%'  };
    return          { label:'Strong', color:'#22c55e', width:'100%' };
  }

  var STR_COLORS = ['#D92D20','#F59E0B','#F5A623','#12B76A'];
  var STR_LABELS = ['Weak','Fair','Good','Strong'];

  function updatePassStrength() {
    var p   = document.getElementById('newPass');
    var lbl = document.getElementById('passStrengthLabel');
    if (!p) return;
    var segs = [document.getElementById('str0'),document.getElementById('str1'),document.getElementById('str2'),document.getElementById('str3')];
    if (!p.value) {
      segs.forEach(function(s){ if(s) s.style.background=''; });
      if (lbl) { lbl.textContent=''; lbl.style.color=''; }
      return;
    }
    var s = passwordStrength(p.value);
    var lvl = s.label==='Weak'?0:s.label==='Fair'?1:s.label==='Good'?2:3;
    segs.forEach(function(seg,i){ if(seg) seg.style.background = i<=lvl ? STR_COLORS[lvl] : ''; });
    if (lbl) { lbl.textContent=STR_LABELS[lvl]; lbl.style.color=STR_COLORS[lvl]; }
    // keep legacy passStrengthBar working if it exists
    var bar = document.getElementById('passStrengthBar');
    if (bar) { bar.style.width=s.width; bar.style.background=s.color; }
  }
  H._updatePassStrength = updatePassStrength;

  H.authLogoTap = function() {
    H.logoTap && H.logoTap();
  };

  var GSVG = '<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';
  var EYESVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

  function setLmBack(fn) {
    var btn = document.getElementById('lmBackBtn');
    if (!btn) return;
    btn.onclick = fn || function(){ H.closeLoginModal(); };
  }

  H.authStepEmail = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    setLmBack(null);
    card.innerHTML = ''
      + '<div class="lm-heading">Welcome back</div>'
      + '<div class="lm-sub">Sign in to continue buying and selling</div>'
      + '<button class="auth-social-btn" onclick="H.authGoogle()">' + GSVG + 'Continue with Google</button>'
      + '<div class="auth-divider"><span>or continue with email</span></div>'
      + '<div class="lm-fg"><label class="lm-label">Email address</label><input class="lm-input" id="emailIn" type="email" placeholder="you@example.com" autocomplete="email" inputmode="email"></div>'
      + '<div class="lm-fg"><div class="lm-label-row"><label class="lm-label" style="margin:0">Password</label><span class="lm-forgot" onclick="H.authForgotPassword()">Forgot?</span></div>'
      + '<div class="lm-input-wrap"><input class="lm-input" id="passIn" type="password" placeholder="Your password" onkeydown="if(event.key===\'Enter\')H.authSignIn()" autocomplete="current-password"><button type="button" class="lm-eye" onclick="H._toggleLmPw(\'passIn\',this)">' + EYESVG + '</button></div></div>'
      + '<div id="authErrBanner" style="display:none" class="auth-error-banner"><svg viewBox="0 0 20 20" width="18" height="18" fill="#D92D20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg><p id="authErrText"></p></div>'
      + '<div id="authWarnBanner" style="display:none" class="auth-warn-banner"></div>'
      + '<button class="auth-btn" onclick="H.authSignIn()">Sign In</button>'
      + '<div class="lm-foot-link">Don\'t have an account? <span onclick="H.authShowRegister()">Create one</span></div>';
    setTimeout(function(){ var e=document.getElementById('emailIn'); if(e) e.focus(); }, 80);
  };

  H.authShowEmailForm = function() { H.authStepEmail(); };

  H.authShowRegister = function() { H.authStepSignUp(); };

  H._toggleLmPw = function(id, btn) {
    var inp = document.getElementById(id);
    if (!inp) return;
    var isText = inp.type === 'text';
    inp.type = isText ? 'password' : 'text';
    if (btn) btn.style.color = isText ? '' : '#1A3A8F';
  };

  H._showAuthError = function(msg) {
    var b = document.getElementById('authErrBanner');
    var t = document.getElementById('authErrText');
    if (b) b.style.display = 'flex';
    if (t) t.textContent = msg;
  };
  H._hideAuthError = function() {
    var b = document.getElementById('authErrBanner');
    if (b) b.style.display = 'none';
  };
  H._showAuthWarn = function(msg) {
    var b = document.getElementById('authWarnBanner');
    if (b) { b.style.display = ''; b.textContent = msg; }
  };

  H.authShow2FA = function(userId) {
    H._pendingTwoFactorUserId = userId;
    var card = document.getElementById('authCard');
    if (!card) {
      H.requireAuth && H.requireAuth('Two-factor authentication');
      card = document.getElementById('authCard');
    }
    if (!card) return;
    setLmBack(H.authCancel2FA);
    card.innerHTML = ''
      + '<div class="lm-icon" style="background:#EEF2FF"><svg viewBox="0 0 32 32" width="28" height="28" fill="none"><rect x="6" y="13" width="20" height="16" rx="3" stroke="#1A3A8F" stroke-width="1.8"/><path d="M10 13V9a6 6 0 0112 0v4" stroke="#1A3A8F" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="21" r="2" fill="#1A3A8F"/></svg></div>'
      + '<div class="lm-heading" style="text-align:center;font-size:22px">Two-factor auth</div>'
      + '<div class="lm-sub" style="text-align:center">Open your authenticator app and enter the 6-digit code for PaMarket.</div>'
      + '<div class="lm-fg"><label class="lm-label">Authentication code</label><input class="lm-input" id="twoFactorLoginCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" style="text-align:center;letter-spacing:6px;font-size:20px;font-weight:800"></div>'
      + '<button class="auth-btn" onclick="H.authVerify2FA()">Verify &amp; Continue</button>'
      + '<button class="auth-btn secondary" style="margin-top:8px" onclick="H.authCancel2FA()">Cancel</button>';
    setTimeout(function(){ var e=document.getElementById('twoFactorLoginCode'); if(e) e.focus(); }, 100);
  };

  H.authCancel2FA = async function() {
    H._pendingTwoFactorUserId = null;
    H.state.currentUserId = null;
    H.saveState();
    try { if (window.supabase && window.supabase.auth) await window.supabase.auth.signOut(); } catch(e) {}
    if (H.closeLoginModal) H.closeLoginModal();
  };

  H.authVerify2FA = async function() {
    var userId = H._pendingTwoFactorUserId;
    var code = ((document.getElementById('twoFactorLoginCode') || {}).value || '').trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) { H.toast('Enter the 6-digit code from your authenticator'); return; }
    var c = sb();
    if (!c) { H.toast('Connection error — try again'); return; }
    // Always fetch 2FA status fresh from Supabase — never trust localStorage state
    var pr = await c.from('profiles').select('two_factor_enabled,two_factor_secret').eq('id', userId).single();
    if (pr.error || !pr.data || !pr.data.two_factor_enabled || !pr.data.two_factor_secret) {
      H.toast('2FA setup not found');
      return;
    }
    if (!H._twoFactorVerify || !await H._twoFactorVerify(pr.data.two_factor_secret, code)) {
      H.toast('Invalid authentication code');
      return;
    }
    H._pendingTwoFactorUserId = null;
    H.state.currentUserId = userId;
    H.saveState();
    if (H.closeLoginModal) H.closeLoginModal();
    H.boot();
  };

  H.authStepSignUp = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    setLmBack(H.authStepEmail);
    card.innerHTML = ''
      + '<div class="lm-heading">Create account</div>'
      + '<div class="lm-sub">Join Zimbabwe\'s largest marketplace</div>'
      + '<button class="auth-social-btn" onclick="H.authGoogle()">' + GSVG + 'Sign up with Google</button>'
      + '<div class="auth-divider"><span>or use email</span></div>'
      + '<div class="lm-fg"><label class="lm-label">Full name</label><input class="lm-input" id="newName" placeholder="e.g. Tendai Moyo" autocomplete="name"></div>'
      + '<div class="lm-fg"><label class="lm-label">Email address</label><input class="lm-input" id="newEmail" type="email" placeholder="you@example.com" autocomplete="email"></div>'
      + '<div class="lm-fg"><label class="lm-label">Phone <span style="font-weight:400;color:var(--text-hint)">(optional)</span></label><input class="lm-input" id="newPhone" type="tel" placeholder="+263 77 123 4567" autocomplete="tel"></div>'
      + '<div class="lm-fg"><label class="lm-label">Password</label>'
      + '<div class="lm-input-wrap"><input class="lm-input" id="newPass" type="password" placeholder="8+ chars, uppercase &amp; number" oninput="H._updatePassStrength()" autocomplete="new-password"><button type="button" class="lm-eye" onclick="H._toggleLmPw(\'newPass\',this)">' + EYESVG + '</button></div>'
      + '<div class="lm-strength"><div class="lm-strength-seg" id="str0"></div><div class="lm-strength-seg" id="str1"></div><div class="lm-strength-seg" id="str2"></div><div class="lm-strength-seg" id="str3"></div></div>'
      + '<div class="lm-strength-lbl" id="passStrengthLabel"></div></div>'
      + '<div class="lm-fg"><label class="lm-label">Confirm password</label><div class="lm-input-wrap"><input class="lm-input" id="newPass2" type="password" placeholder="Re-enter password" autocomplete="new-password"><button type="button" class="lm-eye" onclick="H._toggleLmPw(\'newPass2\',this)">' + EYESVG + '</button></div></div>'
      + '<label style="display:flex;gap:10px;align-items:flex-start;font-size:12px;color:var(--text-sub);margin-bottom:14px;cursor:pointer;line-height:1.5"><input id="ageConsent" type="checkbox" style="margin-top:2px;flex-shrink:0;accent-color:#1A3A8F"><span>I am 18+ and agree to <span onclick="event.stopPropagation();H.authShowDoc(\'terms\')" style="color:#1A3A8F;font-weight:600;cursor:pointer">Terms &amp; Conditions</span> and <span onclick="event.stopPropagation();H.authShowDoc(\'privacy\')" style="color:#1A3A8F;font-weight:600;cursor:pointer">Privacy Policy</span></span></label>'
      + '<button class="auth-btn" onclick="H.authSignUp()">Create Account</button>'
      + '<div class="lm-foot-link" style="margin-bottom:8px">Already have an account? <span onclick="H.authStepEmail()">Sign in</span></div>';
    setTimeout(function(){ var e=document.getElementById('newName'); if(e) e.focus(); }, 80);
  };

  H.authShowOtp = function(email) {
    var card = document.getElementById('authCard');
    if (!card) return;
    H._otpEmail = email;
    setLmBack(H.authStepEmail);
    var masked = email ? email.replace(/^(.)(.*)(@.+)$/, function(_,a,b,c){ return a + b.replace(/./g,'*').slice(0,6) + c; }) : '';
    card.innerHTML = ''
      + '<div class="lm-icon" style="margin-top:20px"><svg viewBox="0 0 36 36" width="32" height="32" fill="none"><rect x="4" y="2" width="28" height="32" rx="5" stroke="#1A3A8F" stroke-width="1.8"/><rect x="11" y="28" width="14" height="2" rx="1" fill="#1A3A8F" fill-opacity=".3"/><path d="M10 14h16M10 19h11" stroke="#1A3A8F" stroke-width="1.8" stroke-linecap="round"/></svg></div>'
      + '<div class="lm-heading" style="text-align:center;font-size:22px;margin-top:16px">Verify your email</div>'
      + '<div class="lm-sub" style="text-align:center">Enter the 6-digit code sent to<br><strong style="color:var(--text-primary)">' + H.escHtml(masked) + '</strong></div>'
      + '<div class="otp-boxes">'
      + [0,1,2,3,4,5].map(function(i){ return '<input class="otp-box-in" id="otp'+i+'" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" autocomplete="'+(i===0?'one-time-code':'off')+'" onclick="this.select()">'; }).join('')
      + '</div>'
      + '<div style="text-align:center;font-size:12px;color:var(--text-hint);margin-bottom:8px">Code submits automatically on last digit</div>'
      + '<div style="text-align:center;margin-top:4px;font-size:13px;color:var(--text-sub)">Didn\'t get it? <span onclick="H.authResendOtp()" style="color:#1A3A8F;font-weight:700;cursor:pointer">Resend code</span></div>'
      + '<div style="text-align:center;margin-top:4px;font-size:11px;color:var(--text-hint)">Check spam if not received within 2 minutes</div>'
      + '<button class="auth-btn" id="otpSubmitBtn" onclick="H.authVerifyOtp()" style="margin-top:20px" disabled>Verify Email</button>';
    setTimeout(function(){ H._initOtpBoxes(); }, 80);
  };

  H._initOtpBoxes = function() {
    var inputs = [0,1,2,3,4,5].map(function(i){ return document.getElementById('otp'+i); }).filter(Boolean);
    if (!inputs.length) return;
    inputs[0] && inputs[0].focus();
    inputs.forEach(function(inp, idx) {
      inp.addEventListener('input', function(e) {
        var v = inp.value.replace(/\D/g,'');
        inp.value = v ? v[0] : '';
        if (v) {
          inp.classList.add('otp-filled');
          if (idx < 5) inputs[idx+1].focus();
        } else {
          inp.classList.remove('otp-filled');
        }
        var full = inputs.map(function(x){ return x.value; }).join('');
        var btn = document.getElementById('otpSubmitBtn');
        if (btn) btn.disabled = full.length < 6;
        if (full.length === 6) setTimeout(H.authVerifyOtp, 120);
      });
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !inp.value && idx > 0) {
          inputs[idx-1].focus(); inputs[idx-1].value=''; inputs[idx-1].classList.remove('otp-filled');
        }
        if (e.key === 'ArrowLeft' && idx > 0) inputs[idx-1].focus();
        if (e.key === 'ArrowRight' && idx < 5) inputs[idx+1].focus();
      });
      inp.addEventListener('paste', function(e) {
        e.preventDefault();
        var pasted = (e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
        pasted.split('').forEach(function(ch,i){ if(inputs[idx+i]){ inputs[idx+i].value=ch; inputs[idx+i].classList.add('otp-filled'); } });
        var next = Math.min(idx + pasted.length, 5);
        inputs[next].focus();
        var full = inputs.map(function(x){ return x.value; }).join('');
        var btn = document.getElementById('otpSubmitBtn');
        if (btn) btn.disabled = full.length < 6;
        if (full.length === 6) setTimeout(H.authVerifyOtp, 120);
      });
    });
  };

  H.authVerifyOtp = async function() {
    var otp = [0,1,2,3,4,5].map(function(i){ var el=document.getElementById('otp'+i); return el?el.value:''; }).join('').trim();
    if (!otp) { var old=((document.getElementById('otpIn')||{}).value||'').trim(); if(old) otp=old; }
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) { H.toast('Enter the 6-digit code from your email'); return; }
    var c = sb();
    if (!c) { H.toast('Connection error — try again'); return; }
    setAuthBusy(true);
    var res = await c.auth.verifyOtp({ email: H._otpEmail, token: otp, type: 'signup' });
    if (res.error) { H.toast('Invalid or expired code. Try resending.'); setAuthBusy(false); return; }
    H.state.currentUserId = res.data.user.id;
    await H.loadProfile(res.data.user.id);
    H.saveState();
    setAuthBusy(false);
    H.toast('Email verified! Welcome to PaMarket');
    if (H.closeLoginModal) H.closeLoginModal();
    H.boot();
  };

  H.authResendOtp = async function() {
    if (!H._otpEmail) return;
    var now = Date.now();
    H._otpResendTimes = (H._otpResendTimes || []).filter(function(t){ return now - t < 10 * 60 * 1000; });
    if (H._otpResendTimes.length >= 3) {
      var waitSec = Math.ceil((10 * 60 * 1000 - (now - H._otpResendTimes[0])) / 1000);
      H.toast('Too many resends — try again in ' + waitSec + 's', 4000, true);
      return;
    }
    H._otpResendTimes.push(now);
    var c = sb();
    if (!c) { H.toast('Connection error', 4000, true); return; }
    var capTok = await H._captcha();
    var res = await c.auth.resend({ type: 'signup', email: H._otpEmail, options: capTok ? {captchaToken: capTok} : {} });
    H.toast(res.error ? res.error.message : 'Code resent — check your inbox');
  };

  H.authForgotPassword = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    setLmBack(H.authStepEmail);
    card.innerHTML = ''
      + '<div class="lm-icon" style="background:#EEF2FF"><svg viewBox="0 0 36 36" width="32" height="32" fill="none"><circle cx="18" cy="18" r="13" stroke="#1A3A8F" stroke-width="1.8"/><path d="M12 16l5.5 5.5 9-9" stroke="#1A3A8F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'
      + '<div class="lm-heading" style="text-align:center;font-size:22px;margin-top:16px">Reset password</div>'
      + '<div class="lm-sub" style="text-align:center">Enter your email and we\'ll send a reset link</div>'
      + '<div class="lm-fg"><label class="lm-label">Email address</label><input class="lm-input" id="resetEmail" type="email" placeholder="you@example.com" autocomplete="email" onkeydown="if(event.key===\'Enter\')H.authSendReset()"></div>'
      + '<button class="auth-btn" onclick="H.authSendReset()">Send Reset Link</button>'
      + '<div class="lm-foot-link">Remembered it? <span onclick="H.authStepEmail()">Sign in</span></div>';
    setTimeout(function(){ var e=document.getElementById('resetEmail'); if(e) e.focus(); }, 80);
  };

  H.authSendReset = async function() {
    var email = ((document.getElementById('resetEmail')||{}).value||'').trim();
    if (!validateEmail(email)) { H.toast('Enter a valid email address'); return; }
    // Throttle reset requests: max 3 per 10 minutes, and 60s between sends, to
    // stop someone spamming a victim's inbox with reset emails.
    var now = Date.now();
    H._resetTimes = (H._resetTimes || []).filter(function(t){ return now - t < 10 * 60 * 1000; });
    if (H._resetTimes.length && now - H._resetTimes[H._resetTimes.length - 1] < 60000) {
      var waitS = Math.ceil((60000 - (now - H._resetTimes[H._resetTimes.length - 1])) / 1000);
      H.toast('Please wait ' + waitS + 's before requesting another reset', 4000, true); return;
    }
    if (H._resetTimes.length >= 3) {
      var waitM = Math.ceil((10 * 60 * 1000 - (now - H._resetTimes[0])) / 60000);
      H.toast('Too many reset requests — try again in ' + waitM + ' min', 4000, true); return;
    }
    H._resetTimes.push(now);
    var c = sb();
    if (!c) { H.toast('Connection error — try again'); return; }
    setAuthBusy(true);
    var capTok = await H._captcha();
    var res = await c.auth.resetPasswordForEmail(email, capTok ? {captchaToken: capTok} : {});
    setAuthBusy(false);
    if (res.error) { H.toast(res.error.message); return; }
    var card = document.getElementById('authCard');
    if (!card) return;
    setLmBack(H.authStepEmail);
    card.innerHTML = ''
      + '<div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:24px 0 8px">'
      + '<div style="width:72px;height:72px;border-radius:50%;background:#DCFCE7;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg viewBox="0 0 32 32" width="36" height="36" fill="none"><path d="M8 16l5.5 5.5 11-11" stroke="#12B76A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--text-primary);letter-spacing:-.4px">Check your email</div>'
      + '<div style="font-size:14px;color:var(--text-sub);margin-top:8px;line-height:1.6">Reset link sent to<br><strong style="color:var(--text-primary)">' + H.escHtml(email) + '</strong></div>'
      + '<div style="font-size:12px;color:var(--text-hint);margin-top:8px">Check your spam folder if you don\'t see it</div>'
      + '</div>'
      + '<button class="auth-btn" style="margin-top:8px" onclick="H.authStepEmail()">Back to Sign In</button>';
  };

  H.authSignIn = async function() {
    if (authBusy) return;
    if (isLocked()) return;
    H._hideAuthError && H._hideAuthError();
    var emailEl = document.getElementById('emailIn');
    var passEl  = document.getElementById('passIn');
    var email    = emailEl ? emailEl.value.trim() : '';
    var password = passEl  ? passEl.value : '';
    if (!validateEmail(email)) { H._showAuthError ? H._showAuthError('Enter a valid email address') : H.toast('Enter a valid email address'); return; }
    if (!password) { H._showAuthError ? H._showAuthError('Enter your password') : H.toast('Enter your password'); return; }
    setAuthBusy(true);
    var c = sb();
    if (c) {
      var capTok = await H._captcha();
      var res = await c.auth.signInWithPassword({email:email, password:password, options: capTok ? {captchaToken: capTok} : {}});
      if (res.error) {
        var msg = res.error.message;
        if (msg==='Invalid login credentials') msg = 'Wrong email or password. Please try again.';
        if (msg.includes('Email not confirmed')) msg = 'Please verify your email first';
        recordFailure();
        if (H._showAuthError) H._showAuthError(msg); else H.toast(msg);
        setAuthBusy(false); return;
      }
      H.state.currentUserId = res.data.user.id;
      await H.loadProfile(res.data.user.id);
      // 2FA state is loaded from Supabase inside loadProfile (two_factor_enabled column)
      var su = H.currentUser();
      if (su && su.twoFactorEnabled && su.twoFactorSecret) {
        // Hold the Supabase session but clear local currentUserId until 2FA is verified
        H._pendingTwoFactorUserId = res.data.user.id;
        H.state.currentUserId = null;
        H.saveState();
        setAuthBusy(false);
        H.authShow2FA(res.data.user.id);
        return;
      }
      recordSuccess();
      H.saveState();
      setAuthBusy(false);
      if (H.closeLoginModal) H.closeLoginModal();
      H.boot();
      return;
    }
    // Supabase unavailable — never fall back to local credentials
    if (H._showAuthError) H._showAuthError('Connection error — check your internet and try again.');
    else H.toast('Connection error — check your internet and try again.');
    setAuthBusy(false);
  };

  H.authSignUp = async function() {
    if (authBusy) return;
    if (H.state && H.state.signupPaused) {
      H.toast('New sign-ups are temporarily paused. Please try again later.', 5000, true);
      return;
    }
    var name      = document.getElementById('newName').value.trim();
    var email     = document.getElementById('newEmail').value.trim();
    var phone     = document.getElementById('newPhone').value.trim();
    var password  = document.getElementById('newPass').value;
    var password2 = document.getElementById('newPass2').value;
    var consent   = document.getElementById('ageConsent').checked;

    if (name.length < 2)           { H.toast('Enter your full name'); return; }
    if (!validateEmail(email))     { H.toast('Enter a valid email address'); return; }
    if (!validatePhone(phone))     { H.toast('Enter a valid Zimbabwe phone number (+263 or 07X)'); return; }
    if (password.length < 8)       { H.toast('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(password))   { H.toast('Password must include at least one uppercase letter'); return; }
    if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) {
      H.toast('Password must include a number or special character'); return;
    }
    if (password !== password2)    { H.toast('Passwords do not match'); return; }
    if (!consent)                  { H.toast('Please confirm you are 18+ and agree to our policies'); return; }

    setAuthBusy(true);
    var c = sb();
    if (c) {
      var capTok = await H._captcha();
      var res = await c.auth.signUp({email:email, password:password, options: Object.assign({data:{full_name:name}}, capTok ? {captchaToken: capTok} : {})});
      if (res.error) {
        var msg = res.error.message;
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('unique constraint')) {
          msg = 'Email already registered. Sign in instead.';
        }
        H.toast(msg); setAuthBusy(false); return;
      }
      // When "Confirm email" is enabled, Supabase does NOT error on a duplicate
      // email (to avoid leaking who's registered) — instead it returns a user
      // with an empty identities array. Treat that as already-registered so a
      // second signup can't silently shadow an existing account.
      if (res.data && res.data.user && Array.isArray(res.data.user.identities) && res.data.user.identities.length === 0) {
        H.toast('Email already registered. Sign in instead.'); setAuthBusy(false); return;
      }
      var userId = res.data.user.id;
      await c.from('profiles').upsert({id:userId, name:name, phone:phone||null, verified:false});
      var u = {id:userId,email:email,name:name,phone:phone||'',avatar:null,verified:false,language:'English',joinedAt:Date.now(),role:'user',status:'active',banReason:null,banUntil:null,blocked:[]};
      (H.state.users = H.state.users||[]).push(u);
      H.state.currentUserId = userId;
      H.saveState();
      setAuthBusy(false);
      if (res.data.session) {
        H.toast('Account created! Welcome to PaMarket');
        if (H.closeLoginModal) H.closeLoginModal();
        H.boot();
      } else {
        H.authShowOtp(email);
      }
      return;
    }
    // Supabase unavailable — never create accounts locally
    H.toast('Connection error — check your internet and try again.');
    setAuthBusy(false);
  };

  H.authAdminPage = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    setLmBack(H.authStepEmail);
    card.innerHTML = ''
      + '<div class="lm-icon" style="background:#FEE4E2"><svg viewBox="0 0 32 32" width="28" height="28" fill="none"><rect x="6" y="13" width="20" height="16" rx="3" stroke="#D92D20" stroke-width="1.8"/><path d="M10 13V9a6 6 0 0112 0v4" stroke="#D92D20" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="21" r="2" fill="#D92D20"/></svg></div>'
      + '<div class="lm-heading" style="text-align:center;font-size:22px;margin-top:16px">Admin Portal</div>'
      + '<div class="lm-sub" style="text-align:center">Restricted access — authorised personnel only</div>'
      + '<div class="lm-fg"><label class="lm-label">Admin email</label><input class="lm-input" id="admEmailPage" type="email" autocomplete="username" placeholder="admin@pamarket.app"></div>'
      + '<div class="lm-fg"><label class="lm-label">Password</label><div class="lm-input-wrap"><input class="lm-input" id="admPassPage" type="password" placeholder="Password" onkeydown="if(event.key===\'Enter\')H.authAdminSignInPage()" autocomplete="current-password"><button type="button" class="lm-eye" onclick="H._toggleLmPw(\'admPassPage\',this)">' + EYESVG + '</button></div></div>'
      + '<button class="auth-btn" onclick="H.authAdminSignInPage()">Admin Sign In</button>';
    setTimeout(function(){ var p=document.getElementById('admEmailPage'); if(p) p.focus(); }, 80);
  };

  H.authAdminSignInPage = async function() {
    if (isLocked()) return;
    var email = ((document.getElementById('admEmailPage')||{}).value||'').trim();
    var pass  = ((document.getElementById('admPassPage')||{}).value||'').trim();
    if (!email||!pass) { H.toast('Enter credentials'); return; }
    var c = sb();
    if (!c) { H.toast('Connection error - refresh page'); return; }
    H.toast('Signing in...');
    var capTok = await H._captcha();
    var res = await c.auth.signInWithPassword({email:email, password:pass, options: capTok ? {captchaToken: capTok} : {}});
    if (res.error) { recordFailure(); H.toast('Invalid credentials'); return; }
    H.state.currentUserId = res.data.user.id;
    await H.loadProfile(res.data.user.id);
    var cu = H.currentUser();
    if (!cu || cu.role !== 'admin') {
      if (c) { try { await c.auth.signOut(); } catch(e) {} }
      H.state.currentUserId = null;
      recordFailure();
      H.toast('Access denied. Not an admin account.');
      return;
    }
    recordSuccess();
    H.state.adminSession = {at:Date.now(),via:'supabase'};
    H.saveState();
    H.toast('Welcome Admin!');
    if (H.closeLoginModal) H.closeLoginModal();
    H.boot();
  };

  H.loadProfile = async function(userId) {
    try {
    var c = sb(); if (!c) return;
    var res = await c.from('profiles').select('*').eq('id',userId).single();
    if (res.error||!res.data) {
      var u = (H.state.users||[]).find(function(x){return x.id===userId;});
      if (!u) { u={id:userId,email:'',name:'User',phone:'',avatar:null,verified:false,language:'English',joinedAt:Date.now(),role:'user',status:'active',banReason:null,banUntil:null,blocked:[]}; (H.state.users = H.state.users || []).push(u); }
      return;
    }
    var profile = res.data;
    var u = (H.state.users||[]).find(function(x){return x.id===userId;});
    if (!u) {
      u = {id:userId,email:profile.email||'',name:profile.name||'User',phone:profile.phone||'',avatar:profile.avatar||null,verified:profile.verified||false,verificationPending:!!profile.verification_pending,verification_pending:!!profile.verification_pending,language:profile.language||'English',joinedAt:new Date(profile.created_at||Date.now()).getTime(),role:profile.role||'user',status:'active',banReason:null,banUntil:null,blocked:[]};
      (H.state.users = H.state.users || []).push(u);
    } else {
      u.name=profile.name||u.name; u.phone=profile.phone||u.phone; u.avatar=profile.avatar||u.avatar; u.verified=profile.verified||false; u.role=profile.role||u.role||'user';
      if (profile.email) u.email = profile.email;
      // Keep verification status in sync so an admin approval/rejection reflects in the app
      u.verificationPending = !!profile.verification_pending; u.verification_pending = !!profile.verification_pending;
      if (profile.company_verified != null) { u.companyVerified = profile.company_verified; u.company_verified = profile.company_verified; }
      if (profile.company_verification_pending != null) { u.companyVerificationPending = profile.company_verification_pending; u.company_verification_pending = profile.company_verification_pending; }
      // Merge job profile fields from Supabase if they exist (after migrations are run)
      if (profile.job_title    != null) u.jobTitle       = profile.job_title;
      if (profile.job_types    != null) u.jobTypes        = profile.job_types;
      if (profile.sector       != null) u.sector          = profile.sector;
      if (profile.exp          != null) u.exp             = profile.exp;
      if (profile.city         != null) u.city            = profile.city;
      if (profile.bio          != null) u.bio             = profile.bio;
      if (profile.skills       != null) u.skills          = profile.skills;
      if (profile.open_to_work != null) u.openToWork      = profile.open_to_work;
      if (profile.expected_salary   != null) u.expectedSalary  = profile.expected_salary;
      if (profile.whatsapp_number   != null) u.whatsappFull    = profile.whatsapp_number;
      if (profile.phone_for_calls   != null) u.phoneForCalls   = profile.phone_for_calls;
      if (profile.contact_method    != null) u.contactMethod   = profile.contact_method;
      if (profile.contact_availability != null) u.contactAvail = profile.contact_availability;
      if (profile.linkedin_url  != null) u.linkedinUrl    = profile.linkedin_url;
      if (profile.github_url    != null) u.githubUrl      = profile.github_url;
      if (profile.website_url   != null) u.websiteUrl     = profile.website_url;
      if (profile.cv_file_url       != null) u.cvFileUrl        = profile.cv_file_url;
      if (profile.cv_file_name      != null) u.cvFileName       = profile.cv_file_name;
      if (profile.cv                != null) u.cv               = profile.cv;
      // 2FA state — always sourced from Supabase, never overridden by local state
      if (profile.two_factor_enabled != null) u.twoFactorEnabled = !!profile.two_factor_enabled;
      if (profile.two_factor_secret  != null) u.twoFactorSecret  = profile.two_factor_secret;
    }
    H.saveState();
    } catch(e) { console.warn('loadProfile:', e && e.message); }
  };

  H.logout = function() {
    H.modal({
      title: 'Sign Out',
      body: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      danger: true,
      onConfirm: function() {
        H.state.currentUserId = null;
        H.state.adminSession = null;
        H.saveState();
        if (window._msgBadgeInterval) { clearInterval(window._msgBadgeInterval); window._msgBadgeInterval = null; }
        var reload = function() { window.location.reload(); };
        try {
          var sc = window.supabase;
          if (sc) {
            if (window._msgChannel) { sc.removeChannel(window._msgChannel); window._msgChannel = null; }
            if (H._notifChannel)    { sc.removeChannel(H._notifChannel);    H._notifChannel    = null; }
            if (sc.auth) {
              // Wait for signOut to clear Supabase session from localStorage before reloading
              sc.auth.signOut().then(reload).catch(reload);
              return;
            }
          }
        } catch(e) {}
        reload();
      }
    });
  };

  async function _finishOAuthLogin(c, session) {
    const user   = session.user;
    const userId = user.id;
    const meta   = user.user_metadata || {};
    const name   = meta.full_name || meta.name || user.email || 'User';
    const avatar = meta.avatar_url || meta.picture || null;
    const email  = user.email || '';
    try {
      const { data: existing } = await c.from('profiles').select('id').eq('id', userId).single();
      if (!existing) { await c.from('profiles').upsert({ id: userId, name: name, avatar: avatar, email: email || null }); }
      else if (email) { c.from('profiles').update({ email: email }).eq('id', userId).then(function(){}, function(){}); }
    } catch(pe) {}
    try { await H.loadProfile(userId); } catch(pe) {}
    // Ensure the login email is on the local user (Google sign-ins).
    try { const _u = (H.state.users||[]).find(function(x){return x.id===userId;}); if (_u && email && !_u.email) _u.email = email; } catch(pe) {}
    H.state.currentUserId = userId;
    H.saveState();
    if (H.closeLoginModal) H.closeLoginModal();
    H.boot();
  }

  // Canonical nonce helpers for native Google sign-in with Supabase:
  // a random raw nonce is hashed (SHA-256) and given to Google; Supabase is given
  // the raw nonce and re-hashes it to match the token's nonce claim.
  function _randNonce() {
    var a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues && window.crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  async function _sha256Hex(str) {
    var buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  async function _oauthInCap(c, provider) {
    // Reliable mobile OAuth: open the provider's sign-in in an in-app browser tab,
    // then return to the app via the com.pamarket.app://login-callback deep link.
    // Uses the provider configured in the Supabase dashboard — no native SDK or
    // SHA-1 dependency, so it can't hang the way the native token flow did.
    const Browser = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
    const App     = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;

    if (Browser && App) {
      // Force Google to show its account picker every time, so a user who signed
      // out can choose a different account instead of being put straight back into
      // the one they last used.
      const _capOpts = { redirectTo: 'com.pamarket.app://login-callback', skipBrowserRedirect: true };
      if (provider === 'google') _capOpts.queryParams = { prompt: 'select_account', access_type: 'offline' };
      const { data, error } = await c.auth.signInWithOAuth({
        provider: provider,
        options: _capOpts
      });
      if (error) { H.toast(error.message || 'Sign-in failed', 6000, true); return; }
      if (!data || !data.url) { H.toast('Could not start sign-in', 5000, true); return; }

      let urlListener;
      const onUrl = async function (event) {
        if (!event || !event.url || event.url.indexOf('login-callback') === -1) return;
        try { await urlListener.remove(); } catch (e) {}
        try { if (Browser.close) await Browser.close(); } catch (e) {}
        try {
          const url = new URL(event.url);
          const errDesc = url.searchParams.get('error_description') || url.searchParams.get('error');
          if (errDesc) { H.toast('Google: ' + errDesc, 7000, true); return; }
          const code = url.searchParams.get('code');
          const finish = async (session) => {
            try { await _finishOAuthLogin(c, session); }
            catch (fe) { H.toast('Signed in, but loading profile failed: ' + ((fe && fe.message) || ''), 6000, true); try { window.location.reload(); } catch (e2) {} }
          };
          if (code) {
            const { data: exData, error: ex } = await c.auth.exchangeCodeForSession(code);
            if (ex) { H.toast('Google: ' + ex.message, 7000, true); return; }
            if (exData && exData.session) { await finish(exData.session); return; }
          }
          // No code (or implicit flow): fall back to whatever session is now stored.
          const { data: sd } = await c.auth.getSession();
          if (sd && sd.session) { await finish(sd.session); return; }
          H.toast('Sign-in did not complete. Please try again.', 5000, true);
        } catch (e) { H.toast('Sign-in error: ' + (e.message || ''), 6000, true); }
      };
      urlListener = await App.addListener('appUrlOpen', onUrl);
      await Browser.open({ url: data.url });
      return;
    }

    // Last resort if the Browser/App plugins are unavailable: standard web OAuth.
    const _webOpts = { redirectTo: window.location.origin + window.location.pathname };
    if (provider === 'google') _webOpts.queryParams = { prompt: 'select_account' };
    const { error } = await c.auth.signInWithOAuth({
      provider: provider,
      options: _webOpts
    });
    if (error) H.toast(error.message || 'Sign-in failed', 6000, true);
  }

  H.authGoogle = async function() {
    const c = sb();
    if (!c) { H.toast('Sign-in service unavailable'); return; }
    const inCap = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
    if (inCap) { await _oauthInCap(c, 'google'); return; }
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) H.toast(error.message || 'Google sign-in failed');
  };

  H.authApple = async function() {
    const c = sb();
    if (!c) { H.toast('Sign-in service unavailable'); return; }
    const inCap = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
    if (inCap) { await _oauthInCap(c, 'apple'); return; }
    const { error } = await c.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) H.toast(error.message || 'Apple sign-in failed');
  };

  H._togglePw = function(id) {
    var inp = document.getElementById(id);
    var eye = document.getElementById(id + '_eye');
    if (!inp) return;
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    if (eye) {
      eye.innerHTML = show
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  };

  H.authShowSetPassword = function() {
    // Called when user arrives via password reset email link
    var bg  = document.getElementById('modalBg');
    var box = document.getElementById('modalBox');
    if (!bg || !box) return;
    box.classList.remove('login-modal');
    box.innerHTML = '<div class="modal-header"><h3>Set New Password</h3></div>'
      + '<div class="modal-body-scroll">'
      + '<div class="fg" style="padding-top:8px"><div class="fl">New Password</div>'
      + '<div style="position:relative"><input class="fi" id="rpNewPass" type="password" placeholder="8+ chars, uppercase &amp; number" oninput="H._updatePassStrength()" style="padding-right:44px">'
      + '<button type="button" onclick="H._togglePw(\'rpNewPass\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px"><svg id="rpNewPass_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>'
      + '<div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px"><div id="passStrengthBar" style="height:100%;border-radius:2px;transition:all .3s;width:0"></div></div>'
      + '<div id="passStrengthLabel" style="font-size:11px;margin-top:3px;text-align:right;height:14px;color:var(--text-sub)"></div></div>'
      + '<div class="fg"><div class="fl">Confirm Password</div>'
      + '<div style="position:relative"><input class="fi" id="rpNewPass2" type="password" placeholder="re-enter password" style="padding-right:44px">'
      + '<button type="button" onclick="H._togglePw(\'rpNewPass2\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px"><svg id="rpNewPass2_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>'
      + '</div>'
      + '<div class="modal-footer"><div class="modal-btns">'
      + '<button class="modal-btn confirm" onclick="H.authDoSetPassword()">Save Password</button>'
      + '</div></div>';
    bg.classList.add('open');
    setTimeout(function(){ var e = document.getElementById('rpNewPass'); if(e) e.focus({preventScroll:true}); }, 100);
  };

  H.authDoSetPassword = async function() {
    var pass  = ((document.getElementById('rpNewPass')  || {}).value || '').trim();
    var pass2 = ((document.getElementById('rpNewPass2') || {}).value || '').trim();
    if (pass.length < 8)         { H.toast('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(pass))     { H.toast('Password must include an uppercase letter'); return; }
    if (!/[0-9]/.test(pass) && !/[^A-Za-z0-9]/.test(pass)) { H.toast('Password must include a number or special character'); return; }
    if (pass !== pass2)          { H.toast('Passwords do not match'); return; }
    var c = sb();
    if (!c) { H.toast('Connection error'); return; }
    var btns = document.querySelectorAll('#modalBox button');
    btns.forEach(function(b){ b.disabled = true; });
    var res = await c.auth.updateUser({ password: pass });
    btns.forEach(function(b){ b.disabled = false; });
    if (res.error) { H.toast(res.error.message || 'Failed to update password'); return; }
    H.closeModal();
    H.toast('Password updated! Please sign in.');
    H.requireAuth('Sign in with your new password');
  };

  H.authShowDoc = function(which) {
    var sheet   = document.getElementById('docSheet');
    var titleEl = document.getElementById('docSheetTitle');
    var bodyEl  = document.getElementById('docSheetBody');
    if (!sheet || !titleEl || !bodyEl) return;
    var titles = { terms: 'Terms & Conditions', privacy: 'Privacy Policy', guidelines: 'Community Guidelines' };
    titleEl.textContent = titles[which] || 'Document';
    bodyEl.innerHTML    = which === 'terms' ? H._termsText() : which === 'guidelines' ? H._guidelinesText() : H._privacyText();
    bodyEl.scrollTop    = 0;
    sheet.classList.add('open');
  };

  H.closeDocSheet = function() {
    var sheet = document.getElementById('docSheet');
    if (sheet) sheet.classList.remove('open');
  };

  H._termsText = function() {
    return '<div class="doc-content">'
      + '<h2>Terms of Service</h2>'
      + '<p><strong>Last updated: June 2026</strong></p>'
      + '<p>These Terms of Service ("Terms") form a legally binding agreement between you ("User", "you") and PaMarket Zimbabwe ("PaMarket", "we", "us", "our"). By accessing or using the PaMarket mobile application or website you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you must stop using the platform immediately.</p>'

      + '<h3>1. Changes to These Terms</h3>'
      + '<p>We may update these Terms at any time. We will notify you of material changes by in-app notification or by posting the updated Terms with a new effective date. Your continued use of PaMarket after changes are posted constitutes your acceptance of the revised Terms. If you disagree with any change, your only remedy is to stop using the platform and delete your account.</p>'

      + '<h3>2. Eligibility</h3>'
      + '<p>You must be at least 18 years old and have full legal capacity to enter into binding contracts under the laws of Zimbabwe. By creating an account you represent and warrant that you meet these requirements. We reserve the right to terminate any account we have reason to believe belongs to a person under 18, without notice or liability.</p>'

      + '<h3>3. Account Registration and Security</h3>'
      + '<p>You may register using a valid email address, phone number, or a supported third-party sign-in provider (e.g. Google). You are solely responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. You must notify us immediately at chakusaprince@gmail.com if you become aware of any unauthorised access. We will not be liable for any loss caused by someone else using your account with or without your knowledge. You may hold only one account; duplicate accounts will be removed.</p>'

      + '<h3>4. Nature of the Platform - PaMarket Is a Marketplace Only</h3>'
      + '<p>PaMarket is an online classifieds and services marketplace. We provide technology that enables users to list goods, services, jobs, and business profiles, and to communicate with each other. <strong>PaMarket is not a buyer, seller, employer, employee, broker, agent, or auctioneer.</strong> We do not own, inspect, store, or ship any item listed on the platform. We do not employ, represent, endorse, or guarantee any user, business, or job poster. Any contract for the purchase or sale of any item or service is made directly between the buyer and the seller. PaMarket is not a party to any such contract.</p>'

      + '<h3>5. Licence You Grant PaMarket</h3>'
      + '<p>By submitting content to PaMarket (including photos, text, videos, business names, and descriptions) you grant PaMarket a worldwide, non-exclusive, royalty-free, sublicensable, and transferable licence to use, reproduce, modify, adapt, publish, translate, distribute, and display that content across all media formats, including within the app, on our website, and for promotional purposes, for as long as the content remains on our platform. You represent and warrant that you own or have the necessary rights to grant this licence and that your content does not infringe the rights of any third party.</p>'

      + '<h3>6. Listing Rules</h3>'
      + '<p>All listings must meet the following requirements:</p>'
      + '<ul>'
      + '<li>You must own the item or have verifiable legal authority to sell it.</li>'
      + '<li>The title, description, photos, price, and location must accurately represent the item. No misleading statements, omissions of known defects, or inflated valuations.</li>'
      + '<li>All prices must be quoted in United States Dollars (USD). Listings in any other currency will be removed.</li>'
      + '<li>Photos must be real images of the actual item. Stock images, watermarked images, or images of a different item are not permitted.</li>'
      + '<li>Do not post duplicate listings for the same item across multiple categories or provinces.</li>'
      + '<li>Listings must be placed in the correct category. Miscategorised listings will be moved or removed.</li>'
      + '<li>Remove or mark your listing as sold as soon as the item is no longer available.</li>'
      + '</ul>'
      + '<p>PaMarket reserves the right to edit, reclassify, reject, or remove any listing at any time, with or without notice, for any reason including but not limited to violation of these Terms.</p>'

      + '<h3>7. Prohibited Items and Content</h3>'
      + '<p>The following items, services, and types of content are strictly prohibited on PaMarket:</p>'
      + '<ul>'
      + '<li>Stolen goods or goods obtained through fraud or deception.</li>'
      + '<li>Counterfeit, fake, or unauthorised copies of branded goods (replica watches, fake designer clothing, pirated software, etc.).</li>'
      + '<li>Goods requiring ZIMRA import permits, licences, or customs clearance that the seller does not hold.</li>'
      + '<li>Illegal drugs, narcotics, controlled substances, or drug paraphernalia.</li>'
      + '<li>Unlicensed firearms, weapons, ammunition, explosives, or related accessories.</li>'
      + '<li>Wildlife, live animals, animal parts, or products protected under CITES or the Zimbabwe Parks and Wildlife Act.</li>'
      + '<li>Tobacco products, alcohol, or spirits sold without the required ZIMRA/Government of Zimbabwe retail licence.</li>'
      + '<li>Pornographic, sexually explicit, or adult content of any kind.</li>'
      + '<li>Content that promotes or incites violence, hatred, discrimination, or terrorism on the basis of race, ethnicity, religion, gender, sexual orientation, or disability.</li>'
      + '<li>Pyramid schemes, multilevel marketing recruitment (MLM), advance fee fraud (419), Ponzi schemes, or any deceptive financial offer.</li>'
      + '<li>Impersonation of any individual, business, government body, or official institution.</li>'
      + '<li>Personal data or private information of third parties without their consent.</li>'
      + '<li>Human beings, human organs, or any service that constitutes human trafficking.</li>'
      + '<li>Prescription medicines or medical devices sold without a valid pharmacist or medical licence.</li>'
      + '<li>Hazardous chemicals, flammable materials, or radioactive substances.</li>'
      + '<li>Any item or service whose listing, sale, or purchase is prohibited under the laws of Zimbabwe.</li>'
      + '</ul>'
      + '<p>This list is non-exhaustive. PaMarket retains sole discretion to determine what constitutes prohibited content and to remove any content that we consider harmful, illegal, or contrary to the spirit of these Terms.</p>'

      + '<h3>8. Business Shops</h3>'
      + '<p>Business accounts may create a verified Shop profile with a product catalogue and a dedicated business inbox. You must be the legitimate owner or an authorised representative of the business entity named in the Shop. All business details including name, registration status, contact information, and product listings must be accurate and kept up to date. PaMarket may request proof of business registration at any time and reserves the right to downgrade or remove verification, suspend, or permanently close any Business Shop that provides false information or violates these Terms. PaMarket does not guarantee or warrant the legitimacy, quality, or delivery of any product or service offered by a Business Shop.</p>'

      + '<h3>9. Hire Talent</h3>'
      + '<p>Employers may post job openings subject to admin review, which is typically completed within 24 hours. All job postings must be for genuine, existing vacancies at a real organisation operating lawfully within Zimbabwe. <strong>Charging job seekers any registration, application, training, or placement fee is strictly prohibited and will result in immediate permanent account suspension and may be reported to the Zimbabwe Republic Police.</strong> PaMarket is not an employment agency and is not responsible for the accuracy of job descriptions, the conduct of employers, or any employment relationship that arises from a listing. Candidates use Hire Talent at their own risk and should independently verify the legitimacy of any potential employer before sharing personal information or attending an interview.</p>'

      + '<h3>10. Transactions - No Involvement by PaMarket</h3>'
      + '<p>PaMarket does not facilitate, guarantee, insure, or supervise any transaction between users. We do not process payments, hold escrow funds, or provide buyer or seller protection of any kind. All agreements, payments, and deliveries are arranged directly between the buyer and the seller. PaMarket expressly disclaims any liability for:</p>'
      + '<ul>'
      + '<li>Non-payment, partial payment, or delayed payment by a buyer.</li>'
      + '<li>Non-delivery, partial delivery, or late delivery of goods by a seller.</li>'
      + '<li>Goods that are defective, misdescribed, counterfeit, stolen, or do not match the listing.</li>'
      + '<li>Fraud, scams, or deceptive conduct by any user.</li>'
      + '<li>Loss, damage, or injury arising from a meeting between users.</li>'
      + '<li>Any dispute arising from a transaction conducted through or discovered on the platform.</li>'
      + '</ul>'

      + '<h3>11. Messaging and User Conduct</h3>'
      + '<p>PaMarket\'s in-app messaging is provided to facilitate legitimate transactions. You agree not to use messaging to send spam, unsolicited bulk messages, harassment, threats, sexually explicit content, or any content that violates these Terms. We do not read your private messages as a matter of course; however, we may review messages if they are reported to us for abuse. Do not share your bank account details, national ID numbers, passwords, or other sensitive personal information through the messaging system.</p>'

      + '<h3>12. Third-Party Links and Services</h3>'
      + '<p>The platform may contain links to third-party websites, services, or resources. PaMarket has no control over the content, privacy practices, or availability of such third-party sites. A link to a third-party site does not constitute an endorsement, sponsorship, or recommendation by PaMarket. You access any third-party links entirely at your own risk. PaMarket is not responsible for any loss or damage arising from your use of third-party websites or services.</p>'

      + '<h3>13. Our Intellectual Property</h3>'
      + '<p>The PaMarket name, logo, app design, user interface, proprietary software, written content, and all other intellectual property on the platform are owned by PaMarket or its licensors and are protected by copyright, trademark, and other intellectual property laws. You may not copy, reproduce, modify, distribute, create derivative works from, publicly display, or commercially exploit any part of our intellectual property without our prior written permission. Unauthorised use may result in civil and criminal liability.</p>'

      + '<h3>14. Copyright and IP Infringement - Takedown Requests</h3>'
      + '<p>If you believe that content on PaMarket infringes your copyright or other intellectual property rights, please contact us in writing at chakusaprince@gmail.com with the following information: (a) a description of the copyrighted work or IP right you claim has been infringed; (b) the URL or location of the allegedly infringing content on PaMarket; (c) your name, address, phone number, and email; (d) a statement that you have a good-faith belief that the use is not authorised; (e) a statement that the information in your notice is accurate and that you are the rights owner or authorised to act on the owner\'s behalf. We will review all valid takedown requests and act in accordance with applicable law.</p>'

      + '<h3>15. Disclaimers - No Warranties</h3>'
      + '<p>TO THE FULLEST EXTENT PERMITTED BY ZIMBABWEAN LAW, PAMARKET PROVIDES THE PLATFORM "AS IS" AND "AS AVAILABLE" WITHOUT ANY REPRESENTATION OR WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT: (a) THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES; (b) ANY LISTING ON THE PLATFORM IS ACCURATE, COMPLETE, LEGAL, OR GENUINE; (c) THE IDENTITY OR CREDITWORTHINESS OF ANY USER HAS BEEN VERIFIED; (d) ANY ITEM OR SERVICE LISTED IS FIT FOR THE PURPOSE FOR WHICH IT IS SOLD. YOU USE THE PLATFORM ENTIRELY AT YOUR OWN RISK.</p>'

      + '<h3>16. Limitation of Liability</h3>'
      + '<p>TO THE FULLEST EXTENT PERMITTED BY ZIMBABWEAN LAW, PAMARKET AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND LICENSORS SHALL NOT BE LIABLE TO YOU FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, LOSS OF DATA, LOSS OF GOODWILL, OR LOSS OF BUSINESS OPPORTUNITY, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE PLATFORM, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ANY CLAIM ARISING FROM OR RELATED TO THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE GREATER OF (a) THE AMOUNT YOU PAID TO PAMARKET IN THE 12 MONTHS PRECEDING THE CLAIM, OR (b) USD 10. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES, SO THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU IN FULL.</p>'

      + '<h3>17. Indemnification</h3>'
      + '<p>You agree to defend, indemnify, and hold harmless PaMarket and its officers, directors, employees, contractors, agents, licensors, and service providers from and against any and all claims, liabilities, damages, judgments, awards, losses, costs, expenses, and fees (including reasonable legal fees) arising out of or relating to: (a) your violation of these Terms; (b) any content you post, upload, or transmit on the platform; (c) your conduct towards other users; (d) your violation of any third-party right, including intellectual property or privacy rights; (e) any transaction you enter into through or facilitated by the platform; or (f) your violation of any applicable law or regulation.</p>'

      + '<h3>18. Termination</h3>'
      + '<p>PaMarket reserves the right to suspend, restrict, or permanently terminate your access to the platform at any time, with or without notice, for any reason, including but not limited to violation of these Terms, fraudulent activity, or conduct harmful to other users or to PaMarket. Upon termination, your licence to use the platform immediately ceases. You may delete your account at any time via Settings, and your data will be handled as described in our Privacy Policy. Termination does not relieve you of any obligations that arose before termination, including indemnification obligations.</p>'

      + '<h3>19. Force Majeure</h3>'
      + '<p>PaMarket shall not be liable for any failure or delay in performance of its obligations under these Terms caused by circumstances beyond our reasonable control, including but not limited to internet or telecommunications failures, power outages, natural disasters, civil unrest, government actions, cyberattacks, pandemics, or acts of God. In such circumstances our obligations will be suspended for the duration of the event.</p>'

      + '<h3>20. Governing Law and Dispute Resolution</h3>'
      + '<p>These Terms are governed by and construed in accordance with the laws of the Republic of Zimbabwe, without regard to its conflict of law provisions. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Zimbabwe. Before commencing formal proceedings, you agree to contact us in good faith to attempt to resolve the dispute informally. We will attempt to resolve any complaint within 30 days of receipt.</p>'

      + '<h3>21. Miscellaneous</h3>'
      + '<p><strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy and Community Guidelines, constitute the entire agreement between you and PaMarket and supersede all prior agreements.</p>'
      + '<p><strong>Severability:</strong> If any provision of these Terms is found to be unenforceable, that provision will be limited or eliminated to the minimum extent necessary so that the remaining Terms remain in full force and effect.</p>'
      + '<p><strong>No Waiver:</strong> Our failure to enforce any right or provision of these Terms is not a waiver of that right or provision.</p>'
      + '<p><strong>Assignment:</strong> You may not assign or transfer your rights under these Terms without our prior written consent. We may assign our rights without restriction.</p>'
      + '<p><strong>Electronic Communications:</strong> By using PaMarket you consent to receive communications from us electronically, including via in-app notifications, push notifications, and email.</p>'

      + '<h3>22. Contact</h3>'
      + '<p>PaMarket Zimbabwe<br>Email: chakusaprince@gmail.com<br>WhatsApp: +971 589 772 645</p>'
      + '</div>';
  };

  H._privacyText = function() {
    return '<div class="doc-content">'
      + '<h2>Privacy Policy</h2>'
      + '<p><strong>Last updated: June 2026</strong></p>'
      + '<p>PaMarket Zimbabwe ("PaMarket", "we", "us", "our") is committed to protecting your privacy and handling your personal information responsibly. This Privacy Policy explains what data we collect, why we collect it, how we use and protect it, who we share it with, how long we keep it, and what rights you have over it. By using PaMarket you agree to the practices described in this Policy.</p>'

      + '<h3>1. Who Is the Data Controller</h3>'
      + '<p>PaMarket Zimbabwe is the data controller responsible for your personal information collected through the PaMarket mobile application and website. This Policy is governed by the Zimbabwe Cyber Security and Data Protection Act [Chapter 12:07] and applicable Zimbabwean data protection law. Contact us at chakusaprince@gmail.com for any privacy-related enquiry.</p>'

      + '<h3>2. Information We Collect</h3>'
      + '<p><strong>Account and identity data:</strong> your full name, email address, phone number, and profile photo when you register or update your profile.</p>'
      + '<p><strong>Verification data:</strong> a copy of your national ID or passport when you voluntarily request a verified badge. This document is reviewed by our admin team and permanently deleted within 30 days of the review outcome, regardless of approval or rejection.</p>'
      + '<p><strong>Listing data:</strong> photos, titles, descriptions, prices, categories, provinces, and suburbs you provide when posting a listing or creating a Business Shop.</p>'
      + '<p><strong>Business data:</strong> business name, type, description, logo, cover image, contact details, province, suburb, and product catalogue if you create a Business Shop.</p>'
      + '<p><strong>Job and CV data:</strong> employment history, skills, education, province, and any other information you include in a Hire Talent candidate profile or job posting.</p>'
      + '<p><strong>Message and communication data:</strong> the content of messages, images, offer cards, and location pins you send and receive through the in-app messaging system.</p>'
      + '<p><strong>Push notification token:</strong> a device token generated by Google Firebase Cloud Messaging (Android) or Apple Push Notification Service (iOS) to enable delivery of notifications about messages, listing activity, and account events. You can withdraw this permission at any time in your device Settings.</p>'
      + '<p><strong>Usage and behavioural data:</strong> pages viewed, search queries, listings saved or reported, categories browsed, and other in-app actions, collected to understand how users engage with the platform and to improve the service.</p>'
      + '<p><strong>Device and technical data:</strong> device model, operating system version, app version, IP address, and crash/error logs, used for technical troubleshooting and security monitoring.</p>'

      + '<h3>3. Legal Basis for Processing</h3>'
      + '<p>We process your personal data on the following grounds:</p>'
      + '<ul>'
      + '<li><strong>Contract performance:</strong> to register your account, display your listings, deliver messages, and operate the core features of the platform that you have signed up for.</li>'
      + '<li><strong>Legitimate interests:</strong> to detect and prevent fraud, abuse, spam, and illegal content; to improve the platform; to monitor the security of our systems; and to respond to reports of violations.</li>'
      + '<li><strong>Consent:</strong> to send push notifications (you can withdraw consent at any time via device settings); to collect verification documents (voluntary and withdrawable).</li>'
      + '<li><strong>Legal obligation:</strong> to comply with lawful requests from Zimbabwean authorities, including the Zimbabwe Republic Police and POTRAZ, when legally required.</li>'
      + '</ul>'

      + '<h3>4. How We Use Your Information</h3>'
      + '<ul>'
      + '<li>To create and manage your account and verify your identity.</li>'
      + '<li>To display your listings, Business Shop, candidate profile, or job postings to other users.</li>'
      + '<li>To deliver in-app and push notifications about messages, offers, listing status, and account events.</li>'
      + '<li>To moderate listings and enforce our Terms of Service and Community Guidelines.</li>'
      + '<li>To investigate reports of abuse, fraud, or illegal content and take enforcement action.</li>'
      + '<li>To improve the app\'s features, design, and performance based on aggregated usage analytics.</li>'
      + '<li>To detect and prevent security threats, unauthorised access, and fraudulent behaviour.</li>'
      + '<li>To comply with legal obligations and respond to lawful requests from authorities.</li>'
      + '</ul>'

      + '<h3>5. Sharing and Service Providers</h3>'
      + '<p>We do not sell, rent, or trade your personal information to any third party. We share your data only with the following trusted service providers ("sub-processors") strictly for the purposes described:</p>'
      + '<ul>'
      + '<li><strong>Supabase Inc.:</strong> database hosting, user authentication, file storage, and real-time subscriptions. Data is hosted on Amazon Web Services (AWS) in the eu-west-1 (Ireland) region.</li>'
      + '<li><strong>Google LLC (Firebase):</strong> Android push notification delivery via Firebase Cloud Messaging (FCM). Google receives only an anonymous device token and the notification payload; it does not receive your full profile.</li>'
      + '<li><strong>Apple Inc. (APNS):</strong> iOS push notification delivery via Apple Push Notification Service. Apple receives only a device token and notification payload.</li>'
      + '<li><strong>Google LLC (Sign in with Google):</strong> if you choose to register or log in using your Google account, Google shares your name and email address with us to create your PaMarket account.</li>'
      + '</ul>'
      + '<p>All sub-processors are bound by data processing agreements that prohibit them from using your data for their own purposes or sharing it with anyone else. We may also disclose your data if required to do so by a court order, warrant, or lawful request from a competent Zimbabwean authority.</p>'

      + '<h3>6. Push Notifications</h3>'
      + '<p>We send push notifications to alert you to new messages, listing approvals, business enquiries, and other account activity. You can disable push notifications at any time in your device\'s notification settings. Disabling notifications does not affect your ability to use the app, but you may miss time-sensitive messages from other users.</p>'

      + '<h3>7. Camera, Photos, and Media</h3>'
      + '<p>The app requests permission to access your device camera and photo library only when you choose to upload photos for a listing, your profile picture, or your Business Shop logo and cover image. We do not scan your photo library or access any images beyond those you explicitly select and upload. Uploaded photos are stored in our Supabase file storage and are publicly accessible via the listing or profile where they appear.</p>'

      + '<h3>8. Location Data</h3>'
      + '<p>PaMarket does not request or collect your precise GPS location automatically. Province and suburb information is entered manually by you when creating a listing or account. You may optionally share a location pin within the in-app messaging system; this pin is shared only with the specific recipient of that message.</p>'

      + '<h3>9. Cookies and Analytics</h3>'
      + '<p>The PaMarket web version may use strictly necessary cookies to maintain your session. We do not use advertising cookies or cross-site tracking. Aggregated, anonymised usage analytics are collected within the app to understand feature usage and improve the user experience. No analytics data is linked to your name or contact details.</p>'

      + '<h3>10. Data Retention</h3>'
      + '<ul>'
      + '<li><strong>Account data:</strong> retained while your account is active. Deleted within 30 days of you requesting account deletion via Settings.</li>'
      + '<li><strong>Listings:</strong> retained until you delete them or your account is closed. Deleted listings are removed from public view immediately but may remain in server logs for up to 90 days.</li>'
      + '<li><strong>Messages:</strong> retained for 24 months from the date of last activity in the conversation, then automatically purged.</li>'
      + '<li><strong>Verification documents:</strong> permanently deleted within 30 days of the verification review outcome.</li>'
      + '<li><strong>Push notification tokens:</strong> deleted when you log out or uninstall the app.</li>'
      + '<li><strong>Server and security logs:</strong> retained for 90 days for security monitoring and fraud detection, then deleted.</li>'
      + '</ul>'

      + '<h3>11. Security</h3>'
      + '<p>All data is transmitted using HTTPS/TLS encryption. Passwords are never stored in plain text; authentication is managed by Supabase Auth using industry-standard hashing. Our database tables are protected by row-level security (RLS) policies, which means each user can only access their own data unless they have been explicitly granted access (e.g. conversation participants). We conduct periodic security reviews and apply security patches promptly. Despite these measures, no system is completely secure. If you become aware of a security vulnerability, please report it immediately to chakusaprince@gmail.com.</p>'

      + '<h3>12. Your Rights and Choices</h3>'
      + '<ul>'
      + '<li><strong>Access:</strong> you can request a copy of the personal data we hold about you by emailing us. We will respond within 30 days.</li>'
      + '<li><strong>Correction:</strong> update your name, phone number, profile photo, and other details via Settings - Edit Profile at any time.</li>'
      + '<li><strong>Deletion:</strong> delete your account and all associated data via Settings - Security - Delete Account. Account deletion is irreversible.</li>'
      + '<li><strong>Notification opt-out:</strong> disable push notifications in your device Settings at any time.</li>'
      + '<li><strong>Portability:</strong> request an export of your data in a machine-readable format by emailing us.</li>'
      + '<li><strong>Withdraw consent:</strong> where processing is based on your consent (e.g. verification documents, push notifications), you may withdraw consent at any time without affecting the lawfulness of prior processing.</li>'
      + '</ul>'
      + '<p>To exercise any of these rights, contact us at chakusaprince@gmail.com. We will not discriminate against you for exercising your privacy rights.</p>'

      + '<h3>13. International Data Transfers</h3>'
      + '<p>Your data is stored and processed by Supabase on Amazon Web Services infrastructure located in Ireland (EU). By using PaMarket you consent to this transfer. We ensure that all international transfers are subject to appropriate contractual safeguards, including Supabase\'s standard data processing agreement.</p>'

      + '<h3>14. Children\'s Privacy</h3>'
      + '<p>PaMarket is intended for users aged 18 and over. We do not knowingly collect personal information from anyone under the age of 18. If we become aware that a user is under 18, we will delete their account and all associated data without notice. If you believe a child has registered on our platform, please contact us immediately at chakusaprince@gmail.com.</p>'

      + '<h3>15. Marketing Communications</h3>'
      + '<p>We may occasionally send you in-app notifications about new features, platform updates, or promotional offers from PaMarket. We do not send marketing emails or SMS without your explicit opt-in. You can opt out of in-app promotional notifications by adjusting your notification preferences in Settings.</p>'

      + '<h3>16. Changes to This Policy</h3>'
      + '<p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or business operations. We will notify you of significant changes via an in-app notification or a prominent notice in the app. The "Last updated" date at the top of this Policy will always reflect the date of the most recent revision. Your continued use of PaMarket after changes are posted constitutes your acceptance of the updated Policy.</p>'

      + '<h3>17. Contact</h3>'
      + '<p>For any privacy-related enquiry, request, or complaint:<br>PaMarket Zimbabwe<br>Email: chakusaprince@gmail.com<br>WhatsApp: +971 589 772 645</p>'
      + '</div>';
  };

  H._guidelinesText = function() {
    return '<div class="doc-content">'
      + '<h2>Community Guidelines</h2>'
      + '<p><strong>Last updated: June 2026</strong></p>'
      + '<p>PaMarket is a community marketplace built on trust. These guidelines set the standards of behaviour we expect from every user - buyers, sellers, business owners, job seekers, and employers. Violating these guidelines may result in your listing being removed, your account being suspended, or a permanent ban. Serious violations may be reported to law enforcement authorities in Zimbabwe.</p>'

      + '<h3>1. Listing Honesty</h3>'
      + '<p>Every listing must be honest and complete:</p>'
      + '<ul>'
      + '<li>Only list items you physically have in your possession and have the legal right to sell.</li>'
      + '<li>Your title, description, and photos must accurately represent the actual condition, age, brand, model, and any known defects of the item.</li>'
      + '<li>Do not use manufacturer stock photos or images downloaded from the internet. Take real photos of the actual item under good lighting.</li>'
      + '<li>Clearly disclose any damage, scratches, faults, missing parts, or prior repairs in the description.</li>'
      + '<li>Remove or update your listing immediately when the item is sold, rented, or no longer available.</li>'
      + '<li>Do not repost the same item repeatedly to push it to the top of search results.</li>'
      + '</ul>'

      + '<h3>2. Prohibited Items and Services</h3>'
      + '<p>The following are never permitted on PaMarket, regardless of context or claimed purpose:</p>'
      + '<ul>'
      + '<li><strong>Stolen goods</strong> of any kind.</li>'
      + '<li><strong>Counterfeit goods:</strong> fake branded clothing, replica watches, pirated software, unauthorised copies of any product.</li>'
      + '<li><strong>Drugs and narcotics:</strong> any illegal substance, controlled drug, or drug paraphernalia.</li>'
      + '<li><strong>Weapons:</strong> unlicensed firearms, illegal knives, ammunition, explosives, or weapons parts.</li>'
      + '<li><strong>Wildlife:</strong> live wild animals, ivory, rhino horn, skins, or any product protected under the Zimbabwe Parks and Wildlife Act or CITES.</li>'
      + '<li><strong>Adult content:</strong> pornographic images, videos, or services of any kind.</li>'
      + '<li><strong>Unlicensed alcohol and tobacco</strong> sold without a valid government retail licence.</li>'
      + '<li><strong>Prescription medicine</strong> sold without a valid pharmacist licence.</li>'
      + '<li><strong>Financial scams:</strong> pyramid schemes, chain letters, MLM recruitment, Ponzi schemes, advance fee fraud (419), investment opportunities with guaranteed returns.</li>'
      + '<li><strong>Counterfeit currency</strong> or any instrument used to commit fraud.</li>'
      + '<li><strong>Rental or property listings for properties that do not exist</strong> or that the poster has no right to let.</li>'
      + '<li><strong>Human trafficking</strong> or any offer of persons for sale, labour exploitation, or sexual services.</li>'
      + '<li><strong>Personal data</strong> of third parties, including phone number lists, email databases, or identity documents.</li>'
      + '<li><strong>Hazardous materials</strong> including toxic chemicals, flammable gases, or radioactive items.</li>'
      + '</ul>'

      + '<h3>3. Listing Quality Standards</h3>'
      + '<ul>'
      + '<li><strong>Title:</strong> be specific. Include brand, model, year, size, or condition where relevant. "2019 Samsung Galaxy S10 128GB - Excellent Condition" is better than "Samsung phone for sale".</li>'
      + '<li><strong>Description:</strong> write at least 3-4 sentences. Include why you are selling, the history of the item, any accessories included, and your preferred contact method.</li>'
      + '<li><strong>Price:</strong> set a realistic market price in USD. Check similar listings to calibrate. "Price negotiable" is acceptable as a note but every listing must have a price.</li>'
      + '<li><strong>Photos:</strong> upload at least 2 clear photos. Show multiple angles, include any damage, and photograph serial numbers on electronics. A listing with 5+ photos gets significantly more enquiries.</li>'
      + '<li><strong>Category:</strong> choose the most specific correct category. If your item fits multiple categories, choose the primary one.</li>'
      + '<li><strong>Location:</strong> select the actual province and suburb where the item is located. Do not list in a different area to attract more views.</li>'
      + '</ul>'

      + '<h3>4. Pricing Standards</h3>'
      + '<ul>'
      + '<li>All prices on PaMarket must be in United States Dollars (USD). This is a platform-wide rule.</li>'
      + '<li>Do not list items at deliberately misleading prices to attract clicks, then refuse to sell at that price.</li>'
      + '<li>If your price changes, update your listing immediately.</li>'
      + '<li>Do not attempt to collect payment in cryptocurrency, mobile money from a stranger before meeting, or any form that removes buyer protection, unless both parties have agreed in full knowledge of the risks.</li>'
      + '</ul>'

      + '<h3>5. Respectful Communication</h3>'
      + '<ul>'
      + '<li>Treat every user with courtesy, even if a negotiation does not go your way.</li>'
      + '<li>Do not send bulk or unsolicited messages. Do not use PaMarket messaging to advertise to strangers.</li>'
      + '<li>Do not threaten, bully, harass, intimidate, or discriminate against any user on the basis of race, ethnicity, gender, religion, sexual orientation, disability, or any other characteristic.</li>'
      + '<li>Do not share your bank account number, national ID, passport, or PIN through the chat. PaMarket will never ask for this information through chat.</li>'
      + '<li>If someone is rude, threatening, or suspicious, use the Block and Report functions. Do not engage or retaliate.</li>'
      + '</ul>'

      + '<h3>6. Business Shop Standards</h3>'
      + '<ul>'
      + '<li>Your Business Shop must represent a real, lawfully operating business registered or operating in Zimbabwe.</li>'
      + '<li>Your business name, description, logo, contact details, and product listings must all be accurate.</li>'
      + '<li>Do not impersonate another business, brand, or organisation. Do not use another company\'s logo, name, or trademarks without written permission.</li>'
      + '<li>If your business changes address, phone number, or closes, update or remove your Business Shop immediately.</li>'
      + '<li>Featured listings in your Shop must represent products you actually stock and are ready to sell.</li>'
      + '<li>Do not use your Business Shop to promote pyramid schemes, MLM downlines, or financial products without appropriate licensing.</li>'
      + '</ul>'

      + '<h3>7. Hire Talent Standards - Employers</h3>'
      + '<ul>'
      + '<li>Job postings must be for genuine, existing vacancies at a real organisation. Fake job listings are fraud.</li>'
      + '<li><strong>Never charge candidates any fee to apply, register, train, or be placed.</strong> This is illegal under Zimbabwean labour law and is grounds for immediate permanent account suspension and referral to the Zimbabwe Republic Police.</li>'
      + '<li>Job descriptions must be accurate regarding the role, responsibilities, remuneration, and required qualifications.</li>'
      + '<li>Do not post the same job multiple times to appear at the top of search results.</li>'
      + '<li>Mark your job as filled as soon as the vacancy is no longer open.</li>'
      + '</ul>'

      + '<h3>8. Hire Talent Standards - Job Seekers</h3>'
      + '<ul>'
      + '<li>Your candidate profile must be accurate. Do not misrepresent your qualifications, experience, or skills.</li>'
      + '<li>Do not create multiple profiles to increase visibility.</li>'
      + '<li>Never pay any fee to apply for a job, attend an interview, or receive a job offer. Genuine employers do not charge candidates. If asked for money, report the listing immediately.</li>'
      + '</ul>'

      + '<h3>9. Fraud and Scam Awareness</h3>'
      + '<p>PaMarket is a free platform and we cannot screen every user. Protect yourself:</p>'
      + '<ul>'
      + '<li><strong>Advance fee fraud:</strong> if a buyer asks you to send an item before receiving payment, or offers to overpay by cheque and asks you to refund the difference - this is a scam. Decline and report.</li>'
      + '<li><strong>Fake rental deposits:</strong> never pay a deposit for a property before physically viewing it and verifying the landlord owns or manages it.</li>'
      + '<li><strong>Too-good-to-be-true prices:</strong> a brand new iPhone for USD 50 is not a bargain, it is stolen or non-existent. Walk away.</li>'
      + '<li><strong>Urgency pressure:</strong> scammers create false urgency ("I leave the country today, pay now"). Take your time. Legitimate sellers will wait.</li>'
      + '<li><strong>Impersonation:</strong> if someone claims to be a PaMarket employee or admin asking for your password or payment, this is a scam. PaMarket will never contact you through chat asking for payment or credentials.</li>'
      + '</ul>'

      + '<h3>10. Safe Transactions</h3>'
      + '<ul>'
      + '<li>Always meet in a busy, public location during daylight hours. Shopping malls, filling station forecourts, and bank lobbies are recommended.</li>'
      + '<li>Bring a friend or family member when meeting a stranger for a high-value transaction.</li>'
      + '<li>Never invite a stranger to your home or travel alone to a stranger\'s home for a first meeting.</li>'
      + '<li>Inspect and verify goods before handing over any money.</li>'
      + '<li>For vehicle sales, insist on a test drive and verify the log book matches the seller\'s ID before paying.</li>'
      + '<li>For electronics, test the device fully before payment. Power it on, check IMEI against the box, verify the screen, camera, and ports work.</li>'
      + '<li>Trust your instincts. If something feels wrong, walk away.</li>'
      + '</ul>'

      + '<h3>11. Reporting Violations</h3>'
      + '<p>If you see content that violates these guidelines:</p>'
      + '<ul>'
      + '<li>Tap the "..." or Report icon on the listing, profile, or message and select a reason.</li>'
      + '<li>For urgent safety or fraud concerns, email chakusaprince@gmail.com directly with as much detail as possible.</li>'
      + '<li>For criminal matters (stolen goods, fraud, weapons), contact the Zimbabwe Republic Police and share the listing URL with them.</li>'
      + '</ul>'
      + '<p>All reports are reviewed by our moderation team. We may not be able to share the outcome of every report with the reporter, but we act on all valid reports.</p>'

      + '<h3>12. How We Enforce These Guidelines</h3>'
      + '<p>We apply a graduated enforcement approach based on the severity and frequency of violations:</p>'
      + '<ul>'
      + '<li><strong>Warning:</strong> first minor violation (e.g. mislabelled category, missing price). Listing is removed or corrected and you receive an in-app warning.</li>'
      + '<li><strong>Temporary suspension (7-30 days):</strong> repeated minor violations or first moderate violation (e.g. misleading description, duplicate listings, disrespectful messaging).</li>'
      + '<li><strong>Permanent ban:</strong> serious violations including fraud, listing illegal items, charging job seekers fees, sharing prohibited content, or any criminal activity. Permanent bans are not reversed. All listings and data are removed.</li>'
      + '<li><strong>Law enforcement referral:</strong> where there is evidence of criminal activity (fraud, stolen goods, drugs, weapons, human trafficking), we will cooperate fully with the Zimbabwe Republic Police, POTRAZ, and other competent authorities, including providing user data under valid legal process.</li>'
      + '</ul>'

      + '<h3>13. Appeals</h3>'
      + '<p>If you believe your listing was removed or your account was actioned in error, you may appeal by emailing chakusaprince@gmail.com within 14 days of the action, stating your account details and the reason you believe the action was incorrect. We will review your appeal and respond within 14 business days. Appeals against permanent bans for serious violations (fraud, illegal content, criminal activity) will not be considered.</p>'

      + '<h3>14. Contact</h3>'
      + '<p>PaMarket Zimbabwe<br>Email: chakusaprince@gmail.com<br>WhatsApp: +971 589 772 645</p>'
      + '</div>';
  };

})(window.H);
