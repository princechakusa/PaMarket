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

  function updatePassStrength() {
    var p   = document.getElementById('newPass');
    var bar = document.getElementById('passStrengthBar');
    var lbl = document.getElementById('passStrengthLabel');
    if (!p || !bar || !lbl) return;
    if (!p.value) { bar.style.width='0'; lbl.textContent=''; return; }
    var s = passwordStrength(p.value);
    bar.style.width      = s.width;
    bar.style.background = s.color;
    lbl.textContent      = s.label;
    lbl.style.color      = s.color;
  }
  H._updatePassStrength = updatePassStrength;

  H.authLogoTap = function() {
    H.logoTap && H.logoTap();
  };

  H.authStepEmail = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    var ill = document.querySelector('.login-modal-illustration');
    if (ill) ill.style.display = '';
    card.innerHTML = ''
      + '<button class="social-auth-btn google" onclick="H.authGoogle()"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</button>'
      + '<div class="auth-divider"><span>or</span></div>'
      + '<button class="social-auth-btn email" onclick="H.authShowEmailForm()"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1A3A8F" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Login with email</button>'
      + '<div style="text-align:center;margin-top:16px;font-size:13px;color:var(--text-sub)">Don\'t have an account? <span onclick="H.authShowRegister()" style="color:#1A3A8F;font-weight:700;cursor:pointer">Create one</span></div>';
  };

  H.authShowEmailForm = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:700;color:var(--text)">Sign In</div></div>'
      + '<div class="fg"><div class="fl">Email</div><input class="fi" id="emailIn" type="email" placeholder="you@example.com" autocomplete="email"></div>'
      + '<div class="fg"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="fl" style="margin-bottom:0">Password</span><span onclick="H.authForgotPassword()" style="font-size:12px;color:#F5A623;cursor:pointer;font-weight:500">Forgot password?</span></div><div style="position:relative"><input class="fi" id="passIn" type="password" placeholder="Password" onkeydown="if(event.key===\'Enter\')H.authSignIn()" autocomplete="current-password" style="padding-right:44px"><button type="button" onclick="H._togglePw(\'passIn\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px;line-height:1"><svg id="passIn_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>'
      + '<button class="auth-btn" onclick="H.authSignIn()">Sign In</button>'
      + '<button class="auth-btn secondary" onclick="H.authStepEmail()">&larr; Back</button>';
    setTimeout(function(){ var e=document.getElementById('emailIn'); if(e) e.focus(); }, 100);
  };

  H.authShowRegister = function() { H.authStepSignUp(); };

  H.authShow2FA = function(userId) {
    H._pendingTwoFactorUserId = userId;
    var card = document.getElementById('authCard');
    if (!card) {
      H.requireAuth && H.requireAuth('Two-factor authentication');
      card = document.getElementById('authCard');
    }
    if (!card) return;
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:800;color:var(--text-primary)">Enter authentication code</div><div style="font-size:13px;color:var(--text-sub);margin-top:6px;line-height:1.5">Open your authenticator app and enter the 6-digit code for PaMarket.</div></div>'
      + '<div class="fg"><div class="fl">6-digit code</div><input class="fi" id="twoFactorLoginCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"></div>'
      + '<button class="auth-btn" onclick="H.authVerify2FA()">Verify & Continue</button>'
      + '<button class="auth-btn secondary" onclick="H.authCancel2FA()">Cancel</button>';
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
    var u = (H.state.users || []).find(function(x){ return x.id === userId; });
    var code = ((document.getElementById('twoFactorLoginCode') || {}).value || '').trim();
    if (!u || !u.twoFactorEnabled || !u.twoFactorSecret) { H.toast('2FA setup not found'); return; }
    if (!H._twoFactorVerify || !await H._twoFactorVerify(u.twoFactorSecret, code)) {
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
    var ill = document.querySelector('.login-modal-illustration');
    if (ill) ill.style.display = 'none';
    card.innerHTML = ''
      + '<div class="fg"><div class="fl">Full Name</div><input class="fi" id="newName" placeholder="e.g. Tendai Moyo" autocomplete="name"></div>'
      + '<div class="fg"><div class="fl">Email</div><input class="fi" id="newEmail" type="email" placeholder="you@example.com" autocomplete="email"></div>'
      + '<div class="fg"><div class="fl">Phone (optional)</div><input class="fi" id="newPhone" type="tel" placeholder="+263 77 123 4567" autocomplete="tel"></div>'
      + '<div class="fg"><div class="fl">Password</div><div style="position:relative"><input class="fi" id="newPass" type="password" placeholder="8+ chars, uppercase &amp; number" oninput="H._updatePassStrength()" autocomplete="new-password" style="padding-right:44px"><button type="button" onclick="H._togglePw(\'newPass\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px;line-height:1"><svg id="newPass_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div><div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px"><div id="passStrengthBar" style="height:100%;border-radius:2px;transition:all .3s;width:0"></div></div><div id="passStrengthLabel" style="font-size:11px;margin-top:3px;text-align:right;height:14px;color:var(--text-sub)"></div></div>'
      + '<div class="fg"><div class="fl">Confirm Password</div><div style="position:relative"><input class="fi" id="newPass2" type="password" placeholder="re-enter password" autocomplete="new-password" style="padding-right:44px"><button type="button" onclick="H._togglePw(\'newPass2\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-hint);padding:4px;line-height:1"><svg id="newPass2_eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>'
      + '<label style="display:flex;gap:10px;align-items:flex-start;font-size:12px;color:#667085;margin-bottom:10px;cursor:pointer"><input id="ageConsent" type="checkbox" style="margin-top:2px"><span>I am 18+ and agree to <span onclick="event.stopPropagation();H.authShowDoc(\'terms\')" style="color:#1A3A8F;text-decoration:underline;cursor:pointer">Terms &amp; Conditions</span> and <span onclick="event.stopPropagation();H.authShowDoc(\'privacy\')" style="color:#1A3A8F;text-decoration:underline;cursor:pointer">Privacy Policy</span></span></label>'
      + '<button class="auth-btn" onclick="H.authSignUp()">Create Account</button>'
      + '<button class="auth-btn secondary" onclick="H.authStepEmail()">&larr; Back to Sign In</button>';
    setTimeout(function(){ var e=document.getElementById('newName'); if(e) e.focus(); }, 100);
  };

  H.authShowOtp = function(email) {
    var card = document.getElementById('authCard');
    if (!card) return;
    H._otpEmail = email;
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:20px">'
      + '<div style="margin-bottom:10px;color:#1A3A8F"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>'
      + '<div style="font-size:20px;font-weight:700;color:var(--text)">Verify Your Email</div>'
      + '<div style="font-size:13px;color:var(--sub);margin-top:8px;line-height:1.6">We sent a 6-digit code to<br><strong style="color:var(--text)">' + H.escHtml(email) + '</strong></div>'
      + '</div>'
      + '<div class="fg"><div class="fl" style="text-align:center">Verification Code</div><input class="fi" id="otpIn" type="text" inputmode="numeric" maxlength="6" placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;" style="letter-spacing:10px;text-align:center;font-size:24px;font-weight:700" onkeydown="if(event.key===\'Enter\')H.authVerifyOtp()"></div>'
      + '<button class="auth-btn" onclick="H.authVerifyOtp()">Verify &amp; Continue</button>'
      + '<div style="text-align:center;margin-top:12px;font-size:13px;color:var(--sub)">Didn\'t get the code? <span onclick="H.authResendOtp()" style="color:#F5A623;font-weight:600;cursor:pointer">Resend</span></div>'
      + '<div style="text-align:center;margin-top:6px;font-size:12px;color:var(--sub)">Check spam if not received within 2 minutes</div>'
      + '<button class="auth-btn secondary" style="margin-top:16px" onclick="H.authStepEmail()">&larr; Back to Sign In</button>';
    setTimeout(function(){ var e=document.getElementById('otpIn'); if(e) e.focus(); }, 100);
  };

  H.authVerifyOtp = async function() {
    var otp = ((document.getElementById('otpIn')||{}).value||'').trim().replace(/\s/g,'');
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
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:700;color:var(--text)">Reset Password</div><div style="font-size:13px;color:var(--sub);margin-top:4px">Enter your email to receive a reset link</div></div>'
      + '<div class="fg"><div class="fl">Email</div><input class="fi" id="resetEmail" type="email" placeholder="you@example.com" autocomplete="email" onkeydown="if(event.key===\'Enter\')H.authSendReset()"></div>'
      + '<button class="auth-btn" onclick="H.authSendReset()">Send Reset Link</button>'
      + '<button class="auth-btn secondary" onclick="H.authShowEmailForm()">&larr; Back to Sign In</button>';
    setTimeout(function(){ var e=document.getElementById('resetEmail'); if(e) e.focus(); }, 100);
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
    card.innerHTML = ''
      + '<div style="text-align:center;padding:24px 0">'
      + '<div style="margin-bottom:14px;color:#1A3A8F"><svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg></div>'
      + '<div style="font-size:18px;font-weight:700;color:var(--text)">Check Your Email</div>'
      + '<div style="font-size:14px;color:var(--sub);margin-top:10px;line-height:1.6">A reset link was sent to<br><strong style="color:var(--text)">' + H.escHtml(email) + '</strong><br><br>Click the link in the email to set a new password. Check your spam folder if you don\'t see it.</div>'
      + '</div>'
      + '<button class="auth-btn secondary" onclick="H.authShowEmailForm()">&larr; Back to Sign In</button>';
  };

  H.authSignIn = async function() {
    if (authBusy) return;
    if (isLocked()) return;
    var email    = document.getElementById('emailIn').value.trim();
    var password = document.getElementById('passIn').value;
    if (!validateEmail(email)) { H.toast('Enter a valid email address'); return; }
    if (!password) { H.toast('Enter your password'); return; }
    setAuthBusy(true);
    var c = sb();
    if (c) {
      var capTok = await H._captcha();
      var res = await c.auth.signInWithPassword({email:email, password:password, options: capTok ? {captchaToken: capTok} : {}});
      if (res.error) {
        var msg = res.error.message;
        if (msg==='Invalid login credentials') msg = 'Wrong email or password';
        if (msg.includes('Email not confirmed')) msg = 'Please verify your email first';
        recordFailure();
        H.toast(msg); setAuthBusy(false); return;
      }
      H.state.currentUserId = res.data.user.id;
      await H.loadProfile(res.data.user.id);
      var su = H.currentUser();
      if (su && su.twoFactorEnabled && su.twoFactorSecret) {
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
    var user = (H.state.users||[]).find(function(u){ return (u.email||'').toLowerCase()===email.toLowerCase() && u._localPassword===password; });
    if (!user) { recordFailure(); H.toast('Wrong email or password'); setAuthBusy(false); return; }
    recordSuccess();
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      H._pendingTwoFactorUserId = user.id;
      H.state.currentUserId = null;
      H.saveState();
      setAuthBusy(false);
      H.authShow2FA(user.id);
      return;
    }
    H.state.currentUserId = user.id;
    H.saveState(); setAuthBusy(false); if (H.closeLoginModal) H.closeLoginModal(); H.boot();
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
    var exists = (H.state.users||[]).some(function(u){ return (u.email||'').toLowerCase()===email.toLowerCase(); });
    if (exists) { H.toast('Email already registered. Sign in instead.'); setAuthBusy(false); return; }
    var uid2 = H.uid();
    (H.state.users = H.state.users||[]).push({id:uid2,email:email,name:name,phone:phone||'',avatar:null,verified:false,language:'English',joinedAt:Date.now(),role:'user',status:'active',banReason:null,banUntil:null,blocked:[],_localPassword:password});
    H.state.currentUserId = uid2;
    H.saveState(); setAuthBusy(false);
    H.toast('Account created! Welcome to PaMarket');
    if (H.closeLoginModal) H.closeLoginModal();
    H.boot();
  };

  H.authAdminPage = function() {
    var card = document.getElementById('authCard');
    if (!card) return;
    card.innerHTML = ''
      + '<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:700;color:var(--text)">Admin Portal</div><div style="font-size:13px;color:var(--sub)">Restricted access</div></div>'
      + '<div class="fg"><div class="fl">Admin Email</div><input class="fi" id="admEmailPage" type="email" autocomplete="username"></div>'
      + '<div class="fg"><div class="fl">Password</div><input class="fi" id="admPassPage" type="password" placeholder="Password" onkeydown="if(event.key===\'Enter\')H.authAdminSignInPage()" autocomplete="current-password"></div>'
      + '<button class="auth-btn" onclick="H.authAdminSignInPage()">Admin Sign In</button>'
      + '<button class="auth-btn secondary" onclick="H.authStepEmail()">&larr; Back</button>';
    setTimeout(function(){ var p=document.getElementById('admEmailPage'); if(p) p.focus(); }, 100);
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
      if (profile.cv_file_url   != null) u.cvFileUrl      = profile.cv_file_url;
      if (profile.cv_file_name  != null) u.cvFileName     = profile.cv_file_name;
      if (profile.cv            != null) u.cv             = profile.cv;
    }
    H.saveState();
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
      + '<h2>Terms &amp; Conditions</h2>'
      + '<p><strong>Last updated: June 2026</strong></p>'
      + '<p>Welcome to PaMarket. By downloading or using the PaMarket app you agree to these Terms. Please read them carefully before using the platform.</p>'
      + '<h3>1. Acceptance</h3>'
      + '<p>By creating an account or using any part of PaMarket you accept these Terms and our Privacy Policy. If you do not agree, do not use the app.</p>'
      + '<h3>2. Eligibility</h3>'
      + '<p>You must be at least 18 years old and legally capable of entering into contracts under Zimbabwean law. By registering you confirm you meet this requirement. Accounts found to belong to under-18s will be terminated without notice.</p>'
      + '<h3>3. Account Registration</h3>'
      + '<p>You are responsible for keeping your login credentials secure and for all activity under your account. Notify us immediately at chakusaprince@gmail.com if you suspect unauthorised access. One account per person; duplicate accounts may be removed.</p>'
      + '<h3>4. The Platform</h3>'
      + '<p>PaMarket provides four core services: <strong>Marketplace</strong> - buy and sell goods across 12 categories in all 10 provinces; <strong>Business Shops</strong> - verified storefronts with product catalogs and business inboxes; <strong>Hire Talent</strong> - job postings and candidate profiles; <strong>Direct Messaging</strong> - real-time chat between users. We are a platform only. We do not buy, sell, or take ownership of any listed item or service.</p>'
      + '<h3>5. Posting Listings</h3>'
      + '<p>You may only list items you own or have legal authority to sell. All listing details (title, description, photos, price, location) must be accurate and not misleading. Prices must be in USD. Do not post the same item in multiple categories or provinces simultaneously. PaMarket may edit, remove, or reclassify any listing at any time without notice.</p>'
      + '<h3>6. Prohibited Items</h3>'
      + '<p>The following are strictly prohibited: stolen, counterfeit, or unlicensed goods; goods that require ZIMRA import permits you do not hold; illegal drugs, weapons, ammunition, or explosives; CITES-protected wildlife or wildlife products; tobacco or alcohol sold outside POTRAZ/licensing requirements; explicit or adult content; hate speech or discriminatory content; pyramid schemes, advance fee fraud, or misleading financial offers; impersonation of any person, business, or official body; personal data of third parties.</p>'
      + '<h3>7. Business Shops</h3>'
      + '<p>Business accounts may create a verified Shop with a product catalog. You must be the legitimate owner or authorised representative of the business. All business information must be accurate. We reserve the right to revoke verification if information is found to be false.</p>'
      + '<h3>8. Hire Talent</h3>'
      + '<p>Employers may post job openings after admin review (within 24 hours). Job postings must be for genuine vacancies. Charging candidates a registration or application fee is prohibited and will result in permanent account suspension.</p>'
      + '<h3>9. Transactions</h3>'
      + '<p>PaMarket does not process payments or hold funds. All transactions are directly between buyer and seller. We accept no liability for non-delivery, mis-description, fraud, or any loss arising from a transaction. Exercise caution: meet in public places, verify identity, and never send money before inspecting goods.</p>'
      + '<h3>10. Intellectual Property</h3>'
      + '<p>Content you post (photos, descriptions) remains yours. By posting, you grant PaMarket a non-exclusive, royalty-free licence to display it within the app and on our website. The PaMarket name, logo, and app design are our intellectual property and may not be copied or reused without written permission.</p>'
      + '<h3>11. Privacy</h3>'
      + '<p>Our Privacy Policy is incorporated into these Terms by reference. By using PaMarket you also agree to our Privacy Policy.</p>'
      + '<h3>12. Community Guidelines</h3>'
      + '<p>Our Community Guidelines govern how you interact with other users. Violations may result in listing removal, account suspension, or permanent banning.</p>'
      + '<h3>13. Disclaimers</h3>'
      + '<p>PaMarket is provided "as is" without warranties of any kind. We do not warrant the accuracy or legality of any listing, the identity of any user, or the suitability of any item for any purpose. The app may be unavailable from time to time for maintenance.</p>'
      + '<h3>14. Limitation of Liability</h3>'
      + '<p>To the maximum extent permitted by Zimbabwean law, PaMarket\'s total liability for any claim arising from your use of the app is limited to USD 10. We are not liable for indirect, incidental, consequential, or punitive damages.</p>'
      + '<h3>15. Indemnification</h3>'
      + '<p>You agree to indemnify and hold PaMarket harmless from any claims, losses, or damages (including legal fees) arising from your breach of these Terms, your listings, or your conduct toward other users.</p>'
      + '<h3>16. Termination</h3>'
      + '<p>We may suspend or permanently ban any account that violates these Terms, with or without notice. You may delete your account at any time via Settings - Security - Delete Account.</p>'
      + '<h3>17. Governing Law</h3>'
      + '<p>These Terms are governed by the laws of Zimbabwe. Any disputes shall be resolved in the courts of Zimbabwe.</p>'
      + '<h3>18. Contact</h3>'
      + '<p>Email: chakusaprince@gmail.com<br>WhatsApp: +971 589 772 645</p>'
      + '</div>';
  };

  H._privacyText = function() {
    return '<div class="doc-content">'
      + '<h2>Privacy Policy</h2>'
      + '<p><strong>Last updated: June 2026</strong></p>'
      + '<p>PaMarket Zimbabwe ("we", "us", or "our") is committed to protecting your personal information. This policy explains what data we collect, how we use it, who we share it with, and your rights.</p>'
      + '<h3>1. Information We Collect</h3>'
      + '<p><strong>Account data:</strong> name, email address, phone number, and profile photo when you register.</p>'
      + '<p><strong>Verification data:</strong> national ID or passport image when you request a verified badge (deleted within 30 days of review).</p>'
      + '<p><strong>Listing data:</strong> photos, descriptions, prices, category, and location you provide when posting an ad.</p>'
      + '<p><strong>Message data:</strong> messages, images, and location pins you send through in-app chat.</p>'
      + '<p><strong>Push notification token:</strong> a device token issued by Google FCM (Android) or Apple APNS (iOS) to deliver notifications. You can disable notifications at any time in your device settings.</p>'
      + '<p><strong>Usage data:</strong> pages viewed, searches, listings saved, and in-app actions for analytics and app improvement.</p>'
      + '<p><strong>Device data:</strong> device type, OS version, and app version for crash reporting.</p>'
      + '<h3>2. How We Use Your Information</h3>'
      + '<p>To operate and improve PaMarket; to authenticate your account; to display your listings and business profile to other users; to deliver in-app and push notifications about messages, offers, and account activity; to review listings and enforce our policies; to respond to reports of abuse or illegal content.</p>'
      + '<h3>3. Service Providers</h3>'
      + '<p>We do not sell your data. We share data only with the following sub-processors: <strong>Supabase</strong> (database, authentication, and storage - hosted on AWS eu-west-1, EU); <strong>Google Firebase</strong> (Android push notifications); <strong>Apple APNS</strong> (iOS push notifications); <strong>Google</strong> (Sign in with Google, if chosen). All providers are bound by data processing agreements and may not use your data for their own purposes.</p>'
      + '<h3>4. Camera and Photo Library</h3>'
      + '<p>The app requests camera and photo library access only to let you upload listing photos and a profile picture. We do not access your camera or photos for any other purpose.</p>'
      + '<h3>5. Data Retention</h3>'
      + '<p>Account data: retained while your account is active, deleted within 30 days of account deletion. Messages: retained for 12 months then automatically deleted. Verification documents: deleted within 30 days of review. Server logs: retained for 90 days for security monitoring.</p>'
      + '<h3>6. Security</h3>'
      + '<p>All data is transmitted over HTTPS. Passwords are never stored in plain text - authentication is managed by Supabase. Database tables are protected by row-level security policies so users can only access their own data.</p>'
      + '<h3>7. Your Rights</h3>'
      + '<p><strong>Access:</strong> request a copy of your data by emailing us. <strong>Correction:</strong> update your profile via Settings - Edit Profile. <strong>Deletion:</strong> delete your account via Settings - Security - Delete Account. <strong>Opt-out:</strong> disable push notifications in your device settings at any time. <strong>Portability:</strong> request a data export by contacting us.</p>'
      + '<h3>8. Children\'s Privacy</h3>'
      + '<p>PaMarket is not intended for users under 18. We do not knowingly collect data from children. If we become aware that a child has registered, the account will be deleted immediately.</p>'
      + '<h3>9. Changes to This Policy</h3>'
      + '<p>We may update this policy from time to time. We will notify you of significant changes via in-app notification. Continued use of the app constitutes acceptance of the updated policy.</p>'
      + '<h3>10. Contact</h3>'
      + '<p>Email: chakusaprince@gmail.com<br>WhatsApp: +971 589 772 645</p>'
      + '</div>';
  };

  H._guidelinesText = function() {
    return '<div class="doc-content">'
      + '<h2>Community Guidelines</h2>'
      + '<p><strong>Last updated: June 2026</strong></p>'
      + '<p>These guidelines exist to keep PaMarket safe, honest, and useful for everyone in Zimbabwe. Violations may result in listing removal, account suspension, or a permanent ban.</p>'
      + '<h3>1. Honest Listings</h3>'
      + '<p>Only list what you actually have for sale. Your title, description, photos, and price must accurately represent the item. Do not use stock photos for items you own - use real photos. Do not mark a sold item as available.</p>'
      + '<h3>2. Prohibited Items</h3>'
      + '<p>You may not list: stolen goods; counterfeit or fake branded goods; goods requiring import permits you do not hold; illegal drugs, weapons, ammunition; CITES-protected wildlife or wildlife products; adult content; tobacco or alcohol outside licensing; personal data of third parties; pyramid schemes or advance-fee offers.</p>'
      + '<h3>3. Listing Quality</h3>'
      + '<p>Use a clear, descriptive title. Upload at least one real photo - blurry or watermarked stock images will be removed. Set a genuine price in USD. Choose the correct category and province so buyers can find your listing.</p>'
      + '<h3>4. Respectful Communication</h3>'
      + '<p>Treat other users with respect. Do not send spam, unsolicited bulk messages, or harassment. Do not threaten, abuse, or discriminate against any user. Block and report anyone who contacts you inappropriately.</p>'
      + '<h3>5. Business Shops</h3>'
      + '<p>Business accounts must represent genuine, legally operating businesses. Business information must be accurate. Impersonating another business or using another brand\'s trademarks without permission is prohibited.</p>'
      + '<h3>6. Hire Talent</h3>'
      + '<p>Job postings must be for genuine vacancies. Never ask candidates to pay an application or registration fee - this is fraud. Misleading job descriptions will be removed and accounts suspended.</p>'
      + '<h3>7. Scam and Fraud Prevention</h3>'
      + '<p>Common scams to watch for: advance fee fraud (someone asks you to pay upfront before receiving goods or a job offer); fake rental listings (property that does not exist); counterfeit currency; overpayment scams. Always meet in a public place for cash transactions. Never send money before inspecting goods in person.</p>'
      + '<h3>8. Reporting</h3>'
      + '<p>Use the Report button on any listing or profile to flag a violation. Our team reviews all reports. You can also email chakusaprince@gmail.com for urgent safety concerns.</p>'
      + '<h3>9. Enforcement</h3>'
      + '<p>First violation: listing removed and warning issued. Repeated violations: temporary suspension. Serious violations (fraud, illegal content): immediate permanent ban with no appeal. We cooperate with Zimbabwe Republic Police and POTRAZ on criminal matters.</p>'
      + '<h3>10. Contact</h3>'
      + '<p>Email: chakusaprince@gmail.com<br>WhatsApp: +971 589 772 645</p>'
      + '</div>';
  };

})(window.H);
