// Shared session UI helper for the public website.
// Reads the same localStorage 'pm_session' shape written by auth.html/auth-callback.html.
// Injects an account chip + dropdown into #signInBtn's parent when a session exists.
(function (global) {
  var APP_URL = 'https://play.google.com/store/apps/details?id=com.pamarket.app';
  var SB_URL = global.SUPABASE_URL || 'https://gxgytumhknmnwspxjzxw.supabase.co';
  var SB_KEY = global.SUPABASE_ANON_KEY || 'sb_publishable_cf3Z72lUE6PLCb2m42OFLA_znE8JK2r';
  var SESSION_KEY = 'pm_session';
  var REFRESH_AHEAD_SECONDS = 300;
  var REFRESH_CHECK_MS = 30000;
  var refreshInFlight = null;

  function readStoredSession(value) {
    try {
      var raw = arguments.length ? value : localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    if (!session) return null;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession(reloadPage) {
    localStorage.removeItem(SESSION_KEY);
    if (reloadPage && global.location && typeof global.location.reload === 'function') {
      global.location.reload();
    }
  }

  function refreshSession() {
    if (refreshInFlight) return refreshInFlight;
    var current = readStoredSession();
    if (!current || !current.refresh_token) return Promise.resolve(null);

    refreshInFlight = fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    }).then(function (res) {
      if (!res.ok) {
        var error = new Error('Session refresh failed: ' + res.status);
        error.status = res.status;
        throw error;
      }
      return res.json();
    }).then(function (data) {
      if (!data || !data.access_token) throw new Error('Session refresh returned no access token');
      var latest = readStoredSession();
      // Another tab may have signed out while this request was in flight.
      if (!latest) return null;
      var renewed = Object.assign({}, latest, {
        access_token: data.access_token,
        refresh_token: data.refresh_token || latest.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        user: data.user || latest.user,
      });
      return saveSession(renewed);
    }).catch(function (error) {
      // Auth rejections mean the refresh token is genuinely unusable. Preserve
      // the session on network/server failures so an outage does not sign out
      // otherwise valid users; the background check will retry.
      if (error && (error.status === 400 || error.status === 401 || error.status === 403)) {
        clearSession(true);
      }
      throw error;
    }).then(function (session) {
      refreshInFlight = null;
      return session;
    }, function (error) {
      refreshInFlight = null;
      throw error;
    });

    return refreshInFlight;
  }

  function maybeRefreshSession() {
    var session = readStoredSession();
    if (!session || !session.expires_at) return Promise.resolve(session);
    var secondsLeft = Number(session.expires_at) - Date.now() / 1000;
    if (secondsLeft > REFRESH_AHEAD_SECONDS) return Promise.resolve(session);
    if (session.refresh_token) return refreshSession();
    if (secondsLeft <= 0) clearSession(true);
    return Promise.resolve(secondsLeft <= 0 ? null : session);
  }

  function getSession() {
    var session = readStoredSession();
    if (!session) return null;
    if (session.expires_at && Number(session.expires_at) <= Date.now() / 1000 && !session.refresh_token) {
      clearSession(false);
      return null;
    }
    // Keep this API synchronous for the many existing callers. A near-expiry
    // session remains available while its token is renewed in the background.
    maybeRefreshSession().catch(function () {});
    return session;
  }

  function pmSignOut() {
    clearSession(true);
  }
  global.pmSignOut = pmSignOut;
  global.PMSession = {
    getSession: getSession,
    saveSession: saveSession,
    clearSession: clearSession,
    refreshSession: refreshSession,
    maybeRefresh: maybeRefreshSession,
  };

  function injectStyles() {
    if (document.getElementById('pmAcctStyles')) return;
    var style = document.createElement('style');
    style.id = 'pmAcctStyles';
    style.textContent =
      '.acct-wrap{position:relative}' +
      '.acct-chip{display:flex;align-items:center;gap:8px;border:1.5px solid #E2E8F0;border-radius:9px;padding:6px 10px 6px 6px;transition:border-color .15s;background:#fff;cursor:pointer}' +
      '.acct-chip:hover{border-color:#1A3A8F}' +
      '.acct-avatar{width:26px;height:26px;border-radius:50%;background:#1A3A8F;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;overflow:hidden}' +
      '.acct-avatar img{width:100%;height:100%;object-fit:cover}' +
      '.acct-name{font-size:13px;font-weight:600;color:#0F172A;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.acct-caret{color:#94A3B8;transition:transform .15s}' +
      '.acct-wrap.open .acct-caret{transform:rotate(180deg)}' +
      '.acct-menu{display:none;position:absolute;top:calc(100% + 8px);right:0;background:#fff;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 16px 40px rgba(15,36,96,.15);min-width:220px;padding:6px;z-index:400}' +
      '.acct-wrap.open .acct-menu{display:block}' +
      '.acct-menu a{display:block;padding:10px 12px;font-size:13.5px;color:#0F172A;border-radius:8px;font-weight:500}' +
      '.acct-menu a:hover{background:#F8FAFC}' +
      '.acct-menu .acct-sep{height:1px;background:#E2E8F0;margin:6px 4px}' +
      '.acct-menu .acct-signout{color:#DC2626;font-weight:600}';
    document.head.appendChild(style);
  }

  function initAccountUI() {
    var session = getSession();
    var signInBtn = document.getElementById('signInBtn');
    if (!signInBtn || !session || !session.user) return;

    injectStyles();

    var user = session.user;
    var name =
      (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
      user.email ||
      'Account';
    var initials = name
      .split(' ')
      .map(function (w) { return w[0]; })
      .slice(0, 2)
      .join('')
      .toUpperCase();
    var profileUrl = 'profile?id=' + encodeURIComponent(user.id);

    var wrap = document.createElement('div');
    wrap.className = 'acct-wrap';
    wrap.innerHTML =
      '<div class="acct-chip" id="acctChipBtn">' +
        '<span class="acct-avatar">' + (initials || 'U') + '</span>' +
        '<span class="acct-name">' + name.split(' ')[0] + '</span>' +
        '<svg class="acct-caret" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</div>' +
      '<div class="acct-menu">' +
        '<a href="dashboard">My Dashboard</a>' +
        '<a href="' + profileUrl + '">My Profile</a>' +
        '<a href="dashboard">My Ads</a>' +
        '<a href="post-job">Post a Job</a>' +
        '<a href="applications">Job Applications</a>' +
        '<a href="favourites">My Favourites</a>' +
        '<a href="saved-searches">Saved Searches</a>' +
        '<a href="notifications">Notifications</a>' +
        '<a href="' + APP_URL + '" target="_blank" rel="noopener">Chats (open app)</a>' +
        '<div class="acct-sep"></div>' +
        '<a href="rental-fleet">My Rental Fleet</a>' +
        '<a href="account-settings">Account Settings</a>' +
        '<a href="#" class="acct-signout" id="acctSignOutBtn">Sign Out</a>' +
      '</div>';

    signInBtn.replaceWith(wrap);

    wrap.querySelector('#acctChipBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });
    wrap.querySelector('#acctSignOutBtn').addEventListener('click', function (e) {
      e.preventDefault();
      pmSignOut();
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) wrap.classList.remove('open');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccountUI);
  } else {
    initAccountUI();
  }

  // Refresh immediately when needed, keep checking while a page stays open,
  // and catch sessions that became stale while the tab was in the background.
  maybeRefreshSession().catch(function () {});
  global.setInterval(function () { maybeRefreshSession().catch(function () {}); }, REFRESH_CHECK_MS);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') maybeRefreshSession().catch(function () {});
  });

  // localStorage events fire in the other tabs. Token rotation for the same
  // user needs no UI reset; sign-in, sign-out, or an account switch does.
  global.addEventListener('storage', function (event) {
    if (event.key !== SESSION_KEY) return;
    var before = readStoredSession(event.oldValue);
    var after = readStoredSession(event.newValue);
    var beforeId = before && before.user && before.user.id;
    var afterId = after && after.user && after.user.id;
    if (beforeId !== afterId && global.location && typeof global.location.reload === 'function') {
      global.location.reload();
    }
  });
})(window);
